const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase, closePool } = require('./db');
const apiRoutes = require('./apiRoutes');
const userRoutes = require('./userRoutes');
const keyRoutes = require('./keyRoutes');
const announcementRoutes = require('./announcementRoutes');
const keyDistributionRoutes = require('./keyDistributionRoutes');
const adminKeyDistributionRoutes = require('./adminKeyDistributionRoutes');
const recommendationRoutes = require('./routes/recommendation');
const landManagementRoutes = require('./routes/land-management');
const upgradeKeyRoutes = require('./routes/upgradeKeyRoutes');
// 使用 Worker 线程版本的管理器（高性能，适合多账号）
const accountManager = require('./accountManagerWorker');
console.log('[服务器] 使用 Worker 线程版本账号管理器');
const keyService = require('./keyService');
const upgradeKeyExpiryService = require('./services/upgradeKeyExpiryService');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const PORT = 6001;

// CORS 配置
const corsOptions = {
  origin: ['https://farm.hk-gov.com', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// 中间件
app.use(cors(corsOptions));
app.use(express.json());

// API路由
app.use('/api', apiRoutes);
app.use('/api/auth', userRoutes); // 用户认证相关路由

// 密钥管理路由
console.log('[服务器] 加载 keyRoutes...');
app.use('/api/keys', keyRoutes);

// 密钥发放系统路由（无需登录）
console.log('[服务器] 加载 keyDistributionRoutes...');
app.use('/api/key-distribution', keyDistributionRoutes);

// 管理员密钥发放路由（需要登录）
console.log('[服务器] 加载 adminKeyDistributionRoutes...');
app.use('/api/admin/key-distribution', authenticateToken, adminKeyDistributionRoutes);

app.use('/api/announcements', announcementRoutes); // 公告管理路由

// 推荐系统路由
console.log('[服务器] 加载 recommendationRoutes...');
app.use('/api/recommendation', recommendationRoutes);

// 土地管理路由
console.log('[服务器] 加载 landManagementRoutes...');
app.use('/api/lands', landManagementRoutes);

// 升级密钥路由
console.log('[服务器] 加载 upgradeKeyRoutes...');
app.use('/api/upgrade-keys', upgradeKeyRoutes);

// Worker 池状态 API
app.get('/api/worker-pool/status', authenticateToken, (req, res) => {
  try {
    const status = accountManager.getPoolStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 静态文件服务（用于前端构建文件）
const distPath = path.resolve(__dirname, '../frontend/dist');
console.log('[服务器] 静态文件目录:', distPath);
app.use(express.static(distPath));

// 游戏配置数据静态文件服务
app.use('/gameConfig', express.static(path.join(__dirname, '../gameConfig')));

// tools 数据静态文件服务
app.use('/tools', express.static(path.join(__dirname, '../tools')));

// 前端页面路由 - 处理所有未匹配的路径（排除 API 路径）
app.use((req, res) => {
  // 排除 API 路径
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  // 返回 index.html（前端路由）
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库
    await initDatabase();
    console.log('[服务器] 数据库初始化完成');
    
    // 启动服务器
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      // 初始化账号管理器
      accountManager.init();
      // 启动密钥到期检查任务
      keyService.startExpiryCheckTask();
      // 启动升级密钥到期检查任务
      upgradeKeyExpiryService.start();
    });
  } catch (error) {
    console.error('[服务器] 启动失败:', error);
    process.exit(1);
  }
}

startServer();

process.on('SIGINT', async () => {
  console.log('正在关闭服务器...');

  // 强制刷盘，保存每日统计数据
  const dailyStatsService = require('./services/dailyStatsService');
  await dailyStatsService.forceFlush();

  accountManager.cleanup();
  const dataCollector = require('./dataCollector');
  dataCollector.flush();
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('正在关闭服务器...');

  // 强制刷盘，保存每日统计数据
  const dailyStatsService = require('./services/dailyStatsService');
  await dailyStatsService.forceFlush();

  accountManager.cleanup();
  const dataCollector = require('./dataCollector');
  dataCollector.flush();
  await closePool();
  process.exit(0);
});
