/**
 * 认证中间件
 * 验证 JWT Token 并设置用户信息
 */

const userService = require('./userService');
const { query } = require('./db');

// 验证 Token（返回异步函数，Express 会自动处理）
function authMiddleware(req, res, next) {
  (async () => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: '未提供认证令牌' });
      }

      const token = authHeader.substring(7);
      const decoded = userService.verifyToken(token);
      
      // 检查用户状态（是否被冻结或删除）
      const users = await query(
        'SELECT status FROM users WHERE id = ?',
        [decoded.id]
      );
      
      if (users.length === 0) {
        return res.status(401).json({ success: false, message: '用户不存在' });
      }
      
      const userStatus = users[0].status;
      if (userStatus === 'frozen') {
        return res.status(403).json({ success: false, message: '此账户已被冻结，请联系管理员' });
      }
      if (userStatus === 'deleted') {
        return res.status(403).json({ success: false, message: '此账户已被删除' });
      }
      
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ success: false, message: error.message });
    }
  })();
}

// 验证管理员权限
function adminMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: '未登录' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: '无权限执行此操作' });
  }

  next();
}

module.exports = {
  authMiddleware,
  adminMiddleware
};
