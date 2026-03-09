<template>
  <div style="background: white; border-radius: 16px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <!-- 经验进度卡片 -->
    <div class="exp-progress-card">
      <div class="exp-progress-header">
        <div class="exp-icon">⭐</div>
        <div class="exp-info">
          <div class="exp-level">等级 {{ currentLevel }}</div>
          <div class="exp-detail">
            <span class="exp-current">{{ formatNumber(currentExp) }}</span>
            <span class="exp-separator">/</span>
            <span class="exp-next">{{ formatNumber(nextLevelExp) }}</span>
            <span class="exp-remain">(还需 {{ formatNumber(expToNextLevel) }} 经验)</span>
          </div>
        </div>
        <div class="land-exp-summary" v-if="totalLandExp > 0">
          <div class="land-exp-badge">
            <span class="land-exp-icon">🌾</span>
            <span class="land-exp-text">当前土地预计收获能获得经验：</span>
            <span class="land-exp-value">+{{ formatNumber(totalLandExp) }}</span>
          </div>
          <div class="rounds-info" v-if="roundsToLevelUp > 0">
            <span class="rounds-text">预计还需种植</span>
            <span class="rounds-value">{{ roundsToLevelUp }}</span>
            <span class="rounds-unit">轮</span>
          </div>
        </div>
      </div>
      <div class="exp-progress-bar-container">
        <div class="exp-progress-bar">
          <div 
            class="exp-progress-fill" 
            :style="{ width: `${levelProgressPercent}%` }"
          ></div>
        </div>
        <div class="exp-progress-text">{{ levelProgressPercent.toFixed(1) }}%</div>
      </div>
    </div>

    <!-- 土地标签页内容 -->
    <div class="land-header">
      <h3 style="font-size: 16px; font-weight: 600; color: #1e293b; margin: 0; white-space: nowrap;">土地状况 ({{ landData.length }}块)</h3>
      <div class="land-controls">
        <!-- 土地等级统计 -->
        <div class="land-level-stats">
          <div v-for="(count, level) in landLevelStats" :key="level" class="land-level-tag">
            <span :style="{ color: getLandLevelColor(Number(level)) }">{{ getLandLevelName(Number(level)) }}</span>
            <span style="font-weight: 600; color: #1e293b;">{{ count }}块</span>
          </div>
        </div>
        
        <!-- 收获模式控制按钮 -->
        <template v-if="harvestSelectMode">
          <button
            @click="cancelHarvestSelect"
            style="
              padding: 6px 12px;
              background: #f1f5f9;
              color: #64748b;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
            "
          >
            取消
          </button>
          <button
            @click="toggleSelectAllMature"
            style="
              padding: 6px 12px;
              background: #eff6ff;
              color: #3b82f6;
              border: 1px solid #bfdbfe;
              border-radius: 8px;
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
            "
          >
            {{ isAllMatureSelected ? '取消全选' : '全选' }}
          </button>
          <button
            v-if="selectedLands.size > 0"
            @click="handleHarvestSelected"
            :disabled="harvestingLands"
            style="
              padding: 6px 12px;
              background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
            "
            :style="harvestingLands ? 'opacity: 0.6; cursor: not-allowed;' : ''"
          >
            <span v-if="harvestingLands">收获中...</span>
            <span v-else>收获选中 ({{ selectedLands.size }})</span>
          </button>
        </template>
        
        <!-- 种植模式控制按钮 -->
        <template v-else-if="plantSelectMode">
          <button
            @click="cancelPlantSelect"
            style="
              padding: 6px 12px;
              background: #f1f5f9;
              color: #64748b;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
            "
          >
            取消
          </button>
          <button
            @click="toggleSelectAllEmpty"
            style="
              padding: 6px 12px;
              background: #eff6ff;
              color: #3b82f6;
              border: 1px solid #bfdbfe;
              border-radius: 8px;
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
            "
          >
            {{ isAllEmptySelected ? '取消全选' : '全选' }}
          </button>
          <button
            v-if="selectedLandsForPlant.size > 0 && selectedSeedId"
            @click="handlePlantSelected"
            :disabled="plantingLands"
            style="
              padding: 6px 12px;
              background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
            "
            :style="plantingLands ? 'opacity: 0.6; cursor: not-allowed;' : ''"
          >
            <span v-if="plantingLands">种植中...</span>
            <span v-else>种植选中 ({{ selectedLandsForPlant.size }})</span>
          </button>
        </template>
        
        <!-- 正常模式按钮 -->
        <template v-else>
          <!-- 手动种植按钮 -->
          <button
            @click="plantSelectMode = true"
            style="
              padding: 6px 12px;
              background: #dcfce7;
              color: #16a34a;
              border: 1px solid #86efac;
              border-radius: 8px;
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
            "
          >
            手动种植 ({{ emptyLandsCount }})
          </button>
          <!-- 手动收获按钮 -->
          <button
            @click="harvestSelectMode = true"
            style="
              padding: 6px 12px;
              background: #fef3c7;
              color: #d97706;
              border: 1px solid #fcd34d;
              border-radius: 8px;
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
            "
          >
            手动收获 ({{ matureLandsCount }})
          </button>
        </template>
      </div>
    </div>

    <!-- 收获模式提示 -->
    <div v-if="harvestSelectMode" style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px;">
      <div style="display: flex; align-items: flex-start; gap: 8px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <span style="font-size: 13px; color: #92400e;">点击成熟土地进行选择，选中后点击"收获选中"按钮</span>
      </div>
    </div>

    <!-- 种植模式提示 -->
    <div v-if="plantSelectMode" style="background: #dcfce7; border: 1px solid #86efac; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px;">
      <div style="display: flex; align-items: flex-start; gap: 8px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <div style="flex: 1;">
          <div style="font-size: 13px; color: #166534; margin-bottom: 8px;">点击空闲土地进行选择，选择种子后点击"种植选中"按钮</div>
          
          <!-- 种子选择 -->
          <div style="background: white; border-radius: 8px; padding: 12px; margin-top: 8px;">
            <div style="font-size: 12px; font-weight: 600; color: #1e293b; margin-bottom: 8px;">选择种子</div>
            <div style="position: relative; margin-bottom: 8px;">
              <input
                v-model="seedSearchQuery"
                type="text"
                placeholder="搜索种子..."
                style="width: 100%; padding: 8px 12px 8px 32px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; box-sizing: border-box;"
              >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%);">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
            <div style="max-height: 150px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px;">
              <div
                v-for="seed in filteredSeeds"
                :key="seed.id"
                @click="selectedSeedId = seed.id"
                :style="{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f1f5f9',
                  backgroundColor: selectedSeedId === seed.id ? '#eff6ff' : 'white',
                  fontSize: '13px'
                }"
              >
                <div style="display: flex; justify-content: space-between;">
                  <span :style="{ fontWeight: selectedSeedId === seed.id ? '600' : '400', color: '#1e293b' }">{{ seed.name }}</span>
                  <span style="color: #64748b; font-size: 12px;">Lv{{ seed.levelNeed }}</span>
                </div>
              </div>
              <div v-if="filteredSeeds.length === 0" style="padding: 12px; text-align: center; color: #94a3b8; font-size: 12px;">
                未找到匹配的种子
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 土地网格 -->
    <div class="land-grid">
      <div
        v-for="(land, index) in landData"
        :key="index"
        :class="[
          'land-cell',
          `land-type-${land.landLevel || 1}`,
          {
            'land-empty': land.status === '空闲',
            'land-growing': land.status === '生长中',
            'land-mature': isLandMature(land),
            'land-locked': land.status === '锁定',
            'land-withered': land.status === '枯死',
            'land-stealable': land.stealable,
            'land-selected': (harvestSelectMode && selectedLands.has(index)) || (plantSelectMode && selectedLandsForPlant.has(index)),
            'land-selectable': (harvestSelectMode && isLandMature(land)) || (plantSelectMode && land.status === '空闲')
          }
        ]"
        @click="handleLandClick(index, land)"
        :style="((harvestSelectMode && isLandMature(land)) || (plantSelectMode && land.status === '空闲')) ? 'cursor: pointer;' : ''"
      >
        <!-- 选择框 - 收获模式 -->
        <div v-if="harvestSelectMode && isLandMature(land)" style="position: absolute; top: 4px; right: 4px; width: 18px; height: 18px; border-radius: 50%; border: 2px solid #f59e0b; background: selectedLands.has(index) ? '#f59e0b' : 'white'; display: flex; align-items: center; justify-content: center; z-index: 10;">
          <svg v-if="selectedLands.has(index)" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        
        <!-- 选择框 - 种植模式 -->
        <div v-if="plantSelectMode && land.status === '空闲'" style="position: absolute; top: 4px; right: 4px; width: 18px; height: 18px; border-radius: 50%; border: 2px solid #22c55e; background: selectedLandsForPlant.has(index) ? '#22c55e' : 'white'; display: flex; align-items: center; justify-content: center; z-index: 10;">
          <svg v-if="selectedLandsForPlant.has(index)" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>

        <!-- 土地等级徽章 -->
        <div
          v-if="land.landLevel && land.landLevel > 0"
          :class="['land-level-badge', `land-level-badge-${land.landLevel}`, { 'can-upgrade': land.couldUpgrade }]"
        >
          {{ getLandLevelName(land.landLevel) }}
          <span v-if="land.couldUpgrade" class="upgrade-icon">↑</span>
        </div>

        <!-- 可偷徽章 -->
        <div v-if="land.stealable" class="land-stealable-badge">可偷</div>

        <!-- 作物图片 -->
        <div class="land-crop-image-container">
          <img 
            v-if="land.cropName && getCropImageUrl(land.cropName)" 
            :src="getCropImageUrl(land.cropName)" 
            :alt="land.cropName"
            class="land-crop-image"
            @error="handleImageError($event)"
          />
          <div v-else class="land-phase-icon" :style="{ color: land.phaseConfig?.color }">{{ land.phaseConfig?.icon || '🌱' }}</div>
        </div>

        <!-- 作物名称 -->
        <div class="land-crop-name">{{ land.cropName || land.status }}</div>

        <!-- 生长阶段 -->
        <div class="land-growth-stage" :style="{ color: land.phaseConfig?.color }">{{ land.phaseConfig?.name || land.growthStage || land.status }}</div>

        <!-- 进度条 -->
        <div v-if="land.progress !== undefined && land.totalProgress !== undefined && land.totalProgress > 0" class="land-total-progress-bar">
          <div
            class="land-total-progress-fill"
            :style="{ width: `${Math.min(100, (land.progress / land.totalProgress) * 100)}%` }"
          ></div>
          <div class="land-total-progress-text">{{ Math.round(Math.min(100, (land.progress / land.totalProgress) * 100)) }}%</div>
        </div>

        <!-- 预计成熟时间 -->
        <div v-if="land.matureTime" class="land-mature-time">
          {{ formatMatureTime(land.matureTime) }}
        </div>

        <!-- Buff显示 -->
        <div v-if="land.buff" class="land-buff">
          <span v-if="land.buff.yieldBonus > 0" title="产量加成">📈{{ land.buff.yieldBonus }}%</span>
          <span v-if="land.buff.timeReduction > 0" title="时间减少">⏱️{{ land.buff.timeReduction }}%</span>
          <span v-if="land.buff.expBonus > 0" title="经验加成">⭐{{ land.buff.expBonus }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import axios from 'axios';
import { getCropImageUrl } from '../../services/itemService';

const API_BASE_URL = '/api';

interface LandStatus {
  status: string;
  phase: number;
  phaseName: string;
  plantName?: string;
  progress?: number;
  totalProgress?: number;
  nextPhaseTime?: number;
  matureTime?: number;
  landLevel?: number;
  landMaxLevel?: number;
  couldUpgrade?: boolean;
  stealable?: boolean;
  buff?: {
    yieldBonus: number;
    timeReduction: number;
    expBonus: number;
  } | null;
}

interface Account {
  id: string;
  stats: {
    exp: number;
    landStatus: LandStatus[] | string[];
  };
}

const props = defineProps<{
  account: Account;
}>();

// 生长阶段配置
const PHASE_CONFIG: Record<number, { name: string; color: string; icon: string }> = {
  [-1]: { name: '锁定', color: '#9ca3af', icon: '🔒' },
  [0]: { name: '空闲', color: '#10b981', icon: '🌱' },
  [1]: { name: '种子', color: '#8b5cf6', icon: '🌰' },
  [2]: { name: '发芽', color: '#22c55e', icon: '🌿' },
  [3]: { name: '小叶', color: '#16a34a', icon: '🍃' },
  [4]: { name: '大叶', color: '#15803d', icon: '🌿' },
  [5]: { name: '开花', color: '#ec4899', icon: '🌸' },
  [6]: { name: '成熟', color: '#f59e0b', icon: '🌾' },
  [7]: { name: '枯死', color: '#6b7280', icon: '🥀' },
};

// 导入等级经验配置
import roleLevelData from '../../../../gameConfig/RoleLevel.json';
import plantData from '../../../../gameConfig/Plant.json';

// 使用导入的配置
const LEVEL_EXP_CONFIG = roleLevelData;

// 从Plant.json构建作物经验映射
const CROP_EXP_MAP: Record<string, number> = {};
for (const plant of plantData as any[]) {
  if (plant.name && plant.exp !== undefined) {
    // 使用经验值的最大值（同名作物可能有多个条目）
    const currentExp = CROP_EXP_MAP[plant.name] || 0;
    CROP_EXP_MAP[plant.name] = Math.max(currentExp, plant.exp);
  }
}

// ============ 手动收获土地 ============
const harvestSelectMode = ref(false);
const selectedLands = ref<Set<number>>(new Set());
const harvestingLands = ref(false);

// ============ 手动种植土地 ============
const plantSelectMode = ref(false);
const selectedLandsForPlant = ref<Set<number>>(new Set());
const plantingLands = ref(false);
const selectedSeedId = ref<number | ''>('');
const seedSearchQuery = ref('');

// 植物列表（从API获取）
const plants = ref<Array<{
  id: number;
  name: string;
  seedId: number;
  levelNeed: number;
  exp: number;
  growTime: number;
  displayName: string;
}>>([]);

// 根据经验值计算当前等级
function getCurrentLevel(): number {
  const exp = props.account.stats?.exp || 0;
  for (let i = LEVEL_EXP_CONFIG.length - 1; i >= 0; i--) {
    const config = LEVEL_EXP_CONFIG[i];
    if (config && exp >= config.exp) {
      return config.level;
    }
  }
  return 1;
}

// 获取下一级所需经验
function getNextLevelExp(level: number): number {
  const nextLevel = LEVEL_EXP_CONFIG.find(l => l.level === level + 1);
  const lastLevel = LEVEL_EXP_CONFIG[LEVEL_EXP_CONFIG.length - 1];
  return nextLevel ? nextLevel.exp : (lastLevel ? lastLevel.exp : 0);
}

// 获取当前等级起始经验
function getCurrentLevelBaseExp(level: number): number {
  const currentLevel = LEVEL_EXP_CONFIG.find(l => l.level === level);
  return currentLevel ? currentLevel.exp : 0;
}

// 当前等级
const currentLevel = computed(() => getCurrentLevel());

// 当前经验值
const currentExp = computed(() => props.account.stats?.exp || 0);

// 下一级所需经验
const nextLevelExp = computed(() => getNextLevelExp(currentLevel.value));

// 当前等级起始经验
const currentLevelBaseExp = computed(() => getCurrentLevelBaseExp(currentLevel.value));

// 升级到下一级还需经验
const expToNextLevel = computed(() => {
  return Math.max(0, nextLevelExp.value - currentExp.value);
});

// 等级进度百分比
const levelProgressPercent = computed(() => {
  const levelExpRange = nextLevelExp.value - currentLevelBaseExp.value;
  const currentExpInLevel = currentExp.value - currentLevelBaseExp.value;
  if (levelExpRange <= 0) return 100;
  return Math.min(100, (currentExpInLevel / levelExpRange) * 100);
});

// 计算土地中所有作物可获得的总经验
const totalLandExp = computed(() => {
  let totalExp = 0;
  for (const land of landData.value) {
    // 只计算生长中和成熟的作物（包括包含"成熟"字样的状态）
    const isGrowing = land.status && (land.status.includes('生长中') || land.status.includes('种子') || land.status.includes('发芽') || land.status.includes('叶子') || land.status.includes('开花'));
    const isMature = isLandMature(land);
    
    if (isGrowing || isMature) {
      // 从作物名称获取经验值 - 优先使用cropName，如果没有则尝试从status解析
      let cropName = land.cropName || '';
      
      // 如果cropName为空，尝试从status解析（格式: "作物名 阶段"）
      if (!cropName && land.status && land.status !== '锁定' && land.status !== '空闲') {
        const parts = land.status.split(' ');
        if (parts.length >= 2 && parts[0]) {
          cropName = parts[0];
        }
      }
      
      // 尝试匹配作物名称
      if (cropName) {
        for (const [name, exp] of Object.entries(CROP_EXP_MAP)) {
          if (cropName.includes(name)) {
            totalExp += exp;
            break;
          }
        }
      }
    }
  }
  return totalExp;
});

// 计算还需种植多少轮才能升级
const roundsToLevelUp = computed(() => {
  if (expToNextLevel.value <= 0 || totalLandExp.value <= 0) return 0;
  return Math.ceil(expToNextLevel.value / totalLandExp.value);
});

// 格式化数字（添加千位分隔符）
function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN');
}

// 加载植物列表
async function loadPlants() {
  try {
    const level = getCurrentLevel();
    const response = await axios.get(`${API_BASE_URL}/plants?level=${level}`);
    if (response.data.success) {
      plants.value = response.data.plants;
    }
  } catch (error) {
    console.error('加载植物列表失败:', error);
  }
}

// 可用的种子列表
const availableSeeds = computed(() => {
  return plants.value.map(plant => ({
    id: plant.seedId,
    name: plant.name,
    levelNeed: plant.levelNeed,
    exp: plant.exp,
    growTime: plant.growTime
  }));
});

// 过滤后的种子列表
const filteredSeeds = computed(() => {
  if (!seedSearchQuery.value) return availableSeeds.value;
  const query = seedSearchQuery.value.toLowerCase();
  return availableSeeds.value.filter(seed =>
    seed.name.toLowerCase().includes(query)
  );
});

// 土地数据计算
const landData = computed(() => {
  return props.account.stats.landStatus.map((land) => {
    // 兼容旧版字符串格式
    if (typeof land === 'string') {
      const parts = land.split(' ');
      if (land === '锁定') return { status: '锁定', cropName: '', growthStage: '', phase: -1, phaseConfig: PHASE_CONFIG[-1] };
      if (land === '空闲') return { status: '空闲', cropName: '', growthStage: '', phase: 0, phaseConfig: PHASE_CONFIG[0] };
      if (parts.length >= 2) {
        return {
          status: '生长中',
          cropName: parts[0],
          growthStage: parts[1],
          phase: -2,
          phaseConfig: { name: parts[1], color: '#6b7280', icon: '🌱' }
        };
      }
      return { status: land, cropName: '', growthStage: '', phase: -2, phaseConfig: { name: land, color: '#6b7280', icon: '❓' } };
    }
    
    // 新版对象格式
    const phase = land.phase ?? -2;
    const phaseConfig = PHASE_CONFIG[phase] || { name: land.phaseName || '未知', color: '#6b7280', icon: '❓' };
    
    return {
      status: land.status,
      cropName: land.plantName || '',
      growthStage: land.phaseName || '',
      phase,
      phaseConfig,
      progress: land.progress ?? 0,
      totalProgress: land.totalProgress ?? 0,
      nextPhaseTime: land.nextPhaseTime ?? 0,
      matureTime: land.matureTime ?? 0,
      landLevel: land.landLevel ?? 0,
      landMaxLevel: land.landMaxLevel ?? 0,
      couldUpgrade: land.couldUpgrade ?? false,
      stealable: land.stealable ?? false,
      buff: land.buff,
    };
  });
});

// 检查土地是否成熟
function isLandMature(land: any): boolean {
  if (land.status === '成熟') return true;
  if (land.status && land.status.includes('成熟')) return true;
  const phase = Number(land.phase);
  if (phase === 5) return true;
  if (phase === 6) return true; // 成熟阶段的phase可能是6
  if (land.growthStage && land.growthStage.includes('成熟')) return true;
  return false;
}

// 成熟土地数量
const matureLandsCount = computed(() => {
  return landData.value.filter(isLandMature).length;
});

// 空闲土地数量
const emptyLandsCount = computed(() => {
  return landData.value.filter(land => land.status === '空闲').length;
});

// 土地等级统计
const landLevelStats = computed(() => {
  const stats: Record<number, number> = {};
  for (const land of landData.value) {
    const level = land.landLevel || 0;
    if (level > 0) {
      stats[level] = (stats[level] || 0) + 1;
    }
  }
  return stats;
});

// 获取土地等级名称
function getLandLevelName(level: number): string {
  const names: Record<number, string> = {
    1: '普通',
    2: '红土',
    3: '黑土',
    4: '金土',
  };
  return names[level] || `Lv${level}`;
}

// 获取土地等级颜色
function getLandLevelColor(level: number): string {
  const colors: Record<number, string> = {
    1: '#64748b',
    2: '#ef4444',
    3: '#1f2937',
    4: '#eab308',
  };
  return colors[level] || '#64748b';
}

// 格式化预计成熟时间
function formatMatureTime(timestamp: number): string {
  if (!timestamp || timestamp <= 0) return '';
  const now = Date.now() / 1000;
  const diff = timestamp - now;

  if (diff <= 0) return '即将成熟';

  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (hours > 0) {
    return `${hours}小时${minutes > 0 ? minutes + '分' : ''}`;
  }
  return `${minutes}分钟后`;
}

// ============ 手动收获功能 ============

// 取消收获选择模式
function cancelHarvestSelect() {
  harvestSelectMode.value = false;
  selectedLands.value.clear();
}

// 切换单个土地选择
function toggleLandSelect(index: number) {
  if (selectedLands.value.has(index)) {
    selectedLands.value.delete(index);
  } else {
    selectedLands.value.add(index);
  }
}

// 是否全选成熟土地
const isAllMatureSelected = computed(() => {
  const matureIndices = landData.value
    .map((land, index) => ({ land, index }))
    .filter(({ land }) => isLandMature(land))
    .map(({ index }) => index);
  return matureIndices.length > 0 && matureIndices.every(index => selectedLands.value.has(index));
});

// 全选/取消全选成熟土地
function toggleSelectAllMature() {
  const matureIndices = landData.value
    .map((land, index) => ({ land, index }))
    .filter(({ land }) => isLandMature(land))
    .map(({ index }) => index);
  
  if (isAllMatureSelected.value) {
    // 取消全选
    matureIndices.forEach(index => selectedLands.value.delete(index));
  } else {
    // 全选
    matureIndices.forEach(index => selectedLands.value.add(index));
  }
}

// 收获选中的土地
async function handleHarvestSelected() {
  if (harvestingLands.value || selectedLands.value.size === 0) return;

  harvestingLands.value = true;
  try {
    // 将选中的索引转换为土地ID（索引+1）
    const landIds = Array.from(selectedLands.value).map(index => index + 1);

    const response = await axios.post(`${API_BASE_URL}/accounts/${props.account.id}/harvest-lands`, {
      landIds: landIds
    });

    if (response.data.success) {
      alert(`成功收获 ${selectedLands.value.size} 块土地！`);
      selectedLands.value.clear();
      harvestSelectMode.value = false;
    } else {
      alert(response.data.message || '收获失败');
    }
  } catch (error: any) {
    alert(error.response?.data?.message || '收获失败，请检查账号是否正在运行');
  } finally {
    harvestingLands.value = false;
  }
}

// ============ 手动种植功能 ============

// 取消种植选择模式
function cancelPlantSelect() {
  plantSelectMode.value = false;
  selectedLandsForPlant.value.clear();
  selectedSeedId.value = '';
  seedSearchQuery.value = '';
}

// 切换单个土地选择（种植模式）
function toggleLandSelectForPlant(index: number) {
  if (selectedLandsForPlant.value.has(index)) {
    selectedLandsForPlant.value.delete(index);
  } else {
    selectedLandsForPlant.value.add(index);
  }
}

// 是否全选空闲土地
const isAllEmptySelected = computed(() => {
  const emptyIndices = landData.value
    .map((land, index) => ({ land, index }))
    .filter(({ land }) => land.status === '空闲')
    .map(({ index }) => index);
  return emptyIndices.length > 0 && emptyIndices.every(index => selectedLandsForPlant.value.has(index));
});

// 全选/取消全选空闲土地
function toggleSelectAllEmpty() {
  const emptyIndices = landData.value
    .map((land, index) => ({ land, index }))
    .filter(({ land }) => land.status === '空闲')
    .map(({ index }) => index);

  if (isAllEmptySelected.value) {
    // 取消全选
    emptyIndices.forEach(index => selectedLandsForPlant.value.delete(index));
  } else {
    // 全选
    emptyIndices.forEach(index => selectedLandsForPlant.value.add(index));
  }
}

// 种植选中的土地
async function handlePlantSelected() {
  if (plantingLands.value || selectedLandsForPlant.value.size === 0 || !selectedSeedId.value) return;

  plantingLands.value = true;
  try {
    // 将选中的索引转换为土地ID（索引+1）
    const landIds = Array.from(selectedLandsForPlant.value).map(index => index + 1);

    const response = await axios.post(`${API_BASE_URL}/accounts/${props.account.id}/plant-lands`, {
      landIds: landIds,
      seedId: selectedSeedId.value
    });

    if (response.data.success) {
      alert(`成功种植 ${response.data.landCount} 块 ${response.data.seedName}！`);
      selectedLandsForPlant.value.clear();
      selectedSeedId.value = '';
      plantSelectMode.value = false;
    } else {
      alert(response.data.message || '种植失败');
    }
  } catch (error: any) {
    alert(error.response?.data?.message || '种植失败，请检查账号是否正在运行');
  } finally {
    plantingLands.value = false;
  }
}

// 处理土地点击事件
function handleLandClick(index: number, land: any) {
  if (harvestSelectMode.value && isLandMature(land)) {
    toggleLandSelect(index);
  } else if (plantSelectMode.value && land.status === '空闲') {
    toggleLandSelectForPlant(index);
  }
}

// 处理图片加载错误
function handleImageError(event?: Event) {
  if (!event) return;
  const img = event.target as HTMLImageElement;
  if (img) {
    img.style.display = 'none';
  }
}

// 组件挂载时加载植物列表
onMounted(() => {
  loadPlants();
});

// 监听账号经验值变化，重新加载植物列表（等级可能变化）
watch(() => props.account.stats?.exp, () => {
  loadPlants();
});
</script>

<style scoped>
/* 土地样式 */
.land-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.land-controls {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.land-level-stats {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.land-level-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #64748b;
  background: #f1f5f9;
  padding: 4px 10px;
  border-radius: 12px;
  white-space: nowrap;
}

.land-cell {
  position: relative;
  border-radius: 12px;
  padding: 16px 12px;
  text-align: center;
  border: 2px solid transparent;
  transition: all 0.2s ease;
  min-height: 70px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.1);
}

.land-cell:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.08);
}

/* 土地类型样式 */
.land-type-1 { background: linear-gradient(135deg, #f5f5f4 0%, #e7e5e4 100%); border-color: #d6d3d1; }
.land-type-1.land-empty { background: linear-gradient(135deg, #fafaf9 0%, #f5f5f4 100%); border-color: #d6d3d1; }
.land-type-1.land-growing { background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-color: #86efac; }
.land-type-1.land-mature { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-color: #fbbf24; }

.land-type-2 { background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-color: #fca5a5; }
.land-type-2.land-empty { background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%); border-color: #f87171; }
.land-type-2.land-growing { background: linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 100%); border-color: #4ade80; }
.land-type-2.land-mature { background: linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%); border-color: #f59e0b; }

.land-type-3 { background: linear-gradient(135deg, #78716c 0%, #57534e 100%); border-color: #44403c; }
.land-type-3 .land-crop-name,
.land-type-3 .land-growth-stage { color: #f5f5f4; }
.land-type-3.land-empty { background: linear-gradient(135deg, #a8a29e 0%, #78716c 100%); border-color: #57534e; }
.land-type-3.land-growing { background: linear-gradient(135deg, #57534e 0%, #44403c 100%); border-color: #22c55e; }
.land-type-3.land-mature { background: linear-gradient(135deg, #78716c 0%, #a16207 100%); border-color: #eab308; }

.land-type-4 { background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%); border-color: #fde047; box-shadow: 0 2px 8px rgba(234, 179, 8, 0.2), 0 1px 2px rgba(0,0,0,0.1); }
.land-type-4.land-empty { background: linear-gradient(135deg, #fefce8 0%, #fef08a 100%); border-color: #facc15; }
.land-type-4.land-growing { background: linear-gradient(135deg, #ecfccb 0%, #d9f99d 100%); border-color: #84cc16; }
.land-type-4.land-mature { background: linear-gradient(135deg, #fef3c7 0%, #fbbf24 100%); border-color: #f59e0b; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3), 0 2px 4px rgba(0,0,0,0.1); }

.land-locked { background: #f1f5f9 !important; border-color: #cbd5e1 !important; opacity: 0.7; }
.land-withered { background: #fee2e2 !important; border-color: #fca5a5 !important; }

.land-stealable { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-color: #f59e0b; box-shadow: 0 0 8px rgba(245, 158, 11, 0.4); animation: stealable-pulse 2s ease-in-out infinite; }

@keyframes stealable-pulse {
  0%, 100% { box-shadow: 0 0 8px rgba(245, 158, 11, 0.4); }
  50% { box-shadow: 0 0 16px rgba(245, 158, 11, 0.7); }
}

.land-stealable-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background: #ef4444;
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  animation: badge-blink 1.5s ease-in-out infinite;
}

@keyframes badge-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.land-crop-name { font-size: 13px; font-weight: 500; color: #166534; margin-bottom: 4px; }

.land-crop-image-container {
  width: 48px;
  height: 48px;
  margin: 0 auto 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.land-crop-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 8px;
}

.land-growth-stage { font-size: 11px; color: #22c55e; }

.land-locked .land-crop-name,
.land-locked .land-growth-stage,
.land-empty .land-crop-name,
.land-empty .land-growth-stage { color: #94a3b8; }

.land-mature .land-crop-name { color: #b45309; }
.land-mature .land-growth-stage { color: #f59e0b; }

.land-phase-icon { font-size: 20px; margin-bottom: 4px; }

.land-total-progress-bar {
  width: 100%;
  height: 14px;
  background: #e2e8f0;
  border-radius: 7px;
  margin-top: 6px;
  overflow: hidden;
  position: relative;
}

.land-total-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
  border-radius: 7px;
  transition: width 0.3s ease;
}

.land-total-progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 9px;
  font-weight: 600;
  color: #1e40af;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.5);
}

.land-mature-time { font-size: 10px; color: #3b82f6; margin-top: 4px; font-weight: 500; }

.land-level-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 8px;
  z-index: 5;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  border: 1px solid rgba(255,255,255,0.3);
}

.land-level-badge .upgrade-icon { color: #22c55e; margin-left: 2px; font-weight: 800; }
.land-level-badge.can-upgrade { animation: pulse-badge 1.5s ease-in-out infinite; }

@keyframes pulse-badge {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
  50% { box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.3); }
}

.land-level-badge-1 { color: #57534e; background: linear-gradient(135deg, #f5f5f4 0%, #e7e5e4 100%); border-color: #d6d3d1; }
.land-level-badge-2 { color: #991b1b; background: linear-gradient(135deg, #fecaca 0%, #fca5a5 100%); border-color: #f87171; }
.land-level-badge-3 { color: #f5f5f4; background: linear-gradient(135deg, #44403c 0%, #292524 100%); border-color: #1c1917; }
.land-level-badge-4 { color: #92400e; background: linear-gradient(135deg, #fef08a 0%, #fde047 100%); border-color: #facc15; box-shadow: 0 1px 4px rgba(234, 179, 8, 0.4); }

.land-buff { font-size: 10px; margin-top: 4px; display: flex; gap: 2px; justify-content: center; }

.land-cell.land-selected {
  border: 2px solid #f59e0b !important;
  background: #fef3c7 !important;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.3);
}

.land-cell.land-selectable:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

/* 土地网格 */
.land-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
}

@media (max-width: 768px) {
  .land-header { flex-direction: column; align-items: flex-start; }
  .land-controls { width: 100%; justify-content: flex-start; }
  .land-level-stats { order: -1; width: 100%; justify-content: flex-start; }
  
  /* 手机端一行3个土地卡片 */
  .land-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  
  .land-cell {
    padding: 12px 8px;
    min-height: 60px;
  }
  
  .land-crop-image-container {
    width: 36px;
    height: 36px;
  }
  
  .land-crop-name {
    font-size: 11px;
  }
  
  .land-growth-stage {
    font-size: 10px;
  }
  
  .land-level-badge {
    font-size: 9px;
    padding: 2px 6px;
  }
}

/* 经验进度卡片样式 */
.exp-progress-card {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 16px;
  padding: 20px 24px;
  margin-bottom: 24px;
  border: 1px solid #fcd34d;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15);
}

.exp-progress-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.exp-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: 0 4px 8px rgba(245, 158, 11, 0.3);
}

.exp-info {
  flex: 1;
  min-width: 200px;
}

.exp-level {
  font-size: 20px;
  font-weight: 700;
  color: #92400e;
  margin-bottom: 4px;
}

.exp-detail {
  font-size: 14px;
  color: #78350f;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.exp-current {
  font-weight: 600;
  color: #d97706;
}

.exp-separator {
  color: #a16207;
}

.exp-next {
  font-weight: 600;
  color: #92400e;
}

.exp-remain {
  color: #dc2626;
  font-weight: 500;
  font-size: 13px;
}

.land-exp-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

.land-exp-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background: white;
  padding: 8px 14px;
  border-radius: 20px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  border: 1px solid #fcd34d;
}

.land-exp-icon {
  font-size: 16px;
}

.land-exp-text {
  font-size: 13px;
  color: #78350f;
}

.land-exp-value {
  font-size: 15px;
  font-weight: 700;
  color: #16a34a;
}

.rounds-info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #78350f;
}

.rounds-value {
  font-size: 18px;
  font-weight: 700;
  color: #dc2626;
}

.rounds-unit {
  color: #92400e;
  font-weight: 500;
}

.exp-progress-bar-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.exp-progress-bar {
  flex: 1;
  height: 12px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.exp-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 50%, #f59e0b 100%);
  border-radius: 6px;
  transition: width 0.5s ease;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
}

.exp-progress-text {
  font-size: 14px;
  font-weight: 600;
  color: #92400e;
  min-width: 50px;
  text-align: right;
}

@media (max-width: 768px) {
  .exp-progress-card {
    padding: 16px;
  }
  
  .exp-progress-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .land-exp-summary {
    align-items: flex-start;
    width: 100%;
  }
  
  .exp-level {
    font-size: 18px;
  }
  
  .exp-detail {
    font-size: 13px;
  }
}
</style>