/**
 * QQ会员系统 - 自动领取每日礼包
 */

const { types } = require('./proto');
const { sendMsgAsync, networkEvents } = require('./network');
const { toNum, log, logWarn } = require('./utils');
const { getItemName } = require('./gameConfig');

// ============ QQ会员 API ============

async function getDailyGiftStatus() {
    const body = types.GetDailyGiftStatusRequest.encode(types.GetDailyGiftStatusRequest.create({})).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.qqvippb.QQVipService', 'GetDailyGiftStatus', body);
    return types.GetDailyGiftStatusReply.decode(replyBody);
}

async function claimDailyGift() {
    const body = types.ClaimDailyGiftRequest.encode(types.ClaimDailyGiftRequest.create({})).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.qqvippb.QQVipService', 'ClaimDailyGift', body);
    return types.ClaimDailyGiftReply.decode(replyBody);
}

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

function isAlreadyClaimedError(err) {
    const msg = String((err && err.message) || '');
    return msg.includes('code=1021002') || msg.includes('今日已领取') || msg.includes('已领取');
}

// ============ 礼包领取 ============

/**
 * 检查并领取QQ会员每日礼包
 * @param {boolean} isRetry 是否是重试调用
 */
async function checkAndClaimQQVipGift(isRetry = false) {
    lastCheckAt = Date.now();
    try {
        if (isDoneToday()) {
            doneToday = true;
            return;
        }

        const reply = await getDailyGiftStatus();

        hasGift = reply.has_gift;
        canClaim = reply.can_claim;
        if (!reply.can_claim) {
            doneToday = true;
            markDoneToday();
            log('会员', '今日暂无可领取会员礼包');
            return;
        }

        log('会员', 'QQ会员每日礼包可领取，正在领取...');

        const claimReply = await claimDailyGift();
        const rewards = claimReply.items || [];

        lastClaimAt = Date.now();
        doneToday = true;
        markDoneToday();

        if (rewards.length > 0) {
            const summary = rewards.map(r => {
                const id = toNum(r.id);
                const count = toNum(r.count);
                if (id === 1 || id === 1001) return `金币${count}`;
                if (id === 2 || id === 1101) return `经验${count}`;
                return `${getItemName(id)}(${id})x${count}`;
            }).join('/');
            log('会员', `领取每日礼包: ${summary}`);
        } else {
            log('会员', '已领取每日礼包');
        }
    } catch (e) {
        const errorMsg = String(e.message || '');
        if (isAlreadyClaimedError(e)) {
            lastClaimAt = Date.now();
            doneToday = true;
            markDoneToday();
            log('会员', '今日会员礼包已领取');
            return;
        }
        logWarn('会员', `检查会员礼包失败: ${errorMsg}`);

        // 如果是网络繁忙错误且不是重试调用，则延迟后重试一次
        if (!isRetry && (errorMsg.includes('网络繁忙') || errorMsg.includes('code=1020002'))) {
            log('会员', '网络繁忙，5秒后重试...');
            setTimeout(() => {
                checkAndClaimQQVipGift(true).catch(() => {});
            }, 5000);
        }
    }
}

/**
 * 处理会员礼包状态变化推送
 */
function onGiftStatusChanged() {
    log('会员', '收到礼包状态推送，检查可领取...');
    setTimeout(() => checkAndClaimQQVipGift(), 500);
}

// ============ 启动/停止 ============

let checkTimer = null;
let initTimer = null;
let isStarted = false;
let lastClaimAt = 0;
let lastCheckAt = 0;
let doneToday = false;
let doneDateKey = '';
let hasGift = null;
let canClaim = null;

function start() {
    if (isStarted) return;
    isStarted = true;
    
    // 监听礼包状态变化推送
    networkEvents.on('dailyGiftStatusChanged', onGiftStatusChanged);
    
    // 首次检查（延迟5秒，等待登录完成）
    initTimer = setTimeout(() => {
        initTimer = null;
        checkAndClaimQQVipGift().catch(() => {});
    }, 5000);
    
    // 定时检查（每小时一次）
    checkTimer = setInterval(() => {
        checkAndClaimQQVipGift().catch(() => {});
    }, 60 * 60 * 1000);
}

function stop() {
    if (!isStarted) return;
    isStarted = false;
    
    networkEvents.off('dailyGiftStatusChanged', onGiftStatusChanged);
    
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

function getVipDailyState() {
    doneToday = isDoneToday();
    return {
        key: 'vip_daily_gift',
        doneToday,
        lastClaimAt,
        lastCheckAt,
        hasGift,
        canClaim,
    };
}

module.exports = {
    checkAndClaimQQVipGift,
    start,
    stop,
    isRunning,
    getVipDailyState,
};
