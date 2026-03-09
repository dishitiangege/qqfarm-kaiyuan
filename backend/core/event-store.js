/**
 * 事件驱动的 Store
 * 使用 EventEmitter 减少轮询开销
 */

const EventEmitter = require('events');

/**
 * 账号状态变更事件类型
 */
const AccountEvents = {
  STATUS_CHANGED: 'account:status_changed',
  STATS_UPDATED: 'account:stats_updated',
  CONFIG_CHANGED: 'account:config_changed',
  LAND_STATUS_CHANGED: 'account:land_status_changed',
  FRIENDS_UPDATED: 'account:friends_updated',
  BAG_UPDATED: 'account:bag_updated',
  TASKS_UPDATED: 'account:tasks_updated',
  LOG_RECEIVED: 'account:log_received',
  ERROR_OCCURRED: 'account:error_occurred',
};

/**
 * 全局事件类型
 */
const GlobalEvents = {
  SYSTEM_STATUS_CHANGED: 'system:status_changed',
  ALL_ACCOUNTS_STATUS: 'system:all_accounts_status',
};

/**
 * 事件驱动的 Store 类
 */
class EventStore extends EventEmitter {
  constructor() {
    super();
    this.accounts = new Map(); // 账号数据缓存
    this.stats = new Map(); // 统计数据缓存
    this.logs = new Map(); // 日志缓存
    this.subscribers = new Map(); // 订阅者管理
  }

  // ========== 账号数据管理 ==========

  /**
   * 设置账号数据
   * @param {string} accountId - 账号ID
   * @param {Object} data - 账号数据
   */
  setAccount(accountId, data) {
    const oldData = this.accounts.get(accountId);
    this.accounts.set(accountId, { ...oldData, ...data });

    // 触发账号状态变更事件
    this.emit(AccountEvents.STATUS_CHANGED, {
      accountId,
      oldData,
      newData: this.accounts.get(accountId),
    });
  }

  /**
   * 获取账号数据
   * @param {string} accountId - 账号ID
   * @returns {Object|undefined}
   */
  getAccount(accountId) {
    return this.accounts.get(accountId);
  }

  /**
   * 获取所有账号
   * @returns {Map<string, Object>}
   */
  getAllAccounts() {
    return this.accounts;
  }

  // ========== 统计数据管理 ==========

  /**
   * 更新账号统计
   * @param {string} accountId - 账号ID
   * @param {Object} stats - 统计数据
   */
  updateStats(accountId, stats) {
    const oldStats = this.stats.get(accountId);
    this.stats.set(accountId, { ...oldStats, ...stats });

    // 触发统计更新事件
    this.emit(AccountEvents.STATS_UPDATED, {
      accountId,
      stats: this.stats.get(accountId),
      changes: this._getChanges(oldStats, stats),
    });

    // 如果土地状态变化，触发专门事件
    if (stats.landStatus) {
      this.emit(AccountEvents.LAND_STATUS_CHANGED, {
        accountId,
        landStatus: stats.landStatus,
      });
    }

    // 如果背包变化，触发专门事件
    if (stats.bag) {
      this.emit(AccountEvents.BAG_UPDATED, {
        accountId,
        bag: stats.bag,
      });
    }

    // 如果任务变化，触发专门事件
    if (stats.tasks) {
      this.emit(AccountEvents.TASKS_UPDATED, {
        accountId,
        tasks: stats.tasks,
      });
    }
  }

  /**
   * 获取账号统计
   * @param {string} accountId - 账号ID
   * @returns {Object|undefined}
   */
  getStats(accountId) {
    return this.stats.get(accountId);
  }

  // ========== 日志管理 ==========

  /**
   * 添加日志
   * @param {string} accountId - 账号ID
   * @param {Object} log - 日志对象
   */
  addLog(accountId, log) {
    if (!this.logs.has(accountId)) {
      this.logs.set(accountId, []);
    }
    const accountLogs = this.logs.get(accountId);
    accountLogs.push(log);

    // 限制日志数量，保留最近1000条
    if (accountLogs.length > 1000) {
      accountLogs.shift();
    }

    // 触发日志接收事件
    this.emit(AccountEvents.LOG_RECEIVED, {
      accountId,
      log,
    });
  }

  /**
   * 获取账号日志
   * @param {string} accountId - 账号ID
   * @param {number} limit - 限制数量
   * @returns {Object[]}
   */
  getLogs(accountId, limit = 100) {
    const logs = this.logs.get(accountId) || [];
    return logs.slice(-limit);
  }

  // ========== 订阅管理 ==========

  /**
   * 订阅账号事件
   * @param {string} accountId - 账号ID
   * @param {string} eventType - 事件类型
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消订阅函数
   */
  subscribe(accountId, eventType, callback) {
    const key = `${accountId}:${eventType}`;

    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }

    this.subscribers.get(key).add(callback);

    // 返回取消订阅函数
    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }

  /**
   * 发布事件到订阅者
   * @param {string} accountId - 账号ID
   * @param {string} eventType - 事件类型
   * @param {*} data - 事件数据
   */
  publish(accountId, eventType, data) {
    const key = `${accountId}:${eventType}`;
    const callbacks = this.subscribers.get(key);

    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[EventStore] 回调执行失败:`, error);
        }
      });
    }
  }

  // ========== 辅助方法 ==========

  /**
   * 获取数据变更
   * @param {Object} oldData - 旧数据
   * @param {Object} newData - 新数据
   * @returns {Object} 变更的字段
   */
  _getChanges(oldData = {}, newData = {}) {
    const changes = {};
    for (const key of Object.keys(newData)) {
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        changes[key] = { old: oldData[key], new: newData[key] };
      }
    }
    return changes;
  }

  /**
   * 清理账号数据
   * @param {string} accountId - 账号ID
   */
  clearAccount(accountId) {
    this.accounts.delete(accountId);
    this.stats.delete(accountId);
    this.logs.delete(accountId);

    // 清理订阅者
    for (const key of this.subscribers.keys()) {
      if (key.startsWith(`${accountId}:`)) {
        this.subscribers.delete(key);
      }
    }
  }

  /**
   * 清空所有数据
   */
  clear() {
    this.accounts.clear();
    this.stats.clear();
    this.logs.clear();
    this.subscribers.clear();
    this.removeAllListeners();
  }
}

// 创建全局实例
const eventStore = new EventStore();

module.exports = {
  EventStore,
  eventStore,
  AccountEvents,
  GlobalEvents,
};
