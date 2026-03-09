/**
 * 每日统计服务 - 批量写入 + 定时持久化
 * 减少数据库写入频次，提高性能
 */

const { query } = require('../db');

class DailyStatsService {
  constructor() {
    // 内存缓存：accountId -> stats
    this.cache = new Map();
    // 脏数据标记：accountId -> boolean
    this.dirty = new Set();
    // 定时器
    this.flushTimer = null;
    // 配置
    this.flushInterval = 5 * 60 * 1000; // 5分钟刷盘一次
    this.startFlushTimer();
  }

  /**
   * 增加统计数据（只写内存，不直接写库）
   * @param {string} accountId - 账号ID
   * @param {Object} data - 要增加的统计数据 { exp, harvest, steal, water, weed, bug, sell }
   */
  async increment(accountId, data) {
    const today = this.getTodayDate();
    const cacheKey = `${accountId}:${today}`;

    // 获取或创建缓存
    if (!this.cache.has(cacheKey)) {
      // 先从数据库加载今日已有数据
      const existing = await this.loadFromDB(accountId, today);
      this.cache.set(cacheKey, existing);
    }

    const stats = this.cache.get(cacheKey);

    // 累加数据
    if (data.exp) stats.exp += data.exp;
    if (data.harvest) stats.harvest += data.harvest;
    if (data.steal) stats.steal += data.steal;
    if (data.water) stats.water += data.water;
    if (data.weed) stats.weed += data.weed;
    if (data.bug) stats.bug += data.bug;
    if (data.sell) stats.sell += data.sell;

    // 标记为脏数据
    this.dirty.add(cacheKey);
  }

  /**
   * 获取今日统计（优先从缓存读）
   * @param {string} accountId - 账号ID
   * @returns {Object} 今日统计数据
   */
  async getTodayStats(accountId) {
    const today = this.getTodayDate();
    const cacheKey = `${accountId}:${today}`;

    // 如果缓存中有，直接返回
    if (this.cache.has(cacheKey)) {
      return { ...this.cache.get(cacheKey) };
    }

    // 否则从数据库加载
    const stats = await this.loadFromDB(accountId, today);
    this.cache.set(cacheKey, stats);
    return { ...stats };
  }

  /**
   * 从数据库加载今日统计
   * @param {string} accountId - 账号ID
   * @param {string} date - 日期字符串 YYYY-MM-DD
   * @returns {Object} 统计数据
   */
  async loadFromDB(accountId, date) {
    try {
      const [row] = await query(`
        SELECT 
          COALESCE(total_exp_gained, 0) as exp,
          COALESCE(total_harvest, 0) as harvest,
          COALESCE(total_steal, 0) as steal,
          COALESCE(total_water, 0) as water,
          COALESCE(total_weed, 0) as weed,
          COALESCE(total_bug, 0) as bug,
          COALESCE(total_sell_gold, 0) as sell
        FROM daily_stats
        WHERE account_id = ? AND stats_date = ?
      `, [accountId, date]);

      return row || { exp: 0, harvest: 0, steal: 0, water: 0, weed: 0, bug: 0, sell: 0 };
    } catch (error) {
      console.error(`[DailyStats] 加载数据失败 ${accountId}:`, error.message);
      return { exp: 0, harvest: 0, steal: 0, water: 0, weed: 0, bug: 0, sell: 0 };
    }
  }

  /**
   * 启动定时刷盘
   */
  startFlushTimer() {
    if (this.flushTimer) return;

    this.flushTimer = setInterval(() => {
      this.flushAll();
    }, this.flushInterval);

    console.log(`[DailyStats] 定时刷盘已启动，间隔 ${this.flushInterval}ms`);
  }

  /**
   * 刷入单条数据到数据库
   * @param {string} cacheKey - 缓存键 accountId:date
   */
  async flushOne(cacheKey) {
    if (!this.dirty.has(cacheKey)) return;

    const [accountId, date] = cacheKey.split(':');
    const stats = this.cache.get(cacheKey);

    if (!stats) return;

    try {
      await query(`
        INSERT INTO daily_stats 
          (account_id, stats_date, total_exp_gained, total_harvest, total_steal, 
           total_water, total_weed, total_bug, total_sell_gold)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          total_exp_gained = VALUES(total_exp_gained),
          total_harvest = VALUES(total_harvest),
          total_steal = VALUES(total_steal),
          total_water = VALUES(total_water),
          total_weed = VALUES(total_weed),
          total_bug = VALUES(total_bug),
          total_sell_gold = VALUES(total_sell_gold),
          last_update = NOW()
      `, [
        accountId, date,
        stats.exp, stats.harvest, stats.steal,
        stats.water, stats.weed, stats.bug, stats.sell
      ]);

      this.dirty.delete(cacheKey);
    } catch (error) {
      console.error(`[DailyStats] 刷盘失败 ${cacheKey}:`, error.message);
    }
  }

  /**
   * 刷入所有脏数据
   */
  async flushAll() {
    if (this.dirty.size === 0) return;

    const keys = Array.from(this.dirty);
    console.log(`[DailyStats] 批量刷盘，${keys.length} 个账号`);

    for (const cacheKey of keys) {
      await this.flushOne(cacheKey);
    }
  }

  /**
   * 强制刷盘（用于进程退出前）
   */
  async forceFlush() {
    if (this.dirty.size === 0) return;

    console.log(`[DailyStats] 强制刷盘，${this.dirty.size} 个账号...`);
    await this.flushAll();
    console.log('[DailyStats] 强制刷盘完成');
  }

  /**
   * 清理过期缓存（保留最近3天）
   */
  cleanupCache() {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const cutoffDate = threeDaysAgo.toISOString().split('T')[0];

    let cleanedCount = 0;
    for (const cacheKey of this.cache.keys()) {
      const [, date] = cacheKey.split(':');
      if (date < cutoffDate) {
        // 先刷盘再删除
        if (this.dirty.has(cacheKey)) {
          this.flushOne(cacheKey);
        }
        this.cache.delete(cacheKey);
        this.dirty.delete(cacheKey);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[DailyStats] 清理 ${cleanedCount} 个过期缓存`);
    }
  }

  /**
   * 获取今日日期字符串
   * @returns {string} YYYY-MM-DD
   */
  getTodayDate() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * 停止服务
   */
  stop() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

// 导出单例
module.exports = new DailyStatsService();
