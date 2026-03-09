/**
 * 用户服务模块
 * 处理用户认证、注册、管理等
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query, transaction } = require('./db');
const keyService = require('./keyService');
const farmAccountService = require('./farmAccountService');

// JWT 密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES = '3d'; // Token 有效期 3 天

class UserService {
  // 注册用户（需要密钥，需要管理员审批）
  async register(username, password, email = null, registrationKey = null, skipApproval = false) {
    // 检查用户名是否已存在（排除已删除的用户）
    const existing = await query('SELECT id FROM users WHERE username = ? AND status != "deleted"', [username]);
    if (existing.length > 0) {
      throw new Error('用户名已存在');
    }

    // 验证注册密钥
    if (!registrationKey) {
      throw new Error('请输入注册密钥');
    }

    const keyValidation = await keyService.validateKey(registrationKey);
    if (!keyValidation.valid) {
      throw new Error(keyValidation.message);
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户（状态根据 skipApproval 决定：true 为 active，false 为 pending）
    const userStatus = skipApproval ? 'active' : 'pending';
    const result = await query(
      'INSERT INTO users (username, password, email, role, status, bound_key_id, key_expires_at) VALUES (?, ?, ?, "user", ?, ?, ?)',
      [username, hashedPassword, email, userStatus, keyValidation.keyId, keyValidation.expiresAt]
    );

    if (!result || !result.insertId) {
      throw new Error('用户创建失败，请稍后重试');
    }

    // 标记密钥为已使用
    await query(
      'UPDATE registration_keys SET is_used = TRUE, used_by_user_id = ?, used_at = NOW() WHERE id = ?',
      [result.insertId, keyValidation.keyId]
    );

    return {
      id: result.insertId,
      username,
      email,
      role: 'user',
      status: userStatus
    };
  }

  // 用户登录
  async login(username, password) {
    // 查询用户
    const users = await query(
      'SELECT id, username, password, email, role, status, frozen_reason, last_login_at, bound_key_id, key_expires_at FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      throw new Error('用户名或密码错误');
    }

    const user = users[0];
    console.log(`[登录] 用户 ${username} 尝试登录，数据库密码哈希: ${user.password.substring(0, 20)}...`);

    // 验证密码
    const isValid = await bcrypt.compare(password, user.password);
    console.log(`[登录] 密码验证结果: ${isValid}`);
    if (!isValid) {
      throw new Error('用户名或密码错误');
    }

    // 检查账号状态
    if (user.status === 'deleted') {
      throw new Error('账号不存在');
    }

    // 检查是否待审批
    if (user.status === 'pending') {
      const error = new Error('账号正在等待管理员审批，请耐心等待');
      error.code = 'PENDING_APPROVAL';
      throw error;
    }

    // 检查密钥状态（仅普通用户）
    if (user.role !== 'admin') {
      // 检查密钥是否过期
      if (user.key_expires_at && new Date(user.key_expires_at) < new Date()) {
        // 密钥已过期，自动冻结并记录原因
        await query("UPDATE users SET status = 'frozen', frozen_reason = 'key_expired' WHERE id = ?", [user.id]);
        user.status = 'frozen';
        user.frozen_reason = 'key_expired';

        // 停止用户所有正在运行的子账号
        const result = await farmAccountService.stopUserAccounts(user.id);
        if (result.stopped > 0) {
          console.log(`[登录] 用户 ${username} 密钥已过期，已停止 ${result.stopped} 个运行中的子账号`);
        }
      }

      // 如果账号被冻结，判断冻结原因
      if (user.status === 'frozen') {
        // 只有被管理员冻结的用户才不允许自助激活
        if (user.frozen_reason === 'admin') {
          const error = new Error('账号已被管理员冻结，请联系管理员');
          error.code = 'ACCOUNT_FROZEN';
          throw error;
        } else {
          // 密钥过期或被删除，允许重新输入密钥激活
          const error = new Error('密钥已失效，请重新输入新的注册密钥');
          error.code = 'KEY_REQUIRED';
          error.userId = user.id;
          throw error;
        }
      }

      // 检查是否有绑定密钥
      if (!user.bound_key_id || !user.key_expires_at) {
        const error = new Error('账号未绑定有效密钥');
        error.code = 'KEY_REQUIRED';
        error.userId = user.id;
        throw error;
      }
    } else if (user.status === 'frozen') {
      // 管理员被冻结
      const error = new Error('账号已被冻结，请联系管理员');
      error.code = 'ACCOUNT_FROZEN';
      throw error;
    }

    // 更新最后登录时间
    await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    // 生成 JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    };
  }

  // 验证 Token
  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('Token 无效或已过期');
    }
  }

  // 使用新密钥重新激活账户
  async reactivateUser(userId, registrationKey) {
    // 查询用户
    const users = await query(
      'SELECT id, username, role, status, bound_key_id FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      throw new Error('用户不存在');
    }

    const user = users[0];

    // 检查用户状态
    if (user.status === 'deleted') {
      throw new Error('账号不存在');
    }

    // 只有普通用户可以自助激活
    if (user.role === 'admin') {
      throw new Error('管理员账号无法自助激活，请联系管理员');
    }

    // 检查用户是否真的需要重新激活
    // 如果用户状态正常，不需要重新激活
    if (user.status === 'active' && user.bound_key_id) {
      throw new Error('账号状态正常，无需重新激活');
    }

    // 验证新密钥
    const keyValidation = await keyService.validateKey(registrationKey);
    if (!keyValidation.valid) {
      throw new Error(keyValidation.message);
    }

    // 如果之前有绑定的密钥，标记为未使用
    if (user.bound_key_id) {
      await query(
        'UPDATE registration_keys SET is_used = FALSE, used_by_user_id = NULL, used_at = NULL WHERE id = ?',
        [user.bound_key_id]
      );
    }

    // 更新用户信息：绑定新密钥并激活账户
    await query(
      'UPDATE users SET status = "active", bound_key_id = ?, key_expires_at = ? WHERE id = ?',
      [keyValidation.keyId, keyValidation.expiresAt, userId]
    );

    // 标记新密钥为已使用
    await query(
      'UPDATE registration_keys SET is_used = TRUE, used_by_user_id = ?, used_at = NOW() WHERE id = ?',
      [userId, keyValidation.keyId]
    );

    // 生成 JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    };
  }

  // 获取用户信息
  async getUserById(userId) {
    const users = await query(
      'SELECT id, username, email, role, status, max_accounts, key_expires_at, upgrade_expires_at, created_at, last_login_at FROM users WHERE id = ?',
      [userId]
    );
    return users[0] || null;
  }

  // 修改密码
  async changePassword(userId, oldPassword, newPassword) {
    // 获取用户
    const users = await query('SELECT password FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      throw new Error('用户不存在');
    }

    // 验证旧密码
    const isValid = await bcrypt.compare(oldPassword, users[0].password);
    if (!isValid) {
      throw new Error('原密码错误');
    }

    // 更新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

    return true;
  }

  // ========== 管理员功能 ==========

  // 获取所有用户（管理员）
  async getAllUsers(page = 1, pageSize = 20) {
    // 确保参数是整数 - 使用 Number() 强制转换
    const pageNum = Number(page) || 1;
    const pageSizeNum = Number(pageSize) || 20;
    const offset = Number((pageNum - 1) * pageSizeNum);

    console.log('[UserService] getAllUsers 参数:', { page, pageSize, pageNum, pageSizeNum, offset });

    // 使用 connection.query 而不是 pool.execute 来避免参数绑定问题
    const { getConnection } = require('./db');
    const connection = await getConnection();
    try {
      const [users] = await connection.query(
        `SELECT
          u.id, u.username, u.email, u.role, u.status, u.created_at, u.last_login_at,
          u.bound_key_id, u.key_expires_at, u.max_accounts,
          rk.key_value as bound_key,
          (SELECT COUNT(*) FROM farm_accounts fa WHERE fa.user_id = u.id AND fa.is_deleted = FALSE) as account_count
        FROM users u
        LEFT JOIN registration_keys rk ON u.bound_key_id = rk.id
        WHERE u.status != 'deleted'
        ORDER BY u.created_at DESC
        LIMIT ${pageSizeNum} OFFSET ${offset}`
      );

      const [countResult] = await connection.query(
        "SELECT COUNT(*) as total FROM users WHERE status != 'deleted'"
      );

      connection.release();

      return {
        list: users.map(u => ({
          ...u,
          max_accounts: u.max_accounts || 1,
          keyExpiresAt: u.key_expires_at,
          isKeyExpired: u.key_expires_at ? new Date(u.key_expires_at) < new Date() : false
        })),
        total: countResult[0].total,
        page: pageNum,
        pageSize: pageSizeNum
      };
    } catch (error) {
      connection.release();
      throw error;
    }
  }

  // 冻结用户（管理员）
  async freezeUser(userId) {
    // 先停止用户所有正在运行的账号
    const result = await farmAccountService.stopUserAccounts(userId);
    if (result.stopped > 0) {
      console.log(`[UserService] 冻结用户 ${userId}，已停止 ${result.stopped} 个运行中的账号`);
    }

    await query("UPDATE users SET status = 'frozen', frozen_reason = 'admin' WHERE id = ?", [userId]);
    return true;
  }

  // 解冻用户（管理员）
  async unfreezeUser(userId) {
    await query("UPDATE users SET status = 'active', frozen_reason = NULL WHERE id = ?", [userId]);
    return true;
  }

  // 删除用户（管理员）- 彻底删除用户及其所有相关数据
  async deleteUser(userId) {
    return await transaction(async (conn) => {
      console.log(`[UserService] 开始彻底删除用户 ${userId}...`);

      // 1. 获取用户信息（用于后续清理）
      const [users] = await conn.query(
        'SELECT bound_key_id FROM users WHERE id = ?',
        [userId]
      );

      if (!users || users.length === 0) {
        throw new Error('用户不存在');
      }

      const user = users[0];

      // 2. 停止用户所有正在运行的账号
      const [accounts] = await conn.query(
        'SELECT account_id FROM farm_accounts WHERE user_id = ? AND is_deleted = FALSE',
        [userId]
      );

      // 延迟加载 accountManager 避免循环依赖
      const accountManager = require('./accountManagerWorker');

      for (const account of accounts) {
        try {
          // 检查账号是否正在运行，如果在运行则停止
          if (accountManager.isAccountRunning(account.account_id)) {
            accountManager.stopAccount(account.account_id, 'user_deleted');
            console.log(`[UserService] 已停止账号 ${account.account_id} 的运行`);
          }
        } catch (err) {
          console.log(`[UserService] 停止账号 ${account.account_id} 失败:`, err.message);
        }
      }
      console.log(`[UserService] 已处理 ${accounts.length} 个账号的运行状态`);

      // 3. 获取用户所有的农场账号ID
      const [farmAccounts] = await conn.query(
        'SELECT account_id FROM farm_accounts WHERE user_id = ?',
        [userId]
      );
      const accountIds = farmAccounts.map(a => a.account_id);

      // 4. 删除账号相关的统计数据
      if (accountIds.length > 0) {
        // 删除每日统计
        await conn.query(
          'DELETE FROM daily_stats WHERE account_id IN (?)',
          [accountIds]
        );

        // 删除账号统计
        await conn.query(
          'DELETE FROM account_stats WHERE account_id IN (?)',
          [accountIds]
        );

        console.log(`[UserService] 已删除 ${accountIds.length} 个账号的统计数据`);
      }

      // 5. 删除用户的农场账号
      await conn.query(
        'DELETE FROM farm_accounts WHERE user_id = ?',
        [userId]
      );
      console.log(`[UserService] 已删除用户的所有农场账号`);

      // 6. 删除用户的操作日志
      await conn.query(
        'DELETE FROM operation_logs WHERE user_id = ?',
        [userId]
      );

      // 7. 删除用户的公告阅读记录
      await conn.query(
        'DELETE FROM user_announcement_reads WHERE user_id = ?',
        [userId]
      );

      // 8. 删除用户的升级记录
      await conn.query(
        'DELETE FROM user_upgrade_logs WHERE user_id = ?',
        [userId]
      );

      // 9. 彻底删除用户使用的注册密钥（而不是重置）
      // 先获取用户绑定的注册密钥ID
      const [userBoundKey] = await conn.query(
        'SELECT bound_key_id FROM users WHERE id = ?',
        [userId]
      );
      
      // 删除用户使用的所有注册密钥
      await conn.query(
        'DELETE FROM registration_keys WHERE used_by_user_id = ?',
        [userId]
      );
      console.log(`[UserService] 已删除用户使用的所有注册密钥`);

      // 10. 彻底删除用户使用的升级密钥（而不是重置）
      await conn.query(
        'DELETE FROM upgrade_keys WHERE used_by_user_id = ?',
        [userId]
      );
      console.log(`[UserService] 已删除用户使用的所有升级密钥`);

      // 11. 彻底删除用户使用的发放密钥记录（而不是重置）
      await conn.query(
        'DELETE FROM distributed_keys WHERE used_by_user_id = ?',
        [userId]
      );
      console.log(`[UserService] 已删除用户使用的发放密钥记录`);

      // 12. 最后删除用户本身
      await conn.query(
        'DELETE FROM users WHERE id = ?',
        [userId]
      );

      console.log(`[UserService] 用户 ${userId} 及其所有密钥已彻底删除`);
      return true;
    });
  }

  // 重置用户密码（管理员）
  async resetPassword(userId, defaultPassword = 'user666') {
    console.log(`[重置密码] 开始重置用户 ${userId} 的密码为: ${defaultPassword}`);
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    console.log(`[重置密码] 生成的哈希: ${hashedPassword}`);
    const result = await query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );
    console.log(`[重置密码] 更新结果:`, result);
    return true;
  }

  // 创建管理员账号（初始化用）
  async createAdmin(username, password, email) {
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const result = await query(
        'INSERT INTO users (username, password, email, role, status) VALUES (?, ?, ?, "admin", "active")',
        [username, hashedPassword, email]
      );
      return { id: result.insertId, username, role: 'admin' };
    } catch (error) {
      if (error.message.includes('Duplicate')) {
        throw new Error('用户名已存在');
      }
      throw error;
    }
  }

  // 更新用户最后活动时间
  async updateLastActivity(userId) {
    await query(
      'UPDATE users SET last_activity = NOW() WHERE id = ?',
      [userId]
    );
    return true;
  }

  // 修改用户子账号上限（管理员）
  async updateMaxAccounts(userId, maxAccounts) {
    // 检查用户是否存在
    const users = await query(
      'SELECT id, role FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      throw new Error('用户不存在');
    }

    // 不允许修改管理员的子账号上限
    if (users[0].role === 'admin') {
      throw new Error('不能修改管理员的子账号上限');
    }

    await query(
      'UPDATE users SET max_accounts = ? WHERE id = ?',
      [maxAccounts, userId]
    );

    return true;
  }

  // 获取待审批用户列表
  async getPendingUsers() {
    const users = await query(
      `SELECT u.id, u.username, u.email, u.created_at, u.bound_key_id,
              rk.expires_at as key_expires_at
       FROM users u
       LEFT JOIN registration_keys rk ON u.bound_key_id = rk.id
       WHERE u.status = 'pending' AND u.role = 'user'
       ORDER BY u.created_at DESC`
    );
    return users;
  }

  // 审批用户
  async approveUser(userId) {
    // 获取用户信息
    const users = await query(
      'SELECT id, username, email, status FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      throw new Error('用户不存在');
    }

    const user = users[0];

    if (user.status !== 'pending') {
      throw new Error('该用户不在待审批状态');
    }

    // 更新用户状态为 active
    await query(
      "UPDATE users SET status = 'active' WHERE id = ?",
      [userId]
    );

    // 发送审批通过邮件通知
    const emailService = require('./services/emailService');
    try {
      await emailService.sendEmail({
        to: user.email,
        subject: '【QQ农场助手】注册审批通过',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #10b981;">注册审批通过</h2>
          <p>您好，${user.username}！</p>
          <p>恭喜您！您的 QQ农场助手 账号已通过管理员审批。</p>
          <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>用户名：</strong>${user.username}</p>
            <p><strong>审批时间：</strong>${new Date().toLocaleString('zh-CN')}</p>
          </div>
          <p>您现在可以登录系统开始使用。</p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">此邮件由 QQ农场助手 自动发送，请勿回复</p>
        </div>
        `
      });
      console.log(`[UserService] 审批通过邮件已发送给: ${user.email}`);
    } catch (error) {
      console.error('[UserService] 发送审批通过邮件失败:', error);
    }

    return { id: userId, username: user.username, status: 'active' };
  }

  // 拒绝用户（删除待审批用户）
  async rejectUser(userId) {
    return await transaction(async (conn) => {
      // 获取用户信息
      const [rows] = await conn.query(
        'SELECT id, username, email, status, bound_key_id FROM users WHERE id = ?',
        [userId]
      );

      if (!rows || rows.length === 0) {
        throw new Error('用户不存在');
      }

      const user = rows[0];

      if (user.status !== 'pending') {
        throw new Error('该用户不在待审批状态');
      }

      // 释放绑定的密钥
      if (user.bound_key_id) {
        await conn.query(
          'UPDATE registration_keys SET is_used = FALSE, used_by_user_id = NULL, used_at = NULL WHERE id = ?',
          [user.bound_key_id]
        );
      }

      // 删除用户
      await conn.query(
        'DELETE FROM users WHERE id = ?',
        [userId]
      );

      // 发送拒绝邮件通知
      const emailService = require('./services/emailService');
      try {
        await emailService.sendEmail({
          to: user.email,
          subject: '【QQ农场助手】注册申请未通过',
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #ef4444;">注册申请未通过</h2>
            <p>您好，${user.username}！</p>
            <p>很抱歉，您的 QQ农场助手 账号注册申请未通过管理员审批。</p>
            <p>如有疑问，请联系管理员。</p>
            <p style="color: #666; font-size: 12px; margin-top: 30px;">此邮件由 QQ农场助手 自动发送，请勿回复</p>
          </div>
          `
        });
        console.log(`[UserService] 拒绝邮件已发送给: ${user.email}`);
      } catch (error) {
        console.error('[UserService] 发送拒绝邮件失败:', error);
      }

      return { id: userId, username: user.username };
    });
  }
}

module.exports = new UserService();
