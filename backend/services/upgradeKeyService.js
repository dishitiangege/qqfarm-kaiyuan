const crypto = require('crypto');
const { query, transaction } = require('../db');

class UpgradeKeyService {
  // 生成密钥
  generateKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  // 创建升级密钥
  async createUpgradeKey(keyType, adminId, customConfig = null) {
    // 定义不同等级密钥的配置
    const keyConfig = {
      level1: { maxAccounts: 2, extendDays: 15 },
      level2: { maxAccounts: 3, extendDays: 30 }
    };

    let config;
    if (keyType === 'custom' && customConfig) {
      // 自定义密钥类型
      config = {
        maxAccounts: customConfig.maxAccounts,
        extendDays: customConfig.extendDays
      };
    } else {
      config = keyConfig[keyType];
      if (!config) {
        throw new Error('无效的密钥等级');
      }
    }

    const keyValue = this.generateKey();

    const result = await query(
      `INSERT INTO upgrade_keys (key_value, key_type, max_accounts, extend_days, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [keyValue, keyType, config.maxAccounts, config.extendDays, adminId]
    );

    return {
      id: result.insertId,
      keyValue,
      keyType,
      maxAccounts: config.maxAccounts,
      extendDays: config.extendDays
    };
  }

  // 批量创建升级密钥
  async batchCreateUpgradeKeys(keyType, count, adminId, customConfig = null) {
    const keys = [];
    for (let i = 0; i < count; i++) {
      const key = await this.createUpgradeKey(keyType, adminId, customConfig);
      keys.push(key);
    }
    return keys;
  }

  // 验证升级密钥
  async validateUpgradeKey(keyValue) {
    const [key] = await query(
      'SELECT * FROM upgrade_keys WHERE key_value = ?',
      [keyValue]
    );

    if (!key) {
      return { valid: false, message: '密钥不存在' };
    }

    if (key.is_used) {
      return { valid: false, message: '密钥已被使用' };
    }

    return { 
      valid: true, 
      keyId: key.id,
      keyType: key.key_type,
      maxAccounts: key.max_accounts,
      extendDays: key.extend_days
    };
  }

  // 使用升级密钥
  async useUpgradeKey(userId, keyValue) {
    return await transaction(async (conn) => {
      // 1. 验证密钥
      const [key] = await conn.query(
        'SELECT * FROM upgrade_keys WHERE key_value = ? FOR UPDATE',
        [keyValue]
      );

      if (!key || key.length === 0) {
        throw new Error('密钥不存在');
      }

      const upgradeKey = key[0];

      if (upgradeKey.is_used) {
        throw new Error('密钥已被使用');
      }

      // 2. 获取用户信息
      const [userResult] = await conn.query(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      );

      if (!userResult || userResult.length === 0) {
        throw new Error('用户不存在');
      }

      const user = userResult[0];

      // 3. 检查用户是否已激活（必须有绑定的密钥）
      if (!user.bound_key_id) {
        throw new Error('用户未绑定激活密钥，请先使用注册密钥激活账号');
      }

      // 4. 检查是否是降级操作（二级密钥用户不能使用一级密钥）
      // 允许同级密钥累加有效期，只允许更高级别的密钥
      const currentMaxAccounts = user.max_accounts || 1;
      if (currentMaxAccounts > upgradeKey.max_accounts) {
        throw new Error(`您当前已有${currentMaxAccounts}个子账号上限，无法使用更低等级的密钥。请使用更高等级的密钥或等待当前权益到期后再使用。`);
      }

      // 5. 计算新的激活密钥过期时间（累加）
      const now = new Date();
      const currentExpiresAt = user.key_expires_at ? new Date(user.key_expires_at) : now;
      const baseTime = currentExpiresAt > now ? currentExpiresAt : now;
      const newExpiresAt = new Date(baseTime.getTime() + upgradeKey.extend_days * 24 * 60 * 60 * 1000);

      // 6. 计算升级权益到期时间（累加模式）
      // 如果已有升级权益，则在现有到期时间基础上延长；否则从现在起算
      const currentUpgradeExpiresAt = user.upgrade_expires_at ? new Date(user.upgrade_expires_at) : now;
      const upgradeBaseTime = currentUpgradeExpiresAt > now ? currentUpgradeExpiresAt : now;
      const newUpgradeExpiresAt = new Date(upgradeBaseTime.getTime() + upgradeKey.extend_days * 24 * 60 * 60 * 1000);

      // 7. 记录旧值
      const oldMaxAccounts = currentMaxAccounts;
      const oldExpiresAt = user.key_expires_at;
      const oldUpgradeExpiresAt = user.upgrade_expires_at;

      // 8. 更新用户表
      await conn.query(
        `UPDATE users 
         SET max_accounts = ?, 
             key_expires_at = ?,
             upgrade_expires_at = ?,
             status = 'active',
             frozen_reason = NULL,
             updated_at = NOW()
         WHERE id = ?`,
        [upgradeKey.max_accounts, newExpiresAt, newUpgradeExpiresAt, userId]
      );

      // 9. 标记密钥为已使用
      await conn.query(
        `UPDATE upgrade_keys 
         SET is_used = TRUE, 
             used_by_user_id = ?, 
             used_at = NOW() 
         WHERE id = ?`,
        [userId, upgradeKey.id]
      );

      // 10. 记录升级日志
      await conn.query(
        `INSERT INTO user_upgrade_logs
         (user_id, upgrade_key_id, key_type, old_max_accounts, new_max_accounts, old_expires_at, new_expires_at, extend_days)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, upgradeKey.id, upgradeKey.key_type, oldMaxAccounts, upgradeKey.max_accounts, oldUpgradeExpiresAt, newUpgradeExpiresAt, upgradeKey.extend_days]
      );

      return {
        success: true,
        keyType: upgradeKey.key_type,
        oldMaxAccounts,
        newMaxAccounts: upgradeKey.max_accounts,
        oldExpiresAt,
        newExpiresAt,
        oldUpgradeExpiresAt,
        newUpgradeExpiresAt,
        extendDays: upgradeKey.extend_days
      };
    });
  }

  // 管理员为用户使用升级密钥（无需用户自己输入）
  async adminUseUpgradeKey(userId, keyValue) {
    // 复用现有的 useUpgradeKey 逻辑，因为累加逻辑已经支持
    return await this.useUpgradeKey(userId, keyValue);
  }

  // 获取升级密钥列表（管理员用）
  async getUpgradeKeys(filters = {}) {
    let sql = `
      SELECT uk.*, 
             u.username as used_by_username,
             creator.username as created_by_username
      FROM upgrade_keys uk
      LEFT JOIN users u ON uk.used_by_user_id = u.id
      LEFT JOIN users creator ON uk.created_by = creator.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.keyType) {
      sql += ' AND uk.key_type = ?';
      params.push(filters.keyType);
    }

    if (filters.isUsed !== undefined) {
      sql += ' AND uk.is_used = ?';
      params.push(filters.isUsed);
    }

    sql += ' ORDER BY uk.created_at DESC';

    return await query(sql, params);
  }

  // 删除升级密钥
  async deleteUpgradeKey(keyId) {
    const [key] = await query(
      'SELECT * FROM upgrade_keys WHERE id = ?',
      [keyId]
    );

    if (!key) {
      throw new Error('密钥不存在');
    }

    if (key.is_used) {
      throw new Error('密钥已被使用，无法删除');
    }

    await query('DELETE FROM upgrade_keys WHERE id = ?', [keyId]);
    return { success: true };
  }

  // 获取用户的升级记录
  async getUserUpgradeLogs(userId) {
    return await query(
      `SELECT uul.*, uk.key_value, uk.extend_days
       FROM user_upgrade_logs uul
       JOIN upgrade_keys uk ON uul.upgrade_key_id = uk.id
       WHERE uul.user_id = ?
       ORDER BY uul.created_at DESC`,
      [userId]
    );
  }

  // 获取用户绑定的升级密钥信息
  async getUserUpgradeKeyInfo(userId) {
    // 获取用户使用的升级密钥
    const keys = await query(
      `SELECT uk.*, u.username as used_by_username
       FROM upgrade_keys uk
       LEFT JOIN users u ON uk.used_by_user_id = u.id
       WHERE uk.used_by_user_id = ?
       ORDER BY uk.used_at DESC`,
      [userId]
    );

    // 获取用户的升级记录
    const logs = await this.getUserUpgradeLogs(userId);

    return {
      keys: keys || [],
      logs: logs || []
    };
  }

  // 解绑用户的升级密钥（重置用户的升级状态）
  async unbindUserUpgradeKey(userId) {
    return await transaction(async (conn) => {
      // 1. 获取用户信息
      const [userResult] = await conn.query(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      );

      if (!userResult || userResult.length === 0) {
        throw new Error('用户不存在');
      }

      const user = userResult[0];

      // 2. 检查用户是否有升级密钥绑定
      if (!user.max_accounts || user.max_accounts <= 1) {
        throw new Error('该用户没有绑定升级密钥');
      }

      // 3. 获取该用户使用的所有升级密钥
      const [usedKeys] = await conn.query(
        'SELECT * FROM upgrade_keys WHERE used_by_user_id = ?',
        [userId]
      );

      // 4. 将所有已使用的升级密钥标记为未使用
      if (usedKeys && usedKeys.length > 0) {
        for (const key of usedKeys) {
          await conn.query(
            `UPDATE upgrade_keys
             SET is_used = FALSE,
                 used_by_user_id = NULL,
                 used_at = NULL
             WHERE id = ?`,
            [key.id]
          );
        }
      }

      // 5. 删除该用户的所有升级记录
      // 这样用户在自己的升级记录页面就看不到这些记录了
      await conn.query(
        'DELETE FROM user_upgrade_logs WHERE user_id = ?',
        [userId]
      );

      // 6. 重置用户的升级状态
      // 获取用户的激活密钥过期时间作为新的key_expires_at
      const [keyResult] = await conn.query(
        'SELECT expires_at FROM registration_keys WHERE id = ?',
        [user.bound_key_id]
      );

      const keyExpiresAt = keyResult && keyResult.length > 0
        ? keyResult[0].expires_at
        : user.key_expires_at;

      await conn.query(
        `UPDATE users
         SET max_accounts = 1,
             key_expires_at = ?,
             upgrade_expires_at = NULL,
             updated_at = NOW()
         WHERE id = ?`,
        [keyExpiresAt, userId]
      );

      return {
        success: true,
        resetKeysCount: usedKeys ? usedKeys.length : 0,
        oldMaxAccounts: user.max_accounts,
        newMaxAccounts: 1
      };
    });
  }

  // 修改升级密钥的有效期
  async updateKeyExtendDays(keyId, extendDays) {
    const [key] = await query(
      'SELECT * FROM upgrade_keys WHERE id = ?',
      [keyId]
    );

    if (!key) {
      throw new Error('密钥不存在');
    }

    if (key.is_used) {
      throw new Error('密钥已被使用，无法修改有效期');
    }

    // 根据新的有效期更新max_accounts
    const maxAccounts = extendDays >= 30 ? 3 : 2;

    await query(
      `UPDATE upgrade_keys
       SET extend_days = ?,
           max_accounts = ?
       WHERE id = ?`,
      [extendDays, maxAccounts, keyId]
    );

    return {
      id: keyId,
      extendDays,
      maxAccounts
    };
  }
}

module.exports = new UpgradeKeyService();