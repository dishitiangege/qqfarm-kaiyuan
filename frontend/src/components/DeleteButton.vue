<template>
  <button class="delete-button" @click="handleClick">
    <span class="delete-button__text">删除</span>
    <span class="delete-button__icon">
      <svg class="svg" height="512" viewBox="0 0 512 512" width="512" xmlns="http://www.w3.org/2000/svg">
        <title></title>
        <path d="M112,112l20,320c.95,18.49,14.4,32,32,32H348c17.67,0,30.87-13.51,32-32l20-320" style="fill:none;stroke:#fff;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px"></path>
        <line style="stroke:#fff;stroke-linecap:round;stroke-miterlimit:10;stroke-width:32px" x1="80" x2="432" y1="112" y2="112"></line>
        <path d="M192,112V72h0a23.93,23.93,0,0,1,24-24h80a23.93,23.93,0,0,1,24,24h0v40" style="fill:none;stroke:#fff;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px"></path>
        <line style="fill:none;stroke:#fff;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px" x1="256" x2="256" y1="176" y2="400"></line>
        <line style="fill:none;stroke:#fff;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px" x1="184" x2="192" y1="176" y2="400"></line>
        <line style="fill:none;stroke:#fff;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px" x1="328" x2="320" y1="176" y2="400"></line>
      </svg>
    </span>
  </button>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  (e: 'click'): void;
}>();

const handleClick = (event: Event) => {
  event.stopPropagation();
  emit('click');
};
</script>

<style scoped>
.delete-button {
  width: 50px;
  height: 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  background: #ef4444;
  border: none;
  border-radius: 6px;
  box-shadow: 1px 1px 3px rgba(0,0,0,0.15);
  overflow: hidden;
  transition: all 0.3s ease;
  position: relative;
}

.delete-button__text {
  transform: translateX(12px);
  color: white;
  font-weight: 600;
  font-size: 11px;
  transition: all 0.3s ease;
}

.delete-button__icon {
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  width: 0;
  background-color: #dc2626;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  overflow: hidden;
}

.delete-button__icon .svg {
  width: 14px;
  fill: #eee;
  flex-shrink: 0;
}

.delete-button:hover {
  background: #dc2626;
}

.delete-button:hover .delete-button__text {
  color: transparent;
}

.delete-button:hover .delete-button__icon {
  width: 100%;
}

.delete-button:active {
  transform: scale(0.95);
}
</style>
