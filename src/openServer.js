/**
 * 开服红包 - 自动领取开服红包
 */

const { types } = require('./proto');
const { sendMsgAsync } = require('./network');
const { toNum, log, logWarn } = require('./utils');
const { getItemName } = require('./gameConfig');

const DAILY_KEY = 'open_server_red_packet';
const CHECK_COOLDOWN_MS = 10 * 60 * 1000;

let doneDateKey = '';
let lastCheckAt = 0;
let lastClaimAt = 0;
let lastResult = '';
let lastHasRedPacket = null;
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

async function getTodayClaimStatus() {
    const body = types.GetTodayClaimStatusRequest.encode(types.GetTodayClaimStatusRequest.create({})).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.redpacketpb.RedPacketService', 'GetTodayClaimStatus', body);
    return types.GetTodayClaimStatusReply.decode(replyBody);
}

async function claimRedPacket(id) {
    const body = types.ClaimRedPacketRequest.encode(types.ClaimRedPacketRequest.create({
        id: Number(id) || 0,
    })).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.redpacketpb.RedPacketService', 'ClaimRedPacket', body);
    return types.ClaimRedPacketReply.decode(replyBody);
}

async function performDailyOpenServerRedPacket(force = false) {
    const now = Date.now();
    if (!force && isDoneToday()) return false;
    if (!force && now - lastCheckAt < CHECK_COOLDOWN_MS) return false;
    lastCheckAt = now;

    try {
        const rep = await getTodayClaimStatus();
        const infos = Array.isArray(rep && rep.infos) ? rep.infos : [];
        lastHasRedPacket = infos.length > 0;
        const claimable = infos.filter((x) => x && x.can_claim && Number(x.id || 0) > 0);
        lastHasClaimable = claimable.length > 0;

        if (!infos.length) {
            lastResult = 'none';
            log('开服', '当前没有开服红包活动');
            return false;
        }
        if (!claimable.length) {
            markDoneToday();
            lastResult = 'none';
            log('开服', '今日暂无可领取的开服红包');
            return false;
        }

        let claimed = 0;
        let alreadyClaimed = false;
        for (const info of claimable) {
            try {
                const ret = await claimRedPacket(Number(info.id || 0));
                const item = ret && ret.item;
                const itemName = item ? getItemName(toNum(item.id)) : '奖励';
                const itemCount = toNum(item && item.count);
                log('开服', `领取成功 → ${itemName}${itemCount > 0 ? 'x' + itemCount : ''}`);
                claimed += 1;
            } catch (e) {
                logWarn('开服', `领取失败(id=${Number(info.id || 0)}): ${e.message}`);
                // 如果错误提示已达上限，说明今天已经领取过了
                if (e.message && e.message.includes('已达上限')) {
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
        log('开服', '本次未成功领取开服红包');
        lastResult = 'none';
        return false;
    } catch (e) {
        lastResult = 'error';
        logWarn('开服', `查询开服红包失败: ${e.message}`);
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
        performDailyOpenServerRedPacket().catch(() => {});
    }, 10000);

    // 定时检查（每小时一次）
    checkTimer = setInterval(() => {
        performDailyOpenServerRedPacket().catch(() => {});
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
    performDailyOpenServerRedPacket,
    start,
    stop,
    isRunning,
    getOpenServerDailyState: () => ({
        key: DAILY_KEY,
        doneToday: isDoneToday(),
        lastCheckAt,
        lastClaimAt,
        result: lastResult,
        hasRedPacket: lastHasRedPacket,
        hasClaimable: lastHasClaimable,
    }),
};
