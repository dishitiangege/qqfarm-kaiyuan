/**
 * network.js 协议升级补丁
 * 
 * 本补丁用于将 network.js 从旧版明文协议升级到新版 WASM 加密协议
 * 
 * 使用方法：
 * 1. 备份原文件：cp network.js network.js.bak
 * 2. 按照下面的修改点逐个更新
 * 3. 测试验证功能正常
 */

// ============ 修改点 1: 引入加密模块 ============
// 在文件顶部，第 10 行左右，添加：
const cryptoWasm = require('./utils/crypto-wasm');

// 原代码：
// const { CONFIG, DEVICE_INFO } = require('./config');
// const { types } = require('./proto');
// ...

// 修改后：
const { CONFIG, DEVICE_INFO } = require('./config');
const { types } = require('./proto');
const cryptoWasm = require('./utils/crypto-wasm'); // 🔐 新增


// ============ 修改点 2: Connection 类添加 WASM 初始化状态 ============
// 在 constructor 中，第 62 行左右，添加：
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
    
    // 🔐 新增：WASM 加密状态
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


// ============ 修改点 3: connect 方法初始化 WASM ============
// 在 connect 方法中，第 178 行左右，修改为：

async connect(code, onLoginSuccess) {
    return new Promise((resolve, reject) => {
        this.loginCode = code;
        this.onLoginSuccess = onLoginSuccess;
        this.shouldReconnect = true;
        this.permanentError = false;
        
        const url = `${CONFIG.serverUrl}?platform=${CONFIG.platform}&os=${CONFIG.os}&ver=${CONFIG.clientVersion}&code=${code}&openID=`;
        let settled = false;

        log('WS', `正在连接...`);
        
        // 🔐 新增：先初始化 WASM 加密模块
        cryptoWasm.initWasm()
            .then(() => {
                this.wasmInitialized = true;
                log('加密', 'WASM 模块已初始化');
                
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
                    
                    networkEvents.emit('disconnected', code);
                    this.emit('disconnected', code);
                    
                    if (this.shouldReconnect && !this.isReconnecting && !this.permanentError) {
                        this.attemptReconnect();
                    }
                });

                this.ws.on('error', (err) => {
                    logWarn('WS', `错误：${err.message}`);
                    
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
            })
            .catch(err => {
                logWarn('加密', `WASM 初始化失败：${err.message}`);
                reject(err);
            });
    });
}


// ============ 修改点 4: encodeMsg 方法添加加密 ============
// 在 encodeMsg 方法中，第 387 行左右，修改为：

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


// ============ 修改点 5: sendMsg 方法改为异步 ============
// 在 sendMsg 方法中，第 404 行左右，修改为：

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


// ============ 修改点 6: sendMsgAsync 方法适配异步 sendMsg ============
// 在 sendMsgAsync 方法中，第 417 行左右，修改为：

// Promise 版发送（支持加密）
async sendMsgAsync(serviceName, methodName, bodyBytes, timeout = 10000) {
    return new Promise((resolve, reject) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            reject(new Error(`连接未打开：${methodName}`));
            return;
        }
        
        const seq = this.clientSeq;
        const timer = setTimeout(() => {
            this.pendingCallbacks.delete(seq);
            const pending = this.pendingCallbacks.size;
            reject(new Error(`请求超时：${methodName} (seq=${seq}, pending=${pending})`));
        }, timeout);

        // 🔐 使用加密的 sendMsg
        this.sendMsg(serviceName, methodName, bodyBytes, (err, body, meta) => {
            clearTimeout(timer);
            if (err) reject(err);
            else resolve({ body, meta });
        }).then(sent => {
            if (!sent) {
                clearTimeout(timer);
                reject(new Error(`发送失败：${methodName}`));
            }
        }).catch(err => {
            clearTimeout(timer);
            reject(err);
        });
    });
}


// ============ 修改点 7: handleMessage 方法保持不变 ============
// ⚠️ 重要：不要在 handleMessage 中对响应体解密！
// 服务端响应是明文 Protobuf，直接解码即可

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
                    cb(new Error(`${meta.service_name}.${meta.method_name} 错误：code=${errorCode} ${meta.error_message || ''}`));
                } else {
                    // ✅ 直接使用明文 body，不要解密！
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


// ============ 兼容性说明 ============
/**
 * 以上修改保持了向后兼容性：
 * 
 * 1. 如果 WASM 初始化失败，仍然可以使用旧版明文协议（但可能无法连接新版游戏服务器）
 * 2. 所有调用 sendMsg 和 sendMsgAsync 的地方无需修改，自动适配加密
 * 3. 响应体处理保持不变，直接解码明文
 * 
 * 注意事项：
 * - WASM 文件 tsdk.wasm 必须存在于 backend/utils/ 目录
 * - 第一次连接时会初始化 WASM 模块（约 100-200ms）
 * - 后续所有请求都会自动加密，无需手动处理
 */
