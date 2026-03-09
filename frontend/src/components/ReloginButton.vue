<template>
  <button class="relogin-btn" @click="$emit('click')">
    <div class="relogin-sign">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
        <polyline points="10 17 15 12 10 7"></polyline>
        <line x1="15" y1="12" x2="3" y2="12"></line>
      </svg>
    </div>
    <span class="relogin-text">重新登录</span>
  </button>
</template>

<script setup lang="ts">
defineEmits<{
  (e: 'click'): void;
}>();
</script>

<style scoped>
.relogin-btn {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 42px;
  height: 42px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition-duration: .3s;
  box-shadow: 2px 2px 10px rgba(0, 0, 0, 0.2);
  background: linear-gradient(135deg, #ff4141 0%, #dc2626 100%);
}

/* 图标 */
.relogin-sign {
  width: 100%;
  transition-duration: .3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.relogin-sign svg {
  width: 18px;
  height: 18px;
  color: white;
}

/* 文字 */
.relogin-text {
  position: absolute;
  right: 0%;
  width: 0%;
  opacity: 0;
  color: white;
  font-size: 13px;
  font-weight: 600;
  transition-duration: .3s;
  white-space: nowrap;
}

/* 悬停效果 - 按钮宽度展开 */
.relogin-btn:hover {
  width: 110px;
  border-radius: 40px;
  transition-duration: .3s;
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
}

.relogin-btn:hover .relogin-sign {
  width: 30%;
  transition-duration: .3s;
  padding-left: 16px;
}

/* 悬停效果 - 显示文字 */
.relogin-btn:hover .relogin-text {
  opacity: 1;
  width: 70%;
  transition-duration: .3s;
  padding-right: 10px;
}

/* 点击效果 */
.relogin-btn:active {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 5px rgba(0, 0, 0, 0.2);
}
</style>
