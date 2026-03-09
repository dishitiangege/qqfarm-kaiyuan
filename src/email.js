/**
 * 邮件系统 - 自动领取邮件奖励
 * 参考 new sample 实现，支持双邮箱类型和批量领取
 */

const { types } = require('./proto');
const { sendMsgAsync, networkEvents } = require('./network');
const { toNum, log, logWarn, sleep } = require('./utils');
const { getItemName } = require('./gameConfig');

const EMAIL_TYPE_SYSTEM = 1;
const EMAIL_TYPE_PLAYER = 2;

// 每日状态跟踪
let doneDateKey = '';
let lastCheckAt = 0;
const CHECK_COOLDOWN_MS = 5 * 60 * 1000; // 5分钟冷却

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

// ============ 邮件 API ============

async function getEmailList(boxType = 1) {
    const body = types.GetEmailListRequest.encode(types.GetEmailListRequest.create({
        email_type: Number(boxType) || 1,
    })).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.emailpb.EmailService', 'GetEmailList', body);
    return types.GetEmailListReply.decode(replyBody);
}

async function claimEmail(boxType = 1, emailId = '') {
    // 单封领取使用 ClaimEmailRequest
    const body = types.BatchClaimEmailRequest.encode(types.BatchClaimEmailRequest.create({
        email_type: Number(boxType) || 1,
        email_ids: [String(emailId)],
    })).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.emailpb.EmailService', 'BatchClaimEmail', body);
    return types.BatchClaimEmailReply.decode(replyBody);
}

async function batchClaimEmails(emailIds, boxType = 1) {
    const body = types.BatchClaimEmailRequest.encode(types.BatchClaimEmailRequest.create({
        email_type: Number(boxType) || 1,
        email_ids: emailIds.map(id => String(id)),
    })).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.emailpb.EmailService', 'BatchClaimEmail', body);
    return types.BatchClaimEmailReply.decode(replyBody);
}

// ============ 奖励摘要 ============

function getRewardSummary(items) {
    const summary = [];
    for (const item of items) {
        const id = toNum(item.id);
        const count = toNum(item.count);
        if (id === 1 || id === 1001) summary.push(`金币${count}`);
        else if (id === 2 || id === 1101) summary.push(`经验${count}`);
        else if (id === 1002) summary.push(`点券${count}`);
        else summary.push(`${getItemName(id)}(${id})x${count}`);
    }
    return summary.join('/');
}

function collectClaimableEmails(reply) {
    const emails = (reply && Array.isArray(reply.emails)) ? reply.emails : [];
    return emails.filter((x) => x && x.email_id && x.has_reward === true && x.is_read !== true);
}

function normalizeBoxType(v) {
    const n = Number(v);
    return (n === 1 || n === 2) ? n : 1;
}

// ============ 自动领取 ============

/**
 * 检查并领取所有可领取的邮件奖励
 * 参考 new sample 实现，支持双邮箱类型
 */
async function checkAndClaimEmails(force = false) {
    const now = Date.now();
    if (!force && isDoneToday()) {
        log('邮件', '今日已检查过邮箱奖励，跳过');
        return { claimed: 0, rewardItems: 0 };
    }
    if (!force && now - lastCheckAt < CHECK_COOLDOWN_MS) {
        log('邮件', '邮箱检查冷却中，跳过');
        return { claimed: 0, rewardItems: 0 };
    }
    lastCheckAt = now;

    try {
        log('邮件', '正在检查邮箱奖励...');
        // 同时获取两种邮箱类型的邮件
        const [box1, box2] = await Promise.all([
            getEmailList(1).catch(() => ({ emails: [] })),
            getEmailList(2).catch(() => ({ emails: [] })),
        ]);

        const box1Emails = box1.emails || [];
        const box2Emails = box2.emails || [];
        log('邮件', `系统邮箱: ${box1Emails.length} 封, 玩家邮箱: ${box2Emails.length} 封`);

        // 合并两个邮箱的邮件，优先保留"有奖励且未领取"的版本
        const merged = new Map();
        const fromBox1 = (box1.emails || []).map((x) => ({ ...x, __boxType: 1 }));
        const fromBox2 = (box2.emails || []).map((x) => ({ ...x, __boxType: 2 }));
        for (const x of [...fromBox1, ...fromBox2]) {
            if (!x || !x.email_id) continue;
            if (!merged.has(x.email_id)) {
                merged.set(x.email_id, x);
                continue;
            }
            const old = merged.get(x.email_id);
            const oldClaimable = !!(old && old.has_reward === true && old.is_read !== true);
            const nowClaimable = !!(x && x.has_reward === true && x.is_read !== true);
            if (!oldClaimable && nowClaimable) merged.set(x.email_id, x);
        }

        const claimable = collectClaimableEmails({ emails: [...merged.values()] });
        log('邮件', `发现 ${claimable.length} 封可领取奖励的邮件`);

        if (claimable.length === 0) {
            markDoneToday();
            log('邮件', '今日暂无可领取邮箱奖励');
            return { claimed: 0, rewardItems: 0 };
        }

        const rewards = [];
        let claimed = 0;

        // 先按邮箱类型尝试批量领取，失败则继续单领
        const byBox = new Map();
        for (const m of claimable) {
            const boxType = normalizeBoxType(m && m.__boxType);
            if (!byBox.has(boxType)) byBox.set(boxType, []);
            byBox.get(boxType).push(m);
        }

        for (const [boxType, list] of byBox.entries()) {
            try {
                const emailIds = list.map(m => String(m.email_id || '')).filter(id => id);
                if (emailIds.length > 0) {
                    const br = await batchClaimEmails(emailIds, boxType);
                    if (Array.isArray(br.rewards) && br.rewards.length > 0) {
                        rewards.push(...br.rewards);
                    }
                    claimed += list.length;
                }
            } catch {
                // 批量失败静默，继续单领
            }
        }

        // 单领剩余未成功的
        for (const m of claimable) {
            const boxType = normalizeBoxType(m && m.__boxType);
            try {
                const rep = await claimEmail(boxType, String(m.email_id || ''));
                if (Array.isArray(rep.rewards) && rep.rewards.length > 0) {
                    rewards.push(...rep.rewards);
                }
                claimed++;
            } catch {
                // 单封失败静默
            }
        }

        if (claimed > 0) {
            const rewardStr = getRewardSummary(rewards);
            if (rewardStr) {
                log('邮件', `领取成功 ${claimed} 封 → ${rewardStr}`);
            } else {
                log('邮件', `领取成功 ${claimed} 封`);
            }
            markDoneToday();
        }

        return { claimed, rewardItems: rewards.length };
    } catch (e) {
        logWarn('邮件', `领取邮箱奖励失败: ${e.message}`);
        return { claimed: 0, rewardItems: 0 };
    }
}

/**
 * 处理新邮件推送
 */
function onNewEmailNotify() {
    log('邮件', '收到新邮件推送，检查可领取奖励...');
    setTimeout(() => checkAndClaimEmails(true).catch(() => {}), 1000);
}

// ============ 启动/停止 ============

let initTimer = null;
let isStarted = false;

function start() {
    if (isStarted) return;
    isStarted = true;
    networkEvents.on('newEmailNotify', onNewEmailNotify);
    initTimer = setTimeout(() => {
        initTimer = null;
        checkAndClaimEmails().catch(() => {});
    }, 8000);
}

function stop() {
    if (!isStarted) return;
    isStarted = false;
    networkEvents.off('newEmailNotify', onNewEmailNotify);
    if (initTimer) {
        clearTimeout(initTimer);
        initTimer = null;
    }
}

function isRunning() {
    return isStarted;
}

function getEmailDailyState() {
    return {
        key: 'email_rewards',
        doneToday: isDoneToday(),
        lastCheckAt,
    };
}

module.exports = {
    checkAndClaimEmails,
    start,
    stop,
    isRunning,
    getEmailDailyState,
};
