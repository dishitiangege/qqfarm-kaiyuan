<template>
  <div class="collapsible-section" :class="{ 'is-expanded': isExpanded }">
    <!-- 标题栏 -->
    <div class="section-header" @click="toggle">
      <div class="section-title-wrapper">
        <span class="section-icon">{{ icon }}</span>
        <div class="section-title-group">
          <h3 class="section-title">{{ title }}</h3>
          <span v-if="subtitle" class="section-subtitle">{{ subtitle }}</span>
        </div>
      </div>
      <div class="section-actions">
        <!-- 插槽：可以在标题右侧添加内容 -->
        <slot name="header-action"></slot>
        <!-- 折叠箭头 -->
        <div class="expand-icon" :class="{ 'is-expanded': isExpanded }">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="section-content" :class="{ 'is-expanded': isExpanded }">
      <div class="section-content-inner">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  title: string;
  subtitle?: string;
  icon?: string;
  defaultExpanded?: boolean;
  storageKey?: string; // 用于记忆状态的localStorage key
}>();

// 从localStorage读取状态或使用默认值
const getInitialState = () => {
  if (props.storageKey) {
    const saved = localStorage.getItem(`collapsible_${props.storageKey}`);
    if (saved !== null) {
      return saved === 'true';
    }
  }
  return props.defaultExpanded !== false;
};

const isExpanded = ref(getInitialState());

const toggle = () => {
  isExpanded.value = !isExpanded.value;
  // 保存状态到localStorage
  if (props.storageKey) {
    localStorage.setItem(`collapsible_${props.storageKey}`, String(isExpanded.value));
  }
};

// 监听defaultExpanded变化
watch(() => props.defaultExpanded, (newVal) => {
  if (newVal !== undefined) {
    isExpanded.value = newVal;
  }
});
</script>

<style scoped>
.collapsible-section {
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  transition: all 0.3s ease;
}

.collapsible-section.is-expanded {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

/* 标题栏 */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

@media (min-width: 768px) {
  .section-header {
    padding: 16px 20px;
  }
}

.section-header:hover {
  background-color: #f8fafc;
}

.section-header:active {
  background-color: #f1f5f9;
}

.section-title-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.section-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.section-title-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.section-subtitle {
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

/* 折叠箭头 */
.expand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  transition: transform 0.3s ease, color 0.2s ease;
  flex-shrink: 0;
}

.expand-icon.is-expanded {
  transform: rotate(180deg);
  color: #3b82f6;
}

/* 内容区域 */
.section-content {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s ease;
}

.section-content.is-expanded {
  grid-template-rows: 1fr;
}

.section-content-inner {
  overflow: hidden;
  padding: 0 16px;
}

.section-content.is-expanded .section-content-inner {
  padding-bottom: 16px;
}

@media (min-width: 768px) {
  .section-content-inner {
    padding: 0 20px;
  }

  .section-content.is-expanded .section-content-inner {
    padding-bottom: 20px;
  }
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .collapsible-section {
    background: #1e293b;
    border-color: #334155;
  }

  .section-header:hover {
    background-color: #334155;
  }

  .section-header:active {
    background-color: #475569;
  }

  .section-title {
    color: #f1f5f9;
  }

  .section-subtitle {
    color: #94a3b8;
  }

  .expand-icon {
    color: #64748b;
  }

  .expand-icon.is-expanded {
    color: #60a5fa;
  }
}

/* 移动端优化 */
@media (max-width: 640px) {
  .section-title {
    font-size: 15px;
  }

  .section-icon {
    font-size: 18px;
  }
}
</style>
