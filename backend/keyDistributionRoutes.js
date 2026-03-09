/**
 * 密钥发放系统路由
 * 处理用户获取密钥、管理员发放密钥等功能
 */

const express = require('express');
const router = express.Router();
const { query, transaction } = require('./db');
const crypto = require('crypto');
const emailService = require('./services/emailService');
const systemSettingsService = require('./systemSettingsService');

// 生成随机密钥
function generateKey() {
  return 'KEY-' + crypto.randomBytes(16).toString('hex').toUpperCase();
}

// 加权随机生成天数 - 最小天数概率95%以上，最大天数概率约1%
// 使用分段概率：最小天数95%，剩余5%按指数衰减分配给其他天数
function generateWeightedDays(minDays, maxDays) {
  // 如果只有一天，直接返回
  if (minDays === maxDays) {
    return minDays;
  }

  // 95%概率直接返回最小天数
  if (Math.random() < 0.95) {
    return minDays;
  }

  // 剩余5%概率在 [minDays+1, maxDays] 之间按指数衰减分配
  const remainingDays = [];
  const weights = [];
  let totalWeight = 0;

  for (let d = minDays + 1; d <= maxDays; d++) {
    remainingDays.push(d);
    // 权重 = 1/(2^d)，让更大的天数概率更低
    const weight = 1 / Math.pow(2, d - minDays);
    weights.push(weight);
    totalWeight += weight;
  }

  // 生成随机数
  let random = Math.random() * totalWeight;

  // 根据权重选择天数
  for (let i = 0; i < remainingDays.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return remainingDays[i];
    }
  }

  // 默认返回最小天数（保险措施）
  return minDays;
}

// 验证QQ邮箱
function isQQEmail(email) {
  return /^[1-9]\d{4,10}@qq\.com$/i.test(email);
}

// 获取当前进行中的发放活动
async function getActiveCampaign() {
  const campaigns = await query(
    `SELECT * FROM key_distribution_campaigns 
     WHERE status = 'active' 
     AND remaining_quota > 0
     AND (end_at IS NULL OR end_at > NOW())
     ORDER BY created_at DESC
     LIMIT 1`
  );
  return campaigns[0] || null;
}

// 检查邮箱当天是否已领取
async function hasClaimedToday(email) {
  const today = new Date().toISOString().slice(0, 10);
  const claims = await query(
    `SELECT id FROM email_key_claims 
     WHERE email = ? AND claim_date = ?`,
    [email, today]
  );
  return claims.length > 0;
}

// 用户获取密钥（无需登录）
router.post('/claim', async (req, res) => {
  const { email } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;

  // 验证邮箱格式
  if (!email) {
    return res.status(400).json({ success: false, message: '请输入邮箱地址' });
  }

  if (!isQQEmail(email)) {
    return res.status(400).json({ success: false, message: '请使用QQ邮箱（如：123456@qq.com）' });
  }

  try {
    // 检查邮箱是否在黑名单中
    const isBlacklisted = await systemSettingsService.isEmailBlacklisted(email);
    if (isBlacklisted) {
      return res.status(403).json({
        success: false,
        message: '该邮箱已被限制领取密钥'
      });
    }

    // 检查当天是否已领取
    if (await hasClaimedToday(email)) {
      return res.status(400).json({
        success: false,
        message: '您今天已经领取过密钥了，请明天再来'
      });
    }

    // 获取当前进行中的活动
    const campaign = await getActiveCampaign();
    if (!campaign) {
      return res.status(400).json({
        success: false,
        message: '当前没有可用的密钥发放活动，请稍后再试'
      });
    }

    // 事务处理 - 实时生成密钥
    const result = await transaction(async (connection) => {
      // 1. 检查活动是否还有剩余名额（使用FOR UPDATE锁定行）
      const [campaignRows] = await connection.execute(
        `SELECT remaining_quota FROM key_distribution_campaigns
         WHERE id = ? AND status = 'active' AND remaining_quota > 0
         FOR UPDATE`,
        [campaign.id]
      );

      if (campaignRows.length === 0) {
        throw new Error('活动密钥已发放完毕');
      }

      // 2. 实时生成密钥
      const keyValue = generateKey();
      // 使用加权随机生成有效天数（天数越少概率越高）
      const validDays = generateWeightedDays(campaign.min_days, campaign.max_days);

      // 计算过期时间
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + validDays);

      // 3. 创建密钥记录
      const [keyResult] = await connection.execute(
        `INSERT INTO distributed_keys
         (campaign_id, key_value, valid_days, claimed_by_email, claimed_at, expires_at)
         VALUES (?, ?, ?, ?, NOW(), ?)`,
        [campaign.id, keyValue, validDays, email, expiresAt]
      );
      const keyId = keyResult.insertId;

      // 4. 更新活动剩余名额
      await connection.execute(
        `UPDATE key_distribution_campaigns
         SET remaining_quota = remaining_quota - 1
         WHERE id = ?`,
        [campaign.id]
      );

      // 5. 记录邮箱领取
      const today = new Date().toISOString().slice(0, 10);
      await connection.execute(
        `INSERT INTO email_key_claims (email, claim_date, key_id, ip_address, campaign_id)
         VALUES (?, ?, ?, ?, ?)`,
        [email, today, keyId, ipAddress, campaign.id]
      );

      // 6. 将密钥添加到注册密钥表
      await connection.execute(
        `INSERT INTO registration_keys (key_value, expires_at, created_by)
         VALUES (?, ?, ?)`,
        [keyValue, expiresAt, campaign.created_by]
      );

      return { keyId, keyValue, validDays, expiresAt };
    });

    // 7. 发送邮件
    try {
      await emailService.sendEmail({
        to: email,
        subject: '【QQ农场助手】您的激活密钥',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4CAF50;">🎉 恭喜您获得QQ农场助手激活密钥！</h2>
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>您的密钥：</strong></p>
              <p style="font-size: 18px; color: #2196F3; font-family: monospace; background: #fff; padding: 10px; border-radius: 4px;">${result.keyValue}</p>
              <p><strong>有效期：</strong>${result.validDays} 天</p>
              <p><strong>过期时间：</strong>${result.expiresAt.toLocaleString('zh-CN')}</p>
            </div>
            <div style="margin-top: 20px;">
              <p><strong>使用说明：</strong></p>
              <ol>
                <li>访问 QQ农场助手 网站</li>
                <li><strong>新用户：</strong>点击"注册账号"，输入您的密钥进行激活</li>
                <li><strong>已有账号：</strong>登录后点击右上角用户名，在下拉菜单中选择"更换密钥"，输入新密钥即可更换</li>
                <li>也可以在登录页面直接填入密钥进行激活</li>
              </ol>
            </div>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              此邮件由系统自动发送，请勿回复。<br>
              如有问题，请联系管理员，或加入QQ群聊：1082121037。
            </p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('发送邮件失败:', emailError);
      // 邮件发送失败不影响密钥生成，但记录错误
    }

    res.json({
      success: true,
      message: '密钥已发送至您的邮箱，请查收',
      data: {
        email: email.replace(/(.{3}).*(@.*)/, '$1***$2'), // 隐藏部分邮箱
        days: result.validDays
      }
    });

  } catch (error) {
    console.error('领取密钥失败:', error);
    res.status(500).json({ success: false, message: error.message || '领取失败，请稍后再试' });
  }
});

// 获取当前活动信息（无需登录）
router.get('/campaign', async (req, res) => {
  try {
    const campaign = await getActiveCampaign();
    if (!campaign) {
      return res.json({
        success: true,
        data: null,
        message: '当前没有进行中的发放活动'
      });
    }

    res.json({
      success: true,
      data: {
        name: campaign.name,
        minDays: campaign.min_days,
        maxDays: campaign.max_days,
        totalQuota: campaign.total_quota,
        remainingQuota: campaign.remaining_quota,
        startAt: campaign.start_at,
        endAt: campaign.end_at
      }
    });
  } catch (error) {
    console.error('获取活动信息失败:', error);
    res.status(500).json({ success: false, message: '获取信息失败' });
  }
});

// 检查邮箱是否可领取（无需登录）
router.post('/check-email', async (req, res) => {
  const { email } = req.body;

  if (!email || !isQQEmail(email)) {
    return res.json({
      success: true,
      canClaim: false,
      message: '请输入有效的QQ邮箱'
    });
  }

  try {
    const hasClaimed = await hasClaimedToday(email);
    const campaign = await getActiveCampaign();

    if (hasClaimed) {
      return res.json({
        success: true,
        canClaim: false,
        message: '您今天已经领取过密钥了'
      });
    }

    if (!campaign) {
      return res.json({
        success: true,
        canClaim: false,
        message: '当前没有可用的发放活动'
      });
    }

    res.json({
      success: true,
      canClaim: true,
      message: '可以领取密钥'
    });
  } catch (error) {
    console.error('检查邮箱失败:', error);
    res.status(500).json({ success: false, message: '检查失败' });
  }
});

module.exports = router;
