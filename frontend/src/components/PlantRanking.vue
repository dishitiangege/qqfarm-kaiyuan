<template>
  <div class="plant-ranking">
    <div class="ranking-header">
      <h3 class="ranking-title">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20v-6M6 20V10M18 20V4"/>
        </svg>
        种植效率排行
        <button class="help-btn" @click="showHelp = true" title="字段说明">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </button>
      </h3>
      <div class="sort-selector">
        <select v-model="sortBy" class="sort-select">
          <option value="expPerHourNormalFert">按普通肥效率</option>
          <option value="expPerHourNoFert">按不施肥效率</option>
          <option value="level">按等级要求</option>
          <option value="growTime">按生长时间</option>
          <option value="expPerGold">按金币效率</option>
        </select>
      </div>
    </div>

    <!-- 帮助弹窗 -->
    <div v-if="showHelp" class="help-modal" @click.self="showHelp = false">
      <div class="help-content">
        <div class="help-header">
          <h4>字段说明</h4>
          <button class="help-close" @click="showHelp = false">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="help-body">
          <div class="help-item">
            <div class="help-term">
              <span class="help-badge blue">不施肥 经验/时</span>
            </div>
            <div class="help-desc">不使用肥料时，整个农场每小时可获得的经验值。计算考虑了种植速度（9块/秒）。</div>
          </div>
          <div class="help-item">
            <div class="help-term">
              <span class="help-badge green">普通肥 经验/时</span>
            </div>
            <div class="help-desc">使用普通肥料时，整个农场每小时可获得的经验值。普通肥可减少一个生长阶段的时间。</div>
          </div>
          <div class="help-item">
            <div class="help-term">
              <span class="help-badge purple">提升</span>
            </div>
            <div class="help-desc">使用普通肥料相比不施肥的经验效率提升百分比。计算公式：(普通肥-不施肥)/不施肥×100%</div>
          </div>
          <div class="help-item">
            <div class="help-term">
              <span class="help-badge orange">金币效率</span>
            </div>
            <div class="help-desc">每花费1金币可获得的经验值。数值越高，性价比越高。计算公式：收获经验/种子价格</div>
          </div>
          <div class="help-item">
            <div class="help-term">
              <span class="help-badge gray">季节</span>
            </div>
            <div class="help-desc">作物可收获的季节数量（季数）。例如"1季"表示收获一次后作物消失，"2季"表示可收获两次。</div>
          </div>
          <div class="help-item">
            <div class="help-term">
              <span class="help-badge gray">等级</span>
            </div>
            <div class="help-desc">种植该作物所需的农场等级。未达到等级时作物显示为锁定状态。</div>
          </div>
        </div>
        <div class="help-footer">
          <button class="help-ok-btn" @click="showHelp = false">知道了</button>
        </div>
      </div>
    </div>

    <!-- 智能推荐区域 -->
    <div v-if="(userLevel ?? 0) > 0" class="recommendation-section">
      <div class="recommendation-title">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
        当前等级 (Lv{{ userLevel }}) 最优选择
      </div>
      <div class="recommendation-cards">
        <div class="rec-card no-fert">
          <div class="rec-label">不施肥最优</div>
          <div class="rec-name">{{ bestNoFert?.name || '-' }}</div>
          <div class="rec-value">{{ bestNoFert?.expPerHourNoFert.toFixed(2) || '-' }} 经验/时</div>
          <div class="rec-detail">Lv{{ bestNoFert?.requiredLevel || '-' }} | {{ bestNoFert?.growTimeStr || '-' }}</div>
        </div>
        <div class="rec-card normal-fert">
          <div class="rec-label">普通肥最优</div>
          <div class="rec-name">{{ bestNormalFert?.name || '-' }}</div>
          <div class="rec-value">{{ bestNormalFert?.expPerHourNormalFert.toFixed(2) || '-' }} 经验/时</div>
          <div class="rec-detail">
            Lv{{ bestNormalFert?.requiredLevel || '-' }} | 
            <span class="gain-badge" v-if="bestNormalFert?.gainPercent">+{{ bestNormalFert.gainPercent.toFixed(1) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 提示信息 -->
    <div v-if="!canSetPreference" class="preference-tip">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
      <span>当前使用智能推荐种植，如需手动选择作物，请先在配置中关闭「智能推荐种植」</span>
    </div>

    <!-- 桌面端表格 -->
    <div class="ranking-table-container desktop-only">
      <table class="ranking-table">
        <thead>
          <tr>
            <th class="col-rank">排名</th>
            <th class="col-plant">作物</th>
            <th class="col-season">季节</th>
            <th class="col-level">等级</th>
            <th class="col-time">生长时间</th>
            <th class="col-exp">不施肥<br><small>经验/时</small></th>
            <th class="col-exp-fert">普通肥<br><small>经验/时</small></th>
            <th class="col-gain">提升</th>
            <th class="col-gold">金币效率</th>
            <th class="col-action">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(plant, index) in sortedPlants"
            :key="plant.id"
            :class="{ 
              'top3': index < 3, 
              'selected': selectedPlant === plant.id,
              'locked': !isUnlocked(plant)
            }"
          >
            <td class="col-rank">
              <span class="rank-badge" :class="`rank-${index + 1}`">#{{ index + 1 }}</span>
            </td>
            <td class="col-plant">
              <div class="plant-info">
                <span class="plant-name">{{ plant.name }}</span>
                <span class="plant-unlock" v-if="!isUnlocked(plant)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  Lv{{ plant.requiredLevel }}解锁
                </span>
              </div>
            </td>
            <td class="col-season">
              <span class="season-badge" :class="`season-${plant.seasons}`">
                {{ getSeasonName(plant.seasons) }}
              </span>
            </td>
            <td class="col-level">Lv{{ plant.requiredLevel }}</td>
            <td class="col-time">{{ plant.growTimeStr }}</td>
            <td class="col-exp">
              <span class="exp-value">{{ plant.expPerHourNoFert.toFixed(2) }}</span>
            </td>
            <td class="col-exp-fert">
              <span class="exp-value-fert">{{ plant.expPerHourNormalFert.toFixed(2) }}</span>
            </td>
            <td class="col-gain">
              <span class="gain-badge" v-if="plant.gainPercent > 0">+{{ plant.gainPercent.toFixed(1) }}%</span>
              <span class="gain-none" v-else>-</span>
            </td>
            <td class="col-gold">
              <span class="gold-value">{{ plant.expPerGold.toFixed(3) }}</span>
            </td>
            <td class="col-action">
              <button
                class="btn-set-preference"
                :class="{ 'active': isPreferred(plant), 'disabled': !canSetPreference || !isUnlocked(plant) }"
                :disabled="!canSetPreference || !isUnlocked(plant)"
                @click="setPreference(plant)"
              >
                {{ isPreferred(plant) ? '已偏好' : (isUnlocked(plant) ? '设为偏好' : '未解锁') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 移动端卡片列表 -->
    <div class="mobile-cards mobile-only">
      <div
        v-for="(plant, index) in sortedPlants"
        :key="plant.id"
        class="plant-card"
        :class="{ 
          'top3': index < 3, 
          'selected': selectedPlant === plant.id,
          'locked': !isUnlocked(plant)
        }"
      >
        <div class="card-header">
          <span class="rank-badge" :class="`rank-${index + 1}`">#{{ index + 1 }}</span>
          <div class="plant-title">
            <span class="plant-name">{{ plant.name }}</span>
            <span class="season-badge" :class="`season-${plant.seasons}`">
              {{ getSeasonName(plant.seasons) }}
            </span>
          </div>
          <span v-if="!isUnlocked(plant)" class="lock-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Lv{{ plant.requiredLevel }}
          </span>
        </div>
        
        <div class="card-stats">
          <div class="stat-row">
            <div class="stat-item">
              <span class="stat-label">不施肥</span>
              <span class="stat-value exp-value">{{ plant.expPerHourNoFert.toFixed(1) }}</span>
              <span class="stat-unit">经验/时</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">普通肥</span>
              <span class="stat-value exp-value-fert">{{ plant.expPerHourNormalFert.toFixed(1) }}</span>
              <span class="stat-unit">经验/时</span>
            </div>
          </div>
          <div class="stat-row secondary">
            <div class="stat-item">
              <span class="stat-label">生长</span>
              <span class="stat-value">{{ plant.growTimeStr }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">提升</span>
              <span class="gain-badge" v-if="plant.gainPercent > 0">+{{ plant.gainPercent.toFixed(0) }}%</span>
              <span v-else class="gain-none">-</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">金币效率</span>
              <span class="stat-value gold-value">{{ plant.expPerGold.toFixed(2) }}</span>
            </div>
          </div>
        </div>
        
        <div class="card-action">
          <button
            class="btn-set-preference"
            :class="{ 'active': isPreferred(plant), 'disabled': !canSetPreference || !isUnlocked(plant) }"
            :disabled="!canSetPreference || !isUnlocked(plant)"
            @click="setPreference(plant)"
          >
            {{ isPreferred(plant) ? '已偏好' : (isUnlocked(plant) ? '设为偏好' : '未解锁') }}
          </button>
        </div>
      </div>
    </div>

    <div class="ranking-footer">
      <div class="stats-info">
        <span>共 {{ plants.length }} 种作物</span>
        <span class="divider">|</span>
        <span>已解锁 {{ unlockedCount }} 种</span>
        <span class="divider">|</span>
        <span>计算方式: 考虑种植速度(不施肥9块/秒, 普通肥6块/秒)</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

// 作物数据接口
interface Plant {
  id: number;
  seedId: number;
  name: string;
  growTime: number;
  growTimeStr: string;
  harvestExp: number;
  price: number;
  requiredLevel: number;
  seasons: number;
  expPerHourNoFert: number;
  expPerHourNormalFert: number;
  gainPercent: number;
  expPerGold: number;
  normalFertReduceSec: number;
}

// Props
const props = defineProps<{
  preferredSeedType?: string;
  canSetPreference?: boolean;
  userLevel?: number;
}>();

// Emits
const emit = defineEmits<{
  'set-preference': [plantName: string];
}>();

// 状态
const plants = ref<Plant[]>([]);
const sortBy = ref<'expPerHourNormalFert' | 'expPerHourNoFert' | 'level' | 'growTime' | 'expPerGold'>('expPerHourNormalFert');
const selectedPlant = ref<number | null>(null);
const showHelp = ref(false);

// 加载作物数据
onMounted(async () => {
  try {
    // 加载种子商店数据
    const seedResponse = await fetch('/tools/seed-shop-merged-export.json');
    const seedData = await seedResponse.json();
    
    // 加载植物配置（用于计算肥料减少时间）
    const plantResponse = await fetch('/gameConfig/Plant.json');
    const plantConfig = await plantResponse.json();
    
    plants.value = calculatePlantEfficiency(seedData.rows || seedData, plantConfig);
  } catch (error) {
    console.error('加载作物数据失败:', error);
  }
});

// 解析生长阶段时间
function parseGrowPhases(growPhases: string | undefined): number[] {
  if (!growPhases || typeof growPhases !== 'string') return [];
  return growPhases
    .split(';')
    .map(x => x.trim())
    .filter(Boolean)
    .map(seg => {
      const parts = seg.split(':');
      return parts.length >= 2 ? parseInt(parts[1] || '0', 10) || 0 : 0;
    })
    .filter(sec => sec > 0);
}

// 计算作物效率
function calculatePlantEfficiency(seedData: any[], plantConfig: any[]): Plant[] {
  const NO_FERT_PLANTS_PER_2_SEC = 18;
  const NORMAL_FERT_PLANTS_PER_2_SEC = 12;
  const NO_FERT_PLANT_SPEED_PER_SEC = NO_FERT_PLANTS_PER_2_SEC / 2;
  const NORMAL_FERT_PLANT_SPEED_PER_SEC = NORMAL_FERT_PLANTS_PER_2_SEC / 2;
  
  // 构建种子ID到阶段减少时间的映射
  const seedPhaseReduceMap = new Map<number, number>();
  for (const p of plantConfig) {
    const seedId = parseInt(p.seed_id, 10);
    if (seedId <= 0 || seedPhaseReduceMap.has(seedId)) continue;
    const phases = parseGrowPhases(p.grow_phases);
    if (phases.length === 0) continue;
    seedPhaseReduceMap.set(seedId, phases[0] ?? 0);
  }
  
  const results: Plant[] = [];
  
  for (const s of seedData) {
    const seedId = parseInt(s.seedId || s.seed_id, 10);
    const name = s.name || `seed_${seedId}`;
    const requiredLevel = parseInt(s.requiredLevel || s.required_level || 1, 10) || 1;
    const price = parseInt(s.price, 10) || 0;
    const expHarvest = parseInt(s.exp, 10) || 0;
    const growTimeSec = parseInt(s.growTimeSec || s.growTime || s.grow_time, 10) || 0;
    const seasons = parseInt(s.seasons, 10) || 1;
    
    if (seedId <= 0 || growTimeSec <= 0) continue;
    
    // 计算普通肥减少的时间
    const reduceSec = seedPhaseReduceMap.get(seedId) || 0;
    const growTimeNormalFert = reduceSec > 0 ? Math.max(1, growTimeSec - reduceSec) : growTimeSec;
    
    // 计算种植耗时
    const lands = 18; // 默认18块地
    const plantSecondsNoFert = lands / NO_FERT_PLANT_SPEED_PER_SEC;
    const plantSecondsNormalFert = lands / NORMAL_FERT_PLANT_SPEED_PER_SEC;
    
    // 整场周期 = 生长时间 + 种植耗时
    const cycleSecNoFert = growTimeSec + plantSecondsNoFert;
    const cycleSecNormalFert = growTimeNormalFert + plantSecondsNormalFert;
    
    // 每小时经验
    const expPerHourNoFert = (lands * expHarvest / cycleSecNoFert) * 3600;
    const expPerHourNormalFert = (lands * expHarvest / cycleSecNormalFert) * 3600;
    
    // 提升百分比
    const gainPercent = expPerHourNoFert > 0 
      ? ((expPerHourNormalFert - expPerHourNoFert) / expPerHourNoFert) * 100 
      : 0;
    
    // 每金币经验
    const expPerGold = price > 0 ? expHarvest / price : 0;
    
    results.push({
      id: s.plantId || s.plant_id || seedId,
      seedId,
      name,
      growTime: growTimeSec,
      growTimeStr: formatTime(growTimeSec),
      harvestExp: expHarvest,
      price,
      requiredLevel,
      seasons,
      expPerHourNoFert,
      expPerHourNormalFert,
      gainPercent,
      expPerGold,
      normalFertReduceSec: reduceSec,
    });
  }
  
  return results;
}

// 格式化时间
function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r > 0 ? `${m}分${r}秒` : `${m}分`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return r > 0 ? `${h}时${mm}分` : `${h}时${mm}分`;
}

// 获取季节名称（seasons 表示可收获的季节数量）
function getSeasonName(season: number): string {
  return `${season}季`;
}

// 检查作物是否已解锁
function isUnlocked(plant: Plant): boolean {
  if (!props.userLevel || props.userLevel <= 0) return true;
  return plant.requiredLevel <= props.userLevel;
}

// 解锁的作物数量
const unlockedCount = computed(() => {
  return plants.value.filter(p => isUnlocked(p)).length;
});

// 当前等级最优作物
const bestNoFert = computed(() => {
  if (!props.userLevel || props.userLevel <= 0) return null;
  const available = plants.value.filter(p => p.requiredLevel <= props.userLevel!);
  if (available.length === 0) return null;
  return available.reduce((best, current) => 
    current.expPerHourNoFert > best.expPerHourNoFert ? current : best
  );
});

const bestNormalFert = computed(() => {
  if (!props.userLevel || props.userLevel <= 0) return null;
  const available = plants.value.filter(p => p.requiredLevel <= props.userLevel!);
  if (available.length === 0) return null;
  return available.reduce((best, current) => 
    current.expPerHourNormalFert > best.expPerHourNormalFert ? current : best
  );
});

// 排序后的作物列表
const sortedPlants = computed(() => {
  const sorted = [...plants.value];
  switch (sortBy.value) {
    case 'expPerHourNormalFert':
      sorted.sort((a, b) => b.expPerHourNormalFert - a.expPerHourNormalFert);
      break;
    case 'expPerHourNoFert':
      sorted.sort((a, b) => b.expPerHourNoFert - a.expPerHourNoFert);
      break;
    case 'level':
      sorted.sort((a, b) => a.requiredLevel - b.requiredLevel || b.expPerHourNormalFert - a.expPerHourNormalFert);
      break;
    case 'growTime':
      sorted.sort((a, b) => a.growTime - b.growTime);
      break;
    case 'expPerGold':
      sorted.sort((a, b) => b.expPerGold - a.expPerGold);
      break;
  }
  return sorted;
});

// 检查是否为偏好作物
function isPreferred(plant: Plant): boolean {
  if (!props.preferredSeedType) return false;
  return props.preferredSeedType.includes(plant.name);
}

// 设置偏好
function setPreference(plant: Plant) {
  selectedPlant.value = plant.id;
  const seedTypeName = `${plant.name} (Lv${plant.requiredLevel}) ${plant.growTimeStr}`;
  emit('set-preference', seedTypeName);
}
</script>

<style scoped>
.plant-ranking {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.ranking-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e2e8f0;
}

.ranking-title {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.ranking-title svg {
  color: #3b82f6;
}

.help-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: #e2e8f0;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
  margin-left: 4px;
}

.help-btn:hover {
  background: #3b82f6;
  color: white;
}

/* 帮助弹窗 */
.help-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.help-content {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.help-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.help-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.help-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.help-close:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.help-body {
  padding: 20px;
  overflow-y: auto;
  max-height: 50vh;
}

.help-item {
  margin-bottom: 16px;
}

.help-item:last-child {
  margin-bottom: 0;
}

.help-term {
  margin-bottom: 6px;
}

.help-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.help-badge.blue {
  background: #eff6ff;
  color: #1d4ed8;
}

.help-badge.green {
  background: #f0fdf4;
  color: #15803d;
}

.help-badge.purple {
  background: #f3e8ff;
  color: #7c3aed;
}

.help-badge.orange {
  background: #fff7ed;
  color: #c2410c;
}

.help-badge.gray {
  background: #f1f5f9;
  color: #475569;
}

.help-desc {
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
  padding-left: 4px;
}

.help-footer {
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
}

.help-ok-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 8px;
  background: #3b82f6;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.help-ok-btn:hover {
  background: #2563eb;
}

.sort-selector {
  position: relative;
}

.sort-select {
  padding: 8px 32px 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #374151;
  background: white;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
}

.sort-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* 智能推荐区域 */
.recommendation-section {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 1px solid #bae6fd;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 20px;
}

.recommendation-title {
  font-size: 14px;
  font-weight: 600;
  color: #0369a1;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.recommendation-title svg {
  color: #f59e0b;
}

.recommendation-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.rec-card {
  background: white;
  border-radius: 10px;
  padding: 14px 16px;
  border: 2px solid transparent;
}

.rec-card.no-fert {
  border-color: #e2e8f0;
}

.rec-card.normal-fert {
  border-color: #22c55e;
  background: #f0fdf4;
}

.rec-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

.rec-name {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 4px;
}

.rec-value {
  font-size: 18px;
  font-weight: 700;
  color: #3b82f6;
}

.rec-card.normal-fert .rec-value {
  color: #22c55e;
}

.rec-detail {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}

/* 提示信息 */
.preference-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #92400e;
}

.preference-tip svg {
  flex-shrink: 0;
  color: #f59e0b;
}

.ranking-table-container {
  overflow-x: auto;
  margin-bottom: 16px;
}

.ranking-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.ranking-table th {
  text-align: left;
  padding: 10px 8px;
  font-weight: 500;
  color: #64748b;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
  font-size: 12px;
}

.ranking-table th small {
  font-weight: 400;
  color: #94a3b8;
}

.ranking-table td {
  padding: 10px 8px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.ranking-table tbody tr:hover {
  background: #f8fafc;
}

.ranking-table tbody tr.top3 {
  background: #f0fdf4;
}

.ranking-table tbody tr.selected {
  background: #eff6ff;
}

.ranking-table tbody tr.locked {
  opacity: 0.6;
  background: #f8fafc;
}

.col-rank {
  width: 50px;
  text-align: center;
}

.col-plant {
  min-width: 100px;
}

.col-season {
  width: 50px;
  text-align: center;
}

.col-level {
  width: 60px;
  text-align: center;
}

.col-time {
  width: 90px;
}

.col-exp,
.col-exp-fert {
  width: 80px;
  text-align: right;
}

.col-gain {
  width: 60px;
  text-align: center;
}

.col-gold {
  width: 80px;
  text-align: right;
}

.col-action {
  width: 90px;
  text-align: center;
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  background: #f1f5f9;
}

.rank-badge.rank-1 {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: white;
}

.rank-badge.rank-2 {
  background: linear-gradient(135deg, #94a3b8, #64748b);
  color: white;
}

.rank-badge.rank-3 {
  background: linear-gradient(135deg, #cd7f32, #b45309);
  color: white;
}

.plant-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.plant-name {
  font-weight: 500;
  color: #1e293b;
}

.plant-unlock {
  font-size: 11px;
  color: #ef4444;
  display: flex;
  align-items: center;
  gap: 2px;
}

.season-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  background: #f3e8ff;
  color: #7c3aed;
}

.exp-value {
  font-weight: 600;
  color: #3b82f6;
}

.exp-value-fert {
  font-weight: 600;
  color: #22c55e;
}

.gain-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  background: #dcfce7;
  color: #166534;
}

.gain-none {
  color: #94a3b8;
}

.gold-value {
  font-weight: 500;
  color: #f59e0b;
}

.btn-set-preference {
  padding: 5px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-set-preference:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.btn-set-preference.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.btn-set-preference.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f1f5f9;
  border-color: #e2e8f0;
  color: #94a3b8;
}

.btn-set-preference.disabled:hover {
  border-color: #e2e8f0;
  color: #94a3b8;
}

.ranking-footer {
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.stats-info {
  font-size: 13px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.stats-info .divider {
  color: #e2e8f0;
}

/* 显示/隐藏控制 */
.mobile-only {
  display: none;
}

.desktop-only {
  display: block;
}

/* 移动端卡片样式 */
.mobile-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.plant-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  transition: all 0.2s ease;
}

.plant-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.plant-card.top3 {
  background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
  border-color: #86efac;
}

.plant-card.selected {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-color: #93c5fd;
}

.plant-card.locked {
  opacity: 0.7;
  background: #f8fafc;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
}

.plant-title {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.plant-title .plant-name {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.plant-title .season-badge {
  align-self: flex-start;
}

.lock-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #fee2e2;
  color: #dc2626;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.card-stats {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.stat-row {
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

.stat-row.secondary {
  padding-top: 10px;
  border-top: 1px dashed #e2e8f0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.stat-label {
  font-size: 11px;
  color: #94a3b8;
}

.stat-value {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}

.stat-unit {
  font-size: 10px;
  color: #94a3b8;
}

.card-action {
  display: flex;
  justify-content: flex-end;
}

.card-action .btn-set-preference {
  padding: 8px 16px;
  font-size: 13px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .plant-ranking {
    padding: 16px;
  }

  .ranking-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .ranking-title {
    font-size: 16px;
  }

  .recommendation-cards {
    grid-template-columns: 1fr;
  }

  /* 移动端显示控制 */
  .desktop-only {
    display: none;
  }

  .mobile-only {
    display: flex;
  }

  .ranking-footer {
    padding-top: 12px;
  }

  .stats-info {
    font-size: 12px;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .stats-info .divider {
    display: none;
  }
}

/* 超小屏幕优化 */
@media (max-width: 360px) {
  .plant-card {
    padding: 12px;
  }

  .stat-row {
    gap: 8px;
  }

  .stat-value {
    font-size: 13px;
  }

  .card-header {
    gap: 8px;
  }

  .plant-title .plant-name {
    font-size: 14px;
  }
}
</style>