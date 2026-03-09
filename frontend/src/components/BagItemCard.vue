<template>
  <div 
    class="bag-item-card"
    :class="{ 
      'bag-item-card--selected': selected,
      'bag-item-card--selectable': selectable,
      [`bag-item-card--${variant}`]: true
    }"
    @click="$emit('click')"
  >
    <!-- 选择标记 -->
    <div v-if="selectable" class="bag-item-card__checkbox">
      <svg v-if="selected" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </div>
    
    <!-- 物品图标 -->
    <div class="bag-item-card__icon">
      <img
        v-if="icon"
        :src="icon"
        :alt="name"
        @error="$emit('image-error', $event)"
      >
      <span v-else class="bag-item-card__emoji">{{ emoji }}</span>
    </div>
    
    <!-- 物品信息 -->
    <div class="bag-item-card__info">
      <div class="bag-item-card__name">{{ name }}</div>
      <div v-if="timeInfo" class="bag-item-card__time">{{ timeInfo }}</div>
      <div class="bag-item-card__count">x{{ count }}</div>
    </div>
    
    <!-- 可出售标记 -->
    <div v-if="showSellable && !selectable" class="bag-item-card__badge">
      可出售
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  name: string;
  count: number;
  icon?: string;
  emoji?: string;
  timeInfo?: string | null;
  selected?: boolean;
  selectable?: boolean;
  showSellable?: boolean;
  variant?: 'special' | 'fruit' | 'other';
}>();

defineEmits<{
  (e: 'click'): void;
  (e: 'image-error', event: Event): void;
}>();
</script>

<style scoped>
.bag-item-card {
  position: relative;
  border-radius: 16px;
  padding: 16px;
  text-align: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  border: 1px solid transparent;
  overflow: hidden;
}

.bag-item-card--special {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-color: #bae6fd;
}

.bag-item-card--fruit {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border-color: #86efac;
}

.bag-item-card--other {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-color: #e2e8f0;
}

.bag-item-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}

.bag-item-card--special:hover {
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
  border-color: #7dd3fc;
}

.bag-item-card--fruit:hover {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  border-color: #4ade80;
}

.bag-item-card--other:hover {
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  border-color: #cbd5e1;
}

.bag-item-card--selected {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%) !important;
  border-color: #22c55e !important;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
}

.bag-item-card--selectable {
  cursor: pointer;
}

.bag-item-card__checkbox {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid #22c55e;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.bag-item-card--selected .bag-item-card__checkbox {
  background: #22c55e;
  border-color: #22c55e;
}

.bag-item-card__checkbox svg {
  width: 12px;
  height: 12px;
}

.bag-item-card__icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 12px;
  padding: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.bag-item-card__icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.bag-item-card__emoji {
  font-size: 36px;
  line-height: 1;
}

.bag-item-card__info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bag-item-card__name {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bag-item-card__time {
  font-size: 11px;
  font-weight: 600;
  color: #f59e0b;
  background: #fffbeb;
  padding: 2px 8px;
  border-radius: 6px;
  display: inline-block;
  margin: 0 auto;
}

.bag-item-card__count {
  font-size: 18px;
  font-weight: 700;
  color: #0284c7;
  margin-top: 4px;
  margin-bottom: 20px;
}

.bag-item-card--fruit .bag-item-card__count {
  color: #16a34a;
}

.bag-item-card--other .bag-item-card__count {
  color: #3b82f6;
}

.bag-item-card__badge {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  font-weight: 600;
  color: #22c55e;
  background: rgba(220, 252, 231, 0.9);
  padding: 2px 10px;
  border-radius: 10px;
  backdrop-filter: blur(4px);
  white-space: nowrap;
}

/* 响应式适配 */
@media (max-width: 768px) {
  .bag-item-card {
    padding: 12px;
  }

  .bag-item-card__icon {
    width: 48px;
    height: 48px;
    margin-bottom: 8px;
  }

  .bag-item-card__emoji {
    font-size: 28px;
  }

  .bag-item-card__name {
    font-size: 12px;
  }

  .bag-item-card__count {
    font-size: 16px;
    margin-bottom: 18px;
  }

  .bag-item-card__badge {
    font-size: 9px;
    padding: 1px 8px;
    bottom: 6px;
  }

  .bag-item-card__checkbox {
    width: 18px;
    height: 18px;
    top: 6px;
    right: 6px;
  }

  .bag-item-card__checkbox svg {
    width: 10px;
    height: 10px;
  }
}

@media (max-width: 480px) {
  .bag-item-card {
    padding: 10px;
  }

  .bag-item-card__icon {
    width: 40px;
    height: 40px;
    margin-bottom: 6px;
    padding: 6px;
  }

  .bag-item-card__emoji {
    font-size: 24px;
  }

  .bag-item-card__name {
    font-size: 11px;
  }

  .bag-item-card__time {
    font-size: 9px;
    padding: 1px 6px;
  }

  .bag-item-card__count {
    font-size: 14px;
    margin-top: 2px;
    margin-bottom: 16px;
  }

  .bag-item-card__badge {
    font-size: 8px;
    padding: 1px 6px;
    bottom: 4px;
  }
}
</style>
