<template>
  <label class="neon-checkbox" :class="{ 'is-checked': modelValue }">
    <input 
      type="checkbox" 
      :checked="modelValue"
      @change="$emit('update:modelValue', !modelValue)"
    />
    <div class="neon-checkbox__frame">
      <div class="neon-checkbox__box">
        <div class="neon-checkbox__check-container">
          <svg viewBox="0 0 24 24" class="neon-checkbox__check">
            <path d="M3,12.5l7,7L21,5"></path>
          </svg>
        </div>
        <div class="neon-checkbox__glow"></div>
        <div class="neon-checkbox__borders">
          <span></span><span></span><span></span><span></span>
        </div>
      </div>
      <div class="neon-checkbox__effects">
        <div class="neon-checkbox__particles">
          <span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span>
        </div>
        <div class="neon-checkbox__rings">
          <div class="ring"></div>
          <div class="ring"></div>
          <div class="ring"></div>
        </div>
        <div class="neon-checkbox__sparks">
          <span></span><span></span><span></span><span></span>
        </div>
      </div>
    </div>
    <span v-if="label" class="checkbox-label">{{ label }}</span>
  </label>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: boolean | undefined;
  label?: string;
}>();

defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();
</script>

<style scoped>
.neon-checkbox {
  --primary: #22c55e;
  --primary-dark: #16a34a;
  --primary-light: #86efac;
  --size: 28px;
  position: relative;
  width: var(--size);
  height: var(--size);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.neon-checkbox input {
  display: none;
}

.neon-checkbox__frame {
  position: relative;
  width: 100%;
  height: 100%;
}

.neon-checkbox__box {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 6px;
  border: 2px solid #d1d5db;
  transition: all 0.4s ease;
}

.neon-checkbox__check-container {
  position: absolute;
  inset: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.neon-checkbox__check {
  width: 80%;
  height: 80%;
  fill: none;
  stroke: white;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 40;
  stroke-dashoffset: 40;
  transform-origin: center;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.neon-checkbox__glow {
  position: absolute;
  inset: -2px;
  border-radius: 8px;
  background: var(--primary);
  opacity: 0;
  filter: blur(8px);
  transform: scale(1.2);
  transition: all 0.4s ease;
}

.neon-checkbox__borders {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  overflow: hidden;
}

.neon-checkbox__borders span {
  position: absolute;
  width: 40px;
  height: 2px;
  background: var(--primary);
  opacity: 0;
  transition: opacity 0.4s ease;
}

.neon-checkbox__borders span:nth-child(1) {
  top: 0;
  left: -100%;
  animation: borderFlow1 2s linear infinite;
}

.neon-checkbox__borders span:nth-child(2) {
  top: -100%;
  right: 0;
  width: 2px;
  height: 40px;
  animation: borderFlow2 2s linear infinite;
}

.neon-checkbox__borders span:nth-child(3) {
  bottom: 0;
  right: -100%;
  animation: borderFlow3 2s linear infinite;
}

.neon-checkbox__borders span:nth-child(4) {
  bottom: -100%;
  left: 0;
  width: 2px;
  height: 40px;
  animation: borderFlow4 2s linear infinite;
}

.neon-checkbox__particles span {
  position: absolute;
  width: 3px;
  height: 3px;
  background: var(--primary);
  border-radius: 50%;
  opacity: 0;
  pointer-events: none;
  top: 50%;
  left: 50%;
  box-shadow: 0 0 4px var(--primary);
}

.neon-checkbox__rings {
  position: absolute;
  inset: -15px;
  pointer-events: none;
}

.neon-checkbox__rings .ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid var(--primary);
  opacity: 0;
  transform: scale(0);
}

.neon-checkbox__sparks span {
  position: absolute;
  width: 15px;
  height: 1px;
  background: linear-gradient(90deg, var(--primary), transparent);
  opacity: 0;
}

/* Hover Effects */
.neon-checkbox:hover .neon-checkbox__box {
  border-color: var(--primary-dark);
  transform: scale(1.05);
}

/* Checked State */
.neon-checkbox.is-checked .neon-checkbox__box {
  border-color: var(--primary);
  background: var(--primary);
}

.neon-checkbox.is-checked .neon-checkbox__check {
  stroke-dashoffset: 0;
  transform: scale(1.1);
}

.neon-checkbox.is-checked .neon-checkbox__glow {
  opacity: 0.3;
}

.neon-checkbox.is-checked .neon-checkbox__borders span {
  opacity: 1;
}

/* Particle Animations */
.neon-checkbox.is-checked .neon-checkbox__particles span {
  animation: particleExplosion 0.6s ease-out forwards;
}

.neon-checkbox.is-checked .neon-checkbox__rings .ring {
  animation: ringPulse 0.6s ease-out forwards;
}

.neon-checkbox.is-checked .neon-checkbox__sparks span {
  animation: sparkFlash 0.6s ease-out forwards;
}

/* Animations */
@keyframes borderFlow1 {
  0% { transform: translateX(0); }
  100% { transform: translateX(200%); }
}

@keyframes borderFlow2 {
  0% { transform: translateY(0); }
  100% { transform: translateY(200%); }
}

@keyframes borderFlow3 {
  0% { transform: translateX(0); }
  100% { transform: translateX(-200%); }
}

@keyframes borderFlow4 {
  0% { transform: translateY(0); }
  100% { transform: translateY(-200%); }
}

@keyframes particleExplosion {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  100% {
    transform: translate(calc(-50% + var(--x, 20px)), calc(-50% + var(--y, 20px))) scale(0);
    opacity: 0;
  }
}

@keyframes ringPulse {
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

@keyframes sparkFlash {
  0% {
    transform: rotate(var(--r, 0deg)) translateX(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: rotate(var(--r, 0deg)) translateX(25px) scale(0);
    opacity: 0;
  }
}

/* Particle Positions */
.neon-checkbox__particles span:nth-child(1) { --x: 20px; --y: -20px; }
.neon-checkbox__particles span:nth-child(2) { --x: -20px; --y: -20px; }
.neon-checkbox__particles span:nth-child(3) { --x: 20px; --y: 20px; }
.neon-checkbox__particles span:nth-child(4) { --x: -20px; --y: 20px; }
.neon-checkbox__particles span:nth-child(5) { --x: 28px; --y: 0px; }
.neon-checkbox__particles span:nth-child(6) { --x: -28px; --y: 0px; }
.neon-checkbox__particles span:nth-child(7) { --x: 0px; --y: 28px; }
.neon-checkbox__particles span:nth-child(8) { --x: 0px; --y: -28px; }
.neon-checkbox__particles span:nth-child(9) { --x: 15px; --y: -25px; }
.neon-checkbox__particles span:nth-child(10) { --x: -15px; --y: 25px; }
.neon-checkbox__particles span:nth-child(11) { --x: 25px; --y: 15px; }
.neon-checkbox__particles span:nth-child(12) { --x: -25px; --y: -15px; }

/* Spark Rotations */
.neon-checkbox__sparks span:nth-child(1) { --r: 0deg; top: 50%; left: 50%; }
.neon-checkbox__sparks span:nth-child(2) { --r: 90deg; top: 50%; left: 50%; }
.neon-checkbox__sparks span:nth-child(3) { --r: 180deg; top: 50%; left: 50%; }
.neon-checkbox__sparks span:nth-child(4) { --r: 270deg; top: 50%; left: 50%; }

/* Ring Delays */
.neon-checkbox__rings .ring:nth-child(1) { animation-delay: 0s; }
.neon-checkbox__rings .ring:nth-child(2) { animation-delay: 0.1s; }
.neon-checkbox__rings .ring:nth-child(3) { animation-delay: 0.2s; }

/* Label */
.checkbox-label {
  font-size: 14px;
  color: #374151;
  user-select: none;
}
</style>
