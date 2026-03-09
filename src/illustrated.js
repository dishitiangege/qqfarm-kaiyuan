/**
 * 图鉴系统 - 自动领取图鉴等级奖励
 * 参考 new sample 实现
 */

const { types } = require('./proto');
const { sendMsgAsync, networkEvents } = require('./network');
const { toNum, log, logWarn } = require('./utils');
const { getItemName } = require('./gameConfig');

// ============ 图鉴 API ============

async function getIllustratedLevelList(type = 1) {
    const body = types.GetIllustratedLevelListV2Request.encode(
        types.GetIllustratedLevelListV2Request.create({ type })
    ).finish();
    const { body: replyBody } = await sendMsgAsync(
        'gamepb.illustratedpb.IllustratedService',
        'GetIllustratedLevelListV2',
        body
    );
    return types.GetIllustratedLevelListV2Reply.decode(replyBody);
}

async function claimAllRewards(type = 1) {
    // 参考 new sample，使用 only_claimable: true 参数
    const body = types.ClaimAllRewardsV2Request.encode(
        types.ClaimAllRewardsV2Request.create({ type })
    ).finish();
    const { body: replyBody } = await sendMsgAsync(
        'gamepb.illustratedpb.IllustratedService',
        'ClaimAllRewardsV2',
        body
    );
    return types.ClaimAllRewardsV2Reply.decode(replyBody);
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

// ============ 自动领取 ============

/**
 * 检查并领取所有可领取的图鉴奖励
 * 参考 new sample 实现，支持 bonus_items
 */
async function checkAndClaimRewards() {
    try {
        const reply = await getIllustratedLevelList(1);
        const levelList = reply.level_list || [];

        const claimable = levelList.filter(l => l.can_claim && !l.claimed);
        if (claimable.length === 0) return;

        log('图鉴', `发现 ${claimable.length} 个可领取的图鉴等级奖励`);

        try {
            const claimReply = await claimAllRewards(1);
            // 合并 items 和 bonus_items（参考 new sample）
            const items = [
                ...(Array.isArray(claimReply && claimReply.total_rewards) ? claimReply.total_rewards : []),
                ...(Array.isArray(claimReply && claimReply.next_level_rewards) ? claimReply.next_level_rewards : []),
            ];
            if (items.length > 0) {
                const summary = getRewardSummary(items);
                log('图鉴', `领取奖励: ${summary}`);
            } else {
                log('图鉴', '领取完成');
            }
        } catch (e) {
            logWarn('图鉴', `领取图鉴奖励失败: ${e.message}`);
        }
    } catch (e) {
        logWarn('图鉴', `检查图鉴奖励失败: ${e.message}`);
    }
}

/**
 * 处理图鉴奖励红点推送
 */
function onRewardRedDot() {
    log('图鉴', '收到红点推送，检查可领取奖励...');
    setTimeout(() => checkAndClaimRewards().catch(() => {}), 500);
}

// ============ 启动/停止 ============

let initTimer = null;
let isStarted = false;
let lastClaimAt = 0;
let doneToday = false;

function start() {
    if (isStarted) return;
    isStarted = true;
    networkEvents.on('illustratedRewardRedDot', onRewardRedDot);
    initTimer = setTimeout(() => {
        initTimer = null;
        checkAndClaimRewards().then(() => {
            doneToday = true;
            lastClaimAt = Date.now();
        }).catch(() => {});
    }, 6000);
}

function stop() {
    if (!isStarted) return;
    isStarted = false;
    networkEvents.off('illustratedRewardRedDot', onRewardRedDot);
    if (initTimer) {
        clearTimeout(initTimer);
        initTimer = null;
    }
}

function isRunning() {
    return isStarted;
}

function getIllustratedDailyState() {
    return {
        key: 'illustrated_rewards',
        doneToday,
        lastClaimAt,
    };
}

module.exports = {
    checkAndClaimRewards,
    start,
    stop,
    isRunning,
    getIllustratedDailyState,
};
