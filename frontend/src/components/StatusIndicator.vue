<template>
  <div class="status-container" :class="{ 'status-running': isRunning }">
    <div class="status-dot"></div>
    <span class="status-text">{{ isRunning ? '运行中' : '已停止' }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isRunning: boolean;
}>();
</script>

<style scoped>
.status-container {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  transition: all 0.3s ease;
}

.status-container.status-running {
  background: #dcfce7;
  border-color: #86efac;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
  transition: all 0.3s ease;
}

.status-running .status-dot {
  background: #22c55e;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
  }
  50% {
    opacity: 0.8;
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0);
  }
}

.status-text {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  transition: all 0.3s ease;
}

.status-running .status-text {
  color: #166534;
}
</style>
