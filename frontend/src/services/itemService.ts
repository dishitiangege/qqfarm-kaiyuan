/**
 * 物品信息服务
 * 从 ItemInfo.json 加载物品数据
 */

import itemInfoData from '../../../gameConfig/ItemInfo.json';

// 物品信息映射表
const itemInfoMap = new Map<number, typeof itemInfoData[0]>();

// 初始化映射表
for (const item of itemInfoData) {
  itemInfoMap.set(item.id, item);
}

/**
 * 获取物品信息
 * @param itemId - 物品ID
 * @returns 物品信息或undefined
 */
export function getItemInfo(itemId: number) {
  return itemInfoMap.get(itemId);
}

/**
 * 获取物品名称
 * @param itemId - 物品ID
 * @returns 物品名称
 */
export function getItemName(itemId: number): string {
  const item = itemInfoMap.get(itemId);
  if (item) {
    return item.name;
  }
  return `物品#${itemId}`;
}

/**
 * 获取物品显示名称（包含数量转换）
 * 对于化肥容器和狗粮容器，将数量转换为小时/天显示
 * @param itemId - 物品ID
 * @param count - 数量（秒数）
 * @returns 格式化后的显示名称
 */
export function getItemDisplayName(itemId: number, _count?: number): string {
  const item = itemInfoMap.get(itemId);
  if (!item) return `物品#${itemId}`;
  return item.name;
}

/**
 * 获取容器物品的时间信息（用于单独显示）
 * @param itemId - 物品ID
 * @param count - 数量（秒数）
 * @returns 格式化后的时间字符串，如果不是容器则返回null
 */
export function getContainerTimeInfo(itemId: number, count: number): string | null {
  // 化肥容器 (1011-1014): 值是秒数，转换为小时
  if (itemId >= 1011 && itemId <= 1014) {
    const hours = Math.round(count / 3600);
    return `${hours}小时`;
  }

  // 狗粮容器 (11001-11003): 值是秒数，转换为天
  if (itemId >= 11001 && itemId <= 11003) {
    const days = Math.round(count / 3600 / 24);
    return `${days}天`;
  }

  return null;
}

/**
 * 获取物品图标URL（用于作物果实显示真实图片）
 * @param itemId - 物品ID
 * @returns 图标URL或undefined（返回undefined时使用emoji）
 */
export function getItemIcon(itemId: number): string | undefined {
  // 对于作物果实（3001-49999），尝试获取真实图片
  if (itemId >= 3001 && itemId <= 49999) {
    const item = itemInfoMap.get(itemId);
    if (item && item.asset_name) {
      // 查找对应的种子信息（使用种子ID而不是果实ID）
      const seedInfo = getSeedInfoByCropName(item.name);
      if (seedInfo) {
        // URL编码作物名称
        const encodedName = encodeURIComponent(item.name);
        // 构建图片URL（使用种子ID和asset_name）
        return `https://lanorigin.top/oss/FarmCalc/seed_images_named/${seedInfo.id}_${encodedName}_${seedInfo.assetName}_Seed.png`;
      }
    }
  }
  // 其他物品返回undefined，让调用方使用emoji
  return undefined;
}

/**
 * 获取物品图标emoji（用于非作物物品）
 * @param itemId - 物品ID
 * @returns 图标emoji
 */
export function getItemIconEmoji(itemId: number): string {
  // 化肥 (1001-1014 是容器，1015+ 是具体化肥)
  if (itemId >= 1001 && itemId <= 1014) return '🧪';
  if (itemId >= 1015 && itemId <= 1020) return '⚡'; // 普通化肥
  if (itemId >= 1021 && itemId <= 1026) return '⚡'; // 有机化肥
  // 种子
  if (itemId >= 2001 && itemId <= 2999) return '🌱';
  // 果实（如果没有图片则使用emoji）
  if (itemId >= 3001 && itemId <= 49999) return '🥕';
  // 礼包
  if (itemId >= 4001 && itemId <= 4999) return '🎁';
  // 狗粮
  if (itemId >= 11001 && itemId <= 11003) return '🦴';
  // 默认
  return '📦';
}

/**
 * 判断是否是果实
 * @param itemId - 物品ID
 * @returns 是否是果实
 */
export function isFruit(itemId: number): boolean {
  return itemId >= 3001 && itemId <= 49999;
}

/**
 * 判断是否是化肥
 * @param itemId - 物品ID
 * @returns 是否是化肥
 */
export function isFertilizer(itemId: number): boolean {
  return (itemId >= 1001 && itemId <= 1026);
}

/**
 * 判断是否是狗粮
 * @param itemId - 物品ID
 * @returns 是否是狗粮
 */
export function isDogFood(itemId: number): boolean {
  return itemId >= 11001 && itemId <= 11003;
}

/**
 * 获取物品分类
 * @param itemId - 物品ID
 * @returns 分类名称
 */
export function getItemCategory(itemId: number): 'special' | 'fruit' | 'other' {
  // 特殊物品：化肥、狗粮、金币、点券、收藏点、新春红包种子等
  if (
    (itemId >= 1001 && itemId <= 1026) || // 化肥
    (itemId >= 11001 && itemId <= 11003) || // 狗粮
    itemId === 1001 || // 金币
    itemId === 1002 || // 点券
    itemId === 1003 || // 种植经验
    itemId === 3001 || // 普通收藏点
    itemId === 3002 || // 典藏收藏点
    itemId === 21542   // 新春红包种子
  ) {
    return 'special';
  }
  // 果实（排除收藏点）
  if (itemId >= 3003 && itemId <= 49999) {
    return 'fruit';
  }
  return 'other';
}

/**
 * 获取分类排序权重
 * @param category - 分类
 * @returns 排序权重（越小越靠前）
 */
export function getCategoryOrder(category: string): number {
  const order: Record<string, number> = {
    'special': 1,
    'fruit': 2,
    'other': 3,
  };
  return order[category] || 99;
}

// 种子信息映射表（用于根据作物名称查找种子信息）
const seedInfoMap = new Map<string, { id: number; name: string; assetName: string }>();

// 初始化种子信息映射表
for (const item of itemInfoData) {
  // 只处理种子类型（type: 5）且有asset_name的种子
  if (item.type === 5 && item.asset_name && item.name && item.name.endsWith('种子')) {
    // 提取作物名称（去掉"种子"后缀）
    const cropName = item.name.replace(/种子$/, '');
    
    // 如果已存在相同名称的种子，优先使用 id 较大的（通常是特殊版本如29999开头）
    const existing = seedInfoMap.get(cropName);
    if (!existing || item.id > existing.id) {
      seedInfoMap.set(cropName, {
        id: item.id,
        name: item.name,
        assetName: item.asset_name
      });
    }
  }
}

/**
 * 根据作物名称获取种子信息
 * @param cropName - 作物名称（如"小麦"、"南瓜"）
 * @returns 种子信息或undefined
 */
export function getSeedInfoByCropName(cropName: string) {
  if (!cropName) return undefined;
  return seedInfoMap.get(cropName);
}

/**
 * 获取作物图片URL
 * 图片URL格式: https://lanorigin.top/oss/FarmCalc/seed_images_named/{id}_{name}_{asset_name}_Seed.png
 * @param cropName - 作物名称（如"小麦"、"南瓜"）
 * @returns 图片URL或undefined
 */
export function getCropImageUrl(cropName: string): string | undefined {
  const seedInfo = getSeedInfoByCropName(cropName);
  if (!seedInfo) return undefined;

  // URL编码作物名称（处理中文）
  const encodedName = encodeURIComponent(cropName);

  // 构建图片URL
  return `https://lanorigin.top/oss/FarmCalc/seed_images_named/${seedInfo.id}_${encodedName}_${seedInfo.assetName}_Seed.png`;
}
