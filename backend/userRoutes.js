/**
 * 用户相关 API 路由
 * 包含认证、用户管理、管理员功能
 */

const express = require('express');
const router = express.Router();
const userService = require('./userService');
const farmAccountService = require('./farmAccountService');
const emailService = require('./services/emailService');
const systemSettingsService = require('./systemSettingsService');
const { authMiddleware, adminMiddleware } = require('./authMiddleware');
const accountManager = require('./accountManagerWorker');
const logManager = require('./logManager');
const { query } = require('./db');

// ========== 认证相关 ==========

// 获取注册状态（公开API，无需登录）
router.get('/registration-status', async (req, res) => {
  try {
    const status = await systemSettingsService.isRegistrationOpen();
    const settings = await systemSettingsService.getRegistrationSettings();
    res.json({ 
      success: true, 
      data: {
        ...status,
        startTime: settings.startTime,
        endTime: settings.endTime
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 用户注册（必须使用QQ邮箱，需要验证码验证）
router.post('/register', async (req, res) => {
  try {
    const registrationStatus = await systemSettingsService.isRegistrationOpen();
    if (!registrationStatus.open) {
      return res.status(403).json({ 
        success: false, 
        message: registrationStatus.reason || '注册功能已关闭' 
      });
    }

    const { username, password, email, verificationCode, registrationKey } = req.body;

    // 验证必填字段
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }

    if (!email) {
      return res.status(400).json({ success: false, message: '请输入QQ邮箱' });
    }

    if (!verificationCode) {
      return res.status(400).json({ success: false, message: '请输入邮箱验证码' });
    }

    if (!registrationKey) {
      return res.status(400).json({ success: false, message: '请输入注册密钥' });
    }

    // 验证必须是QQ邮箱
    if (!emailService.isQQEmail(email)) {
      return res.status(400).json({ success: false, message: '请使用正确的QQ邮箱格式（如：123456@qq.com）' });
    }

    // 验证用户名必须与QQ邮箱一致
    const qqNumber = emailService.getQQNumber(email);
    if (username !== qqNumber) {
      return res.status(400).json({ success: false, message: '用户名必须与QQ邮箱的QQ号一致' });
    }

    // 验证邮箱验证码
    await emailService.verifyCode(email, verificationCode);

    // 注册用户信息
    const user = await userService.register(username, password, email, registrationKey);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 发送邮箱验证码
router.post('/send-verification-code', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: '请输入邮箱地址' });
    }

    const result = await emailService.sendVerificationCode(email);
    res.json({ success: true, message: result.message, code: result.code });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }

    const result = await userService.login(username, password);
    res.json({ success: true, data: result });
  } catch (error) {
    const response = { success: false, message: error.message };
    // 如果有错误码，一并返回
    if (error.code) {
      response.code = error.code;
    }
    if (error.userId) {
      response.userId = error.userId;
    }
    res.status(401).json(response);
  }
});

// 使用新密钥重新激活账户
router.post('/reactivate', async (req, res) => {
  try {
    const { userId, key } = req.body;

    if (!userId || !key) {
      return res.status(400).json({ success: false, message: '用户ID和密钥不能为空' });
    }

    const result = await userService.reactivateUser(userId, key);
    res.json({ success: true, message: '账户激活成功', data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 获取当前用户信息
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await userService.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    // 转换为驼峰命名
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      maxAccounts: user.max_accounts,
      keyExpiresAt: user.key_expires_at,
      upgradeExpiresAt: user.upgrade_expires_at,
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at
    };
    res.json({ success: true, data: userData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 修改密码
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: '原密码和新密码不能为空' });
    }

    await userService.changePassword(req.user.id, oldPassword, newPassword);
    res.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ========== 农场账号管理 ==========

// 获取用户的所有农场账号
router.get('/accounts', authMiddleware, async (req, res) => {
  try {
    // 从数据库获取账号
    const dbAccounts = await farmAccountService.getUserAccounts(req.user.id);
    
    // 从 accountManager 获取运行状态
    const runningAccounts = accountManager.getRunningAccounts();
    
    // 合并运行状态
    const accounts = dbAccounts.map(account => {
      const isRunning = runningAccounts.includes(account.id);
      return {
        ...account,
        isRunning,
        status: isRunning ? 'running' : (account.status || 'stopped')
      };
    });
    
    res.json({ success: true, data: accounts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 添加农场账号
router.post('/accounts', authMiddleware, async (req, res) => {
  try {
    const { accountId, name, platform, code, config, email, farmInterval, friendInterval } = req.body;
    
    if (!accountId || !name || !platform || !code) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    const account = await farmAccountService.addAccount(req.user.id, {
      accountId,
      name,
      platform,
      code,
      config,
      email,
      farmInterval,
      friendInterval
    });

    // 同步新账号到 accountManager
    try {
      await accountManager.syncAccountFromDB(account);
      console.log(`[添加账号] 账号 ${accountId} 已同步到 accountManager`);
    } catch (syncErr) {
      console.error(`[添加账号] 同步到 accountManager 失败:`, syncErr.message);
    }

    res.json({ success: true, data: account });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 更新农场账号
router.put('/accounts/:accountId', authMiddleware, async (req, res) => {
  try {
    const { accountId } = req.params;
    const updateData = req.body;

    const success = await farmAccountService.updateAccount(accountId, req.user.id, updateData);

    if (!success) {
      return res.status(400).json({ success: false, message: '没有要更新的字段' });
    }

    // 同时更新 accountManager 中的配置（用于子进程读取）
    try {
      const configData = {
        config: updateData.config,
        farmInterval: updateData.farm_interval,
        friendInterval: updateData.friend_interval,
        email: updateData.email
      };
      await accountManager.updateAccountConfig(accountId, configData);
    } catch (err) {
      console.error(`[更新账号] 同步到 accountManager 失败:`, err.message);
      // 如果账号不存在，从数据库同步账号到 accountManager
      if (err.message === '账号不存在') {
        try {
          const account = await farmAccountService.getAccountById(accountId);
          if (account) {
            await accountManager.syncAccountFromDB(account);
            console.log(`[更新账号] 已同步账号 ${accountId} 到 accountManager`);
          }
        } catch (syncErr) {
          console.error(`[更新账号] 同步账号到 accountManager 失败:`, syncErr.message);
        }
      }
    }

    res.json({ success: true, message: '账号更新成功' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 删除农场账号
router.delete('/accounts/:accountId', authMiddleware, async (req, res) => {
  try {
    const { accountId } = req.params;
    await farmAccountService.deleteAccount(accountId, req.user.id);
    res.json({ success: true, message: '账号已删除' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 启动账号脚本
router.post('/accounts/:accountId/start', authMiddleware, async (req, res) => {
  try {
    const { accountId } = req.params;

    // 获取账号信息
    const account = await farmAccountService.getAccountById(accountId, req.user.id);
    if (!account) {
      return res.status(404).json({ success: false, message: '账号不存在' });
    }

    // 检查账号是否存在于 accountManager 中，如果不存在则同步
    try {
      await accountManager.startAccount(accountId);
    } catch (startError) {
      if (startError.message === '账号不存在') {
        console.log(`[启动账号] 账号 ${accountId} 不在 accountManager 中，正在同步...`);
        await accountManager.syncAccountFromDB(account);
        console.log(`[启动账号] 账号 ${accountId} 已同步，重新启动...`);
        await accountManager.startAccount(accountId);
      } else {
        throw startError;
      }
    }

    // 更新账号状态
    await farmAccountService.updateAccountStatus(accountId, 'active');
    res.json({ success: true, message: '脚本已启动' });
  } catch (error) {
    console.error('[API] 启动脚本失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 停止账号脚本
router.post('/accounts/:accountId/stop', authMiddleware, async (req, res) => {
  try {
    const { accountId } = req.params;

    // 停止脚本
    const success = await accountManager.stopAccount(accountId);

    if (success) {
      // 更新账号状态
      await farmAccountService.updateAccountStatus(accountId, 'stopped');
      res.json({ success: true, message: '脚本已停止' });
    } else {
      res.status(400).json({ success: false, message: '停止脚本失败' });
    }
  } catch (error) {
    console.error('[API] 停止脚本失败:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取账号日志
router.get('/accounts/:accountId/logs', authMiddleware, async (req, res) => {
  try {
    const { accountId } = req.params;
    const limit = parseInt(req.query.limit) || 200;

    // 获取日志
    const logs = accountManager.getAccountLogs(accountId, limit);

    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// SSE 实时日志推送（支持 URL query token，用于 EventSource）
router.get('/accounts/:accountId/logs/stream', async (req, res) => {
  // 先设置 SSE 响应头（认证失败时也需要用 SSE 格式返回错误）
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲

  try {
    // 从 query 参数或 header 获取 token
    const token = req.query.token || req.headers.authorization?.substring(7);

    if (!token) {
      res.write(`data: ${JSON.stringify({ type: 'error', code: 'NO_TOKEN', message: '未提供认证令牌' })}

`);
      return res.end();
    }

    const decoded = userService.verifyToken(token);

    // 检查用户状态
    const users = await query(
      'SELECT status FROM users WHERE id = ?',
      [decoded.id]
    );

    if (users.length === 0) {
      res.write(`data: ${JSON.stringify({ type: 'error', code: 'USER_NOT_FOUND', message: '用户不存在' })}

`);
      return res.end();
    }

    const userStatus = users[0].status;
    if (userStatus === 'frozen') {
      res.write(`data: ${JSON.stringify({ type: 'error', code: 'USER_FROZEN', message: '此账户已被冻结' })}

`);
      return res.end();
    }
    if (userStatus === 'deleted') {
      res.write(`data: ${JSON.stringify({ type: 'error', code: 'USER_DELETED', message: '此账户已被删除' })}

`);
      return res.end();
    }

    // 认证通过，设置用户信息
    req.user = decoded;

    const { accountId } = req.params;

    // 发送初始日志
    const initialLogs = accountManager.getAccountLogs(accountId, 100);
    res.write(`data: ${JSON.stringify({ type: 'init', logs: initialLogs })}\n\n`);

    // 监听日志事件
    const onLog = (data) => {
      if (data.accountId === accountId) {
        res.write(`data: ${JSON.stringify({ type: 'log', log: data.log })}\n\n`);
      }
    };

    logManager.on('log', onLog);

    // 发送心跳保持连接
    const heartbeat = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
    }, 30000);

    // 客户端断开连接时清理
    req.on('close', () => {
      logManager.off('log', onLog);
      clearInterval(heartbeat);
      res.end();
    });

    // 错误处理
    req.on('error', () => {
      logManager.off('log', onLog);
      clearInterval(heartbeat);
      res.end();
    });
  } catch (error) {
    // 使用 SSE 格式返回错误
    res.write(`data: ${JSON.stringify({ type: 'error', code: 'AUTH_FAILED', message: error.message })}

`);
    return res.end();
  }
});

// ========== 用户心跳和状态 ==========

// 更新用户活动时间（心跳）
router.post('/heartbeat', authMiddleware, async (req, res) => {
  try {
    await userService.updateLastActivity(req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取当前用户完整信息（包含在线状态）
router.get('/me/full', authMiddleware, async (req, res) => {
  try {
    const user = await userService.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 判断是否在线（5分钟内有活动）
    const isOnline = user.last_activity &&
      (new Date() - new Date(user.last_activity)) < 5 * 60 * 1000;

    res.json({
      success: true,
      data: {
        ...user,
        isOnline
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== 管理员功能 ==========

// 获取所有用户（管理员）
router.get('/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    console.log('[管理员API] 获取用户列表, page:', page, 'pageSize:', pageSize);
    const result = await userService.getAllUsers(page, pageSize);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[管理员API] 获取用户列表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 冻结用户（管理员）
router.post('/admin/users/:userId/freeze', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    await userService.freezeUser(parseInt(userId));
    res.json({ success: true, message: '用户已冻结' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 解冻用户（管理员）
router.post('/admin/users/:userId/unfreeze', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    await userService.unfreezeUser(parseInt(userId));
    res.json({ success: true, message: '用户已解冻' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 删除用户（管理员）
router.delete('/admin/users/:userId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    await userService.deleteUser(parseInt(userId));
    res.json({ success: true, message: '用户已删除' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 批量删除用户（管理员）
router.delete('/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: '请提供要删除的用户ID列表' });
    }

    const results = {
      success: [],
      failed: [],
      total: userIds.length
    };

    for (const userId of userIds) {
      try {
        await userService.deleteUser(parseInt(userId));
        results.success.push(userId);
      } catch (error) {
        results.failed.push({ userId, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `成功删除 ${results.success.length} 个用户，失败 ${results.failed.length} 个`,
      data: results
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 重置用户密码（管理员）
router.post('/admin/users/:userId/reset-password', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { password = 'user666' } = req.body;
    console.log(`[API] 收到重置密码请求, userId: ${userId}, password: ${password}`);
    console.log(`[API] 请求体:`, req.body);
    await userService.resetPassword(parseInt(userId), password);
    res.json({ success: true, message: `密码已重置为: ${password}` });
  } catch (error) {
    console.error(`[API] 重置密码失败:`, error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// 修改用户子账号上限（管理员）
router.post('/admin/users/:userId/max-accounts', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { maxAccounts } = req.body;

    if (maxAccounts === undefined || maxAccounts === null) {
      return res.status(400).json({ success: false, message: '请提供子账号上限数量' });
    }

    const num = parseInt(maxAccounts);
    if (isNaN(num) || num < 1) {
      return res.status(400).json({ success: false, message: '子账号上限必须至少为1' });
    }

    await userService.updateMaxAccounts(parseInt(userId), num);
    res.json({ success: true, message: `子账号上限已修改为: ${num}` });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 获取所有农场账号（管理员）
router.get('/admin/accounts', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, userId, status } = req.query;
    const result = await farmAccountService.getAllAccounts(
      parseInt(page),
      parseInt(pageSize),
      { userId, status }
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取指定用户的所有农场账号（管理员）
router.get('/admin/users/:userId/accounts', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const accounts = await farmAccountService.getUserAccounts(parseInt(userId));
    res.json({ success: true, data: accounts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 管理员删除任意账号
router.delete('/admin/accounts/:accountId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { accountId } = req.params;
    await farmAccountService.adminDeleteAccount(accountId);
    
    // 同时从 accountManager 中删除（停止脚本并清理数据）
    try {
      accountManager.removeAccount(accountId);
      console.log(`[管理员] 账号 ${accountId} 已从 accountManager 中删除`);
    } catch (err) {
      console.error(`[管理员] 从 accountManager 删除账号失败:`, err.message);
    }
    
    res.json({ success: true, message: '账号已删除' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 管理员修改任意账号
router.put('/admin/accounts/:accountId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { accountId } = req.params;
    const updateData = req.body;

    const success = await farmAccountService.adminUpdateAccount(accountId, updateData);
    
    if (!success) {
      return res.status(400).json({ success: false, message: '没有要更新的字段' });
    }

    res.json({ success: true, message: '账号更新成功' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 创建管理员账号（仅用于初始化）
router.post('/admin/init', async (req, res) => {
  try {
    const { username, password, email, secretKey } = req.body;
    
    // 验证密钥（防止任意人创建管理员）
    if (secretKey !== process.env.ADMIN_INIT_KEY && secretKey !== 'qqfarm-init-2024') {
      return res.status(403).json({ success: false, message: '密钥错误' });
    }

    const admin = await userService.createAdmin(username, password, email);
    res.json({ success: true, data: admin });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 一键重启所有运行中的账号（管理员功能）
router.post('/admin/accounts/restart-all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await accountManager.restartAllRunningAccounts();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[管理员API] 一键重启所有账号失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 管理员停止指定账号脚本
router.post('/admin/accounts/:accountId/stop', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { accountId } = req.params;

    // 停止脚本
    const success = await accountManager.stopAccount(accountId, 'admin_stop');

    if (success) {
      // 更新账号状态
      await farmAccountService.updateAccountStatus(accountId, 'stopped');
      res.json({ success: true, message: '脚本已停止' });
    } else {
      res.status(400).json({ success: false, message: '停止脚本失败，账号可能未在运行' });
    }
  } catch (error) {
    console.error('[管理员API] 停止账号失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 管理员快速创建用户（无需邮箱验证）
router.post('/admin/create-user', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { username, password, email, registrationKey } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }

    if (!registrationKey) {
      return res.status(400).json({ success: false, message: '请输入注册密钥' });
    }

    // 验证必须是QQ邮箱
    if (!emailService.isQQEmail(email)) {
      return res.status(400).json({ success: false, message: '请使用正确的QQ邮箱格式（如：123456@qq.com）' });
    }

    // 验证用户名必须与QQ邮箱一致
    const qqNumber = emailService.getQQNumber(email);
    if (username !== qqNumber) {
      return res.status(400).json({ success: false, message: '用户名必须与QQ邮箱的QQ号一致' });
    }

    // 检查该邮箱是否已被注册
    const existingUsers = await query(
      'SELECT id FROM users WHERE email = ? AND status != "deleted"',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ success: false, message: '该QQ邮箱已被注册' });
    }

    const user = await userService.register(username, password, email, registrationKey, true);
    res.json({ success: true, message: '用户创建成功', data: user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 管理员：获取待审批用户列表
router.get('/admin/pending-users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await userService.getPendingUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('获取待审批用户失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 管理员：审批用户
router.post('/admin/approve-user/:userId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await userService.approveUser(parseInt(userId));
    res.json({ success: true, message: '用户审批通过', data: result });
  } catch (error) {
    console.error('审批用户失败:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// 管理员：拒绝用户（删除待审批用户）
router.post('/admin/reject-user/:userId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await userService.rejectUser(parseInt(userId));
    res.json({ success: true, message: '已拒绝用户注册申请', data: result });
  } catch (error) {
    console.error('拒绝用户失败:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// 管理员：获取注册设置
router.get('/admin/registration-settings', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const settings = await systemSettingsService.getRegistrationSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('获取注册设置失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 管理员：更新注册设置
router.put('/admin/registration-settings', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { enabled, startTime, endTime } = req.body;
    
    const settings = await systemSettingsService.updateRegistrationSettings({
      enabled,
      startTime,
      endTime
    });
    
    res.json({ 
      success: true, 
      message: '注册设置已更新',
      data: settings 
    });
  } catch (error) {
    console.error('更新注册设置失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 管理员：获取邮箱黑名单
router.get('/admin/email-blacklist', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const blacklist = await systemSettingsService.getEmailBlacklist();
    res.json({ success: true, data: blacklist });
  } catch (error) {
    console.error('获取邮箱黑名单失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 管理员：添加邮箱到黑名单
router.post('/admin/email-blacklist', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { email, reason } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: '请输入邮箱地址' });
    }
    
    // 验证QQ邮箱格式
    if (!emailService.isQQEmail(email)) {
      return res.status(400).json({ success: false, message: '请使用正确的QQ邮箱格式（如：123456@qq.com）' });
    }
    
    const blacklist = await systemSettingsService.addEmailToBlacklist(email, reason || '');
    res.json({ success: true, message: '邮箱已添加到黑名单', data: blacklist });
  } catch (error) {
    console.error('添加邮箱到黑名单失败:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// 管理员：从黑名单移除邮箱
router.delete('/admin/email-blacklist/:email', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { email } = req.params;
    const blacklist = await systemSettingsService.removeEmailFromBlacklist(email);
    res.json({ success: true, message: '邮箱已从黑名单移除', data: blacklist });
  } catch (error) {
    console.error('从黑名单移除邮箱失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 管理员：批量更新邮箱黑名单
router.put('/admin/email-blacklist', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { blacklist } = req.body;
    
    if (!Array.isArray(blacklist)) {
      return res.status(400).json({ success: false, message: '黑名单数据格式错误' });
    }
    
    const result = await systemSettingsService.updateEmailBlacklist(blacklist);
    res.json({ success: true, message: '邮箱黑名单已更新', data: result });
  } catch (error) {
    console.error('更新邮箱黑名单失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 管理员：获取反检测系统设置
router.get('/admin/anti-detection-settings', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const settings = await systemSettingsService.getAntiDetectionSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('获取反检测设置失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 管理员：更新反检测系统设置
router.put('/admin/anti-detection-settings', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { globalEnabled, defaultConfig } = req.body;
    const settings = await systemSettingsService.updateAntiDetectionSettings({
      globalEnabled,
      defaultConfig
    });
    const broadcast = await accountManager.broadcastAntiDetectionSettings(settings);
    res.json({
      success: true,
      message: '反检测设置已更新',
      data: settings,
      broadcast
    });
  } catch (error) {
    console.error('更新反检测设置失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
