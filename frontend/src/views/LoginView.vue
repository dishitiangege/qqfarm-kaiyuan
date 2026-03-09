<template>
  <div class="login-container">
    <img class="login-bg" src="https://bing.img.run/rand_uhd.php" alt="随机获取Bing历史壁纸UHD超高清原图" />
    <div class="login-box">
      <div class="login-header">
        <h1>QQ农场助手</h1>
        <p>多用户管理系统</p>
      </div>

      <div class="login-tabs" v-if="!showReactivate">
        <button
          :class="['tab-btn', { active: activeTab === 'login' }]"
          @click="activeTab = 'login'"
        >
          登录
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'register' }]"
          @click="checkRegistrationStatus()"
          :disabled="isCheckingRegistration"
        >
          {{ isCheckingRegistration ? '检查中...' : '注册' }}
        </button>
      </div>

      <!-- 注册关闭提示 -->
      <div v-if="activeTab === 'register' && !registrationOpen && !isCheckingRegistration" class="registration-closed">
        <div class="closed-icon">🔒</div>
        <h3>注册功能已关闭</h3>
        <p>{{ registrationClosedReason || '管理员已关闭注册功能，请联系管理员获取帮助' }}</p>
        <button class="btn-secondary" @click="activeTab = 'login'">返回登录</button>
      </div>

      <!-- 重新激活表单 -->
      <form v-if="showReactivate" @submit.prevent="handleReactivate" class="login-form">
        <div class="reactivate-header">
          <h3>重新激活账户</h3>
          <p>您的密钥已失效，请输入新的注册密钥重新激活账户</p>
        </div>
        <div class="form-group">
          <label>用户名</label>
          <input
            v-model="loginForm.username"
            type="text"
            placeholder="请输入用户名"
            required
            disabled
          />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码"
            required
            disabled
          />
        </div>
        <div class="form-group">
          <label>新注册密钥 <span class="required">*</span></label>
          <input
            v-model="reactivateKey"
            type="text"
            placeholder="请输入新的注册密钥"
            required
          />
          <span class="field-hint">请联系管理员获取新的注册密钥</span>
        </div>
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
        <button type="submit" class="submit-btn" :disabled="isLoading">
          {{ isLoading ? '激活中...' : '激活账户' }}
        </button>
        <button type="button" class="back-btn" @click="cancelReactivate">
          返回登录
        </button>
      </form>

      <!-- 登录表单 -->
      <form v-else-if="activeTab === 'login'" @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label>用户名</label>
          <input
            v-model="loginForm.username"
            type="text"
            placeholder="请输入用户名"
            required
          />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入密码"
            required
          />
        </div>
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
        <button type="submit" class="submit-btn" :disabled="isLoading">
          {{ isLoading ? '登录中...' : '登录' }}
        </button>
      </form>

      <!-- 注册表单 -->
      <form v-else-if="registrationOpen" @submit.prevent="handleRegister" class="login-form">
        <div class="form-group">
          <label>QQ邮箱 <span class="required">*</span></label>
          <input
            v-model="registerForm.email"
            type="email"
            placeholder="请输入QQ邮箱（如：123456@qq.com）"
            required
            @blur="autoFillUsername"
          />
          <span class="field-hint">用户名将自动设置为QQ号</span>
        </div>
        <div class="form-group">
          <label>用户名</label>
          <input
            v-model="registerForm.username"
            type="text"
            placeholder="用户名将自动填充为QQ号"
            required
            readonly
          />
        </div>
        <div class="form-group">
          <label>密码 <span class="required">*</span></label>
          <input
            v-model="registerForm.password"
            type="password"
            placeholder="请输入密码"
            required
          />
        </div>
        <div class="form-group">
          <label>确认密码 <span class="required">*</span></label>
          <input
            v-model="registerForm.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            required
          />
        </div>
        <div class="form-group">
          <label>邮箱验证码 <span class="required">*</span></label>
          <div class="verification-code-group">
            <input
              v-model="registerForm.verificationCode"
              type="text"
              placeholder="请输入验证码"
              required
            />
            <button
              type="button"
              class="send-code-btn"
              :disabled="isSendingCode || countdown > 0"
              @click="sendVerificationCode"
            >
              {{ countdown > 0 ? `${countdown}秒后重试` : '发送验证码' }}
            </button>
          </div>
        </div>
        <div class="form-group">
          <label>注册密钥 <span class="required">*</span></label>
          <input
            v-model="registerForm.registrationKey"
            type="text"
            placeholder="请输入注册密钥"
            required
          />
          <span class="field-hint">
            没有密钥？<a href="#" @click.prevent="goToGetKey" class="get-key-link">点击免费领取</a>
          </span>
        </div>
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
        <button type="submit" class="submit-btn" :disabled="isLoading">
          {{ isLoading ? '注册中...' : '注册' }}
        </button>
      </form>

      <!-- 获取密钥入口 -->
      <div class="get-key-section" v-if="!showReactivate">
        <div class="divider">
          <span>或者</span>
        </div>
        <button type="button" class="get-key-btn" @click="goToGetKey">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
          </svg>
          免费领取激活密钥
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useUserStore } from '../stores/user';
import { navigateTo } from '../router';
import axios from 'axios';

const userStore = useUserStore();

const activeTab = ref<'login' | 'register'>('login');
const isLoading = ref(false);
const errorMessage = ref('');
const showReactivate = ref(false);
const reactivateKey = ref('');
const pendingUserId = ref<number | null>(null);

// 注册状态
const registrationOpen = ref(true);
const registrationClosedReason = ref('');
const isCheckingRegistration = ref(false);

const loginForm = reactive({
  username: '',
  password: ''
});

const registerForm = reactive({
  username: '',
  password: '',
  confirmPassword: '',
  email: '',
  verificationCode: '',
  registrationKey: ''
});

const isSendingCode = ref(false);
const countdown = ref(0);

async function handleLogin() {
  errorMessage.value = '';
  isLoading.value = true;

  try {
    const success = await userStore.login(loginForm.username, loginForm.password);
    if (success) {
      // 登录成功，App.vue 会自动切换到主应用
    } else {
      errorMessage.value = '登录失败';
    }
  } catch (error: any) {
    const response = error.response?.data;
    if (response?.code === 'KEY_REQUIRED') {
      // 需要重新激活账户
      showReactivate.value = true;
      pendingUserId.value = response.userId;
      errorMessage.value = '';
    } else {
      errorMessage.value = response?.message || '登录失败';
    }
  } finally {
    isLoading.value = false;
  }
}

async function handleReactivate() {
  errorMessage.value = '';
  isLoading.value = true;

  try {
    const response = await axios.post('/api/auth/reactivate', {
      userId: pendingUserId.value,
      key: reactivateKey.value
    });

    if (response.data.success) {
      // 激活成功，保存登录状态
      const { token, user } = response.data.data;
      localStorage.setItem('token', token);
      // 设置 axios 默认 headers
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // 设置 userStore 的用户信息
      userStore.token = token;
      userStore.user = user;
      // isLoggedIn 是计算属性，不需要手动设置，token 和 user 已设置即可
    } else {
      errorMessage.value = response.data.message || '激活失败';
    }
  } catch (error: any) {
    errorMessage.value = error.response?.data?.message || '激活失败';
  } finally {
    isLoading.value = false;
  }
}

// 跳转到获取密钥页面
function goToGetKey() {
  navigateTo('get-key');
}

function cancelReactivate() {
  showReactivate.value = false;
  reactivateKey.value = '';
  pendingUserId.value = null;
  errorMessage.value = '';
}

// 验证QQ邮箱格式
function isQQEmail(email: string): boolean {
  const qqEmailRegex = /^[1-9][0-9]{4,10}@qq\.com$/i;
  return qqEmailRegex.test(email);
}

// 从QQ邮箱提取QQ号
function getQQNumber(email: string): string | null {
  if (!isQQEmail(email)) return null;
  return email.split('@')[0] || null;
}

// 自动填充用户名
function autoFillUsername() {
  const email = registerForm.email.trim();
  if (isQQEmail(email)) {
    const qqNumber = getQQNumber(email);
    if (qqNumber) {
      registerForm.username = qqNumber;
    }
  }
}

// 发送验证码
async function sendVerificationCode() {
  errorMessage.value = '';

  const email = registerForm.email.trim();
  if (!email) {
    errorMessage.value = '请输入QQ邮箱';
    return;
  }

  if (!isQQEmail(email)) {
    errorMessage.value = '请使用正确的QQ邮箱格式（如：123456@qq.com）';
    return;
  }

  isSendingCode.value = true;

  try {
    const response = await axios.post('/api/auth/send-verification-code', { email });
    alert(response.data.message);
    // 开始倒计时
    countdown.value = 60;
    const timer = setInterval(() => {
      countdown.value--;
      if (countdown.value <= 0) {
        clearInterval(timer);
      }
    }, 1000);
  } catch (error: any) {
    errorMessage.value = error.response?.data?.message || '发送验证码失败';
  } finally {
    isSendingCode.value = false;
  }
}

// 检查注册状态
async function checkRegistrationStatus() {
  isCheckingRegistration.value = true;
  try {
    const response = await axios.get('/api/auth/registration-status');
    if (response.data.success) {
      registrationOpen.value = response.data.data.open;
      registrationClosedReason.value = response.data.data.reason || '';
      activeTab.value = 'register';
    }
  } catch (error: any) {
    console.error('检查注册状态失败:', error);
    // 默认允许注册，让后端再次验证
    registrationOpen.value = true;
    activeTab.value = 'register';
  } finally {
    isCheckingRegistration.value = false;
  }
}

async function handleRegister() {
  errorMessage.value = '';

  // 验证QQ邮箱
  if (!isQQEmail(registerForm.email)) {
    errorMessage.value = '请使用正确的QQ邮箱格式（如：123456@qq.com）';
    return;
  }

  // 验证用户名与QQ号一致
  const qqNumber = getQQNumber(registerForm.email);
  if (registerForm.username !== qqNumber) {
    errorMessage.value = '用户名必须与QQ邮箱的QQ号一致';
    return;
  }

  if (registerForm.password !== registerForm.confirmPassword) {
    errorMessage.value = '两次输入的密码不一致';
    return;
  }

  if (!registerForm.verificationCode) {
    errorMessage.value = '请输入邮箱验证码';
    return;
  }

  if (!registerForm.registrationKey) {
    errorMessage.value = '请输入注册密钥';
    return;
  }

  isLoading.value = true;

  try {
    const response = await axios.post('/api/auth/register', {
      username: registerForm.username,
      password: registerForm.password,
      email: registerForm.email,
      verificationCode: registerForm.verificationCode,
      registrationKey: registerForm.registrationKey
    });

    if (response.data.success) {
      activeTab.value = 'login';
      loginForm.username = registerForm.username;
      errorMessage.value = '注册成功，请登录';
    } else {
      errorMessage.value = response.data.message || '注册失败';
    }
  } catch (error: any) {
    errorMessage.value = error.response?.data?.message || '注册失败';
  } finally {
    isLoading.value = false;
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 20px;
  overflow: hidden;
  background: #1a1a2e;
}

.login-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
}

.login-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1;
}

.login-box {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 40px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  z-index: 2;
  backdrop-filter: blur(10px);
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.login-header h1 {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 8px 0;
}

.login-header p {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.login-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 4px;
}

.tab-btn {
  flex: 1;
  padding: 10px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: white;
  color: #3b82f6;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.reactivate-header {
  text-align: center;
  margin-bottom: 8px;
}

.reactivate-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 8px 0;
}

.reactivate-header p {
  font-size: 13px;
  color: #64748b;
  margin: 0;
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
  padding: 12px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
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
  color: #6b7280;
  cursor: not-allowed;
}

.form-group .required {
  color: #dc2626;
}

.form-group .field-hint {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

.error-message {
  padding: 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  font-size: 13px;
}

.submit-btn {
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.back-btn {
  padding: 12px;
  background: transparent;
  color: #64748b;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: #f8fafc;
  color: #374151;
}

/* 验证码输入组 */
.verification-code-group {
  display: flex;
  gap: 8px;
}

.verification-code-group input {
  flex: 1;
}

.send-code-btn {
  padding: 12px 16px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.send-code-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.send-code-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 获取密钥链接 */
.get-key-link {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}

.get-key-link:hover {
  text-decoration: underline;
}

/* 获取密钥区域 */
.get-key-section {
  margin-top: 20px;
}

.divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin-bottom: 16px;
  color: #94a3b8;
  font-size: 13px;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #e2e8f0;
}

.divider span {
  padding: 0 12px;
}

.get-key-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.get-key-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

/* 注册关闭提示 */
.registration-closed {
  text-align: center;
  padding: 40px 20px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px dashed #cbd5e1;
}

.closed-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.registration-closed h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 12px 0;
}

.registration-closed p {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 24px 0;
  line-height: 1.5;
}

.btn-secondary {
  padding: 12px 24px;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #e2e8f0;
  color: #334155;
}
</style>
