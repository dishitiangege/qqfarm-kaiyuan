<template>
  <div class="parent" @mousemove="handleMouseMove" @mouseleave="handleMouseLeave">
    <div class="card" :style="cardStyle" :class="`card-${variant}`">
      <div class="glass"></div>
      <div class="content">
        <span class="title">{{ title }}</span>
        <span class="text">{{ description }}</span>
      </div>
      <div class="bottom">
        <div class="social-buttons-container">
          <slot name="actions"></slot>
        </div>
        <div class="view-more" v-if="showMore">
          <button class="view-more-button">{{ moreText }}</button>
          <svg class="svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
            <path d="m6 9 6 6 6-6"></path>
          </svg>
        </div>
      </div>
      <div class="logo">
        <span class="circle circle1"></span>
        <span class="circle circle2"></span>
        <span class="circle circle3"></span>
        <span class="circle circle4"></span>
        <span class="circle circle5">
          <slot name="icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="svg" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
            </svg>
          </slot>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  title: string;
  description?: string;
  showMore?: boolean;
  moreText?: string;
  variant?: 'level' | 'coin' | 'exp' | 'time' | 'default';
}>();

const rotateX = ref(0);
const rotateY = ref(0);
const isHovering = ref(false);

const cardStyle = computed(() => {
  if (!isHovering.value) {
    return {
      transform: 'rotate3d(1, 1, 0, 0deg)',
      boxShadow: 'rgba(0, 0, 0, 0.1) 0px 10px 30px -10px, rgba(0, 0, 0, 0.1) 0px 5px 15px -5px'
    };
  }
  return {
    transform: `rotate3d(1, 1, 0, ${rotateX.value}deg)`,
    boxShadow: 'rgba(0, 0, 0, 0.15) 0px 20px 40px -10px, rgba(0, 0, 0, 0.1) 0px 10px 20px -5px'
  };
});

const handleMouseMove = (e: MouseEvent) => {
  const card = e.currentTarget as HTMLElement;
  const rect = card.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  
  rotateX.value = ((y - centerY) / centerY) * -20;
  rotateY.value = ((x - centerX) / centerX) * 20;
  isHovering.value = true;
};

const handleMouseLeave = () => {
  isHovering.value = false;
  rotateX.value = 0;
  rotateY.value = 0;
};
</script>

<style scoped>
.parent {
  width: 100%;
  height: 100%;
  perspective: 1000px;
}

.card {
  height: 100%;
  min-height: 200px;
  border-radius: 24px;
  transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
  transform-style: preserve-3d;
  position: relative;
  overflow: hidden;
}

/* 等级卡片 - 金色渐变 */
.card-level {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%);
  box-shadow: 
    0 10px 30px -10px rgba(245, 158, 11, 0.4),
    0 5px 15px -5px rgba(245, 158, 11, 0.2);
}

/* 金币卡片 - 绿色渐变 */
.card-coin {
  background: linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%);
  box-shadow: 
    0 10px 30px -10px rgba(16, 185, 129, 0.4),
    0 5px 15px -5px rgba(16, 185, 129, 0.2);
}

/* 经验进度卡片 - 蓝色渐变 */
.card-exp {
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%);
  box-shadow: 
    0 10px 30px -10px rgba(59, 130, 246, 0.4),
    0 5px 15px -5px rgba(59, 130, 246, 0.2);
}

/* 在线时长卡片 - 紫色渐变 */
.card-time {
  background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 50%, #7c3aed 100%);
  box-shadow: 
    0 10px 30px -10px rgba(139, 92, 246, 0.4),
    0 5px 15px -5px rgba(139, 92, 246, 0.2);
}

/* 默认卡片 - 青绿色渐变 */
.card-default {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  box-shadow: 
    0 10px 30px -10px rgba(22, 163, 74, 0.4),
    0 5px 15px -5px rgba(22, 163, 74, 0.2);
}

.glass {
  transform-style: preserve-3d;
  position: absolute;
  inset: 8px;
  border-radius: 20px;
  border-top-right-radius: 100%;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.1) 100%);
  transform: translate3d(0px, 0px, 25px);
  border-left: 1px solid rgba(255, 255, 255, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.5);
  transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
}

.content {
  padding: 80px 40px 0px 24px;
  transform: translate3d(0, 0, 26px);
  position: relative;
  z-index: 1;
}

.content .title {
  display: block;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 700;
  font-size: 16px;
  margin-bottom: 8px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.content .text {
  display: block;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  line-height: 1.4;
}

.bottom {
  padding: 10px 12px;
  transform-style: preserve-3d;
  position: absolute;
  bottom: 16px;
  left: 16px;
  right: 16px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  transform: translate3d(0, 0, 26px);
}

.bottom .view-more {
  display: flex;
  align-items: center;
  width: 40%;
  justify-content: flex-end;
  transition: all 0.2s ease-in-out;
}

.bottom .view-more:hover {
  transform: translate3d(0, 0, 10px);
}

.bottom .view-more .view-more-button {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
}

.bottom .view-more .svg {
  fill: none;
  stroke: rgba(255, 255, 255, 0.9);
  stroke-width: 3px;
  max-height: 15px;
  width: 15px;
}

.bottom .social-buttons-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  transform-style: preserve-3d;
  width: 100%;
}

.bottom .social-buttons-container :deep(*) {
  color: white;
  font-size: 24px;
  font-weight: 700;
}

.logo {
  position: absolute;
  right: 0;
  top: 0;
  transform-style: preserve-3d;
}

.logo .circle {
  display: block;
  position: absolute;
  aspect-ratio: 1;
  border-radius: 50%;
  top: 0;
  right: 0;
  box-shadow: rgba(0, 0, 0, 0.1) -5px 5px 15px 0px;
  backdrop-filter: blur(5px);
  transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
}

/* 等级卡片圆圈 */
.card-level .logo .circle {
  background: rgba(251, 191, 36, 0.25);
}

/* 金币卡片圆圈 */
.card-coin .logo .circle {
  background: rgba(52, 211, 153, 0.25);
}

/* 经验进度卡片圆圈 */
.card-exp .logo .circle {
  background: rgba(96, 165, 250, 0.25);
}

/* 在线时长卡片圆圈 */
.card-time .logo .circle {
  background: rgba(167, 139, 250, 0.25);
}

/* 默认卡片圆圈 */
.card-default .logo .circle {
  background: rgba(34, 197, 94, 0.2);
}

.logo .circle1 {
  width: 100px;
  transform: translate3d(0, 0, 20px);
  top: -20px;
  right: -20px;
}

.logo .circle2 {
  width: 80px;
  transform: translate3d(0, 0, 40px);
  top: -10px;
  right: -10px;
  backdrop-filter: blur(1px);
  transition-delay: 0.1s;
}

.logo .circle3 {
  width: 60px;
  transform: translate3d(0, 0, 60px);
  top: 0px;
  right: 0px;
  transition-delay: 0.2s;
}

.logo .circle4 {
  width: 45px;
  transform: translate3d(0, 0, 80px);
  top: 8px;
  right: 8px;
  transition-delay: 0.3s;
}

.logo .circle5 {
  width: 32px;
  transform: translate3d(0, 0, 100px);
  top: 14px;
  right: 14px;
  display: grid;
  place-content: center;
  transition-delay: 0.4s;
  background: rgba(255, 255, 255, 0.3);
}

.logo .circle5 .svg {
  width: 20px;
  height: 20px;
  color: white;
}

.parent:hover .card {
  transform: rotate3d(1, 1, 0, 15deg);
}

.parent:hover .card .glass {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.2) 100%);
}

.parent:hover .card .bottom .social-buttons-container :deep(*) {
  transform: translate3d(0, 0, 50px);
}

.parent:hover .card .logo .circle2 {
  transform: translate3d(0, 0, 60px);
}

.parent:hover .card .logo .circle3 {
  transform: translate3d(0, 0, 80px);
}

.parent:hover .card .logo .circle4 {
  transform: translate3d(0, 0, 100px);
}

.parent:hover .card .logo .circle5 {
  transform: translate3d(0, 0, 120px);
}
</style>
