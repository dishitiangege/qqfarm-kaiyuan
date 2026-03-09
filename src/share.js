/**
 * 分享奖励 - 自动完成每日分享任务
 * 参考 new sample 实现，使用专门的分享服务 API
 */

const { types } = require('./proto');
const { sendMsgAsync, networkEvents } = require('./network');
const { toNum, log, logWarn } = require('./utils');

const DAILY_KEY = 'daily_share';
const CHECK_COOLDOWN_MS = 10 * 60 * 1000; // 10分钟冷却

let doneDateKey = '';
let lastCheckAt = 0;
let lastClaimAt = 0;

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

function isAlreadyClaimedError(err) {
    const msg = String((err && err.message) || '');
    return msg.includes('code=1009001') || msg.includes('已经领取');
}

// ============ 分享服务 API ============

async function checkCanShare() {
    const body = types.CheckCanShareRequest.encode(types.CheckCanShareRequest.create({})).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.sharepb.ShareService', 'CheckCanShare', body);
    return types.CheckCanShareReply.decode(replyBody);
}

async function reportShare() {
    const body = types.ReportShareRequest.encode(types.ReportShareRequest.create({ shared: true })).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.sharepb.ShareService', 'ReportShare', body);
    return types.ReportShareReply.decode(replyBody);
}

async function claimShareReward() {
    const body = types.ClaimShareRewardRequest.encode(types.ClaimShareRewardRequest.create({ claimed: true })).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.sharepb.ShareService', 'ClaimShareReward', body);
    return types.ClaimShareRewardReply.decode(replyBody);
}

// ============ 每日分享任务 ============

async function performDailyShare(force = false) {
    const now = Date.now();
    if (!force && isDoneToday()) return false;
    if (!force && now - lastCheckAt < CHECK_COOLDOWN_MS) return false;

    lastCheckAt = now;
    log('分享', '正在检查分享礼包...');

    try {
        // 1. 检查是否可以分享
        const can = await checkCanShare();
        if (!can || !can.can_share) {
            markDoneToday();
            log('分享', '今日暂无可领取分享礼包');
            return false;
        }

        log('分享', '可以领取分享礼包，正在上报分享状态...');

        // 2. 上报分享状态
        const report = await reportShare();
        if (!report || !report.success) {
            log('分享', '上报分享状态失败');
            return false;
        }

        log('分享', '分享状态上报成功，正在领取奖励...');

        // 3. 领取分享奖励
        let rep = null;
        try {
            rep = await claimShareReward();
        } catch (e) {
            if (isAlreadyClaimedError(e)) {
                markDoneToday();
                log('分享', '今日分享奖励已领取');
                return false;
            }
            throw e;
        }

        if (!rep || !rep.success) {
            log('分享', '领取分享礼包失败');
            return false;
        }

        // 4. 领取成功
        const items = Array.isArray(rep.items) ? rep.items : [];
        const reward = getRewardSummary(items);
        log('分享', reward ? `领取成功 → ${reward}` : '领取成功');

        lastClaimAt = Date.now();
        markDoneToday();
        return true;

    } catch (e) {
        log('分享', `领取失败: ${e.message}`);
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

    log('分享', '分享任务模块已启动');

    // 首次检查（延迟10秒，等待登录完成）
    initTimer = setTimeout(() => {
        initTimer = null;
        log('分享', '开始首次检查分享任务...');
        performDailyShare().catch(() => {});
    }, 10000);

    // 定时检查（每小时一次）
    checkTimer = setInterval(() => {
        log('分享', '定时检查分享任务...');
        performDailyShare().catch(() => {});
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

function getShareDailyState() {
    return {
        key: DAILY_KEY,
        doneToday: isDoneToday(),
        lastCheckAt,
        lastClaimAt,
    };
}

module.exports = {
    performDailyShare,
    start,
    stop,
    isRunning,
    getShareDailyState,
};
