<template>
  <div style="padding: 24px; max-width: 1400px; margin: 0 auto;">
    <!-- 概览标签页 -->
    <OverviewTab
      v-if="modelValue === 'overview'"
      :account="account"
      @toggle-script="$emit('toggle-script')"
      @relogin="$emit('relogin')"
    />

    <!-- 土地标签页 -->
    <LandTab
      v-else-if="modelValue === 'land'"
      :account="account"
    />

    <!-- 背包标签页 -->
    <BagTab
      v-else-if="modelValue === 'bag'"
      :account="account"
    />

    <!-- 排行榜标签页 -->
    <RankingTab
      v-else-if="modelValue === 'ranking'"
      :account="account"
      @set-seed-preference="$emit('set-seed-preference', $event)"
    />

    <!-- 日志标签页 -->
    <LogTab
      v-else-if="modelValue === 'log'"
      :account="account"
      :logs="logs"
      @clear-logs="$emit('clear-logs')"
    />

    <!-- 配置标签页 -->
    <ConfigTab
      v-else-if="modelValue === 'config'"
      :account="account"
      @save-config="$emit('save-config', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import OverviewTab from './OverviewTab.vue';
import LandTab from './LandTab.vue';
import BagTab from './BagTab.vue';
import RankingTab from './RankingTab.vue';
import LogTab from './LogTab.vue';
import ConfigTab from './ConfigTab.vue';

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
    landStatus: any[];
    bag?: any[];
    operationLimits?: any;
    tasks?: any;
  };
}

const props = defineProps<{
  account: Account;
  logs: string[];
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'save-config': [config: any];
  'toggle-script': [];
  'relogin': [];
  'clear-logs': [];
  'set-seed-preference': [plantName: string];
}>();
</script>
