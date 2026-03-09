/**
 * 数据收集器 - 收集农场真实数据
 * 通过修改原始脚本，在运行时收集数据并保存到数据库
 */

const fs = require('fs');
const path = require('path');
const farmAccountService = require('./farmAccountService');

class DataCollector {
  constructor() {
    this.dataPath = path.join(__dirname, 'accountData.json');
    this.backupDir = path.join(__dirname, 'backups');
    this.maxBackups = 3; // 减少备份数量
    this.accountData = new Map();
    this.lastLoadTime = 0;
    this.loadDebounceMs = 5000; // 增加加载防抖时间
    this.saveDebounceTimer = null;
    this.saveDebounceMs = 10000; // 增加保存防抖时间
    this.pendingSave = false;
    this.maxCacheSize = 100; // 最大缓存账号数
    this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(this.dataPath)) {
        const content = fs.readFileSync(this.dataPath, 'utf8');
        // 检查文件内容是否为空
        if (!content.trim()) {
          console.log('[数据收集器] 数据文件为空，初始化新数据');
          this.accountData = new Map();
          return;
        }
        
        // 检查文件是否完整（JSON 通常以 } 或 ] 结尾）
        const trimmedContent = content.trim();
        const lastChar = trimmedContent.charAt(trimmedContent.length - 1);
        if (lastChar !== '}' && lastChar !== ']') {
          throw new Error('JSON 文件不完整，可能写入过程中断');
        }
        
        const data = JSON.parse(content);
        this.accountData = new Map(Object.entries(data));
        console.log('[数据收集器] 数据加载成功，共', this.accountData.size, '个账号');
      }
    } catch (error) {
      console.error('[数据收集器] 加载账号数据失败:', error.message);
      // 如果文件损坏，备份并创建新文件
      try {
        if (fs.existsSync(this.dataPath)) {
          // 确保备份目录存在
          if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
          }

          // 清理旧备份，只保留最近的 maxBackups 个
          this.cleanupOldBackups();

          // 创建新备份
          const backupPath = path.join(this.backupDir, `accountData.json.backup.${Date.now()}`);
          fs.renameSync(this.dataPath, backupPath);
          console.log(`[数据收集器] 已备份损坏的数据文件到: ${backupPath}`);
          console.log('[数据收集器] 建议：检查备份文件内容，如有需要可手动恢复');
        }
      } catch (backupError) {
        console.error('[数据收集器] 备份失败:', backupError.message);
      }
      // 初始化空数据
      this.accountData = new Map();
    }
  }

  saveData() {
    this.pendingSave = true;
    
    if (this.saveDebounceTimer) {
      return;
    }
    
    this.saveDebounceTimer = setTimeout(() => {
      this.saveDebounceTimer = null;
      if (this.pendingSave) {
        this._doSave();
        this.pendingSave = false;
      }
    }, this.saveDebounceMs);
  }

  _doSave() {
    try {
      const data = Object.fromEntries(this.accountData);
      const jsonContent = JSON.stringify(data, null, 2);
      
      const tempPath = `${this.dataPath}.tmp`;
      fs.writeFileSync(tempPath, jsonContent, 'utf8');
      
      const verifyContent = fs.readFileSync(tempPath, 'utf8');
      JSON.parse(verifyContent);
      
      fs.renameSync(tempPath, this.dataPath);
    } catch (error) {
      console.error('[数据收集器] 保存账号数据失败:', error.message);
      try {
        const tempPath = `${this.dataPath}.tmp`;
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (cleanupError) {
      }
    }
  }

  // 更新账号数据 - 同时保存到文件和数据库
  async updateAccountData(accountId, data) {
    // 0. 限制内存缓存大小
    if (!this.accountData.has(accountId) && this.accountData.size >= this.maxCacheSize) {
      // 删除最久未更新的账号数据
      let oldestKey = null;
      let oldestTime = Date.now();
      for (const [key, value] of this.accountData) {
        if (value.lastUpdate < oldestTime) {
          oldestTime = value.lastUpdate;
          oldestKey = key;
        }
      }
      if (oldestKey) {
        this.accountData.delete(oldestKey);
      }
    }

    // 1. 保存到内存和文件（原有逻辑）
    const existing = this.accountData.get(accountId) || {};
    // 深度合并 stats 对象，确保嵌套属性正确合并
    const updatedData = {
      ...existing,
      ...data,
      lastUpdate: Date.now()
    };
    // 特别处理 stats 对象：深度合并而不是替换
    if (data.stats && existing.stats) {
      updatedData.stats = {
        ...existing.stats,
        ...data.stats
      };
    }
    this.accountData.set(accountId, updatedData);
    this.saveData();

    // 2. 同步到数据库
    try {
      await this.syncToDatabase(accountId, data);
    } catch (error) {
      console.error(`[数据收集器] 同步到数据库失败:`, error.message);
    }
  }

  // 同步数据到数据库
  // 保存：总运行时间(onlineTime)、当天经验值(todayStats.exp)、好友列表(friends)
  // 其他概览数据实时获取，不保存到数据库
  async syncToDatabase(accountId, data) {
    const stats = {};

    // 保存总运行时间（支持 data.onlineTime 或 data.stats.onlineTime）
    if (data.onlineTime !== undefined) {
      stats.onlineTime = data.onlineTime;
    } else if (data.stats?.onlineTime !== undefined) {
      stats.onlineTime = data.stats.onlineTime;
    }

    // 保存当天经验值（从 todayStats 中提取）
    if (data.todayStats && typeof data.todayStats === 'object' && data.todayStats.exp !== undefined) {
      stats.todayStats = { exp: data.todayStats.exp };
    } else if (data.stats?.todayStats?.exp !== undefined) {
      stats.todayStats = { exp: data.stats.todayStats.exp };
    }

    // 保存好友列表
    if (data.friends !== undefined) stats.friends = data.friends;

    // 如果有数据需要更新
    if (Object.keys(stats).length > 0) {
      await farmAccountService.updateAccountStats(accountId, stats);
    }

    // 更新账号基本信息（名称）
    const accountUpdates = {};
    if (data.name !== undefined) accountUpdates.name = data.name;

    if (Object.keys(accountUpdates).length > 0) {
      await farmAccountService.adminUpdateAccount(accountId, accountUpdates);
    }
  }

  getAccountData(accountId) {
    const now = Date.now();
    if (now - this.lastLoadTime > this.loadDebounceMs) {
      this.loadData();
      this.lastLoadTime = now;
    }
    return this.accountData.get(accountId) || null;
  }

  // 获取所有账号数据
  getAllData() {
    return Object.fromEntries(this.accountData);
  }

  removeAccountData(accountId) {
    this.accountData.delete(accountId);
    this._doSave();
  }

  flush() {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
    if (this.pendingSave) {
      this._doSave();
      this.pendingSave = false;
    }
  }

  // 清理旧备份文件，只保留最近的 maxBackups 个
  cleanupOldBackups() {
    try {
      if (!fs.existsSync(this.backupDir)) {
        return;
      }

      // 获取所有备份文件
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('accountData.json.backup.'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          time: parseInt(file.split('.').pop()) || 0
        }))
        .sort((a, b) => b.time - a.time); // 按时间降序排列，最新的在前

      // 删除超出限制的备份
      if (files.length >= this.maxBackups) {
        const filesToDelete = files.slice(this.maxBackups - 1);
        for (const file of filesToDelete) {
          try {
            fs.unlinkSync(file.path);
            console.log(`[数据收集器] 已删除旧备份: ${file.name}`);
          } catch (err) {
            console.error(`[数据收集器] 删除旧备份失败: ${file.name}`, err.message);
          }
        }
      }
    } catch (error) {
      console.error('[数据收集器] 清理旧备份失败:', error.message);
    }
  }
}

module.exports = new DataCollector();
