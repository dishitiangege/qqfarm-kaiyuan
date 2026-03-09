
const path = require('path');
const fs = require('fs');
// 计算项目根目录（collector脚本在collectors子目录中）
const projectRoot = path.join(__dirname, '..');
const { loadProto } = require(path.join(projectRoot, 'src/proto'));
const { connect, cleanup, sendMsgAsync, getUserState, networkEvents, setLogger } = require(path.join(projectRoot, 'src/network'));
const { toLong, toNum, toTimeSec, getServerTimeSec, sleep } = require(path.join(projectRoot, 'src/utils'));
const { types } = require(path.join(projectRoot, 'src/proto'));
const { CONFIG } = require(path.join(projectRoot, 'src/config'));
const dataCollector = require(path.join(projectRoot, 'backend/dataCollector'));
const { getPlantingRecommendation } = require(path.join(projectRoot, 'tools/calc-exp-yield'));
const { getLevelExpProgress, getPlantName, formatGrowTime } = require(path.join(projectRoot, 'src/gameConfig'));
const email = require(path.join(projectRoot, 'src/email'));
const illustrated = require(path.join(projectRoot, 'src/illustrated'));
const shop = require(path.join(projectRoot, 'src/shop'));

// 设置自定义日志函数，使network.js的日志通过sendLog输出
setLogger(
  (tag, msg) => sendLog(`[${tag}] ${msg}`),
  (tag, msg) => sendLog(`[${tag}] ⚠ ${msg}`)
);

// 账号ID
const ACCOUNT_ID = '3028146841';

// 种子类型配置
const SEED_TYPE = '大白菜 (Lv3) 5分钟';

// 智能推荐种植开关
const ENABLE_SMART_PLANT = true;

// 土地管理开关
const AUTO_UNLOCK_LAND = true;
const AUTO_UPGRADE_LAND = true;

// 加载作物配置
let plantConfig = {};
try {
  const plantData = JSON.parse(fs.readFileSync('./gameConfig/Plant.json', 'utf8'));
  plantData.forEach(plant => {
    plantConfig[plant.id] = plant;
  });
  console.log('[配置] 已加载植物配置:', Object.keys(plantConfig).length, '种');
} catch (e) {
  console.error('[配置] 加载作物配置失败:', e.message);
}

// 生长阶段枚举
const PlantPhase = {
  UNKNOWN: 0, SEED: 1, GERMINATION: 2, SMALL_LEAVES: 3,
  LARGE_LEAVES: 4, BLOOMING: 5, MATURE: 6, DEAD: 7,
};
const PHASE_NAMES = ['未知', '种子', '发芽', '小叶', '大叶', '开花', '成熟', '枯死'];

// 操作类型ID
const OP_IDS = {
  WEED: 10005, BUG: 10006, WATER: 10007, STEAL: 10008, PUT_WEED: 10003, PUT_BUG: 10004
};

// 肥料补充道具映射（按优先级排序：大容量优先）
const FERTILIZER_REFILL_ITEMS = {
  1011: [80004, 80003, 80002, 80001], // 普通肥：12h > 8h > 4h > 1h
  1012: [80014, 80013, 80012, 80011]  // 有机肥：12h > 8h > 4h > 1h
};

// 道具名称映射
const ITEM_NAMES = {
  80001: '普通化肥(1小时)',
  80002: '普通化肥(4小时)',
  80003: '普通化肥(8小时)',
  80004: '普通化肥(12小时)',
  80011: '有机化肥(1小时)',
  80012: '有机化肥(4小时)',
  80013: '有机化肥(8小时)',
  80014: '有机化肥(12小时)',
};

function getItemName(itemId) {
  return ITEM_NAMES[itemId] || ('道具' + itemId);
}

let lastData = null;
let operationLimits = new Map();
let taskList = [];
let bagItems = [];
let todayStats = { exp: 0, harvest: 0, steal: 0, water: 0, weed: 0, bug: 0, sell: 0 };

// 经验追踪相关 - 用于判断帮助操作是否还能获得经验
const expTracker = new Map();       // opId -> 帮助前的 dayExpTimes
const expExhausted = new Set();     // 经验已耗尽的操作类型

let isCollectingData = false;
let collectLoopRunning = false;
let collectTimer = null;
let lastCollectTime = 0;
const COLLECT_INTERVAL = 10000; // 10秒间隔
const COLLECT_DEBOUNCE = 500; // 500ms防抖
let logThrottle = {};
const LOG_THROTTLE_MS = 30000; // 30秒日志节流

function sendData(data) {
  const newData = JSON.stringify({ type: 'data', data });
  if (newData !== lastData) {
    console.log(newData);
    lastData = newData;
  }
}

function sendLog(message) {
  const key = message.substring(0, 50);
  const now = Date.now();
  if (logThrottle[key] && now - logThrottle[key] < LOG_THROTTLE_MS) {
    return;
  }
  logThrottle[key] = now;
  console.log(JSON.stringify({ type: 'log', message }));
}

function getCurrentPhase(phases) {
  if (!phases || phases.length === 0) return null;
  const nowSec = getServerTimeSec();
  for (let i = phases.length - 1; i >= 0; i--) {
    const beginTime = toTimeSec(phases[i].begin_time);
    if (beginTime > 0 && beginTime <= nowSec) {
      return toNum(phases[i].phase);
    }
  }
  return toNum(phases[0].phase);
}

// ============ 任务系统 ============
async function getTaskInfo() {
  try {
    const body = types.TaskInfoRequest.encode(types.TaskInfoRequest.create({})).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.taskpb.TaskService', 'TaskInfo', body);
    return types.TaskInfoReply.decode(replyBody);
  } catch (e) { return null; }
}

async function claimTaskReward(taskId, doShared = false) {
  try {
    const body = types.ClaimTaskRewardRequest.encode(types.ClaimTaskRewardRequest.create({
      id: toLong(taskId), do_shared: doShared,
    })).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.taskpb.TaskService', 'ClaimTaskReward', body);
    return types.ClaimTaskRewardReply.decode(replyBody);
  } catch (e) { return null; }
}

async function checkAndClaimTasks() {
  try {
    const reply = await getTaskInfo();
    if (!reply || !reply.task_info) return;
    
    const allTasks = [
      ...(reply.task_info.growth_tasks || []),
      ...(reply.task_info.daily_tasks || []),
      ...(reply.task_info.tasks || []),
    ];
    
    const claimable = allTasks.filter(task => {
      const progress = toNum(task.progress);
      const totalProgress = toNum(task.total_progress);
      return task.is_unlocked && !task.is_claimed && progress >= totalProgress && totalProgress > 0;
    });
    
    // 按任务ID去重，保留第一个
    const seenIds = new Set();
    taskList = allTasks.filter(task => {
      const id = toNum(task.id);
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    }).map(task => ({
      id: toNum(task.id),
      desc: task.desc || `任务#${task.id}`,
      progress: toNum(task.progress),
      total: toNum(task.total_progress),
      isClaimed: task.is_claimed,
      isUnlocked: task.is_unlocked,
      rewards: (task.rewards || []).map(r => ({ id: toNum(r.id), count: toNum(r.count) })),
    }));
    
    sendLog('[任务] 发现 ' + claimable.length + ' 个可领取任务');
    
    for (const task of claimable) {
      try {
        const useShare = toNum(task.share_multiple) > 1;
        const multipleStr = useShare ? ' (' + task.share_multiple + '倍)' : '';
        const claimReply = await claimTaskReward(task.id, useShare);
        const items = claimReply?.items || [];
        const rewardStr = items.length > 0 
          ? items.map(r => (toNum(r.id) === 1 ? '金币' : toNum(r.id) === 2 ? '经验' : '物品#' + toNum(r.id)) + toNum(r.count)).join('/')
          : (task.rewards || []).map(r => (toNum(r.id) === 1 ? '金币' : '经验') + toNum(r.count)).join('/');
        sendLog('[任务] 领取: ' + (task.desc || task.id) + multipleStr + ' → ' + rewardStr);
        todayStats.exp += 10;
      } catch (e) {
        sendLog('[任务] 领取失败: ' + (task.desc || task.id) + ' - ' + e.message);
      }
      await sleep(300);
    }
  } catch (e) {
    sendLog('[任务] 检查任务失败: ' + e.message);
  }
}

// ============ 仓库系统 ============
async function getBag() {
  try {
    sendLog('[仓库] 请求背包数据...');
    const body = types.BagRequest.encode(types.BagRequest.create({})).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.itempb.ItemService', 'Bag', body);
    const reply = types.BagReply.decode(replyBody);
    sendLog('[仓库] 背包数据获取成功');
    return reply;
  } catch (e) {
    sendLog('[仓库] 获取背包失败: ' + e.message);
    return null;
  }
}

async function sellItems(items) {
  try {
    const payload = items.map(item => ({
      id: item.id != null ? toLong(item.id) : undefined,
      count: item.count != null ? toLong(item.count) : undefined,
      uid: item.uid != null ? toLong(item.uid) : undefined,
    }));
    sendLog('[仓库] 发送出售请求，物品数: ' + payload.length);
    const body = types.SellRequest.encode(types.SellRequest.create({ items: payload })).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.itempb.ItemService', 'Sell', body);
    const reply = types.SellReply.decode(replyBody);
    // 从 get_items 中提取金币
    let gold = 0;
    if (reply.get_items && reply.get_items.length > 0) {
      for (const item of reply.get_items) {
        if (toNum(item.id) === 1001) {
          gold = toNum(item.count);
          break;
        }
      }
    }
    sendLog('[仓库] 出售请求成功，获得金币: ' + gold);
    return reply;
  } catch (e) {
    sendLog('[仓库] 出售请求失败: ' + e.message);
    return null;
  }
}

async function sellAllFruits(specificItemIds, specificUids) {
  try {
    sendLog('[仓库] 开始检查背包...');
    const bagReply = await getBag();
    if (!bagReply) {
      sendLog('[仓库] 获取背包失败');
      return;
    }
    
    const items = bagReply.item_bag?.items || bagReply.items || [];
    sendLog('[仓库] 背包共有 ' + items.length + ' 种物品');
    
    bagItems = items.map(item => ({
      id: toNum(item.id),
      count: toNum(item.count),
      uid: item.uid != null ? toNum(item.uid) : 0,
      isFruit: toNum(item.id) >= 3001 && toNum(item.id) <= 49999,
    }));
    
    // 将 specificItemIds 和 specificUids 转换为 Set 便于查找
    const idSet = specificItemIds ? new Set(specificItemIds.map(id => toNum(id))) : null;
    const uidSet = specificUids ? new Set(specificUids.map(uid => toNum(uid))) : null;
    
    const toSell = items.filter(item => {
      const id = toNum(item.id);
      const count = toNum(item.count);
      const uid = item.uid != null ? toNum(item.uid) : 0;
      // 检查 ID 范围、数量大于 0、且必须有 uid
      const isValid = id >= 3001 && id <= 49999 && count > 0 && uid !== 0;
      if (!isValid) return false;
      // 如果指定了 specificUids，则只售卖这些uid的物品（精确选择）
      if (uidSet) {
        return uidSet.has(uid);
      }
      // 如果指定了 specificItemIds，则只售卖这些种类的果实
      if (idSet) {
        return idSet.has(id);
      }
      return true;
    });
    
    // 计算总数量
    const totalCount = toSell.reduce((sum, item) => sum + toNum(item.count), 0);
    const uniqueTypes = new Set(toSell.map(item => toNum(item.id))).size;
    sendLog('[仓库] 找到 ' + toSell.length + ' 个果实（' + uniqueTypes + ' 种）可出售' + (uidSet ? '（按uid筛选）' : idSet ? '（按种类筛选）' : '（全部）'));
    
    if (toSell.length === 0) {
      sendLog('[仓库] 没有果实需要出售');
      return;
    }
    
    let totalGold = 0;
    for (let i = 0; i < toSell.length; i += 15) {
      const batch = toSell.slice(i, i + 15);
      const batchCount = batch.reduce((sum, item) => sum + toNum(item.count), 0);
      sendLog('[仓库] 正在出售第 ' + (i + 1) + '-' + Math.min(i + 15, toSell.length) + ' 个（共 ' + batchCount + ' 个）...');
      const reply = await sellItems(batch);
      if (reply) {
        // 从 get_items 中提取金币 (id=1001)
        let gold = 0;
        if (reply.get_items && reply.get_items.length > 0) {
          for (const item of reply.get_items) {
            if (toNum(item.id) === 1001) {
              gold = toNum(item.count);
              break;
            }
          }
        }
        // 兼容旧版 gold 字段
        if (gold === 0 && reply.gold != null) {
          gold = toNum(reply.gold);
        }
        totalGold += gold;
        sendLog('[仓库] 本批出售获得 ' + gold + ' 金币');
      } else {
        sendLog('[仓库] 本批出售失败');
      }
      if (i + 15 < toSell.length) await sleep(300);
    }
    
    if (totalGold > 0) {
      const finalCount = toSell.reduce((sum, item) => sum + toNum(item.count), 0);
      const finalTypes = new Set(toSell.map(item => toNum(item.id))).size;
      sendLog('[仓库] 出售 ' + finalCount + ' 个果实（' + finalTypes + ' 种），获得 ' + totalGold + ' 金币');
      todayStats.sell += totalGold;
    }
  } catch (e) {
    sendLog('[仓库] 出售失败: ' + e.message);
  }
}

// ============ 农场操作 ============
async function getAllLands(retryCount = 3) {
  for (let i = 0; i < retryCount; i++) {
    try {
      const body = types.AllLandsRequest.encode(types.AllLandsRequest.create({})).finish();
      const { body: replyBody } = await sendMsgAsync('gamepb.plantpb.PlantService', 'AllLands', body);
      const reply = types.AllLandsReply.decode(replyBody);
      // 更新操作限制
      if (reply.operation_limits) {
        for (const limit of reply.operation_limits) {
          const id = toNum(limit.id);
          if (id > 0) {
            operationLimits.set(id, {
              dayTimes: toNum(limit.day_times),
              dayTimesLimit: toNum(limit.day_times_lt),
              dayExpTimes: toNum(limit.day_exp_times),
              dayExpTimesLimit: toNum(limit.day_ex_times_lt),
            });
          }
        }
      }
      // 检查返回的数据是否有效
      if (!reply.lands || reply.lands.length === 0) {
        if (i < retryCount - 1) {
          sendLog('[土地] getAllLands 返回空数据，重试 ' + (i + 1) + '/' + retryCount);
          await sleep(500);
          continue;
        }
      }
      return reply;
    } catch (e) {
      if (i < retryCount - 1) {
        sendLog('[土地] getAllLands 失败，重试 ' + (i + 1) + '/' + retryCount + ': ' + e.message);
        await sleep(500);
      } else {
        sendLog('[土地] getAllLands 最终失败: ' + e.message);
        return null;
      }
    }
  }
  return null;
}

async function harvest(landIds) {
  const state = getUserState();
  const body = types.HarvestRequest.encode(types.HarvestRequest.create({
    land_ids: landIds, host_gid: toLong(state.gid), is_all: true,
  })).finish();
  const { body: replyBody } = await sendMsgAsync('gamepb.plantpb.PlantService', 'Harvest', body);
  return types.HarvestReply.decode(replyBody);
}

async function waterLand(landIds) {
  const state = getUserState();
  const body = types.WaterLandRequest.encode(types.WaterLandRequest.create({
    land_ids: landIds, host_gid: toLong(state.gid),
  })).finish();
  const { body: replyBody } = await sendMsgAsync('gamepb.plantpb.PlantService', 'WaterLand', body);
  return types.WaterLandReply.decode(replyBody);
}

async function weedOut(landIds) {
  const state = getUserState();
  const body = types.WeedOutRequest.encode(types.WeedOutRequest.create({
    land_ids: landIds, host_gid: toLong(state.gid),
  })).finish();
  const { body: replyBody } = await sendMsgAsync('gamepb.plantpb.PlantService', 'WeedOut', body);
  return types.WeedOutReply.decode(replyBody);
}

async function insecticide(landIds) {
  const state = getUserState();
  const body = types.InsecticideRequest.encode(types.InsecticideRequest.create({
    land_ids: landIds, host_gid: toLong(state.gid),
  })).finish();
  const { body: replyBody } = await sendMsgAsync('gamepb.plantpb.PlantService', 'Insecticide', body);
  return types.InsecticideReply.decode(replyBody);
}

async function fertilize(landIds, fertilizerId = 1011) {
  let successCount = 0;
  let lastCount = -1;
  
  const shouldRefill = fertilizerId === 1011 
    ? ACCOUNT_CONFIG.autoRefillNormalFertilizer 
    : ACCOUNT_CONFIG.autoRefillOrganicFertilizer;
  
  for (const landId of landIds) {
    let fertilized = false;
    let retryCount = 0;
    const maxRetries = shouldRefill ? 1 : 0;
    
    while (!fertilized && retryCount <= maxRetries) {
      try {
        // 使用 proto 类型创建请求（和 new sample 一致）
        const body = types.FertilizeRequest.encode(types.FertilizeRequest.create({
          land_ids: [toLong(landId)],
          fertilizer_id: toLong(fertilizerId),
        })).finish();
        const { body: replyBody } = await sendMsgAsync('gamepb.plantpb.PlantService', 'Fertilize', body);
        const reply = types.FertilizeReply.decode(replyBody);
        // 获取施肥后的肥料数量
        if (reply.fertilizer && reply.fertilizer.count != null) {
          lastCount = toNum(reply.fertilizer.count);
        }
        successCount++;
        fertilized = true;
      } catch (e) { 
        sendLog('[施肥] 施肥失败(土地' + landId + '): ' + e.message);
        // 检查是否是肥料不足的错误，且还有重试次数
        if (retryCount < maxRetries && e.message && (e.message.includes('容器不足') || e.message.includes('1000019'))) {
          sendLog('[施肥] 需要补充肥料，开始补充...');
          await refillFertilizer(fertilizerId);
          retryCount++;
          continue; // 重试施肥
        }
        // 网络繁忙错误，等待后重试
        if (e.message && (e.message.includes('网络繁忙') || e.message.includes('1020001'))) {
          sendLog('[施肥] 网络繁忙，等待500ms后重试...');
          await sleep(500);
          retryCount++;
          continue;
        }
        break; // 其他错误或已重试过，跳过这块地
      }
    }
    
    if (landIds.length > 1) await sleep(50);
  }
  
  // 检查是否需要补充肥料（用于下次施肥）
  if (shouldRefill && lastCount >= 0 && lastCount <= ACCOUNT_CONFIG.fertilizerRefillThreshold) {
    await refillFertilizer(fertilizerId);
  }
  
  return successCount;
}

// 补充肥料函数
async function refillFertilizer(fertilizerId) {
  const refillItems = FERTILIZER_REFILL_ITEMS[fertilizerId];
  if (!refillItems) return;

  try {
    // 获取背包信息
    const bagBody = types.BagRequest.encode(types.BagRequest.create({})).finish();
    const { body: bagReplyBody } = await sendMsgAsync('gamepb.itempb.ItemService', 'Bag', bagBody);
    const bagReply = types.BagReply.decode(bagReplyBody);
    // 背包数据可能在 item_bag.items 或 items 中
    const items = (bagReply.item_bag && bagReply.item_bag.items) || bagReply.items || [];

    sendLog('[肥料补充] 查询背包找到 ' + items.length + ' 个物品，查找补充道具: [' + refillItems.join(',') + ']');

    // 按优先级查找并使用补充道具
    for (const refillId of refillItems) {
      const item = items.find(i => toNum(i.id) === refillId && toNum(i.count) > 0);
      if (item) {
        const itemName = getItemName(refillId);
        sendLog('[肥料补充] 找到补充道具 ' + itemName + '(' + refillId + ') x' + toNum(item.count));
        try {
          const useBody = types.UseRequest.encode(types.UseRequest.create({
            item: { id: toLong(refillId), count: toLong(1) }
          })).finish();
          await sendMsgAsync('gamepb.itempb.ItemService', 'Use', useBody);
          sendLog('[肥料补充] 使用 ' + itemName + ' 补充肥料成功');
          return;
        } catch (e) {
          sendLog('[肥料补充] 使用 ' + itemName + ' 失败: ' + e.message);
        }
      }
    }

    // 没有找到可用的补充道具
    const fertilizerName = fertilizerId === 1011 ? '普通肥' : '有机肥';
    sendLog('[肥料补充] ' + fertilizerName + ' 补充道具不足，请通过活动或商店获取');
  } catch (e) {
    sendLog('[肥料补充] 补充失败: ' + e.message);
  }
}

async function removePlant(landIds) {
  const body = types.RemovePlantRequest.encode(types.RemovePlantRequest.create({
    land_ids: landIds.map(id => toLong(id)),
  })).finish();
  const { body: replyBody } = await sendMsgAsync('gamepb.plantpb.PlantService', 'RemovePlant', body);
  return types.RemovePlantReply.decode(replyBody);
}

// ============ 商店与种植 ============
async function getShopInfo(shopId) {
  const body = types.ShopInfoRequest.encode(types.ShopInfoRequest.create({ shop_id: toLong(shopId) })).finish();
  const { body: replyBody } = await sendMsgAsync('gamepb.shoppb.ShopService', 'ShopInfo', body);
  return types.ShopInfoReply.decode(replyBody);
}

async function buyGoods(goodsId, num, price) {
  const body = types.BuyGoodsRequest.encode(types.BuyGoodsRequest.create({
    goods_id: toLong(goodsId), num: toLong(num), price: toLong(price),
  })).finish();
  const { body: replyBody } = await sendMsgAsync('gamepb.shoppb.ShopService', 'BuyGoods', body);
  return types.BuyGoodsReply.decode(replyBody);
}

async function plantSeeds(seedId, landIds) {
  let successCount = 0;
  for (const landId of landIds) {
    try {
      const writer = require('protobufjs').Writer.create();
      const itemWriter = writer.uint32(18).fork();
      itemWriter.uint32(8).int64(seedId);
      const idsWriter = itemWriter.uint32(18).fork();
      idsWriter.int64(landId);
      idsWriter.ldelim();
      itemWriter.ldelim();
      const body = writer.finish();
      await sendMsgAsync('gamepb.plantpb.PlantService', 'Plant', body);
      successCount++;
    } catch (e) {}
    if (landIds.length > 1) await sleep(50);
  }
  return successCount;
}

async function findBestSeed(unlockedLandCount) {
  try {
    const shopReply = await getShopInfo(2);
    if (!shopReply.goods_list || shopReply.goods_list.length === 0) return null;

    const state = getUserState();
    const available = [];
    for (const goods of shopReply.goods_list) {
      if (!goods.unlocked) continue;
      let meetsConditions = true;
      let requiredLevel = 0;
      for (const cond of goods.conds || []) {
        if (toNum(cond.type) === 1) {
          requiredLevel = toNum(cond.param);
          if (state.level < requiredLevel) { meetsConditions = false; break; }
        }
      }
      if (!meetsConditions) continue;
      const limitCount = toNum(goods.limit_count);
      const boughtNum = toNum(goods.bought_num);
      if (limitCount > 0 && boughtNum >= limitCount) continue;

      const seedId = toNum(goods.item_id);
      const plantId = 1020000 + (seedId - 20000);
      const plantName = plantConfig[plantId]?.name || '';

      available.push({
        goodsId: toNum(goods.id),
        seedId: seedId,
        price: toNum(goods.price),
        requiredLevel,
        plantName: plantName,
      });
    }

    if (available.length === 0) return null;

    // 如果关闭了智能推荐，使用用户配置的种子
    if (!ACCOUNT_CONFIG.enableSmartPlant) {
      // 从配置中提取作物名称（格式: "作物名 (LvX) 时间"）
      const configName = ACCOUNT_CONFIG.seedType.split(' (')[0].trim();

      // 查找匹配的种子
      const matchedSeed = available.find(seed => seed.plantName === configName);
      if (matchedSeed) {
        sendLog('[种植] 使用配置的种子: ' + configName + '（智能推荐已关闭）');
        return matchedSeed;
      }

      // 如果没有找到匹配的种子，记录日志并使用兜底策略
      sendLog('[种植] 未找到配置的种子: ' + configName + '，将使用兜底策略');
    } else {
      // 使用智能推荐
      try {
        sendLog('[商店] 等级: ' + state.level + '，土地数量: ' + unlockedLandCount);
        const rec = getPlantingRecommendation(state.level, unlockedLandCount || 18, { top: 50 });
        const rankedSeedIds = rec.candidatesNormalFert.map(x => x.seedId);
        for (const seedId of rankedSeedIds) {
          const hit = available.find(x => x.seedId === seedId);
          if (hit) {
            sendLog('[商店] 智能推荐: ' + hit.plantName + ' (seed=' + hit.seedId + ') 每小时' + rec.candidatesNormalFert.find(x => x.seedId === seedId).expPerHour + '经验');
            return hit;
          }
        }
      } catch (e) {
        sendLog('[商店] 智能推荐失败，使用兜底策略: ' + e.message);
      }
    }

    // 兜底策略：28级以前种白萝卜，28级以上选最高等级
    if (state.level && state.level <= 28) {
      available.sort((a, b) => a.requiredLevel - b.requiredLevel);
    } else {
      available.sort((a, b) => b.requiredLevel - a.requiredLevel);
    }
    sendLog('[商店] 兜底策略选择: ' + available[0].plantName);
    return available[0];
  } catch (e) { 
    sendLog('[商店] 查找种子失败: ' + e.message);
    return null; 
  }
}

async function autoPlantEmptyLands(deadLandIds, emptyLandIds, unlockedLandCount) {
  let landsToPlant = [...emptyLandIds];
  const state = getUserState();
  
  if (deadLandIds.length > 0) {
    try {
      await removePlant(deadLandIds);
      sendLog('[农场] 铲除 ' + deadLandIds.length + ' 块枯死作物');
      landsToPlant.push(...deadLandIds);
    } catch (e) {}
  }
  
  if (landsToPlant.length === 0) return;
  
  const bestSeed = await findBestSeed(unlockedLandCount);
  if (!bestSeed) return;
  
  const seedName = plantConfig[1020000 + (bestSeed.seedId - 20000)]?.name || `种子${bestSeed.seedId}`;
  
  const totalCost = bestSeed.price * landsToPlant.length;
  if (totalCost > state.gold) {
    const canBuy = Math.floor(state.gold / bestSeed.price);
    if (canBuy <= 0) return;
    landsToPlant = landsToPlant.slice(0, canBuy);
  }
  
  let actualSeedId = bestSeed.seedId;
  try {
    const buyReply = await buyGoods(bestSeed.goodsId, landsToPlant.length, bestSeed.price);
    if (buyReply.get_items && buyReply.get_items.length > 0) {
      actualSeedId = toNum(buyReply.get_items[0].id) || actualSeedId;
    }
    sendLog(`[商店] 购买 ${seedName}种子 x${landsToPlant.length}`);
  } catch (e) { return; }
  
  try {
    const planted = await plantSeeds(actualSeedId, landsToPlant);
    sendLog(`[种植] 种植 ${planted} 块 ${seedName}`);
    // 注意：种植不增加收获次数和经验
    
    // 施肥（根据配置，支持热更新）
    if (ACCOUNT_CONFIG.autoFertilize && planted > 0) {
      let normalCount = 0;
      let organicCount = 0;

      if (ACCOUNT_CONFIG.useOrganicFertilizer) {
        if (ACCOUNT_CONFIG.useBothFertilizers) {
          // 同时使用两种肥料：每块地先施普通肥，再施有机肥
          for (let i = 0; i < planted; i++) {
            const landId = landsToPlant[i];
            // 先施普通肥
            try {
              const normalResult = await fertilize([landId], 1011);
              if (normalResult > 0) {
                normalCount++;
              } else {
                sendLog('[施肥] 普通肥失败 (土地' + landId + ')');
              }
            } catch (e) {
              sendLog('[施肥] 普通肥错误: ' + e.message);
            }
            // 再施有机肥
            try {
              const organicResult = await fertilize([landId], 1012);
              if (organicResult > 0) {
                organicCount++;
              } else {
                sendLog('[施肥] 有机肥失败 (土地' + landId + ')');
              }
            } catch (e) {
              sendLog('[施肥] 有机肥错误: ' + e.message);
            }
          }
          // 详细记录两种肥料的使用情况
          if (normalCount > 0 || organicCount > 0) {
            sendLog('[施肥] 普通肥' + normalCount + ' 有机肥' + organicCount);
          }
        } else {
          // 优先使用有机肥，不足时用普通肥
          organicCount = await fertilize(landsToPlant.slice(0, planted), 1012);
          if (organicCount < planted) {
            normalCount = await fertilize(landsToPlant.slice(organicCount, planted), 1011);
          }
          if (normalCount > 0 || organicCount > 0) {
            sendLog('[施肥] 普通肥' + normalCount + ' 有机肥' + organicCount);
          }
        }
      } else {
        // 只使用普通肥
        normalCount = await fertilize(landsToPlant.slice(0, planted), 1011);
        if (normalCount > 0) {
          sendLog('[施肥] 普通肥' + normalCount);
        }
      }
    }
  } catch (e) {}
}

// ============ 土地分析 ============
function analyzeLands(lands) {
  const result = {
    harvestable: [], needWater: [], needWeed: [], needBug: [],
    growing: [], empty: [], dead: [], harvestableInfo: [],
  };
  
  const nowSec = getServerTimeSec();
  
  for (const land of lands) {
    const id = toNum(land.id);
    if (!land.unlocked) continue;
    
    const plant = land.plant;
    if (!plant || !plant.phases || plant.phases.length === 0) {
      result.empty.push(id);
      continue;
    }
    
    const currentPhase = getCurrentPhase(plant.phases);
    if (!currentPhase) {
      result.empty.push(id);
      continue;
    }
    const phaseVal = currentPhase;
    
    if (phaseVal === PlantPhase.DEAD) {
      result.dead.push(id);
      continue;
    }
    
    if (phaseVal === PlantPhase.MATURE) {
      result.harvestable.push(id);
      const plantIdNum = toNum(plant.id);
      const plantInfo = plantConfig[plantIdNum];
      const exp = plantInfo?.exp || 0;
      result.harvestableInfo.push({
        landId: id, plantId: plantIdNum,
        name: plantInfo?.name || plant.name || '未知',
        exp: exp,
      });
      continue;
    }
    
    const dryNum = toNum(plant.dry_num);
    const dryTime = toTimeSec(plant.phases[plant.phases.length - 1]?.dry_time);
    if (dryNum > 0 || (dryTime > 0 && dryTime <= nowSec)) {
      result.needWater.push(id);
    }
    
    const weedsTime = toTimeSec(plant.phases[plant.phases.length - 1]?.weeds_time);
    const hasWeeds = (plant.weed_owners?.length > 0) || (weedsTime > 0 && weedsTime <= nowSec);
    if (hasWeeds) result.needWeed.push(id);
    
    const insectTime = toTimeSec(plant.phases[plant.phases.length - 1]?.insect_time);
    const hasBugs = (plant.insect_owners?.length > 0) || (insectTime > 0 && insectTime <= nowSec);
    if (hasBugs) result.needBug.push(id);
    
    result.growing.push(id);
  }
  
  return result;
}

// ============ 好友系统 ============
async function getAllFriends() {
  const isQQ = CONFIG.platform === 'qq';
  if (isQQ) {
    // QQ平台使用 SyncAll 接口
    const body = types.SyncAllRequest.encode(types.SyncAllRequest.create({ open_ids: [] })).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.friendpb.FriendService', 'SyncAll', body);
    return types.SyncAllReply.decode(replyBody);
  }
  // 微信平台使用 GetAll 接口
  const body = types.GetAllFriendsRequest.encode(types.GetAllFriendsRequest.create({})).finish();
  const { body: replyBody } = await sendMsgAsync('gamepb.friendpb.FriendService', 'GetAll', body);
  return types.GetAllFriendsReply.decode(replyBody);
}

async function enterFriendFarm(friendGid) {
  const body = types.VisitEnterRequest.encode(types.VisitEnterRequest.create({
    host_gid: toLong(friendGid), reason: 2,
  })).finish();
  const { body: replyBody } = await sendMsgAsync('gamepb.visitpb.VisitService', 'Enter', body);
  return types.VisitEnterReply.decode(replyBody);
}

async function leaveFriendFarm(friendGid) {
  const body = types.VisitLeaveRequest.encode(types.VisitLeaveRequest.create({ host_gid: toLong(friendGid) })).finish();
  try { await sendMsgAsync('gamepb.visitpb.VisitService', 'Leave', body); } catch (e) {}
}

async function helpWater(friendGid, landIds) {
  const body = types.WaterLandRequest.encode(types.WaterLandRequest.create({
    land_ids: landIds, host_gid: toLong(friendGid),
  })).finish();
  const { body: replyBody } = await sendMsgAsync('gamepb.plantpb.PlantService', 'WaterLand', body);
  const reply = types.WaterLandReply.decode(replyBody);
  if (reply.operation_limits) updateOpLimits(reply.operation_limits);
  return reply;
}

async function helpWeed(friendGid, landIds) {
  const body = types.WeedOutRequest.encode(types.WeedOutRequest.create({
    land_ids: landIds, host_gid: toLong(friendGid),
  })).finish();
  const { body: replyBody } = await sendMsgAsync('gamepb.plantpb.PlantService', 'WeedOut', body);
  const reply = types.WeedOutReply.decode(replyBody);
  if (reply.operation_limits) updateOpLimits(reply.operation_limits);
  return reply;
}

async function helpInsecticide(friendGid, landIds) {
  const body = types.InsecticideRequest.encode(types.InsecticideRequest.create({
    land_ids: landIds, host_gid: toLong(friendGid),
  })).finish();
  const { body: replyBody } = await sendMsgAsync('gamepb.plantpb.PlantService', 'Insecticide', body);
  const reply = types.InsecticideReply.decode(replyBody);
  if (reply.operation_limits) updateOpLimits(reply.operation_limits);
  return reply;
}

async function putInsects(friendGid, landIds) {
  const body = types.PutInsectsRequest.encode(types.PutInsectsRequest.create({
    land_ids: landIds, host_gid: toLong(friendGid),
  })).finish();
  const { body: replyBody } = await sendMsgAsync('gamepb.plantpb.PlantService', 'PutInsects', body);
  const reply = types.PutInsectsReply.decode(replyBody);
  if (reply.operation_limits) updateOpLimits(reply.operation_limits);
  return reply;
}

async function putWeeds(friendGid, landIds) {
  const body = types.PutWeedsRequest.encode(types.PutWeedsRequest.create({
    land_ids: landIds, host_gid: toLong(friendGid),
  })).finish();
  const { body: replyBody } = await sendMsgAsync('gamepb.plantpb.PlantService', 'PutWeeds', body);
  const reply = types.PutWeedsReply.decode(replyBody);
  if (reply.operation_limits) updateOpLimits(reply.operation_limits);
  return reply;
}

async function stealHarvest(friendGid, landIds) {
  const body = types.HarvestRequest.encode(types.HarvestRequest.create({
    land_ids: landIds, host_gid: toLong(friendGid), is_all: true,
  })).finish();
  const { body: replyBody } = await sendMsgAsync('gamepb.plantpb.PlantService', 'Harvest', body);
  const reply = types.HarvestReply.decode(replyBody);
  if (reply.operation_limits) updateOpLimits(reply.operation_limits);
  return reply;
}

function updateOpLimits(limits) {
  if (!limits) return;
  for (const limit of limits) {
    const id = toNum(limit.id);
    if (id > 0) {
      operationLimits.set(id, {
        dayTimes: toNum(limit.day_times),
        dayTimesLimit: toNum(limit.day_times_lt),
        dayExpTimes: toNum(limit.day_exp_times),
        dayExpTimesLimit: toNum(limit.day_ex_times_lt),
      });
    }
  }
}

/**
 * 获取本地日期键值 (YYYY-MM-DD格式，使用本地时区)
 */
function getLocalDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

/**
 * 检查是否需要重置每日限制 (0点刷新)
 */
function checkDailyReset() {
  const today = getLocalDateKey();  // 使用本地日期，避免时区问题
  if (lastResetDate !== today) {
    if (lastResetDate !== '') {
      sendLog('[系统] 跨日重置，清空操作限制缓存');
    }
    operationLimits.clear();
    expTracker.clear();
    expExhausted.clear();
    lastResetDate = today;
  }
}

/**
 * 标记经验检查 - 在帮助操作前记录当前经验次数
 * 用于后续对比判断是否还能获得经验
 */
function markExpCheck(opId) {
  const limit = operationLimits.get(opId);
  if (limit) {
    expTracker.set(opId, limit.dayExpTimes);
  }
}

/**
 * 检查操作后经验是否增长，判断经验是否耗尽
 * @returns {boolean} true = 还能获得经验, false = 经验已耗尽
 */
function checkExpGained(opId) {
  const beforeExp = expTracker.get(opId);
  if (beforeExp === undefined) return true; // 没有记录，默认可以获得
  
  const limit = operationLimits.get(opId);
  if (!limit) return true;
  
  const gained = limit.dayExpTimes > beforeExp;
  if (!gained) {
    expExhausted.add(opId);
    sendLog('[调试] 经验已耗尽 opId=' + opId + ' 操作前=' + beforeExp + ' 操作后=' + limit.dayExpTimes);
  }
  return gained;
}

function canGetExp(opId) {
  checkDailyReset();
  
  // 如果已知经验已耗尽，直接返回false
  if (expExhausted.has(opId)) {
    return false;
  }
  
  const limit = operationLimits.get(opId);
  if (!limit) {
    // 没有限制信息时，默认认为可以获得经验（让操作执行后再判断）
    return true;
  }
  if (limit.dayExpTimesLimit <= 0) return true;
  const canGet = limit.dayExpTimes < limit.dayExpTimesLimit;
  if (!canGet) {
    expExhausted.add(opId);
    sendLog('[调试] canGetExp: 已达上限 opId=' + opId + ' ' + limit.dayExpTimes + '/' + limit.dayExpTimesLimit);
  }
  return canGet;
}

function analyzeFriendLands(lands, myGid, friendName = '') {
  const result = { stealable: [], stealableInfo: [], needWater: [], needWeed: [], needBug: [], canPutBug: [], canPutWeed: [] };
  let debugInfo = [];
  for (const land of lands) {
    const id = toNum(land.id);
    const plant = land.plant;
    if (!plant || !plant.phases || plant.phases.length === 0) continue;
    
    const currentPhase = getCurrentPhase(plant.phases);
    if (!currentPhase) continue;
    const phaseVal = currentPhase;
    
    // 收集调试信息
    const dryNum = toNum(plant.dry_num);
    const weedOwners = plant.weed_owners || [];
    const insectOwners = plant.insect_owners || [];
    const isStealable = plant.stealable;
    
    if (dryNum > 0 || weedOwners.length > 0 || insectOwners.length > 0 || isStealable) {
      debugInfo.push('土地' + id + ':阶段' + phaseVal + '干' + dryNum + '草' + weedOwners.length + '虫' + insectOwners.length + '偷' + isStealable);
    }
    
    if (phaseVal === PlantPhase.MATURE && plant.stealable) {
      const plantId = toNum(plant.id);
      const plantInfo = plantConfig[plantId];
      const plantName = plantInfo?.name || plant.name || '未知';
      
      // 检查是否跳过白萝卜（支持热更新）
      if (ACCOUNT_CONFIG.skipWhiteRadish && (plantId === 1020002 || plantId === 2020002 || plantName === '白萝卜')) {
        debugInfo.push('土地' + id + ':跳过白萝卜');
        continue;
      }
      
      result.stealable.push(id);
      result.stealableInfo.push({ landId: id, plantId: plantId, name: plantName });
      continue;
    }
    
    if (phaseVal === PlantPhase.DEAD) continue;
    
    // 帮助操作
    if (dryNum > 0) result.needWater.push(id);
    if (weedOwners.length > 0) result.needWeed.push(id);
    if (insectOwners.length > 0) result.needBug.push(id);
    
    // 捣乱操作: 检查是否可以放草/放虫
    const iAlreadyPutWeed = weedOwners.some(gid => toNum(gid) === myGid);
    const iAlreadyPutBug = insectOwners.some(gid => toNum(gid) === myGid);
    
    // 每块地最多2个草/虫，且我没放过
    if (weedOwners.length < 2 && !iAlreadyPutWeed) {
      result.canPutWeed.push(id);
    }
    if (insectOwners.length < 2 && !iAlreadyPutBug) {
      result.canPutBug.push(id);
    }
  }
  // 输出调试信息（简化输出，只在有重要信息时显示）
  if (debugInfo.length > 0) {
    // 只显示跳过的白萝卜信息，其他详细信息省略
    const skipInfo = debugInfo.filter(info => info.includes('跳过白萝卜'));
    if (skipInfo.length > 0) {
      sendLog('[好友] ' + (friendName || '') + ' ' + skipInfo.join(', '));
    }
  }
  return result;
}

async function visitFriend(friend, totalActions, myGid) {
  const { gid, name } = friend;
  let enterReply;
  try {
    enterReply = await enterFriendFarm(gid);
  } catch (e) { return; }

  const lands = enterReply.lands || [];
  if (lands.length === 0) {
    await leaveFriendFarm(gid);
    return;
  }
  
  // 输出好友名称和土地数量
  sendLog('[好友] 访问 ' + (name || gid) + ' 的土地，共 ' + lands.length + ' 块');

  // 保存好友土地信息到 dataCollector
  const friendLands = lands.map(land => {
    const plant = land.plant;
    if (!plant || !plant.phases || plant.phases.length === 0) {
      return { id: toNum(land.id), status: '空闲' };
    }
    const currentPhase = getCurrentPhase(plant.phases);
    const phaseVal = currentPhase ? currentPhase.phase : PlantPhase.UNKNOWN;
    const plantId = toNum(plant.id);
    const plantName = getPlantName(plantId) || plant.name || '未知作物';

    let status = '生长中';
    if (phaseVal === PlantPhase.MATURE) status = '成熟';
    else if (phaseVal === PlantPhase.DEAD) status = '枯萎';
    else if (phaseVal === PlantPhase.SEED) status = '种子';

    return {
      id: toNum(land.id),
      status: status,
      plantName: plantName,
      phase: PHASE_NAMES[phaseVal] || '未知',
      stealable: plant.stealable || false,
      dry: toNum(plant.dry_num) > 0,
      weed: (plant.weed_owners || []).length,
      bug: (plant.insect_owners || []).length
    };
  });

  // 获取现有好友列表并更新土地信息
  const existingData = dataCollector.getAccountData(ACCOUNT_ID) || {};
  const existingFriends = existingData.friends || [];
  const friendIndex = existingFriends.findIndex(f => f.gid === gid);

  if (friendIndex >= 0) {
    // 更新现有好友的土地信息
    existingFriends[friendIndex].lands = friendLands;
    existingFriends[friendIndex].lastVisitTime = Date.now();
  } else {
    // 如果好友不在列表中，添加一个新条目（只有土地信息）
    existingFriends.push({
      gid: gid,
      name: name || '',
      remark: '',
      level: 0,
      avatar: '',
      lands: friendLands,
      lastVisitTime: Date.now(),
      plant: null
    });
  }

  await dataCollector.updateAccountData(ACCOUNT_ID, { friends: existingFriends });

  const status = analyzeFriendLands(lands, myGid, name);
  const actions = [];

  // 检查白名单
  const isInStealWhitelist = ACCOUNT_CONFIG.stealWhitelist?.includes(gid);
  const isInHelpWaterWhitelist = ACCOUNT_CONFIG.helpWaterWhitelist?.includes(gid);
  const isInHelpWeedWhitelist = ACCOUNT_CONFIG.helpWeedWhitelist?.includes(gid);
  const isInHelpBugWhitelist = ACCOUNT_CONFIG.helpBugWhitelist?.includes(gid);
  const isInPutBugWhitelist = ACCOUNT_CONFIG.putBugWhitelist?.includes(gid);
  const isInPutWeedWhitelist = ACCOUNT_CONFIG.putWeedWhitelist?.includes(gid);

  // 调试日志：显示土地分析结果（总是输出）
  sendLog('[好友] 土地分析: 草' + status.needWeed.length + ' 虫' + status.needBug.length + ' 水' + status.needWater.length + ' 偷' + status.stealable.length + ' 土地总数:' + lands.length);

  // 帮除草（支持热更新）
  if (ACCOUNT_CONFIG.enableHelpWeed && status.needWeed.length > 0 && !isInHelpWeedWhitelist) {
    const shouldHelp = !ACCOUNT_CONFIG.helpOnlyWithExp || canGetExp(OP_IDS.WEED);
    if (shouldHelp) {
      let ok = 0;
      for (const landId of status.needWeed) {
        try { await helpWeed(gid, [landId]); ok++; } catch (e) {}
        await sleep(100);
      }
      if (ok > 0) { actions.push('除草' + ok); totalActions.weed += ok; todayStats.weed += ok; }
    } else {
      sendLog('[好友] 除草已达上限或无经验，跳过');
    }
  } else if (isInHelpWeedWhitelist && status.needWeed.length > 0) {
    sendLog('[好友] ' + name + ' 在除草白名单中，跳过');
  }

  // 帮除虫（支持热更新）
  if (ACCOUNT_CONFIG.enableHelpBug && status.needBug.length > 0 && !isInHelpBugWhitelist) {
    const shouldHelp = !ACCOUNT_CONFIG.helpOnlyWithExp || canGetExp(OP_IDS.BUG);
    if (shouldHelp) {
      let ok = 0;
      for (const landId of status.needBug) {
        try { await helpInsecticide(gid, [landId]); ok++; } catch (e) {}
        await sleep(100);
      }
      if (ok > 0) { actions.push('除虫' + ok); totalActions.bug += ok; todayStats.bug += ok; }
    } else {
      sendLog('[好友] 除虫已达上限或无经验，跳过');
    }
  } else if (isInHelpBugWhitelist && status.needBug.length > 0) {
    sendLog('[好友] ' + name + ' 在除虫白名单中，跳过');
  }

  // 帮浇水（支持热更新）
  if (ACCOUNT_CONFIG.enableHelpWater && status.needWater.length > 0 && !isInHelpWaterWhitelist) {
    const shouldHelp = !ACCOUNT_CONFIG.helpOnlyWithExp || canGetExp(OP_IDS.WATER);
    if (shouldHelp) {
      let ok = 0;
      for (const landId of status.needWater) {
        try { await helpWater(gid, [landId]); ok++; } catch (e) {}
        await sleep(100);
      }
      if (ok > 0) { actions.push('浇水' + ok); totalActions.water += ok; todayStats.water += ok; }
    } else {
      sendLog('[好友] 浇水已达上限或无经验，跳过');
    }
  } else if (isInHelpWaterWhitelist && status.needWater.length > 0) {
    sendLog('[好友] ' + name + ' 在浇水白名单中，跳过');
  }

  // 偷菜（支持热更新）
  if (ACCOUNT_CONFIG.enableSteal && status.stealable.length > 0 && !isInStealWhitelist) {
    let ok = 0;
    const stolenPlants = [];
    for (let i = 0; i < status.stealable.length; i++) {
      try {
        await stealHarvest(gid, [status.stealable[i]]);
        ok++;
        if (status.stealableInfo[i]) stolenPlants.push(status.stealableInfo[i].name);
      } catch (e) {}
      await sleep(100);
    }
    if (ok > 0) {
      const plantNames = [...new Set(stolenPlants)].join('/');
      actions.push('偷' + ok + '(' + plantNames + ')');
      totalActions.steal += ok;
      todayStats.steal += ok;
    }
  } else if (isInStealWhitelist && status.stealable.length > 0) {
    sendLog('[好友] ' + name + ' 在偷菜白名单中，跳过');
  }

  // 放虫（支持热更新）
  if (ACCOUNT_CONFIG.enablePutBug && status.canPutBug.length > 0 && !isInPutBugWhitelist) {
    let ok = 0;
    for (const landId of status.canPutBug.slice(0, 2)) {
      try { await putInsects(gid, [landId]); ok++; } catch (e) {}
      await sleep(100);
    }
    if (ok > 0) { actions.push('放虫' + ok); totalActions.putBug += ok; }
  } else if (isInPutBugWhitelist && status.canPutBug.length > 0) {
    sendLog('[好友] ' + name + ' 在放虫白名单中，跳过');
  }

  // 放草（支持热更新）
  if (ACCOUNT_CONFIG.enablePutWeed && status.canPutWeed.length > 0 && !isInPutWeedWhitelist) {
    let ok = 0;
    for (const landId of status.canPutWeed.slice(0, 2)) {
      try { await putWeeds(gid, [landId]); ok++; } catch (e) {}
      await sleep(100);
    }
    if (ok > 0) { actions.push('放草' + ok); totalActions.putWeed += ok; }
  } else if (isInPutWeedWhitelist && status.canPutWeed.length > 0) {
    sendLog('[好友] ' + name + ' 在放草白名单中，跳过');
  }
  
  if (actions.length > 0) {
    sendLog(`[好友] ${name}: ${actions.join('/')}`);
  }
  
  await leaveFriendFarm(gid);
}

async function checkFriends() {
  const state = getUserState();
  if (!state.gid) {
    sendLog('[好友] 未登录，跳过巡查');
    return;
  }

  try {
    const friendsReply = await getAllFriends();
    const friends = friendsReply.game_friends || [];

    if (friends.length === 0) return;

    // 分类好友：优先访问有收益的好友，其他好友（仅放虫放草）后面访问
    const priorityFriends = [];  // 优先访问：有可偷/可帮助的好友
    const otherFriends = [];     // 其他好友：仅用于放虫放草

    for (const f of friends) {
      const gid = toNum(f.gid);
      if (gid === state.gid) continue;
      const name = f.remark || f.name || ('GID:' + gid);
      const p = f.plant;
      const stealNum = p ? toNum(p.steal_plant_num) : 0;
      const dryNum = p ? toNum(p.dry_num) : 0;
      const weedNum = p ? toNum(p.weed_num) : 0;
      const insectNum = p ? toNum(p.insect_num) : 0;

      // 只访问有预览信息的好友（减少不必要的请求）
      if (stealNum > 0 || dryNum > 0 || weedNum > 0 || insectNum > 0) {
        const friendData = { gid, name, stealNum, dryNum, weedNum, insectNum };
        
        // 判断是否可以获取经验（浇水、除草、除虫）
        const canHelpWithExp = !HELP_ONLY_WITH_EXP || 
          canGetExp(OP_IDS.WATER) || canGetExp(OP_IDS.WEED) || canGetExp(OP_IDS.BUG);
        
        // 有可偷的作物 -> 优先访问
        // 需要帮助且还能获得经验 -> 优先访问
        // 其他情况（仅放虫放草）-> 后面访问
        if (stealNum > 0 || ((dryNum > 0 || weedNum > 0 || insectNum > 0) && canHelpWithExp)) {
          priorityFriends.push(friendData);
        } else {
          otherFriends.push(friendData);
        }
      }
    }

    // 合并好友列表：优先好友在前，其他好友在后
    const friendsToVisit = [...priorityFriends, ...otherFriends];

    if (friendsToVisit.length === 0) {
      sendLog('[好友] 没有需要操作的好友');
      return;
    }

    sendLog('[好友] 准备访问 ' + friendsToVisit.length + ' 位好友（优先' + priorityFriends.length + '人，其他' + otherFriends.length + '人）');

    let totalActions = { steal: 0, water: 0, weed: 0, bug: 0, putBug: 0, putWeed: 0 };
    for (const friend of friendsToVisit) {
      try { await visitFriend(friend, totalActions, state.gid); } catch (e) {}
      await sleep(500);
    }

    const summary = [];
    if (totalActions.steal > 0) summary.push('偷' + totalActions.steal);
    if (totalActions.weed > 0) summary.push('除草' + totalActions.weed);
    if (totalActions.bug > 0) summary.push('除虫' + totalActions.bug);
    if (totalActions.water > 0) summary.push('浇水' + totalActions.water);
    if (totalActions.putBug > 0) summary.push('放虫' + totalActions.putBug);
    if (totalActions.putWeed > 0) summary.push('放草' + totalActions.putWeed);

    const totalActionCount = totalActions.steal + totalActions.weed + totalActions.bug + 
                             totalActions.water + totalActions.putBug + totalActions.putWeed;
    
    if (summary.length > 0) {
      sendLog('[好友] 巡查 ' + friendsToVisit.length + ' 人 → ' + summary.join('/'));
    } else {
      sendLog('[好友] 巡查 ' + friendsToVisit.length + ' 人，但没有执行操作（可能已达上限或无经验）');
    }
  } catch (e) {}
}

// 自动解锁土地
async function autoUnlockLands(lands) {
  if (!ACCOUNT_CONFIG.autoUnlockLand) return;

  const lockedLands = lands.filter(land => !land.unlocked && land.could_unlock);
  if (lockedLands.length === 0) return;

  for (const land of lockedLands) {
    try {
      const landId = toNum(land.id);
      const unlockCondition = land.unlock_condition;
      const needLevel = unlockCondition?.need_level;
      const needGold = unlockCondition?.need_gold;
      sendLog('[土地] 正在解锁土地 #' + landId + '，需要等级:' + needLevel + ' 金币:' + needGold);

      const body = types.UnlockLandRequest.encode(
        types.UnlockLandRequest.create({ land_id: toLong(landId) })
      ).finish();

      const { body: replyBody } = await sendMsgAsync('gamepb.plantpb.PlantService', 'UnlockLand', body);
      const reply = types.UnlockLandReply.decode(replyBody);

      if (reply.land && reply.land.unlocked) {
        sendLog('[土地] 解锁土地 #' + landId + ' 成功！');
      } else {
        sendLog('[土地] 解锁土地 #' + landId + ' 失败: 未知错误');
      }
    } catch (e) {
      sendLog('[土地] 解锁土地 #' + toNum(land.id) + ' 失败: ' + e.message);
    }
  }
}

// 自动升级土地
async function autoUpgradeLands(lands) {
  if (!ACCOUNT_CONFIG.autoUpgradeLand) return;

  const upgradableLands = lands.filter(land => land.unlocked && land.could_upgrade);
  if (upgradableLands.length === 0) return;

  for (const land of upgradableLands) {
    try {
      const landId = toNum(land.id);
      const currentLevel = toNum(land.level);
      const upgradeCondition = land.upgrade_condition;
      const needGold = upgradeCondition?.need_gold;
      sendLog('[土地] 正在升级土地 #' + landId + ' (Lv' + currentLevel + '→' + (currentLevel + 1) + ')，需要金币:' + needGold);

      const body = types.UpgradeLandRequest.encode(
        types.UpgradeLandRequest.create({ land_id: toLong(landId) })
      ).finish();

      const { body: replyBody } = await sendMsgAsync('gamepb.plantpb.PlantService', 'UpgradeLand', body);
      const reply = types.UpgradeLandReply.decode(replyBody);

      if (reply.land) {
        sendLog('[土地] 升级土地 #' + landId + ' 成功 → Lv' + toNum(reply.land.level));
      } else {
        sendLog('[土地] 升级土地 #' + landId + ' 失败: 未知错误');
      }
    } catch (e) {
      sendLog('[土地] 升级土地 #' + toNum(land.id) + ' 失败: ' + e.message);
    }
  }
}

// ============ 主循环 ============
async function checkFarm() {
  const state = getUserState();
  if (!state.gid) return;
  
  try {
    const landsReply = await getAllLands();
    if (!landsReply || !landsReply.lands || landsReply.lands.length === 0) return;
    
    const lands = landsReply.lands;
    
    // 自动解锁和升级土地
    await autoUnlockLands(lands);
    await autoUpgradeLands(lands);
    
    const status = analyzeLands(lands);
    
    const statusParts = [];
    if (status.harvestable.length) statusParts.push('收:' + status.harvestable.length);
    if (status.needWeed.length) statusParts.push('草:' + status.needWeed.length);
    if (status.needBug.length) statusParts.push('虫:' + status.needBug.length);
    if (status.needWater.length) statusParts.push('水:' + status.needWater.length);
    if (status.dead.length) statusParts.push('枯:' + status.dead.length);
    if (status.empty.length) statusParts.push('空:' + status.empty.length);
    statusParts.push('长:' + status.growing.length);

    const hasWork = status.harvestable.length || status.needWeed.length || status.needBug.length
      || status.needWater.length || status.dead.length || status.empty.length;

    const actions = [];

    const batchOps = [];
    if (status.needWeed.length > 0) {
      batchOps.push(weedOut(status.needWeed).then(() => actions.push('除草' + status.needWeed.length)).catch(() => {}));
    }
    if (status.needBug.length > 0) {
      batchOps.push(insecticide(status.needBug).then(() => actions.push('除虫' + status.needBug.length)).catch(() => {}));
    }
    if (status.needWater.length > 0) {
      batchOps.push(waterLand(status.needWater).then(() => actions.push('浇水' + status.needWater.length)).catch(() => {}));
    }
    if (batchOps.length > 0) await Promise.all(batchOps);

    let harvestedLandIds = [];
    if (status.harvestable.length > 0) {
      try {
        await harvest(status.harvestable);
        actions.push('收获' + status.harvestable.length);
        harvestedLandIds = [...status.harvestable];
        todayStats.harvest += status.harvestable.length;
        const expGained = status.harvestableInfo.reduce((sum, info) => sum + (info.exp || 0), 0);
        todayStats.exp += expGained;
      } catch (e) {}
    }

    const allDeadLands = [...status.dead, ...harvestedLandIds];
    const allEmptyLands = [...status.empty];
    const unlockedLandCount = lands.filter(land => land && land.unlocked).length;
    if (allDeadLands.length > 0 || allEmptyLands.length > 0) {
      try {
        await autoPlantEmptyLands(allDeadLands, allEmptyLands, unlockedLandCount);
        actions.push('种植' + (allDeadLands.length + allEmptyLands.length));
      } catch (e) {}
    }

    if (hasWork) {
      sendLog('[农场] [' + statusParts.join(' ') + '] → ' + actions.join('/'));
    }
  } catch (e) {}
}

async function collectData() {
  const state = getUserState();
  if (isCollectingData || !state.gid) return;
  isCollectingData = true;
  lastCollectTime = Date.now();

  try {

    let landStatus = [];
    let hasValidLandData = false;
    try {
      const landsReply = await getAllLands();
      const lands = landsReply?.lands || [];

      if (lands && lands.length > 0) {
        landStatus = lands.map(land => {
          if (!land.unlocked) return { status: '锁定', phase: -1, phaseName: '锁定', couldUnlock: land.couldUnlock, unlockCondition: land.unlockCondition };
          const plant = land.plant;
          if (!plant || !plant.phases || plant.phases.length === 0) return { status: '空闲', phase: 0, phaseName: '空闲' };

          let plantName = plant.name;
          if (!plantName) {
            const plantInfo = plantConfig[toNum(plant.id)];
            plantName = plantInfo ? plantInfo.name : '作物' + toNum(plant.id);
          }

          const currentPhase = getCurrentPhase(plant.phases);
          const nowSec = getServerTimeSec();
          let phaseName = '生长中';
          let nextPhaseTime = 0;
          let progress = 0;
          let totalProgress = 0; // 到成熟的整体进度
          let matureTime = 0; // 预计成熟时间戳
          
          if (currentPhase === null) {
            phaseName = '生长中';
          } else if (currentPhase === PlantPhase.MATURE) {
            phaseName = '成熟';
            progress = 100;
            totalProgress = 100;
          } else if (currentPhase === PlantPhase.DEAD) {
            phaseName = '枯死';
          } else {
            phaseName = PHASE_NAMES[currentPhase] || '生长中';
            
            // 获取当前阶段信息
            const currentPhaseInfo = plant.phases.find(p => toNum(p.phase) === currentPhase);
            // 获取成熟阶段信息
            const maturePhaseInfo = plant.phases.find(p => toNum(p.phase) === PlantPhase.MATURE);

            if (currentPhaseInfo && currentPhaseInfo.begin_time) {
              const beginTime = toTimeSec(currentPhaseInfo.begin_time);

              // 计算到下一阶段的剩余时间
              const nextPhase = currentPhase + 1;
              const nextPhaseInfo = plant.phases.find(p => toNum(p.phase) === nextPhase);
              if (nextPhaseInfo && nextPhaseInfo.begin_time) {
                const nextBeginTime = toTimeSec(nextPhaseInfo.begin_time);
                nextPhaseTime = Math.max(0, nextBeginTime - nowSec);
                // 当前阶段进度百分比
                const phaseDuration = nextBeginTime - beginTime;
                const elapsed = nowSec - beginTime;
                progress = Math.min(99, Math.floor((elapsed / phaseDuration) * 100));
              }

              // 计算到成熟的整体进度
              if (maturePhaseInfo && maturePhaseInfo.begin_time) {
                const matureBeginTime = toTimeSec(maturePhaseInfo.begin_time);
                matureTime = matureBeginTime;

                // 找到种子阶段（phase === 1），如果找不到就使用第一个阶段
                let seedPhaseInfo = plant.phases.find(p => toNum(p.phase) === PlantPhase.SEED);
                if (!seedPhaseInfo && plant.phases.length > 0) {
                  seedPhaseInfo = plant.phases[0];
                }
                if (seedPhaseInfo && seedPhaseInfo.begin_time) {
                  const seedBeginTime = toTimeSec(seedPhaseInfo.begin_time);
                  const totalGrowTime = matureBeginTime - seedBeginTime;
                  const elapsedTotal = nowSec - seedBeginTime;

                  if (totalGrowTime > 0) {
                    totalProgress = Math.min(99, Math.floor((elapsedTotal / totalGrowTime) * 100));
                  }
                }
              }
            }
          }
          
          // 判断是否可偷（变异）：成熟阶段
          // 注意：实际可偷还需要检查 plant.stealable，但这里先显示所有成熟的作物
          const isStealable = currentPhase === PlantPhase.MATURE;

          return {
            status: plantName + ' ' + phaseName,
            phase: currentPhase || 0,
            phaseName: phaseName,
            plantName: plantName,
            progress: progress,
            totalProgress: totalProgress,
            nextPhaseTime: nextPhaseTime,
            matureTime: matureTime,
            landLevel: toNum(land.level),
            landMaxLevel: toNum(land.maxLevel),
            couldUpgrade: land.couldUpgrade,
            stealable: isStealable,
            buff: land.buff ? {
              yieldBonus: toNum(land.buff.plantYieldBonus),
              timeReduction: toNum(land.buff.plantingTimeReduction),
              expBonus: toNum(land.buff.plantExpBonus),
            } : null,
          };
        });

        // 确保 landStatus 有 24 个元素
        while (landStatus.length < 24) landStatus.push({ status: '锁定', phase: -1, phaseName: '锁定', totalProgress: 0, stealable: false });
        hasValidLandData = true;
      } else {
        sendLog('[数据] getAllLands 返回空数据');
      }
    } catch (e) {
      sendLog('[数据] 获取土地数据失败: ' + e.message);
    }

    // 如果没有获取到有效数据，使用之前的 landStatus（如果有的话）
    if (!hasValidLandData && lastData) {
      try {
        const lastDataObj = JSON.parse(lastData);
        if (lastDataObj.data?.stats?.landStatus) {
          landStatus = lastDataObj.data.stats.landStatus;
          sendLog('[数据] 使用上次缓存的土地数据');
        }
      } catch (e) {}
    }

    // 如果仍然没有数据，填充为 24 个锁定
    if (landStatus.length === 0) {
      while (landStatus.length < 24) landStatus.push({ status: '锁定', phase: -1, phaseName: '锁定', totalProgress: 0, stealable: false });
    }

    // 获取操作限制摘要
    const opLimitsSummary = [];
    for (const [id, limit] of operationLimits) {
      if (limit.dayExpTimesLimit > 0) {
        const name = { 10005: '除草', 10006: '除虫', 10007: '浇水', 10008: '偷菜' }[id] || `#${id}`;
        const expLeft = limit.dayExpTimesLimit - limit.dayExpTimes;
        opLimitsSummary.push({ id, name, expLeft, expLimit: limit.dayExpTimesLimit });
      }
    }

    // 获取可领取任务数
    const claimableTaskCount = taskList.filter(t => t.isUnlocked && !t.isClaimed && t.progress >= t.total && t.total > 0).length;

    // 获取背包数据
    try {
      const bagReply = await getBag();
      if (bagReply) {
        const items = bagReply.item_bag?.items || bagReply.items || [];
        bagItems = items.map(item => ({
          id: toNum(item.id),
          count: toNum(item.count),
          uid: item.uid != null ? toNum(item.uid) : 0,
          isFruit: toNum(item.id) >= 3001 && toNum(item.id) <= 49999,
        }));
      }
    } catch (e) {
      // 背包获取失败不影响其他数据
    }

    // 计算准确的等级经验进度
    const expProgress = getLevelExpProgress(state.level, state.exp);

    sendData({
      name: state.name,
      level: state.level,
      stats: {
        exp: state.exp,
        coins: state.gold,
        expProgress: expProgress.current,
        expNeeded: expProgress.needed,
        onlineTime: Math.floor((Date.now() - startTime) / 60000),
        landStatus,
        todayStats: { ...todayStats },
        operationLimits: opLimitsSummary,
        tasks: { total: taskList.length, claimable: claimableTaskCount, list: taskList.slice(0, 5) },
        bag: bagItems,
      }
    });
  } catch (e) {
    sendLog('[数据] 收集数据失败: ' + e.message);
  } finally {
    isCollectingData = false;
  }
}

// ============ 数据收集循环（学习 farm.js 的设计） ============

async function collectLoop() {
  while (collectLoopRunning) {
    await collectData();
    if (!collectLoopRunning) break;
    await sleep(COLLECT_INTERVAL);
  }
}

function startCollectLoop() {
  if (collectLoopRunning) return;
  collectLoopRunning = true;

  // 监听服务器推送的土地变化事件
  networkEvents.on('landsChanged', onLandsChangedPush);

  // 延迟 100ms 后启动循环
  collectTimer = setTimeout(() => collectLoop(), 100);
}

/**
 * 处理服务器推送的土地变化 - 立即触发数据收集
 */
function onLandsChangedPush(lands) {
  if (isCollectingData) return;
  const now = Date.now();
  if (now - lastCollectTime < COLLECT_DEBOUNCE) return; // 防抖

  lastCollectTime = now;

  setTimeout(async () => {
    if (!isCollectingData) {
      await collectData();
    }
  }, 100);
}

function stopCollectLoop() {
  collectLoopRunning = false;
  if (collectTimer) { clearTimeout(collectTimer); collectTimer = null; }
  networkEvents.removeListener('landsChanged', onLandsChangedPush);
}

// ============ 主程序 ============
let startTime = Date.now();
let farmTimer = null;
let friendTimer = null;
let taskTimer = null;
let sellTimer = null;

// 账号配置对象（使用 let 以便热更新，避免与 src/config.js 的 CONFIG 冲突）
let ACCOUNT_CONFIG = {
  autoFarm: true,
  autoFriend: true,
  autoTask: true,
  autoSell: false,
  autoFertilize: true,
  useOrganicFertilizer: true,
  useBothFertilizers: false,
  autoRefillNormalFertilizer: false,
  autoRefillOrganicFertilizer: true,
  fertilizerRefillThreshold: 100,
  enableFriendCheck: true,
  enableSteal: true,
  enableHelpWater: true,
  enableHelpWeed: true,
  enableHelpBug: true,
  enablePutBug: false,
  enablePutWeed: false,
  skipWhiteRadish: true,
  farmCheckInterval: 13000,
  friendCheckInterval: 14000,
  autoClaimEmail: true,
  autoClaimIllustrated: true,
  autoClaimFreeGifts: true,
  helpOnlyWithExp: true,
  notificationEmail: '',
  seedType: '大白菜 (Lv3) 5分钟',
  enableSmartPlant: true,
  autoUnlockLand: true,
  autoUpgradeLand: true,
  enableRandomFriendInterval: true,
  // 白名单（JSON数组）
  stealWhitelist: [1124923789,1019148493],
  helpWaterWhitelist: [],
  helpWeedWhitelist: [],
  helpBugWhitelist: [],
  putBugWhitelist: [],
  putWeedWhitelist: []
};

// 兼容旧代码的常量引用
const AUTO_FARM = ACCOUNT_CONFIG.autoFarm;
const AUTO_FRIEND = ACCOUNT_CONFIG.autoFriend;
const AUTO_TASK = ACCOUNT_CONFIG.autoTask;
const AUTO_SELL = ACCOUNT_CONFIG.autoSell;
const AUTO_FERTILIZE = ACCOUNT_CONFIG.autoFertilize;
const USE_ORGANIC_FERTILIZER = ACCOUNT_CONFIG.useOrganicFertilizer;
const USE_BOTH_FERTILIZERS = ACCOUNT_CONFIG.useBothFertilizers;
const ENABLE_FRIEND_CHECK = ACCOUNT_CONFIG.enableFriendCheck;
const ENABLE_STEAL = ACCOUNT_CONFIG.enableSteal;
const ENABLE_HELP_WATER = ACCOUNT_CONFIG.enableHelpWater;
const ENABLE_HELP_WEED = ACCOUNT_CONFIG.enableHelpWeed;
const ENABLE_HELP_BUG = ACCOUNT_CONFIG.enableHelpBug;
const ENABLE_PUT_BUG = ACCOUNT_CONFIG.enablePutBug;
const ENABLE_PUT_WEED = ACCOUNT_CONFIG.enablePutWeed;
const SKIP_WHITE_RADISH = ACCOUNT_CONFIG.skipWhiteRadish;
const FARM_INTERVAL = ACCOUNT_CONFIG.farmCheckInterval;
const FRIEND_INTERVAL = ACCOUNT_CONFIG.friendCheckInterval;
const AUTO_CLAIM_EMAIL = ACCOUNT_CONFIG.autoClaimEmail;
const AUTO_CLAIM_ILLUSTRATED = ACCOUNT_CONFIG.autoClaimIllustrated;
const AUTO_CLAIM_FREE_GIFTS = ACCOUNT_CONFIG.autoClaimFreeGifts;
const HELP_ONLY_WITH_EXP = ACCOUNT_CONFIG.helpOnlyWithExp;

// 上次重置日期 (YYYY-MM-DD)
let lastResetDate = '';

// 好友巡查暂停状态（每个账号独立）
const friendLoopState = new Map(); // key: accountId, value: { paused, pauseTimer, consecutiveNoActionCount }
const MAX_CONSECUTIVE_NO_ACTION = 3; // 连续3次无操作则暂停

// 获取账号的巡查状态
function getFriendLoopState(accountId) {
  if (!friendLoopState.has(accountId)) {
    friendLoopState.set(accountId, {
      paused: false,
      pauseTimer: null,
      consecutiveNoActionCount: 0
    });
  }
  return friendLoopState.get(accountId);
}

// 清理账号的巡查状态（账号停止时调用）
function clearFriendLoopState(accountId) {
  const state = friendLoopState.get(accountId);
  if (state && state.pauseTimer) {
    clearTimeout(state.pauseTimer);
  }
  friendLoopState.delete(accountId);
}

// 检查是否所有操作都已达上限（支持热更新）
function checkAllLimitsReached() {
  if (!ACCOUNT_CONFIG.helpOnlyWithExp) return false;

  const limitsToCheck = [];
  if (ACCOUNT_CONFIG.enableHelpWeed) limitsToCheck.push(OP_IDS.WEED);
  if (ACCOUNT_CONFIG.enableHelpBug) limitsToCheck.push(OP_IDS.BUG);
  if (ACCOUNT_CONFIG.enableHelpWater) limitsToCheck.push(OP_IDS.WATER);
  if (ACCOUNT_CONFIG.enableSteal) limitsToCheck.push(OP_IDS.STEAL);

  // 如果没有开启任何操作，不需要暂停
  if (limitsToCheck.length === 0) return false;

  // 检查每个操作是否都已达上限
  for (const opId of limitsToCheck) {
    if (canGetExp(opId)) {
      return false; // 还有操作可以获得经验
    }
  }

  return true; // 所有操作都已达上限
}

// 计算到明天凌晨的毫秒数
function getMsUntilTomorrow() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime() - now.getTime();
}

// 获取今日总操作次数（从操作限制统计）
async function getTodayTotalActionCount() {
  let total = 0;
  const opIds = [OP_IDS.WEED, OP_IDS.BUG, OP_IDS.WATER, OP_IDS.STEAL];
  for (const opId of opIds) {
    const limit = operationLimits.get(opId);
    if (limit && limit.dayExpTimes) {
      total += limit.dayExpTimes;
    }
  }
  return total;
}

async function farmLoop() {
  sendLog('[农场] 农场巡查循环已启动，间隔: ' + ACCOUNT_CONFIG.farmCheckInterval + 'ms');
  while (true) {
    // 检查是否启用了农场巡查（支持热更新）
    if (!ACCOUNT_CONFIG.autoFarm) {
      sendLog('[农场] 农场巡查已禁用，等待重新启用...');
      await sleep(60000); // 每分钟检查一次配置
      continue;
    }
    
    sendLog('[农场] 执行 checkFarm...');
    try {
      await checkFarm();
      sendLog('[农场] checkFarm 完成');
    } catch (e) {
      sendLog('[农场] checkFarm 错误: ' + e.message);
    }
    await sleep(ACCOUNT_CONFIG.farmCheckInterval);
  }
}

async function friendLoop() {
  const loopState = getFriendLoopState(ACCOUNT_ID);
  sendLog('[好友] 好友巡查循环已启动，间隔: ' + ACCOUNT_CONFIG.friendCheckInterval + 'ms');
  await sleep(5000); // 延迟启动
  sendLog('[好友] 延迟结束，准备初始化操作限制');
  // 先调用一次 getAllLands 来初始化操作限制
  try {
    sendLog('[好友] 正在调用 getAllLands...');
    const result = await getAllLands();
    if (result) {
      sendLog('[好友] 操作限制已初始化，获取到 ' + (result.lands?.length || 0) + ' 块土地');
    } else {
      sendLog('[好友] getAllLands 返回 null');
    }
  } catch (e) {
    sendLog('[好友] 初始化操作限制失败: ' + e.message);
  }
  sendLog('[好友] 开始好友巡查主循环');
  while (true) {
    // 检查是否启用了好友巡查（支持热更新）
    if (!ACCOUNT_CONFIG.enableFriendCheck) {
      sendLog('[好友] 好友巡查已禁用，等待重新启用...');
      await sleep(60000); // 每分钟检查一次配置
      continue;
    }

    // 检查是否处于暂停状态
    if (loopState.paused) {
      sendLog('[好友] 巡查已暂停（经验已达上限），等待明天自动恢复...');
      await sleep(60000); // 每分钟检查一次
      continue;
    }

    sendLog('[好友] 执行 checkFriends...');
    const actionCountBefore = await getTodayTotalActionCount();
    await checkFriends();
    const actionCountAfter = await getTodayTotalActionCount();
    const currentActionCount = actionCountAfter - actionCountBefore;

    // 检查本次是否执行了操作
    if (currentActionCount === 0) {
      loopState.consecutiveNoActionCount++;
      sendLog('[好友] 本次未执行任何操作，连续无操作次数: ' + loopState.consecutiveNoActionCount);
    } else {
      loopState.consecutiveNoActionCount = 0;
      sendLog('[好友] 本次执行了 ' + currentActionCount + ' 次操作');
    }

    // 检查是否需要暂停
    if (loopState.consecutiveNoActionCount >= MAX_CONSECUTIVE_NO_ACTION) {
      if (checkAllLimitsReached()) {
        const msUntilTomorrow = getMsUntilTomorrow();
        const hoursUntilTomorrow = Math.floor(msUntilTomorrow / 3600000);
        const minutesUntilTomorrow = Math.floor((msUntilTomorrow % 3600000) / 60000);

        loopState.paused = true;
        sendLog('[好友] 所有操作经验已达上限，暂停巡查 ' + hoursUntilTomorrow + '小时' + minutesUntilTomorrow + '分钟');
        sendLog('[好友] 将在明天凌晨自动恢复巡查');

        // 设置定时器在明天凌晨恢复
        if (loopState.pauseTimer) clearTimeout(loopState.pauseTimer);
        loopState.pauseTimer = setTimeout(() => {
          loopState.paused = false;
          loopState.consecutiveNoActionCount = 0;
          sendLog('[好友] 新的一天开始，恢复好友巡查');
        }, msUntilTomorrow);

        continue;
      }
    }

    // 计算等待时间
    let waitInterval = ACCOUNT_CONFIG.friendCheckInterval;
    if (ACCOUNT_CONFIG.enableRandomFriendInterval) {
      // 随机生成 5-300 秒的间隔（转换为毫秒）
      const randomSec = Math.floor(Math.random() * 296) + 5; // 5-300
      waitInterval = randomSec * 1000;
      sendLog('[好友] 随机时间模式，本次等待: ' + randomSec + '秒');
    } else {
      sendLog('[好友] checkFriends 完成，等待 ' + waitInterval + 'ms');
    }
    await sleep(waitInterval);
  }
}

async function taskLoop() {
  await sleep(4000); // 延迟启动
  while (true) {
    // 检查是否启用了自动任务（支持热更新）
    if (!ACCOUNT_CONFIG.autoTask) {
      await sleep(60000); // 每分钟检查一次配置
      continue;
    }
    
    await checkAndClaimTasks();
    await sleep(60000); // 每分钟检查一次任务
  }
}

async function sellLoop() {
  sendLog('[仓库] sellLoop 启动，10秒后开始检查...');
  await sleep(10000); // 延迟启动
  sendLog('[仓库] sellLoop 开始运行，autoSell=' + ACCOUNT_CONFIG.autoSell);
  while (true) {
    // 检查是否启用了自动出售（支持热更新）
    if (!ACCOUNT_CONFIG.autoSell) {
      sendLog('[仓库] 自动出售已禁用，等待下次检查...');
      await sleep(60000); // 每分钟检查一次配置
      continue;
    }
    
    sendLog('[仓库] 自动出售已启用，执行 sellAllFruits...');
    await sellAllFruits();
    await sleep(30 * 60 * 1000); // 每30分钟检查一次仓库
  }
}

// 服务器推送处理
let lastPushTime = 0;
function onLandsChangedPush(lands) {
  const now = Date.now();
  if (now - lastPushTime < 500) return; // 500ms 防抖
  lastPushTime = now;
  sendLog('[农场] 收到服务器推送: ' + lands.length + '块土地变化，立即检查');
  // 立即检查农场（支持热更新）
  if (ACCOUNT_CONFIG.autoFarm) {
    checkFarm().catch(() => {});
  }
}

function onTaskInfoNotify(taskInfo) {
  if (!taskInfo) return;
  sendLog('[任务] 收到任务状态变化推送');
  // 延迟后检查任务
  setTimeout(() => {
    checkAndClaimTasks().catch(() => {});
  }, 1000);
}

let isConnected = false;
let reconnectTimer = null;

async function main() {
  sendLog('[启动] 开始加载 proto...');
  await loadProto();
  sendLog('[启动] proto 加载完成');
  CONFIG.platform = 'qq';
  
  // 启动连接
  startConnection();
}

function startConnection() {
  if (isConnected) return;
  
  sendLog('[启动] 开始连接服务器...');
  connect('237532cb021843fbf53ef9e83b865362', async () => {
    isConnected = true;
    sendLog('登录成功');
    
    // 注册服务器推送监听
    networkEvents.on('landsChanged', onLandsChangedPush);
    networkEvents.on('taskInfoNotify', onTaskInfoNotify);
    sendLog('[启动] 已注册服务器推送监听');
    
    // 启动各个循环
    // 农场循环总是启动，内部根据 autoFarm 配置决定是否执行
    sendLog('[启动] 启动农场巡查循环');
    farmLoop();
    if (ENABLE_FRIEND_CHECK) {
      sendLog('[启动] 启动好友巡查循环');
      friendLoop();
    }
    if (AUTO_TASK) {
      sendLog('[启动] 启动任务循环');
      taskLoop();
    }
    // 出售循环始终启动，内部检查配置支持热更新
    sendLog('[启动] 启动出售循环');
    sellLoop();
    
    // 启动数据收集循环（学习 farm.js 的设计）
    sendLog('[启动] 开始收集数据');
    startCollectLoop();
    sendLog('[启动] 数据收集已设置');
    
    // 启动奖励自动领取
    if (AUTO_CLAIM_EMAIL) {
      sendLog('[启动] 启动邮件奖励领取');
      email.start();
    }
    if (AUTO_CLAIM_ILLUSTRATED) {
      sendLog('[启动] 启动图鉴奖励领取');
      illustrated.start();
    }
    if (AUTO_CLAIM_FREE_GIFTS) {
      sendLog('[启动] 启动免费礼包领取');
      shop.start();
    }
  });
  
  // 监听连接关闭事件，自动重连
  networkEvents.once('disconnected', () => {
    isConnected = false;
    sendLog('[连接] 出现此报错代表您当前使用的code失效，请重新登录获取最新的code');
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      sendLog('[连接] 您也可以删除当前子账号，重新进行添加，如果多次失败，请上调巡查时间');
      startConnection();
    }, 5000);
  });
}

main();

// 监听来自父进程的配置更新消息
process.on('message', (message) => {
  if (message.type === 'configUpdate') {
    sendLog('[配置] 收到配置更新');
    
    // 更新配置对象
    if (message.config) {
      // 映射前端配置名到 CONFIG 对象属性名
      const configMapping = {
        autoFarm: 'autoFarm',
        autoFriend: 'autoFriend',
        autoTask: 'autoTask',
        autoSell: 'autoSell',
        autoFertilize: 'autoFertilize',
        useOrganicFertilizer: 'useOrganicFertilizer',
        useBothFertilizers: 'useBothFertilizers',
        autoRefillNormalFertilizer: 'autoRefillNormalFertilizer',
        autoRefillOrganicFertilizer: 'autoRefillOrganicFertilizer',
        fertilizerRefillThreshold: 'fertilizerRefillThreshold',
        enableFriendCheck: 'enableFriendCheck',
        enableSteal: 'enableSteal',
        enableHelpWater: 'enableHelpWater',
        enableHelpWeed: 'enableHelpWeed',
        enableHelpBug: 'enableHelpBug',
        enablePutBug: 'enablePutBug',
        enablePutWeed: 'enablePutWeed',
        skipWhiteRadish: 'skipWhiteRadish',
        autoClaimEmail: 'autoClaimEmail',
        autoClaimIllustrated: 'autoClaimIllustrated',
        autoClaimFreeGifts: 'autoClaimFreeGifts',
        helpOnlyWithExp: 'helpOnlyWithExp',
        seedType: 'seedType',
        enableSmartPlant: 'enableSmartPlant',
        autoUnlockLand: 'autoUnlockLand',
        autoUpgradeLand: 'autoUpgradeLand',
        // 白名单
        stealWhitelist: 'stealWhitelist',
        helpWaterWhitelist: 'helpWaterWhitelist',
        helpWeedWhitelist: 'helpWeedWhitelist',
        helpBugWhitelist: 'helpBugWhitelist',
        putBugWhitelist: 'putBugWhitelist',
        putWeedWhitelist: 'putWeedWhitelist',
        // 随机时间好友巡查
        enableRandomFriendInterval: 'enableRandomFriendInterval'
      };
      
      for (const [key, value] of Object.entries(message.config)) {
        const configKey = configMapping[key];
        if (configKey && ACCOUNT_CONFIG[configKey] !== undefined) {
          ACCOUNT_CONFIG[configKey] = value;
          sendLog('[配置] ' + key + ' = ' + value);
        }
      }
    }
    
    if (message.farmInterval !== undefined) {
      ACCOUNT_CONFIG.farmCheckInterval = message.farmInterval * 1000;
      sendLog('[配置] 农场巡查间隔已更新: ' + message.farmInterval + '秒');
    }
    if (message.friendInterval !== undefined) {
      ACCOUNT_CONFIG.friendCheckInterval = message.friendInterval * 1000;
      sendLog('[配置] 好友巡查间隔已更新: ' + message.friendInterval + '秒');
    }
    if (message.email !== undefined) {
      ACCOUNT_CONFIG.notificationEmail = message.email;
      sendLog('[配置] 通知邮箱已更新: ' + message.email);
    }

    // 动态控制奖励自动领取功能
    if (ACCOUNT_CONFIG.autoClaimEmail) {
      if (!email.isRunning()) {
        sendLog('[配置] 启动邮件奖励领取');
        email.start();
      }
    } else {
      if (email.isRunning()) {
        sendLog('[配置] 停止邮件奖励领取');
        email.stop();
      }
    }

    if (ACCOUNT_CONFIG.autoClaimIllustrated) {
      if (!illustrated.isRunning()) {
        sendLog('[配置] 启动图鉴奖励领取');
        illustrated.start();
      }
    } else {
      if (illustrated.isRunning()) {
        sendLog('[配置] 停止图鉴奖励领取');
        illustrated.stop();
      }
    }

    if (ACCOUNT_CONFIG.autoClaimFreeGifts) {
      if (!shop.isRunning()) {
        sendLog('[配置] 启动免费礼包领取');
        shop.start();
      }
    } else {
      if (shop.isRunning()) {
        sendLog('[配置] 停止免费礼包领取');
        shop.stop();
      }
    }

    sendLog('[配置] 配置热更新完成，无需重启');
  }
  
  // 手动售卖果实
  if (message.type === 'sellItems') {
    sendLog('[仓库] 收到手动售卖请求');
    // 使用立即执行函数来支持 async/await
    (async () => {
      try {
        // 如果指定了uids，则按uid精确售卖；如果指定了itemIds，则按种类售卖
        const result = await sellAllFruits(message.itemIds, message.uids);
        // 发送结果回主进程
        if (process.send) {
          process.send({
            type: 'sellResult',
            success: true,
            result: result
          });
        }
      } catch (err) {
        sendLog('[仓库] 手动售卖失败: ' + err.message);
        if (process.send) {
          process.send({
            type: 'sellResult',
            success: false,
            error: err.message
          });
        }
      }
    })();
  }
  
  // 手动收获土地
  if (message.type === 'harvestLands') {
    sendLog('[农场] 收到手动收获请求');
    // 使用立即执行函数来支持 async/await
    (async () => {
      try {
        const landIds = message.landIds;
        if (!landIds || landIds.length === 0) {
          throw new Error('未选择土地');
        }
        sendLog('[农场] 手动收获 ' + landIds.length + ' 块土地');
        const reply = await harvest(landIds);
        sendLog('[农场] 手动收获成功');
        
        // 收获后检查并铲除枯死作物
        try {
          sendLog('[农场] 检查枯死作物...');
          const landsReply = await getAllLands();
          if (landsReply && landsReply.lands) {
            sendLog('[农场] 获取到 ' + landsReply.lands.length + ' 块土地信息');
            const deadLandIds = landsReply.lands
              .filter(land => {
                const plant = land.plant;
                if (!plant || !plant.phases || plant.phases.length === 0) return false;
                const currentPhase = getCurrentPhase(plant.phases);
                // getCurrentPhase 返回的是 phase 数字，不是对象
                const isDead = currentPhase === PlantPhase.DEAD;
                if (isDead) {
                  sendLog('[农场] 发现枯死作物: 土地#' + toNum(land.id) + ', phase=' + currentPhase);
                }
                return isDead;
              })
              .map(land => toNum(land.id));
            
            sendLog('[农场] 找到 ' + deadLandIds.length + ' 块枯死作物');
            
            if (deadLandIds.length > 0) {
              await removePlant(deadLandIds);
              sendLog('[农场] 铲除 ' + deadLandIds.length + ' 块枯死作物');
            } else {
              sendLog('[农场] 没有枯死作物需要铲除');
            }
          } else {
            sendLog('[农场] 获取土地信息失败');
          }
        } catch (clearErr) {
          sendLog('[农场] 铲除枯死作物出错: ' + clearErr.message);
        }
        
        // 发送结果回主进程
        if (process.send) {
          process.send({
            type: 'harvestResult',
            success: true,
            landCount: landIds.length,
            result: reply
          });
        }
      } catch (err) {
        sendLog('[农场] 手动收获失败: ' + err.message);
        if (process.send) {
          process.send({
            type: 'harvestResult',
            success: false,
            error: err.message
          });
        }
      }
    })();
  }
  
  // 手动种植土地
  if (message.type === 'plantLands') {
    sendLog('[农场] 收到手动种植请求');
    // 使用立即执行函数来支持 async/await
    (async () => {
      try {
        // 确保 landIds 是数字数组
        const landIds = message.landIds.map(id => parseInt(id, 10));
        const seedId = parseInt(message.seedId, 10);
        if (!landIds || landIds.length === 0) {
          throw new Error('未选择土地');
        }
        if (!seedId) {
          throw new Error('未选择种子');
        }
        
        // 获取种子信息
        const plantId = 1020000 + (seedId - 20000);
        const seedName = plantConfig[plantId]?.name || ('种子' + seedId);
        
        sendLog('[农场] 手动种植 ' + landIds.length + ' 块土地，种子: ' + seedName);
        
        // 购买种子
        const shopReply = await getShopInfo(2);
        let goodsId = null;
        let price = 0;
        
        if (shopReply && shopReply.goods_list) {
          for (const goods of shopReply.goods_list) {
            if (toNum(goods.item_id) === seedId) {
              goodsId = toNum(goods.id);
              price = toNum(goods.price);
              break;
            }
          }
        }
        
        if (!goodsId) {
          throw new Error('商店中未找到该种子');
        }
        
        // 检查金币是否足够
        const state = getUserState();
        const totalCost = price * landIds.length;
        if (totalCost > state.gold) {
          const canBuy = Math.floor(state.gold / price);
          if (canBuy <= 0) {
            throw new Error('金币不足，需要' + totalCost + '金币，当前有' + state.gold + '金币');
          }
          landIds.splice(canBuy);
          sendLog('[商店] 金币有限，只能购买 ' + canBuy + ' 个种子');
        }
        
        // 购买种子
        let actualSeedId = seedId;
        try {
          const buyReply = await buyGoods(goodsId, landIds.length, price);
          if (buyReply.get_items && buyReply.get_items.length > 0) {
            actualSeedId = toNum(buyReply.get_items[0].id) || actualSeedId;
          }
          if (buyReply.cost_items) {
            for (const item of buyReply.cost_items) {
              state.gold -= toNum(item.count);
            }
          }
          sendLog('[商店] 购买 ' + seedName + '种子 x' + landIds.length);
        } catch (e) {
          throw new Error('购买种子失败: ' + e.message);
        }
        
        // 种植
        const planted = await plantSeeds(actualSeedId, landIds);
        sendLog('[种植] 成功种植 ' + planted + ' 块 ' + seedName);

        // 种植后等待一下再施肥，避免服务器繁忙
        if (planted > 0) {
          await sleep(300);
        }

        // 手动种植后触发自动施肥（根据配置）
        sendLog('[施肥] 检查是否施肥: autoFertilize=' + ACCOUNT_CONFIG.autoFertilize + ', planted=' + planted);
        if (ACCOUNT_CONFIG.autoFertilize && planted > 0) {
          let normalCount = 0;
          let organicCount = 0;
          sendLog('[施肥] 开始施肥: useOrganicFertilizer=' + ACCOUNT_CONFIG.useOrganicFertilizer + ', useBothFertilizers=' + ACCOUNT_CONFIG.useBothFertilizers);
          
          if (ACCOUNT_CONFIG.useOrganicFertilizer) {
            if (ACCOUNT_CONFIG.useBothFertilizers) {
              // 同时使用两种肥料：每块地先施普通肥，再施有机肥
              for (let i = 0; i < planted; i++) {
                const landId = landIds[i];
                // 先施普通肥
                try {
                  const normalResult = await fertilize([landId], 1011);
                  if (normalResult > 0) {
                    normalCount++;
                  } else {
                    sendLog('[施肥] 普通肥失败 (土地' + landId + ')');
                  }
                } catch (e) {
                  sendLog('[施肥] 普通肥错误: ' + e.message);
                }
                // 再施有机肥
                try {
                  const organicResult = await fertilize([landId], 1012);
                  if (organicResult > 0) {
                    organicCount++;
                  } else {
                    sendLog('[施肥] 有机肥失败 (土地' + landId + ')');
                  }
                } catch (e) {
                  sendLog('[施肥] 有机肥错误: ' + e.message);
                }
              }
              // 详细记录两种肥料的使用情况
              if (normalCount > 0 || organicCount > 0) {
                sendLog('[施肥] 普通肥' + normalCount + ' 有机肥' + organicCount);
              }
            } else {
              // 优先使用有机肥，不足时用普通肥
              sendLog('[施肥] 优先使用有机肥');
              organicCount = await fertilize(landIds.slice(0, planted), 1012);
              sendLog('[施肥] 有机肥结果: ' + organicCount);
              if (organicCount < planted) {
                normalCount = await fertilize(landIds.slice(organicCount, planted), 1011);
              }
              if (normalCount > 0 || organicCount > 0) {
                sendLog('[施肥] 普通肥' + normalCount + ' 有机肥' + organicCount);
              }
            }
          } else {
            // 只使用普通肥
            sendLog('[施肥] 只使用普通肥');
            normalCount = await fertilize(landIds.slice(0, planted), 1011);
            if (normalCount > 0) {
              sendLog('[施肥] 普通肥' + normalCount);
            }
          }
        }
        
        // 发送结果回主进程
        if (process.send) {
          process.send({
            type: 'plantResult',
            success: true,
            landCount: planted,
            seedName: seedName,
            result: { planted: planted, seedName: seedName }
          });
        }
      } catch (err) {
        sendLog('[农场] 手动种植失败: ' + err.message);
        if (process.send) {
          process.send({
            type: 'plantResult',
            success: false,
            error: err.message
          });
        }
      }
    })();
  }
});

process.on('SIGINT', () => {
  if (collectTimer) clearInterval(collectTimer);
  email.stop();
  illustrated.stop();
  shop.stop();
  cleanup();
  process.exit(0);
});
