const express = require('express');
const router = express.Router();
const keyService = require('./keyService');
const { authMiddleware, adminMiddleware } = require('./authMiddleware');

// 生成密钥（管理员）
router.post('/admin/keys', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { expiresAt, assignedUserId } = req.body;

    if (!expiresAt) {
      return res.status(400).json({ success: false, message: '请提供过期时间' });
    }

    const key = await keyService.createKey(req.user.id, expiresAt, assignedUserId || null);

    res.json({
      success: true,
      data: key,
      message: '密钥生成成功'
    });
  } catch (error) {
    console.error('生成密钥失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取所有密钥（管理员）
router.get('/admin/keys', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const result = await keyService.getAllKeys(Number(page), Number(pageSize));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取密钥列表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 管理员更换用户密钥
router.post('/admin/users/:userId/change-key', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { key } = req.body;

    if (!key) {
      return res.status(400).json({ success: false, message: '请提供新密钥' });
    }

    await keyService.adminChangeUserKey(Number(userId), key);

    res.json({ success: true, message: '密钥更换成功' });
  } catch (error) {
    console.error('更换用户密钥失败:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// 用户更换自己的密钥
router.post('/change-key', authMiddleware, async (req, res) => {
  try {
    const { key } = req.body;

    if (!key) {
      return res.status(400).json({ success: false, message: '请提供新密钥' });
    }

    await keyService.changeUserKey(req.user.id, key);

    res.json({ success: true, message: '密钥更换成功' });
  } catch (error) {
    console.error('更换密钥失败:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// 获取用户当前密钥信息
router.get('/my-key', authMiddleware, async (req, res) => {
  try {
    const keyInfo = await keyService.getUserKeyInfo(req.user.id);

    res.json({ success: true, data: keyInfo });
  } catch (error) {
    console.error('获取密钥信息失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除密钥（管理员）
router.delete('/admin/keys/:keyId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { keyId } = req.params;

    if (!keyId) {
      return res.status(400).json({ success: false, message: '请提供密钥ID' });
    }

    await keyService.deleteKey(Number(keyId));

    res.json({ success: true, message: '密钥删除成功' });
  } catch (error) {
    console.error('删除密钥失败:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// 批量删除密钥（管理员）
router.delete('/admin/keys', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { keyIds } = req.body;

    if (!keyIds || !Array.isArray(keyIds) || keyIds.length === 0) {
      return res.status(400).json({ success: false, message: '请提供要删除的密钥ID列表' });
    }

    const result = await keyService.deleteKeysBatch(keyIds.map(Number));

    res.json({
      success: true,
      message: `成功删除 ${result.deletedCount} 个密钥`,
      data: result
    });
  } catch (error) {
    console.error('批量删除密钥失败:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
