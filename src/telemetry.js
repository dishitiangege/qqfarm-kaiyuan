/**
 * 遥测数据上报模块
 * 每20-40分钟随机间隔发送一次GET请求到腾讯遥测服务
 */

const https = require('https');
const { log, logWarn } = require('./utils');
const { CONFIG, DEVICE_INFO } = require('./config');

// ============ 状态 ============
let telemetryTimer = null;
let currentGid = null;
const MIN_INTERVAL = 20 * 60 * 1000; // 20分钟
const MAX_INTERVAL = 40 * 60 * 1000; // 40分钟

/**
 * 生成随机时间间隔（20-40分钟）
 * @returns {number} 毫秒数
 */
function getRandomInterval() {
    return Math.floor(Math.random() * (MAX_INTERVAL - MIN_INTERVAL + 1)) + MIN_INTERVAL;
}

/**
 * 根据设备信息生成User-Agent
 * @returns {string} User-Agent字符串
 */
function generateUserAgent() {
    const sysSoftware = DEVICE_INFO.sys_software || 'Android 14';
    const deviceId = DEVICE_INFO.device_id || 'ALN-AL00';
    const platform = CONFIG.platform || 'qq';
    
    // 解析系统信息
    const isIOS = sysSoftware.toLowerCase().includes('ios');
    const isAndroid = sysSoftware.toLowerCase().includes('android');
    const isHarmonyOS = sysSoftware.toLowerCase().includes('harmony');
    
    let osPart = '';
    let buildPart = '';
    
    if (isIOS) {
        // iOS User-Agent
        const iosVersion = sysSoftware.replace(/iOS\s*/i, '') || '18.2.1';
        osPart = `iPhone; CPU iPhone OS ${iosVersion.replace(/\./g, '_')} like Mac OS X`;
        buildPart = '';
    } else if (isAndroid || isHarmonyOS) {
        // Android/HarmonyOS User-Agent
        const androidVersion = sysSoftware.match(/Android\s+(\d+(?:\.\d+)?)/i);
        const versionNum = androidVersion ? androidVersion[1] : '14';
        const osName = isHarmonyOS ? 'HarmonyOS' : 'Android';
        osPart = `Linux; Android ${versionNum}; ${deviceId}`;
        buildPart = isHarmonyOS ? `Build/${deviceId.replace(/-/g, '')}` : `Build/${deviceId}`;
    } else {
        // 默认Android
        osPart = `Linux; Android 14; ${deviceId}`;
        buildPart = `Build/${deviceId}`;
    }
    
    // 基础User-Agent结构（类似QQ小程序）
    let ua = `Mozilla/5.0 (${osPart}`;
    if (buildPart) {
        ua += `; ${buildPart}`;
    }
    ua += `; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/114.0.5735.196 Mobile Safari/537.36`;
    
    // 添加QQ小程序标识
    if (platform === 'qq') {
        ua += ' QQ/9.2.66.33870 V1_AND_SQ_9.2.66_13188_YYB_D QQ/MiniApp';
    } else if (platform === 'wx') {
        ua += ' MicroMessenger/8.0.48(0x18003030) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN';
    }
    
    return encodeURIComponent(ua);
}

/**
 * 发送遥测GET请求
 * @param {string|number} gid - 用户GID
 */
function sendTelemetryRequest(gid) {
    if (!gid) {
        logWarn('遥测', 'GID为空，跳过请求');
        return;
    }

    const uid = String(gid);
    const url = `https://galileotelemetry.tencent.com/aegiscontrol/whitelist?uid=${uid}&topic=SDK-700333253ff048b7b4a2`;
    
    // 生成请求头
    const userAgent = generateUserAgent();
    const clientVersion = CONFIG.clientVersion || '1.6.2.17';
    const referer = `https://appservice.qq.com/1112386029/${clientVersion}/page-frame.html`;
    
    const options = {
        headers: {
            'Referer': referer,
            'User-Agent': decodeURIComponent(userAgent),
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept-Encoding': 'gzip',
        },
    };

    return new Promise((resolve) => {
        const req = https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    log('遥测', `上报成功: uid=${uid}, code=${result.code}`);
                } catch (e) {
                    log('遥测', `上报成功: uid=${uid}`);
                }
                resolve(true);
            });
        });

        req.on('error', (err) => {
            logWarn('遥测', `请求失败: ${err.message}`);
            resolve(false);
        });

        req.setTimeout(10000, () => {
            req.destroy();
            logWarn('遥测', '请求超时');
            resolve(false);
        });
    });
}

/**
 * 调度下一次发送
 */
function scheduleNext() {
    const interval = getRandomInterval();
    const minutes = Math.round(interval / 60000);
    
    telemetryTimer = setTimeout(() => {
        sendTelemetryRequest(currentGid).then(() => {
            // 继续调度下一次
            if (currentGid) {
                scheduleNext();
            }
        });
    }, interval);
    
    log('遥测', `下次上报将在 ${minutes} 分钟后`);
}

/**
 * 启动遥测定时任务
 * @param {string|number} gid - 用户GID
 */
function startTelemetry(gid) {
    if (telemetryTimer) {
        clearTimeout(telemetryTimer);
        telemetryTimer = null;
    }

    currentGid = gid;

    if (!gid) {
        logWarn('遥测', 'GID为空，无法启动遥测');
        return;
    }

    // 立即发送一次
    sendTelemetryRequest(gid).then(() => {
        // 调度下一次
        scheduleNext();
    });

    log('遥测', `已启动定时上报 (GID: ${gid}, 随机间隔: 20-40分钟)`);
}

/**
 * 停止遥测定时任务
 */
function stopTelemetry() {
    if (telemetryTimer) {
        clearTimeout(telemetryTimer);
        telemetryTimer = null;
        log('遥测', '已停止定时上报');
    }
    currentGid = null;
}

/**
 * 更新GID（用于重连后更新）
 * @param {string|number} gid - 新的GID
 */
function updateTelemetryGid(gid) {
    if (gid && gid !== currentGid) {
        currentGid = gid;
        log('遥测', `GID已更新: ${gid}`);
    }
}

module.exports = {
    startTelemetry,
    stopTelemetry,
    updateTelemetryGid,
    sendTelemetryRequest,
};
