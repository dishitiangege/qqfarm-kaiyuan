<template>
  <div v-if="visible" class="dialog-overlay" @click.self="close">
    <div class="dialog-container">
      <div class="dialog-header">
        <h3>重新登录</h3>
        <button class="close-btn" @click="close">×</button>
      </div>
      
      <div class="dialog-body">
        <p class="dialog-desc">
          账号 <strong>{{ accountName }}</strong> 的登录已过期，请重新获取登录码。
        </p>
        
        <!-- 平台选择 -->
        <div class="form-group">
          <label>平台</label>
          <div class="platform-select">
            <button 
              :class="['platform-btn', { active: platform === 'qq' }]"
              @click="platform = 'qq'"
            >
              <span class="platform-icon">🐧</span>
              QQ
            </button>
            <button 
              :class="['platform-btn', { active: platform === 'wx' }]"
              @click="platform = 'wx'"
            >
              <span class="platform-icon">💬</span>
              微信
            </button>
          </div>
        </div>
        
        <!-- 二维码区域 -->
        <div class="qr-section">
          <div v-if="!qrCode" class="qr-placeholder">
            <button class="generate-btn" @click="generateQR" :disabled="loading">
              {{ loading ? '生成中...' : '点击生成二维码' }}
            </button>
          </div>
          <div v-else class="qr-code">
            <img :src="qrCode" alt="登录二维码" />
            <p class="qr-status">{{ qrStatus }}</p>
            <div class="qr-actions">
              <button class="refresh-btn" @click="generateQR" :disabled="loading">
                刷新二维码
              </button>
              <button
                v-if="qrUrl && platform === 'qq'"
                class="qq-login-btn"
                :class="{ 'mobile': isMobile }"
                @click="openQQLogin"
              >
                {{ isMobile ? '跳转QQ登录' : '在浏览器打开' }}
              </button>
            </div>
          </div>
        </div>
        
        <!-- 手动输入code -->
        <div class="form-group">
          <label>或手动输入登录码</label>
          <textarea
            v-model="code"
            placeholder="粘贴从浏览器开发者工具复制的code..."
            rows="3"
          ></textarea>
        </div>
      </div>
      
      <div class="dialog-footer">
        <button class="btn-secondary" @click="close">取消</button>
        <button 
          class="btn-primary" 
          @click="confirm"
          :disabled="!code.trim() || submitting"
        >
          {{ submitting ? '保存中...' : '确认登录' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import axios from 'axios';

// 使用相对路径，自动适配当前域名
const API_BASE_URL = '/api';

const props = defineProps<{
  visible: boolean;
  accountId: string;
  accountName: string;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  'success': [];
}>();

const platform = ref<'qq' | 'wx'>('qq');
const code = ref('');
const qrCode = ref('');
const qrUrl = ref('');
const qrStatus = ref('');
const loading = ref(false);
const submitting = ref(false);
const screenWidth = ref(window.innerWidth);
let checkTimer: number | null = null;

// 检测是否为移动端（通过User-Agent或屏幕宽度）
const isMobile = computed(() => {
  const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const isSmallScreen = screenWidth.value <= 768;
  return isMobileUA || isSmallScreen;
});

// 监听窗口大小变化
function handleResize() {
  screenWidth.value = window.innerWidth;
}

onMounted(() => {
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

// 关闭对话框
function close() {
  emit('update:visible', false);
  clearTimer();
  resetForm();
}

// 重置表单
function resetForm() {
  code.value = '';
  qrCode.value = '';
  qrUrl.value = '';
  qrStatus.value = '';
  platform.value = 'qq';
}

// 跳转QQ登录（移动端深链）
function openQQLogin() {
  if (!qrUrl.value) return;

  // 桌面端直接在新标签页打开
  if (!isMobile.value) {
    window.open(qrUrl.value, '_blank');
    return;
  }

  // 移动端使用QQ深链跳转
  try {
    const b64 = btoa(unescape(encodeURIComponent(qrUrl.value)));
    const qqDeepLink = `mqqapi://forward/url?url_prefix=${encodeURIComponent(b64)}&version=1&src_type=web`;
    window.location.href = qqDeepLink;
  } catch (e) {
    console.error('Deep link error:', e);
    window.location.href = qrUrl.value;
  }
}

// 清除定时器
function clearTimer() {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
}

// 生成二维码
async function generateQR() {
  loading.value = true;
  qrCode.value = '';
  qrStatus.value = '正在生成二维码...';
  clearTimer();
  
  try {
    const response = await axios.post(`${API_BASE_URL}/qr/create`);
    if (response.data.success) {
      qrCode.value = response.data.qrcode;
      qrUrl.value = response.data.url || '';
      code.value = response.data.code;
      qrStatus.value = '请使用' + (platform.value === 'qq' ? 'QQ' : '微信') + '扫描二维码登录';
      startChecking(response.data.code);
    }
  } catch (error) {
    qrStatus.value = '生成二维码失败，请重试';
  } finally {
    loading.value = false;
  }
}

// 开始轮询检查二维码状态
function startChecking(loginCode: string) {
  clearTimer();
  checkTimer = window.setInterval(async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/qr/check`, { code: loginCode });
      if (response.data.success) {
        const ret = response.data.ret;
        const msg = response.data.msg;
        // ret: '66' = 等待扫码, '0' = 登录成功, '65' = 过期/错误
        if (ret === '0') {
          qrStatus.value = '登录成功！';
          clearTimer();
          // 更新code输入框为获取到的授权码
          if (response.data.code) {
            code.value = response.data.code;
          }
        } else if (ret === '65') {
          qrStatus.value = msg || '二维码已过期，请刷新';
          clearTimer();
        } else if (ret === '66') {
          // 等待扫码中，检查msg判断是否已扫描
          if (msg && msg.includes('扫描')) {
            qrStatus.value = '已扫描，请在手机上确认登录';
          } else {
            qrStatus.value = msg || '等待扫码...';
          }
        }
      }
    } catch (error) {
      console.error('检查二维码状态失败:', error);
    }
  }, 2000);
}

// 确认登录
async function confirm() {
  if (!code.value.trim()) return;
  
  submitting.value = true;
  try {
    await axios.put(`${API_BASE_URL}/accounts/${props.accountId}/relogin`, {
      code: code.value.trim()
    });
    emit('success');
    close();
  } catch (error) {
    alert('更新登录信息失败，请重试');
  } finally {
    submitting.value = false;
  }
}

// 监听visible变化
watch(() => props.visible, (newVal) => {
  if (!newVal) {
    clearTimer();
    resetForm();
  }
});
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
  padding: 16px;
  box-sizing: border-box;
}

.dialog-container {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 420px;
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #94a3b8;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f1f5f9;
  color: #64748b;
}

.dialog-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
  -webkit-overflow-scrolling: touch;
}

.dialog-desc {
  margin: 0 0 20px 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.5;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
}

.platform-select {
  display: flex;
  gap: 12px;
}

.platform-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
}

.platform-btn:hover {
  border-color: #cbd5e1;
}

.platform-btn.active {
  border-color: #3b82f6;
  background: #eff6ff;
  color: #3b82f6;
}

.platform-icon {
  font-size: 18px;
}

.qr-section {
  margin-bottom: 20px;
}

.qr-placeholder {
  display: flex;
  justify-content: center;
  padding: 40px;
  background: #f8fafc;
  border-radius: 12px;
  border: 2px dashed #e2e8f0;
}

.generate-btn {
  padding: 12px 24px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.generate-btn:hover:not(:disabled) {
  background: #2563eb;
}

.generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.qr-code {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  background: #f8fafc;
  border-radius: 12px;
}

.qr-code img {
  width: 200px;
  height: 200px;
  border-radius: 8px;
}

.qr-status {
  margin: 12px 0;
  font-size: 13px;
  color: #64748b;
}

.refresh-btn {
  padding: 8px 16px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  border-color: #cbd5e1;
  color: #475569;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.qr-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.qq-login-btn {
  padding: 8px 16px;
  background: #12b7f5;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(18, 183, 245, 0.3);
}

.qq-login-btn:hover {
  background: #0ea5e0;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(18, 183, 245, 0.4);
}

.qq-login-btn.mobile {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 2px 8px rgba(18, 183, 245, 0.3);
  }
  50% {
    box-shadow: 0 4px 16px rgba(18, 183, 245, 0.5);
  }
}

textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  resize: vertical;
  box-sizing: border-box;
  font-family: monospace;
}

textarea:focus {
  outline: none;
  border-color: #3b82f6;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
}

.btn-secondary {
  padding: 10px 20px;
  background: #f1f5f9;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #e2e8f0;
}

.btn-primary {
  padding: 10px 20px;
  background: #3b82f6;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 移动端适配 */
@media (max-width: 480px) {
  .dialog-overlay {
    padding: 8px;
  }

  .dialog-container {
    max-height: calc(100vh - 16px);
    border-radius: 12px;
  }

  .dialog-header {
    padding: 16px 20px;
  }

  .dialog-header h3 {
    font-size: 16px;
  }

  .dialog-body {
    padding: 16px 20px;
  }

  .dialog-desc {
    font-size: 13px;
    margin-bottom: 16px;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .platform-btn {
    padding: 10px;
    font-size: 13px;
  }

  .qr-placeholder {
    padding: 24px;
  }

  .qr-code {
    padding: 16px;
  }

  .qr-code img {
    width: 160px;
    height: 160px;
  }

  .dialog-footer {
    padding: 12px 20px;
    gap: 8px;
  }

  .btn-secondary,
  .btn-primary {
    padding: 10px 16px;
    font-size: 13px;
    flex: 1;
  }
}
</style>
