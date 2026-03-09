<template>
  <div class="dialog-overlay" @click="$emit('close')">
    <div class="dialog-content" @click.stop>
      <div class="dialog-header">
        <h3>更换注册密钥</h3>
        <button class="close-btn" @click="$emit('close')">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="dialog-body">
        <!-- 当前密钥信息 -->
        <div class="current-key-section">
          <h4>当前密钥</h4>
          <div v-if="currentKey" class="key-info">
            <div class="key-value">{{ currentKey.key }}</div>
            <div class="key-meta">
              <span :class="['key-status', currentKey.isExpired ? 'expired' : 'valid']">
                {{ currentKey.isExpired ? '已过期' : '有效' }}
              </span>
              <span class="key-expires">
                过期时间: {{ formatDate(currentKey.expiresAt) }}
              </span>
            </div>
          </div>
          <div v-else class="no-key">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
            </svg>
            <p>未绑定密钥</p>
          </div>
        </div>

        <!-- 更换密钥表单 -->
        <div class="change-key-section">
          <h4>更换密钥</h4>
          <div class="form-group">
            <label>新密钥</label>
            <input
              v-model="newKey"
              type="text"
              placeholder="请输入新的注册密钥"
              :disabled="isLoading"
            />
          </div>
          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
          <div v-if="successMessage" class="success-message">
            {{ successMessage }}
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <button class="btn-secondary" @click="$emit('close')" :disabled="isLoading">
          取消
        </button>
        <button class="btn-primary" @click="handleChangeKey" :disabled="isLoading || !newKey.trim()">
          <span v-if="isLoading" class="spinner-small"></span>
          <span v-else>更换密钥</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useUserStore } from '../stores/user';

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
}>();

const userStore = useUserStore();

const currentKey = ref<any>(null);
const newKey = ref('');
const isLoading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

onMounted(async () => {
  await loadCurrentKey();
});

async function loadCurrentKey() {
  try {
    currentKey.value = await userStore.getMyKeyInfo();
  } catch (error) {
    console.error('加载密钥信息失败:', error);
  }
}

async function handleChangeKey() {
  errorMessage.value = '';
  successMessage.value = '';
  isLoading.value = true;

  try {
    await userStore.changeMyKey(newKey.value.trim());
    successMessage.value = '密钥更换成功';
    newKey.value = '';
    await loadCurrentKey();
    emit('success');
  } catch (error: any) {
    errorMessage.value = error.response?.data?.message || '更换密钥失败';
  } finally {
    isLoading.value = false;
  }
}

function formatDate(dateStr: string): string {
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
  max-width: 500px;
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

.current-key-section,
.change-key-section {
  margin-bottom: 24px;
}

.current-key-section h4,
.change-key-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.key-info {
  background: #f3f4f6;
  border-radius: 8px;
  padding: 16px;
}

.key-value {
  font-family: monospace;
  font-size: 14px;
  color: #1f2937;
  word-break: break-all;
  margin-bottom: 8px;
  padding: 8px;
  background: white;
  border-radius: 4px;
  border: 1px solid #e5e7eb;
}

.key-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.key-status {
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.key-status.valid {
  background: #dcfce7;
  color: #16a34a;
}

.key-status.expired {
  background: #fee2e2;
  color: #dc2626;
}

.key-expires {
  color: #6b7280;
}

.no-key {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  color: #9ca3af;
  background: #f9fafb;
  border-radius: 8px;
}

.no-key svg {
  margin-bottom: 8px;
  opacity: 0.5;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.form-group input {
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

.error-message {
  margin-top: 12px;
  padding: 10px 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  font-size: 13px;
}

.success-message {
  margin-top: 12px;
  padding: 10px 12px;
  background: #dcfce7;
  border: 1px solid #86efac;
  border-radius: 6px;
  color: #16a34a;
  font-size: 13px;
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
</style>
