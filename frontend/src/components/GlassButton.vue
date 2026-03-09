<template>
  <button
    class="glass-button"
    :class="{ 'glass-button--primary': primary, 'glass-button--danger': danger, 'glass-button--small': small }"
    @click="$emit('click')"
  >
    <span class="glass-button__icon" v-if="$slots.icon">
      <slot name="icon"></slot>
    </span>
    <span class="glass-button__text" v-if="$slots.default">
      <slot></slot>
    </span>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  primary?: boolean;
  danger?: boolean;
  small?: boolean;
}>();

defineEmits<{
  (e: 'click'): void;
}>();
</script>

<style scoped>
.glass-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  color: #64748b;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(10px);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  overflow: hidden;
}

.glass-button::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.4) 0%,
    rgba(255, 255, 255, 0.1) 100%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}

.glass-button:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  color: #475569;
}

.glass-button:hover::before {
  opacity: 1;
}

.glass-button:active {
  transform: translateY(0);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

/* Primary variant */
.glass-button--primary {
  color: #16a34a;
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.3);
}

.glass-button--primary:hover {
  color: #15803d;
  background: rgba(34, 197, 94, 0.25);
  box-shadow:
    0 8px 24px rgba(34, 197, 94, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

/* Danger variant */
.glass-button--danger {
  color: #dc2626;
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
}

.glass-button--danger:hover {
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.25);
  box-shadow:
    0 8px 24px rgba(239, 68, 68, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

/* Small variant */
.glass-button--small {
  padding: 8px 14px;
  font-size: 13px;
  border-radius: 10px;
}

.glass-button__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.glass-button__text {
  position: relative;
  z-index: 1;
}
</style>
