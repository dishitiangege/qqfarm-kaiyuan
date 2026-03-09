<template>
  <div class="card">
    <div class="card-content">
      <div class="card-header">
        <slot name="icon"></slot>
        <div class="card-title-wrapper">
          <span class="card-title">{{ title }}</span>
          <span v-if="subtitle" class="card-subtitle">{{ subtitle }}</span>
        </div>
      </div>
      <div class="card-body">
        <slot></slot>
      </div>
    </div>
    <div class="card-action">
      <slot name="action"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>

<style scoped>
.card {
  width: 100%;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  box-shadow: 
    0 1px 3px rgba(0, 0, 0, 0.02),
    0 4px 12px rgba(0, 0, 0, 0.04);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 
    0 4px 6px rgba(0, 0, 0, 0.03),
    0 10px 20px rgba(0, 0, 0, 0.06);
  border-color: #cbd5e1;
}

.card:hover::before {
  opacity: 1;
}

.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-title-wrapper {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.4;
}

.card-subtitle {
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
}

.card-body {
  margin-top: 4px;
}

.card-action {
  flex-shrink: 0;
}
</style>
