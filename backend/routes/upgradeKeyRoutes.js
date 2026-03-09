const express = require('express');
const router = express.Router();
const upgradeKeyService = require('../services/upgradeKeyService');
const { authMiddleware, adminMiddleware } = require('../authMiddleware');

// 管理员：创建升级密钥
router.post('/create', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { keyType, count = 1, customConfig } = req.body;

    if (!keyType || !['level1', 'level2', 'custom'].includes(keyType)) {
      return res.status(400).json({
        success: false,
        message: '密钥等级无效，请选择 level1、level2 或 custom'
      });
    }

    // 自定义密钥类型需要验证参数
    if (keyType === 'custom') {
      if (!customConfig || !customConfig.maxAccounts || !customConfig.extendDays) {
        return res.status(400).json({
          success: false,
          message: '自定义密钥需要提供 maxAccounts 和 extendDays 参数'
        });
      }

      if (customConfig.maxAccounts < 1 || customConfig.maxAccounts > 10) {
        return res.status(400).json({
          success: false,
          message: '子账号上限必须在 1-10 之间'
        });
      }

      if (customConfig.extendDays < 1 || customConfig.extendDays > 365) {
        return res.status(400).json({
          success: false,
          message: '有效期天数必须在 1-365 之间'
        });
      }
    }

    if (count > 100) {
      return res.status(400).json({
        success: false,
        message: '单次最多创建100个密钥'
      });
    }

    const adminId = req.user.id;

    if (count === 1) {
      const key = await upgradeKeyService.createUpgradeKey(keyType, adminId, customConfig);
      res.json({
        success: true,
        message: '升级密钥创建成功',
        data: key
      });
    } else {
      const keys = await upgradeKeyService.batchCreateUpgradeKeys(keyType, count, adminId, customConfig);
      res.json({
        success: true,
        message: `成功创建 ${keys.length} 个升级密钥`,
        data: keys
      });
    }
  } catch (error) {
    console.error('创建升级密钥失败:', error);
    res.status(500).json({
      success: false,
      message: '创建升级密钥失败: ' + error.message
    });
  }
});

// 管理员：获取升级密钥列表
router.get('/list', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { keyType, isUsed } = req.query;
    const filters = {};
    
    if (keyType) filters.keyType = keyType;
    if (isUsed !== undefined) filters.isUsed = isUsed === 'true';

    const keys = await upgradeKeyService.getUpgradeKeys(filters);
    
    res.json({
      success: true,
      data: keys
    });
  } catch (error) {
    console.error('获取升级密钥列表失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取升级密钥列表失败: ' + error.message 
    });
  }
});

// 管理员：删除升级密钥
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await upgradeKeyService.deleteUpgradeKey(id);
    
    res.json({
      success: true,
      message: '密钥删除成功'
    });
  } catch (error) {
    console.error('删除升级密钥失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '删除升级密钥失败: ' + error.message 
    });
  }
});

// 用户：使用升级密钥
router.post('/use', authMiddleware, async (req, res) => {
  try {
    const { keyValue } = req.body;
    const userId = req.user.id;

    if (!keyValue) {
      return res.status(400).json({ 
        success: false, 
        message: '请输入升级密钥' 
      });
    }

    const result = await upgradeKeyService.useUpgradeKey(userId, keyValue);
    
    res.json({
      success: true,
      message: `升级成功！子账号上限已提升至 ${result.newMaxAccounts} 个，有效期延长 ${result.extendDays} 天`,
      data: result
    });
  } catch (error) {
    console.error('使用升级密钥失败:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// 用户：验证升级密钥（预览效果）
router.post('/validate', authMiddleware, async (req, res) => {
  try {
    const { keyValue } = req.body;

    if (!keyValue) {
      return res.status(400).json({ 
        success: false, 
        message: '请输入升级密钥' 
      });
    }

    const result = await upgradeKeyService.validateUpgradeKey(keyValue);
    
    if (!result.valid) {
      return res.status(400).json({ 
        success: false, 
        message: result.message 
      });
    }

    // 根据密钥类型生成显示文本
    let keyTypeText;
    let description;
    if (result.keyType === 'level1') {
      keyTypeText = '一级密钥';
      description = '子账号上限提升至2个，延长15天有效期';
    } else if (result.keyType === 'level2') {
      keyTypeText = '二级密钥';
      description = '子账号上限提升至3个，延长30天有效期';
    } else if (result.keyType === 'custom') {
      keyTypeText = '自定义密钥';
      description = `子账号上限提升至${result.maxAccounts}个，延长${result.extendDays}天有效期`;
    } else {
      keyTypeText = '未知类型';
      description = '子账号上限提升，延长有效期';
    }

    res.json({
      success: true,
      data: {
        keyType: result.keyType,
        keyTypeText,
        maxAccounts: result.maxAccounts,
        extendDays: result.extendDays,
        description
      }
    });
  } catch (error) {
    console.error('验证升级密钥失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '验证失败: ' + error.message 
    });
  }
});

// 用户：获取自己的升级记录
router.get('/my-logs', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const logs = await upgradeKeyService.getUserUpgradeLogs(userId);

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('获取升级记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取升级记录失败: ' + error.message
    });
  }
});

// 管理员：获取指定用户的升级密钥信息
router.get('/user/:userId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await upgradeKeyService.getUserUpgradeKeyInfo(parseInt(userId));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取用户升级密钥信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户升级密钥信息失败: ' + error.message
    });
  }
});

// 管理员：解绑用户的升级密钥
router.post('/unbind/:userId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await upgradeKeyService.unbindUserUpgradeKey(parseInt(userId));

    res.json({
      success: true,
      message: '升级密钥解绑成功',
      data: result
    });
  } catch (error) {
    console.error('解绑升级密钥失败:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// 管理员：修改升级密钥有效期
router.put('/:keyId/extend-days', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { keyId } = req.params;
    const { extendDays } = req.body;

    if (!extendDays || extendDays < 1 || extendDays > 365) {
      return res.status(400).json({
        success: false,
        message: '有效期天数必须在1-365之间'
      });
    }

    const result = await upgradeKeyService.updateKeyExtendDays(parseInt(keyId), extendDays);

    res.json({
      success: true,
      message: '有效期修改成功',
      data: result
    });
  } catch (error) {
    console.error('修改升级密钥有效期失败:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// 管理员：为用户绑定升级密钥（直接使用，无需用户输入）
router.post('/admin/bind/:userId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { keyValue } = req.body;

    if (!keyValue) {
      return res.status(400).json({
        success: false,
        message: '请输入升级密钥'
      });
    }

    const result = await upgradeKeyService.adminUseUpgradeKey(parseInt(userId), keyValue);

    res.json({
      success: true,
      message: `升级成功！用户子账号上限已提升至 ${result.newMaxAccounts} 个，有效期延长 ${result.extendDays} 天`,
      data: result
    });
  } catch (error) {
    console.error('管理员绑定升级密钥失败:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;