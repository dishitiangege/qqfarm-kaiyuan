<template>
  <div class="slider-container">
    <label v-if="label" class="slider-label">{{ label }}</label>
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
        <svg
          class="volume-icon"
          xmlns="http://www.w3.org/2000/svg"
          version="1.1"
          viewBox="0 0 24 24"
        >
          <g>
            <path
              d="M18.36 19.36a1 1 0 0 1-.705-1.71C19.167 16.148 20 14.142 20 12s-.833-4.148-2.345-5.65a1 1 0 1 1 1.41-1.419C20.958 6.812 22 9.322 22 12s-1.042 5.188-2.935 7.069a.997.997 0 0 1-.705.291z"
              fill="currentColor"
            ></path>
            <path
              d="M15.53 16.53a.999.999 0 0 1-.703-1.711C15.572 14.082 16 13.054 16 12s-.428-2.082-1.173-2.819a1 1 0 1 1 1.406-1.422A6 6 0 0 1 18 12a6 6 0 0 1-1.767 4.241.996.996 0 0 1-.703.289zM12 22a1 1 0 0 1-.707-.293L6.586 17H4c-1.103 0-2-.897-2-2V9c0-1.103.897-2 2-2h2.586l4.707-4.707A.998.998 0 0 1 13 3v18a1 1 0 0 1-1 1z"
              fill="currentColor"
            ></path>
          </g>
        </svg>
      </label>
      <div class="slider-value">
        <span class="value">{{ modelValue }}</span>
        <span class="unit">{{ unit }}</span>
      </div>
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
</script>

<style scoped>
.slider-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.slider-label {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.slider-wrapper {
  display: flex;
  align-items: center;
  gap: 16px;
}

.slider {
  --slider-width: 200px;
  --slider-height: 12px;
  --slider-bg: rgba(148, 163, 184, 0.3);
  --slider-border-radius: 6px;
  --level-color: #22c55e;
  --level-transition-duration: 0.3s;
  --icon-margin: 12px;
  --icon-color: #94a3b8;
  --icon-size: 24px;
  
  position: relative;
  cursor: pointer;
  display: inline-flex;
  flex-direction: row-reverse;
  align-items: center;
}

.volume-icon {
  display: inline-block;
  vertical-align: top;
  margin-right: var(--icon-margin);
  color: var(--icon-color);
  width: var(--icon-size);
  height: var(--icon-size);
  position: absolute;
  left: 12px;
  pointer-events: none;
  transition: color 0.3s ease;
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

.slider .level:hover ~ .volume-icon {
  color: var(--level-color);
}

.slider-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  min-width: 60px;
}

.value {
  font-size: 18px;
  font-weight: 700;
  color: #22c55e;
}

.unit {
  font-size: 12px;
  color: #64748b;
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
    --icon-color: #64748b;
  }
  
  .value {
    color: #4ade80;
  }
  
  .unit {
    color: #94a3b8;
  }
  
  .slider-hint {
    color: #64748b;
  }
}
</style>
