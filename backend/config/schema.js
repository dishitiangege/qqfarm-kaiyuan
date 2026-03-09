const { z } = require('zod');

// 账号配置验证模式
const accountConfigSchema = z.object({
  // 自动功能开关
  autoFarm: z.boolean().default(true),
  autoFriend: z.boolean().default(true),
  autoTask: z.boolean().default(true),
  autoSell: z.boolean().default(false),
  autoFertilize: z.boolean().default(true),

  // 肥料设置
  useOrganicFertilizer: z.boolean().default(true),
  useBothFertilizers: z.boolean().default(false),
  autoRefillNormalFertilizer: z.boolean().default(false),
  autoRefillOrganicFertilizer: z.boolean().default(false),
  fertilizerRefillThreshold: z.number().int().min(10).max(1000).default(100),

  // 种子设置
  seedType: z.string().default('白萝卜 (Lv1) 1分钟'),
  minCropLevel: z.number().int().min(0).default(0),

  // 好友功能开关
  enableFriendCheck: z.boolean().default(true),
  enableSteal: z.boolean().default(true),
  enableHelpWater: z.boolean().default(true),
  enableHelpWeed: z.boolean().default(true),
  enableHelpBug: z.boolean().default(true),
  enablePutBug: z.boolean().default(false),
  enablePutWeed: z.boolean().default(false),

  // 好友白名单（GID列表，这些好友会跳过对应互动）
  stealWhitelist: z.array(z.number()).default([]),
  helpWaterWhitelist: z.array(z.number()).default([]),
  helpWeedWhitelist: z.array(z.number()).default([]),
  helpBugWhitelist: z.array(z.number()).default([]),
  putBugWhitelist: z.array(z.number()).default([]),
  putWeedWhitelist: z.array(z.number()).default([]),

  // 智能功能
  helpOnlyWithExp: z.boolean().default(true),
  enableSmartPlant: z.boolean().default(true),
  skipWhiteRadish: z.boolean().default(false),
  // 跳过的作物列表（作物ID数组）
  skipCrops: z.array(z.number()).default([]),

  // 土地管理
  autoUnlockLand: z.boolean().default(false),
  autoUpgradeLand: z.boolean().default(false),

  // 奖励自动领取
  autoClaimEmail: z.boolean().default(true),
  autoClaimIllustrated: z.boolean().default(true),
  autoClaimFreeGifts: z.boolean().default(true),
  autoClaimVip: z.boolean().default(true),
  autoShare: z.boolean().default(true),
  autoClaimMonthCard: z.boolean().default(true),
  autoClaimOpenServer: z.boolean().default(true),

  // 随机时间好友巡查
  enableRandomFriendInterval: z.boolean().default(false),

  // 使用固定好友列表（关闭好友巡查时使用）
  useFixedFriendList: z.boolean().default(false),
  // 固定好友ID列表（当useFixedFriendList为true时使用）
  fixedFriendIds: z.array(z.number()).default([]),

  // 随机种植时间间隔（毫秒）
  plantIntervalMin: z.number().int().min(100).max(20000).default(100),
  plantIntervalMax: z.number().int().min(100).max(20000).default(1000),

  // 防偷菜功能
  enableAntiSteal: z.boolean().default(false),
  // 防偷菜提前时间（秒），范围20-120秒
  antiStealAdvanceTime: z.number().int().min(20).max(120).default(30),

  // 操作系统设置
  os: z.enum(['iOS', 'Android']).default('iOS'),

  // 设备信息设置
  deviceTemplate: z.string().default(''),
  sysSoftware: z.string().default(''),
  network: z.enum(['wifi', '4g', '5g']).default('wifi'),
  memory: z.string().default(''),
  deviceId: z.string().default(''),

  // 反检测系统
  antiDetection: z.object({
    enabled: z.boolean().default(false),
    humanMode: z.object({
      intensity: z.enum(['low', 'medium', 'high']).default('medium'),
    }).default({ intensity: 'medium' }),
    protocol: z.object({
      enableTlog: z.boolean().default(true),
      deviceProfile: z.string().default('auto'),
    }).default({ enableTlog: true, deviceProfile: 'auto' }),
  }).default({
    enabled: false,
    humanMode: { intensity: 'medium' },
    protocol: { enableTlog: true, deviceProfile: 'auto' },
  }),
});

// 账号数据验证模式
const accountSchema = z.object({
  id: z.string(),
  name: z.string().default('新账号'),
  level: z.number().int().min(1).default(1),
  status: z.enum(['online', 'offline', 'connecting', 'error']).default('offline'),
  platform: z.enum(['qq', 'wx']).default('qq'),
  code: z.string(),
  email: z.string().email().optional().default(''),
  farmInterval: z.number().int().min(1).max(600).default(10),
  friendInterval: z.number().int().min(1).max(600).default(10),
  config: accountConfigSchema,
});

// 验证账号配置
function validateAccountConfig(config) {
  try {
    // 处理 null 或 undefined 的情况
    const configToParse = config || {};
    return accountConfigSchema.parse(configToParse);
  } catch (error) {
    console.error('配置验证失败:', error.errors || error.message);
    // 返回默认配置
    return accountConfigSchema.parse({});
  }
}

// 安全合并配置（只合并有效字段）
function mergeAccountConfig(existingConfig, newConfig) {
  try {
    // 先验证新配置
    const validated = accountConfigSchema.partial().parse(newConfig);
    // 合并到现有配置
    return { ...existingConfig, ...validated };
  } catch (error) {
    console.error('配置合并失败:', error.errors);
    return existingConfig;
  }
}

module.exports = {
  accountConfigSchema,
  accountSchema,
  validateAccountConfig,
  mergeAccountConfig,
};
