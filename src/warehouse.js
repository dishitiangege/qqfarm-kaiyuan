/**
 * 仓库系统 - 自动出售果实和自动使用礼包
 * 协议说明：BagReply 使用 item_bag（ItemBag），item_bag.items 才是背包物品列表
 */

const { types } = require('./proto');
const { sendMsgAsync } = require('./network');
const { toLong, toNum, log, logWarn, emitRuntimeHint, sleep } = require('./utils');
const { getFruitName, getItemName, getAutoUsableItemIds, getItemInfoById, getPlantBySeedId, getPlantByFruitId } = require('./gameConfig');
const seedShopData = require('../tools/seed-shop-merged-export.json');

// 游戏内金币和点券的物品 ID (GlobalData.GodItemId / DiamondItemId)
const GOLD_ITEM_ID = 1001;
const FRUIT_ID_SET = new Set(
    ((seedShopData && seedShopData.rows) || [])
        .map(row => Number(row.fruitId))
        .filter(Number.isFinite)
);

let sellTimer = null;
let sellInterval = 60000;

function isFruitIdBySeedData(id) {
    return FRUIT_ID_SET.has(toNum(id));
}

/**
 * 从 SellReply 中提取获得的金币数量
 * 新版 SellReply 返回 get_items (repeated Item)，其中 id=1001 为金币
 */
function extractGold(sellReply) {
    if (sellReply.get_items && sellReply.get_items.length > 0) {
        for (const item of sellReply.get_items) {
            const id = toNum(item.id);
            if (id === GOLD_ITEM_ID) {
                return toNum(item.count);
            }
        }
        return 0;
    }
    if (sellReply.gold !== undefined && sellReply.gold !== null) {
        return toNum(sellReply.gold);
    }
    return 0;
}

async function getBag() {
    const body = types.BagRequest.encode(types.BagRequest.create({})).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.itempb.ItemService', 'Bag', body);
    return types.BagReply.decode(replyBody);
}

/**
 * 将 item 转为 Sell 请求所需格式（id/count/uid 保留 Long 或转成 Long，与游戏一致）
 */
function toSellItem(item) {
    const id = item.id != null ? toLong(item.id) : undefined;
    const count = item.count != null ? toLong(item.count) : undefined;
    const uid = item.uid != null ? toLong(item.uid) : undefined;
    return { id, count, uid };
}

async function sellItems(items) {
    const payload = items.map(toSellItem);
    const body = types.SellRequest.encode(types.SellRequest.create({ items: payload })).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.itempb.ItemService', 'Sell', body);
    return types.SellReply.decode(replyBody);
}

/**
 * 从 BagReply 取出物品列表（兼容 item_bag 与旧版 items）
 */
function getBagItems(bagReply) {
    if (bagReply.item_bag && bagReply.item_bag.items && bagReply.item_bag.items.length)
        return bagReply.item_bag.items;
    return bagReply.items || [];
}

/**
 * 使用物品
 */
async function useItem(itemId, count = 1) {
    const body = types.UseRequest.encode(types.UseRequest.create({
        item: { id: toLong(itemId), count: toLong(count) }
    })).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.itempb.ItemService', 'Use', body);
    return types.UseReply.decode(replyBody);
}

/**
 * 自动使用背包中的礼包道具
 */
async function autoUseItems(items) {
    const usableIds = getAutoUsableItemIds();
    let anyUsed = false;

    for (const item of items) {
        const id = toNum(item.id);
        const count = toNum(item.count);

        // 只处理可自动使用的物品类型
        if (!usableIds.has(id) || count <= 0) continue;

        const name = getItemName(id);

        for (let i = 0; i < count; i++) {
            try {
                const reply = await useItem(id, 1);
                anyUsed = true;

                if (reply.get_items && reply.get_items.length > 0) {
                    const rewards = reply.get_items.map(r => `${getItemName(toNum(r.id))}x${toNum(r.count)}`).join(', ');
                    log('背包', `使用 ${name} → ${rewards}`);
                } else {
                    log('背包', `使用 ${name} x1`);
                }

                await sleep(300);
            } catch (e) {
                // 使用失败不输出日志
                break; // 该物品使用失败，跳过剩余数量
            }
        }
    }

    return anyUsed;
}

async function sellAllFruits() {
    try {
        const bagReply = await getBag();
        const items = getBagItems(bagReply);

        const toSell = [];
        const names = [];
        for (const item of items) {
            const id = toNum(item.id);
            const count = toNum(item.count);
            const uid = item.uid ? toNum(item.uid) : 0;
            if (isFruitIdBySeedData(id) && count > 0) {
                if (uid === 0) continue;  // 跳过无效格子
                toSell.push(item);
                names.push(`${getFruitName(id)}x${count}`);
            }
        }

        if (toSell.length === 0) {
            // 没有果实可出售，尝试自动使用礼包
            await autoUseItems(items);
            return;
        }

        const reply = await sellItems(toSell);
        const totalGold = extractGold(reply);
        log('仓库', `出售 ${names.join(', ')}，获得 ${totalGold} 金币`);
        emitRuntimeHint(false);
        
        // 出售完成后，自动使用礼包
        const freshBagReply = await getBag();
        const freshItems = getBagItems(freshBagReply);
        await autoUseItems(freshItems);
        
    } catch (e) {
        logWarn('仓库', `出售失败: ${e.message}`);
    }
}

async function debugSellFruits() {
    try {
        log('仓库', '正在检查背包...');
        const bagReply = await getBag();
        const items = getBagItems(bagReply);
        log('仓库', `背包共 ${items.length} 种物品`);

        for (const item of items) {
            const id = toNum(item.id);
            const count = toNum(item.count);
            const isFruit = isFruitIdBySeedData(id);
            if (isFruit) {
                const name = getFruitName(id);
                log('仓库', `  [果实] ${name}(${id}) x${count}`);
            }
        }

        const toSell = [];
        for (const item of items) {
            const id = toNum(item.id);
            const count = toNum(item.count);
            if (isFruitIdBySeedData(id) && count > 0)
                toSell.push(item);
        }

        if (toSell.length === 0) {
            log('仓库', '没有果实可出售');
            return;
        }

        log('仓库', `准备出售 ${toSell.length} 种果实...`);
        const reply = await sellItems(toSell);
        const totalGold = extractGold(reply);
        log('仓库', `出售完成，共获得 ${totalGold} 金币`);
        emitRuntimeHint(false);
    } catch (e) {
        logWarn('仓库', `调试出售失败: ${e.message}`);
        console.error(e);
    }
}

/**
 * 独立的自动使用礼包循环
 * 不依赖自动出售，可以单独启用
 */
let giftUseTimer = null;

async function checkAndUseGifts() {
    try {
        const bagReply = await getBag();
        const items = getBagItems(bagReply);
        await autoUseItems(items);
    } catch (e) {
        // 检查失败不输出日志
    }
}

function startGiftUseLoop(interval = 60000) {
    if (giftUseTimer) return;
    setTimeout(() => {
        checkAndUseGifts();
        giftUseTimer = setInterval(() => checkAndUseGifts(), interval);
    }, 15000); // 延迟15秒启动，等待登录完成
}

function stopGiftUseLoop() {
    if (giftUseTimer) {
        clearInterval(giftUseTimer);
        giftUseTimer = null;
    }
}

function startSellLoop(interval = 60000) {
    if (sellTimer) return;
    sellInterval = interval;
    setTimeout(() => {
        sellAllFruits();
        sellTimer = setInterval(() => sellAllFruits(), sellInterval);
    }, 10000);
}

function stopSellLoop() {
    if (sellTimer) {
        clearInterval(sellTimer);
        sellTimer = null;
    }
}

/**
 * 获取背包详情（带物品信息补全和排序）
 * 用于前端展示，包含物品名称、分类、图片、排序等
 * @returns {Object} { totalKinds: 物品种类数, items: 物品列表 }
 */
async function getBagDetail() {
    const bagReply = await getBag();
    const rawItems = getBagItems(bagReply);
    const merged = new Map();

    for (const it of (rawItems || [])) {
        const id = toNum(it.id);
        const count = toNum(it.count);
        if (id <= 0 || count <= 0) continue;

        const info = getItemInfoById(id) || null;
        let name = info && info.name ? String(info.name) : '';
        let category = 'item';

        // 根据ID判断物品类型并补全名称
        if (id === 1 || id === 1001) {
            name = '金币';
            category = 'gold';
        } else if (id === 1101) {
            name = '经验';
            category = 'exp';
        } else if (getPlantByFruitId(id)) {
            if (!name) name = `${getFruitName(id)}果实`;
            category = 'fruit';
        } else if (getPlantBySeedId(id)) {
            const p = getPlantBySeedId(id);
            if (!name) name = `${p && p.name ? p.name : '未知'}种子`;
            category = 'seed';
        }
        if (!name) name = `物品${id}`;

        const interactionType = info && info.interaction_type ? String(info.interaction_type) : '';
        const priceId = info ? (Number(info.price_id) || 0) : 0;
        const priceUnit = priceId === 1005 ? '金豆豆' : priceId === 1002 ? '点券' : '金';

        if (!merged.has(id)) {
            merged.set(id, {
                id,
                count: 0,
                uid: 0,
                name,
                category,
                itemType: info ? (Number(info.type) || 0) : 0,
                priceId,
                price: info ? (Number(info.price) || 0) : 0,
                priceUnit,
                level: info ? (Number(info.level) || 0) : 0,
                interactionType,
            });
        }
        const row = merged.get(id);
        row.count += count;
    }

    const items = Array.from(merged.values());

    // 排序：变异物品(17) > 种子(5) > 果实(6) > 其他，同类型按数量降序
    items.sort((a, b) => {
        const taRaw = Number(a.itemType || 0);
        const tbRaw = Number(b.itemType || 0);

        // 类型优先级映射
        const typePriority = new Map([
            [17, 0],  // 变异物品优先级最高
            [5, 1],   // 种子
            [6, 2],   // 果实
        ]);

        const ta = typePriority.has(taRaw) ? typePriority.get(taRaw) : (taRaw > 0 ? (1000 + taRaw) : Number.MAX_SAFE_INTEGER);
        const tb = typePriority.has(tbRaw) ? typePriority.get(tbRaw) : (tbRaw > 0 ? (1000 + tbRaw) : Number.MAX_SAFE_INTEGER);

        if (ta !== tb) return ta - tb;

        // 同类型按数量降序
        const ca = Number(a.count || 0);
        const cb = Number(b.count || 0);
        if (cb !== ca) return cb - ca;

        // 数量相同按ID升序
        return Number(a.id || 0) - Number(b.id || 0);
    });

    return { totalKinds: items.length, items };
}

module.exports = {
    getBag,
    sellItems,
    sellAllFruits,
    debugSellFruits,
    getBagItems,
    startSellLoop,
    stopSellLoop,
    checkAndUseGifts,
    startGiftUseLoop,
    stopGiftUseLoop,
    getBagDetail,
};
