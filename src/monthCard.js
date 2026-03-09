/**
 * 月卡礼包 - 自动领取月卡每日奖励
 */

const { types } = require('./proto');
const { sendMsgAsync } = require('./network');
const { toNum, log, logWarn } = require('./utils');

const DAILY_KEY = 'month_card_gift';
const CHECK_COOLDOWN_MS = 10 * 60 * 1000;

let doneDateKey = '';
let lastCheckAt = 0;
let lastClaimAt = 0;
let lastResult = '';
let lastHasCard = null;
let lastHasClaimable = null;

function getDateKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function markDoneToday() {
    doneDateKey = getDateKey();
}

function isDoneToday() {
    return doneDateKey === getDateKey();
}

function getRewardSummary(items) {
    const list = Array.isArray(items) ? items : [];
    const summary = [];
    for (const it of list) {
        const id = toNum(it.id);
        const count = toNum(it.count);
        if (count <= 0) continue;
        if (id === 1 || id === 1001) summary.push(`金币${count}`);
        else if (id === 2 || id === 1101) summary.push(`经验${count}`);
        else if (id === 1002) summary.push(`点券${count}`);
        else summary.push(`物品#${id}x${count}`);
    }
    return summary.join('/');
}

async function getMonthCardInfos() {
    const body = types.GetMonthCardInfosRequest.encode(types.GetMonthCardInfosRequest.create({})).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.mallpb.MallService', 'GetMonthCardInfos', body);
    return types.GetMonthCardInfosReply.decode(replyBody);
}

async function claimMonthCardReward(goodsId) {
    const body = types.ClaimMonthCardRewardRequest.encode(types.ClaimMonthCardRewardRequest.create({
        goods_id: Number(goodsId) || 0,
    })).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.mallpb.MallService', 'ClaimMonthCardReward', body);
    return types.ClaimMonthCardRewardReply.decode(replyBody);
}

async function performDailyMonthCardGift(force = false) {
    const now = Date.now();
    if (!force && isDoneToday()) return false;
    if (!force && now - lastCheckAt < CHECK_COOLDOWN_MS) return false;
    lastCheckAt = now;

    try {
        const rep = await getMonthCardInfos();
        const infos = Array.isArray(rep && rep.infos) ? rep.infos : [];
        lastHasCard = infos.length > 0;
        const claimable = infos.filter((x) => x && x.can_claim && Number(x.goods_id || 0) > 0);
        lastHasClaimable = claimable.length > 0;
        if (!infos.length) {
            markDoneToday();
            lastResult = 'none';
            log('月卡', '当前没有月卡或已过期');
            return false;
        }
        if (!claimable.length) {
            markDoneToday();
            lastResult = 'none';
            log('月卡', '今日暂无可领取月卡礼包');
            return false;
        }
        let claimed = 0;
        let alreadyClaimed = false;
        for (const info of claimable) {
            try {
                const ret = await claimMonthCardReward(Number(info.goods_id || 0));
                const items = Array.isArray(ret && ret.items) ? ret.items : [];
                const reward = getRewardSummary(items);
                log('月卡', reward ? `领取成功 → ${reward}` : '领取成功');
                claimed += 1;
            } catch (e) {
                logWarn('月卡', `领取失败(gid=${Number(info.goods_id || 0)}): ${e.message}`);
                // 如果错误提示已领取或已过期，标记为完成
                if (e.message && (e.message.includes('已领取') || e.message.includes('已过期') || e.message.includes('次数已达上限'))) {
                    alreadyClaimed = true;
                }
            }
        }
        if (claimed > 0 || alreadyClaimed) {
            if (claimed > 0) {
                lastClaimAt = Date.now();
                lastResult = 'ok';
            } else {
                lastResult = 'already_claimed';
            }
            markDoneToday();
            return true;
        }
        log('月卡', '本次未成功领取月卡礼包');
        lastResult = 'none';
        return false;
    } catch (e) {
        lastResult = 'error';
        logWarn('月卡', `查询月卡礼包失败: ${e.message}`);
        return false;
    }
}

// ============ 启动/停止 ============

let checkTimer = null;
let initTimer = null;
let isStarted = false;

function start() {
    if (isStarted) return;
    isStarted = true;

    // 首次检查（延迟10秒，等待登录完成）
    initTimer = setTimeout(() => {
        initTimer = null;
        performDailyMonthCardGift().catch(() => {});
    }, 10000);

    // 定时检查（每小时一次）
    checkTimer = setInterval(() => {
        performDailyMonthCardGift().catch(() => {});
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
    performDailyMonthCardGift,
    start,
    stop,
    isRunning,
    getMonthCardDailyState: () => ({
        key: DAILY_KEY,
        doneToday: isDoneToday(),
        lastCheckAt,
        lastClaimAt,
        result: lastResult,
        hasCard: lastHasCard,
        hasClaimable: lastHasClaimable,
    }),
};
