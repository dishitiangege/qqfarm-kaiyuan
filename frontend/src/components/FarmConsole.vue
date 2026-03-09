<template>
  <FarmConsoleContainer
    :account="account"
    :logs="logs"
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    @save-config="$emit('save-config', $event)"
    @toggle-script="$emit('toggle-script')"
    @relogin="$emit('relogin')"
    @clear-logs="$emit('clear-logs')"
    @set-seed-preference="$emit('set-seed-preference', $event)"
  />
</template>

<script setup lang="ts">
// 使用拆分后的组件
import FarmConsoleContainer from './FarmConsole/index.vue';

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

defineProps<{
  account: Account;
  logs: string[];
  modelValue: string;
}>();

defineEmits<{
  'update:modelValue': [value: string];
  'save-config': [config: any];
  'toggle-script': [];
  'relogin': [];
  'clear-logs': [];
  'set-seed-preference': [plantName: string];
}>();
</script>
