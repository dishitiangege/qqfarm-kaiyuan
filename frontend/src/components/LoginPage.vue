<template>
  <div class="login-container">
    <img class="login-bg" src="https://bing.img.run/rand_uhd.php" alt="随机获取Bing历史壁纸UHD超高清原图" />
    <div class="login-box">
      <div class="login-header">
        <div class="logo">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
        </div>
        <h1>QQ农场机器人</h1>
        <p>管理员登录</p>
      </div>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <!-- 浮动标签输入框 - 账号 -->
        <div class="input-group">
          <input 
            v-model="username" 
            required
            type="text" 
            name="username"
            autocomplete="username"
            class="input"
          />
          <label class="user-label">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: middle;">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            请输入管理员账号
          </label>
        </div>
        
        <!-- 浮动标签输入框 - 密码 -->
        <div class="input-group">
          <input 
            v-model="password" 
            required
            :type="showPassword ? 'text' : 'password'" 
            name="password"
            autocomplete="current-password"
            class="input"
          />
          <label class="user-label">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: middle;">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            请输入密码
          </label>
          <button 
            type="button" 
            class="toggle-password"
            @click="showPassword = !showPassword"
          >
            <svg v-if="showPassword" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          </button>
        </div>
        
        <div v-if="errorMessage" class="error-message">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{{ errorMessage }}</span>
        </div>
        
        <div class="form-options">
          <label class="remember-me">
            <input v-model="rememberMe" type="checkbox" />
            <span>记住登录状态</span>
          </label>
        </div>
        
        <!-- 3D 按压按钮 -->
        <div class="button-wrapper">
          <button type="submit" class="ring-layer" :disabled="isLoading">
            <div class="outer-button">
              <div class="inner-button">
                <span v-if="isLoading" class="btn-content">
                  <svg class="spinner" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="2" x2="12" y2="6"></line>
                    <line x1="12" y1="18" x2="12" y2="22"></line>
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                    <line x1="2" y1="12" x2="6" y2="12"></line>
                    <line x1="18" y1="12" x2="22" y2="12"></line>
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                  </svg>
                </span>
                <span v-else class="btn-content">登 录</span>
              </div>
            </div>
          </button>
        </div>
      </form>
      
      <div class="login-footer">
        <p>请使用管理员账号登录</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const emit = defineEmits<{
  (e: 'login-success'): void;
}>();

const username = ref('');
const password = ref('');
const showPassword = ref(false);
const rememberMe = ref(true);
const errorMessage = ref('');
const isLoading = ref(false);

// 默认管理员账号密码
const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = '1234567890';

// 检查是否已登录
onMounted(() => {
  const savedAuth = localStorage.getItem('qq_farm_auth');
  if (savedAuth) {
    try {
      const auth = JSON.parse(savedAuth);
      const now = Date.now();
      // 检查是否在7天内
      if (auth.timestamp && (now - auth.timestamp) < 7 * 24 * 60 * 60 * 1000) {
        if (auth.username === DEFAULT_USERNAME && auth.isLoggedIn) {
          emit('login-success');
          return;
        }
      }
    } catch (e) {
      localStorage.removeItem('qq_farm_auth');
    }
  }
});

const handleLogin = async () => {
  errorMessage.value = '';
  
  if (!username.value.trim()) {
    errorMessage.value = '请输入账号';
    return;
  }
  
  if (!password.value) {
    errorMessage.value = '请输入密码';
    return;
  }
  
  isLoading.value = true;
  
  // 模拟登录验证延迟
  await new Promise(resolve => setTimeout(resolve, 500));
  
  if (username.value !== DEFAULT_USERNAME) {
    errorMessage.value = '账号错误';
    isLoading.value = false;
    return;
  }
  
  if (password.value !== DEFAULT_PASSWORD) {
    errorMessage.value = '密码错误';
    isLoading.value = false;
    return;
  }
  
  // 登录成功，保存到本地存储
  if (rememberMe.value) {
    localStorage.setItem('qq_farm_auth', JSON.stringify({
      username: DEFAULT_USERNAME,
      isLoggedIn: true,
      timestamp: Date.now()
    }));
  }
  
  isLoading.value = false;
  emit('login-success');
};
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
  width: 100%;
  max-width: 420px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  z-index: 2;
  backdrop-filter: blur(10px);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.logo {
  width: 80px;
  height: 80px;
  margin: 0 auto 16px;
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo svg {
  stroke: white;
}

.login-header h1 {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 8px;
}

.login-header p {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 浮动标签输入框样式 */
.input-group {
  position: relative;
}

.input {
  width: 100%;
  border: solid 1.5px #9e9e9e;
  border-radius: 1rem;
  background: none;
  padding: 1rem;
  padding-right: 40px;
  font-size: 1rem;
  color: #1f2937;
  transition: border 150ms cubic-bezier(0.4, 0, 0.2, 1);
  box-sizing: border-box;
}

.user-label {
  position: absolute;
  left: 15px;
  color: #64748b;
  pointer-events: none;
  transform: translateY(1rem);
  transition: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 1rem;
  background: transparent;
  padding: 0 0.2em;
}

.input:focus,
.input:valid {
  outline: none;
  border: 1.5px solid #22c55e;
}

.input:focus ~ label,
.input:valid ~ label {
  transform: translateY(-50%) scale(0.8);
  background-color: rgba(255, 255, 255, 0.95);
  padding: 0 0.2em;
  color: #22c55e;
}

.toggle-password {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-password:hover svg {
  stroke: #64748b;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  color: #dc2626;
  font-size: 14px;
}

.form-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.remember-me {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #4b5563;
}

.remember-me input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #22c55e;
  cursor: pointer;
}

/* 3D 按压按钮样式 */
.button-wrapper {
  position: relative;
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

.ring-layer {
  position: relative;
  z-index: 10;
  width: 100%;
  height: 60px;
  border-radius: 9999px;
  box-shadow:
    inset 0px 5px 1px transparent,
    inset 0px 0px 0px transparent,
    0px 0px 0px transparent,
    0px 8px 2px #898788,
    4px 10px 3px #ffffff90,
    0px 20px 30px #a6a6a6,
    0px 0px 0px transparent;
  cursor: pointer;
  transition: all 150ms ease-out;
  border: none;
  background: transparent;
  padding: 0;
}

.ring-layer:hover:not(:disabled) {
  box-shadow:
    inset 0px 5px 1px #e4e4e4,
    inset 0px 6px 2px #b6baab,
    0px 0px 0px transparent,
    0px 7px 1px #b6baab,
    4px 10px 3px #fcfcfc,
    1px 6px 1px #b6baab,
    0px 0px 0px transparent;
}

.ring-layer:active:not(:disabled) {
  box-shadow:
    inset 0px 5px 1px #e4e4e4,
    inset 0px 12px 0px #22c55e,
    0px 9px 4px #e4e4e4,
    0px 7px 1px #b6baab,
    4px 10px 3px #fcfcfc,
    1px 6px 1px #b6baab,
    0px 0px 0px transparent;
}

.ring-layer:disabled {
  cursor: not-allowed;
  opacity: 0.8;
}

.outer-button {
  position: relative;
  z-index: 10;
  width: 100%;
  height: 60px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: linear-gradient(to bottom, #4ade80, #22c55e);
  box-shadow:
    0px 6px 0px #16a34a,
    0px 0px 0px transparent,
    0px 0px 0px transparent,
    inset 0px 1px 0px #ffffff90;
  transition: all 150ms ease-out;
}

.ring-layer:hover:not(:disabled) .outer-button {
  transform: translateY(6px);
  background: linear-gradient(to bottom, #22c55e, #16a34a);
  box-shadow:
    0px 0px 0px #16a34a,
    -1px 0px 2px #b6baab,
    1px 0px 2px #b6baab,
    inset 0px 1px 0px #ffffff50;
}

.ring-layer:active:not(:disabled) .outer-button {
  height: 54px;
  width: 98%;
  transform: translateX(1px) translateY(16px);
  box-shadow:
    0px -4px 0px #22c55e,
    0px 0px 1px #b6baab;
  background: linear-gradient(to bottom, #22c55e, #16a34a);
}

.inner-button {
  position: relative;
  width: 96%;
  height: 48px;
  border-radius: 9999px;
  background: linear-gradient(to bottom right, #4ade80, #86efac);
  box-shadow:
    inset 0px 3px 0px #16a34a,
    inset 5px 10px 2px rgba(22, 163, 74, 0.25),
    inset 0px -1px 1px #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Inter", sans-serif;
  font-weight: 600;
  font-size: 1.1rem;
  color: #ffffff;
  overflow: hidden;
  transition: all 150ms ease-out;
  user-select: none;
}

.ring-layer:hover:not(:disabled) .inner-button {
  background: linear-gradient(to bottom right, #22c55e, #4ade80);
  box-shadow:
    inset 0px 3px 0px #16a34a,
    inset 5px 10px 2px rgba(22, 163, 74, 0.25),
    inset 0px -1px 1px #ffffff99;
}

.ring-layer:active:not(:disabled) .inner-button {
  background: linear-gradient(to bottom right, #22c55e, #4ade80);
  box-shadow:
    inset 0px 3px 0px #16a34a,
    inset 5px 18px 2px rgba(22, 163, 74, 0.25),
    inset 0px -1px 1px #ffffff96;
}

.btn-content {
  position: relative;
  padding-top: 2px;
  z-index: 10;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.login-footer {
  margin-top: 24px;
  text-align: center;
}

.login-footer p {
  font-size: 12px;
  color: #9ca3af;
  margin: 0;
}

@media (max-width: 480px) {
  .login-box {
    padding: 32px 24px;
  }
  
  .login-header h1 {
    font-size: 20px;
  }
  
  .ring-layer {
    height: 54px;
  }
  
  .outer-button {
    height: 54px;
  }
  
  .inner-button {
    height: 42px;
    font-size: 1rem;
  }
}
</style>
