<template>
  <div>
    <PlantRanking
      :preferred-seed-type="account.config?.seedType"
      :can-set-preference="!account.config?.enableSmartPlant"
      :user-level="account.level"
      @set-preference="onSetSeedPreference"
    />
  </div>
</template>

<script setup lang="ts">
import PlantRanking from '../PlantRanking.vue';

interface Account {
  id: string;
  level: number;
  config?: {
    seedType?: string;
    enableSmartPlant?: boolean;
  };
}

const props = defineProps<{
  account: Account;
}>();

const emit = defineEmits<{
  'set-seed-preference': [plantName: string];
}>();

function onSetSeedPreference(plantName: string) {
  emit('set-seed-preference', plantName);
}
</script>
