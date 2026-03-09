<script setup lang="ts">
import { ref } from 'vue';
import GlassButton from './GlassButton.vue';
import DeleteButton from './DeleteButton.vue';
import StatusIndicator from './StatusIndicator.vue';

const showSupportModal = ref(false);

defineProps<{
  accounts: any[];
  selectedAccount: any;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'select-account', account: any): void;
  (e: 'add-account'): void;
  (e: 'delete-account', id: string): void;
  (e: 'logout'): void;
  (e: 'close'): void;
  (e: 'get-key'): void;
}>();

const handleSelectAccount = (account: any) => {
  emit('select-account', account);
  emit('close');
};

const goToGetKey = () => {
  emit('get-key');
  emit('close');
};
</script>

<template>
  <aside :class="['sidebar', { 'sidebar-open': isOpen }]">
    <!-- 侧边栏头部 -->
    <div style="padding: 20px 24px; border-bottom: 1px solid #e2e8f0; background-color: #ffffff;">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <h1 style="font-size: 20px; font-weight: 700; background: linear-gradient(135deg, #3b82f6, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin: 0;">Farm Bot</h1>
        <h2 style="font-size: 14px; font-weight: 500; color: #64748b; margin: 0;">账号管理</h2>
      </div>
    </div>
    
    <!-- 账号列表 -->
    <div style="flex: 1; overflow-y: auto; padding: 16px; background-color: #f8fafc;">
      <div v-if="accounts.length === 0" style="text-align: center; padding: 60px 20px; color: #64748b;">
        <div style="width: 80px; height: 80px; margin: 0 auto 20px; color: #94a3b8;">
          <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
        </div>
        <p style="font-size: 16px; font-weight: 500; margin: 0 0 8px; color: #475569;">暂无账号</p>
        <p style="font-size: 14px; margin: 0; color: #94a3b8;">点击下方按钮添加账号</p>
      </div>
      <div v-else style="display: flex; flex-direction: column; gap: 12px;">
        <!-- 账号项 -->
        <div
          v-for="account in accounts"
          :key="account.id"
          @click="handleSelectAccount(account)"
          :style="{
            display: 'flex',
            alignItems: 'center',
            padding: '16px',
            borderRadius: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            backgroundColor: selectedAccount?.id === account.id ? '#eff6ff' : '#ffffff',
            border: selectedAccount?.id === account.id ? '2px solid #3b82f6' : '1px solid #e2e8f0',
            boxShadow: selectedAccount?.id === account.id ? '0 2px 8px rgba(59, 130, 246, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)'
          }"
        >
          <!-- 账号头像 -->
          <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #2563eb); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3); flex-shrink: 0;">
            {{ account.name.charAt(0) }}
          </div>
          
          <!-- 账号信息 -->
          <div style="margin-left: 14px; flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <h3 style="font-size: 15px; font-weight: 600; color: #1e293b; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px;">{{ account.name }}</h3>
              <StatusIndicator :is-running="account.isRunning" />
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #64748b;">
                <span style="font-weight: 500;">Lv{{ account.level }}</span>
                <span style="color: #cbd5e1;">|</span>
                <span>{{ account.platform === 'qq' ? 'QQ' : '微信' }}</span>
              </div>
              <!-- 删除按钮 -->
              <DeleteButton @click="$emit('delete-account', account.id)" />
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 添加账号按钮 -->
    <div style="padding: 20px 24px; border-top: 1px solid #e2e8f0; background-color: #ffffff;">
      <!-- 获取密钥按钮 -->
      <GlassButton 
        primary
        style="width: 100%; margin-bottom: 12px;"
        @click="goToGetKey"
      >
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
          </svg>
        </template>
        领取密钥
      </GlassButton>

      <GlassButton 
        primary
        style="width: 100%; margin-bottom: 12px;"
        @click="$emit('add-account')"
      >
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </template>
        添加账号
      </GlassButton>
      
      <!-- 支持与反馈按钮 -->
      <GlassButton 
        danger
        style="width: 100%;"
        @click="showSupportModal = true"
      >
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </template>
        支持与反馈
      </GlassButton>
    </div>

    <!-- 支持与反馈弹窗 -->
    <div v-if="showSupportModal" class="support-modal-overlay" @click.self="showSupportModal = false">
      <div class="support-modal">
        <div class="support-modal-header">
          <h3>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            支持与反馈
          </h3>
          <button class="support-close-btn" @click="showSupportModal = false">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="support-modal-body">
          <p class="support-description">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: middle;">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
            </svg>
            欢迎您使用玄机工具！您的支持是我们持续改进的动力。
          </p>
          
          <div class="support-buttons">
            <a href="https://xuanji.hk-gov.com/zanzhu" target="_blank" rel="noopener noreferrer" class="support-button sponsor-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 12 20 22 4 22 4 12"></polyline>
                <rect x="2" y="7" width="20" height="5"></rect>
                <line x1="12" y1="22" x2="12" y2="7"></line>
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
              </svg>
              <span>赞助支持</span>
              <small>请我喝杯咖啡</small>
            </a>
            <a href="https://xuanji.hk-gov.com/forum/19815.html" target="_blank" rel="noopener noreferrer" class="support-button feedback-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              </svg>
              <span>反馈建议</span>
              <small>分享您的想法</small>
            </a>
          </div>
          
          <div class="support-footer">
            <p>感谢您的支持与陪伴！❤️</p>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
/* 侧边栏基础样式 */
.sidebar {
  width: 280px;
  min-width: 280px;
  background-color: #ffffff;
  border-right: 1px solid #e2e8f0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 8px rgba(0,0,0,0.08);
  flex-shrink: 0;
  transition: transform 0.3s ease;
  padding-bottom: 80px; /* 为底部tab栏留出空间 */
}

/* 支持与反馈弹窗样式 */
.support-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.support-modal {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.support-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.support-modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  display: flex;
  align-items: center;
}

.support-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: #f3f4f6;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.support-close-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

.support-modal-body {
  padding: 24px;
}

.support-description {
  margin: 0 0 20px;
  font-size: 14px;
  color: #4b5563;
  line-height: 1.6;
  display: flex;
  align-items: flex-start;
}

.support-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.support-button {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-radius: 12px;
  text-decoration: none;
  transition: all 0.2s;
  cursor: pointer;
}

.support-button svg {
  flex-shrink: 0;
}

.support-button span {
  font-size: 16px;
  font-weight: 600;
}

.support-button small {
  font-size: 12px;
  opacity: 0.8;
  margin-left: auto;
}

.sponsor-btn {
  background: linear-gradient(135deg, #ff6b6b, #ee5a5a);
  color: white;
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
}

.sponsor-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 107, 107, 0.4);
}

.feedback-btn {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.feedback-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
}

.support-footer {
  text-align: center;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.support-footer p {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
}

/* 移动端侧边栏样式 */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 1000;
    transform: translateX(-100%);
    box-shadow: none;
    padding-bottom: 80px; /* 为底部tab栏留出空间 */
  }

  .sidebar.sidebar-open {
    transform: translateX(0);
    box-shadow: 2px 0 16px rgba(0,0,0,0.2);
  }
}
</style>
