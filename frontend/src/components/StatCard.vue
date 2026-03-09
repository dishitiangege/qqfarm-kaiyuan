<template>
  <div class="stat-card" :class="{ 'has-gradient': gradient }">
    <div class="card-background" v-if="gradient" :style="gradientStyle"></div>
    <div class="card-content">
      <div class="card-header">
        <div class="icon-wrapper" :style="{ background: iconBg }">
          <slot name="icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
            </svg>
          </slot>
        </div>
        <span class="label">{{ label }}</span>
      </div>
      <div class="value-wrapper">
        <span class="value" :style="{ color: valueColor }">{{ value }}</span>
        <span class="unit" v-if="unit">{{ unit }}</span>
      </div>
      <div class="hint" v-if="hint">{{ hint }}</div>
    </div>
    <div class="card-decoration" v-if="showDecoration">
      <div class="circle circle-1"></div>
      <div class="circle circle-2"></div>
      <div class="circle circle-3"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  valueColor?: string;
  iconBg?: string;
  gradient?: boolean;
  gradientColors?: string[];
  showDecoration?: boolean;
}>();

const gradientStyle = computed(() => {
  if (!props.gradientColors || props.gradientColors.length < 2) {
    return {};
  }
  return {
    background: `linear-gradient(135deg, ${props.gradientColors[0]} 0%, ${props.gradientColors[1]} 100%)`
  };
});
</script>

<style scoped>
.stat-card {
  position: relative;
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.stat-card.has-gradient {
  color: #1e293b;
}

.card-background {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.card-content {
  position: relative;
  z-index: 1;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.icon-wrapper {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.label {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
}

.stat-card.has-gradient .label {
  color: rgba(30, 41, 59, 0.8);
}

.value-wrapper {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

.value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.unit {
  font-size: 13px;
  color: #94a3b8;
  font-weight: 500;
}

.stat-card.has-gradient .unit {
  color: rgba(30, 41, 59, 0.6);
}

.hint {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 8px;
}

.stat-card.has-gradient .hint {
  color: rgba(30, 41, 59, 0.6);
}

.card-decoration {
  position: absolute;
  top: 0;
  right: 0;
  width: 100px;
  height: 100px;
  pointer-events: none;
}

.circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.1;
}

.circle-1 {
  width: 80px;
  height: 80px;
  top: -20px;
  right: -20px;
  background: currentColor;
}

.circle-2 {
  width: 60px;
  height: 60px;
  top: 10px;
  right: 10px;
  background: currentColor;
}

.circle-3 {
  width: 40px;
  height: 40px;
  top: 30px;
  right: 30px;
  background: currentColor;
}

@media (max-width: 768px) {
  .stat-card {
    padding: 16px;
  }

  .value {
    font-size: clamp(20px, 5vw, 26px);
  }
}

@media (max-width: 480px) {
  .value {
    font-size: clamp(18px, 5.5vw, 22px);
  }
}
</style>
