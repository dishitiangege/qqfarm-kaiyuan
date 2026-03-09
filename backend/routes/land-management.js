/**
 * 土地管理 API 路由
 * 提供土地解锁、升级等管理功能
 */

const express = require('express');
const router = express.Router();
const accountManager = require('../accountManagerWorker');

/**
 * POST /api/lands/:accountId/unlock/:landId
 * 解锁指定土地
 */
router.post('/:accountId/unlock/:landId', async (req, res) => {
  try {
    const { accountId, landId } = req.params;
    const result = await accountManager.unlockLand(accountId, parseInt(landId));
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('解锁土地失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/lands/:accountId/upgrade/:landId
 * 升级指定土地
 */
router.post('/:accountId/upgrade/:landId', async (req, res) => {
  try {
    const { accountId, landId } = req.params;
    const result = await accountManager.upgradeLand(accountId, parseInt(landId));
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('升级土地失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/lands/:accountId/auto-unlock
 * 自动解锁所有可解锁的土地
 */
router.post('/:accountId/auto-unlock', async (req, res) => {
  try {
    const { accountId } = req.params;
    const result = await accountManager.autoUnlockLands(accountId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('自动解锁土地失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/lands/:accountId/auto-upgrade
 * 自动升级所有可升级的土地
 */
router.post('/:accountId/auto-upgrade', async (req, res) => {
  try {
    const { accountId } = req.params;
    const result = await accountManager.autoUpgradeLands(accountId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('自动升级土地失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/lands/:accountId/auto-manage
 * 执行土地自动管理（解锁+升级）
 */
router.post('/:accountId/auto-manage', async (req, res) => {
  try {
    const { accountId } = req.params;
    const result = await accountManager.autoManageLands(accountId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('自动管理土地失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
