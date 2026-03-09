<template>
  <div class="toggle-container">
    <div class="toggle-wrap">
      <input 
        class="toggle-input" 
        :id="toggleId"
        type="checkbox" 
        :checked="modelValue"
        @change="$emit('update:modelValue', !modelValue)"
      />
      <label class="toggle-track" :for="toggleId">
        <div class="track-lines">
          <div class="track-line"></div>
        </div>

        <div class="toggle-thumb">
          <div class="thumb-core"></div>
          <div class="thumb-inner"></div>
          <div class="thumb-scan"></div>
          <div class="thumb-particles">
            <div class="thumb-particle"></div>
            <div class="thumb-particle"></div>
            <div class="thumb-particle"></div>
            <div class="thumb-particle"></div>
            <div class="thumb-particle"></div>
          </div>
        </div>

        <div class="toggle-data">
          <div class="data-text off">关闭</div>
          <div class="data-text on">开启</div>
          <div class="status-indicator off"></div>
          <div class="status-indicator on"></div>
        </div>

        <div class="energy-rings">
          <div class="energy-ring"></div>
          <div class="energy-ring"></div>
          <div class="energy-ring"></div>
        </div>

        <div class="interface-lines">
          <div class="interface-line"></div>
          <div class="interface-line"></div>
          <div class="interface-line"></div>
          <div class="interface-line"></div>
          <div class="interface-line"></div>
          <div class="interface-line"></div>
        </div>

        <div class="toggle-reflection"></div>
        <div class="holo-glow"></div>
      </label>
    </div>
    <div class="toggle-label" v-if="label">{{ label }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  label?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const toggleId = computed(() => `holo-toggle-${Math.random().toString(36).substr(2, 9)}`);
</script>

<style scoped>
.toggle-container {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  perspective: 800px;
  z-index: 5;
}

.toggle-wrap {
  position: relative;
  width: 110px;
  height: 44px;
  transform-style: preserve-3d;
  flex-shrink: 0;
}

.toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-track {
  position: absolute;
  width: 100%;
  height: 100%;
  background: rgba(60, 10, 10, 0.4);
  border-radius: 30px;
  cursor: pointer;
  box-shadow:
    0 0 15px rgba(255, 50, 50, 0.2),
    inset 0 0 10px rgba(0, 0, 0, 0.8);
  overflow: hidden;
  backdrop-filter: blur(5px);
  transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
  border: 1px solid rgba(255, 80, 80, 0.3);
}

.toggle-track::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(
      ellipse at center,
      rgba(255, 50, 50, 0.1) 0%,
      rgba(0, 0, 0, 0) 70%
    ),
    linear-gradient(90deg, rgba(120, 30, 30, 0.1) 0%, rgba(60, 10, 10, 0.2) 100%);
  opacity: 0.6;
  transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
}

.toggle-track::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  right: 2px;
  height: 10px;
  background: linear-gradient(
    90deg,
    rgba(255, 100, 100, 0.3) 0%,
    rgba(255, 50, 50, 0.1) 100%
  );
  border-radius: 30px 30px 0 0;
  opacity: 0.7;
  filter: blur(1px);
}

.track-lines {
  position: absolute;
  top: 50%;
  left: 0;
  width: 100%;
  height: 1px;
  transform: translateY(-50%);
  overflow: hidden;
}

.track-line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: repeating-linear-gradient(
    90deg,
    rgba(255, 100, 100, 0.3) 0px,
    rgba(255, 100, 100, 0.3) 5px,
    transparent 5px,
    transparent 15px
  );
  animation: track-line-move 3s linear infinite;
}

@keyframes track-line-move {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(20px);
  }
}

.toggle-thumb {
  position: absolute;
  width: 38px;
  height: 38px;
  left: 3px;
  top: 3px;
  background: radial-gradient(
    circle,
    rgba(90, 20, 20, 0.9) 0%,
    rgba(50, 10, 10, 0.8) 100%
  );
  border-radius: 50%;
  box-shadow:
    0 2px 10px rgba(0, 0, 0, 0.5),
    inset 0 0 10px rgba(255, 100, 100, 0.5);
  transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
  z-index: 2;
  border: 1px solid rgba(255, 120, 120, 0.6);
  overflow: hidden;
  transform-style: preserve-3d;
}

.thumb-core {
  position: absolute;
  width: 28px;
  height: 28px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: radial-gradient(
    circle,
    rgba(255, 100, 100, 0.6) 0%,
    rgba(120, 30, 30, 0.2) 100%
  );
  border-radius: 50%;
  box-shadow: 0 0 15px rgba(255, 100, 100, 0.5);
  opacity: 0.9;
  transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
}

.thumb-inner {
  position: absolute;
  width: 18px;
  height: 18px;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.8) 0%,
    rgba(255, 150, 150, 0.5) 100%
  );
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(255, 150, 150, 0.7);
  opacity: 0.7;
  transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
  animation: pulse 2s infinite alternate;
}

@keyframes pulse {
  0% {
    opacity: 0.5;
    transform: translate(-50%, -50%) scale(0.9);
  }
  100% {
    opacity: 0.8;
    transform: translate(-50%, -50%) scale(1.1);
  }
}

.thumb-scan {
  position: absolute;
  width: 100%;
  height: 3px;
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0) 0%,
    rgba(255, 100, 100, 0.5) 20%,
    rgba(255, 255, 255, 0.8) 50%,
    rgba(255, 100, 100, 0.5) 80%,
    rgba(0, 0, 0, 0) 100%
  );
  top: 0;
  left: 0;
  filter: blur(1px);
  animation: thumb-scan 2s linear infinite;
  opacity: 0.7;
}

@keyframes thumb-scan {
  0% {
    top: -5px;
    opacity: 0;
  }
  20% {
    opacity: 0.7;
  }
  80% {
    opacity: 0.7;
  }
  100% {
    top: 54px;
    opacity: 0;
  }
}

.thumb-particles {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  overflow: hidden;
}

.thumb-particle {
  position: absolute;
  width: 3px;
  height: 3px;
  background: rgba(255, 150, 150, 0.8);
  border-radius: 50%;
  box-shadow: 0 0 5px rgba(255, 150, 150, 0.8);
  animation: thumb-particle-float 3s infinite ease-out;
  opacity: 0;
}

.thumb-particle:nth-child(1) { top: 70%; left: 30%; animation-delay: 0.2s; }
.thumb-particle:nth-child(2) { top: 60%; left: 60%; animation-delay: 0.6s; }
.thumb-particle:nth-child(3) { top: 50%; left: 40%; animation-delay: 1s; }
.thumb-particle:nth-child(4) { top: 40%; left: 70%; animation-delay: 1.4s; }
.thumb-particle:nth-child(5) { top: 80%; left: 50%; animation-delay: 1.8s; }

@keyframes thumb-particle-float {
  0% {
    transform: translateY(0) scale(1);
    opacity: 0;
  }
  20% {
    opacity: 0.8;
  }
  100% {
    transform: translateY(-30px) scale(0);
    opacity: 0;
  }
}

.toggle-data {
  position: absolute;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.data-text {
  position: absolute;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0;
  transition: all 0.5s ease;
}

.data-text.off {
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 1;
  color: rgba(220, 50, 50, 0.9);
  text-shadow: 0 0 4px rgba(255, 80, 80, 0.6);
}

.data-text.on {
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  color: rgba(20, 180, 80, 0.9);
  text-shadow: 0 0 4px rgba(0, 255, 150, 0.6);
}

.status-indicator {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(255, 100, 100, 0.8) 0%,
    rgba(200, 50, 50, 0.4) 100%
  );
  box-shadow: 0 0 8px rgba(255, 80, 80, 0.5);
  animation: blink 2s infinite alternate;
  transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
}

.status-indicator.off {
  top: 18px;
  right: 12px;
}

.status-indicator.on {
  top: 18px;
  left: 12px;
  opacity: 0;
  background: radial-gradient(
    circle,
    rgba(0, 255, 150, 0.8) 0%,
    rgba(0, 200, 80, 0.4) 100%
  );
  box-shadow: 0 0 8px rgba(0, 255, 150, 0.5);
}

@keyframes blink {
  0%, 100% {
    opacity: 0.5;
    transform: scale(0.9);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

.energy-rings {
  position: absolute;
  width: 38px;
  height: 38px;
  left: 3px;
  top: 3px;
  pointer-events: none;
  z-index: 3;
  transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
}

.energy-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 2px solid transparent;
  opacity: 0;
}

.energy-ring:nth-child(1) {
  width: 36px;
  height: 36px;
  border-top-color: rgba(255, 100, 100, 0.5);
  border-right-color: rgba(255, 100, 100, 0.3);
  animation: spin 3s linear infinite;
}

.energy-ring:nth-child(2) {
  width: 28px;
  height: 28px;
  border-bottom-color: rgba(255, 100, 100, 0.5);
  border-left-color: rgba(255, 100, 100, 0.3);
  animation: spin 2s linear infinite reverse;
}

.energy-ring:nth-child(3) {
  width: 20px;
  height: 20px;
  border-left-color: rgba(255, 100, 100, 0.5);
  border-top-color: rgba(255, 100, 100, 0.3);
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  0% {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  100% {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

.interface-lines {
  position: absolute;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.interface-line {
  position: absolute;
  background: rgba(255, 100, 100, 0.3);
  transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
}

.interface-line:nth-child(1) { width: 12px; height: 1px; bottom: -4px; left: 15px; }
.interface-line:nth-child(2) { width: 1px; height: 6px; bottom: -9px; left: 26px; }
.interface-line:nth-child(3) { width: 18px; height: 1px; bottom: -9px; left: 26px; }
.interface-line:nth-child(4) { width: 12px; height: 1px; bottom: -4px; right: 15px; }
.interface-line:nth-child(5) { width: 1px; height: 6px; bottom: -9px; right: 26px; }
.interface-line:nth-child(6) { width: 18px; height: 1px; bottom: -9px; right: 8px; }

.toggle-reflection {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 255, 255, 0) 40%
  );
  border-radius: 30px;
  pointer-events: none;
}

.toggle-label {
  position: relative;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  white-space: nowrap;
  color: rgba(220, 50, 50, 1);
  text-shadow: 0 0 8px rgba(255, 80, 80, 0.6);
  transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
}

.holo-glow {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 30px;
  background: radial-gradient(
    ellipse at center,
    rgba(255, 80, 80, 0.2) 0%,
    rgba(0, 0, 0, 0) 70%
  );
  filter: blur(10px);
  opacity: 0.5;
  transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
  z-index: 0;
}

/* Checked State */
.toggle-input:checked + .toggle-track {
  background: rgba(0, 60, 30, 0.4);
  border-color: rgba(0, 255, 150, 0.3);
  box-shadow:
    0 0 15px rgba(0, 255, 150, 0.2),
    inset 0 0 10px rgba(0, 0, 0, 0.8);
}

.toggle-input:checked + .toggle-track::before {
  background: radial-gradient(
      ellipse at center,
      rgba(0, 255, 150, 0.1) 0%,
      rgba(0, 0, 0, 0) 70%
    ),
    linear-gradient(90deg, rgba(0, 120, 60, 0.1) 0%, rgba(0, 60, 30, 0.2) 100%);
}

.toggle-input:checked + .toggle-track::after {
  background: linear-gradient(
    90deg,
    rgba(0, 255, 150, 0.3) 0%,
    rgba(0, 160, 80, 0.1) 100%
  );
}

.toggle-input:checked + .toggle-track .track-line {
  background: repeating-linear-gradient(
    90deg,
    rgba(0, 255, 150, 0.3) 0px,
    rgba(0, 255, 150, 0.3) 5px,
    transparent 5px,
    transparent 15px
  );
  animation-direction: reverse;
}

.toggle-input:checked + .toggle-track .toggle-thumb {
  left: calc(100% - 41px);
  background: radial-gradient(
    circle,
    rgba(10, 90, 40, 0.9) 0%,
    rgba(0, 50, 20, 0.8) 100%
  );
  border-color: rgba(0, 255, 150, 0.6);
  box-shadow:
    0 2px 10px rgba(0, 0, 0, 0.5),
    inset 0 0 10px rgba(0, 255, 150, 0.5);
}

.toggle-input:checked + .toggle-track .thumb-core {
  background: radial-gradient(
    circle,
    rgba(0, 255, 150, 0.6) 0%,
    rgba(0, 120, 50, 0.2) 100%
  );
  box-shadow: 0 0 20px rgba(0, 255, 150, 0.5);
}

.toggle-input:checked + .toggle-track .thumb-inner {
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.8) 0%,
    rgba(100, 255, 200, 0.5) 100%
  );
  box-shadow: 0 0 10px rgba(100, 255, 200, 0.7);
}

.toggle-input:checked + .toggle-track .thumb-scan {
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 255, 150, 0.5) 20%,
    rgba(255, 255, 255, 0.8) 50%,
    rgba(0, 255, 150, 0.5) 80%,
    rgba(0, 0, 0, 0) 100%
  );
}

.toggle-input:checked + .toggle-track .thumb-particle {
  background: rgba(100, 255, 200, 0.8);
  box-shadow: 0 0 5px rgba(100, 255, 200, 0.8);
}

.toggle-input:checked + .toggle-track .data-text.off {
  opacity: 0;
}

.toggle-input:checked + .toggle-track .data-text.on {
  opacity: 1;
}

.toggle-input:checked + .toggle-track .status-indicator.off {
  opacity: 0;
}

.toggle-input:checked + .toggle-track .status-indicator.on {
  opacity: 1;
}

.toggle-input:checked + .toggle-track .energy-rings {
  left: calc(100% - 57px);
}

.toggle-input:checked + .toggle-track .energy-ring {
  opacity: 1;
}

.toggle-input:checked + .toggle-track .energy-ring:nth-child(1) {
  border-top-color: rgba(0, 255, 150, 0.5);
  border-right-color: rgba(0, 255, 150, 0.3);
}

.toggle-input:checked + .toggle-track .energy-ring:nth-child(2) {
  border-bottom-color: rgba(0, 255, 150, 0.5);
  border-left-color: rgba(0, 255, 150, 0.3);
}

.toggle-input:checked + .toggle-track .energy-ring:nth-child(3) {
  border-left-color: rgba(0, 255, 150, 0.5);
  border-top-color: rgba(0, 255, 150, 0.3);
}

.toggle-input:checked + .toggle-track .interface-line {
  background: rgba(0, 255, 150, 0.3);
}

.toggle-container:has(.toggle-input:checked) .toggle-label {
  color: rgba(20, 180, 80, 1);
  text-shadow: 0 0 8px rgba(0, 255, 150, 0.6);
}

.toggle-input:checked + .toggle-track .holo-glow {
  background: radial-gradient(
    ellipse at center,
    rgba(0, 255, 150, 0.2) 0%,
    rgba(0, 0, 0, 0) 70%
  );
}

.toggle-input:hover + .toggle-track {
  box-shadow:
    0 0 20px rgba(255, 80, 80, 0.3),
    inset 0 0 10px rgba(0, 0, 0, 0.8);
}

.toggle-input:checked:hover + .toggle-track {
  box-shadow:
    0 0 20px rgba(0, 255, 150, 0.3),
    inset 0 0 10px rgba(0, 0, 0, 0.8);
}
</style>
