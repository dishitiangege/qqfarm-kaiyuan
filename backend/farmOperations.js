/**
 * 农场操作模块
 * 封装所有农场相关操作，供 Worker 线程使用
 */

const fs = require('fs');
const path = require('path');

// ============ 智能推荐算法常量 ============
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

class FarmOperations {
  constructor(projectRoot, sendLog, accountId, sendEvent = null) {
    this.projectRoot = projectRoot;
    this.sendLog = sendLog;
    this.accountId = accountId; // 账号ID，用于统计
    this.sendEvent = sendEvent; // 回传事件给 Worker 主线程（可选）

    // 动态加载依赖
    this.loadDependencies();

    // 状态
    this.isRunning = false;
    this.shouldStop = false;
    this.operationLimits = new Map();
    this.taskList = [];
    this.bagItems = [];

    // 本次登录统计（内存中，进程重启清零）
    this.sessionStats = {
      exp: 0, harvest: 0, steal: 0, water: 0, weed: 0, bug: 0, sell: 0,
      loginTime: Date.now()
    };

    // 经验追踪
    this.expTracker = new Map();
    this.expExhausted = new Set();

    // 好友巡查状态
    this.friendLoopState = {
      paused: false,
      pauseTimer: null,
      consecutiveNoActionCount: 0
    };

    // 土地分布缓存
    this.landDistribution = new Map();

    // 加载植物配置
    this.loadPlantConfig();
  }

  loadDependencies() {
    this.proto = require(path.join(this.projectRoot, 'src/proto'));
    this.network = require(path.join(this.projectRoot, 'src/network'));
    this.utils = require(path.join(this.projectRoot, 'src/utils'));
    this.gameConfig = require(path.join(this.projectRoot, 'src/gameConfig'));
    this.email = require(path.join(this.projectRoot, 'src/email'));
    this.illustrated = require(path.join(this.projectRoot, 'src/illustrated'));
    this.shop = require(path.join(this.projectRoot, 'src/shop'));
    this.qqvip = require(path.join(this.projectRoot, 'src/qqvip'));
    this.share = require(path.join(this.projectRoot, 'src/share'));
    this.monthCard = require(path.join(this.projectRoot, 'src/monthCard'));
    this.openServer = require(path.join(this.projectRoot, 'src/openServer'));
    this.configModule = require(path.join(this.projectRoot, 'src/config'));

    // 加载智能推荐工具
    const { getPlantingRecommendation } = require(path.join(this.projectRoot, 'tools/calc-exp-yield'));
    this.getPlantingRecommendation = getPlantingRecommendation;

    // 加载每日统计服务
    this.dailyStatsService = require('./services/dailyStatsService');

    this.types = this.proto.types;
    this.toLong = this.utils.toLong;
    this.toNum = this.utils.toNum;
    this.toTimeSec = this.utils.toTimeSec;
    this.getServerTimeSec = this.utils.getServerTimeSec;
    this.sleep = this.utils.sleep;
    this.CONFIG = this.configModule.CONFIG;
  }

  loadPlantConfig() {
    this.plantConfig = {};
    this.seedToPlant = {};
    try {
      const plantData = JSON.parse(fs.readFileSync(
        path.join(this.projectRoot, 'gameConfig/Plant.json'), 
        'utf8'
      ));
      plantData.forEach(plant => {
        this.plantConfig[plant.id] = plant;
        // 建立种子ID到植物的映射
        if (plant.seed_id) {
          this.seedToPlant[plant.seed_id] = plant;
        }
      });
      this.sendLog(`[配置] 已加载植物配置: ${Object.keys(this.plantConfig).length} 种`);
    } catch (e) {
      this.sendLog(`[配置] 加载作物配置失败: ${e.message}`);
    }
  }

  // ============ 合种辅助函数 ============

  /**
   * 根据种子ID获取作物尺寸
   * @param {number} seedId - 种子ID
   * @returns {number} 尺寸：1=1x1普通作物，2=2x2四格作物
   */
  getPlantSizeBySeedId(seedId) {
    const plant = this.seedToPlant[seedId];
    return Math.max(1, this.toNum(plant && plant.size) || 1);
  }

  /**
   * 根据植物ID获取作物尺寸
   * @param {number} plantId - 植物ID
   * @returns {number} 尺寸：1=1x1普通作物，2=2x2四格作物
   */
  getPlantSize(plantId) {
    const plant = this.plantConfig[plantId];
    return Math.max(1, this.toNum(plant && plant.size) || 1);
  }

  /**
   * 获取副地块ID列表
   * @param {Object} land - 土地信息
   * @returns {number[]} 副地块ID列表
   */
  getSlaveLandIds(land) {
    const ids = Array.isArray(land && land.slave_land_ids) ? land.slave_land_ids : [];
    return [...new Set(ids.map(id => this.toNum(id)).filter(Boolean))];
  }

  /**
   * 判断土地是否有植物数据
   * @param {Object} land - 土地信息
   * @returns {boolean}
   */
  hasPlantData(land) {
    const plant = land && land.plant;
    return !!(plant && Array.isArray(plant.phases) && plant.phases.length > 0);
  }

  /**
   * 获取关联的主地块
   * @param {Object} land - 当前土地
   * @param {Map} landsMap - 土地映射表
   * @returns {Object|null} 主地块信息
   */
  getLinkedMasterLand(land, landsMap) {
    const landId = this.toNum(land && land.id);
    const masterLandId = this.toNum(land && land.master_land_id);
    if (!masterLandId || masterLandId === landId) return null;

    const masterLand = landsMap.get(masterLandId);
    if (!masterLand) return null;

    const slaveIds = this.getSlaveLandIds(masterLand);
    if (slaveIds.length > 0 && !slaveIds.includes(landId)) return null;

    return masterLand;
  }

  /**
   * 获取显示土地上下文（处理合种情况）
   * @param {Object} land - 土地信息
   * @param {Map} landsMap - 土地映射表
   * @returns {Object} 显示上下文
   */
  getDisplayLandContext(land, landsMap) {
    const masterLand = this.getLinkedMasterLand(land, landsMap);
    if (masterLand && this.hasPlantData(masterLand)) {
      const occupiedLandIds = [this.toNum(masterLand.id), ...this.getSlaveLandIds(masterLand)].filter(Boolean);
      return {
        sourceLand: masterLand,
        occupiedByMaster: true,
        masterLandId: this.toNum(masterLand.id),
        occupiedLandIds: occupiedLandIds.length > 0 ? occupiedLandIds : [this.toNum(masterLand.id)].filter(Boolean),
      };
    }

    const selfId = this.toNum(land && land.id);
    return {
      sourceLand: land,
      occupiedByMaster: false,
      masterLandId: selfId,
      occupiedLandIds: [selfId].filter(Boolean),
    };
  }

  /**
   * 判断是否为被主地块占用的副地块
   * @param {Object} land - 土地信息
   * @param {Map} landsMap - 土地映射表
   * @returns {boolean}
   */
  isOccupiedSlaveLand(land, landsMap) {
    return !!this.getDisplayLandContext(land, landsMap).occupiedByMaster;
  }

  /**
   * 构建土地映射表
   * @param {Array} lands - 土地列表
   * @returns {Map} 土地ID到土地信息的映射
   */
  buildLandMap(lands) {
    const map = new Map();
    for (const land of lands) {
      const id = this.toNum(land && land.id);
      if (id > 0) map.set(id, land);
    }
    return map;
  }

  // 生长阶段枚举
  get PlantPhase() {
    return {
      UNKNOWN: 0, SEED: 1, GERMINATION: 2, SMALL_LEAVES: 3,
      LARGE_LEAVES: 4, BLOOMING: 5, MATURE: 6, DEAD: 7,
    };
  }

  get PHASE_NAMES() {
    return ['未知', '种子', '发芽', '小叶', '大叶', '开花', '成熟', '枯死'];
  }

  get OP_IDS() {
    return { WEED: 10005, BUG: 10006, WATER: 10007, STEAL: 10008, PUT_WEED: 10003, PUT_BUG: 10004 };
  }

  // ============ 任务系统 ============
  async getTaskInfo() {
    try {
      const body = this.types.TaskInfoRequest.encode(this.types.TaskInfoRequest.create({})).finish();
      const { body: replyBody } = await this.network.sendMsgAsync('gamepb.taskpb.TaskService', 'TaskInfo', body);
      return this.types.TaskInfoReply.decode(replyBody);
    } catch (e) { return null; }
  }

  async claimTaskReward(taskId, doShared = false) {
    try {
      const body = this.types.ClaimTaskRewardRequest.encode(this.types.ClaimTaskRewardRequest.create({
        id: this.toLong(taskId), do_shared: doShared,
      })).finish();
      const { body: replyBody } = await this.network.sendMsgAsync('gamepb.taskpb.TaskService', 'ClaimTaskReward', body);
      return this.types.ClaimTaskRewardReply.decode(replyBody);
    } catch (e) { return null; }
  }

  async checkAndClaimTasks() {
    try {
      const reply = await this.getTaskInfo();
      if (!reply || !reply.task_info) return;

      const allTasks = [
        ...(reply.task_info.growth_tasks || []),
        ...(reply.task_info.daily_tasks || []),
        ...(reply.task_info.tasks || []),
      ];

      const claimable = allTasks.filter(task => {
        const progress = this.toNum(task.progress);
        const totalProgress = this.toNum(task.total_progress);
        return task.is_unlocked && !task.is_claimed && progress >= totalProgress && totalProgress > 0;
      });

      // 按任务ID去重
      const seenIds = new Set();
      this.taskList = allTasks.filter(task => {
        const id = this.toNum(task.id);
        if (seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      }).map(task => ({
        id: this.toNum(task.id),
        desc: task.desc || `任务#${task.id}`,
        progress: this.toNum(task.progress),
        total: this.toNum(task.total_progress),
        isClaimed: task.is_claimed,
        isUnlocked: task.is_unlocked,
        rewards: (task.rewards || []).map(r => ({ id: this.toNum(r.id), count: this.toNum(r.count) })),
      }));

      this.sendLog(`[任务] 发现 ${claimable.length} 个可领取任务`);

      for (const task of claimable) {
        try {
          const useShare = this.toNum(task.share_multiple) > 1;
          const multipleStr = useShare ? ` (${task.share_multiple}倍)` : '';
          const claimReply = await this.claimTaskReward(task.id, useShare);
          const items = claimReply?.items || [];
          const rewardStr = items.length > 0
            ? items.map(r => (this.toNum(r.id) === 1 ? '金币' : this.toNum(r.id) === 2 ? '经验' : '物品#' + this.toNum(r.id)) + this.toNum(r.count)).join('/')
            : (task.rewards || []).map(r => (this.toNum(r.id) === 1 ? '金币' : '经验') + this.toNum(r.count)).join('/');
          this.sendLog(`[任务] 领取: ${task.desc || task.id}${multipleStr} → ${rewardStr}`);
          this.sessionStats.exp += 10;
        } catch (e) {
          this.sendLog(`[任务] 领取失败: ${task.desc || task.id} - ${e.message}`);
        }
        await this.sleep(300);
      }
    } catch (e) {
      this.sendLog(`[任务] 检查任务失败: ${e.message}`);
    }
  }

  // ============ 仓库系统 ============
  async getBag() {
    try {
      const body = this.types.BagRequest.encode(this.types.BagRequest.create({})).finish();
      const { body: replyBody } = await this.network.sendMsgAsync('gamepb.itempb.ItemService', 'Bag', body);
      return this.types.BagReply.decode(replyBody);
    } catch (e) {
      this.sendLog(`[仓库] 获取背包失败: ${e.message}`);
      return null;
    }
  }

  async sellItems(items) {
    try {
      const payload = items.map(item => ({
        id: item.id != null ? this.toLong(item.id) : undefined,
        count: item.count != null ? this.toLong(item.count) : undefined,
        uid: item.uid != null ? this.toLong(item.uid) : undefined,
      }));
      const body = this.types.SellRequest.encode(this.types.SellRequest.create({ items: payload })).finish();
      const { body: replyBody } = await this.network.sendMsgAsync('gamepb.itempb.ItemService', 'Sell', body);
      return this.types.SellReply.decode(replyBody);
    } catch (e) {
      this.sendLog(`[仓库] 出售请求失败: ${e.message}`);
      return null;
    }
  }

  async sellAllFruits(specificItemIds, specificUids) {
    try {
      const bagReply = await this.getBag();
      if (!bagReply) return;

      const items = bagReply.item_bag?.items || bagReply.items || [];
      this.bagItems = items.map(item => ({
        id: this.toNum(item.id),
        count: this.toNum(item.count),
        uid: item.uid != null ? this.toNum(item.uid) : 0,
        isFruit: this.toNum(item.id) >= 3001 && this.toNum(item.id) <= 49999,
      }));

      const idSet = specificItemIds ? new Set(specificItemIds.map(id => this.toNum(id))) : null;
      const uidSet = specificUids ? new Set(specificUids.map(uid => this.toNum(uid))) : null;

      const toSell = items.filter(item => {
        const id = this.toNum(item.id);
        const count = this.toNum(item.count);
        const uid = item.uid != null ? this.toNum(item.uid) : 0;
        const isValid = id >= 3001 && id <= 49999 && count > 0 && uid !== 0;
        if (!isValid) return false;
        if (uidSet) return uidSet.has(uid);
        if (idSet) return idSet.has(id);
        return true;
      });

      if (toSell.length === 0) {
        this.sendLog('[仓库] 没有果实需要出售');
        return;
      }

      let totalGold = 0;
      for (let i = 0; i < toSell.length; i += 15) {
        const batch = toSell.slice(i, i + 15);
        const reply = await this.sellItems(batch);
        if (reply) {
          let gold = 0;
          if (reply.get_items && reply.get_items.length > 0) {
            for (const item of reply.get_items) {
              if (this.toNum(item.id) === 1001) {
                gold = this.toNum(item.count);
                break;
              }
            }
          }
          if (gold === 0 && reply.gold != null) {
            gold = this.toNum(reply.gold);
          }
          totalGold += gold;
        }
        if (i + 15 < toSell.length) await this.sleep(300);
      }

      if (totalGold > 0) {
        this.sendLog(`[仓库] 出售获得 ${totalGold} 金币`);

        // 更新本次登录统计
        this.sessionStats.sell += totalGold;

        // 写入今日累计
        await this.dailyStatsService.increment(this.accountId, {
          sell: totalGold
        });
      }
      
      // 出售成功后刷新背包数据
      try {
        const newBagReply = await this.getBag();
        if (newBagReply) {
          const newItems = newBagReply.item_bag?.items || newBagReply.items || [];
          this.bagItems = newItems.map(item => ({
            id: this.toNum(item.id),
            count: this.toNum(item.count),
            uid: item.uid != null ? this.toNum(item.uid) : 0,
            isFruit: this.toNum(item.id) >= 3001 && this.toNum(item.id) <= 49999,
          }));
          this.sendLog(`[仓库] 背包已刷新，当前 ${this.bagItems.length} 种物品`);
        }
      } catch (refreshError) {
        this.sendLog(`[仓库] 刷新背包失败: ${refreshError.message}`);
      }
    } catch (e) {
      this.sendLog(`[仓库] 出售失败: ${e.message}`);
    }
  }

  // ============ 农场操作 ============
  async getAllLands(retryCount = 3, timeout = 30000) {
    // 检查连接状态
    if (!this.network.connection.isConnected()) {
      this.sendLog('[土地] 连接未建立，跳过获取土地信息');
      return null;
    }

    for (let i = 0; i < retryCount; i++) {
      try {
        // 每次重试前检查连接状态
        if (!this.network.connection.isConnected()) {
          this.sendLog('[土地] 连接已断开，停止重试');
          return null;
        }

        const body = this.types.AllLandsRequest.encode(this.types.AllLandsRequest.create({})).finish();
        const { body: replyBody } = await this.network.sendMsgAsync('gamepb.plantpb.PlantService', 'AllLands', body, timeout);
        const reply = this.types.AllLandsReply.decode(replyBody);

        // 更新操作限制
        if (reply.operation_limits) {
          for (const limit of reply.operation_limits) {
            const id = this.toNum(limit.id);
            if (id > 0) {
              this.operationLimits.set(id, {
                dayTimes: this.toNum(limit.day_times),
                dayTimesLimit: this.toNum(limit.day_times_lt),
                dayExpTimes: this.toNum(limit.day_exp_times),
                dayExpTimesLimit: this.toNum(limit.day_ex_times_lt),
              });
            }
          }
        }

        if (!reply.lands || reply.lands.length === 0) {
          if (i < retryCount - 1) {
            this.sendLog(`[土地] getAllLands 返回空数据，重试 ${i + 1}/${retryCount}`);
            await this.sleep(500);
            continue;
          }
        }
        return reply;
      } catch (e) {
        if (i < retryCount - 1) {
          this.sendLog(`[土地] getAllLands 失败，重试 ${i + 1}/${retryCount}: ${e.message}`);
          await this.sleep(500);
        } else {
          this.sendLog(`[土地] getAllLands 最终失败: ${e.message}`);
          return null;
        }
      }
    }
    return null;
  }

  async harvest(landIds) {
    const state = this.network.getUserState();
    const body = this.types.HarvestRequest.encode(this.types.HarvestRequest.create({
      land_ids: landIds, host_gid: this.toLong(state.gid), is_all: true,
    })).finish();
    const { body: replyBody } = await this.network.sendMsgAsync('gamepb.plantpb.PlantService', 'Harvest', body);
    return this.types.HarvestReply.decode(replyBody);
  }

  async waterLand(landIds) {
    const state = this.network.getUserState();
    const body = this.types.WaterLandRequest.encode(this.types.WaterLandRequest.create({
      land_ids: landIds, host_gid: this.toLong(state.gid),
    })).finish();
    const { body: replyBody } = await this.network.sendMsgAsync('gamepb.plantpb.PlantService', 'WaterLand', body);
    return this.types.WaterLandReply.decode(replyBody);
  }

  async weedOut(landIds) {
    const state = this.network.getUserState();
    const body = this.types.WeedOutRequest.encode(this.types.WeedOutRequest.create({
      land_ids: landIds, host_gid: this.toLong(state.gid),
    })).finish();
    const { body: replyBody } = await this.network.sendMsgAsync('gamepb.plantpb.PlantService', 'WeedOut', body);
    return this.types.WeedOutReply.decode(replyBody);
  }

  async insecticide(landIds) {
    const state = this.network.getUserState();
    const body = this.types.InsecticideRequest.encode(this.types.InsecticideRequest.create({
      land_ids: landIds, host_gid: this.toLong(state.gid),
    })).finish();
    const { body: replyBody } = await this.network.sendMsgAsync('gamepb.plantpb.PlantService', 'Insecticide', body);
    return this.types.InsecticideReply.decode(replyBody);
  }

  async fertilize(landIds, fertilizerId = 1011, config = {}) {
    let successCount = 0;
    let lastCount = -1;
    
    const shouldRefill = fertilizerId === 1011 
      ? config.autoRefillNormalFertilizer 
      : config.autoRefillOrganicFertilizer;
    const fertilizerRefillThreshold = config.fertilizerRefillThreshold || 100;
    
    for (const landId of landIds) {
      let fertilized = false;
      let retryCount = 0;
      const maxRetries = shouldRefill ? 1 : 0;
      
      while (!fertilized && retryCount <= maxRetries) {
        try {
          const body = this.types.FertilizeRequest.encode(this.types.FertilizeRequest.create({
            land_ids: [this.toLong(landId)],
            fertilizer_id: this.toLong(fertilizerId),
          })).finish();
          const { body: replyBody } = await this.network.sendMsgAsync('gamepb.plantpb.PlantService', 'Fertilize', body);
          const reply = this.types.FertilizeReply.decode(replyBody);
          // 获取施肥后的肥料数量
          if (reply.fertilizer && reply.fertilizer.count != null) {
            lastCount = this.toNum(reply.fertilizer.count);
          }
          successCount++;
          fertilized = true;
        } catch (e) {
          this.sendLog(`[施肥] 施肥失败(土地${landId}): ${e.message}`);
          // 检查是否是肥料不足的错误，且还有重试次数
          if (retryCount < maxRetries && e.message && (e.message.includes('容器不足') || e.message.includes('1000019'))) {
            this.sendLog('[施肥] 需要补充肥料，开始补充...');
            await this.refillFertilizer(fertilizerId);
            retryCount++;
            continue; // 重试施肥
          }
          // 网络繁忙错误，等待后重试
          if (e.message && (e.message.includes('网络繁忙') || e.message.includes('1020001'))) {
            this.sendLog('[施肥] 网络繁忙，等待500ms后重试...');
            await this.sleep(500);
            retryCount++;
            continue;
          }
          break; // 其他错误或已重试过，跳过这块地
        }
      }
      
      if (landIds.length > 1) await this.sleep(50);
    }
    
    // 检查是否需要补充肥料（用于下次施肥）
    if (shouldRefill && lastCount >= 0 && lastCount <= fertilizerRefillThreshold) {
      await this.refillFertilizer(fertilizerId);
    }
    
    return successCount;
  }

  // 补充肥料函数
  async refillFertilizer(fertilizerId) {
    // 肥料补充道具映射（按优先级排序：大容量优先）
    const FERTILIZER_REFILL_ITEMS = {
      1011: [80004, 80003, 80002, 80001], // 普通肥：12h > 8h > 4h > 1h
      1012: [80014, 80013, 80012, 80011]  // 有机肥：12h > 8h > 4h > 1h
    };
    
    const refillItems = FERTILIZER_REFILL_ITEMS[fertilizerId];
    if (!refillItems) return;

    try {
      // 获取背包信息
      const bagReply = await this.getBag();
      // 背包数据可能在 item_bag.items 或 items 中
      const items = (bagReply && bagReply.item_bag && bagReply.item_bag.items) || 
                    (bagReply && bagReply.items) || [];

      this.sendLog(`[肥料补充] 查询背包找到 ${items.length} 个物品，查找补充道具: [${refillItems.join(',')}]`);

      // 按优先级查找并使用补充道具
      for (const refillId of refillItems) {
        const item = items.find(i => this.toNum(i.id) === refillId && this.toNum(i.count) > 0);
        if (item) {
          const itemName = this.getItemName(refillId);
          this.sendLog(`[肥料补充] 找到补充道具 ${itemName}(${refillId}) x${this.toNum(item.count)}`);
          try {
            const useBody = this.types.UseRequest.encode(this.types.UseRequest.create({
              item: { id: this.toLong(refillId), count: this.toLong(1) }
            })).finish();
            await this.network.sendMsgAsync('gamepb.itempb.ItemService', 'Use', useBody);
            this.sendLog(`[肥料补充] 使用 ${itemName} 补充肥料成功`);
            return;
          } catch (e) {
            this.sendLog(`[肥料补充] 使用 ${itemName} 失败: ${e.message}`);
          }
        }
      }

      // 没有找到可用的补充道具
      const fertilizerName = fertilizerId === 1011 ? '普通肥' : '有机肥';
      this.sendLog(`[肥料补充] ${fertilizerName} 补充道具不足，请通过活动或商店获取`);
    } catch (e) {
      this.sendLog(`[肥料补充] 补充失败: ${e.message}`);
    }
  }

  // 获取物品名称
  getItemName(itemId) {
    const itemNames = {
      80001: '普通化肥(1小时)', 80002: '普通化肥(4小时)', 80003: '普通化肥(8小时)', 80004: '普通化肥(12小时)',
      80011: '有机化肥(1小时)', 80012: '有机化肥(4小时)', 80013: '有机化肥(8小时)', 80014: '有机化肥(12小时)'
    };
    return itemNames[itemId] || `道具${itemId}`;
  }

  async removePlant(landIds) {
    const body = this.types.RemovePlantRequest.encode(this.types.RemovePlantRequest.create({
      land_ids: landIds.map(id => this.toLong(id)),
    })).finish();
    const { body: replyBody } = await this.network.sendMsgAsync('gamepb.plantpb.PlantService', 'RemovePlant', body);
    return this.types.RemovePlantReply.decode(replyBody);
  }

  // ============ 商店与种植 ============
  async getShopInfo(shopId) {
    const body = this.types.ShopInfoRequest.encode(this.types.ShopInfoRequest.create({ shop_id: this.toLong(shopId) })).finish();
    const { body: replyBody } = await this.network.sendMsgAsync('gamepb.shoppb.ShopService', 'ShopInfo', body);
    return this.types.ShopInfoReply.decode(replyBody);
  }

  async buyGoods(goodsId, num, price) {
    const body = this.types.BuyGoodsRequest.encode(this.types.BuyGoodsRequest.create({
      goods_id: this.toLong(goodsId), num: this.toLong(num), price: this.toLong(price),
    })).finish();
    const { body: replyBody } = await this.network.sendMsgAsync('gamepb.shoppb.ShopService', 'BuyGoods', body);
    return this.types.BuyGoodsReply.decode(replyBody);
  }

  async plantSeeds(seedId, landIds, config = {}) {
    this.sendLog(`[种植] 开始种植，种子ID: ${seedId}, 土地: ${landIds?.join(',')}`);
    let successCount = 0;

    // 获取随机种植间隔配置
    const intervalMin = config.plantIntervalMin || 100;
    const intervalMax = config.plantIntervalMax || 1000;

    for (let i = 0; i < landIds.length; i++) {
      const landId = landIds[i];
      try {
        this.sendLog(`[种植] 正在种植土地${landId}...`);
        const writer = require('protobufjs').Writer.create();
        const itemWriter = writer.uint32(18).fork();
        itemWriter.uint32(8).int64(seedId);
        const idsWriter = itemWriter.uint32(18).fork();
        idsWriter.int64(landId);
        idsWriter.ldelim();
        itemWriter.ldelim();
        const body = writer.finish();
        await this.network.sendMsgAsync('gamepb.plantpb.PlantService', 'Plant', body);
        this.sendLog(`[种植] 土地${landId}种植成功`);
        successCount++;
      } catch (e) {
        this.sendLog(`[种植] 种植失败(土地${landId}): ${e.message}`);
      }

      // 如果不是最后一块地，添加随机延迟
      if (i < landIds.length - 1) {
        const randomDelay = Math.floor(Math.random() * (intervalMax - intervalMin + 1)) + intervalMin;
        this.sendLog(`[种植] 等待 ${randomDelay}ms 后继续种植...`);
        await this.sleep(randomDelay);
      }
    }
    this.sendLog(`[种植] 种植完成，成功${successCount}/${landIds?.length}块`);
    return successCount;
  }

  // ============ 土地分析 ============
  getCurrentPhase(phases) {
    if (!phases || phases.length === 0) return null;
    const nowSec = this.getServerTimeSec();
    for (let i = phases.length - 1; i >= 0; i--) {
      const beginTime = this.toTimeSec(phases[i].begin_time);
      if (beginTime > 0 && beginTime <= nowSec) {
        return this.toNum(phases[i].phase);
      }
    }
    return this.toNum(phases[0].phase);
  }

  analyzeLands(lands, antiStealConfig = null) {
    const result = {
      harvestable: [], needWater: [], needWeed: [], needBug: [],
      growing: [], empty: [], dead: [], harvestableInfo: [],
      needAntiSteal: [],  // 需要防偷菜处理的土地
    };

    const nowSec = this.getServerTimeSec();
    const landsMap = this.buildLandMap(lands);

    for (const land of lands) {
      const id = this.toNum(land.id);
      if (!land.unlocked) continue;

      // 跳过被主地块占用的副地块（合种情况）
      if (this.isOccupiedSlaveLand(land, landsMap)) {
        continue;
      }

      const plant = land.plant;
      if (!plant || !plant.phases || plant.phases.length === 0) {
        result.empty.push(id);
        continue;
      }

      const currentPhase = this.getCurrentPhase(plant.phases);
      if (!currentPhase) {
        result.empty.push(id);
        continue;
      }
      const phaseVal = currentPhase;

      if (phaseVal === this.PlantPhase.DEAD) {
        result.dead.push(id);
        continue;
      }

      if (phaseVal === this.PlantPhase.MATURE) {
        result.harvestable.push(id);
        const plantIdNum = this.toNum(plant.id);
        const plantInfo = this.plantConfig[plantIdNum];
        result.harvestableInfo.push({
          landId: id, plantId: plantIdNum,
          name: plantInfo?.name || plant.name || '未知',
          exp: plantInfo?.exp || 0,
        });
        continue;
      }

      // 检查是否需要防偷菜处理
      if (antiStealConfig && antiStealConfig.enabled && phaseVal < this.PlantPhase.MATURE) {
        const matureTime = this.getMatureTime(plant.phases);
        if (matureTime > 0) {
          const timeToMature = matureTime - nowSec;
          // 如果距离成熟时间在设定范围内，加入防偷菜列表
          if (timeToMature > 0 && timeToMature <= antiStealConfig.advanceTime) {
            const plantIdNum = this.toNum(plant.id);
            const plantInfo = this.plantConfig[plantIdNum];
            result.needAntiSteal.push({
              id,
              matureTime,
              timeToMature,
              plantName: plant.name || '未知作物',
              plantId: plantIdNum,
              exp: plantInfo?.exp || 0,
            });
            continue;
          }
        }
      }

      const dryNum = this.toNum(plant.dry_num);
      const dryTime = this.toTimeSec(plant.phases[plant.phases.length - 1]?.dry_time);
      if (dryNum > 0 || (dryTime > 0 && dryTime <= nowSec)) {
        result.needWater.push(id);
      }

      const weedsTime = this.toTimeSec(plant.phases[plant.phases.length - 1]?.weeds_time);
      const hasWeeds = (plant.weed_owners?.length > 0) || (weedsTime > 0 && weedsTime <= nowSec);
      if (hasWeeds) result.needWeed.push(id);

      const insectTime = this.toTimeSec(plant.phases[plant.phases.length - 1]?.insect_time);
      const hasBugs = (plant.insect_owners?.length > 0) || (insectTime > 0 && insectTime <= nowSec);
      if (hasBugs) result.needBug.push(id);

      result.growing.push(id);
    }

    return result;
  }

  /**
   * 获取作物成熟时间
   */
  getMatureTime(phases) {
    if (!phases || phases.length === 0) return 0;
    
    // 找到成熟阶段
    for (const phase of phases) {
      if (this.toNum(phase.phase) === this.PlantPhase.MATURE) {
        return this.toTimeSec(phase.begin_time);
      }
    }
    return 0;
  }

  // ============ 主农场检查 ============
  async checkFarm(config) {
    const state = this.network.getUserState();
    if (!state.gid) return;

    // 检查连接状态
    if (!this.network.connection.isConnected()) {
      this.sendLog('[农场] 连接未建立，跳过农场检查');
      return;
    }

    try {
      const landsReply = await this.getAllLands(3, 30000); // 3次重试，30秒超时
      if (!landsReply || !landsReply.lands || landsReply.lands.length === 0) return;

      const lands = landsReply.lands;
      
      // 自动解锁和升级土地（参考老程序逻辑）
      if (config.autoUnlockLand) {
        await this.autoUnlockLands();
      }
      if (config.autoUpgradeLand) {
        await this.autoUpgradeLands();
      }
      
      // 防偷菜配置
      const antiStealConfig = {
        enabled: config.enableAntiSteal || false,
        advanceTime: Math.max(20, Math.min(120, config.antiStealAdvanceTime || 30)),
      };
      
      const status = this.analyzeLands(lands, antiStealConfig);

      const actions = [];

      // 优先处理防偷菜（在其他人偷之前加速并收获）
      if (status.needAntiSteal.length > 0) {
        const antiStealCount = await this.processAntiSteal(status.needAntiSteal);
        if (antiStealCount > 0) {
          actions.push(`防偷${antiStealCount}`);
        }
      }

      // 批量操作（根据配置决定是否执行）
      const batchOps = [];
      if (status.needWeed.length > 0 && config.autoWeed !== false) {
        batchOps.push(this.weedOut(status.needWeed).then(() => actions.push(`除草${status.needWeed.length}`)).catch(() => {}));
      }
      if (status.needBug.length > 0 && config.autoBug !== false) {
        batchOps.push(this.insecticide(status.needBug).then(() => actions.push(`除虫${status.needBug.length}`)).catch(() => {}));
      }
      if (status.needWater.length > 0 && config.autoWater !== false) {
        batchOps.push(this.waterLand(status.needWater).then(() => actions.push(`浇水${status.needWater.length}`)).catch(() => {}));
      }
      if (batchOps.length > 0) await Promise.all(batchOps);

      // 收获
      let harvestedLandIds = [];
      if (status.harvestable.length > 0) {
        try {
          const harvestResult = await this.harvest(status.harvestable);
          const harvestNames = status.harvestableInfo.map(info => info.name).join(',');
          actions.push(`收获${status.harvestable.length}(${harvestNames})`);
          harvestedLandIds = [...status.harvestable];

          // 计算统计数据
          const harvestCount = status.harvestable.length;
          const expGained = status.harvestableInfo.reduce((sum, info) => sum + (info.exp || 0), 0);

          // 更新本次登录统计（内存）
          this.sessionStats.harvest += harvestCount;
          this.sessionStats.exp += expGained;

          // 写入今日累计（数据库，批量缓存）
          await this.dailyStatsService.increment(this.accountId, {
            harvest: harvestCount,
            exp: expGained
          });
        } catch (e) {
          this.sendLog(`[农场] 收获失败: ${e.message}`);
        }
      }

      // 收获后重新检测土地状态，避免两季作物被误铲
      let finalDeadLands = [...status.dead];
      let finalEmptyLands = [...status.empty];

      if (harvestedLandIds.length > 0) {
        try {
          const refreshedReply = await this.getAllLands();
          if (refreshedReply && refreshedReply.lands && refreshedReply.lands.length > 0) {
            const refreshedStatus = this.analyzeLands(refreshedReply.lands, antiStealConfig);
            for (const hid of harvestedLandIds) {
              if (refreshedStatus.empty.includes(hid)) {
                if (!finalEmptyLands.includes(hid)) {
                  finalEmptyLands.push(hid);
                }
              } else if (refreshedStatus.dead.includes(hid)) {
                if (!finalDeadLands.includes(hid)) {
                  finalDeadLands.push(hid);
                }
              }
              // 仍在生长中（两季作物第二季）→ 不处理，等下次巡查
            }
          }
        } catch (e) {
          this.sendLog(`[农场] 收获后刷新土地状态失败: ${e.message}，跳过收获地块的后续处理`);
        }
      }

      // 种植
      if (config.autoFarm !== false && (finalDeadLands.length > 0 || finalEmptyLands.length > 0)) {
        await this.plantCrops(finalDeadLands, finalEmptyLands, lands.length, config, actions, lands);
      }

      if (actions.length > 0) {
        this.sendLog(`[农场] ${actions.join('/')}`);
      }
    } catch (e) {
      this.sendLog(`[农场] 检查失败: ${e.message}`);
    }
  }

  /**
   * 执行防偷菜操作：使用有机肥加速并收获
   */
  async processAntiSteal(needAntiStealLands) {
    if (!needAntiStealLands || needAntiStealLands.length === 0) return 0;
    
    const landIds = needAntiStealLands.map(l => l.id);
    this.sendLog(`[防偷菜] 检测到 ${landIds.length} 块土地即将成熟，使用有机肥加速`);
    
    try {
      // 使用有机肥加速 (1012是有机肥ID)
      const fertilized = await this.fertilize(landIds, 1012);
      if (fertilized > 0) {
        this.sendLog(`[防偷菜] 已为 ${fertilized} 块土地使用有机肥`);
        // 等待一小段时间让服务器处理
        await this.sleep(200);
        
        // 立即收获
        try {
          await this.harvest(landIds);
          this.sendLog(`[防偷菜] 已收获 ${landIds.length} 块土地`);

          // 计算获得的经验值
          const expGained = needAntiStealLands.reduce((sum, land) => sum + (land.exp || 0), 0);

          // 更新统计
          this.sessionStats.harvest += landIds.length;
          this.sessionStats.exp += expGained;
          await this.dailyStatsService.increment(this.accountId, {
            harvest: landIds.length,
            exp: expGained
          });

          return landIds.length;
        } catch (e) {
          this.sendLog(`[防偷菜] 收获失败: ${e.message}`);
        }
      } else {
        this.sendLog(`[防偷菜] 有机肥使用失败，可能库存不足`);
      }
    } catch (e) {
      this.sendLog(`[防偷菜] 处理失败: ${e.message}`);
    }
    return 0;
  }

  // 种植作物
  async plantCrops(deadLands, emptyLands, totalLands, config, actions, lands = null) {
    try {
      // 1. 铲除枯萎作物
      let landsToPlant = [...emptyLands];
      if (deadLands.length > 0) {
        try {
          await this.removePlant(deadLands);
          this.sendLog(`[农场] 铲除枯萎作物 ${deadLands.length} 块`);
          landsToPlant.push(...deadLands);
        } catch (e) {
          this.sendLog(`[农场] 铲除失败: ${e.message}`);
          landsToPlant.push(...deadLands);
        }
      }

      if (landsToPlant.length === 0) return;

      // 2. 获取推荐种子（传入土地数据以支持土地等级Buff计算）
      const bestSeed = await this.findBestSeed(totalLands, config, lands);
      if (!bestSeed) {
        this.sendLog('[农场] 无法获取推荐种子');
        return;
      }

      const seedName = this.getPlantNameBySeedId(bestSeed.seedId);
      this.sendLog(`[农场] 推荐种子: ${seedName}(ID:${bestSeed.seedId}) 价格:${bestSeed.price}金币`);

      // 3. 购买种子
      const needCount = landsToPlant.length;
      const totalCost = bestSeed.price * needCount;
      const state = this.network.getUserState();
      
      if (totalCost > state.gold) {
        this.sendLog(`[农场] 金币不足! 需要${totalCost}金币,当前${state.gold}金币`);
        const canBuy = Math.floor(state.gold / bestSeed.price);
        if (canBuy <= 0) return;
        landsToPlant = landsToPlant.slice(0, canBuy);
        this.sendLog(`[农场] 金币有限,只种${canBuy}块地`);
      }

      let actualSeedId = bestSeed.seedId;
      try {
        const buyReply = await this.buyGoods(bestSeed.goodsId, landsToPlant.length, bestSeed.price);
        if (buyReply.get_items && buyReply.get_items.length > 0) {
          const gotItem = buyReply.get_items[0];
          const gotId = this.toNum(gotItem.id);
          if (gotId > 0) actualSeedId = gotId;
        }
        const boughtName = this.getPlantNameBySeedId(actualSeedId);
        this.sendLog(`[农场] 购买 ${boughtName}种子 x${landsToPlant.length}, 花费 ${bestSeed.price * landsToPlant.length} 金币`);
      } catch (e) {
        this.sendLog(`[农场] 购买种子失败: ${e.message}`);
        return;
      }

      // 4. 种植
      let planted = 0;
      try {
        planted = await this.plantSeeds(actualSeedId, landsToPlant, config);
        const plantName = this.getPlantNameBySeedId(actualSeedId);
        actions.push(`种植${planted}(${plantName})`);
        this.sendLog(`[农场] 已在 ${planted} 块地种植 ${plantName}`);
      } catch (e) {
        this.sendLog(`[农场] 种植失败: ${e.message}`);
      }
      
      // 5. 施肥（根据配置）
      if (config.autoFertilize !== false && planted > 0) {
        await this.fertilizeAfterPlant(landsToPlant.slice(0, planted), config);
      }
    } catch (e) {
      this.sendLog(`[农场] 种植流程失败: ${e.message}`);
    }
  }
  
  // 种植后施肥
  async fertilizeAfterPlant(landIds, config) {
    try {
      let normalCount = 0;
      let organicCount = 0;
      
      if (config.useOrganicFertilizer) {
        if (config.useBothFertilizers) {
          // 同时使用两种肥料：每块地先施普通肥，再施有机肥
          for (const landId of landIds) {
            // 先施普通肥
            try {
              const normalResult = await this.fertilize([landId], 1011, config);
              if (normalResult > 0) {
                normalCount++;
              } else {
                this.sendLog(`[施肥] 普通肥失败 (土地${landId})`);
              }
            } catch (e) {
              this.sendLog(`[施肥] 普通肥错误: ${e.message}`);
            }
            // 再施有机肥
            try {
              const organicResult = await this.fertilize([landId], 1012, config);
              if (organicResult > 0) {
                organicCount++;
              } else {
                this.sendLog(`[施肥] 有机肥失败 (土地${landId})`);
              }
            } catch (e) {
              this.sendLog(`[施肥] 有机肥错误: ${e.message}`);
            }
          }
          // 详细记录两种肥料的使用情况
          if (normalCount > 0 || organicCount > 0) {
            this.sendLog(`[施肥] 普通肥${normalCount} 有机肥${organicCount}`);
          }
        } else {
          // 优先使用有机肥，不足时用普通肥
          organicCount = await this.fertilize(landIds, 1012, config);
          if (organicCount < landIds.length) {
            normalCount = await this.fertilize(landIds.slice(organicCount), 1011, config);
          }
          if (normalCount > 0 || organicCount > 0) {
            this.sendLog(`[施肥] 普通肥${normalCount} 有机肥${organicCount}`);
          }
        }
      } else {
        // 只使用普通肥
        normalCount = await this.fertilize(landIds, 1011, config);
        if (normalCount > 0) {
          this.sendLog(`[施肥] 普通肥${normalCount}`);
        }
      }
    } catch (e) {
      this.sendLog(`[施肥] 施肥流程失败: ${e.message}`);
    }
  }

  // 查找最佳种子（参考老程序逻辑，使用 getPlantingRecommendation）
  async findBestSeed(unlockedLandCount, config, lands = null) {
    try {
      // 种子商店ID是2
      const shopReply = await this.getShopInfo(2);
      if (!shopReply || !shopReply.goods_list || shopReply.goods_list.length === 0) {
        this.sendLog('[农场] 种子商店无商品');
        return null;
      }

      const state = this.network.getUserState();
      const userLevel = state.level || 1;

      // 获取跳过的作物列表
      const skipCrops = config.skipCrops || [];
      if (config.skipWhiteRadish && !skipCrops.includes(10001)) {
        skipCrops.push(10001);
      }

      // 解析种子信息
      const available = [];
      for (const goods of shopReply.goods_list) {
        // 检查是否解锁
        if (!goods.unlocked) continue;

        // 检查等级条件
        let meetsConditions = true;
        let requiredLevel = 0;
        const conds = goods.conds || [];
        for (const cond of conds) {
          if (this.toNum(cond.type) === 1) {
            requiredLevel = this.toNum(cond.param);
            if (userLevel < requiredLevel) {
              meetsConditions = false;
              break;
            }
          }
        }
        if (!meetsConditions) continue;

        // 检查限购
        const limitCount = this.toNum(goods.limit_count);
        const boughtNum = this.toNum(goods.bought_num);
        if (limitCount > 0 && boughtNum >= limitCount) continue;

        const goodsId = this.toNum(goods.id);
        const seedId = this.toNum(goods.item_id);
        const price = this.toNum(goods.price);
        const plantId = 1020000 + (seedId - 20000);
        const plantName = this.getPlantNameBySeedId(seedId);

        available.push({ goods, goodsId, seedId, plantId, price, requiredLevel, plantName });
      }

      if (available.length === 0) {
        this.sendLog('[农场] 没有可购买的种子');
        return null;
      }

      // 如果关闭了智能推荐，使用用户配置的种子（参考老程序逻辑）
      if (config.enableSmartPlant === false) {
        // 从配置中提取作物名称（格式: "作物名 (LvX) 时间"）
        const seedType = config.seedType || '白萝卜 (Lv1) 1分钟';
        const configName = seedType.split(' (')[0].trim();

        // 查找匹配的种子
        const matchedSeed = available.find(seed => seed.plantName === configName);
        if (matchedSeed) {
          this.sendLog(`[农场] 使用配置的种子: ${configName}（智能推荐已关闭）`);
          return matchedSeed;
        }

        // 如果没有找到匹配的种子，记录日志并使用兜底策略
        this.sendLog(`[农场] 未找到配置的种子: ${configName}，将使用兜底策略`);
      } else {
        // 使用智能推荐
        try {
          this.sendLog(`[农场] 等级: ${userLevel}，土地数量: ${unlockedLandCount}`);
          
          // 调用 getPlantingRecommendation 获取推荐（与老程序一致）
          const rec = this.getPlantingRecommendation(userLevel, unlockedLandCount || 18, { top: 50 });
          
          // 根据是否使用肥料选择候选列表
          const rankedSeedIds = config.autoFertilize !== false 
            ? rec.candidatesNormalFert.map(x => x.seedId)
            : rec.candidatesNoFert.map(x => x.seedId);
          
          this.sendLog(`[农场] 智能推荐候选: ${rankedSeedIds.slice(0, 5).join(', ')}`);
          
          // 按推荐顺序查找第一个在商店中可购买的种子
          for (const seedId of rankedSeedIds) {
            const hit = available.find(x => x.seedId === seedId);
            if (hit) {
              // 检查是否在跳过列表中
              if (!skipCrops.includes(hit.plantId)) {
                const expPerHour = config.autoFertilize !== false 
                  ? rec.candidatesNormalFert.find(x => x.seedId === seedId)?.expPerHour 
                  : rec.candidatesNoFert.find(x => x.seedId === seedId)?.expPerHour;
                this.sendLog(`[农场] 智能推荐: ${hit.plantName} (seed=${hit.seedId}) 每小时${expPerHour?.toFixed(2) || '?'}经验`);
                return hit;
              } else {
                this.sendLog(`[农场] 跳过作物: ${hit.plantName} (在跳过列表中)`);
              }
            }
          }
          
          this.sendLog('[农场] 推荐列表中无可用种子，使用兜底策略');
        } catch (e) {
          this.sendLog(`[农场] 智能推荐失败: ${e.message}，使用兜底策略`);
        }
      }

      // 兜底策略（与老程序一致）
      if (userLevel <= 28) {
        available.sort((a, b) => a.requiredLevel - b.requiredLevel || a.price - b.price);
      } else {
        available.sort((a, b) => b.requiredLevel - a.requiredLevel);
      }

      // 排除跳过的作物
      for (const s of available) {
        if (!skipCrops.includes(s.plantId)) {
          this.sendLog(`[农场] 兜底策略选择: ${s.plantName}`);
          return s;
        }
      }

      return available[0];
    } catch (e) {
      this.sendLog(`[农场] 查找最佳种子失败: ${e.message}`);
      return null;
    }
  }

  // 获取植物名称
  getPlantNameBySeedId(seedId) {
    const plantId = seedId - 20000 + 1020000;
    const plantInfo = this.plantConfig[plantId];
    return plantInfo?.name || `作物#${plantId}`;
  }

  // 获取植物所需等级
  getPlantRequiredLevel(plantId) {
    const plantInfo = this.plantConfig[plantId];
    return plantInfo?.requiredLevel || plantInfo?.required_level || 1;
  }

  // 获取植物生长时间
  getPlantGrowTime(plantId) {
    const plantInfo = this.plantConfig[plantId];
    return plantInfo?.growTime || plantInfo?.grow_time || 0;
  }

  // ============ 智能推荐算法（新版本） ============
  
  /**
   * 解析生长阶段时间
   * @param {string} growPhases - 如 "种子:2880;发芽:2880;小叶子:2880;..."
   * @returns {number[]} 各阶段时间数组（秒）
   */
  parseGrowPhases(growPhases) {
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
  getLandBuff(level) {
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
  calcPlantYield(plant, landLevel, landCount, timing = DEFAULT_TIMING) {
    const phases = this.parseGrowPhases(plant.grow_phases);
    const nonZeroPhases = phases.filter(p => p > 0);
    if (nonZeroPhases.length === 0) return null;

    const baseGrow = nonZeroPhases.reduce((a, b) => a + b, 0);
    const firstPhase = nonZeroPhases[0];
    const buff = this.getLandBuff(landLevel);
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
  compareYield(a, b, key) {
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
   * @param {number} top - 返回前几名
   * @param {Object} timing - 操作耗时参数
   * @returns {Object[]} 排序后的收益列表
   */
  calculateForLandLevel(level, count, playerLevel, top = 20, timing = DEFAULT_TIMING) {
    const results = [];
    const plants = Object.values(this.plantConfig);

    for (const plant of plants) {
      const unlockLevel = plant.unlock_level || 1;
      if (playerLevel && unlockLevel > playerLevel) continue;
      if (plant.land_level_need > level) continue;

      const yield_ = this.calcPlantYield(plant, level, count, timing);
      if (yield_) results.push(yield_);
    }

    results.sort((a, b) => this.compareYield(a, b, 'expPerHourWithFert'));
    return results.slice(0, top);
  }

  /**
   * 计算农场推荐
   * @param {Map<number, number>} landDist - 土地分布 Map<等级, 数量>
   * @param {Object} opts - 选项
   * @param {number} opts.playerLevel - 玩家等级
   * @param {number} opts.top - 返回前几名
   * @returns {Object} 推荐结果
   */
  calculateFarmRecommendation(landDist, opts = {}) {
    const playerLevel = opts.playerLevel;
    const top = opts.top || 10;

    let totalLands = 0;
    let totalExpNoFert = 0;
    let totalExpWithFert = 0;
    const byLevel = [];

    for (const [level, count] of landDist) {
      if (count <= 0) continue;
      totalLands += count;

      const ranked = this.calculateForLandLevel(level, count, playerLevel, top);
      const rankedNoFert = [...ranked].sort((a, b) => this.compareYield(a, b, 'expPerHourNoFert'));

      const bestNoFert = rankedNoFert[0] || null;
      const bestWithFert = ranked[0] || null;

      if (bestNoFert) totalExpNoFert += bestNoFert.expPerHourNoFert;
      if (bestWithFert) totalExpWithFert += bestWithFert.expPerHourWithFert;

      byLevel.push({
        landLevel: level,
        landCount: count,
        bestNoFert,
        bestWithFert,
        topNoFert: rankedNoFert.slice(0, top),
        topWithFert: ranked.slice(0, top),
      });
    }

    return {
      totalLands,
      totalExpPerHourNoFert: Number(totalExpNoFert.toFixed(2)),
      totalExpPerHourWithFert: Number(totalExpWithFert.toFixed(2)),
      byLevel,
    };
  }

  /**
   * 获取种植推荐（向后兼容）
   * @param {number} level - 玩家等级
   * @param {number} lands - 土地数量
   * @param {Object} opts - 选项
   * @returns {Object} 推荐结果
   */
  getPlantingRecommendation(level, lands = 18, opts = {}) {
    const top = opts.top || 20;
    
    // 如果提供了实际土地分布，使用精确计算
    if (opts.landDistribution && opts.landDistribution.size > 0) {
      const rec = this.calculateFarmRecommendation(opts.landDistribution, { playerLevel: level, top });
      // 合并所有等级的 top 列表并重新排序
      const allNoFert = [];
      const allWithFert = [];
      for (const lvl of rec.byLevel) {
        allNoFert.push(...lvl.topNoFert);
        allWithFert.push(...lvl.topWithFert);
      }
      // 去重（按 seedId），保留最高 exp/h
      const dedup = (arr, key) => {
        const map = new Map();
        for (const item of arr) {
          const existing = map.get(item.seedId);
          if (!existing || item[key] > existing[key]) map.set(item.seedId, item);
        }
        return [...map.values()].sort((a, b) => this.compareYield(a, b, key)).slice(0, top);
      };
      const candidatesNoFert = dedup(allNoFert, 'expPerHourNoFert');
      const candidatesNormalFert = dedup(allWithFert, 'expPerHourWithFert');

      return {
        level,
        lands: rec.totalLands,
        bestNoFert: candidatesNoFert[0] ? this.mapCompat(candidatesNoFert[0], 'expPerHourNoFert') : null,
        bestNormalFert: candidatesNormalFert[0] ? this.mapCompat(candidatesNormalFert[0], 'expPerHourWithFert') : null,
        candidatesNoFert: candidatesNoFert.map((r) => this.mapCompat(r, 'expPerHourNoFert')),
        candidatesNormalFert: candidatesNormalFert.map((r) => this.mapCompat(r, 'expPerHourWithFert')),
      };
    }

    // 默认：所有地视为等级 1
    const ranked = this.calculateForLandLevel(1, lands, level, top);
    const rankedNoFert = [...ranked].sort((a, b) => this.compareYield(a, b, 'expPerHourNoFert'));

    return {
      level,
      lands,
      bestNoFert: rankedNoFert[0] ? this.mapCompat(rankedNoFert[0], 'expPerHourNoFert') : null,
      bestNormalFert: ranked[0] ? this.mapCompat(ranked[0], 'expPerHourWithFert') : null,
      candidatesNoFert: rankedNoFert.map((r) => this.mapCompat(r, 'expPerHourNoFert')),
      candidatesNormalFert: ranked.map((r) => this.mapCompat(r, 'expPerHourWithFert')),
    };
  }

  /**
   * 映射兼容格式
   * @param {Object} r - 收益对象
   * @param {string} key - 经验字段
   * @returns {Object} 兼容格式
   */
  mapCompat(r, key) {
    return {
      seedId: r.seedId,
      name: r.name,
      requiredLevel: r.unlockLevel,
      expPerHour: Number(r[key].toFixed(4)),
    };
  }

  /**
   * 更新土地分布
   * @param {Array} lands - 土地数组
   */
  updateLandDistribution(lands) {
    this.landDistribution.clear();
    for (const land of lands) {
      if (!land.unlocked) continue;
      const level = this.toNum(land.level) || 1;
      this.landDistribution.set(level, (this.landDistribution.get(level) || 0) + 1);
    }
  }

  // ============ 好友系统 ============
  async getAllFriends(timeout = 30000) {
    try {
      // 检查连接状态
      if (!this.network.connection.isConnected()) {
        this.sendLog('[好友] 连接未建立，跳过获取好友列表');
        return null;
      }

      const isQQ = this.CONFIG.platform === 'qq';
      let body, reply;

      if (isQQ) {
        // QQ平台使用 SyncAll 接口
        body = this.types.SyncAllRequest.encode(this.types.SyncAllRequest.create({ open_ids: [] })).finish();
        this.sendLog('[好友] 发送 SyncAllFriends 请求...');
        const { body: replyBody } = await this.network.sendMsgAsync('gamepb.friendpb.FriendService', 'SyncAll', body, timeout);
        this.sendLog('[好友] 收到 SyncAllFriends 响应');
        reply = this.types.SyncAllReply.decode(replyBody);
      } else {
        // 微信平台使用 GetAll 接口
        body = this.types.GetAllFriendsRequest.encode(this.types.GetAllFriendsRequest.create({})).finish();
        this.sendLog('[好友] 发送 GetAllFriends 请求...');
        const { body: replyBody } = await this.network.sendMsgAsync('gamepb.friendpb.FriendService', 'GetAll', body, timeout);
        this.sendLog('[好友] 收到 GetAllFriends 响应');
        reply = this.types.GetAllFriendsReply.decode(replyBody);
      }

      const friends = reply.game_friends || reply.friends || [];
      this.sendLog(`[好友] 解析响应: game_friends=${reply.game_friends ? reply.game_friends.length : 'null'}, friends=${reply.friends ? reply.friends.length : 'null'}`);
      return { ...reply, friends };
    } catch (e) {
      this.sendLog(`[好友] 获取好友列表失败: ${e.message}`);
      return null;
    }
  }

  async enterFriendFarm(friendGid, timeout = 20000) {
    try {
      // 检查连接状态
      if (!this.network.connection.isConnected()) {
        return {
          ok: false,
          reply: null,
          error: '连接未建立',
          errorCode: null
        };
      }

      const body = this.types.VisitEnterRequest.encode(this.types.VisitEnterRequest.create({
        host_gid: this.toLong(friendGid),
        reason: 2,
      })).finish();
      const { body: replyBody } = await this.network.sendMsgAsync('gamepb.visitpb.VisitService', 'Enter', body, timeout);
      return {
        ok: true,
        reply: this.types.VisitEnterReply.decode(replyBody),
        error: null,
        errorCode: null
      };
    } catch (e) {
      const message = e?.message || String(e);
      const match = /code\s*=\s*(\d+)/i.exec(message);
      return {
        ok: false,
        reply: null,
        error: message,
        errorCode: match ? Number(match[1]) : null
      };
    }
  }

  isFriendFarmBannedError(errorCode, errorMessage) {
    if (errorCode === 1002003) return true;
    return typeof errorMessage === 'string' && errorMessage.includes('账号已被封禁');
  }

  addFriendToAllInteractionWhitelists(config, friendGid, friendName, whitelistSets = null) {
    const fields = ['stealWhitelist', 'helpWaterWhitelist', 'helpWeedWhitelist', 'helpBugWhitelist'];
    let changed = false;

    for (const field of fields) {
      if (!Array.isArray(config[field])) {
        config[field] = [];
      }
      if (!config[field].includes(friendGid)) {
        config[field].push(friendGid);
        changed = true;
      }
    }

    if (whitelistSets) {
      whitelistSets.steal?.add(friendGid);
      whitelistSets.water?.add(friendGid);
      whitelistSets.weed?.add(friendGid);
      whitelistSets.bug?.add(friendGid);
    }

    if (!changed) {
      this.sendLog(`[好友] ${friendName}(${friendGid}) 已在互动白名单中，跳过访问`);
      return false;
    }

    this.sendLog(`[好友] 检测到 ${friendName}(${friendGid}) 账号封禁，已自动加入偷菜/浇水/除草/除虫白名单`);

    if (typeof this.sendEvent === 'function') {
      this.sendEvent({
        type: 'configAutoUpdate',
        reason: 'friendBannedAutoWhitelist',
        configPatch: {
          stealWhitelist: config.stealWhitelist || [],
          helpWaterWhitelist: config.helpWaterWhitelist || [],
          helpWeedWhitelist: config.helpWeedWhitelist || [],
          helpBugWhitelist: config.helpBugWhitelist || []
        }
      });
    }

    return true;
  }

  async leaveFriendFarm(friendGid) {
    try {
      const body = this.types.VisitLeaveRequest.encode(this.types.VisitLeaveRequest.create({
        host_gid: this.toLong(friendGid),
      })).finish();
      await this.network.sendMsgAsync('gamepb.visitpb.VisitService', 'Leave', body);
    } catch (e) {}
  }

  async helpWater(friendGid, landIds) {
    try {
      const body = this.types.WaterLandRequest.encode(this.types.WaterLandRequest.create({
        land_ids: landIds,
        host_gid: this.toLong(friendGid),
      })).finish();
      const { body: replyBody } = await this.network.sendMsgAsync('gamepb.plantpb.PlantService', 'WaterLand', body);
      return this.types.WaterLandReply.decode(replyBody);
    } catch (e) { return null; }
  }

  async helpWeed(friendGid, landIds) {
    try {
      const body = this.types.WeedOutRequest.encode(this.types.WeedOutRequest.create({
        land_ids: landIds,
        host_gid: this.toLong(friendGid),
      })).finish();
      const { body: replyBody } = await this.network.sendMsgAsync('gamepb.plantpb.PlantService', 'WeedOut', body);
      return this.types.WeedOutReply.decode(replyBody);
    } catch (e) { return null; }
  }

  async helpInsecticide(friendGid, landIds) {
    try {
      const body = this.types.InsecticideRequest.encode(this.types.InsecticideRequest.create({
        land_ids: landIds,
        host_gid: this.toLong(friendGid),
      })).finish();
      const { body: replyBody } = await this.network.sendMsgAsync('gamepb.plantpb.PlantService', 'Insecticide', body);
      return this.types.InsecticideReply.decode(replyBody);
    } catch (e) { return null; }
  }

  async stealHarvest(friendGid, landIds) {
    try {
      const body = this.types.HarvestRequest.encode(this.types.HarvestRequest.create({
        land_ids: landIds,
        host_gid: this.toLong(friendGid),
        is_all: true,
      })).finish();
      const { body: replyBody } = await this.network.sendMsgAsync('gamepb.plantpb.PlantService', 'Harvest', body);
      return this.types.HarvestReply.decode(replyBody);
    } catch (e) { return null; }
  }

  analyzeFriendLands(lands, myGid, config = {}) {
    const result = {
      stealable: [],
      stealableInfo: [],
      needWater: [],
      needWeed: [],
      needBug: [],
    };

    // 获取跳过的作物ID列表
    const skipCrops = config.skipCrops || [];
    // 兼容旧的 skipWhiteRadish 配置
    if (config.skipWhiteRadish && !skipCrops.includes(10001)) {
      skipCrops.push(10001); // 白萝卜ID
    }

    for (const land of lands) {
      const id = this.toNum(land.id);
      const plant = land.plant;

      if (!plant || !plant.phases || plant.phases.length === 0) continue;

      const currentPhase = this.getCurrentPhase(plant.phases);
      if (!currentPhase) continue;
      const phaseVal = currentPhase;

      if (phaseVal === this.PlantPhase.MATURE) {
        if (plant.stealable) {
          const plantId = this.toNum(plant.id);
          // 检查是否在跳过列表中
          if (skipCrops.includes(plantId)) {
            const plantInfo = this.plantConfig[plantId];
            this.sendLog(`[好友] 跳过作物: ${plantInfo?.name || plant.name || '未知'}(ID:${plantId})`);
            continue;
          }
          result.stealable.push(id);
          const plantInfo = this.plantConfig[plantId];
          result.stealableInfo.push({
            landId: id,
            plantId,
            name: plantInfo?.name || plant.name || '未知'
          });
        }
        continue;
      }

      if (phaseVal === this.PlantPhase.DEAD) continue;

      if (this.toNum(plant.dry_num) > 0) result.needWater.push(id);
      if (plant.weed_owners && plant.weed_owners.length > 0) result.needWeed.push(id);
      if (plant.insect_owners && plant.insect_owners.length > 0) result.needBug.push(id);
    }

    return result;
  }

  async checkFriends(config) {
    // 检查连接状态
    if (!this.network.connection.isConnected()) {
      this.sendLog('[好友] 连接未建立，跳过好友巡查');
      return;
    }

    // 判断是否执行好友巡查：开启好友巡查 或 使用固定好友列表
    const shouldRunFriendCheck = config.enableFriendCheck !== false || (config.useFixedFriendList === true && config.fixedFriendIds && config.fixedFriendIds.length > 0);
    if (!shouldRunFriendCheck) {
      this.sendLog('[好友] 跳过巡查：好友巡查和固定列表均未开启');
      return;
    }

    try {
      let actionableFriends = [];

      // 提前定义白名单集合，供后续使用
      const stealWhitelist = new Set(config.stealWhitelist || []);
      const helpWaterWhitelist = new Set(config.helpWaterWhitelist || []);
      const helpWeedWhitelist = new Set(config.helpWeedWhitelist || []);
      const helpBugWhitelist = new Set(config.helpBugWhitelist || []);
      const whitelistSets = {
        steal: stealWhitelist,
        water: helpWaterWhitelist,
        weed: helpWeedWhitelist,
        bug: helpBugWhitelist
      };

      // 判断是否使用固定好友列表
      if (config.useFixedFriendList && config.fixedFriendIds && config.fixedFriendIds.length > 0) {
        // 使用用户指定的固定好友ID列表
        this.sendLog(`[好友] 使用固定好友列表，共 ${config.fixedFriendIds.length} 人`);
        actionableFriends = config.fixedFriendIds.map(gid => ({
          gid: gid,
          name: `好友${gid}`,
          preview: { stealNum: 1, dryNum: 0, weedNum: 0, insectNum: 0 }, // 默认有可偷
          whitelist: { steal: false, water: false, weed: false, bug: false }
        }));
      } else {
        // 原有逻辑：获取全部好友并筛选
        this.sendLog('[好友] 正在获取好友列表...');
        const friendsReply = await this.getAllFriends(30000); // 30秒超时
        if (!friendsReply || !friendsReply.friends) {
          this.sendLog('[好友] 获取好友列表失败或没有好友');
          return;
        }

        const friends = friendsReply.friends;
        this.sendLog(`[好友] 共有 ${friends.length} 个好友`);

        // 根据预览信息筛选有互动项的好友
        for (const friend of friends) {
          const friendGid = this.toNum(friend.gid);
          const friendName = friend.remark || friend.name || `好友#${friendGid}`;
          const p = friend.plant;

          // 从预览信息获取互动数量
          const stealNum = p ? this.toNum(p.steal_plant_num) : 0;
          const dryNum = p ? this.toNum(p.dry_num) : 0;
          const weedNum = p ? this.toNum(p.weed_num) : 0;
          const insectNum = p ? this.toNum(p.insect_num) : 0;

          // 检查是否在白名单中（白名单中的好友跳过对应互动）
          const inStealWhitelist = stealWhitelist.has(friendGid);
          const inWaterWhitelist = helpWaterWhitelist.has(friendGid);
          const inWeedWhitelist = helpWeedWhitelist.has(friendGid);
          const inBugWhitelist = helpBugWhitelist.has(friendGid);

          // 计算实际需要处理的互动数量（排除白名单和关闭的功能）
          // 使用宽松判断：只有明确设置为 false 时才禁用
          const actualStealNum = (config.enableSteal === false || config.enableSteal === 'false' || inStealWhitelist) ? 0 : stealNum;
          const actualDryNum = (config.enableHelpWater === false || config.enableHelpWater === 'false' || inWaterWhitelist) ? 0 : dryNum;
          const actualWeedNum = (config.enableHelpWeed === false || config.enableHelpWeed === 'false' || inWeedWhitelist) ? 0 : weedNum;
          const actualInsectNum = (config.enableHelpBug === false || config.enableHelpBug === 'false' || inBugWhitelist) ? 0 : insectNum;

          // 只保留有互动项的好友
          if (actualStealNum > 0 || actualDryNum > 0 || actualWeedNum > 0 || actualInsectNum > 0) {
            actionableFriends.push({
              gid: friendGid,
              name: friendName,
              preview: { 
                stealNum: actualStealNum, 
                dryNum: actualDryNum, 
                weedNum: actualWeedNum, 
                insectNum: actualInsectNum 
              },
              whitelist: {
                steal: inStealWhitelist,
                water: inWaterWhitelist,
                weed: inWeedWhitelist,
                bug: inBugWhitelist
              }
            });
          }
        }

        this.sendLog(`[好友] 发现 ${actionableFriends.length} 个有互动项的好友`);
      }

      if (actionableFriends.length === 0) {
        this.sendLog('[好友] 没有需要互动的好友');
        return;
      }

      const state = this.network.getUserState();
      const myGid = state.gid;

      let totalActions = 0;

      for (const friend of actionableFriends) {
        if (this.shouldStop) break;

        const friendGid = friend.gid;
        const friendName = friend.name;
        const preview = friend.preview;
        const whitelist = friend.whitelist;

        this.sendLog(`[好友] 进入 ${friendName} 的农场 (预览: 可偷=${preview.stealNum}, 需浇水=${preview.dryNum}, 需除草=${preview.weedNum}, 需除虫=${preview.insectNum})`);
        const enterResult = await this.enterFriendFarm(friendGid);
        if (!enterResult.ok || !enterResult.reply || !enterResult.reply.lands) {
          if (this.isFriendFarmBannedError(enterResult.errorCode, enterResult.error)) {
            this.addFriendToAllInteractionWhitelists(config, friendGid, friendName, whitelistSets);
          } else {
            this.sendLog(`[好友] 进入 ${friendName} 农场失败${enterResult.error ? `: ${enterResult.error}` : ''}`);
          }
          continue;
        }
        const enterReply = enterResult.reply;

        const lands = enterReply.lands;
        if (lands.length === 0) {
          await this.leaveFriendFarm(friendGid);
          continue;
        }

        const status = this.analyzeFriendLands(lands, myGid, config);

        const actions = [];

        // 偷菜（检查白名单）
        if (config.enableSteal !== false && !whitelist.steal && status.stealable.length > 0) {
          try {
            const reply = await this.stealHarvest(friendGid, status.stealable);
            if (reply) {
              actions.push(`偷${status.stealable.length}`);
              totalActions += status.stealable.length;

              // 更新本次登录统计
              this.sessionStats.steal += status.stealable.length;

              // 写入今日累计
              await this.dailyStatsService.increment(this.accountId, {
                steal: status.stealable.length
              });
            }
          } catch (e) {}
        }

        // 帮助操作（分别检查每个开关和白名单）
        // 帮浇水
        if (config.enableHelpWater !== false && !whitelist.water && status.needWater.length > 0) {
          try {
            await this.helpWater(friendGid, status.needWater);
            actions.push(`浇水${status.needWater.length}`);
            totalActions += status.needWater.length;

            // 更新本次登录统计
            this.sessionStats.water += status.needWater.length;

            // 写入今日累计
            await this.dailyStatsService.increment(this.accountId, {
              water: status.needWater.length
            });
          } catch (e) {}
        }

        // 帮除草
        if (config.enableHelpWeed !== false && !whitelist.weed && status.needWeed.length > 0) {
          try {
            await this.helpWeed(friendGid, status.needWeed);
            actions.push(`除草${status.needWeed.length}`);
            totalActions += status.needWeed.length;

            // 更新本次登录统计
            this.sessionStats.weed += status.needWeed.length;

            // 写入今日累计
            await this.dailyStatsService.increment(this.accountId, {
              weed: status.needWeed.length
            });
          } catch (e) {}
        }

        // 帮除虫
        if (config.enableHelpBug !== false && !whitelist.bug && status.needBug.length > 0) {
          try {
            await this.helpInsecticide(friendGid, status.needBug);
            actions.push(`除虫${status.needBug.length}`);
            totalActions += status.needBug.length;

            // 更新本次登录统计
            this.sessionStats.bug += status.needBug.length;

            // 写入今日累计
            await this.dailyStatsService.increment(this.accountId, {
              bug: status.needBug.length
            });
          } catch (e) {}
        }

        if (actions.length > 0) {
          this.sendLog(`[好友:${friendName}] ${actions.join('/')}`);
        }

        await this.leaveFriendFarm(friendGid);
        await this.sleep(500);
      }

      if (totalActions > 0) {
        this.sendLog(`[好友] 巡查完成，共操作 ${totalActions} 次`);
      } else {
        this.sendLog('[好友] 巡查完成，没有可操作项');
      }
    } catch (e) {
      this.sendLog(`[好友] 巡查失败: ${e.message}`);
    }
  }

  // ============ 土地管理 ============
  
  /**
   * 解锁指定土地
   * @param {number} landId - 土地ID
   * @returns {Promise<Object>} 解锁结果
   */
  async unlockLand(landId) {
    try {
      const body = this.types.UnlockLandRequest.encode(
        this.types.UnlockLandRequest.create({ land_id: this.toLong(landId) })
      ).finish();

      const { body: replyBody } = await this.network.sendMsgAsync('gamepb.plantpb.PlantService', 'UnlockLand', body);
      const reply = this.types.UnlockLandReply.decode(replyBody);

      if (reply.land && reply.land.unlocked) {
        this.sendLog(`[土地] 解锁土地 #${landId} 成功！`);
        return { success: true, land: reply.land };
      } else {
        throw new Error('解锁失败: 未知错误');
      }
    } catch (e) {
      this.sendLog(`[土地] 解锁土地 #${landId} 失败: ${e.message}`);
      throw e;
    }
  }

  /**
   * 升级指定土地
   * @param {number} landId - 土地ID
   * @returns {Promise<Object>} 升级结果
   */
  async upgradeLand(landId) {
    try {
      const body = this.types.UpgradeLandRequest.encode(
        this.types.UpgradeLandRequest.create({ land_id: this.toLong(landId) })
      ).finish();

      const { body: replyBody } = await this.network.sendMsgAsync('gamepb.plantpb.PlantService', 'UpgradeLand', body);
      const reply = this.types.UpgradeLandReply.decode(replyBody);

      if (reply.land) {
        this.sendLog(`[土地] 升级土地 #${landId} 成功 → Lv${this.toNum(reply.land.level)}`);
        return { success: true, land: reply.land };
      } else {
        throw new Error('升级失败: 未知错误');
      }
    } catch (e) {
      this.sendLog(`[土地] 升级土地 #${landId} 失败: ${e.message}`);
      throw e;
    }
  }

  /**
   * 自动解锁所有可解锁的土地
   * @returns {Promise<Object>} 解锁结果
   */
  async autoUnlockLands() {
    const unlockedLands = [];
    
    try {
      const landsReply = await this.getAllLands();
      if (!landsReply || !landsReply.lands) {
        return { unlockedCount: 0, message: '无法获取土地信息' };
      }

      const lockedLands = landsReply.lands.filter(land => !land.unlocked && land.could_unlock);
      
      if (lockedLands.length === 0) {
        return { unlockedCount: 0, message: '没有可解锁的土地' };
      }

      for (const land of lockedLands) {
        if (this.shouldStop) break;
        
        try {
          const landId = this.toNum(land.id);
          // 服务器返回的 unlock_condition 为 null，无法显示具体需求
          this.sendLog(`[土地] 正在解锁土地 #${landId}`);
          
          const result = await this.unlockLand(landId);
          if (result.success) {
            unlockedLands.push(landId);
          }
          
          await this.sleep(500);
        } catch (e) {
          this.sendLog(`[土地] 解锁土地 #${this.toNum(land.id)} 失败: ${e.message}`);
        }
      }
      
      return { 
        unlockedCount: unlockedLands.length, 
        message: `成功解锁 ${unlockedLands.length} 块土地` 
      };
    } catch (e) {
      this.sendLog(`[土地] 自动解锁失败: ${e.message}`);
      return { unlockedCount: unlockedLands.length, message: e.message };
    }
  }

  /**
   * 自动升级所有可升级的土地
   * @returns {Promise<Object>} 升级结果
   */
  async autoUpgradeLands() {
    const upgradedLands = [];
    
    try {
      const landsReply = await this.getAllLands();
      if (!landsReply || !landsReply.lands) {
        return { upgradedCount: 0, message: '无法获取土地信息' };
      }

      const upgradableLands = landsReply.lands.filter(land => land.unlocked && land.could_upgrade);
      
      if (upgradableLands.length === 0) {
        return { upgradedCount: 0, message: '没有可升级的土地' };
      }

      for (const land of upgradableLands) {
        if (this.shouldStop) break;
        
        try {
          const landId = this.toNum(land.id);
          const currentLevel = this.toNum(land.level);
          // 服务器返回的 upgrade_condition 为 null，无法显示具体需求
          this.sendLog(`[土地] 正在升级土地 #${landId} (Lv${currentLevel}→${currentLevel + 1})`);
          
          const result = await this.upgradeLand(landId);
          if (result.success) {
            upgradedLands.push(landId);
          }
          
          await this.sleep(500);
        } catch (e) {
          this.sendLog(`[土地] 升级土地 #${this.toNum(land.id)} 失败: ${e.message}`);
        }
      }
      
      return { 
        upgradedCount: upgradedLands.length, 
        message: `成功升级 ${upgradedLands.length} 块土地` 
      };
    } catch (e) {
      this.sendLog(`[土地] 自动升级失败: ${e.message}`);
      return { upgradedCount: upgradedLands.length, message: e.message };
    }
  }

  // ============ 停止 ============
  stop() {
    this.shouldStop = true;
    this.isRunning = false;
  }

  // ============ 统计接口 ============

  /**
   * 获取本次登录统计
   * @returns {Object} 本次登录统计数据
   */
  getSessionStats() {
    return {
      exp: this.sessionStats.exp,
      harvest: this.sessionStats.harvest,
      steal: this.sessionStats.steal,
      water: this.sessionStats.water,
      weed: this.sessionStats.weed,
      bug: this.sessionStats.bug,
      sell: this.sessionStats.sell,
      onlineTime: Math.floor((Date.now() - this.sessionStats.loginTime) / 60000) // 在线分钟数
    };
  }

  /**
   * 获取今日累计统计
   * @returns {Promise<Object>} 今日累计统计数据
   */
  async getTodayStats() {
    return await this.dailyStatsService.getTodayStats(this.accountId);
  }
}

module.exports = FarmOperations;
