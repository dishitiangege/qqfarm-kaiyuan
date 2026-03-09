<template>
  <div class="task-card" :class="{ 'completed': isCompleted, 'claimable': isClaimable }">
    <div class="task-icon">
      <span v-if="isCompleted">✅</span>
      <span v-else-if="isClaimable">🎁</span>
      <span v-else>📋</span>
    </div>
    <div class="task-content">
      <div class="task-name">{{ name }}</div>
      <div class="task-progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <span class="progress-text">{{ progress }}/{{ total }}</span>
      </div>
      <div class="task-status" v-if="isCompleted">已领取</div>
      <div class="task-status claimable-text" v-else-if="isClaimable">可领取</div>
    </div>
    <div class="task-reward" :class="{ 'completed': isCompleted, 'claimable': isClaimable }">
      {{ reward }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  name: string;
  progress: number;
  total: number;
  reward: string;
  isCompleted: boolean;
  isClaimable: boolean;
}>();

const progressPercent = computed(() => {
  return Math.min((props.progress / props.total) * 100, 100);
});
</script>

<style scoped>
.task-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #f8fafc;
  border-radius: 12px;
  border-left: 3px solid #e2e8f0;
  transition: all 0.3s ease;
  cursor: pointer;
}

.task-card:hover {
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.task-card.completed {
  border-left-color: #22c55e;
  background: linear-gradient(90deg, #f0fdf4 0%, #f8fafc 100%);
}

.task-card.claimable {
  border-left-color: #3b82f6;
  background: linear-gradient(90deg, #eff6ff 0%, #f8fafc 100%);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.2);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
  }
}

.task-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-name {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
  border-radius: 3px;
  transition: width 0.5s ease;
}

.task-card.completed .progress-fill {
  background: linear-gradient(90deg, #22c55e 0%, #4ade80 100%);
}

.progress-text {
  font-size: 12px;
  color: #64748b;
  flex-shrink: 0;
}

.task-status {
  font-size: 11px;
  color: #22c55e;
  margin-top: 4px;
}

.task-status.claimable-text {
  color: #3b82f6;
  font-weight: 500;
}

.task-reward {
  font-size: 13px;
  font-weight: 600;
  color: #3b82f6;
  padding: 6px 12px;
  background: #eff6ff;
  border-radius: 8px;
  flex-shrink: 0;
}

.task-reward.completed {
  color: #22c55e;
  background: #dcfce7;
}

.task-reward.claimable {
  color: #fff;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  animation: glow 2s infinite;
}

@keyframes glow {
  0%, 100% {
    box-shadow: 0 0 5px rgba(59, 130, 246, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.8);
  }
}
</style>
