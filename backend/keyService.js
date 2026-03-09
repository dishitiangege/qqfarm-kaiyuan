const { query } = require('./db');
const crypto = require('crypto');
const farmAccountService = require('./farmAccountService');

class KeyService {
  // 生成随机密钥
  generateKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  // 创建密钥（管理员）
  async createKey(adminId, expiresAt, assignedUserId = null) {
    const keyValue = this.generateKey();

    const result = await query(
      `INSERT INTO registration_keys (key_value, expires_at, assigned_user_id, created_by)
       VALUES (?, ?, ?, ?)`,
      [keyValue, expiresAt, assignedUserId, adminId]
    );

    return {
      id: result.insertId,
      key: keyValue,
      expiresAt,
      assignedUserId
    };
  }

  // 获取所有密钥（管理员）
  async getAllKeys(page = 1, pageSize = 20) {
    // 确保参数是整数 - 使用 Number() 强制转换
    const pageNum = Number(page) || 1;
    const pageSizeNum = Number(pageSize) || 20;
    const offset = Number((pageNum - 1) * pageSizeNum);

    console.log('[KeyService] getAllKeys 参数:', { page, pageSize, pageNum, pageSizeNum, offset });

    // 使用 connection.query 而不是 pool.execute 来避免参数绑定问题
    const { getConnection } = require('./db');
    const connection = await getConnection();
    try {
      const [keys] = await connection.query(
        `SELECT
          rk.*,
          creator.username as created_by_name,
          assigned.username as assigned_user_name,
          used.username as used_by_user_name,
          used.status as used_by_user_status,
          used.max_accounts as used_by_user_max_accounts,
          used.upgrade_expires_at as used_by_user_upgrade_expires
        FROM registration_keys rk
        LEFT JOIN users creator ON rk.created_by = creator.id
        LEFT JOIN users assigned ON rk.assigned_user_id = assigned.id
        LEFT JOIN users used ON rk.used_by_user_id = used.id
        ORDER BY rk.created_at DESC
        LIMIT ${pageSizeNum} OFFSET ${offset}`
      );

      const [countResult] = await connection.query(
        'SELECT COUNT(*) as total FROM registration_keys'
      );

      return {
        list: keys.map(k => {
          const now = new Date();
          const isExpired = new Date(k.expires_at) < now;
          const isUsedByDeletedUser = k.used_by_user_status === 'deleted';
          const hasUpgradeExpiry = k.used_by_user_upgrade_expires && new Date(k.used_by_user_upgrade_expires) > now;

          // 判断是否可以安全删除
          // 1. 未使用的密钥可以删除
          // 2. 被已删除用户使用的密钥可以删除
          // 3. 已过期且没有升级权益的密钥可以删除
          const canSafelyDelete = !k.is_used ||
                                  isUsedByDeletedUser ||
                                  (isExpired && !hasUpgradeExpiry);

          return {
            id: k.id,
            key: k.key_value,
            expiresAt: k.expires_at,
            isUsed: k.is_used,
            usedByUserId: k.used_by_user_id,
            usedByUserName: k.used_by_user_name,
            usedByUserStatus: k.used_by_user_status,
            usedByUserMaxAccounts: k.used_by_user_max_accounts,
            usedByUserUpgradeExpires: k.used_by_user_upgrade_expires,
            hasUpgradeExpiry,
            usedAt: k.used_at,
            assignedUserId: k.assigned_user_id,
            assignedUserName: k.assigned_user_name,
            createdAt: k.created_at,
            createdBy: k.created_by_name,
            canSafelyDelete,
            isExpired
          };
        }),
        total: countResult[0].total,
        page: pageNum,
        pageSize: pageSizeNum
      };
    } finally {
      connection.release();
    }
  }

  // 验证密钥是否有效
  async validateKey(keyValue, userId = null) {
    const keys = await query(
      `SELECT * FROM registration_keys WHERE key_value = ?`,
      [keyValue]
    );

    if (!keys || keys.length === 0) {
      return { valid: false, message: '密钥不存在' };
    }

    const key = keys[0];
    if (!key) {
      return { valid: false, message: '密钥数据异常' };
    }

    // 检查是否已被使用
    if (key.is_used) {
      return { valid: false, message: '密钥已被使用' };
    }

    // 检查是否过期
    if (new Date(key.expires_at) < new Date()) {
      return { valid: false, message: '密钥已过期' };
    }

    // 检查是否指定了特定用户
    if (key.assigned_user_id && key.assigned_user_id !== userId) {
      return { valid: false, message: '该密钥不适用于此用户' };
    }

    return { valid: true, keyId: key.id, expiresAt: key.expires_at };
  }

  // 使用密钥（注册时）
  async useKey(keyValue, userId) {
    const validation = await this.validateKey(keyValue);

    if (!validation.valid) {
      throw new Error(validation.message);
    }

    // 标记密钥为已使用
    await query(
      `UPDATE registration_keys
       SET is_used = TRUE, used_by_user_id = ?, used_at = NOW()
       WHERE key_value = ?`,
      [userId, keyValue]
    );

    // 更新用户绑定的密钥
    await query(
      `UPDATE users
       SET bound_key_id = ?, key_expires_at = ?
       WHERE id = ?`,
      [validation.keyId, validation.expiresAt, userId]
    );

    return true;
  }

  // 更换用户密钥
  async changeUserKey(userId, newKeyValue, adminId = null) {
    // 验证新密钥
    const validation = await this.validateKey(newKeyValue, userId);

    if (!validation.valid) {
      throw new Error(validation.message);
    }

    // 获取用户当前绑定的密钥
    const users = await query(
      'SELECT bound_key_id FROM users WHERE id = ?',
      [userId]
    );

    const oldKeyId = users[0]?.bound_key_id;

    // 如果之前有密钥，标记为未使用（可选，根据业务需求）
    if (oldKeyId) {
      await query(
        `UPDATE registration_keys
         SET is_used = FALSE, used_by_user_id = NULL, used_at = NULL
         WHERE id = ?`,
        [oldKeyId]
      );
    }

    // 标记新密钥为已使用
    await query(
      `UPDATE registration_keys
       SET is_used = TRUE, used_by_user_id = ?, used_at = NOW()
       WHERE key_value = ?`,
      [userId, newKeyValue]
    );

    // 更新用户绑定的密钥
    await query(
      `UPDATE users
       SET bound_key_id = ?, key_expires_at = ?
       WHERE id = ?`,
      [validation.keyId, validation.expiresAt, userId]
    );

    return true;
  }

  // 检查用户密钥是否过期
  async checkUserKeyExpired(userId) {
    const users = await query(
      `SELECT bound_key_id, key_expires_at, status
       FROM users WHERE id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return { expired: true, message: '用户不存在' };
    }

    const user = users[0];

    // 管理员不需要检查密钥
    if (user.role === 'admin') {
      return { expired: false };
    }

    // 检查是否有绑定的密钥
    if (!user.bound_key_id || !user.key_expires_at) {
      return { expired: true, message: '未绑定有效密钥' };
    }

    // 检查密钥是否过期
    if (new Date(user.key_expires_at) < new Date()) {
      // 自动冻结用户
      await query(
        "UPDATE users SET status = 'frozen' WHERE id = ?",
        [userId]
      );
      return { expired: true, message: '密钥已过期，账号已被冻结' };
    }

    return { expired: false };
  }

  // 获取用户当前绑定的密钥信息
  async getUserKeyInfo(userId) {
    const users = await query(
      `SELECT
        u.bound_key_id,
        u.key_expires_at,
        rk.key_value,
        rk.expires_at as key_expires
      FROM users u
      LEFT JOIN registration_keys rk ON u.bound_key_id = rk.id
      WHERE u.id = ?`,
      [userId]
    );

    if (users.length === 0 || !users[0].bound_key_id) {
      return null;
    }

    const user = users[0];
    return {
      keyId: user.bound_key_id,
      key: user.key_value,
      expiresAt: user.key_expires_at,
      isExpired: new Date(user.key_expires_at) < new Date()
    };
  }

  // 管理员直接更换用户密钥（不需要验证密钥有效性）
  async adminChangeUserKey(userId, newKeyValue) {
    // 先验证新密钥
    const validation = await this.validateKey(newKeyValue, userId);

    if (!validation.valid) {
      throw new Error(validation.message);
    }

    return this.changeUserKey(userId, newKeyValue);
  }

  // 删除单个密钥
  async deleteKey(keyId) {
    // 先检查密钥是否存在
    const keys = await query(
      'SELECT * FROM registration_keys WHERE id = ?',
      [keyId]
    );

    if (keys.length === 0) {
      throw new Error('密钥不存在');
    }

    const key = keys[0];

    // 清理所有引用该密钥的用户的 bound_key_id
    // 这包括已使用和未使用的密钥
    // 注意：不修改已删除用户(status = 'deleted')的状态
    await query(
      `UPDATE users
       SET bound_key_id = NULL
       WHERE bound_key_id = ?`,
      [keyId]
    );

    // 如果密钥已被使用，冻结使用该密钥的用户
    // 注意：不修改已删除用户(status = 'deleted')或管理员(role = 'admin')的状态
    if (key.is_used && key.used_by_user_id) {
      await query(
        `UPDATE users
         SET status = 'frozen', frozen_reason = 'key_deleted', key_expires_at = NULL
         WHERE id = ?
         AND status != 'deleted'
         AND role != 'admin'`,
        [key.used_by_user_id]
      );

      console.log(`[密钥服务] 密钥 ${keyId} 被删除，已冻结使用它的用户 ${key.used_by_user_id}`);
    }

    // 删除密钥
    await query(
      'DELETE FROM registration_keys WHERE id = ?',
      [keyId]
    );

    return { success: true };
  }

  // 批量删除密钥
  async deleteKeysBatch(keyIds) {
    const results = {
      deletedCount: 0,
      failedIds: [],
      frozenUsers: []
    };

    for (const keyId of keyIds) {
      try {
        // 先检查密钥是否存在
        const keys = await query(
          'SELECT * FROM registration_keys WHERE id = ?',
          [keyId]
        );

        if (keys.length === 0) {
          results.failedIds.push({ id: keyId, reason: '密钥不存在' });
          continue;
        }

        const key = keys[0];

        // 清理所有引用该密钥的用户的 bound_key_id
        // 注意：不修改已删除用户(status = 'deleted')的状态
        await query(
          `UPDATE users
           SET bound_key_id = NULL
           WHERE bound_key_id = ?`,
          [keyId]
        );

        // 如果密钥已被使用，需要冻结用户
        // 注意：不修改已删除用户(status = 'deleted')或管理员(role = 'admin')的状态
        if (key.is_used && key.used_by_user_id) {
          await query(
            `UPDATE users
             SET status = 'frozen', frozen_reason = 'key_deleted', key_expires_at = NULL
             WHERE id = ?
             AND status != 'deleted'
             AND role != 'admin'`,
            [key.used_by_user_id]
          );

          results.frozenUsers.push({
            userId: key.used_by_user_id,
            keyId: keyId
          });

          console.log(`[密钥服务] 密钥 ${keyId} 被删除，已冻结使用它的用户 ${key.used_by_user_id}`);
        }

        // 删除密钥
        await query(
          'DELETE FROM registration_keys WHERE id = ?',
          [keyId]
        );

        results.deletedCount++;
      } catch (error) {
        console.error(`[密钥服务] 删除密钥 ${keyId} 失败:`, error);
        results.failedIds.push({ id: keyId, reason: error.message });
      }
    }

    return results;
  }

  // ========== 密钥到期提醒功能 ==========

  // 启动定时检查任务
  startExpiryCheckTask() {
    // 每30分钟检查一次
    const CHECK_INTERVAL = 30 * 60 * 1000; // 30分钟

    console.log('[密钥服务] 启动密钥到期检查任务，每30分钟检查一次');

    // 立即执行一次检查
    this.checkKeyExpiry();

    // 设置定时任务
    setInterval(() => {
      this.checkKeyExpiry();
    }, CHECK_INTERVAL);
  }

  // 检查即将到期的密钥并发送提醒，同时处理已过期密钥
  async checkKeyExpiry() {
    try {
      console.log('[密钥服务] 开始检查密钥到期情况...');

      // 获取所有有绑定密钥的普通用户（不包括管理员）
      const users = await query(
        `SELECT
          u.id,
          u.username,
          u.email,
          u.key_expires_at,
          u.status
        FROM users u
        WHERE u.bound_key_id IS NOT NULL
          AND u.key_expires_at IS NOT NULL
          AND u.role != 'admin'`
      );

      const now = new Date();
      const FIVE_HOURS = 5 * 60 * 60 * 1000; // 5小时的毫秒数

      for (const user of users) {
        const expiryDate = new Date(user.key_expires_at);
        const timeLeft = expiryDate - now;

        // 如果密钥已经过期
        if (timeLeft <= 0) {
          console.log(`[密钥服务] 用户 ${user.username} 的密钥已过期，正在处理...`);

          // 停止用户所有正在运行的子账号
          const result = await farmAccountService.stopUserAccounts(user.id);
          if (result.stopped > 0) {
            console.log(`[密钥服务] 已停止用户 ${user.username} 的 ${result.stopped} 个运行中的子账号`);
          }

          // 如果用户状态是active，自动冻结用户
          if (user.status === 'active') {
            await query(
              "UPDATE users SET status = 'frozen', frozen_reason = 'key_expired' WHERE id = ?",
              [user.id]
            );
            console.log(`[密钥服务] 用户 ${user.username} 因密钥过期已被自动冻结`);
          }

          continue;
        }

        // 如果距离到期时间在5小时以内，且尚未过期
        if (timeLeft <= FIVE_HOURS) {
          const hoursLeft = Math.ceil(timeLeft / (60 * 60 * 1000));

          console.log(`[密钥服务] 用户 ${user.username} 的密钥将在 ${hoursLeft} 小时后到期`);
        }
      }

      console.log('[密钥服务] 密钥到期检查完成');
    } catch (error) {
      console.error('[密钥服务] 检查密钥到期情况时出错:', error);
    }
  }
}

module.exports = new KeyService();
