<template>
  <div class="qr-login-container">
    <!-- 二维码显示区域 -->
    <div class="qr-code-wrapper">
      <!-- 加载中 -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>正在生成二维码...</p>
      </div>

      <!-- 二维码图片 -->
      <div v-else-if="qrImage && !loginSuccess" class="qr-code-display">
        <div class="qr-image-wrapper">
          <img :src="qrImage" alt="登录二维码" class="qr-image" />
          <!-- 过期遮罩 -->
          <div v-if="isExpired" class="expired-overlay">
            <p>二维码已过期</p>
            <button @click="refreshQRCode" class="refresh-btn">刷新</button>
          </div>
        </div>
        <p class="status-text">{{ statusMsg }}</p>
        <p class="hint-text">请使用手机QQ扫码登录</p>
      </div>

      <!-- 登录成功 -->
      <div v-else-if="loginSuccess" class="success-state">
        <div class="success-icon">✓</div>
        <p class="success-text">登录成功</p>
        <div v-if="avatar" class="avatar-wrapper">
          <img :src="avatar" alt="头像" class="avatar" />
        </div>
        <p v-if="uin" class="uin-text">QQ: {{ uin }}</p>
      </div>

      <!-- 初始状态 -->
      <div v-else class="initial-state">
        <div class="qr-placeholder">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
        </div>
        <p>点击按钮生成登录二维码</p>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="action-buttons">
      <button 
        v-if="!loginSuccess"
        @click="refreshQRCode" 
        :disabled="loading"
        class="primary-btn"
      >
        {{ loading ? '生成中...' : (qrImage ? '刷新二维码' : '获取登录二维码') }}
      </button>
      <button 
        v-if="!loginSuccess && qrUrl"
        @click="openQQLogin"
        class="qq-login-btn"
        :class="{ 'mobile': isMobile }"
      >
        {{ isMobile ? '跳转QQ登录' : '在浏览器打开' }}
      </button>
      <button 
        v-if="loginSuccess"
        @click="reset" 
        class="secondary-btn"
      >
        重新扫码
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, computed, onMounted } from 'vue';
import axios from 'axios';

// API基础URL
const API_BASE = '';

// 响应式数据
const loading = ref(false);
const qrImage = ref('');
const qrCode = ref('');
const qrUrl = ref('');
const statusMsg = ref('等待扫码...');
const isExpired = ref(false);
const loginSuccess = ref(false);
const avatar = ref('');
const uin = ref('');
const authCode = ref('');
const screenWidth = ref(window.innerWidth);

// 轮询定时器
let pollTimer: number | null = null;

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

// Emits
const emit = defineEmits<{
  'login-success': [{ code: string; uin: string; avatar: string }];
}>();

// 获取二维码
async function refreshQRCode() {
  if (loading.value) return;
  
  // 重置状态
  stopPolling();
  resetState();
  loading.value = true;

  try {
    const res = await axios.post(`${API_BASE}/api/qr/create`);
    const data = res.data;

    if (data.success) {
      qrImage.value = data.qrcode;
      qrCode.value = data.code;
      qrUrl.value = data.url || '';
      statusMsg.value = '等待扫码...';
      isExpired.value = false;
      startPolling();
    } else {
      statusMsg.value = '生成失败，请重试';
    }
  } catch (error) {
    console.error('获取二维码失败:', error);
    statusMsg.value = '网络错误，请重试';
  } finally {
    loading.value = false;
  }
}

// 开始轮询状态
function startPolling() {
  stopPolling();
  pollTimer = window.setInterval(checkStatus, 2000);
}

// 停止轮询
function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// 检查状态
async function checkStatus() {
  if (!qrCode.value) return;

  try {
    const res = await axios.post(`${API_BASE}/api/qr/check`, {
      code: qrCode.value
    });
    const data = res.data;

    if (!data.success) return;

    // 更新状态消息
    if (data.msg) {
      statusMsg.value = data.msg;
    }

    // 登录成功
    if (data.ret === '0') {
      stopPolling();
      loginSuccess.value = true;
      avatar.value = data.avatar || '';
      uin.value = data.uin || '';
      authCode.value = data.code || '';

      // 通知父组件
      emit('login-success', {
        code: data.code,
        uin: data.uin,
        avatar: data.avatar
      });
    }
    // 二维码过期
    else if (data.ret === '65') {
      stopPolling();
      isExpired.value = true;
    }
  } catch (error) {
    console.error('检查状态失败:', error);
  }
}

// 重置状态
function resetState() {
  qrImage.value = '';
  qrCode.value = '';
  qrUrl.value = '';
  statusMsg.value = '等待扫码...';
  isExpired.value = false;
  loginSuccess.value = false;
  avatar.value = '';
  uin.value = '';
  authCode.value = '';
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

// 完全重置
function reset() {
  stopPolling();
  resetState();
}

// 组件卸载时清理
onUnmounted(() => {
  stopPolling();
});
</script>

<style scoped>
.qr-login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 20px 0;
}

.qr-code-wrapper {
  width: 240px;
  height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  border-radius: 16px;
  border: 2px dashed #e2e8f0;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: #64748b;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 二维码显示 */
.qr-code-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.qr-image-wrapper {
  position: relative;
  padding: 12px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.qr-image {
  width: 180px;
  height: 180px;
  object-fit: contain;
  display: block;
}

.expired-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border-radius: 12px;
}

.expired-overlay p {
  color: #64748b;
  font-size: 14px;
  margin: 0;
}

.refresh-btn {
  padding: 8px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:hover {
  background: #2563eb;
}

.status-text {
  font-size: 15px;
  font-weight: 500;
  color: #1e293b;
  margin: 0;
}

.hint-text {
  font-size: 13px;
  color: #64748b;
  margin: 0;
}

/* 登录成功状态 */
.success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.success-icon {
  width: 64px;
  height: 64px;
  background: #22c55e;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: bold;
}

.success-text {
  font-size: 18px;
  font-weight: 600;
  color: #22c55e;
  margin: 0;
}

.avatar-wrapper {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid #e2e8f0;
  margin-top: 8px;
}

.avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.uin-text {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

/* 初始状态 */
.initial-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: #94a3b8;
}

.qr-placeholder {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e2e8f0;
  border-radius: 16px;
}

.initial-state p {
  font-size: 14px;
  margin: 0;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  gap: 12px;
}

.primary-btn {
  padding: 12px 28px;
  font-size: 15px;
  font-weight: 600;
  color: white;
  background: #3b82f6;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.primary-btn:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary-btn {
  padding: 12px 28px;
  font-size: 15px;
  font-weight: 500;
  color: #64748b;
  background: #f1f5f9;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.secondary-btn:hover {
  background: #e2e8f0;
}

/* QQ登录按钮 */
.qq-login-btn {
  padding: 12px 28px;
  font-size: 15px;
  font-weight: 600;
  color: white;
  background: #12b7f5;
  border: none;
  border-radius: 10px;
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
  background: #12b7f5;
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
</style>
