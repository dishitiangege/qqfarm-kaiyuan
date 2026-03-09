<template>
  <div>
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <!-- 等级卡片 -->
      <Card3D 
        title="等级" 
        :description="`总经验: ${account.stats.exp.toLocaleString()}`"
        :show-more="false"
        variant="level"
      >
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </template>
        <template #actions>
          <div style="font-size: 28px; font-weight: 700; color: white;">Lv{{ getCurrentLevel() }}</div>
        </template>
      </Card3D>

      <!-- 金币卡片 -->
      <Card3D 
        title="金币" 
        :show-more="false"
        variant="coin"
      >
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </template>
        <template #actions>
          <div style="font-size: 24px; font-weight: 700; color: white;">{{ account.stats.coins.toLocaleString() }}</div>
        </template>
      </Card3D>

      <!-- 经验进度卡片 -->
      <Card3D 
        title="经验进度" 
        :description="`${getExpProgress().toLocaleString()} / ${getExpNeeded().toLocaleString()} 经验`"
        :show-more="false"
        variant="exp"
      >
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
        </template>
        <template #actions>
          <div style="width: 100%;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-size: 16px; font-weight: 700; color: white;">{{ getExpProgressPercent() }}%</span>
              <span style="font-size: 10px; color: rgba(255,255,255,0.9);">{{ getEstimatedTimeToLevelUp() }}</span>
            </div>
            <div style="width: 100%; height: 5px; background: rgba(255,255,255,0.25); border-radius: 3px; overflow: hidden;">
              <div :style="{ width: getExpProgressPercent() + '%', height: '100%', background: 'white', borderRadius: '3px', transition: 'width 0.3s ease' }"></div>
            </div>
          </div>
        </template>
      </Card3D>

      <!-- 在线时长卡片 -->
      <Card3D 
        title="在线时长" 
        :show-more="false"
        variant="time"
      >
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </template>
        <template #actions>
          <div style="font-size: 24px; font-weight: 700; color: white;">{{ account.stats.sessionStats?.onlineTime || 0 }}<span style="font-size: 12px; margin-left: 2px;">分钟</span></div>
        </template>
      </Card3D>
    </div>

    <!-- 统计区域（本次登录 / 今日累计 Tab 切换） -->
    <div style="background: white; border-radius: 16px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 20px;">
      <!-- Tab 切换按钮 -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
        <div style="display: flex; gap: 8px; background: #f1f5f9; padding: 4px; border-radius: 10px;">
          <button 
            @click="statsTab = 'session'"
            :style="{ 
              background: statsTab === 'session' ? '#3b82f6' : 'transparent',
              color: statsTab === 'session' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }"
          >
            本次登录
          </button>
          <button 
            @click="statsTab = 'daily'"
            :style="{ 
              background: statsTab === 'daily' ? '#22c55e' : 'transparent',
              color: statsTab === 'daily' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }"
          >
            今日累计
          </button>
        </div>
        <div style="font-size: 13px; color: #64748b;">
          <span v-if="statsTab === 'session'">在线时长: {{ formatOnlineTime(account.stats.sessionStats?.onlineTime || 0) }}</span>
          <span v-else>累计在线: 今日全天</span>
        </div>
      </div>

      <!-- 本次登录统计内容 -->
      <div v-if="statsTab === 'session'" class="stats-cards-grid">
        <StatCard 
          label="获得经验" 
          :value="account.stats.sessionStats?.exp || 0" 
          value-color="#22c55e"
          icon-bg="linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
          :show-decoration="true"
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </template>
        </StatCard>
        <StatCard 
          label="经验/分钟" 
          :value="getExpPerMinute()" 
          :hint="account.stats.sessionStats?.onlineTime > 0 ? `约 ${getExpPerHour()}/小时` : ''"
          value-color="#8b5cf6"
          icon-bg="linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"
          :show-decoration="true"
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
              <polyline points="17 6 23 6 23 12"></polyline>
            </svg>
          </template>
        </StatCard>
        <StatCard 
          label="收获" 
          :value="account.stats.sessionStats?.harvest || 0" 
          value-color="#22c55e"
          icon-bg="linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
          :show-decoration="true"
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
            </svg>
          </template>
        </StatCard>
        <StatCard 
          label="偷菜" 
          :value="account.stats.sessionStats?.steal || 0" 
          value-color="#fbbf24"
          icon-bg="linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)"
          :show-decoration="true"
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </template>
        </StatCard>
        <StatCard 
          label="帮浇水" 
          :value="account.stats.sessionStats?.water || 0" 
          value-color="#3b82f6"
          icon-bg="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
          :show-decoration="true"
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
            </svg>
          </template>
        </StatCard>
        <StatCard 
          label="帮除草" 
          :value="account.stats.sessionStats?.weed || 0" 
          value-color="#3b82f6"
          icon-bg="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
          :show-decoration="true"
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
            </svg>
          </template>
        </StatCard>
        <StatCard 
          label="帮除虫" 
          :value="account.stats.sessionStats?.bug || 0" 
          value-color="#3b82f6"
          icon-bg="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
          :show-decoration="true"
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </template>
        </StatCard>
        <StatCard 
          label="出售金币" 
          :value="account.stats.sessionStats?.sell || 0" 
          value-color="#fbbf24"
          icon-bg="linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)"
          :show-decoration="true"
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </template>
        </StatCard>
      </div>

      <!-- 今日累计统计内容 -->
      <div v-else class="stats-cards-grid">
        <StatCard 
          label="累计经验" 
          :value="account.stats.todayStats?.exp?.toLocaleString() || 0" 
          value-color="#22c55e"
          icon-bg="linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
          :gradient="true"
          :gradient-colors="['#dcfce7', '#bbf7d0']"
          :show-decoration="true"
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </template>
        </StatCard>
        <StatCard 
          label="累计收获" 
          :value="account.stats.todayStats?.harvest || 0" 
          value-color="#22c55e"
          icon-bg="linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
          :gradient="true"
          :gradient-colors="['#dcfce7', '#bbf7d0']"
          :show-decoration="true"
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
            </svg>
          </template>
        </StatCard>
        <StatCard 
          label="累计偷菜" 
          :value="account.stats.todayStats?.steal || 0" 
          value-color="#fbbf24"
          icon-bg="linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)"
          :gradient="true"
          :gradient-colors="['#fef3c7', '#fde68a']"
          :show-decoration="true"
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </template>
        </StatCard>
        <StatCard 
          label="累计浇水" 
          :value="account.stats.todayStats?.water || 0" 
          value-color="#3b82f6"
          icon-bg="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
          :gradient="true"
          :gradient-colors="['#dbeafe', '#bfdbfe']"
          :show-decoration="true"
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
            </svg>
          </template>
        </StatCard>
        <StatCard 
          label="累计除草" 
          :value="account.stats.todayStats?.weed || 0" 
          value-color="#3b82f6"
          icon-bg="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
          :gradient="true"
          :gradient-colors="['#dbeafe', '#bfdbfe']"
          :show-decoration="true"
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
            </svg>
          </template>
        </StatCard>
        <StatCard 
          label="累计除虫" 
          :value="account.stats.todayStats?.bug || 0" 
          value-color="#3b82f6"
          icon-bg="linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
          :gradient="true"
          :gradient-colors="['#dbeafe', '#bfdbfe']"
          :show-decoration="true"
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </template>
        </StatCard>
        <StatCard 
          label="累计售卖金币" 
          :value="account.stats.todayStats?.sell?.toLocaleString() || 0" 
          value-color="#fbbf24"
          icon-bg="linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)"
          :gradient="true"
          :gradient-colors="['#fef3c7', '#fde68a']"
          :show-decoration="true"
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </template>
        </StatCard>
      </div>
    </div>

    <!-- 操作限制显示 -->
    <div v-if="account.stats?.operationLimits && (Array.isArray(account.stats.operationLimits) ? account.stats.operationLimits.length > 0 : Object.keys(account.stats.operationLimits).length > 0)" style="background: white; border-radius: 16px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-top: 20px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <h3 style="font-size: 16px; font-weight: 600; color: #1e293b; margin: 0;">今日操作限制</h3>
        <span style="font-size: 12px; color: #94a3b8;">每日重置</span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px;">
        <!-- 数组格式（旧后端格式） -->
        <template v-if="Array.isArray(account.stats.operationLimits)">
          <div v-for="limit in account.stats.operationLimits" :key="limit.id" style="background: #f8fafc; border-radius: 10px; padding: 12px; text-align: center;" :style="{ borderLeft: (limit.expLeft <= 0 ? '3px solid #ef4444' : '3px solid #22c55e') }">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">{{ limit.name }}</div>
            <div style="font-size: 18px; font-weight: 600;" :style="{ color: limit.expLeft <= 0 ? '#ef4444' : '#1e293b' }">
              {{ limit.expLeft }}/{{ (limit as any).expLimit || limit.max }}
            </div>
            <div v-if="limit.expLeft <= 0" style="font-size: 10px; color: #ef4444; margin-top: 2px;">已达上限</div>
          </div>
        </template>
        <!-- 对象格式（新后端格式） -->
        <template v-else>
          <div v-for="(limit, name) in account.stats.operationLimits" :key="name" style="background: #f8fafc; border-radius: 10px; padding: 12px; text-align: center;" :style="{ borderLeft: (limit.current >= limit.max ? '3px solid #ef4444' : '3px solid #22c55e') }">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">{{ getOperationLimitName(name) }}</div>
            <div style="font-size: 18px; font-weight: 600;" :style="{ color: limit.current >= limit.max ? '#ef4444' : '#1e293b' }">
              {{ limit.current }}/{{ limit.max }}
            </div>
            <div v-if="limit.current >= limit.max" style="font-size: 10px; color: #ef4444; margin-top: 2px;">已达上限</div>
          </div>
        </template>
      </div>
    </div>

    <!-- 任务系统显示 -->
    <div v-if="account.stats?.tasks" style="background: white; border-radius: 16px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-top: 20px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <h3 style="font-size: 16px; font-weight: 600; color: #1e293b; margin: 0;">任务系统</h3>
        <div style="display: flex; gap: 12px; align-items: center;">
          <span v-if="account.stats.tasks.claimable > 0" style="font-size: 12px; color: #22c55e; background: #dcfce7; padding: 4px 10px; border-radius: 10px; font-weight: 500;">{{ account.stats.tasks.claimable }} 个可领取</span>
          <span style="font-size: 12px; color: #64748b;">共 {{ account.stats.tasks.total }} 个任务</span>
        </div>
      </div>
      <div v-if="account.stats.tasks.list && account.stats.tasks.list.length > 0" style="display: flex; flex-direction: column; gap: 10px;">
        <TaskCard 
          v-for="task in account.stats.tasks.list" 
          :key="task.id"
          :name="(task as any).name || task.desc"
          :progress="task.progress"
          :total="task.total"
          :reward="task.reward || (task.rewards ? task.rewards.map((r: {count: number}) => r.count).join('+') : '')"
          :is-completed="!!(task.isClaimed || task.is_claimed)"
          :is-claimable="!!(task.progress >= task.total && !(task.isClaimed || task.is_claimed))"
        />
      </div>
      <div v-else style="text-align: center; padding: 40px; color: #94a3b8; font-size: 14px;">
        暂无任务数据
      </div>
    </div>

    <!-- 每日礼包显示 -->
    <DailyGifts :account-id="account.id" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import roleLevelData from '../../../../gameConfig/RoleLevel.json';
import Card3D from '../Card3D.vue';
import StatCard from '../StatCard.vue';
import TaskCard from '../TaskCard.vue';
import DailyGifts from '../DailyGifts.vue';

interface Account {
  id: string;
  name: string;
  level: number;
  status: 'online' | 'offline';
  platform: 'qq' | 'wx';
  code: string;
  email: string;
  farmInterval: number;
  friendInterval: number;
  isRunning?: boolean;
  config: any;
  stats: {
    exp: number;
    coins: number;
    sessionStats: {
      exp: number;
      harvest: number;
      steal: number;
      water: number;
      weed: number;
      bug: number;
      sell: number;
      onlineTime: number;
    };
    todayStats: {
      exp: number;
      harvest: number;
      steal: number;
      water: number;
      weed: number;
      bug: number;
      sell: number;
    };
    operationLimits?: Record<string, { current: number; max: number }> | Array<{ id: number; name: string; current: number; max: number; expLeft: number }>;
    tasks?: {
      total: number;
      claimable: number;
      list: Array<{
        id: number;
        desc: string;
        progress: number;
        total: number;
        isClaimed?: boolean;
        is_claimed?: boolean;
        reward?: string;
        rewards?: Array<{ id: number; count: number }>;
      }>;
    };
  };
}

const props = defineProps<{
  account: Account;
}>();

const statsTab = ref<'session' | 'daily'>('session');

// 根据经验值计算当前等级
function getCurrentLevel(): number {
  const exp = props.account.stats.exp || 0;
  for (let i = roleLevelData.length - 1; i >= 0; i--) {
    const levelData = roleLevelData[i];
    if (levelData && exp >= levelData.exp) {
      return levelData.level;
    }
  }
  return 1;
}

// 计算经验进度（当前等级已获得的经验值）
function getExpProgress(): number {
  const level = getCurrentLevel();
  const currentLevelExp = roleLevelData.find(item => item.level === level)?.exp || 0;
  const expInCurrentLevel = props.account.stats.exp - currentLevelExp;
  return Math.max(0, expInCurrentLevel);
}

// 计算升级所需经验（当前等级升到下一级需要的总经验值）
function getExpNeeded(): number {
  const level = getCurrentLevel();
  const currentLevelExp = roleLevelData.find(item => item.level === level)?.exp || 0;
  const nextLevelExp = roleLevelData.find(item => item.level === level + 1)?.exp || currentLevelExp;
  return nextLevelExp - currentLevelExp;
}

// 计算经验进度百分比
function getExpProgressPercent(): number {
  const needed = getExpNeeded();
  if (needed === 0) return 100;
  const percent = Math.min(100, (getExpProgress() / needed) * 100);
  return Math.round(percent * 10) / 10;
}

// 计算经验/分钟
function getExpPerMinute(): number {
  const exp = props.account.stats.sessionStats?.exp || 0;
  const onlineTime = props.account.stats.sessionStats?.onlineTime || 0;
  if (onlineTime === 0) return 0;
  return Math.round((exp / onlineTime) * 10) / 10;
}

// 计算经验/小时
function getExpPerHour(): number {
  const expPerMin = getExpPerMinute();
  return Math.round(expPerMin * 60);
}

// 格式化在线时间
function formatOnlineTime(minutes: number): string {
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) {
    return mins > 0 ? `${hours}小时${mins}分` : `${hours}小时`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours > 0) {
    return `${days}天${remainingHours}小时`;
  }
  return `${days}天`;
}

// 计算预计升级时间（分钟）
function getEstimatedTimeToLevelUp(): string {
  const expNeeded = getExpNeeded();
  const expProgress = getExpProgress();
  const expRemaining = expNeeded - expProgress;
  const expPerHour = getExpPerHour();
  
  if (expPerHour <= 0) return '计算中...';
  if (expRemaining <= 0) return '即将升级';
  
  const hoursNeeded = expRemaining / expPerHour;
  const totalMinutes = Math.ceil(hoursNeeded * 60);
  
  if (totalMinutes < 60) {
    return `约 ${totalMinutes} 分钟`;
  } else if (totalMinutes < 1440) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `约 ${hours} 小时${mins > 0 ? mins + ' 分钟' : ''}`;
  } else {
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    return `约 ${days} 天${hours > 0 ? hours + ' 小时' : ''}`;
  }
}

// 获取操作限制名称
function getOperationLimitName(name: string): string {
  const names: Record<string, string> = {
    weed: '除草',
    bug: '除虫',
    water: '浇水',
    steal: '偷菜',
    putWeed: '放草',
    putBug: '放虫',
    help: '帮助',
  };
  return names[name] || name;
}
</script>

<style scoped>
/* 统计卡片网格 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

/* 统计数据卡片网格（本次登录/今日累计） */
.stats-cards-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

/* 响应式适配 */
@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .stats-cards-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
  
  .stats-cards-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .stats-cards-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
}

@media (max-width: 480px) {
  .stats-cards-grid {
    grid-template-columns: 1fr;
  }
}
</style>
