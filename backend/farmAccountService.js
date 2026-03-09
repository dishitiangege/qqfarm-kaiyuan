/**
 * 农场账号服务模块
 * 处理农场账号的增删改查
 */

const { query, transaction } = require('./db');
const systemSettingsService = require('./systemSettingsService');
const { DEFAULT_ANTI_DETECTION_CONFIG } = require('./core/antiDetection');

class FarmAccountService {
  // 获取用户的所有农场账号
  async getUserAccounts(userId) {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const accounts = await query(
      `SELECT
        fa.id, fa.account_id, fa.name, fa.platform, fa.code,
        fa.config, fa.email, fa.farm_interval, fa.friend_interval,
        fa.status, fa.created_at, fa.updated_at,
        s.exp, s.coins, s.online_time, s.today_stats, s.land_status, s.friends,
        ds.total_online_time as daily_online_time,
        ds.total_exp_gained as daily_exp_gained,
        ds.total_harvest as daily_harvest,
        ds.total_steal as daily_steal,
        ds.total_weed as daily_weed,
        ds.total_bug as daily_bug,
        ds.total_water as daily_water
      FROM farm_accounts fa
      LEFT JOIN account_stats s ON fa.account_id = s.account_id
      LEFT JOIN daily_stats ds ON fa.account_id = ds.account_id AND ds.stats_date = ?
      WHERE fa.user_id = ? AND fa.is_deleted = FALSE
      ORDER BY fa.created_at DESC`,
      [today, userId]
    );

    // 延迟加载 accountManager 避免循环依赖
    const accountManager = require('./accountManagerWorker');

    // 延迟加载 dataCollector 避免循环依赖
    const dataCollector = require('./dataCollector');

    return accounts.map(acc => {
      // 检查实际运行状态
      const isActuallyRunning = accountManager.isAccountRunning(acc.account_id);
      const actualStatus = isActuallyRunning ? 'active' : (acc.status || 'offline');

      // 从 accountManager 内存获取实时数据（比文件更快，避免数据延迟）
      const realtimeStats = accountManager.getAccountRealtimeStats(acc.account_id);
      // 如果内存中没有，再从 dataCollector 文件获取
      const realTimeData = !realtimeStats ? dataCollector.getAccountData(acc.account_id) : null;
      const realTimeStats = realtimeStats || realTimeData?.stats || {};

      // 从数据库获取：总运行时间、当天经验值、好友列表
      const dbTodayStats = typeof acc.today_stats === 'string'
        ? JSON.parse(acc.today_stats)
        : (acc.today_stats || {});

      // 从数据库获取好友列表
      const dbFriends = typeof acc.friends === 'string'
        ? JSON.parse(acc.friends)
        : (acc.friends || []);

      return {
        id: acc.account_id,
        dbId: acc.id,
        name: acc.name,
        platform: acc.platform,
        code: acc.code,
        config: typeof acc.config === 'string' ? JSON.parse(acc.config) : acc.config,
        email: acc.email,
        farmInterval: acc.farm_interval,
        friendInterval: acc.friend_interval,
        isRunning: isActuallyRunning,
        status: actualStatus,
        stats: {
          // 总经验和金币：使用实时数据（从游戏服务器获取）
          exp: realTimeStats.exp || 0,
          coins: realTimeStats.coins || 0,
          // 数据库保存的数据：总运行时间
          onlineTime: acc.online_time || 0,
          // 实时数据：本次登录统计（本次会话累计）
          sessionStats: realTimeStats.sessionStats || { exp: 0, harvest: 0, steal: 0, water: 0, weed: 0, bug: 0, sell: 0, onlineTime: 0 },
          // 实时数据：今日累计统计（全天累计）
          todayStats: realTimeStats.todayStats || { exp: 0, harvest: 0, steal: 0, water: 0, weed: 0, bug: 0, sell: 0 },
          // 实时数据：土地状况
          landStatus: realTimeStats.landStatus || [],
          // 实时数据：操作限制
          operationLimits: realTimeStats.operationLimits || {},
          // 实时数据：任务系统
          tasks: realTimeStats.tasks || { total: 0, claimable: 0, list: [] },
          // 实时数据：背包
          bag: realTimeStats.bag || [],
        },
        // 数据库累计数据：当日累计统计（多次登录累加，从 daily_stats 表获取）
        dailyStats: {
          totalOnlineTime: acc.daily_online_time || 0,
          totalExpGained: acc.daily_exp_gained || 0,
          totalHarvest: acc.daily_harvest || 0,
          totalSteal: acc.daily_steal || 0,
          totalWeed: acc.daily_weed || 0,
          totalBug: acc.daily_bug || 0,
          totalWater: acc.daily_water || 0,
        },
        // 数据库保存的数据：好友列表
        friends: dbFriends,
        createdAt: acc.created_at,
        updatedAt: acc.updated_at
      };
    });
  }

  // 获取单个账号详情
  async getAccountById(accountId, userId = null) {
    let sql = `
      SELECT
        fa.*, s.exp, s.coins, s.online_time, s.today_stats,
        s.land_status, s.friends, s.bag, s.tasks
      FROM farm_accounts fa
      LEFT JOIN account_stats s ON fa.account_id = s.account_id
      WHERE fa.account_id = ? AND fa.is_deleted = FALSE
    `;
    const params = [accountId];

    if (userId) {
      sql += ' AND fa.user_id = ?';
      params.push(userId);
    }

    const accounts = await query(sql, params);
    return accounts[0] || null;
  }

  // 添加农场账号
  async addAccount(userId, accountData) {
    const {
      accountId,
      name,
      platform,
      code,
      config = {},
      email = '',
      farmInterval = 10,
      friendInterval = 10
    } = accountData;

    let accountConfig = config && typeof config === 'object' ? { ...config } : {};
    if (!accountConfig.antiDetection) {
      accountConfig.antiDetection = JSON.parse(JSON.stringify(DEFAULT_ANTI_DETECTION_CONFIG));
    }

    // 仅在新增账号且配置为空时，尝试加载系统默认反检测配置
    if (Object.keys(config || {}).length === 0) {
      try {
        const setting = await systemSettingsService.getSetting('anti_detection_default_config');
        if (setting) {
          const parsed = JSON.parse(setting);
          if (parsed && typeof parsed === 'object') {
            accountConfig = {
              ...accountConfig,
              antiDetection: {
                ...accountConfig.antiDetection,
                ...parsed
              }
            };
          }
        }
      } catch (_) {}
    }

    // 检查账号ID是否已存在
    const existing = await query(
      'SELECT id FROM farm_accounts WHERE account_id = ?',
      [accountId]
    );
    if (existing.length > 0) {
      throw new Error('账号ID已存在');
    }

    // 检查用户子账号数量限制
    const [userInfo] = await query(
      'SELECT role, max_accounts FROM users WHERE id = ?',
      [userId]
    );

    if (!userInfo) {
      throw new Error('用户不存在');
    }

    // 普通用户需要检查数量限制，管理员不限
    if (userInfo.role !== 'admin') {
      const [accountCount] = await query(
        'SELECT COUNT(*) as count FROM farm_accounts WHERE user_id = ? AND is_deleted = FALSE',
        [userId]
      );

      const maxAccounts = userInfo.max_accounts || 80;
      if (accountCount.count >= maxAccounts) {
        throw new Error(`已达到子账号数量上限(${maxAccounts}个)，请联系管理员提升上限或删除现有账号`);
      }
    }

    // 创建账号
    await query(
      `INSERT INTO farm_accounts 
       (user_id, account_id, name, platform, code, config, email, farm_interval, friend_interval, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'offline')`,
      [userId, accountId, name, platform, code, JSON.stringify(accountConfig), email, farmInterval, friendInterval]
    );

    // 创建统计记录
    await query(
      'INSERT INTO account_stats (account_id) VALUES (?)',
      [accountId]
    );

    return { accountId, name, platform };
  }

  // 更新账号配置
  async updateAccount(accountId, userId, updateData) {
    const allowedFields = ['name', 'config', 'email', 'farm_interval', 'friend_interval', 'code'];
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(field === 'config' ? JSON.stringify(updateData[field]) : updateData[field]);
      }
    }

    if (updates.length === 0) {
      return false;
    }

    values.push(accountId, userId);

    await query(
      `UPDATE farm_accounts SET ${updates.join(', ')}, updated_at = NOW() 
       WHERE account_id = ? AND user_id = ? AND is_deleted = FALSE`,
      values
    );

    return true;
  }

  // 删除农场账号（硬删除）
  async deleteAccount(accountId, userId) {
    // 先删除关联的统计数据
    await query('DELETE FROM account_stats WHERE account_id = ?', [accountId]);

    // 再删除农场账号
    await query(
      'DELETE FROM farm_accounts WHERE account_id = ? AND user_id = ?',
      [accountId, userId]
    );

    return true;
  }

  // 更新账号状态
  async updateAccountStatus(accountId, status) {
    await query(
      'UPDATE farm_accounts SET status = ? WHERE account_id = ?',
      [status, accountId]
    );
    return true;
  }

  // 更新账号统计数据
  async updateAccountStats(accountId, stats) {
    const {
      exp,
      coins,
      onlineTime,
      todayStats,
      landStatus,
      friends,
      bag,
      tasks
    } = stats;

    const updates = [];
    const values = [];

    if (exp !== undefined) { updates.push('exp = ?'); values.push(exp); }
    if (coins !== undefined) { updates.push('coins = ?'); values.push(coins); }
    if (onlineTime !== undefined) { updates.push('online_time = ?'); values.push(onlineTime); }
    if (todayStats !== undefined) { updates.push('today_stats = ?'); values.push(JSON.stringify(todayStats)); }
    if (landStatus !== undefined) { updates.push('land_status = ?'); values.push(JSON.stringify(landStatus)); }
    if (friends !== undefined) { updates.push('friends = ?'); values.push(JSON.stringify(friends)); }
    if (bag !== undefined) { updates.push('bag = ?'); values.push(JSON.stringify(bag)); }
    if (tasks !== undefined) { updates.push('tasks = ?'); values.push(JSON.stringify(tasks)); }

    if (updates.length === 0) {
      return false;
    }

    values.push(accountId);

    await query(
      `UPDATE account_stats SET ${updates.join(', ')}, last_update = NOW() WHERE account_id = ?`,
      values
    );

    return true;
  }

  // ========== 管理员功能 ==========

  // 获取所有账号（管理员）
  async getAllAccounts(page = 1, pageSize = 20, filters = {}) {
    // 确保参数是整数
    const pageNum = Number(page) || 1;
    const pageSizeNum = Number(pageSize) || 20;
    const offset = Number((pageNum - 1) * pageSizeNum);

    let whereClause = 'WHERE fa.is_deleted = FALSE';
    const params = [];

    if (filters.userId) {
      whereClause += ' AND fa.user_id = ?';
      params.push(Number(filters.userId));
    }

    if (filters.status) {
      whereClause += ' AND fa.status = ?';
      params.push(filters.status);
    }

    // 使用 connection.query 而不是 pool.execute 来避免 LIMIT/OFFSET 参数绑定问题
    const { getConnection } = require('./db');
    const connection = await getConnection();
    try {
      const [accounts] = await connection.query(
        `SELECT
          fa.*, u.username as owner_name,
          s.exp, s.coins, s.online_time
        FROM farm_accounts fa
        LEFT JOIN users u ON fa.user_id = u.id
        LEFT JOIN account_stats s ON fa.account_id = s.account_id
        ${whereClause}
        ORDER BY fa.created_at DESC
        LIMIT ${pageSizeNum} OFFSET ${offset}`
      );

      const [countResult] = await connection.query(
        `SELECT COUNT(*) as total FROM farm_accounts fa ${whereClause}`,
        params
      );

      connection.release();

      return {
        list: accounts,
        total: countResult[0].total,
        page: pageNum,
        pageSize: pageSizeNum
      };
    } catch (error) {
      connection.release();
      throw error;
    }
  }

  // 管理员删除任意账号（硬删除）
  async adminDeleteAccount(accountId) {
    // 先删除关联的每日统计数据（有外键约束）
    await query('DELETE FROM daily_stats WHERE account_id = ?', [accountId]);

    // 再删除关联的统计数据
    await query('DELETE FROM account_stats WHERE account_id = ?', [accountId]);

    // 最后删除农场账号
    const result = await query(
      'DELETE FROM farm_accounts WHERE account_id = ?',
      [accountId]
    );

    console.log(`[管理员删除账号] ${accountId}, 影响行数:`, result.affectedRows);
    return result.affectedRows > 0;
  }

  // 管理员修改任意账号
  async adminUpdateAccount(accountId, updateData) {
    const allowedFields = ['name', 'config', 'email', 'farm_interval', 'friend_interval', 'status'];
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(field === 'config' ? JSON.stringify(updateData[field]) : updateData[field]);
      }
    }

    if (updates.length === 0) {
      return false;
    }

    values.push(accountId);

    await query(
      `UPDATE farm_accounts SET ${updates.join(', ')}, updated_at = NOW() WHERE account_id = ?`,
      values
    );

    return true;
  }

  // 停止用户所有正在运行的账号（用于冻结/删除用户时）
  async stopUserAccounts(userId) {
    // 获取用户所有正在运行的账号
    const accounts = await query(
      `SELECT account_id FROM farm_accounts 
       WHERE user_id = ? AND status = 'active'`,
      [userId]
    );

    if (accounts.length === 0) {
      return { stopped: 0, accounts: [] };
    }

    // 延迟加载 accountManager 避免循环依赖
    const accountManager = require('./accountManagerWorker');

    const stoppedAccounts = [];
    for (const acc of accounts) {
      const accountId = acc.account_id;
      // 检查账号是否正在运行
      if (accountManager.isAccountRunning(accountId)) {
        accountManager.stopAccount(accountId, 'user_frozen');
        stoppedAccounts.push(accountId);
      }
      // 更新数据库状态为离线
      await query(
        "UPDATE farm_accounts SET status = 'offline' WHERE account_id = ?",
        [accountId]
      );
    }

    console.log(`[FarmAccountService] 已停止用户 ${userId} 的 ${stoppedAccounts.length} 个账号`);
    return { stopped: stoppedAccounts.length, accounts: stoppedAccounts };
  }

  // ========== 土地管理功能 ==========

  /**
   * 解锁土地
   * @param {string} code - 农场账号code
   * @param {number} landId - 土地ID
   * @returns {Promise<Object>} 解锁结果
   */
  async unlockLand(code, landId) {
    try {
      // 动态导入 protobuf 类型
      const types = require('./pb/types');
      const { sendMsgAsync, toLong, toNum } = require('./pb/client');

      const body = types.UnlockLandRequest.encode(
        types.UnlockLandRequest.create({ land_id: toLong(landId) })
      ).finish();

      const { body: replyBody } = await sendMsgAsync(code, 'gamepb.plantpb.PlantService', 'UnlockLand', body);
      const reply = types.UnlockLandReply.decode(replyBody);

      return {
        success: true,
        land: reply.land ? {
          id: toNum(reply.land.id),
          level: toNum(reply.land.level),
          unlocked: reply.land.unlocked,
        } : null,
      };
    } catch (error) {
      console.error(`[FarmAccountService] 解锁土地#${landId} 失败:`, error.message);
      throw error;
    }
  }

  /**
   * 升级土地
   * @param {string} code - 农场账号code
   * @param {number} landId - 土地ID
   * @returns {Promise<Object>} 升级结果
   */
  async upgradeLand(code, landId) {
    try {
      // 动态导入 protobuf 类型
      const types = require('./pb/types');
      const { sendMsgAsync, toLong, toNum } = require('./pb/client');

      const body = types.UpgradeLandRequest.encode(
        types.UpgradeLandRequest.create({ land_id: toLong(landId) })
      ).finish();

      const { body: replyBody } = await sendMsgAsync(code, 'gamepb.plantpb.PlantService', 'UpgradeLand', body);
      const reply = types.UpgradeLandReply.decode(replyBody);

      return {
        success: true,
        land: reply.land ? {
          id: toNum(reply.land.id),
          level: toNum(reply.land.level),
          unlocked: reply.land.unlocked,
        } : null,
      };
    } catch (error) {
      console.error(`[FarmAccountService] 升级土地#${landId} 失败:`, error.message);
      throw error;
    }
  }
}

module.exports = new FarmAccountService();
