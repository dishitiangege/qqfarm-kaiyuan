<template>
  <div class="slider-container">
    <!-- 标题和数值在同一行 -->
    <div class="slider-header">
      <label v-if="label" class="slider-label">{{ label }}</label>
      <div class="slider-value">
        <input
          type="number"
          class="value-input"
          :min="min"
          :max="max"
          :value="modelValue"
          @input="handleNumberInput"
        />
        <span class="unit">{{ unit }}</span>
      </div>
    </div>
    <!-- 滑块单独一行 -->
    <div class="slider-wrapper">
      <label class="slider">
        <input
          type="range"
          class="level"
          :min="min"
          :max="max"
          :step="step"
          :value="modelValue"
          @input="handleInput"
        />
      </label>
    </div>
    <div v-if="hint" class="slider-hint">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  unit?: string;
  hint?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void;
}>();

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', Number(target.value));
};

const handleNumberInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  let value = Number(target.value);
  // 限制在最小值和最大值之间
  if (props.min !== undefined && value < props.min) {
    value = props.min;
  }
  if (props.max !== undefined && value > props.max) {
    value = props.max;
  }
  emit('update:modelValue', value);
};
</script>

<style scoped>
.slider-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 标题和数值行 */
.slider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.slider-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.slider-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  flex-shrink: 0;
}

.value-input {
  width: 60px;
  padding: 4px 8px;
  font-size: 14px;
  font-weight: 600;
  color: #22c55e;
  border: 2px solid #e2e8f0;
  border-radius: 6px;
  text-align: center;
  outline: none;
  transition: border-color 0.2s;
}

.value-input:focus {
  border-color: #22c55e;
}

.value-input::-webkit-inner-spin-button,
.value-input::-webkit-outer-spin-button {
  opacity: 1;
  height: 20px;
}

.unit {
  font-size: 12px;
  color: #64748b;
}

/* 滑块行 */
.slider-wrapper {
  display: flex;
  align-items: center;
  width: 100%;
}

.slider {
  --slider-width: 100%;
  --slider-height: 12px;
  --slider-bg: rgba(148, 163, 184, 0.3);
  --slider-border-radius: 6px;
  --level-color: #22c55e;
  --level-transition-duration: 0.3s;

  position: relative;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  width: 100%;
}

.slider .level {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  width: var(--slider-width);
  height: var(--slider-height);
  background: var(--slider-bg);
  overflow: hidden;
  border-radius: var(--slider-border-radius);
  transition: height var(--level-transition-duration);
  cursor: inherit;
  margin: 0;
  box-sizing: border-box;
}

.slider .level::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 0px;
  height: 0px;
  box-shadow:
    -100px 0 5px 100px var(--level-color),
    -100px 0px 10px 100px var(--level-color);
}

.slider .level::-moz-range-thumb {
  width: 0;
  height: 0;
  border-radius: 0;
  border: none;
  box-shadow:
    -100px 0 5px 100px var(--level-color),
    -100px 0px 10px 100px var(--level-color);
}

.slider-hint {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .slider-label {
    color: #e2e8f0;
  }

  .slider {
    --slider-bg: rgba(71, 85, 105, 0.5);
  }

  .value-input {
    color: #4ade80;
    background: #1e293b;
    border-color: #475569;
  }

  .unit {
    color: #94a3b8;
  }

  .slider-hint {
    color: #64748b;
  }
}
</style>
