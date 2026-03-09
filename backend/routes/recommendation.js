/**
 * 推荐 API 路由
 * 提供经验计算和种子推荐功能
 */

const express = require('express');
const router = express.Router();
const { calculateFarmRecommendation } = require('../core/exp-calculator');
const accountManager = require('../accountManagerWorker');

// 作物配置缓存
let plantsCache = null;

/**
 * 加载作物配置
 */
function loadPlantsConfig() {
  if (plantsCache) return plantsCache;

  try {
    const fs = require('fs');
    const path = require('path');
    const plantPath = path.join(__dirname, '../../gameConfig/Plant.json');
    const data = fs.readFileSync(plantPath, 'utf8');
    const plants = JSON.parse(data);
    plantsCache = plants;
    return plants;
  } catch (error) {
    console.error('加载作物配置失败:', error);
    return [];
  }
}

/**
 * 获取账号的土地分布
 * @param {string} accountId - 账号ID
 * @returns {Map<number, number>} 土地分布 Map<等级, 数量>
 */
function getLandDistribution(accountId) {
  const account = accountManager.getAccount(accountId);
  if (!account || !account.stats || !account.stats.landStatus) {
    return new Map([[1, 18]]); // 默认18块普通地
  }

  const landStatus = account.stats.landStatus;
  const distribution = new Map();

  for (const land of landStatus) {
    if (typeof land === 'object' && land.landLevel) {
      const level = land.landLevel;
      distribution.set(level, (distribution.get(level) || 0) + 1);
    }
  }

  // 如果没有数据，默认18块地
  if (distribution.size === 0) {
    return new Map([[1, 18]]);
  }

  return distribution;
}

/**
 * GET /api/recommendation/:accountId
 * 获取指定账号的种子推荐
 */
router.get('/:accountId', (req, res) => {
  try {
    const { accountId } = req.params;
    const account = accountManager.getAccount(accountId);

    if (!account) {
      return res.status(404).json({ success: false, message: '账号不存在' });
    }

    const plants = loadPlantsConfig();
    const landDist = getLandDistribution(accountId);
    const playerLevel = account.level || 1;

    const recommendation = calculateFarmRecommendation(landDist, {
      playerLevel,
      top: 10,
      plants,
    });

    res.json({
      success: true,
      data: recommendation,
    });
  } catch (error) {
    console.error('获取推荐失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/recommendation/calculate
 * 根据土地分布计算推荐（无需账号ID）
 */
router.post('/calculate', (req, res) => {
  try {
    const { landDistribution, playerLevel, plants } = req.body;

    // 转换土地分布格式
    const landDist = new Map();
    if (landDistribution && typeof landDistribution === 'object') {
      for (const [key, value] of Object.entries(landDistribution)) {
        landDist.set(Number(key), Number(value));
      }
    }

    // 如果没有提供土地分布，使用默认
    if (landDist.size === 0) {
      landDist.set(1, 18);
    }

    const plantsConfig = plants || loadPlantsConfig();

    const recommendation = calculateFarmRecommendation(landDist, {
      playerLevel: playerLevel || 1,
      top: 10,
      plants: plantsConfig,
    });

    res.json({
      success: true,
      data: recommendation,
    });
  } catch (error) {
    console.error('计算推荐失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
