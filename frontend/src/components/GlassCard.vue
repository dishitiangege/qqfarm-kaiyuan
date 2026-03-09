<template>
  <div class="glass-card" :class="{ 'glass-card--hover': hover, 'glass-card--glow': glow }">
    <div v-if="title || $slots.header" class="glass-card__header">
      <div class="glass-card__title">
        <span v-if="icon" class="glass-card__icon">{{ icon }}</span>
        <span class="glass-card__title-text">{{ title }}</span>
      </div>
      <div v-if="$slots.header" class="glass-card__header-extra">
        <slot name="header"></slot>
      </div>
    </div>
    <div class="glass-card__body">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  icon?: string;
  hover?: boolean;
  glow?: boolean;
}>();
</script>

<style scoped>
.glass-card {
  position: relative;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 20px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

@media (min-width: 1024px) {
  .glass-card {
    padding: 24px;
  }
}

.glass-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.4) 0%,
    rgba(255, 255, 255, 0.1) 100%
  );
  border-radius: 20px;
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
}

.glass-card--hover:hover {
  transform: translateY(-4px);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.glass-card--hover:hover::before {
  opacity: 1;
}

.glass-card--glow {
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.06),
    0 0 60px rgba(34, 197, 94, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.glass-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.glass-card__title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.glass-card__icon {
  font-size: 20px;
}

.glass-card__title-text {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.glass-card__header-extra {
  display: flex;
  align-items: center;
  gap: 8px;
}

.glass-card__body {
  position: relative;
  z-index: 1;
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .glass-card {
    background: rgba(30, 41, 59, 0.7);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .glass-card__title-text {
    color: #f1f5f9;
  }

  .glass-card__header {
    border-bottom-color: rgba(255, 255, 255, 0.1);
  }
}
</style>
