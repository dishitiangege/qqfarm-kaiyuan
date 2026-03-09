/**
 * 管理员密钥发放管理路由
 * 处理管理员创建发放活动、查看发放记录等功能
 */

const express = require('express');
const router = express.Router();
const { query, transaction } = require('./db');
const crypto = require('crypto');

// 生成随机密钥
function generateKey() {
  return 'KEY-' + crypto.randomBytes(16).toString('hex').toUpperCase();
}

// 验证管理员权限中间件
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: '需要管理员权限' });
  }
  next();
}

// 创建发放活动
router.post('/campaigns', requireAdmin, async (req, res) => {
  const { name, minDays, maxDays, totalQuota, endAt } = req.body;
  const adminId = req.user.id;

  // 验证参数
  if (!name || !minDays || !maxDays || !totalQuota) {
    return res.status(400).json({ success: false, message: '请填写完整信息' });
  }

  if (minDays < 1 || maxDays < minDays) {
    return res.status(400).json({ success: false, message: '天数设置无效' });
  }

  if (totalQuota < 1 || totalQuota > 10000) {
    return res.status(400).json({ success: false, message: '名额数量必须在1-10000之间' });
  }

  try {
    // 只创建活动配置，不预生成密钥
    const result = await query(
      `INSERT INTO key_distribution_campaigns
       (name, min_days, max_days, total_quota, remaining_quota, end_at, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, minDays, maxDays, totalQuota, totalQuota, endAt || null, adminId, 'active']
    );

    res.json({
      success: true,
      message: '发放活动创建成功',
      campaign: {
        id: result.insertId,
        name,
        min_days: minDays,
        max_days: maxDays,
        total_quota: totalQuota,
        remaining_quota: totalQuota
      }
    });
  } catch (error) {
    console.error('创建发放活动失败:', error);
    res.status(500).json({ success: false, message: '创建失败: ' + error.message });
  }
});

// 获取发放活动列表
router.get('/campaigns', requireAdmin, async (req, res) => {
  try {
    const campaigns = await query(
      `SELECT
        c.*,
        u.username as created_by_name,
        (SELECT COUNT(*) FROM distributed_keys WHERE campaign_id = c.id) as claimed_count,
        (SELECT COUNT(*) FROM distributed_keys WHERE campaign_id = c.id AND is_used = TRUE) as used_count
       FROM key_distribution_campaigns c
       LEFT JOIN users u ON c.created_by = u.id
       ORDER BY c.created_at DESC`
    );

    // 转换字段名以匹配前端期望
    const formattedCampaigns = campaigns.map(c => ({
      id: c.id,
      name: c.name,
      min_days: c.min_days,
      max_days: c.max_days,
      total_quota: c.total_quota,
      remaining_quota: c.remaining_quota,
      claimed_count: c.claimed_count || 0,
      used_count: c.used_count || 0,
      is_active: c.status === 'active',
      status: c.status,
      end_at: c.end_at,
      created_at: c.created_at,
      created_by: c.created_by,
      created_by_name: c.created_by_name
    }));

    res.json({
      success: true,
      campaigns: formattedCampaigns
    });
  } catch (error) {
    console.error('获取发放活动列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 获取单个发放活动详情
router.get('/campaigns/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const [campaign] = await query(
      `SELECT c.*, u.username as created_by_name
       FROM key_distribution_campaigns c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = ?`,
      [id]
    );

    if (!campaign) {
      return res.status(404).json({ success: false, message: '活动不存在' });
    }

    // 获取已发放的密钥列表
    const keys = await query(
      `SELECT dk.*, u.username as used_by_name
       FROM distributed_keys dk
       LEFT JOIN users u ON dk.used_by_user_id = u.id
       WHERE dk.campaign_id = ?
       ORDER BY dk.created_at DESC`,
      [id]
    );

    // 转换密钥字段名以匹配前端期望
    const formattedKeys = keys.map(k => ({
      id: k.id,
      key_value: k.key_value,
      valid_days: k.valid_days,
      claimed_by_email: k.claimed_by_email,
      claimed_at: k.claimed_at,
      expires_at: k.expires_at,
      is_used: k.is_used,
      used_by_user_id: k.used_by_user_id,
      used_by_name: k.used_by_name,
      used_at: k.used_at
    }));

    res.json({
      success: true,
      keys: formattedKeys
    });
  } catch (error) {
    console.error('获取活动详情失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 更新发放活动状态
router.put('/campaigns/:id/status', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  // 将 isActive 转换为 status
  const status = isActive === true ? 'active' : 'paused';

  try {
    await query(
      `UPDATE key_distribution_campaigns SET status = ? WHERE id = ?`,
      [status, id]
    );

    res.json({ success: true, message: isActive ? '活动已恢复' : '活动已停止' });
  } catch (error) {
    console.error('更新活动状态失败:', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// 删除发放活动
router.delete('/campaigns/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await query(`DELETE FROM key_distribution_campaigns WHERE id = ?`, [id]);
    res.json({ success: true, message: '活动删除成功' });
  } catch (error) {
    console.error('删除活动失败:', error);
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

// 获取所有已发放密钥列表
router.get('/distributed-keys', requireAdmin, async (req, res) => {
  const { page = 1, limit = 20, email, campaignId } = req.query;
  const offset = (page - 1) * limit;

  try {
    let whereClause = '';
    const params = [];

    if (email) {
      whereClause += ' AND dk.email LIKE ?';
      params.push(`%${email}%`);
    }

    if (campaignId) {
      whereClause += ' AND dk.campaign_id = ?';
      params.push(campaignId);
    }

    const keys = await query(
      `SELECT 
        dk.*,
        c.name as campaign_name,
        u.username as used_by_name
       FROM distributed_keys dk
       LEFT JOIN key_distribution_campaigns c ON dk.campaign_id = c.id
       LEFT JOIN users u ON dk.used_by_user_id = u.id
       WHERE 1=1 ${whereClause}
       ORDER BY dk.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM distributed_keys dk WHERE 1=1 ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: keys,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total
      }
    });
  } catch (error) {
    console.error('获取密钥列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// 获取统计数据
router.get('/statistics', requireAdmin, async (req, res) => {
  try {
    // 总体统计
    const [totalStats] = await query(`
      SELECT 
        COUNT(*) as total_campaigns,
        SUM(total_quota) as total_quota,
        SUM(total_quota - remaining_quota) as distributed_count
      FROM key_distribution_campaigns
    `);

    // 今日领取统计
    const today = new Date().toISOString().slice(0, 10);
    const [todayStats] = await query(`
      SELECT COUNT(*) as today_claims
      FROM email_key_claims
      WHERE claim_date = ?
    `, [today]);

    // 密钥使用统计
    const [usageStats] = await query(`
      SELECT 
        COUNT(*) as total_keys,
        SUM(CASE WHEN is_used = TRUE THEN 1 ELSE 0 END) as used_keys
      FROM distributed_keys
    `);

    res.json({
      success: true,
      data: {
        totalCampaigns: totalStats.total_campaigns,
        totalQuota: totalStats.total_quota,
        distributedCount: totalStats.distributed_count,
        todayClaims: todayStats.today_claims,
        totalKeys: usageStats.total_keys,
        usedKeys: usageStats.used_keys
      }
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

module.exports = router;
