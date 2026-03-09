<template>
  <div class="dialog-overlay" @click="$emit('close')">
    <div class="dialog-content" @click.stop>
      <div class="dialog-header">
        <h3>升级密钥</h3>
        <button class="close-btn" @click="$emit('close')">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="dialog-body">
        <!-- 当前状态 -->
        <div class="current-status-section">
          <h4>当前状态</h4>
          <div class="status-info">
            <div class="status-item">
              <span class="status-label">子账号上限</span>
              <span class="status-value">{{ userStore.user?.maxAccounts || 1 }} 个</span>
            </div>
            <div class="status-item">
              <span class="status-label">激活密钥过期时间</span>
              <span class="status-value" :class="{ 'expired': isKeyExpired }">
                {{ formatDate(userStore.user?.keyExpiresAt) }}
                <span v-if="isKeyExpired" class="expired-badge">已过期</span>
              </span>
            </div>
            <div v-if="userStore.user?.upgradeExpiresAt" class="status-item">
              <span class="status-label">升级权益到期时间</span>
              <span class="status-value" :class="{ 'expired': isUpgradeExpired, 'warning': isUpgradeExpiringSoon }">
                {{ formatDate(userStore.user?.upgradeExpiresAt) }}
                <span v-if="isUpgradeExpired" class="expired-badge">已过期</span>
                <span v-else-if="isUpgradeExpiringSoon" class="warning-badge">即将到期</span>
              </span>
            </div>
          </div>
          <div v-if="userStore.user?.upgradeExpiresAt && !isUpgradeExpired" class="upgrade-notice">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>升级权益到期后，子账号上限将自动恢复为1个，多余的子账号将被删除（仅保留最新创建的一个）</span>
          </div>
          <div class="upgrade-stack-notice">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
            </svg>
            <span>升级密钥支持叠加使用：同级密钥可累加有效期，升级密钥可提升子账号上限并累加有效期。但不可降级使用（如已有3个子账号上限，不能使用一级或二级密钥）</span>
          </div>
        </div>

        <!-- 密钥说明 -->
        <div class="key-info-section">
          <h4>密钥说明</h4>
          <div class="key-types">
            <div class="key-type-card level1">
              <div class="key-type-header">
                <span class="key-type-badge">一级密钥</span>
              </div>
              <div class="key-type-benefits">
                <div class="benefit-item">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>子账号上限提升至 <strong>2 个</strong></span>
                </div>
                <div class="benefit-item">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>延长有效期 <strong>15 天</strong>（可累加）</span>
                </div>
              </div>
            </div>
            <div class="key-type-card level2">
              <div class="key-type-header">
                <span class="key-type-badge">二级密钥</span>
              </div>
              <div class="key-type-benefits">
                <div class="benefit-item">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>子账号上限提升至 <strong>3 个</strong></span>
                </div>
                <div class="benefit-item">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>延长有效期 <strong>30 天</strong>（可累加）</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 输入密钥 -->
        <div class="input-section">
          <h4>输入升级密钥</h4>
          <div class="form-group">
            <input
              v-model="upgradeKey"
              type="text"
              placeholder="请输入升级密钥"
              :disabled="isLoading"
              @input="handleInput"
            />
            <button 
              v-if="upgradeKey && !validatedInfo" 
              class="btn-verify" 
              @click="verifyKey"
              :disabled="isVerifying"
            >
              <span v-if="isVerifying" class="spinner-small"></span>
              <span v-else>验证</span>
            </button>
          </div>

          <!-- 验证结果预览 -->
          <div v-if="validatedInfo" class="validation-result">
            <div class="result-header">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>密钥有效</span>
            </div>
            <div class="result-details">
              <div class="result-item">
                <span class="result-label">密钥类型</span>
                <span class="result-value">{{ validatedInfo.keyTypeText }}</span>
              </div>
              <div class="result-item">
                <span class="result-label">子账号上限</span>
                <span class="result-value highlight">{{ userStore.user?.maxAccounts || 1 }} → {{ validatedInfo.maxAccounts }} 个</span>
              </div>
              <div class="result-item">
                <span class="result-label">延长天数</span>
                <span class="result-value highlight">+ {{ validatedInfo.extendDays }} 天</span>
              </div>
            </div>
          </div>

          <div v-if="errorMessage" class="error-message">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            {{ errorMessage }}
          </div>

          <div v-if="successMessage" class="success-message">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            {{ successMessage }}
          </div>
        </div>

        <!-- 升级记录 -->
        <div v-if="upgradeLogs.length > 0" class="logs-section">
          <h4>升级记录</h4>
          <div class="logs-list">
            <div v-for="log in upgradeLogs" :key="log.id" class="log-item">
              <div class="log-header">
                <span :class="['log-type', log.key_type]">{{ log.key_type === 'level1' ? '一级密钥' : '二级密钥' }}</span>
                <span class="log-time">{{ formatDate(log.created_at) }}</span>
              </div>
              <div class="log-details">
                <span>子账号: {{ log.old_max_accounts }} → {{ log.new_max_accounts }} 个</span>
                <span>延长 {{ log.extend_days }} 天</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <button class="btn-secondary" @click="$emit('close')" :disabled="isLoading">
          取消
        </button>
        <button 
          class="btn-primary" 
          @click="useUpgradeKey" 
          :disabled="isLoading || !validatedInfo"
        >
          <span v-if="isLoading" class="spinner-small"></span>
          <span v-else>立即升级</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useUserStore } from '../stores/user';
import axios from 'axios';

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
}>();

const userStore = useUserStore();

const upgradeKey = ref('');
const validatedInfo = ref<any>(null);
const isLoading = ref(false);
const isVerifying = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const upgradeLogs = ref<any[]>([]);

// 计算激活密钥是否过期
const isKeyExpired = computed(() => {
  if (!userStore.user?.keyExpiresAt) return false;
  return new Date(userStore.user.keyExpiresAt) < new Date();
});

// 计算升级权益是否过期
const isUpgradeExpired = computed(() => {
  if (!userStore.user?.upgradeExpiresAt) return false;
  return new Date(userStore.user.upgradeExpiresAt) < new Date();
});

// 计算升级权益是否即将到期（7天内）
const isUpgradeExpiringSoon = computed(() => {
  if (!userStore.user?.upgradeExpiresAt || isUpgradeExpired.value) return false;
  const expiresAt = new Date(userStore.user.upgradeExpiresAt);
  const now = new Date();
  const diffDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 7;
});

onMounted(async () => {
  await loadUpgradeLogs();
});

async function loadUpgradeLogs() {
  try {
    const response = await axios.get('/api/upgrade-keys/my-logs');
    if (response.data.success) {
      upgradeLogs.value = response.data.data;
    }
  } catch (error) {
    console.error('加载升级记录失败:', error);
  }
}

function handleInput() {
  // 清除之前的验证结果
  validatedInfo.value = null;
  errorMessage.value = '';
  successMessage.value = '';
}

async function verifyKey() {
  if (!upgradeKey.value.trim()) return;

  isVerifying.value = true;
  errorMessage.value = '';
  validatedInfo.value = null;

  try {
    const response = await axios.post('/api/upgrade-keys/validate', {
      keyValue: upgradeKey.value.trim()
    });

    if (response.data.success) {
      validatedInfo.value = response.data.data;
    }
  } catch (error: any) {
    errorMessage.value = error.response?.data?.message || '验证失败';
  } finally {
    isVerifying.value = false;
  }
}

async function useUpgradeKey() {
  if (!validatedInfo.value) return;

  isLoading.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    const response = await axios.post('/api/upgrade-keys/use', {
      keyValue: upgradeKey.value.trim()
    });

    if (response.data.success) {
      successMessage.value = response.data.message;
      upgradeKey.value = '';
      validatedInfo.value = null;
      
      // 刷新用户信息
      await userStore.fetchUserInfo();
      
      // 刷新升级记录
      await loadUpgradeLogs();
      
      emit('success');
    }
  } catch (error: any) {
    errorMessage.value = error.response?.data?.message || '升级失败';
  } finally {
    isLoading.value = false;
  }
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN');
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #6b7280;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #374151;
}

.dialog-body {
  padding: 24px;
}

.current-status-section,
.key-info-section,
.input-section,
.logs-section {
  margin-bottom: 24px;
}

.current-status-section h4,
.key-info-section h4,
.input-section h4,
.logs-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.status-info {
  background: #f3f4f6;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-label {
  font-size: 13px;
  color: #6b7280;
}

.status-value {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
}

.status-value.expired {
  color: #dc2626;
}

.expired-badge {
  background: #fee2e2;
  color: #dc2626;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-left: 8px;
}

.warning-badge {
  background: #fef3c7;
  color: #d97706;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-left: 8px;
}

.status-value.warning {
  color: #d97706;
}

.upgrade-notice {
  margin-top: 12px;
  padding: 10px 12px;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 6px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  color: #92400e;
}

.upgrade-notice svg {
  flex-shrink: 0;
  margin-top: 2px;
}

.upgrade-stack-notice {
  margin-top: 8px;
  padding: 10px 12px;
  background: #dbeafe;
  border: 1px solid #93c5fd;
  border-radius: 6px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  color: #1e40af;
}

.upgrade-stack-notice svg {
  flex-shrink: 0;
  margin-top: 2px;
}

.key-types {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.key-type-card {
  border-radius: 8px;
  padding: 16px;
  border: 2px solid;
}

.key-type-card.level1 {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  border-color: #3b82f6;
}

.key-type-card.level2 {
  background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%);
  border-color: #ec4899;
}

.key-type-header {
  margin-bottom: 12px;
}

.key-type-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.key-type-card.level1 .key-type-badge {
  background: #3b82f6;
  color: white;
}

.key-type-card.level2 .key-type-badge {
  background: #ec4899;
  color: white;
}

.key-type-benefits {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.benefit-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #374151;
}

.benefit-item svg {
  color: #10b981;
  flex-shrink: 0;
}

.form-group {
  display: flex;
  gap: 8px;
}

.form-group input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-group input:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
}

.btn-verify {
  padding: 10px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-verify:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-verify:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.validation-result {
  margin-top: 16px;
  background: #ecfdf5;
  border: 1px solid #6ee7b7;
  border-radius: 8px;
  padding: 16px;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #059669;
  font-weight: 600;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #6ee7b7;
}

.result-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.result-label {
  color: #6b7280;
}

.result-value {
  color: #1f2937;
  font-weight: 500;
}

.result-value.highlight {
  color: #059669;
  font-weight: 600;
}

.error-message {
  margin-top: 12px;
  padding: 10px 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.success-message {
  margin-top: 12px;
  padding: 10px 12px;
  background: #dcfce7;
  border: 1px solid #86efac;
  border-radius: 6px;
  color: #16a34a;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-item {
  background: #f9fafb;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #e5e7eb;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.log-type {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.log-type.level1 {
  background: #dbeafe;
  color: #1d4ed8;
}

.log-type.level2 {
  background: #fce7f3;
  color: #be185d;
}

.log-time {
  font-size: 12px;
  color: #9ca3af;
}

.log-details {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #6b7280;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
}

.btn-secondary,
.btn-primary {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: white;
  border: 1px solid #e5e7eb;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #d1d5db;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary:disabled,
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner-small {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 480px) {
  .key-types {
    grid-template-columns: 1fr;
  }
  
  .form-group {
    flex-direction: column;
  }
  
  .btn-verify {
    width: 100%;
  }
}
</style>