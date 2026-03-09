/**
 * WebSocket 网络层 - 连接/消息编解码/登录/心跳
 * 改进版：添加自动重连和更好的连接管理
 */

const WebSocket = require('ws');
const EventEmitter = require('events');
const { CONFIG, DEVICE_INFO } = require('./config');
const { types } = require('./proto');
const { toLong, toNum, syncServerTime, log: utilsLog, logWarn: utilsLogWarn } = require('./utils');
const { updateStatusFromLogin, updateStatusGold, updateStatusLevel } = require('./status');
const cryptoWasm = require('../backend/utils/crypto-wasm'); // 🔐 引入 WASM 加密模块

// ============ 事件发射器 (用于推送通知) ============
const networkEvents = new EventEmitter();

// ============ 自定义日志函数（供收集器脚本注入） ============
let customLog = null;
let customLogWarn = null;

function log(tag, msg) {
    if (customLog) {
        customLog(tag, msg);
    } else {
        utilsLog(tag, msg);
    }
}

function logWarn(tag, msg) {
    if (customLogWarn) {
        customLogWarn(tag, msg);
    } else {
        utilsLogWarn(tag, msg);
    }
}

// 设置自定义日志函数
function setLogger(logger, loggerWarn) {
    customLog = logger;
    customLogWarn = loggerWarn;
}

// ============ Connection 类 (封装 WebSocket 连接) ============
class Connection extends EventEmitter {
    constructor() {
        super();
        this.ws = null;
        this.clientSeq = 1;
        this.serverSeq = 0;
        this.heartbeatTimer = null;
        this.pendingCallbacks = new Map();
        this.lastHeartbeatResponse = Date.now();
        this.heartbeatMissCount = 0;
        this.reconnectTimer = null;
        this.isReconnecting = false;
        this.shouldReconnect = true;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.loginCode = '';
        this.onLoginSuccess = null;
        this.permanentError = false;
        this.loginDeviceInfo = null;
        this.tlogSession = null;
        
        // 🔐 WASM 加密状态
        this.wasmInitialized = false;
        
        // 用户状态
        this.userState = {
            gid: 0,
            name: '',
            level: 0,
            gold: 0,
            exp: 0,
        };
    }

    // 获取用户状态
    getUserState() {
        return this.userState;
    }

    setLoginDeviceInfo(deviceInfo) {
        this.loginDeviceInfo = (deviceInfo && typeof deviceInfo === 'object') ? { ...deviceInfo } : null;
    }

    setTlogSession(session) {
        this.tlogSession = session || null;
    }

    getTlogSession() {
        return this.tlogSession;
    }

    pushTlogEvent(eventType, payload = {}) {
        if (!this.tlogSession || typeof this.tlogSession.pushEvent !== 'function') return;
        try {
            this.tlogSession.pushEvent(eventType, payload);
        } catch (_) {}
    }

    async sendTlogEvents(events = []) {
        if (!Array.isArray(events) || events.length === 0) {
            return { success_count: 0, fail_count: 0 };
        }

        const flowTypeMap = {
            LOADING_START: 1001,
            PRELOAD_COMPLETE: 1002,
            LOADING_END: 1003,
            GAME_LOGIN: 1004,
            FARM_CHECK: 2001,
            FRIEND_CHECK: 2002,
            TASK_CHECK: 2003,
            SELL_CHECK: 2004,
            MANUAL_SELL: 3001,
            MANUAL_HARVEST: 3002,
            MANUAL_PLANT: 3003,
            LAND_UNLOCK: 3004,
            LAND_UPGRADE: 3005,
        };

        const osVal = String(CONFIG.os || '').toLowerCase();
        let osType = 4;
        if (osVal.includes('ios')) osType = 2;
        if (osVal.includes('android')) osType = 1;

        const platformVal = String(CONFIG.platform || '').toLowerCase();
        let platType = 3;
        if (platformVal === 'qq') platType = 2;
        if (platformVal === 'wx') platType = 1;

        const state = this.getUserState() || {};
        const nowMs = Date.now();
        const flows = events.map((event) => {
            const eventType = event?.eventType || 'UNKNOWN';
            const payload = event?.payload || {};
            const flowType = flowTypeMap[eventType] || 0;
            return {
                os_type: osType,
                plat_from_type: platType,
                open_id: String(payload.openId || ''),
                gid: toLong(toNum(state.gid) || 0),
                name: String(state.name || ''),
                now: toLong(toNum(event?.ts) || nowMs),
                level: toLong(toNum(state.level) || 0),
                flow_type: toLong(flowType),
                flow_type_str: String(eventType),
                param_int1: toLong(toNum(payload.paramInt1) || 0),
                param_int2: toLong(toNum(payload.paramInt2) || 0),
                param_int3: toLong(toNum(payload.paramInt3) || 0),
                param_int4: toLong(toNum(payload.paramInt4) || 0),
                param_int5: toLong(toNum(payload.paramInt5) || 0),
                param_str6: String(payload.paramStr6 || ''),
                param_str7: String(payload.paramStr7 || ''),
                param_str8: String(payload.paramStr8 || ''),
                param_str9: String(payload.paramStr9 || ''),
                param_str10: String(payload.paramStr10 || ''),
            };
        });

        const body = types.BatchClientReportFlowRequest.encode(
            types.BatchClientReportFlowRequest.create({ flows })
        ).finish();

        const { body: replyBody } = await this.sendMsgAsync(
            'gamepb.userpb.UserService',
            'BatchClientReportFlow',
            body,
            5000
        );
        return types.BatchClientReportFlowReply.decode(replyBody);
    }

    // 检查连接状态
    isConnected() {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    // 连接 WebSocket
    async connect(code, onLoginSuccess) {
        // 如果是永久性错误，不再尝试连接
        if (this.permanentError) {
            return Promise.reject(new Error('永久性错误，停止连接'));
        }

        // 🔐 先初始化 WASM 加密模块
        try {
            await cryptoWasm.initWasm();
            this.wasmInitialized = true;
            log('加密', 'WASM 模块已初始化');
        } catch (err) {
            logWarn('加密', `WASM 初始化失败：${err.message}`);
            // 不阻止连接，降级使用旧版协议
        }
        
        return new Promise((resolve, reject) => {
            this.loginCode = code;
            this.onLoginSuccess = onLoginSuccess;
            this.shouldReconnect = true;
            
            const url = `${CONFIG.serverUrl}?platform=${CONFIG.platform}&os=${CONFIG.os}&ver=${CONFIG.clientVersion}&code=${code}&openID=`;
            let settled = false;

            log('WS', `正在连接...`);
            
            this.ws = new WebSocket(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 12; ALN-AL10 Build/HUAWEIALN-AL10; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/114.0.5735.196 Mobile Safari/537.36 QQ/9.2.66.33870 V1_AND_SQ_9.2.66_13188_YYB_D QQ/MiniApp',
                    'Referer': 'https://appservice.qq.com/1112386029/1.6.2.18/page-frame.html',
                },
            });

            this.ws.binaryType = 'arraybuffer';

            this.ws.on('open', () => {
                log('WS', '连接已打开');
                this.sendLogin()
                    .then(() => {
                        settled = true;
                        this.reconnectAttempts = 0;
                        resolve();
                    })
                    .catch((err) => {
                        settled = true;
                        reject(err);
                    });
            });

            this.ws.on('message', (data) => {
                this.handleMessage(Buffer.isBuffer(data) ? data : Buffer.from(data));
            });

            this.ws.on('close', (code, reason) => {
                log('WS', `连接关闭 (code=${code})`);
                this.cleanup();
                
                if (!settled) {
                    settled = true;
                    reject(new Error(`连接关闭 (code=${code})`));
                }
                
                // 触发断开连接事件
                networkEvents.emit('disconnected', code);
                this.emit('disconnected', code);
                
                // 尝试自动重连（除非是永久性错误）
                if (this.shouldReconnect && !this.isReconnecting && !this.permanentError) {
                    this.attemptReconnect();
                }
            });

            this.ws.on('error', (err) => {
                logWarn('WS', `错误: ${err.message}`);
                
                // 检查是否是永久性错误（如 400 Bad Request）
                if (err.message && err.message.includes('400')) {
                    this.permanentError = true;
                    this.shouldReconnect = false;
                    logWarn('WS', '收到 400 错误，停止重连。请检查登录码是否有效。');
                }
                
                if (!settled) {
                    settled = true;
                    reject(err);
                }
                this.emit('error', err);
            });
        });
    }

    // 发送登录请求
    sendLogin() {
        return new Promise((resolve, reject) => {
            const body = types.LoginRequest.encode(types.LoginRequest.create({
                sharer_id: toLong(0),
                sharer_open_id: '',
                device_info: this.loginDeviceInfo || DEVICE_INFO,
                share_cfg_id: toLong(0),
                scene_id: '1256',
                report_data: {
                    callback: '', cd_extend_info: '', click_id: '', clue_token: '',
                    minigame_channel: 'other', minigame_platid: 2, req_id: '', trackid: '',
                },
            })).finish();

            this.sendMsg('gamepb.userpb.UserService', 'Login', body, (err, bodyBytes, meta) => {
                if (err) {
                    log('登录', `失败: ${err.message}`);
                    reject(err);
                    return;
                }
                
                try {
                    const reply = types.LoginReply.decode(bodyBytes);
                    if (reply.basic) {
                        this.userState.gid = toNum(reply.basic.gid);
                        this.userState.name = reply.basic.name || '未知';
                        this.userState.level = toNum(reply.basic.level);
                        this.userState.gold = toNum(reply.basic.gold);
                        this.userState.exp = toNum(reply.basic.exp);

                        // 更新状态栏
                        updateStatusFromLogin({
                            name: this.userState.name,
                            level: this.userState.level,
                            gold: this.userState.gold,
                            exp: this.userState.exp,
                        });

                        log('登录', '========== 登录成功 ==========');
                        log('登录', `  GID:    ${this.userState.gid}`);
                        log('登录', `  昵称:   ${this.userState.name}`);
                        log('登录', `  等级:   ${this.userState.level}`);
                        log('登录', `  金币:   ${this.userState.gold}`);
                        if (reply.time_now_millis) {
                            syncServerTime(toNum(reply.time_now_millis));
                            log('登录', `  时间:   ${new Date(toNum(reply.time_now_millis)).toLocaleString()}`);
                        }
                        log('登录', '===============================');
                    }

                    this.startHeartbeat();

                    if (this.tlogSession && typeof this.tlogSession.sendStartupSequence === 'function') {
                        try {
                            this.tlogSession.sendStartupSequence();
                        } catch (_) {}
                    }
                    
                    // 触发登录成功事件
                    this.emit('login', this.userState);
                    networkEvents.emit('login', this.userState);
                    
                    // 执行登录成功回调
                    if (this.onLoginSuccess) {
                        this.onLoginSuccess();
                    }
                    
                    resolve();
                } catch (e) {
                    log('登录', `解码失败: ${e.message}`);
                    reject(e);
                }
            });
        });
    }

    // 自动重连
    async attemptReconnect() {
        if (this.isReconnecting || !this.shouldReconnect) {
            return;
        }

        this.isReconnecting = true;
        this.reconnectAttempts++;

        if (this.reconnectAttempts > this.maxReconnectAttempts) {
            log('重连', `已达到最大重连次数 (${this.maxReconnectAttempts})，停止重连`);
            this.isReconnecting = false;
            this.emit('reconnectFailed');
            networkEvents.emit('reconnectFailed');
            return;
        }

        log('重连', `第 ${this.reconnectAttempts}/${this.maxReconnectAttempts} 次尝试，${this.reconnectDelay / 1000}s 后重连...`);
        
        // 触发重连事件，通知外部模块暂停
        this.emit('reconnecting', this.reconnectAttempts);
        networkEvents.emit('reconnecting', this.reconnectAttempts);

        await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));

        if (!this.shouldReconnect) {
            this.isReconnecting = false;
            return;
        }

        try {
            await this.connect(this.loginCode, this.onLoginSuccess);
            log('重连', '重连成功！');
            this.reconnectAttempts = 0;
            this.isReconnecting = false;
            
            // 触发重连成功事件
            this.emit('reconnected');
            networkEvents.emit('reconnected');
        } catch (err) {
            logWarn('重连', `失败: ${err.message}`);
            this.isReconnecting = false;
            
            // 继续尝试重连（如果未达到最大次数）
            if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.attemptReconnect();
            } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                log('重连', `已达到最大重连次数 (${this.maxReconnectAttempts})，停止重连`);
                this.emit('reconnectFailed');
                networkEvents.emit('reconnectFailed');
            }
        }
    }

    // 编码消息（带加密）
    async encodeMsg(serviceName, methodName, bodyBytes) {
        let finalBody = bodyBytes || Buffer.alloc(0);
        
        // 🔐 对请求体进行加密（新版协议要求）
        if (finalBody.length > 0 && this.wasmInitialized) {
            try {
                finalBody = await cryptoWasm.encryptBuffer(finalBody);
            } catch (err) {
                logWarn('加密', `加密失败：${err.message}，使用原始数据`);
                // 加密失败时使用原始数据（兼容旧版）
            }
        }
        
        const msg = types.GateMessage.create({
            meta: {
                service_name: serviceName,
                method_name: methodName,
                message_type: 1,
                client_seq: toLong(this.clientSeq),
                server_seq: toLong(this.serverSeq),
            },
            body: finalBody,
        });
        const encoded = types.GateMessage.encode(msg).finish();
        this.clientSeq++;
        return encoded;
    }

    // 发送消息（支持加密）
    async sendMsg(serviceName, methodName, bodyBytes, callback) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            log('WS', '连接未打开');
            return false;
        }
        const seq = this.clientSeq;
        
        // 🔐 使用加密的 encodeMsg
        const encoded = await this.encodeMsg(serviceName, methodName, bodyBytes);
        
        if (callback) this.pendingCallbacks.set(seq, callback);
        this.ws.send(encoded);
        return true;
    }

    // Promise 版发送
    sendMsgAsync(serviceName, methodName, bodyBytes, timeout = 10000) {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                reject(new Error(`连接未打开: ${methodName}`));
                return;
            }
            
            const seq = this.clientSeq;
            const timer = setTimeout(() => {
                this.pendingCallbacks.delete(seq);
                const pending = this.pendingCallbacks.size;
                reject(new Error(`请求超时: ${methodName} (seq=${seq}, pending=${pending})`));
            }, timeout);

            // 🔐 使用异步的 sendMsg
            this.sendMsg(serviceName, methodName, bodyBytes, (err, body, meta) => {
                clearTimeout(timer);
                if (err) reject(err);
                else resolve({ body, meta });
            }).then(sent => {
                if (!sent) {
                    clearTimeout(timer);
                    reject(new Error(`发送失败: ${methodName}`));
                }
            }).catch(err => {
                clearTimeout(timer);
                reject(err);
            });
        });
    }

    // 处理消息
    handleMessage(data) {
        try {
            const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
            const msg = types.GateMessage.decode(buf);
            const meta = msg.meta;
            if (!meta) return;

            if (meta.server_seq) {
                const seq = toNum(meta.server_seq);
                if (seq > this.serverSeq) this.serverSeq = seq;
            }

            const msgType = meta.message_type;

            // Notify
            if (msgType === 3) {
                this.handleNotify(msg);
                return;
            }

            // Response
            if (msgType === 2) {
                const errorCode = toNum(meta.error_code);
                const clientSeqVal = toNum(meta.client_seq);

                const cb = this.pendingCallbacks.get(clientSeqVal);
                if (cb) {
                    this.pendingCallbacks.delete(clientSeqVal);
                    if (errorCode !== 0) {
                        cb(new Error(`${meta.service_name}.${meta.method_name} 错误: code=${errorCode} ${meta.error_message || ''}`));
                    } else {
                        cb(null, msg.body, meta);
                    }
                    return;
                }

                if (errorCode !== 0) {
                    logWarn('错误', `${meta.service_name}.${meta.method_name} code=${errorCode} ${meta.error_message || ''}`);
                }
            }
        } catch (err) {
            logWarn('解码', err.message);
        }
    }

    // 处理推送通知
    handleNotify(msg) {
        if (!msg.body || msg.body.length === 0) return;
        try {
            const event = types.EventMessage.decode(msg.body);
            const type = event.message_type || '';
            const eventBody = event.body;

            // 被踢下线
            if (type.includes('Kickout')) {
                log('推送', `被踢下线! ${type}`);
                try {
                    const notify = types.KickoutNotify.decode(eventBody);
                    log('推送', `原因: ${notify.reason_message || '未知'}`);
                } catch (e) { }
                // 被踢下线不再重连
                this.shouldReconnect = false;
                this.emit('kickout');
                networkEvents.emit('kickout');
                return;
            }

            // 土地状态变化
            if (type.includes('LandsNotify')) {
                try {
                    const notify = types.LandsNotify.decode(eventBody);
                    const hostGid = toNum(notify.host_gid);
                    const lands = notify.lands || [];
                    if (lands.length > 0) {
                        if (hostGid === this.userState.gid || hostGid === 0) {
                            this.emit('landsChanged', lands);
                            networkEvents.emit('landsChanged', lands);
                        }
                    }
                } catch (e) { }
                return;
            }

            // 物品变化通知
            if (type.includes('ItemNotify')) {
                try {
                    const notify = types.ItemNotify.decode(eventBody);
                    const items = notify.items || [];
                    for (const itemChg of items) {
                        const item = itemChg.item;
                        if (!item) continue;
                        const id = toNum(item.id);
                        const count = toNum(item.count);
                        
                        if (id === 1101 || id === 2) {
                            this.userState.exp = count;
                            updateStatusLevel(this.userState.level, count);
                        } else if (id === 1 || id === 1001) {
                            this.userState.gold = count;
                            updateStatusGold(count);
                        }
                    }
                } catch (e) { }
                return;
            }

            // 基本信息变化
            if (type.includes('BasicNotify')) {
                try {
                    const notify = types.BasicNotify.decode(eventBody);
                    if (notify.basic) {
                        const oldLevel = this.userState.level;
                        this.userState.level = toNum(notify.basic.level) || this.userState.level;
                        this.userState.gold = toNum(notify.basic.gold) || this.userState.gold;
                        const exp = toNum(notify.basic.exp);
                        if (exp > 0) {
                            this.userState.exp = exp;
                            updateStatusLevel(this.userState.level, exp);
                        }
                        updateStatusGold(this.userState.gold);
                        if (this.userState.level !== oldLevel) {
                            log('系统', `升级! Lv${oldLevel} → Lv${this.userState.level}`);
                        }
                    }
                } catch (e) { }
                return;
            }

            // 好友申请通知
            if (type.includes('FriendApplicationReceivedNotify')) {
                try {
                    const notify = types.FriendApplicationReceivedNotify.decode(eventBody);
                    const applications = notify.applications || [];
                    if (applications.length > 0) {
                        this.emit('friendApplicationReceived', applications);
                        networkEvents.emit('friendApplicationReceived', applications);
                    }
                } catch (e) { }
                return;
            }

            // 好友添加成功通知
            if (type.includes('FriendAddedNotify')) {
                try {
                    const notify = types.FriendAddedNotify.decode(eventBody);
                    const friends = notify.friends || [];
                    if (friends.length > 0) {
                        const names = friends.map(f => f.name || f.remark || `GID:${toNum(f.gid)}`).join(', ');
                        log('好友', `新好友: ${names}`);
                    }
                } catch (e) { }
                return;
            }

            // 商品解锁通知
            if (type.includes('GoodsUnlockNotify')) {
                try {
                    const notify = types.GoodsUnlockNotify.decode(eventBody);
                    const goods = notify.goods_list || [];
                    if (goods.length > 0) {
                        log('商店', `解锁 ${goods.length} 个新商品!`);
                    }
                } catch (e) { }
                return;
            }

            // 任务状态变化通知
            if (type.includes('TaskInfoNotify')) {
                try {
                    const notify = types.TaskInfoNotify.decode(eventBody);
                    if (notify.task_info) {
                        this.emit('taskInfoNotify', notify.task_info);
                        networkEvents.emit('taskInfoNotify', notify.task_info);
                    }
                } catch (e) { }
                return;
            }

            // QQ会员礼包状态变化通知
            if (type.includes('DailyGiftStatusChangedNTF')) {
                try {
                    const notify = types.DailyGiftStatusChangedNTF.decode(eventBody);
                    if (notify.can_claim && !notify.claimed_today) {
                        this.emit('dailyGiftStatusChanged', notify);
                        networkEvents.emit('dailyGiftStatusChanged', notify);
                    }
                } catch (e) { }
                return;
            }

            // 新邮件通知
            if (type.includes('NewEmailNotify')) {
                try {
                    const notify = types.NewEmailNotify.decode(eventBody);
                    const emails = notify.new_emails || [];
                    if (emails.length > 0) {
                        log('推送', `收到 ${emails.length} 封新邮件`);
                        this.emit('newEmailNotify', emails);
                        networkEvents.emit('newEmailNotify', emails);
                    }
                } catch (e) { }
                return;
            }

            // 图鉴奖励红点通知
            if (type.includes('IllustratedRewardRedDotNotifyV2')) {
                try {
                    const notify = types.IllustratedRewardRedDotNotifyV2.decode(eventBody);
                    if (notify.normal_reward_available || notify.premium_reward_available) {
                        this.emit('illustratedRewardRedDot', notify);
                        networkEvents.emit('illustratedRewardRedDot', notify);
                    }
                } catch (e) { }
                return;
            }
        } catch (e) {
            logWarn('推送', `解码失败: ${e.message}`);
        }
    }

    // 启动心跳
    startHeartbeat() {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.lastHeartbeatResponse = Date.now();
        this.heartbeatMissCount = 0;
        
        this.heartbeatTimer = setInterval(() => {
            if (!this.userState.gid) return;
            
            // 检查上次心跳响应时间，超过 60 秒没响应说明连接有问题
            const timeSinceLastResponse = Date.now() - this.lastHeartbeatResponse;
            if (timeSinceLastResponse > 60000) {
                this.heartbeatMissCount++;
                logWarn('心跳', `连接可能已断开 (${Math.round(timeSinceLastResponse/1000)}s 无响应, 错过=${this.heartbeatMissCount})`);
                
                if (this.heartbeatMissCount >= 2) {
                    log('心跳', '超时，关闭连接触发重连...');
                    // 清理待处理的回调
                    this.pendingCallbacks.forEach((cb) => {
                        try { cb(new Error('连接超时，已清理')); } catch (e) {}
                    });
                    this.pendingCallbacks.clear();
                    // 主动关闭连接，触发重连
                    if (this.ws) {
                        this.ws.close();
                    }
                    return;
                }
            }
            
            const body = types.HeartbeatRequest.encode(types.HeartbeatRequest.create({
                gid: toLong(this.userState.gid),
                client_version: CONFIG.clientVersion,
            })).finish();
            
            this.sendMsg('gamepb.userpb.UserService', 'Heartbeat', body, (err, replyBody) => {
                if (err || !replyBody) return;
                this.lastHeartbeatResponse = Date.now();
                this.heartbeatMissCount = 0;
                try {
                    const reply = types.HeartbeatReply.decode(replyBody);
                    if (reply.server_time) syncServerTime(toNum(reply.server_time));
                } catch (e) { }
            });
        }, CONFIG.heartbeatInterval);
    }

    // 清理资源
    cleanup() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        this.pendingCallbacks.clear();
        
        if (this.ws) {
            this.ws.removeAllListeners();
            try {
                this.ws.close();
            } catch (e) {}
            this.ws = null;
        }
    }

    // 关闭连接（不再重连）
    close() {
        this.shouldReconnect = false;
        this.cleanup();
        log('WS', '连接已手动关闭');
    }

    // 获取 WebSocket 实例（兼容旧代码）
    getWs() {
        return this.ws;
    }
}

// ============ 单例实例 ============
const connection = new Connection();

// ============ 兼容旧 API 的函数 ============
function connect(code, onLoginSuccess) {
    connection.connect(code, onLoginSuccess).catch(err => {
        logWarn('连接', `失败: ${err.message}`);
    });
}

function cleanup() {
    connection.cleanup();
}

function getWs() {
    return connection.getWs();
}

function sendMsg(serviceName, methodName, bodyBytes, callback) {
    return connection.sendMsg(serviceName, methodName, bodyBytes, callback);
}

function sendMsgAsync(serviceName, methodName, bodyBytes, timeout) {
    return connection.sendMsgAsync(serviceName, methodName, bodyBytes, timeout);
}

function getUserState() {
    return connection.getUserState();
}

function setLoginDeviceInfo(deviceInfo) {
    return connection.setLoginDeviceInfo(deviceInfo);
}

function setTlogSession(session) {
    return connection.setTlogSession(session);
}

function getTlogSession() {
    return connection.getTlogSession();
}

function pushTlogEvent(eventType, payload) {
    return connection.pushTlogEvent(eventType, payload);
}

function sendTlogEvents(events) {
    return connection.sendTlogEvents(events);
}

// ============ 导出 ============
module.exports = {
    // 新 API
    Connection,
    connection,
    networkEvents,
    setLogger,
    
    // 兼容旧 API
    connect,
    cleanup,
    getWs,
    sendMsg,
    sendMsgAsync,
    getUserState,
    setLoginDeviceInfo,
    setTlogSession,
    getTlogSession,
    pushTlogEvent,
    sendTlogEvents,
};
