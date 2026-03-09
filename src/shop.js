/**
 * 商店系统 - 自动领取免费礼包和用点券购买化肥
 * 参考 new sample 实现，使用 MallService
 */

const { types } = require('./proto');
const { sendMsgAsync, getUserState } = require('./network');
const { toLong, toNum, log, logWarn, sleep } = require('./utils');
const { getItemName } = require('./gameConfig');
const { Buffer } = require('node:buffer');

// 有机化肥商品ID
const ORGANIC_FERTILIZER_MALL_GOODS_ID = 1002;
const BUY_COOLDOWN_MS = 10 * 60 * 1000;
const MAX_ROUNDS = 100;
const BUY_PER_ROUND = 10;

// 购买化肥状态
let lastBuyAt = 0;
let buyDoneDateKey = '';
let buyLastSuccessAt = 0;
let buyPausedNoGoldDateKey = '';

function getDateKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ============ 商城 API ============

async function getMallListBySlotType(slotType = 1) {
    const body = types.GetMallListBySlotTypeRequest.encode(types.GetMallListBySlotTypeRequest.create({
        slot_type: Number(slotType) || 1,
    })).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.mallpb.MallService', 'GetMallListBySlotType', body);
    return types.GetMallListBySlotTypeResponse.decode(replyBody);
}

async function purchaseMallGoods(goodsId, count = 1) {
    const body = types.PurchaseRequest.encode(types.PurchaseRequest.create({
        goods_id: Number(goodsId) || 0,
        count: Number(count) || 1,
    })).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.mallpb.MallService', 'Purchase', body);
    return types.PurchaseResponse.decode(replyBody);
}

async function getMallGoodsList(slotType = 1) {
    const mall = await getMallListBySlotType(slotType);
    const raw = Array.isArray(mall && mall.goods_list) ? mall.goods_list : [];
    const goods = [];
    for (const b of raw) {
        try {
            goods.push(types.MallGoods.decode(b));
        } catch {
            // ignore
        }
    }
    return goods;
}

function parseMallPriceValue(priceField) {
    if (priceField == null) return 0;
    if (typeof priceField === 'number') return Math.max(0, Math.floor(priceField));
    const bytes = Buffer.isBuffer(priceField) ? priceField : Buffer.from(priceField || []);
    if (!bytes.length) return 0;
    // 从 bytes 中读取 field=2 的 varint 作为价格
    let idx = 0;
    let parsed = 0;
    while (idx < bytes.length) {
        const key = bytes[idx++];
        const field = key >> 3;
        const wire = key & 0x07;
        if (wire !== 0) break;
        let val = 0;
        let shift = 0;
        while (idx < bytes.length) {
            const b = bytes[idx++];
            val |= (b & 0x7F) << shift;
            if ((b & 0x80) === 0) break;
            shift += 7;
        }
        if (field === 2) parsed = val;
    }
    return Math.max(0, Math.floor(parsed || 0));
}

function findOrganicFertilizerMallGoods(goodsList) {
    const list = Array.isArray(goodsList) ? goodsList : [];
    return list.find((g) => toNum(g && g.goods_id) === ORGANIC_FERTILIZER_MALL_GOODS_ID) || null;
}

// ============ 用点券购买化肥 ============

async function autoBuyOrganicFertilizerViaMall() {
    const goodsList = await getMallGoodsList(1);
    const goods = findOrganicFertilizerMallGoods(goodsList);
    if (!goods) return 0;

    const goodsId = toNum(goods.goods_id);
    if (goodsId <= 0) return 0;
    const singlePrice = parseMallPriceValue(goods.price);
    let ticket = Math.max(0, toNum((getUserState() || {}).ticket));
    let totalBought = 0;
    let perRound = BUY_PER_ROUND;
    if (singlePrice > 0 && ticket > 0) {
        perRound = Math.max(1, Math.min(BUY_PER_ROUND, Math.floor(ticket / singlePrice) || 1));
    }

    for (let i = 0; i < MAX_ROUNDS; i++) {
        if (singlePrice > 0 && ticket > 0 && ticket < singlePrice) {
            buyPausedNoGoldDateKey = getDateKey();
            break;
        }
        try {
            await purchaseMallGoods(goodsId, perRound);
            totalBought += perRound;
            if (singlePrice > 0 && ticket > 0) {
                ticket = Math.max(0, ticket - (singlePrice * perRound));
                if (ticket < singlePrice) break;
            }
            await sleep(120);
        } catch (e) {
            const msg = String((e && e.message) || '');
            if (msg.includes('余额不足') || msg.includes('点券不足') || msg.includes('code=1000019')) {
                if (perRound > 1) {
                    perRound = 1;
                    continue;
                }
                buyPausedNoGoldDateKey = getDateKey();
            }
            break;
        }
    }
    return totalBought;
}

/**
 * 自动用点券购买有机化肥
 * @param {boolean} force 是否强制购买（忽略冷却）
 * @returns {number} 购买数量
 */
async function autoBuyOrganicFertilizer(force = false) {
    const now = Date.now();
    if (!force && now - lastBuyAt < BUY_COOLDOWN_MS) return 0;
    lastBuyAt = now;

    try {
        // 使用 MallService 购买链路（点券）
        const totalBought = await autoBuyOrganicFertilizerViaMall();
        if (totalBought > 0) {
            buyDoneDateKey = getDateKey();
            buyLastSuccessAt = Date.now();
            log('商城', `自动购买有机化肥 x${totalBought}`);
        }
        return totalBought;
    } catch {
        return 0;
    }
}

// ============ 免费礼包领取 ============

// 每日状态跟踪
let freeGiftDoneDateKey = '';
let freeGiftLastClaimAt = 0;

function getFreeGiftDateKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function markFreeGiftDoneToday() {
    freeGiftDoneDateKey = getFreeGiftDateKey();
}

function isFreeGiftDoneToday() {
    return freeGiftDoneDateKey === getFreeGiftDateKey();
}

/**
 * 检查并领取所有免费礼包
 * 参考 new sample 实现，使用 MallService 和 is_free 字段
 */
async function checkAndClaimFreeGifts(force = false) {
    if (!force && isFreeGiftDoneToday()) {
        log('礼包', '今日已检查过免费礼包，跳过');
        return 0;
    }

    try {
        log('礼包', '正在检查商城免费礼包...');
        const goods = await getMallGoodsList(1);
        log('礼包', `获取到 ${goods.length} 个商品`);

        // 打印前几个商品的信息用于调试
        if (goods.length > 0) {
            const sample = goods.slice(0, 3).map(g => ({
                goods_id: g.goods_id,
                is_free: g.is_free,
                price: parseMallPriceValue(g.price),
                limit_count: g.limit_count,
                bought_num: g.bought_num
            }));
            log('礼包', `商品示例: ${JSON.stringify(sample)}`);
        }

        // 使用 is_free 字段判断免费商品（参考 new sample）
        // 同时检查价格为0的商品作为备选
        // 同时检查是否还有购买次数（limit_count > bought_num）
        const free = goods.filter((g) => {
            if (!g || Number(g.goods_id || 0) <= 0) return false;

            // 检查是否标记为免费或价格为0
            const isFree = g.is_free === true;
            const price = parseMallPriceValue(g.price);
            const isZeroPrice = price === 0;

            if (!isFree && !isZeroPrice) return false;

            // 检查限购情况
            const limitCount = Number(g.limit_count || 0);
            const boughtNum = Number(g.bought_num || 0);

            // limit_count 为 0 表示不限购
            if (limitCount > 0 && boughtNum >= limitCount) {
                log('礼包', `商品 ${g.goods_id} 已达限购上限 (${boughtNum}/${limitCount})`);
                return false;
            }

            return true;
        });

        log('礼包', `发现 ${free.length} 个可领取的免费商品`);

        // 打印免费商品的详细信息
        for (const g of free) {
            const limitCount = Number(g.limit_count || 0);
            const boughtNum = Number(g.bought_num || 0);
            log('礼包', `免费商品 ${g.goods_id}: 限购=${limitCount}, 已购=${boughtNum}`);
        }

        if (!free.length) {
            log('礼包', '今日暂无可领取免费礼包');
            markFreeGiftDoneToday();
            return 0;
        }

        let bought = 0;
        let limitExceededCount = 0;
        for (const g of free) {
            const goodsId = Number(g.goods_id || 0);
            try {
                log('礼包', `正在领取免费商品 ${goodsId}...`);
                const result = await purchaseMallGoods(goodsId, 1);
                log('礼包', `领取成功: ${goodsId}`);
                bought++;
                await sleep(300);
            } catch (e) {
                const errorMsg = String(e.message || '');
                logWarn('礼包', `领取失败 ${goodsId}: ${errorMsg}`);

                // 检查是否是限购错误
                if (errorMsg.includes('限购') || errorMsg.includes('code=1031003')) {
                    limitExceededCount++;
                    log('礼包', `商品 ${goodsId} 已达限购上限，标记为今日已完成`);
                }
                // 单个失败跳过，继续下一个
            }
        }

        // 如果所有免费商品都因为限购而失败，标记今日已完成
        if (limitExceededCount > 0 && limitExceededCount >= free.length) {
            log('礼包', '所有免费商品已达限购上限，今日不再检查');
            markFreeGiftDoneToday();
        }

        if (bought > 0) {
            log('礼包', `自动领取免费礼包 x${bought}`);
            freeGiftLastClaimAt = Date.now();
            markFreeGiftDoneToday();
        } else {
            log('礼包', '本次未成功领取免费礼包');
        }
        return bought;
    } catch (e) {
        logWarn('礼包', `领取免费礼包失败: ${e.message}`);
        return 0;
    }
}

// ============ 启动/停止 ============

let checkTimer = null;
let initTimer = null;
let isStarted = false;

function start() {
    if (isStarted) return;
    isStarted = true;
    // 首次检查（延迟8秒，等待登录完成）
    initTimer = setTimeout(() => {
        initTimer = null;
        checkAndClaimFreeGifts().catch(() => {});
    }, 8000);

    // 定时检查（每小时一次）
    checkTimer = setInterval(() => {
        checkAndClaimFreeGifts().catch(() => {});
    }, 60 * 60 * 1000);
}

function stop() {
    if (!isStarted) return;
    isStarted = false;
    if (initTimer) {
        clearTimeout(initTimer);
        initTimer = null;
    }
    if (checkTimer) {
        clearInterval(checkTimer);
        checkTimer = null;
    }
}

function isRunning() {
    return isStarted;
}

module.exports = {
    checkAndClaimFreeGifts,
    autoBuyOrganicFertilizer,
    start,
    stop,
    isRunning,
    getFertilizerBuyDailyState: () => ({
        key: 'fertilizer_buy',
        doneToday: buyDoneDateKey === getDateKey(),
        pausedNoGoldToday: buyPausedNoGoldDateKey === getDateKey(),
        lastSuccessAt: buyLastSuccessAt,
    }),
    getFreeGiftDailyState: () => ({
        key: 'mall_free_gifts',
        doneToday: isFreeGiftDoneToday(),
        lastClaimAt: freeGiftLastClaimAt,
    }),
};
