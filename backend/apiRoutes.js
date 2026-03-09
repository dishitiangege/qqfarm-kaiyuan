const express = require('express');
const fs = require('fs');
const path = require('path');
const accountManager = require('./accountManagerWorker');
const dataCollector = require('./dataCollector');
const logManager = require('./logManager');
const { QRLoginService } = require('./qrLogin');

const router = express.Router();

// 加载植物配置
let plantConfig = [];
try {
  const plantData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'gameConfig', 'Plant.json'), 'utf8'));
  plantConfig = plantData;
} catch (e) {
  console.error('加载植物配置失败:', e.message);
}

// 格式化生长时间
function formatGrowTime(growPhases) {
  if (!growPhases) return '未知';
  const phases = growPhases.split(';').filter(p => p);
  let totalSeconds = 0;
  for (const phase of phases) {
    const match = phase.match(/:(\d+)/);
    if (match) {
      totalSeconds += parseInt(match[1]);
    }
  }
  
  if (totalSeconds < 60) return `${totalSeconds}秒`;
  if (totalSeconds < 3600) return `${Math.floor(totalSeconds / 60)}分钟`;
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  return mins > 0 ? `${hours}小时${mins}分` : `${hours}小时`;
}

// 获取所有账号
router.get('/accounts', async (req, res) => {
  console.log('[API] 获取账号列表');
  const accounts = await accountManager.getAccounts();
  console.log('[API] 返回账号列表:', accounts.map(a => ({ id: a.id, isRunning: a.isRunning, status: a.status })));
  res.json(accounts);
});

// 添加账号
router.post('/accounts', (req, res) => {
  const { code, platform } = req.body;
  if (!code || !platform) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  try {
    const account = accountManager.addAccount(code, platform);
    res.status(201).json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除账号
router.delete('/accounts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await accountManager.removeAccount(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取账号实时数据
router.get('/accounts/:id/data', (req, res) => {
  const { id } = req.params;
  try {
    const data = dataCollector.getAccountData(id);
    if (data) {
      res.json(data);
    } else {
      res.status(404).json({ error: '暂无数据，账号可能未启动或尚未连接' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新账号配置
router.put('/accounts/:id/config', (req, res) => {
  const { id } = req.params;
  const config = req.body;
  try {
    const updatedAccount = accountManager.updateAccountConfig(id, config);
    res.json(updatedAccount);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新账号登录code（重新登录）
router.put('/accounts/:id/relogin', async (req, res) => {
  const { id } = req.params;
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: '缺少code参数' });
  }

  try {
    console.log(`[API] 更新账号 ${id} 的登录code`);
    const updatedAccount = await accountManager.updateAccountCode(id, code);
    console.log(`[API] 账号 ${id} 更新成功`);
    res.json(updatedAccount);
  } catch (error) {
    console.error(`[API] 更新账号 ${id} 失败:`, error.message);
    console.error(error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// 测试邮件发送
router.post('/accounts/:id/test-email', async (req, res) => {
  const { id } = req.params;
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: '请填写邮箱地址' });
  }

  try {
    const accounts = await accountManager.getAccounts();
    const account = accounts.find(a => a.id === id);
    if (!account) {
      return res.status(404).json({ success: false, message: '账号不存在' });
    }

    const emailService = require('./services/emailService');

    // 检查邮件服务是否已启用
    if (!emailService.config || !emailService.config.enabled) {
      return res.status(400).json({ success: false, message: '邮件服务未启用' });
    }

    // 检查邮件服务是否已初始化
    if (!emailService.transporter) {
      return res.status(400).json({ success: false, message: '邮件服务未正确初始化，请检查SMTP配置' });
    }

    const result = await emailService.sendEmail({
      to: email,
      subject: '【QQ农场助手】测试邮件',
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #22c55e;">测试邮件</h2>
        <p>这是一封测试邮件，用于验证您的邮箱配置是否正确。</p>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>账号名称:</strong> ${account.name}</p>
          <p><strong>测试时间:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <p style="color: #666; font-size: 12px;">此邮件由 QQ农场助手 自动发送</p>
      </div>
      `
    });

    if (result && result.success) {
      res.json({ success: true, message: '测试邮件已发送，请查收' });
    } else {
      res.json({ success: false, message: '邮件发送失败，请检查发件邮箱配置（SMTP密码是否正确）' });
    }
  } catch (error) {
    console.error('[测试邮件] 发送失败:', error);
    res.status(500).json({ success: false, message: '邮件发送失败: ' + error.message });
  }
});

// 启动账号
router.post('/accounts/:id/start', (req, res) => {
  const { id } = req.params;
  try {
    accountManager.startAccount(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 停止账号
router.post('/accounts/:id/stop', (req, res) => {
  const { id } = req.params;
  try {
    accountManager.stopAccount(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取账号状态
router.get('/accounts/:id/status', (req, res) => {
  const { id } = req.params;
  try {
    const status = accountManager.getAccountStatus(id);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取账号日志
router.get('/accounts/:id/logs', (req, res) => {
  const { id } = req.params;
  const limit = parseInt(req.query.limit) || 100;
  try {
    const logs = logManager.getLogs(id, limit);
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 清空账号日志
router.delete('/accounts/:id/logs', (req, res) => {
  const { id } = req.params;
  try {
    logManager.clearLogs(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 手动获取好友列表
router.post('/accounts/:id/fetch-friends', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await accountManager.fetchFriendsManually(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 手动售卖果实
router.post('/accounts/:id/sell-fruits', async (req, res) => {
  const { id } = req.params;
  const { itemIds, uids } = req.body; // 可选参数，itemIds按ID售卖，uids按uid精确售卖
  try {
    const result = await accountManager.sellFruits(id, itemIds, uids);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 手动收获土地
router.post('/accounts/:id/harvest-lands', async (req, res) => {
  const { id } = req.params;
  const { landIds } = req.body; // 要收获的土地ID列表
  try {
    const result = await accountManager.harvestLands(id, landIds);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 手动种植土地
router.post('/accounts/:id/plant-lands', async (req, res) => {
  const { id } = req.params;
  const { landIds, seedId } = req.body; // 要种植的土地ID列表和种子ID
  try {
    const result = await accountManager.plantLands(id, landIds, seedId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== 二维码登录 API ==========

// 创建二维码
router.post('/qr/create', async (req, res) => {
  try {
    const result = await QRLoginService.requestLoginCode();
    res.json({
      success: true,
      code: result.code,
      qrcode: result.qrcode,
      url: result.url
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 检查二维码状态
router.post('/qr/check', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, message: '缺少code参数' });
  }

  // 安全校验
  if (!/^[a-zA-Z0-9+/=._-]+$/.test(code)) {
    return res.status(400).json({ success: false, message: 'Invalid code format' });
  }

  try {
    const result = await QRLoginService.checkStatus(code);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== 植物/种子 API ==========

// 获取可种植的植物列表
router.get('/plants', (req, res) => {
  const { level } = req.query;
  const userLevel = parseInt(level) || 1;

  try {
    // 过滤出有效的植物（有 seed_id 的）
    const validPlants = plantConfig.filter(plant => plant.seed_id);
    
    // 去重并排序：保留 id 以 1 开头的植物（正常版），并按原始顺序排列
    // 因为新手版 id 以 2 开头（如 2020002），正常版 id 以 1 开头（如 1020002）
    const seenNames = new Set();
    const uniquePlants = [];
    
    for (const plant of validPlants) {
      // 如果已经处理过这个名字，检查是否需要替换
      if (seenNames.has(plant.name)) {
        const existingIndex = uniquePlants.findIndex(p => p.name === plant.name);
        const existing = uniquePlants[existingIndex];
        // 如果当前是正常版（id以1开头），已存在的是新手版（id以2开头），替换
        if (String(plant.id).startsWith('1') && String(existing.id).startsWith('2')) {
          uniquePlants[existingIndex] = plant;
        }
      } else {
        // 第一次遇到这个植物
        seenNames.add(plant.name);
        uniquePlants.push(plant);
      }
    }
    
    // 逻辑：等级1显示前1个作物，等级2显示前2个作物，以此类推
    // 不再跳过任何作物
    const endIndex = Math.min(userLevel, uniquePlants.length);
    
    // 获取当前等级可显示的作物
    const availablePlants = uniquePlants
      .slice(0, endIndex)
      .map((plant, index) => ({
        id: plant.id,
        name: plant.name,
        seedId: plant.seed_id,
        levelNeed: index + 1, // 显示解锁等级：第1个显示Lv1，第2个显示Lv2...
        exp: plant.exp,
        growTime: formatGrowTime(plant.grow_phases),
        growPhases: plant.grow_phases,
        displayName: `${plant.name} (Lv${index + 1}) ${formatGrowTime(plant.grow_phases)}`
      }));

    res.json({
      success: true,
      plants: availablePlants
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取每日礼包状态
router.get('/accounts/:id/daily-gifts', async (req, res) => {
  const { id } = req.params;
  try {
    const dailyGifts = await accountManager.getDailyGifts(id);
    res.json({ success: true, data: dailyGifts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
