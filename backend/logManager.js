/**
 * 日志管理器 - 管理账号运行日志
 */

const EventEmitter = require('events');

// 日志模块类型
const LogModule = {
  FARM: 'farm',      // 农场
  FRIEND: 'friend',  // 好友
  SHOP: 'shop',      // 商店
  WAREHOUSE: 'warehouse', // 仓库
  SYSTEM: 'system',  // 系统
  AUTH: 'auth',      // 登录认证
  TASK: 'task',      // 任务
  OTHER: 'other'     // 其他
};

// 日志级别
const LogLevel = {
  DEBUG: 'debug',    // 调试
  INFO: 'info',      // 信息
  SUCCESS: 'success',// 成功
  WARNING: 'warning',// 警告
  ERROR: 'error'     // 错误
};

// 模块配置（用于前端展示）
const ModuleConfig = {
  [LogModule.FARM]: { label: '农场', color: '#22c55e', icon: '🌾' },
  [LogModule.FRIEND]: { label: '好友', color: '#3b82f6', icon: '👥' },
  [LogModule.SHOP]: { label: '商店', color: '#a855f7', icon: '🛒' },
  [LogModule.WAREHOUSE]: { label: '仓库', color: '#f59e0b', icon: '📦' },
  [LogModule.SYSTEM]: { label: '系统', color: '#64748b', icon: '⚙️' },
  [LogModule.AUTH]: { label: '登录', color: '#10b981', icon: '🔐' },
  [LogModule.TASK]: { label: '任务', color: '#ec4899', icon: '📋' },
  [LogModule.OTHER]: { label: '其他', color: '#6b7280', icon: '📝' }
};

// 级别配置（用于前端展示）
const LevelConfig = {
  [LogLevel.DEBUG]: { label: '调试', color: '#6b7280' },
  [LogLevel.INFO]: { label: '信息', color: '#3b82f6' },
  [LogLevel.SUCCESS]: { label: '成功', color: '#22c55e' },
  [LogLevel.WARNING]: { label: '警告', color: '#f59e0b' },
  [LogLevel.ERROR]: { label: '错误', color: '#ef4444' }
};

class LogManager extends EventEmitter {
  constructor() {
    super();
    this.accountLogs = new Map(); // accountId -> { logs: LogEntry[], maxSize: number }
    this.maxLogSize = 200; // 每个账号最多保存200条日志（减少内存占用）
    this.maxAccounts = 50; // 最多缓存50个账号的日志
  }

  /**
   * 添加结构化日志
   * @param {string} accountId - 账号ID
   * @param {string} module - 模块类型 (LogModule)
   * @param {string} level - 日志级别 (LogLevel)
   * @param {string} message - 日志消息
   * @param {Object} metadata - 额外元数据（可选）
   */
  addLog(accountId, module = LogModule.OTHER, level = LogLevel.INFO, message, metadata = {}) {
    // 限制缓存的账号数量
    if (!this.accountLogs.has(accountId) && this.accountLogs.size >= this.maxAccounts) {
      // 删除最旧的账号日志
      const firstKey = this.accountLogs.keys().next().value;
      this.accountLogs.delete(firstKey);
    }

    if (!this.accountLogs.has(accountId)) {
      this.accountLogs.set(accountId, {
        logs: [],
        maxSize: this.maxLogSize
      });
    }

    const accountLog = this.accountLogs.get(accountId);
    
    // 创建结构化日志条目
    const logEntry = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      module: module,
      level: level,
      message: message,
      metadata: metadata
    };

    accountLog.logs.push(logEntry);

    // 限制日志数量
    if (accountLog.logs.length > accountLog.maxSize) {
      accountLog.logs.shift();
    }

    // 触发事件
    this.emit('log', { accountId, log: logEntry });
    
    return logEntry;
  }

  /**
   * 添加普通文本日志（兼容旧代码）
   * @param {string} accountId - 账号ID
   * @param {string} log - 日志文本
   */
  addTextLog(accountId, log) {
    // 解析日志内容，尝试提取模块和级别
    let module = LogModule.OTHER;
    let level = LogLevel.INFO;
    let message = log;

    // 根据关键词识别模块
    if (log.includes('农场') || log.includes('种植') || log.includes('收获') || log.includes('浇水') || log.includes('除草') || log.includes('除虫')) {
      module = LogModule.FARM;
    } else if (log.includes('好友') || log.includes('偷菜') || log.includes('访问')) {
      module = LogModule.FRIEND;
    } else if (log.includes('商店') || log.includes('购买') || log.includes('出售')) {
      module = LogModule.SHOP;
    } else if (log.includes('仓库')) {
      module = LogModule.WAREHOUSE;
    } else if (log.includes('登录') || log.includes('认证') || log.includes('扫码')) {
      module = LogModule.AUTH;
    } else if (log.includes('任务')) {
      module = LogModule.TASK;
    } else if (log.includes('系统') || log.includes('启动') || log.includes('停止')) {
      module = LogModule.SYSTEM;
    }

    // 根据关键词识别级别
    if (log.includes('错误') || log.includes('失败') || log.includes('异常')) {
      level = LogLevel.ERROR;
    } else if (log.includes('警告') || log.includes('注意')) {
      level = LogLevel.WARNING;
    } else if (log.includes('成功') || log.includes('完成')) {
      level = LogLevel.SUCCESS;
    }

    return this.addLog(accountId, module, level, message);
  }

  // 获取账号日志
  getLogs(accountId, limit = 100) {
    const accountLog = this.accountLogs.get(accountId);
    if (!accountLog) return [];
    return accountLog.logs.slice(-limit);
  }

  // 清空账号日志
  clearLogs(accountId) {
    if (this.accountLogs.has(accountId)) {
      this.accountLogs.get(accountId).logs = [];
    }
  }

  // 删除账号日志
  removeAccountLogs(accountId) {
    this.accountLogs.delete(accountId);
  }

  // 获取模块配置
  getModuleConfig() {
    return ModuleConfig;
  }

  // 获取级别配置
  getLevelConfig() {
    return LevelConfig;
  }
}

module.exports = new LogManager();
module.exports.LogModule = LogModule;
module.exports.LogLevel = LogLevel;
