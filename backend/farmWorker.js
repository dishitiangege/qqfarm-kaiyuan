/**
 * Farm Worker 线程
 * 在 Worker 线程中运行账号农场逻辑
 */

const { parentPort, workerData } = require('worker_threads');
const path = require('path');

// 清除 require 缓存，确保加载最新的代码
const projectRoot = path.join(__dirname, '..');
const srcPath = path.join(projectRoot, 'src');
Object.keys(require.cache).forEach(key => {
  if (key.includes(srcPath) || key.includes('farmOperations.js') || key.includes('farmWorker.js')) {
    delete require.cache[key];
  }
});

const FarmOperations = require('./farmOperations');
const systemSettingsService = require('./systemSettingsService');
const {
  setGlobalAntiDetectionEnabled,
  getAntiDetectionConfig,
  isAntiDetectionEnabled,
  createHumanDispatcher,
  buildDeviceInfo,
  initTlogSession
} = require('./core/antiDetection');

// 从 workerData 获取账号信息
const { accountId, accountData } = workerData;

// 导入 utils.js 并设置自定义日志
const { setLogger: setUtilsLogger } = require(path.join(projectRoot, 'src/utils'));

// 状态
let isRunning = false;
let shouldStop = false;
let farmOps = null;
let config = { ...accountData.config };
let antiConfig = null;
let dispatcher = null;
let tlogSession = null;



// 可中断的 sleep 机制
let intervalUpdateCallbacks = [];
let currentIntervalMs = (accountData.friendInterval || 10) * 1000;
let farmIntervalMs = (accountData.farmInterval || 10) * 1000;

// 当间隔配置更新时的回调
function onIntervalUpdate(callback) {
  intervalUpdateCallbacks.push(callback);
}

function notifyIntervalUpdate(type, newValueMs) {
  intervalUpdateCallbacks.forEach(cb => {
    try {
      cb(type, newValueMs);
    } catch (e) {}
  });
}

// 可中断的 sleep 函数
function interruptibleSleep(ms, type = 'friend', allowIntervalShorten = true) {
  return new Promise((resolve) => {
    let resolved = false;
    let remaining = ms;
    const startTime = Date.now();
    
    // 设置超时
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(false); // 正常完成，没有被中断
      }
    }, ms);
    
    // 监听配置更新
    const checkInterval = setInterval(() => {
      if (resolved) {
        clearInterval(checkInterval);
        return;
      }

      if (!allowIntervalShorten) {
        return;
      }

      // 检查是否应该提前结束（配置变小）
      const elapsed = Date.now() - startTime;
      const targetInterval = type === 'friend' ? currentIntervalMs : farmIntervalMs;

      // 如果目标间隔变小，且已经等待了足够的时间，提前结束
      if (targetInterval < ms && elapsed >= targetInterval) {
        clearTimeout(timeout);
        clearInterval(checkInterval);
        if (!resolved) {
          resolved = true;
          resolve(true); // 被中断
        }
      }
    }, 100); // 每100ms检查一次
    
    // 清理函数
    const cleanup = () => {
      clearTimeout(timeout);
      clearInterval(checkInterval);
    };
    
    // 注册配置更新回调
    const updateHandler = (updateType, newValueMs) => {
      if (resolved) return;
      if (updateType !== type) return;
      
      if (!allowIntervalShorten) return;

      const elapsed = Date.now() - startTime;
      const remainingNeeded = newValueMs - elapsed;
      
      // 如果新的间隔比当前已等待时间还小，立即结束
      if (remainingNeeded <= 0) {
        cleanup();
        if (!resolved) {
          resolved = true;
          resolve(true); // 被中断
        }
      }
      // 否则继续等待，但会检查下一次循环
    };
    
    onIntervalUpdate(updateHandler);
  });
}

// 日志发送函数
function sendLog(message) {
  parentPort.postMessage({
    type: 'log',
    accountId,
    message,
    timestamp: Date.now()
  });
}

// 数据发送函数
function sendData(data) {
  parentPort.postMessage({
    type: 'data',
    accountId,
    data,
    timestamp: Date.now()
  });
}

// 状态发送函数
function sendStatus(status, info = {}) {
  parentPort.postMessage({
    type: 'status',
    accountId,
    status,
    info,
    timestamp: Date.now()
  });
}

// 错误发送函数
function sendError(error) {
  parentPort.postMessage({
    type: 'error',
    accountId,
    error: error.message || error,
    stack: error.stack,
    timestamp: Date.now()
  });
}

function stopAntiDetectionRuntime() {
  if (tlogSession && typeof tlogSession.stop === 'function') {
    try {
      tlogSession.stop();
    } catch (e) {}
  }
  tlogSession = null;

  if (dispatcher && typeof dispatcher.stop === 'function') {
    try {
      dispatcher.stop();
    } catch (e) {}
  }
  dispatcher = null;

  if (farmOps?.network?.setTlogSession) {
    farmOps.network.setTlogSession(null);
  }
}

function setupAntiDetectionRuntime() {
  if (!farmOps) return;

  antiConfig = getAntiDetectionConfig(config);
  const enabled = isAntiDetectionEnabled(config);

  stopAntiDetectionRuntime();

  if (!enabled) {
    if (farmOps.network?.setLoginDeviceInfo) {
      farmOps.network.setLoginDeviceInfo(null);
    }
    sendLog('[反检测] 已关闭，保持旧行为');
    return;
  }

  dispatcher = createHumanDispatcher(accountId, antiConfig, { logger: sendLog });
  const deviceInfo = buildDeviceInfo(accountId, antiConfig);
  if (farmOps.network?.setLoginDeviceInfo) {
    farmOps.network.setLoginDeviceInfo(deviceInfo);
  }

  tlogSession = initTlogSession(accountId, antiConfig, async (events) => {
    if (typeof farmOps.network.sendTlogEvents === 'function') {
      await farmOps.network.sendTlogEvents(events);
    }
  });
  if (farmOps.network?.setTlogSession) {
    farmOps.network.setTlogSession(tlogSession);
  }

  sendLog(`[反检测] 已启用，强度=${antiConfig.humanMode.intensity}, tlog=${antiConfig.protocol.enableTlog}`);
}

// 收集并发送账号数据
async function collectAndSendData() {
  if (!farmOps) return;
  
  try {
    const state = farmOps.network.getUserState();
    const landsReply = await farmOps.getAllLands();
    const nowSec = farmOps.getServerTimeSec();
    
    let landStatus = [];
    // 构建土地映射表用于合种判断
    const landsMap = farmOps.buildLandMap(landsReply?.lands || []);

    if (landsReply && landsReply.lands) {
      landStatus = landsReply.lands.map(land => {
        const landId = farmOps.toNum(land.id);

        // 判断合种相关属性
        const isOccupiedSlave = farmOps.isOccupiedSlaveLand(land, landsMap);
        const displayContext = farmOps.getDisplayLandContext(land, landsMap);
        const isMasterLand = displayContext.masterLandId === landId && !isOccupiedSlave;

        if (!land.unlocked) {
          return { 
            status: '锁定', 
            phase: -1, 
            phaseName: '锁定',
            totalProgress: 0,
            nextPhaseTime: 0,
            matureTime: 0,
            landLevel: farmOps.toNum(land.level),
            landMaxLevel: farmOps.toNum(land.maxLevel),
            couldUpgrade: land.couldUpgrade || false,
            stealable: false,
            plantSize: 1,
            isMasterLand: false,
            isSlaveLand: false
          };
        }

        // 如果是被占用的副地块，显示主地块的信息
        if (isOccupiedSlave) {
          const masterLand = displayContext.sourceLand;
          const masterPlant = masterLand?.plant;
          const masterPlantId = farmOps.toNum(masterPlant?.id);
          const masterPlantInfo = farmOps.plantConfig[masterPlantId];
          const masterPlantName = masterPlantInfo?.name || masterPlant?.name || '未知';
          const plantSize = farmOps.getPlantSize(masterPlantId);

          return {
            status: `${masterPlantName} (合种副地块)`,
            phase: -2, // 特殊标记表示副地块
            phaseName: '合种中',
            plantName: masterPlantName,
            progress: 0,
            totalProgress: 0,
            nextPhaseTime: 0,
            matureTime: 0,
            landLevel: farmOps.toNum(land.level),
            landMaxLevel: farmOps.toNum(land.maxLevel),
            couldUpgrade: false,
            stealable: false,
            plantSize: plantSize,
            isMasterLand: false,
            isSlaveLand: true
          };
        }
        
        const plant = land.plant;
        if (!plant || !plant.phases || plant.phases.length === 0) {
          return { 
            status: '空闲', 
            phase: 0, 
            phaseName: '空闲',
            totalProgress: 0,
            nextPhaseTime: 0,
            matureTime: 0,
            landLevel: farmOps.toNum(land.level),
            landMaxLevel: farmOps.toNum(land.maxLevel),
            couldUpgrade: land.couldUpgrade || false,
            stealable: false,
            plantSize: 1,
            isMasterLand: false,
            isSlaveLand: false
          };
        }

        // 获取作物尺寸
        const plantId = farmOps.toNum(plant.id);
        const plantSize = farmOps.getPlantSize(plantId);

        const currentPhase = farmOps.getCurrentPhase(plant.phases);
        const plantInfo = farmOps.plantConfig[farmOps.toNum(plant.id)];
        const plantName = plantInfo?.name || plant.name || '未知';
        
        let phaseName = '生长中';
        let progress = 0;
        let totalProgress = 0;
        let nextPhaseTime = 0;
        let matureTime = 0;
        
        // 获取当前阶段信息
        const currentPhaseInfo = plant.phases.find(p => farmOps.toNum(p.phase) === currentPhase);
        // 获取成熟阶段信息
        const maturePhaseInfo = plant.phases.find(p => farmOps.toNum(p.phase) === farmOps.PlantPhase.MATURE);
        
        if (currentPhase === farmOps.PlantPhase.MATURE) {
          phaseName = '成熟';
          progress = 100;
          totalProgress = 100;
        } else if (currentPhase === farmOps.PlantPhase.DEAD) {
          phaseName = '枯死';
        } else if (currentPhase === farmOps.PlantPhase.SEED) {
          phaseName = '种子';
          // 种子状态也需要计算整体进度（刚种下时）
          if (maturePhaseInfo && maturePhaseInfo.begin_time) {
            const matureBeginTime = farmOps.toTimeSec(maturePhaseInfo.begin_time);
            matureTime = matureBeginTime;
            
            // 找到种子阶段
            let seedPhaseInfo = plant.phases.find(p => farmOps.toNum(p.phase) === farmOps.PlantPhase.SEED);
            if (!seedPhaseInfo && plant.phases.length > 0) {
              seedPhaseInfo = plant.phases[0];
            }
            if (seedPhaseInfo && seedPhaseInfo.begin_time) {
              const seedBeginTime = farmOps.toTimeSec(seedPhaseInfo.begin_time);
              const totalGrowTime = matureBeginTime - seedBeginTime;
              const elapsedTotal = nowSec - seedBeginTime;
              
              if (totalGrowTime > 0) {
                totalProgress = Math.min(99, Math.floor((elapsedTotal / totalGrowTime) * 100));
              }
            }
            
            // 计算到下一阶段的剩余时间
            const nextPhase = currentPhase + 1;
            const nextPhaseInfo = plant.phases.find(p => farmOps.toNum(p.phase) === nextPhase);
            if (nextPhaseInfo && nextPhaseInfo.begin_time) {
              const nextBeginTime = farmOps.toTimeSec(nextPhaseInfo.begin_time);
              nextPhaseTime = Math.max(0, nextBeginTime - nowSec);
            }
          }
        } else {
          phaseName = farmOps.PHASE_NAMES[currentPhase] || '生长中';
          
          // 计算到下一阶段的剩余时间（所有生长阶段都需要）
          const nextPhase = currentPhase + 1;
          const nextPhaseInfo = plant.phases.find(p => farmOps.toNum(p.phase) === nextPhase);
          if (nextPhaseInfo && nextPhaseInfo.begin_time) {
            const nextBeginTime = farmOps.toTimeSec(nextPhaseInfo.begin_time);
            nextPhaseTime = Math.max(0, nextBeginTime - nowSec);
          }
          
          if (currentPhaseInfo && currentPhaseInfo.begin_time) {
            const beginTime = farmOps.toTimeSec(currentPhaseInfo.begin_time);
            
            // 计算当前阶段进度百分比
            if (nextPhaseInfo && nextPhaseInfo.begin_time) {
              const nextBeginTime = farmOps.toTimeSec(nextPhaseInfo.begin_time);
              const phaseDuration = nextBeginTime - beginTime;
              const elapsed = nowSec - beginTime;
              progress = Math.min(99, Math.floor((elapsed / phaseDuration) * 100));
            }
          }
          
          // 计算到成熟的整体进度（所有生长阶段都需要）
          if (maturePhaseInfo && maturePhaseInfo.begin_time) {
            const matureBeginTime = farmOps.toTimeSec(maturePhaseInfo.begin_time);
            matureTime = matureBeginTime;
            
            // 找到种子阶段（phase === 1），如果找不到就使用第一个阶段
            let seedPhaseInfo = plant.phases.find(p => farmOps.toNum(p.phase) === farmOps.PlantPhase.SEED);
            if (!seedPhaseInfo && plant.phases.length > 0) {
              seedPhaseInfo = plant.phases[0];
            }
            if (seedPhaseInfo && seedPhaseInfo.begin_time) {
              const seedBeginTime = farmOps.toTimeSec(seedPhaseInfo.begin_time);
              const totalGrowTime = matureBeginTime - seedBeginTime;
              const elapsedTotal = nowSec - seedBeginTime;
              
              if (totalGrowTime > 0) {
                totalProgress = Math.min(99, Math.floor((elapsedTotal / totalGrowTime) * 100));
              }
            }
          }
        }
        
        return {
          status: `${plantName} ${phaseName}`,
          phase: currentPhase || 0,
          phaseName,
          plantName,
          progress,
          totalProgress,
          nextPhaseTime,
          matureTime,
          landLevel: farmOps.toNum(land.level),
          landMaxLevel: farmOps.toNum(land.maxLevel),
          couldUpgrade: land.couldUpgrade || false,
          stealable: currentPhase === farmOps.PlantPhase.MATURE,
          plantSize: plantSize,
          isMasterLand: isMasterLand,
          isSlaveLand: false
        };
      });

      while (landStatus.length < 24) {
        landStatus.push({
          status: '锁定',
          phase: -1,
          phaseName: '锁定',
          totalProgress: 0,
          nextPhaseTime: 0,
          matureTime: 0,
          landLevel: 0,
          landMaxLevel: 0,
          couldUpgrade: false,
          stealable: false,
          plantSize: 1,
          isMasterLand: false,
          isSlaveLand: false
        });
      }
    }

    // 获取背包数据
    let bagItems = [];
    try {
      const bagReply = await farmOps.getBag();
      if (bagReply) {
        const items = bagReply.item_bag?.items || bagReply.items || [];
        bagItems = items.map(item => ({
          id: farmOps.toNum(item.id),
          count: farmOps.toNum(item.count),
          uid: item.uid != null ? farmOps.toNum(item.uid) : 0
        }));
      }
    } catch (e) {
      sendLog(`[数据收集] 获取背包失败: ${e.message}`);
    }

    // 获取任务数据
    let taskData = { total: 0, claimable: 0, list: [] };
    try {
      if (farmOps.taskList && Array.isArray(farmOps.taskList)) {
        const claimableCount = farmOps.taskList.filter(t => t.progress >= t.total && !t.isClaimed).length;
        taskData = {
          total: farmOps.taskList.length,
          claimable: claimableCount,
          list: farmOps.taskList.map(t => ({
            id: t.id,
            desc: t.desc,
            progress: t.progress,
            total: t.total,
            isClaimed: t.isClaimed,
            isUnlocked: t.isUnlocked,
            rewards: t.rewards || []
          }))
        };
      }
    } catch (e) {
      sendLog(`[数据收集] 获取任务数据失败: ${e.message}`);
    }

    // 获取本次登录统计（内存）
    const sessionStats = farmOps.getSessionStats();

    // 获取今日累计统计（数据库）
    const todayStats = await farmOps.getTodayStats();

    const data = {
      name: state.name,
      level: state.level,
      stats: {
        exp: state.exp,
        coins: state.gold,
        landStatus,
        bag: bagItems,
        tasks: taskData,
        // 本次登录数据（本次会话累计）
        sessionStats,
        // 今日累计数据（全天累计，包含本次登录）
        todayStats
      }
    };

    sendData(data);
  } catch (error) {
    sendLog(`[数据收集] 错误: ${error.message}`);
  }
}

// 主逻辑
async function main() {
  try {
    sendStatus('starting');
    sendLog('[Worker] 启动中...');

    // 创建农场操作实例，传入 accountId 用于统计
    farmOps = new FarmOperations(projectRoot, sendLog, accountId, (event) => {
      parentPort.postMessage({
        ...event,
        accountId,
        timestamp: Date.now()
      });
    });
    
    // 设置自定义日志到 network.js
    farmOps.network.setLogger(
      (tag, msg) => sendLog(`[${tag}] ${msg}`),
      (tag, msg) => sendLog(`[${tag}] ⚠ ${msg}`)
    );
    
    // 设置自定义日志到 utils.js (供 qqvip.js, email.js 等模块使用)
    setUtilsLogger(
      (tag, msg) => sendLog(`[${tag}] ${msg}`),
      (tag, msg) => sendLog(`[${tag}] ⚠ ${msg}`)
    );

    // 加载 proto
    sendLog('[Worker] 加载 proto...');
    await farmOps.proto.loadProto();

    // 设置平台 - 从 config.js 获取 CONFIG
    const { CONFIG, updateConfig, applyDeviceTemplate, updateDeviceInfo } = require(path.join(projectRoot, 'src/config'));
    CONFIG.platform = accountData.platform;

    // 应用设备模板（如果有）- 先应用模板，模板会设置 os
    if (config.deviceTemplate) {
      const templateApplied = applyDeviceTemplate(config.deviceTemplate);
      if (templateApplied) {
        sendLog(`[Worker] 应用设备模板: ${config.deviceTemplate}`);
      }
    }

    // 应用用户自定义的 clientVersion 和 os 配置（仅在未选择设备模板时应用 os）
    const userConfig = {};
    if (config.clientVersion && config.clientVersion.trim()) {
      userConfig.clientVersion = config.clientVersion.trim();
      sendLog(`[Worker] 使用自定义客户端版本: ${userConfig.clientVersion}`);
    }
    // 只有在没有设备模板时才应用用户自定义的 os
    if (config.os && !config.deviceTemplate) {
      userConfig.os = config.os;
      sendLog(`[Worker] 使用自定义操作系统: ${userConfig.os}`);
    }
    if (Object.keys(userConfig).length > 0) {
      updateConfig(userConfig);
    }
    // 应用自定义设备信息（如果有）
    const deviceInfo = {};
    if (config.sysSoftware && config.sysSoftware.trim()) {
      deviceInfo.sys_software = config.sysSoftware.trim();
    }
    if (config.network) {
      deviceInfo.network = config.network;
    }
    if (config.memory && config.memory.trim()) {
      deviceInfo.memory = config.memory.trim();
    }
    if (config.deviceId && config.deviceId.trim()) {
      deviceInfo.device_id = config.deviceId.trim();
    }
    if (Object.keys(deviceInfo).length > 0) {
      updateDeviceInfo(deviceInfo);
      sendLog(`[Worker] 应用自定义设备信息`);
    }

    // 读取系统级反检测硬开关（复用 system_settings，不新增数据库字段）
    try {
      const globalEnabled = await systemSettingsService.getSetting('anti_detection_global_enabled');
      // 仅当显式配置为 false 时全局禁用，其余情况默认开启
      setGlobalAntiDetectionEnabled(globalEnabled !== 'false');
    } catch (e) {
      setGlobalAntiDetectionEnabled(true);
    }

    setupAntiDetectionRuntime();

    // 连接状态
    let isConnected = false;
    let reconnectTimer = null;

    // 启动连接
    sendLog('[Worker] 连接服务器...');
    
    farmOps.network.connect(accountData.code, async () => {
      isConnected = true;
      isRunning = true;
      sendStatus('running');
      sendLog('[Worker] 登录成功，开始运行');

      // 启动各个循环
      startFarmLoop();
      startFriendLoop();
      startTaskLoop();
      startSellLoop();
      startDataCollection();

      // 启动奖励自动领取
      if (config.autoClaimEmail !== false) {
        farmOps.email.start();
      }
      if (config.autoClaimIllustrated !== false) {
        farmOps.illustrated.start();
      }
      if (config.autoClaimFreeGifts !== false) {
        farmOps.shop.start();
      }
      if (config.autoClaimVip !== false) {
        farmOps.qqvip.start();
      }
      if (config.autoShare !== false) {
        farmOps.share.start();
      }
      if (config.autoClaimMonthCard !== false) {
        farmOps.monthCard.start();
      }
      if (config.autoClaimOpenServer !== false) {
        farmOps.openServer.start();
      }
    });

    // 监听断开连接 - 等待重连结果
    farmOps.network.networkEvents.once('disconnected', async (code) => {
      isConnected = false;
      sendStatus('disconnected');
      sendLog(`[Worker] 连接断开 (code=${code})，等待重连...`);

      // 通知反检测调度器连接已断开
      if (dispatcher) {
        dispatcher.setConnected(false);
      }

      // 暂停循环，但不停止（等待重连结果）
      let reconnecting = true;
      let reconnectAttempt = 0;

      // 监听重连进度
      const onReconnecting = (attempt) => {
        reconnectAttempt = attempt;
        sendLog(`[Worker] 正在重连... (${attempt}/5)`);
      };

      // 监听重连成功
      const onReconnected = () => {
        reconnecting = false;
        isConnected = true;
        sendLog('[Worker] 重连成功，恢复运行');
        sendStatus('running');
        // 通知反检测调度器连接已恢复
        if (dispatcher) {
          dispatcher.setConnected(true);
        }
      };

      // 监听重连失败
      const onReconnectFailed = () => {
        reconnecting = false;
        sendLog('[Worker] 重连失败，停止运行');
        // 通知反检测调度器连接已断开
        if (dispatcher) {
          dispatcher.setConnected(false);
        }
      };

      farmOps.network.networkEvents.on('reconnecting', onReconnecting);
      farmOps.network.networkEvents.once('reconnected', onReconnected);
      farmOps.network.networkEvents.once('reconnectFailed', onReconnectFailed);

      // 等待重连结果（最多等待 5次 * 3秒 + 缓冲 = 20秒）
      let waitTime = 0;
      const maxWaitTime = 20000; // 20秒

      while (reconnecting && waitTime < maxWaitTime) {
        await sleep(1000);
        waitTime += 1000;
      }

      // 清理事件监听
      farmOps.network.networkEvents.off('reconnecting', onReconnecting);
      farmOps.network.networkEvents.off('reconnected', onReconnected);
      farmOps.network.networkEvents.off('reconnectFailed', onReconnectFailed);

      // 如果重连成功，不需要做任何事，循环会继续
      // 如果重连失败或超时，停止 Worker
      if (!isConnected) {
        sendLog('[Worker] 重连超时或失败，正在停止...');

        // 停止所有循环
        isRunning = false;
        shouldStop = true;

        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }

        // 停止所有定时任务
        if (farmOps) {
          try {
            farmOps.email.stop();
            farmOps.illustrated.stop();
            farmOps.shop.stop();
            farmOps.qqvip.stop();
            farmOps.share.stop();
            farmOps.monthCard.stop();
            farmOps.openServer.stop();
            stopAntiDetectionRuntime();
            farmOps.network.cleanup();
            farmOps.stop();
            sendLog('[Worker] 所有任务已停止');
          } catch (e) {
            sendLog(`[Worker] 停止任务时出错: ${e.message}`);
          }
        }

        // 通知父进程 Worker 已停止
        sendStatus('stopped');
        parentPort.postMessage({
          type: 'workerStopped',
          accountId,
          reason: 'reconnectFailed',
          timestamp: Date.now()
        });
      }
    });

    // 监听父进程消息
    parentPort.on('message', async (msg) => {
      if (msg.type === 'stop') {
        shouldStop = true;
        isRunning = false;

        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }

        if (farmOps) {
          // 强制刷盘，保存统计数据
          sendLog('[Worker] 正在保存统计数据...');
          await farmOps.dailyStatsService.forceFlush();

          farmOps.email.stop();
          farmOps.illustrated.stop();
          farmOps.shop.stop();
          farmOps.qqvip.stop();
          farmOps.share.stop();
          farmOps.monthCard.stop();
          farmOps.openServer.stop();
          stopAntiDetectionRuntime();
          farmOps.network.cleanup();
          farmOps.stop();
        }

        sendStatus('stopped');
        sendLog('[Worker] 已停止');

        process.exit(0);
      }
      
      if (msg.type === 'configUpdate') {
        Object.assign(config, msg.config);
        setupAntiDetectionRuntime();
        // 更新巡查间隔
        if (msg.farmInterval !== undefined) {
          const oldInterval = accountData.farmInterval || 10;
          accountData.farmInterval = msg.farmInterval;
          farmIntervalMs = msg.farmInterval * 1000;
          notifyIntervalUpdate('farm', farmIntervalMs);
          sendLog(`[Worker] 农场巡查间隔已更新: ${oldInterval}秒 → ${msg.farmInterval}秒`);
        }
        if (msg.friendInterval !== undefined) {
          const oldInterval = accountData.friendInterval || 10;
          accountData.friendInterval = msg.friendInterval;
          currentIntervalMs = msg.friendInterval * 1000;
          notifyIntervalUpdate('friend', currentIntervalMs);
          sendLog(`[Worker] 好友巡查间隔已更新: ${oldInterval}秒 → ${msg.friendInterval}秒`);
        }
        sendLog('[Worker] 配置已更新');
      }

      if (msg.type === 'antiDetectionSettingsUpdate') {
        if (typeof msg.globalEnabled === 'boolean') {
          setGlobalAntiDetectionEnabled(msg.globalEnabled);
        }

        if (msg.applyDefaultToMissing === true && msg.defaultConfig && typeof msg.defaultConfig === 'object') {
          if (!config.antiDetection || typeof config.antiDetection !== 'object') {
            config.antiDetection = JSON.parse(JSON.stringify(msg.defaultConfig));
          }
        }

        setupAntiDetectionRuntime();
        sendLog(`[Worker] 反检测系统设置已热更新（全局开关: ${msg.globalEnabled !== false ? '开' : '关'}）`);
      }
      
      if (msg.type === 'getStatus') {
        const sessionStats = farmOps?.getSessionStats();
        sendStatus(isRunning ? 'running' : 'stopped', {
          sessionStats,
          isConnected
        });
      }
      
      // 手动售卖果实
      if (msg.type === 'sellItems') {
        (async () => {
          try {
            sendLog('[仓库] 收到手动售卖请求');
            await farmOps.sellAllFruits(msg.itemIds, msg.uids);
            tlogSession?.pushEvent('MANUAL_SELL', { source: 'api' });
            // 立即触发数据收集以更新前端背包显示
            await collectAndSendData();
            parentPort.postMessage({
              type: 'sellResult',
              accountId,
              success: true,
              timestamp: Date.now()
            });
          } catch (error) {
            sendLog(`[仓库] 手动售卖失败: ${error.message}`);
            parentPort.postMessage({
              type: 'sellResult',
              accountId,
              success: false,
              error: error.message,
              timestamp: Date.now()
            });
          }
        })();
      }
      
      // 手动收获土地
      if (msg.type === 'harvestLands') {
        console.log(`[Worker ${accountId}] 收到 harvestLands 消息，土地: ${msg.landIds?.join(',')}`);
        (async () => {
          try {
            sendLog(`[农场] 收到手动收获请求，土地: ${msg.landIds?.join(',')}`);
            tlogSession?.pushEvent('MANUAL_HARVEST', { source: 'api', count: msg.landIds?.length || 0 });
            console.log(`[Worker ${accountId}] 开始调用 farmOps.harvest`);
            const reply = await farmOps.harvest(msg.landIds);
            console.log(`[Worker ${accountId}] farmOps.harvest 返回:`, reply);
            sendLog('[农场] 手动收获成功');
            
            // 自动铲除枯死作物
            try {
              const landsReply = await farmOps.getAllLands();
              if (landsReply && landsReply.lands) {
                const deadLandIds = [];
                for (const land of landsReply.lands) {
                  const plant = land.plant;
                  if (plant && plant.phases) {
                    const currentPhase = farmOps.getCurrentPhase(plant.phases);
                    if (currentPhase === farmOps.PlantPhase.DEAD) {
                      deadLandIds.push(farmOps.toNum(land.id));
                    }
                  }
                }
                if (deadLandIds.length > 0) {
                  await farmOps.removePlant(deadLandIds);
                  sendLog(`[农场] 铲除 ${deadLandIds.length} 块枯死作物`);
                }
              }
            } catch (clearErr) {
              sendLog(`[农场] 铲除枯死作物出错: ${clearErr.message}`);
            }
            
            // 立即触发数据收集以更新前端显示
            await collectAndSendData();
            console.log(`[Worker ${accountId}] 发送 harvestResult 成功消息`);
            parentPort.postMessage({
              type: 'harvestResult',
              accountId,
              success: true,
              landCount: msg.landIds?.length || 0,
              timestamp: Date.now()
            });
          } catch (error) {
            console.log(`[Worker ${accountId}] 手动收获失败: ${error.message}`);
            sendLog(`[农场] 手动收获失败: ${error.message}`);
            console.log(`[Worker ${accountId}] 发送 harvestResult 失败消息`);
            parentPort.postMessage({
              type: 'harvestResult',
              accountId,
              success: false,
              error: error.message,
              timestamp: Date.now()
            });
          }
        })();
      }
      
      // 手动种植土地
      if (msg.type === 'plantLands') {
        (async () => {
          try {
            console.log(`[Worker ${accountId}] plantLands 消息内容:`, JSON.stringify(msg));
            sendLog(`[农场] 收到手动种植请求，土地: ${msg.landIds?.join(',')}, 种子: ${msg.seedId}`);
            tlogSession?.pushEvent('MANUAL_PLANT', { source: 'api', count: msg.landIds?.length || 0 });
            
            let landIds = [...msg.landIds]; // 复制数组，因为可能需要修改
            const seedId = msg.seedId;
            
            // 获取种子名称
            const seedName = farmOps.getPlantNameBySeedId(seedId);
            sendLog(`[农场] 手动种植 ${landIds.length} 块土地，种子: ${seedName}`);
            
            // 1. 购买种子
            sendLog('[商店] 开始购买种子...');
            const shopReply = await farmOps.getShopInfo(2);
            let goodsId = null;
            let price = 0;
            
            if (shopReply && shopReply.goods_list) {
              for (const goods of shopReply.goods_list) {
                if (farmOps.toNum(goods.item_id) === seedId) {
                  goodsId = farmOps.toNum(goods.id);
                  price = farmOps.toNum(goods.price);
                  break;
                }
              }
            }
            
            if (!goodsId) {
              throw new Error('商店中未找到该种子');
            }
            
            // 检查金币是否足够
            const state = farmOps.network.getUserState();
            const totalCost = price * landIds.length;
            if (totalCost > state.gold) {
              const canBuy = Math.floor(state.gold / price);
              if (canBuy <= 0) {
                throw new Error('金币不足，需要' + totalCost + '金币，当前有' + state.gold + '金币');
              }
              landIds = landIds.slice(0, canBuy);
              sendLog(`[商店] 金币有限，只能购买 ${canBuy} 个种子`);
            }
            
            // 购买种子
            let actualSeedId = seedId;
            try {
              const buyReply = await farmOps.buyGoods(goodsId, landIds.length, price);
              if (buyReply.get_items && buyReply.get_items.length > 0) {
                actualSeedId = farmOps.toNum(buyReply.get_items[0].id) || actualSeedId;
              }
              if (buyReply.cost_items) {
                for (const item of buyReply.cost_items) {
                  state.gold -= farmOps.toNum(item.count);
                }
              }
              sendLog(`[商店] 购买 ${seedName}种子 x${landIds.length}`);
            } catch (e) {
              throw new Error('购买种子失败: ' + e.message);
            }
            
            // 2. 种植
            console.log(`[Worker ${accountId}] 开始种植，土地数量: ${landIds.length}`);
            const planted = await farmOps.plantSeeds(actualSeedId, landIds);
            console.log(`[Worker ${accountId}] 种植完成，成功: ${planted} 块`);
            sendLog(`[农场] 手动种植成功: ${planted} 块土地，作物: ${seedName}`);
            
            // 种植后等待一下再施肥，避免服务器繁忙
            if (planted > 0) {
              await farmOps.sleep(300);
            }
            
            // 手动种植后触发自动施肥（根据配置）
            if (config.autoFertilize !== false && planted > 0) {
              sendLog('[施肥] 开始自动施肥...');
              let normalCount = 0;
              let organicCount = 0;
              
              if (config.useOrganicFertilizer !== false) {
                if (config.useBothFertilizers === true) {
                  // 同时使用两种肥料：每块地先施普通肥，再施有机肥
                  for (let i = 0; i < planted; i++) {
                    const landId = landIds[i];
                    // 先施普通肥
                    try {
                      const normalResult = await farmOps.fertilize([landId], 1011, config);
                      if (normalResult > 0) {
                        normalCount++;
                      } else {
                        sendLog(`[施肥] 普通肥失败 (土地${landId})`);
                      }
                    } catch (e) {
                      sendLog(`[施肥] 普通肥错误: ${e.message}`);
                    }
                    // 再施有机肥
                    try {
                      const organicResult = await farmOps.fertilize([landId], 1012, config);
                      if (organicResult > 0) {
                        organicCount++;
                      } else {
                        sendLog(`[施肥] 有机肥失败 (土地${landId})`);
                      }
                    } catch (e) {
                      sendLog(`[施肥] 有机肥错误: ${e.message}`);
                    }
                  }
                  // 详细记录两种肥料的使用情况
                  if (normalCount > 0 || organicCount > 0) {
                    sendLog(`[施肥] 普通肥${normalCount} 有机肥${organicCount}`);
                  }
                } else {
                  // 优先使用有机肥，不足时用普通肥
                  organicCount = await farmOps.fertilize(landIds.slice(0, planted), 1012, config);
                  if (organicCount < planted) {
                    normalCount = await farmOps.fertilize(landIds.slice(organicCount, planted), 1011, config);
                  }
                  if (normalCount > 0 || organicCount > 0) {
                    sendLog(`[施肥] 普通肥${normalCount} 有机肥${organicCount}`);
                  }
                }
              } else {
                // 只使用普通肥
                normalCount = await farmOps.fertilize(landIds.slice(0, planted), 1011, config);
                if (normalCount > 0) {
                  sendLog(`[施肥] 普通肥${normalCount}`);
                }
              }
            }
            
            // 立即触发数据收集以更新前端显示
            await collectAndSendData();
            parentPort.postMessage({
              type: 'plantResult',
              accountId,
              success: true,
              landCount: planted,
              seedName: seedName,
              timestamp: Date.now()
            });
          } catch (error) {
            sendLog(`[农场] 手动种植失败: ${error.message}`);
            parentPort.postMessage({
              type: 'plantResult',
              accountId,
              success: false,
              error: error.message,
              timestamp: Date.now()
            });
          }
        })();
      }
      
      // 解锁土地
      if (msg.type === 'unlockLand') {
        (async () => {
          try {
            sendLog(`[土地] 收到解锁请求，土地: ${msg.landId}`);
            tlogSession?.pushEvent('LAND_UNLOCK', { source: 'api', landId: msg.landId });
            const reply = await farmOps.unlockLand(msg.landId);
            sendLog(`[土地] 解锁成功: 土地#${msg.landId}`);
            // 立即触发数据收集以更新前端显示
            await collectAndSendData();
            parentPort.postMessage({
              type: 'unlockLandResult',
              accountId,
              success: true,
              landId: msg.landId,
              timestamp: Date.now()
            });
          } catch (error) {
            sendLog(`[土地] 解锁失败: ${error.message}`);
            parentPort.postMessage({
              type: 'unlockLandResult',
              accountId,
              success: false,
              error: error.message,
              timestamp: Date.now()
            });
          }
        })();
      }
      
      // 升级土地
      if (msg.type === 'upgradeLand') {
        (async () => {
          try {
            sendLog(`[土地] 收到升级请求，土地: ${msg.landId}`);
            tlogSession?.pushEvent('LAND_UPGRADE', { source: 'api', landId: msg.landId });
            const reply = await farmOps.upgradeLand(msg.landId);
            sendLog(`[土地] 升级成功: 土地#${msg.landId}`);
            // 立即触发数据收集以更新前端显示
            await collectAndSendData();
            parentPort.postMessage({
              type: 'upgradeLandResult',
              accountId,
              success: true,
              landId: msg.landId,
              timestamp: Date.now()
            });
          } catch (error) {
            sendLog(`[土地] 升级失败: ${error.message}`);
            parentPort.postMessage({
              type: 'upgradeLandResult',
              accountId,
              success: false,
              error: error.message,
              timestamp: Date.now()
            });
          }
        })();
      }
      
      // 自动解锁土地
      if (msg.type === 'autoUnlockLands') {
        (async () => {
          try {
            sendLog('[土地] 收到自动解锁请求');
            const result = await farmOps.autoUnlockLands();
            sendLog(`[土地] 自动解锁完成: ${result.unlockedCount || 0} 块土地`);
            // 立即触发数据收集以更新前端显示
            await collectAndSendData();
            parentPort.postMessage({
              type: 'autoUnlockLandsResult',
              accountId,
              success: true,
              unlockedCount: result.unlockedCount || 0,
              message: result.message || '自动解锁完成',
              timestamp: Date.now()
            });
          } catch (error) {
            sendLog(`[土地] 自动解锁失败: ${error.message}`);
            parentPort.postMessage({
              type: 'autoUnlockLandsResult',
              accountId,
              success: false,
              error: error.message,
              timestamp: Date.now()
            });
          }
        })();
      }
      
      // 自动升级土地
      if (msg.type === 'autoUpgradeLands') {
        (async () => {
          try {
            sendLog('[土地] 收到自动升级请求');
            const result = await farmOps.autoUpgradeLands();
            sendLog(`[土地] 自动升级完成: ${result.upgradedCount || 0} 块土地`);
            // 立即触发数据收集以更新前端显示
            await collectAndSendData();
            parentPort.postMessage({
              type: 'autoUpgradeLandsResult',
              accountId,
              success: true,
              upgradedCount: result.upgradedCount || 0,
              message: result.message || '自动升级完成',
              timestamp: Date.now()
            });
          } catch (error) {
            sendLog(`[土地] 自动升级失败: ${error.message}`);
            parentPort.postMessage({
              type: 'autoUpgradeLandsResult',
              accountId,
              success: false,
              error: error.message,
              timestamp: Date.now()
            });
          }
        })();
      }

      // 获取每日礼包状态
      if (msg.type === 'getDailyGifts') {
        (async () => {
          try {
            const dailyGifts = await getDailyGiftOverview();
            parentPort.postMessage({
              type: 'dailyGiftsResult',
              accountId,
              success: true,
              data: dailyGifts,
              timestamp: Date.now()
            });
          } catch (error) {
            sendLog(`[每日礼包] 获取状态失败: ${error.message}`);
            parentPort.postMessage({
              type: 'dailyGiftsResult',
              accountId,
              success: false,
              error: error.message,
              timestamp: Date.now()
            });
          }
        })();
      }
    });

  } catch (error) {
    stopAntiDetectionRuntime();
    sendError(error);
    sendStatus('error', { error: error.message });
    process.exit(1);
  }
}

// 农场巡查循环
async function startFarmLoop() {
  while (isRunning && !shouldStop) {
    try {
      if (config.autoFarm !== false && farmOps) {
        const runFarmCheck = async () => {
          await farmOps.checkFarm(config);
          await collectAndSendData();
          tlogSession?.pushEvent('FARM_CHECK', { source: 'loop' });
        };

        if (dispatcher) {
          await dispatcher.enqueue('farm', runFarmCheck, { label: 'farm-check' });
        } else {
          await runFarmCheck();
        }
      } else if (dispatcher) {
        await sleep(1000);
      }

      if (!dispatcher) {
        // 动态读取最新的间隔值，使用可中断的 sleep
        const interval = (accountData.farmInterval || 10) * 1000;
        const wasInterrupted = await interruptibleSleep(interval, 'farm');
        if (wasInterrupted) {
          sendLog(`[农场] 间隔已调整，提前执行下一次巡查`);
        }
      }
    } catch (error) {
      sendLog(`[FarmLoop] 错误: ${error.message}`);
      await sleep(5000);
    }
  }
}

// 好友巡查循环
async function startFriendLoop() {
  await sleep(5000);

  sendLog(`[好友] 巡查循环已启动，间隔: ${accountData.friendInterval || 10}秒, enableFriendCheck: ${config.enableFriendCheck}, useFixedFriendList: ${config.useFixedFriendList}`);

  while (isRunning && !shouldStop) {
    try {
      // 判断是否执行好友巡查：开启好友巡查 或 使用固定好友列表
      const shouldRunFriendCheck = (config.enableFriendCheck !== false || config.useFixedFriendList === true) && farmOps;

      if (shouldRunFriendCheck) {
        const runFriendCheck = async () => {
          if (config.useFixedFriendList === true) {
            sendLog('[好友] 开始固定列表巡查...');
          } else {
            sendLog('[好友] 开始巡查...');
          }
          await farmOps.checkFriends(config);
          sendLog('[好友] 巡查完成');
          tlogSession?.pushEvent('FRIEND_CHECK', { source: 'loop' });
        };

        if (dispatcher) {
          await dispatcher.enqueue('friend', runFriendCheck, { label: 'friend-check' });
        } else {
          await runFriendCheck();
        }
      } else {
        sendLog(`[好友] 跳过巡查: enableFriendCheck=${config.enableFriendCheck}, useFixedFriendList=${config.useFixedFriendList}, farmOps=${!!farmOps}`);
      }

      // 无论是否启用反检测调度器，都需要在两次巡查之间等待一段时间
      // 否则在启用 dispatcher 时会出现好友巡查“无间隔连发”的情况
      let waitInterval = (accountData.friendInterval || 10) * 1000;
      let allowIntervalShorten = true;

      if (config.enableRandomFriendInterval) {
        // 随机生成 5-300 秒的间隔（转换为毫秒）
        const randomSec = Math.floor(Math.random() * 296) + 5; // 5-300
        waitInterval = randomSec * 1000;
        allowIntervalShorten = false; // 随机模式下不根据间隔更新提前打断
        sendLog(`[好友] 随机时间模式，本次等待: ${randomSec}秒`);
      }

      const wasInterrupted = await interruptibleSleep(
        waitInterval,
        'friend',
        allowIntervalShorten
      );
      if (wasInterrupted) {
        sendLog('[好友] 间隔已调整，提前执行下一次巡查');
      }
    } catch (error) {
      sendLog(`[FriendLoop] 错误: ${error.message}`);
      await sleep(5000);
    }
  }
}

// 任务循环
async function startTaskLoop() {
  await sleep(4000);
  
  while (isRunning && !shouldStop) {
    try {
      if (config.autoTask !== false && farmOps) {
        const runTaskCheck = async () => {
          await farmOps.checkAndClaimTasks();
          tlogSession?.pushEvent('TASK_CHECK', { source: 'loop' });
        };
        if (dispatcher) {
          await dispatcher.enqueue('task', runTaskCheck, { label: 'task-check' });
        } else {
          await runTaskCheck();
        }
      }
      await sleep(60000);
    } catch (error) {
      sendLog(`[TaskLoop] 错误: ${error.message}`);
      await sleep(60000);
    }
  }
}

// 出售循环
async function startSellLoop() {
  await sleep(10000);
  
  while (isRunning && !shouldStop) {
    try {
      if (config.autoSell === true && farmOps) {
        const runSell = async () => {
          await farmOps.sellAllFruits();
          await collectAndSendData();
          tlogSession?.pushEvent('SELL_CHECK', { source: 'loop' });
        };
        if (dispatcher) {
          await dispatcher.enqueue('sell', runSell, { label: 'sell-check' });
        } else {
          await runSell();
        }
      }
      await sleep(30 * 60 * 1000);
    } catch (error) {
      sendLog(`[SellLoop] 错误: ${error.message}`);
      await sleep(60000);
    }
  }
}

// 获取每日礼包概览
async function getDailyGiftOverview() {
  const email = farmOps.email.getEmailDailyState ? farmOps.email.getEmailDailyState() : { doneToday: false, lastCheckAt: 0 };
  const shop = farmOps.shop.getFreeGiftDailyState ? farmOps.shop.getFreeGiftDailyState() : { doneToday: false, lastClaimAt: 0 };
  const illustrated = farmOps.illustrated.getIllustratedDailyState ? farmOps.illustrated.getIllustratedDailyState() : { doneToday: false, lastClaimAt: 0 };
  const vip = farmOps.qqvip.getVipDailyState ? farmOps.qqvip.getVipDailyState() : { doneToday: false, lastClaimAt: 0, hasGift: null, canClaim: null };
  const share = farmOps.share.getShareDailyState ? farmOps.share.getShareDailyState() : { doneToday: false, lastClaimAt: 0 };
  const monthCard = farmOps.monthCard.getMonthCardDailyState ? farmOps.monthCard.getMonthCardDailyState() : { doneToday: false, lastClaimAt: 0, hasCard: null, hasClaimable: null };
  const openServer = farmOps.openServer.getOpenServerDailyState ? farmOps.openServer.getOpenServerDailyState() : { doneToday: false, lastClaimAt: 0, hasRedPacket: null, hasClaimable: null };

  return {
    date: new Date().toISOString().slice(0, 10),
    gifts: [
      {
        key: 'email_rewards',
        label: '邮箱奖励',
        enabled: config.autoClaimEmail !== false,
        doneToday: !!email.doneToday,
        lastAt: Number(email.lastCheckAt || 0),
      },
      {
        key: 'illustrated_rewards',
        label: '图鉴奖励',
        enabled: config.autoClaimIllustrated !== false,
        doneToday: !!illustrated.doneToday,
        lastAt: Number(illustrated.lastClaimAt || 0),
      },
      {
        key: 'mall_free_gifts',
        label: '商城免费礼包',
        enabled: config.autoClaimFreeGifts !== false,
        doneToday: !!shop.doneToday,
        lastAt: Number(shop.lastClaimAt || 0),
      },
      {
        key: 'daily_share',
        label: '分享礼包',
        enabled: config.autoShare !== false,
        doneToday: !!share.doneToday,
        lastAt: Number(share.lastClaimAt || 0),
      },
      {
        key: 'vip_daily_gift',
        label: '会员礼包',
        enabled: config.autoClaimVip !== false,
        doneToday: !!vip.doneToday,
        lastAt: Number(vip.lastClaimAt || vip.lastCheckAt || 0),
        hasGift: vip.hasGift,
        canClaim: vip.canClaim,
      },
      {
        key: 'month_card_gift',
        label: '月卡礼包',
        enabled: config.autoClaimMonthCard !== false,
        doneToday: !!monthCard.doneToday,
        lastAt: Number(monthCard.lastClaimAt || monthCard.lastCheckAt || 0),
        hasCard: monthCard.hasCard,
        hasClaimable: monthCard.hasClaimable,
      },
      {
        key: 'open_server_red_packet',
        label: '开服红包',
        enabled: config.autoClaimOpenServer !== false,
        doneToday: !!openServer.doneToday,
        lastAt: Number(openServer.lastClaimAt || openServer.lastCheckAt || 0),
        hasRedPacket: openServer.hasRedPacket,
        hasClaimable: openServer.hasClaimable,
      },
    ],
  };
}

// 数据收集
async function startDataCollection() {
  const interval = 10000;
  
  while (isRunning && !shouldStop) {
    try {
      await collectAndSendData();
      await sleep(interval);
    } catch (error) {
      sendLog(`[DataCollection] 错误: ${error.message}`);
      await sleep(interval);
    }
  }
}

// 辅助函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 启动时间
let startTime = Date.now();

// 启动
main().catch(error => {
  sendError(error);
  process.exit(1);
});
