/**
 * 经验计算器 - 按土地等级分组计算最优种子
 * 参考 new sample 的实现
 */

// 土地等级 Buff 配置（万分比）
const DEFAULT_LAND_BUFFS = new Map([
  [1, { timeReduction: 0, expBonus: 0, yieldBonus: 0 }],      // 普通
  [2, { timeReduction: 0, expBonus: 0, yieldBonus: 10000 }],  // 红土 +100%产量
  [3, { timeReduction: 1000, expBonus: 0, yieldBonus: 20000 }], // 黑土 -10%时间, +200%产量
  [4, { timeReduction: 2000, expBonus: 0, yieldBonus: 30000 }], // 金土 -20%时间, +300%产量
]);

// 操作耗时参数
const DEFAULT_TIMING = {
  rttSec: 0.15,           // 单次 RPC 往返（秒）
  sleepBetweenSec: 0.05,  // 逐块操作间 sleep（秒）
  fixedRpcCount: 3,       // 循环固定 RPC 次数
  checkIntervalSec: 1,    // 农场巡检间隔（秒）
};

// exp/h 差距在此比例内视为等价，优先长周期（省金币、少操作）
const EXP_EQUIV_RATIO = 0.01;

/**
 * 解析生长阶段时间
 * @param {string} growPhases - 如 "种子:2880;发芽:2880;小叶子:2880;..."
 * @returns {number[]} 各阶段时间数组（秒）
 */
function parseGrowPhases(growPhases) {
  if (!growPhases) return [];
  return growPhases
    .split(';')
    .map(x => x.trim())
    .filter(Boolean)
    .map(seg => {
      const parts = seg.split(':');
      return parts.length >= 2 ? Number(parts[1]) || 0 : 0;
    });
}

/**
 * 获取土地 Buff
 * @param {number} level - 土地等级
 * @returns {Object} { timeReduction, expBonus, yieldBonus }
 */
function getLandBuff(level) {
  const buff = DEFAULT_LAND_BUFFS.get(level);
  return buff || { timeReduction: 0, expBonus: 0, yieldBonus: 0 };
}

/**
 * 计算单个作物在指定土地等级的收益
 * @param {Object} plant - 作物配置
 * @param {number} landLevel - 土地等级
 * @param {number} landCount - 土地数量
 * @param {Object} timing - 操作耗时参数
 * @returns {Object|null} 收益信息
 */
function calcPlantYield(plant, landLevel, landCount, timing = DEFAULT_TIMING) {
  const phases = parseGrowPhases(plant.grow_phases);
  const nonZeroPhases = phases.filter(p => p > 0);
  if (nonZeroPhases.length === 0) return null;

  const baseGrow = nonZeroPhases.reduce((a, b) => a + b, 0);
  const firstPhase = nonZeroPhases[0];
  const buff = getLandBuff(landLevel);
  const timeReduction = buff.timeReduction / 10000;
  const expBonus = buff.expBonus / 10000;

  const seedId = plant.seed_id;
  const unlockLevel = plant.unlock_level || 1;
  const seedPrice = plant.seed_price || 0;
  const seasons = plant.seasons || 1;
  const expPerHarvest = plant.exp * (1 + expBonus);
  const expPerCycle = expPerHarvest * seasons;

  // 动态循环时序模型
  const detectionDelay = (timing.rttSec + timing.checkIntervalSec) / 2;
  const fixedRpcTime = timing.fixedRpcCount * timing.rttSec;
  const perLand = timing.rttSec + timing.sleepBetweenSec;

  // 不施肥：生长 + 检测延迟 + 固定RPC + 逐块种植
  const growNoFert = baseGrow * (1 - timeReduction);
  const cycleNoFert = growNoFert + detectionDelay + fixedRpcTime + landCount * perLand;

  // 施肥（跳过第一阶段）：生长 + 检测延迟 + 固定RPC + 逐块(种植+施肥)
  const growWithFert = (baseGrow - firstPhase) * (1 - timeReduction);
  const cycleWithFert = growWithFert + detectionDelay + fixedRpcTime + landCount * perLand * 2;

  const expPerHourNoFert = cycleNoFert > 0 ? ((expPerCycle * landCount) / cycleNoFert) * 3600 : 0;
  const expPerHourWithFert = cycleWithFert > 0 ? ((expPerCycle * landCount) / cycleWithFert) * 3600 : 0;

  return {
    plantId: plant.id,
    seedId,
    name: plant.name,
    unlockLevel,
    seedPrice,
    seasons,
    baseGrowTimeSec: baseGrow,
    expPerCycle,
    cycleNoFertSec: cycleNoFert,
    cycleWithFertSec: cycleWithFert,
    expPerHourNoFert,
    expPerHourWithFert,
  };
}

/**
 * 比较两个作物的 exp/h，等价时优先长周期
 * @param {Object} a
 * @param {Object} b
 * @param {string} key - 'expPerHourNoFert' | 'expPerHourWithFert'
 * @returns {number}
 */
function compareYield(a, b, key) {
  const va = a[key];
  const vb = b[key];
  const max = Math.max(Math.abs(va), Math.abs(vb));
  if (max > 0 && Math.abs(vb - va) / max < EXP_EQUIV_RATIO) {
    return b.baseGrowTimeSec - a.baseGrowTimeSec;
  }
  return vb - va;
}

/**
 * 计算指定土地等级的最优种子
 * @param {number} level - 土地等级
 * @param {number} count - 土地数量
 * @param {number} playerLevel - 玩家等级
 * @param {Object[]} plants - 所有作物配置
 * @param {number} top - 返回前几名
 * @param {Object} timing - 操作耗时参数
 * @returns {Object[]} 排序后的收益列表
 */
function calculateForLandLevel(level, count, playerLevel, plants, top = 20, timing = DEFAULT_TIMING) {
  const results = [];

  for (const plant of plants) {
    const unlockLevel = plant.unlock_level || 1;
    if (playerLevel && unlockLevel > playerLevel) continue;
    if (plant.land_level_need > level) continue;

    const yield_ = calcPlantYield(plant, level, count, timing);
    if (yield_) results.push(yield_);
  }

  results.sort((a, b) => compareYield(a, b, 'expPerHourWithFert'));
  return results.slice(0, top);
}

/**
 * 计算农场推荐
 * @param {Map<number, number>} landDist - 土地分布 Map<等级, 数量>
 * @param {Object} opts - 选项
 * @param {number} opts.playerLevel - 玩家等级
 * @param {number} opts.top - 返回前几名
 * @param {Object[]} opts.plants - 所有作物配置
 * @returns {Object} 推荐结果
 */
function calculateFarmRecommendation(landDist, opts = {}) {
  const playerLevel = opts.playerLevel;
  const top = opts.top || 10;
  const plants = opts.plants || [];

  let totalLands = 0;
  let totalExpNoFert = 0;
  let totalExpWithFert = 0;
  const byLevel = [];

  for (const [level, count] of landDist) {
    if (count <= 0) continue;
    totalLands += count;

    const ranked = calculateForLandLevel(level, count, playerLevel, plants, top);
    const rankedNoFert = [...ranked].sort((a, b) => compareYield(a, b, 'expPerHourNoFert'));

    const bestNoFert = rankedNoFert[0] || null;
    const bestWithFert = ranked[0] || null;

    if (bestNoFert) totalExpNoFert += bestNoFert.expPerHourNoFert;
    if (bestWithFert) totalExpWithFert += bestWithFert.expPerHourWithFert;

    byLevel.push({
      landLevel: level,
      landCount: count,
      bestNoFert: bestNoFert ? {
        seedId: bestNoFert.seedId,
        name: bestNoFert.name,
        expPerHour: Number(bestNoFert.expPerHourNoFert.toFixed(2)),
        cycleTime: Math.round(bestNoFert.cycleNoFertSec),
      } : null,
      bestWithFert: bestWithFert ? {
        seedId: bestWithFert.seedId,
        name: bestWithFert.name,
        expPerHour: Number(bestWithFert.expPerHourWithFert.toFixed(2)),
        cycleTime: Math.round(bestWithFert.cycleWithFertSec),
      } : null,
      topNoFert: rankedNoFert.slice(0, top).map(r => ({
        seedId: r.seedId,
        name: r.name,
        expPerHour: Number(r.expPerHourNoFert.toFixed(2)),
        cycleTime: Math.round(r.cycleNoFertSec),
      })),
      topWithFert: ranked.slice(0, top).map(r => ({
        seedId: r.seedId,
        name: r.name,
        expPerHour: Number(r.expPerHourWithFert.toFixed(2)),
        cycleTime: Math.round(r.cycleWithFertSec),
      })),
    });
  }

  return {
    totalLands,
    totalExpPerHourNoFert: Number(totalExpNoFert.toFixed(2)),
    totalExpPerHourWithFert: Number(totalExpWithFert.toFixed(2)),
    byLevel,
  };
}

module.exports = {
  calculateFarmRecommendation,
  calculateForLandLevel,
  parseGrowPhases,
  DEFAULT_LAND_BUFFS,
  DEFAULT_TIMING,
};
