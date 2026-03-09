/**
 * 账号管理器 - Worker 线程版本
 * 使用 Worker 线程池管理多个账号
 */

const workerPool = require('./workerPool');
const dataCollector = require('./dataCollector');
const logManager = require('./logManager');
const { query } = require('./db');
const fs = require('fs');
const path = require('path');
const { validateAccountConfig } = require('./config/schema');

class AccountManagerWorker {
  constructor() {
    this.accounts = new Map(); // accountId -> accountData
    this.accountStatuses = new Map(); // accountId -> status
    this.accountsFilePath = path.join(__dirname, 'accounts.json');

    // 加载账号
    this.loadAccounts();

    // 设置 Worker 消息处理
    this.setupWorkerHandlers();
    
    // 设置 Worker 池的账号数据获取回调
    workerPool.setAccountDataProvider((accountId) => {
      const account = this.accounts.get(accountId);
      if (!account) return null;
      
      // 返回完整的账号数据
      return {
        id: account.id,
        name: account.name,
        level: account.level,
        platform: account.platform,
        code: account.code,
        email: account.email || '',
        farmInterval: account.farmInterval || 10,
        friendInterval: account.friendInterval || 10,
        config: account.config || {}
      };
    });
  }

  init() {
    console.log('[AccountManagerWorker] 初始化完成');
    console.log(`[AccountManagerWorker] 已加载 ${this.accounts.size} 个账号`);
  }

  /**
   * 加载账号数据
   */
  loadAccounts() {
    try {
      if (fs.existsSync(this.accountsFilePath)) {
        const data = fs.readFileSync(this.accountsFilePath, 'utf8');
        const accounts = JSON.parse(data);
        accounts.forEach(account => {
          this.accounts.set(account.id, account);
        });
        console.log(`[AccountManagerWorker] 从文件加载了 ${accounts.length} 个账号`);
      }
    } catch (error) {
      console.error('[AccountManagerWorker] 加载账号数据失败:', error.message);
    }
  }

  /**
   * 保存账号数据
   */
  saveAccounts() {
    try {
      const accounts = Array.from(this.accounts.values());
      fs.writeFileSync(this.accountsFilePath, JSON.stringify(accounts, null, 2));
    } catch (error) {
      console.error('[AccountManagerWorker] 保存账号数据失败:', error.message);
    }
  }

  /**
   * 设置 Worker 消息处理器
   */
  setupWorkerHandlers() {
    // Worker 池的消息处理 - 先调用 messageHandlers 中的处理器，再调用默认处理器
    workerPool.handleWorkerMessage = (accountId, msg) => {
      // 先调用 messageHandlers 中注册的处理器（如 harvestLands 设置的临时处理器）
      const handler = workerPool.messageHandlers.get(accountId);
      if (handler) {
        handler(msg);
      }
      // 再调用默认的处理器
      this.handleWorkerMessage(accountId, msg);
    };
  }

  /**
   * 启动账号
   */
  async startAccount(accountId) {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error('账号不存在');
    }

    // 检查 code 是否存在
    if (!account.code) {
      throw new Error('账号没有登录凭证，请先重新登录');
    }

    // 验证配置，确保所有字段都有默认值
    account.config = validateAccountConfig(account.config);

    // 准备账号数据
    const accountData = {
      id: account.id,
      name: account.name,
      level: account.level,
      platform: account.platform,
      code: account.code,
      email: account.email || '',
      farmInterval: account.farmInterval || 10,
      friendInterval: account.friendInterval || 10,
      config: account.config
    };

    // 启动 Worker
    const result = await workerPool.startAccount(accountId, accountData);
    
    this.accountStatuses.set(accountId, 'starting');
    
    return result;
  }

  /**
   * 停止账号
   */
  async stopAccount(accountId) {
    try {
      await workerPool.stopAccount(accountId);
      workerPool.removeMessageHandler(accountId);
      this.accountStatuses.set(accountId, 'stopped');
      
      // 保存每日统计
      const account = this.accounts.get(accountId);
      if (account && account.stats) {
        await this.saveDailyStats(accountId, account.stats);
      }
      
      return true;
    } catch (error) {
      console.error(`[AccountManagerWorker] 停止账号 ${accountId} 失败:`, error.message);
      return false;
    }
  }

  /**
   * 处理 Worker 消息
   */
  handleWorkerMessage(accountId, msg) {
    switch (msg.type) {
      case 'log':
        logManager.addTextLog(accountId, msg.message);
        break;

      case 'data':
        // 更新数据收集器
        dataCollector.updateAccountData(accountId, msg.data);

        // 更新账号信息
        const account = this.accounts.get(accountId);
        if (account && msg.data) {
          if (msg.data.name) account.name = msg.data.name;
          if (msg.data.level) account.level = msg.data.level;
          if (msg.data.stats) {
            // 合并 stats，确保 sessionStats 和 todayStats 正确更新
            account.stats = {
              ...account.stats,
              ...msg.data.stats,
              // 确保 sessionStats 和 todayStats 来自实时数据
              sessionStats: msg.data.stats.sessionStats || account.stats.sessionStats || { exp: 0, harvest: 0, steal: 0, water: 0, weed: 0, bug: 0, sell: 0, onlineTime: 0 },
              todayStats: msg.data.stats.todayStats || account.stats.todayStats || { exp: 0, harvest: 0, steal: 0, water: 0, weed: 0, bug: 0, sell: 0 }
            };
          }
          this.saveAccounts();
        }
        break;

      case 'status':
        this.accountStatuses.set(accountId, msg.status);
        console.log(`[账号 ${accountId}] 状态变化:`, msg.status);
        break;

      case 'error':
        console.error(`[账号 ${accountId}] 错误:`, msg.error);
        this.accountStatuses.set(accountId, 'error');
        break;

      case 'workerStopped':
        // Worker 因连接断开而停止
        console.log(`[账号 ${accountId}] Worker 已停止，原因: ${msg.reason}`);
        this.accountStatuses.set(accountId, 'stopped');
        // 从 Worker 池中清理（Worker 已经退出，只需清理状态）
        workerPool.cleanupWorker(accountId);
        break;

      case 'configAutoUpdate':
        try {
          const accountForConfig = this.accounts.get(accountId);
          if (!accountForConfig) break;

          const patch = msg.configPatch || {};
          accountForConfig.config = {
            ...(accountForConfig.config || {}),
            ...patch
          };
          this.saveAccounts();

          const reason = msg.reason ? `，原因: ${msg.reason}` : '';
          console.log(`[账号 ${accountId}] 已自动更新配置并保存${reason}`);
        } catch (err) {
          console.error(`[账号 ${accountId}] 自动更新配置失败:`, err.message);
        }
        break;
    }
  }

  /**
   * 保存每日统计到数据库
   */
  async saveDailyStats(accountId, stats) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const onlineTime = Math.floor((stats.onlineTime || 0) / 60);
      const expGained = stats.todayStats?.exp || 0;
      
      // 这里可以添加数据库保存逻辑
      console.log(`[账号 ${accountId}] 保存每日统计: ${today}, 在线: ${onlineTime}分钟, 经验: ${expGained}`);
    } catch (error) {
      console.error(`[账号 ${accountId}] 保存每日统计失败:`, error.message);
    }
  }

  /**
   * 获取所有账号
   */
  getAccounts() {
    const accounts = [];
    const runningAccounts = workerPool.getRunningAccounts();
    
    for (const [id, account] of this.accounts) {
      const status = this.getAccountStatus(id);
      
      // 调试日志
      if (process.env.DEBUG_ACCOUNT_STATUS) {
        console.log(`[getAccounts] 账号 ${id}: isRunning=${status.isRunning}, status=${status.status}`);
      }
      
      accounts.push({
        ...account,
        isRunning: status.isRunning,
        status: status.status
      });
    }
    
    // 调试日志
    console.log(`[getAccounts] 总账号数: ${accounts.length}, 运行中: ${runningAccounts.length}`);
    
    return accounts;
  }

  /**
   * 添加账号
   * 兼容两种调用方式：addAccount(code, platform) 或 addAccount(accountData)
   */
  addAccount(codeOrData, platform) {
    let newAccount;
    
    if (typeof codeOrData === 'string' && platform) {
      // 旧版调用方式：addAccount(code, platform)
      newAccount = {
        id: Date.now().toString(),
        name: '新账号',
        level: 1,
        status: 'offline',
        platform: platform,
        code: codeOrData,
        email: '',
        farmInterval: 10,
        friendInterval: 10,
        config: {},
        stats: {
          exp: 0,
          coins: 0,
          expProgress: 0,
          expNeeded: 100,
          onlineTime: 0,
          // 本次登录统计（本次会话累计）
          sessionStats: {
            exp: 0,
            harvest: 0,
            steal: 0,
            water: 0,
            weed: 0,
            bug: 0,
            sell: 0,
            onlineTime: 0
          },
          // 今日累计统计（全天累计）
          todayStats: {
            exp: 0,
            harvest: 0,
            steal: 0,
            water: 0,
            weed: 0,
            bug: 0,
            sell: 0
          },
          landStatus: Array(24).fill('空闲')
        }
      };
    } else {
      // 新版调用方式：addAccount(accountData)
      newAccount = codeOrData;
    }

    this.accounts.set(newAccount.id, newAccount);
    this.saveAccounts();
    return newAccount;
  }

  /**
   * 移除账号
   */
  async removeAccount(accountId) {
    await this.stopAccount(accountId);
    this.accounts.delete(accountId);
    dataCollector.removeAccountData(accountId);
    logManager.removeAccountLogs(accountId);
    this.saveAccounts();
  }

  /**
   * 更新账号登录code（重新登录）
   */
  async updateAccountCode(accountId, code) {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error('账号不存在');
    }

    // 如果正在运行，先停止
    if (workerPool.getRunningAccounts().includes(accountId)) {
      await this.stopAccount(accountId);
    }

    // 更新code
    account.code = code;
    account.status = 'offline';
    this.saveAccounts();

    console.log(`[账号 ${accountId}] 登录code已更新`);

    // 自动启动
    console.log(`[账号 ${accountId}] 正在自动启动...`);
    await this.startAccount(accountId);

    return account;
  }

  /**
   * 从数据库同步账号到内存
   */
  async syncAccountFromDB(dbAccount) {
    try {
      // 转换数据库账号格式为本地格式
      const account = {
        id: dbAccount.account_id,
        name: dbAccount.name,
        level: dbAccount.level || 1,
        status: 'offline',
        platform: dbAccount.platform,
        code: dbAccount.code,
        email: dbAccount.email || '',
        farmInterval: dbAccount.farm_interval || 10,
        friendInterval: dbAccount.friend_interval || 10,
        config: dbAccount.config || {},
        stats: {
          exp: 0,
          coins: 0,
          expProgress: 0,
          expNeeded: 100,
          onlineTime: 0,
          // 本次登录统计（本次会话累计）
          sessionStats: {
            exp: 0,
            harvest: 0,
            steal: 0,
            water: 0,
            weed: 0,
            bug: 0,
            sell: 0,
            onlineTime: 0
          },
          // 今日累计统计（全天累计）
          todayStats: {
            exp: 0,
            harvest: 0,
            steal: 0,
            water: 0,
            weed: 0,
            bug: 0,
            sell: 0
          },
          landStatus: Array(24).fill('空闲')
        }
      };

      // 添加到内存
      this.accounts.set(account.id, account);
      
      // 保存到文件
      this.saveAccounts();
      
      console.log(`[AccountManagerWorker] 账号 ${account.id} 已从数据库同步到内存`);
      return account;
    } catch (error) {
      console.error(`[AccountManagerWorker] 同步账号失败:`, error.message);
      throw error;
    }
  }

  /**
   * 更新账号配置
   */
  async updateAccountConfig(accountId, configData) {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error('账号不存在');
    }

    // 更新配置
    if (configData.config) {
      account.config = { ...account.config, ...configData.config };
    }
    if (configData.farmInterval !== undefined) {
      account.farmInterval = configData.farmInterval;
    }
    if (configData.friendInterval !== undefined) {
      account.friendInterval = configData.friendInterval;
    }
    if (configData.email !== undefined) {
      account.email = configData.email;
    }

    // 验证配置，确保所有字段都有默认值
    account.config = validateAccountConfig(account.config);

    this.saveAccounts();

    // 如果正在运行，发送配置更新
    if (workerPool.getRunningAccounts().includes(accountId)) {
      workerPool.sendMessage(accountId, {
        type: 'configUpdate',
        config: account.config,
        farmInterval: account.farmInterval,
        friendInterval: account.friendInterval
      });
    }

    return account;
  }

  /**
   * 广播反检测系统设置到所有在线 Worker
   * @param {Object} settings - 反检测设置
   * @returns {{runningCount:number, sentCount:number, updatedLocalConfigCount:number}}
   */
  async broadcastAntiDetectionSettings(settings) {
    const runningAccounts = workerPool.getRunningAccounts();
    let sentCount = 0;
    let updatedLocalConfigCount = 0;

    const globalEnabled = settings?.globalEnabled !== false;
    const defaultConfig = settings?.defaultConfig && typeof settings.defaultConfig === 'object'
      ? JSON.parse(JSON.stringify(settings.defaultConfig))
      : null;

    for (const accountId of runningAccounts) {
      const account = this.accounts.get(accountId);
      const hasAccountAntiDetectionConfig = !!(
        account?.config &&
        typeof account.config === 'object' &&
        account.config.antiDetection &&
        typeof account.config.antiDetection === 'object'
      );

      if (!hasAccountAntiDetectionConfig && defaultConfig && account) {
        account.config = {
          ...(account.config || {}),
          antiDetection: JSON.parse(JSON.stringify(defaultConfig))
        };
        updatedLocalConfigCount++;
      }

      const sent = workerPool.sendMessage(accountId, {
        type: 'antiDetectionSettingsUpdate',
        globalEnabled,
        defaultConfig,
        applyDefaultToMissing: !hasAccountAntiDetectionConfig
      });

      if (sent) {
        sentCount++;
      }
    }

    if (updatedLocalConfigCount > 0) {
      this.saveAccounts();
    }

    return {
      runningCount: runningAccounts.length,
      sentCount,
      updatedLocalConfigCount
    };
  }

  /**
   * 获取账号状态
   */
  getAccountStatus(accountId) {
    const workerStatus = workerPool.getAccountStatus(accountId);
    const runningAccounts = workerPool.getRunningAccounts();
    const isRunning = runningAccounts.includes(accountId);
    
    // 调试日志
    if (process.env.DEBUG_ACCOUNT_STATUS) {
      console.log(`[getAccountStatus] 账号 ${accountId}:`, {
        workerStatus,
        accountStatus: this.accountStatuses.get(accountId),
        runningAccounts,
        isRunning
      });
    }
    
    return {
      status: workerStatus.status || this.accountStatuses.get(accountId) || 'stopped',
      isRunning
    };
  }

  /**
   * 获取所有运行中的账号
   */
  getRunningAccounts() {
    return workerPool.getRunningAccounts();
  }

  /**
   * 一键重启所有运行中的账号
   */
  async restartAllRunningAccounts() {
    const runningAccounts = this.getRunningAccounts();
    
    console.log(`[AccountManagerWorker] 开始重启 ${runningAccounts.length} 个账号`);
    
    // 先停止所有
    for (const accountId of runningAccounts) {
      try {
        await this.stopAccount(accountId);
      } catch (error) {
        console.error(`[AccountManagerWorker] 停止账号 ${accountId} 失败:`, error.message);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 重新启动
    let successCount = 0;
    for (const accountId of runningAccounts) {
      try {
        await this.startAccount(accountId);
        successCount++;
      } catch (error) {
        console.error(`[AccountManagerWorker] 启动账号 ${accountId} 失败:`, error.message);
      }
    }
    
    console.log(`[AccountManagerWorker] 重启完成: 成功 ${successCount}/${runningAccounts.length}`);
    
    return {
      success: true,
      restartedCount: successCount,
      totalCount: runningAccounts.length
    };
  }

  /**
   * 停止所有账号
   */
  async stopAll() {
    await workerPool.stopAll();
  }

  /**
   * 获取池状态
   */
  getPoolStatus() {
    return workerPool.getPoolStatus();
  }

  /**
   * 获取账号日志
   */
  getAccountLogs(accountId, limit = 100) {
    return logManager.getLogs(accountId, limit);
  }

  /**
   * 检查账号是否正在运行
   * @param {string} accountId - 账号ID
   * @returns {boolean} 是否正在运行
   */
  isAccountRunning(accountId) {
    const runningAccounts = workerPool.getRunningAccounts();
    return runningAccounts.includes(accountId);
  }

  /**
   * 获取账号的实时统计数据（从内存中获取，比文件更快）
   * @param {string} accountId - 账号ID
   * @returns {Object|null} 实时统计数据
   */
  getAccountRealtimeStats(accountId) {
    const account = this.accounts.get(accountId);
    if (!account) return null;
    
    // 优先从内存中获取最新数据（this.accounts 是实时更新的）
    if (account.stats) {
      return account.stats;
    }
    
    // 备用：从 dataCollector 获取数据（可能稍有延迟）
    const realTimeData = dataCollector.getAccountData(accountId);
    if (realTimeData && realTimeData.stats) {
      return realTimeData.stats;
    }
    
    return null;
  }

  /**
   * 手动售卖果实
   * @param {string} accountId - 账号ID
   * @param {number[]} itemIds - 可选，指定要售卖的果实ID列表（按种类）
   * @param {number[]} uids - 可选，指定要售卖的物品uid列表（精确到每个物品条目）
   * @returns {Promise<Object>} 售卖结果
   */
  async sellFruits(accountId, itemIds, uids) {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error('账号不存在');
    }

    const runningAccounts = workerPool.getRunningAccounts();
    if (!runningAccounts.includes(accountId)) {
      throw new Error('账号未运行，请先启动账号');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // 超时后移除临时消息处理器
        workerPool.removeMessageHandler(accountId);
        reject(new Error('售卖请求超时'));
      }, 30000);

      // 设置临时消息处理器
      const messageHandler = (msg) => {
        if (msg.type === 'sellResult' && msg.accountId === accountId) {
          clearTimeout(timeout);
          
          // 移除临时消息处理器
          workerPool.removeMessageHandler(accountId);
          
          if (msg.success) {
            resolve({
              success: true,
              message: '售卖成功',
              itemCount: msg.itemCount,
              goldEarned: msg.goldEarned
            });
          } else {
            reject(new Error(msg.error || '售卖失败'));
          }
        }
      };

      // 监听消息 - 临时处理器只处理特定消息，不调用 this.handleWorkerMessage
      // 因为 setupWorkerHandlers 中的 handleWorkerMessage 会调用 this.handleWorkerMessage
      workerPool.setMessageHandler(accountId, (msg) => {
        // 只调用我们的处理器
        messageHandler(msg);
      });

      // 发送售卖请求
      const sent = workerPool.sendMessage(accountId, {
        type: 'sellItems',
        itemIds,
        uids
      });

      if (!sent) {
        clearTimeout(timeout);
        // 移除临时消息处理器
        workerPool.removeMessageHandler(accountId);
        reject(new Error('发送售卖请求失败'));
      }
    });
  }

  /**
   * 手动收获土地
   * @param {string} accountId - 账号ID
   * @param {number[]} landIds - 要收获的土地ID列表
   * @returns {Promise<Object>} 收获结果
   */
  async harvestLands(accountId, landIds) {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error('账号不存在');
    }

    const runningAccounts = workerPool.getRunningAccounts();
    if (!runningAccounts.includes(accountId)) {
      throw new Error('账号未运行，请先启动账号');
    }

    if (!landIds || landIds.length === 0) {
      throw new Error('未选择土地');
    }

    console.log(`[harvestLands] 开始收获请求，账号: ${accountId}, 土地: ${landIds?.join(',')}`);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log(`[harvestLands] 请求超时，账号: ${accountId}`);
        // 超时后移除临时消息处理器
        workerPool.removeMessageHandler(accountId);
        reject(new Error('收获请求超时'));
      }, 30000);

      // 设置临时消息处理器
      const messageHandler = (msg) => {
        console.log(`[harvestLands] 收到消息: type=${msg.type}, accountId=${msg.accountId}`);
        if (msg.type === 'harvestResult' && msg.accountId === accountId) {
          clearTimeout(timeout);
          
          // 移除临时消息处理器
          workerPool.removeMessageHandler(accountId);
          
          if (msg.success) {
            console.log(`[harvestLands] 收获成功，土地数: ${msg.landCount}`);
            resolve({
              success: true,
              message: '收获成功',
              landCount: msg.landCount
            });
          } else {
            console.log(`[harvestLands] 收获失败: ${msg.error}`);
            reject(new Error(msg.error || '收获失败'));
          }
        }
      };

      // 监听消息 - 临时处理器只处理特定消息，不调用 this.handleWorkerMessage
      workerPool.setMessageHandler(accountId, (msg) => {
        // 只调用我们的处理器
        messageHandler(msg);
      });

      // 发送收获请求
      console.log(`[harvestLands] 发送消息到 Worker`);
      const sent = workerPool.sendMessage(accountId, {
        type: 'harvestLands',
        landIds
      });

      if (!sent) {
        clearTimeout(timeout);
        console.log(`[harvestLands] 发送失败`);
        // 移除临时消息处理器
        workerPool.removeMessageHandler(accountId);
        reject(new Error('发送收获请求失败'));
      } else {
        console.log(`[harvestLands] 消息已发送`);
      }
    });
  }

  /**
   * 手动种植土地
   * @param {string} accountId - 账号ID
   * @param {number[]} landIds - 要种植的土地ID列表
   * @param {number} seedId - 种子ID
   * @returns {Promise<Object>} 种植结果
   */
  async plantLands(accountId, landIds, seedId) {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error('账号不存在');
    }

    const runningAccounts = workerPool.getRunningAccounts();
    if (!runningAccounts.includes(accountId)) {
      throw new Error('账号未运行，请先启动账号');
    }

    if (!landIds || landIds.length === 0) {
      throw new Error('未选择土地');
    }

    if (!seedId) {
      throw new Error('未选择种子');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // 超时后移除临时消息处理器
        workerPool.removeMessageHandler(accountId);
        reject(new Error('种植请求超时'));
      }, 60000);

      // 设置临时消息处理器
      const messageHandler = (msg) => {
        if (msg.type === 'plantResult' && msg.accountId === accountId) {
          clearTimeout(timeout);
          
          // 移除临时消息处理器
          workerPool.removeMessageHandler(accountId);
          
          if (msg.success) {
            resolve({
              success: true,
              message: '种植成功',
              landCount: msg.landCount,
              seedName: msg.seedName
            });
          } else {
            reject(new Error(msg.error || '种植失败'));
          }
        }
      };

      // 监听消息 - 临时处理器只处理特定消息，不调用 this.handleWorkerMessage
      workerPool.setMessageHandler(accountId, (msg) => {
        // 只调用我们的处理器
        messageHandler(msg);
      });

      // 发送种植请求
      const sent = workerPool.sendMessage(accountId, {
        type: 'plantLands',
        landIds,
        seedId
      });

      if (!sent) {
        clearTimeout(timeout);
        // 移除临时消息处理器
        workerPool.removeMessageHandler(accountId);
        reject(new Error('发送种植请求失败'));
      }
    });
  }

  /**
   * 手动获取好友列表
   * @param {string} accountId - 账号ID
   * @returns {Promise<Object>} 好友列表结果
   */
  async fetchFriendsManually(accountId) {
    const account = this.accounts.get(accountId);
    if (!account) {
      return { success: false, message: '账号不存在' };
    }

    const runningAccounts = workerPool.getRunningAccounts();
    if (!runningAccounts.includes(accountId)) {
      return { success: false, message: '账号未运行，请先启动账号' };
    }

    try {
      // 从 dataCollector 获取当前好友数据
      const realData = dataCollector.getAccountData(accountId);
      
      // 如果已经有好友数据，直接返回
      if (realData && realData.friends && realData.friends.length > 0) {
        return { success: true, message: '好友列表已存在', friends: realData.friends };
      }

      // 如果没有好友数据，提示用户等待自动巡查
      return { success: false, message: '暂无好友数据，请等待好友巡查自动获取或重启账号' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 解锁指定土地
   * @param {string} accountId - 账号ID
   * @param {number} landId - 土地ID
   * @returns {Promise<Object>} 解锁结果
   */
  async unlockLand(accountId, landId) {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error('账号不存在');
    }

    const runningAccounts = workerPool.getRunningAccounts();
    if (!runningAccounts.includes(accountId)) {
      throw new Error('账号未运行，请先启动账号');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // 超时后恢复原来的消息处理器
        workerPool.setMessageHandler(accountId, (msg) => {
          this.handleWorkerMessage(accountId, msg);
        });
        reject(new Error('解锁土地请求超时'));
      }, 30000);

      const messageHandler = (msg) => {
        if (msg.type === 'unlockLandResult' && msg.accountId === accountId) {
          clearTimeout(timeout);
          
          // 移除临时消息处理器
          workerPool.removeMessageHandler(accountId);
          
          if (msg.success) {
            resolve({
              success: true,
              message: '解锁成功',
              landId: msg.landId
            });
          } else {
            reject(new Error(msg.error || '解锁失败'));
          }
        }
      };

      // 监听消息 - 临时处理器只处理特定消息，不调用 this.handleWorkerMessage
      workerPool.setMessageHandler(accountId, (msg) => {
        // 只调用我们的处理器
        messageHandler(msg);
      });

      const sent = workerPool.sendMessage(accountId, {
        type: 'unlockLand',
        landId
      });

      if (!sent) {
        clearTimeout(timeout);
        // 移除临时消息处理器
        workerPool.removeMessageHandler(accountId);
        reject(new Error('发送解锁请求失败'));
      }
    });
  }

  /**
   * 升级指定土地
   * @param {string} accountId - 账号ID
   * @param {number} landId - 土地ID
   * @returns {Promise<Object>} 升级结果
   */
  async upgradeLand(accountId, landId) {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error('账号不存在');
    }

    const runningAccounts = workerPool.getRunningAccounts();
    if (!runningAccounts.includes(accountId)) {
      throw new Error('账号未运行，请先启动账号');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // 超时后移除临时消息处理器
        workerPool.removeMessageHandler(accountId);
        reject(new Error('升级土地请求超时'));
      }, 30000);

      const messageHandler = (msg) => {
        if (msg.type === 'upgradeLandResult' && msg.accountId === accountId) {
          clearTimeout(timeout);

          // 移除临时消息处理器
          workerPool.removeMessageHandler(accountId);

          if (msg.success) {
            resolve({
              success: true,
              message: '升级成功',
              landId: msg.landId
            });
          } else {
            reject(new Error(msg.error || '升级失败'));
          }
        }
      };

      // 监听消息 - 临时处理器只处理特定消息，不调用 this.handleWorkerMessage
      workerPool.setMessageHandler(accountId, (msg) => {
        // 只调用我们的处理器
        messageHandler(msg);
      });

      const sent = workerPool.sendMessage(accountId, {
        type: 'upgradeLand',
        landId
      });

      if (!sent) {
        clearTimeout(timeout);
        // 移除临时消息处理器
        workerPool.removeMessageHandler(accountId);
        reject(new Error('发送升级请求失败'));
      }
    });
  }

  /**
   * 自动解锁土地
   * @param {string} accountId - 账号ID
   * @returns {Promise<Object>} 解锁结果
   */
  async autoUnlockLands(accountId) {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error('账号不存在');
    }

    const runningAccounts = workerPool.getRunningAccounts();
    if (!runningAccounts.includes(accountId)) {
      throw new Error('账号未运行，请先启动账号');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('自动解锁土地请求超时'));
      }, 60000);

      const messageHandler = (msg) => {
        if (msg.type === 'autoUnlockLandsResult' && msg.accountId === accountId) {
          clearTimeout(timeout);
          
          if (msg.success) {
            resolve({
              success: true,
              message: msg.message || '自动解锁完成',
              unlockedCount: msg.unlockedCount || 0
            });
          } else {
            reject(new Error(msg.error || '自动解锁失败'));
          }
        }
      };

      workerPool.setMessageHandler(accountId, (msg) => {
        this.handleWorkerMessage(accountId, msg);
        messageHandler(msg);
      });

      const sent = workerPool.sendMessage(accountId, {
        type: 'autoUnlockLands'
      });

      if (!sent) {
        clearTimeout(timeout);
        reject(new Error('发送自动解锁请求失败'));
      }
    });
  }

  /**
   * 自动升级土地
   * @param {string} accountId - 账号ID
   * @returns {Promise<Object>} 升级结果
   */
  async autoUpgradeLands(accountId) {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error('账号不存在');
    }

    const runningAccounts = workerPool.getRunningAccounts();
    if (!runningAccounts.includes(accountId)) {
      throw new Error('账号未运行，请先启动账号');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('自动升级土地请求超时'));
      }, 60000);

      const messageHandler = (msg) => {
        if (msg.type === 'autoUpgradeLandsResult' && msg.accountId === accountId) {
          clearTimeout(timeout);
          
          if (msg.success) {
            resolve({
              success: true,
              message: msg.message || '自动升级完成',
              upgradedCount: msg.upgradedCount || 0
            });
          } else {
            reject(new Error(msg.error || '自动升级失败'));
          }
        }
      };

      workerPool.setMessageHandler(accountId, (msg) => {
        this.handleWorkerMessage(accountId, msg);
        messageHandler(msg);
      });

      const sent = workerPool.sendMessage(accountId, {
        type: 'autoUpgradeLands'
      });

      if (!sent) {
        clearTimeout(timeout);
        reject(new Error('发送自动升级请求失败'));
      }
    });
  }

  /**
   * 自动管理土地（解锁+升级）
   * @param {string} accountId - 账号ID
   * @returns {Promise<Object>} 管理结果
   */
  async autoManageLands(accountId) {
    const unlockResult = await this.autoUnlockLands(accountId);
    const upgradeResult = await this.autoUpgradeLands(accountId);
    
    return {
      success: true,
      unlock: unlockResult,
      upgrade: upgradeResult
    };
  }

  /**
   * 获取每日礼包状态
   * @param {string} accountId - 账号ID
   * @returns {Promise<Object>} 每日礼包状态
   */
  async getDailyGifts(accountId) {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error('账号不存在');
    }

    const runningAccounts = workerPool.getRunningAccounts();
    if (!runningAccounts.includes(accountId)) {
      throw new Error('账号未运行，请先启动账号');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        workerPool.removeMessageHandler(accountId);
        reject(new Error('获取每日礼包状态超时'));
      }, 30000);

      // 设置临时消息处理器
      const messageHandler = (msg) => {
        if (msg.type === 'dailyGiftsResult' && msg.accountId === accountId) {
          clearTimeout(timeout);
          workerPool.removeMessageHandler(accountId);

          if (msg.success) {
            resolve(msg.data);
          } else {
            reject(new Error(msg.error || '获取每日礼包状态失败'));
          }
        }
      };

      workerPool.setMessageHandler(accountId, messageHandler);

      // 发送获取每日礼包状态请求
      const sent = workerPool.sendMessage(accountId, {
        type: 'getDailyGifts'
      });

      if (!sent) {
        clearTimeout(timeout);
        workerPool.removeMessageHandler(accountId);
        reject(new Error('发送获取每日礼包状态请求失败'));
      }
    });
  }

  /**
   * 清理
   */
  cleanup() {
    this.stopAll();
  }
}

module.exports = new AccountManagerWorker();
