<template>
  <div class="log-item" :class="`log-level-${level}`">
    <div class="log-glow"></div>
    <div class="log-content">
      <div class="log-time">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        {{ time }}
      </div>
      <div class="log-badges">
        <span v-if="module" class="log-badge log-badge-module" :style="{ background: getModuleGradient(module) }">
          {{ moduleIcon }} {{ moduleLabel }}
        </span>
        <span v-if="level" class="log-badge log-badge-level" :style="{ background: getLevelGradient(level) }">
          {{ levelLabel }}
        </span>
      </div>
      <div class="log-message">{{ message }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  time: string;
  module?: string;
  moduleIcon?: string;
  moduleLabel?: string;
  level?: string;
  levelLabel?: string;
  message: string;
}>();

const getModuleGradient = (module: string) => {
  const gradients: Record<string, string> = {
    'farm': 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    'friend': 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    'task': 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    'shop': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    'system': 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
  };
  return gradients[module] || gradients['system'];
};

const getLevelGradient = (level: string) => {
  const gradients: Record<string, string> = {
    'info': 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    'success': 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    'warning': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    'error': 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  };
  return gradients[level] || gradients['info'];
};
</script>

<style scoped>
.log-item {
  position: relative;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 6px;
  border-left: 3px solid #e2e8f0;
  transition: all 0.3s ease;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.log-item:hover {
  transform: translateX(4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.log-glow {
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.log-level-info {
  border-left-color: #3b82f6;
}

.log-level-success {
  border-left-color: #22c55e;
}

.log-level-warning {
  border-left-color: #f59e0b;
}

.log-level-error {
  border-left-color: #ef4444;
}

.log-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.log-time {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #94a3b8;
  white-space: nowrap;
  flex-shrink: 0;
}

.log-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.log-badge {
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 600;
  color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  white-space: nowrap;
}

.log-message {
  font-size: 13px;
  color: #334155;
  line-height: 1.5;
  word-break: break-word;
  flex: 1;
  min-width: 200px;
}
</style>
