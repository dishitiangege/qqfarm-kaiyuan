<template>
  <div class="getkey-page">
    <div class="getkey-container">
      <!-- 返回按钮 -->
      <div class="back-btn-wrapper">
        <button @click="goBack" class="back-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回
        </button>
      </div>

      <!-- 主卡片 -->
      <div class="main-card">
        <!-- 头部 -->
        <div class="card-header">
          <div class="icon-wrapper">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </div>
          <h1>领取密钥</h1>
          <p>输入QQ邮箱，立即获取激活密钥</p>
        </div>

        <!-- 活动信息 -->
        <div v-if="campaign" class="campaign-info">
          <div class="campaign-row">
            <span class="campaign-name">{{ campaign.name }}</span>
            <span class="campaign-quota">
              剩余 {{ campaign.remainingQuota }}/{{ campaign.totalQuota }} 个
            </span>
          </div>
          <div class="campaign-days">
            密钥有效期：{{ campaign.minDays }}-{{ campaign.maxDays }} 天随机
          </div>
        </div>

        <!-- 表单区域 -->
        <div class="form-section">
          <!-- 邮箱输入 -->
          <div class="form-group">
            <label>QQ邮箱地址</label>
            <div class="input-wrapper">
              <input
                v-model="email"
                type="email"
                placeholder="请输入QQ邮箱，如：123456@qq.com"
                :disabled="isLoading"
                @keyup.enter="handleClaim"
              />
              <svg class="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p class="input-hint">* 仅限QQ邮箱，每个邮箱每天限领1次</p>
          </div>

          <!-- 错误提示 -->
          <div v-if="error" class="alert alert-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {{ error }}
          </div>

          <!-- 成功提示 -->
          <div v-if="success" class="alert alert-success">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <strong>领取成功！</strong>
              <span>{{ success }}</span>
            </div>
          </div>

          <!-- 领取按钮 -->
          <button
            @click="handleClaim"
            :disabled="isLoading || !email || !!success"
            class="claim-btn"
            :class="{ loading: isLoading, success: success }"
          >
            <span v-if="isLoading" class="loading-spinner"></span>
            <span v-else-if="success">✓ 已领取</span>
            <span v-else>立即领取</span>
          </button>

          <!-- 说明文字 -->
          <div class="form-footer">
            <p>密钥将发送至您的邮箱，请注意查收</p>
            <p>如未收到，请检查垃圾邮件文件夹</p>
            <p>可加入Q群：1082121037关注群内最新通知</p>
          </div>
        </div>
      </div>

      <!-- 底部链接 -->
      <div class="bottom-links">
        <button @click="goToLogin" class="link-btn">已有账号？立即登录</button>
        <span class="divider">|</span>
        <button @click="goToLogin" class="link-btn">注册账号</button>
        <span class="divider">|</span>
        <button @click="showSupportModal = true" class="link-btn support-link">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
          支持与反馈
        </button>
      </div>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { navigateTo } from '../router'
import axios from 'axios'

// 检查用户是否已登录（从 localStorage 读取 token）
function isUserLoggedIn(): boolean {
  const token = localStorage.getItem('token')
  return !!token
}

const email = ref('')
const isLoading = ref(false)
const error = ref('')
const success = ref('')
const campaign = ref<any>(null)
const showSupportModal = ref(false)

// 定义事件
const emit = defineEmits<{
  back: [];
}>();

// 返回
const goBack = () => {
  // 如果用户已登录，触发 back 事件让父组件处理
  if (isUserLoggedIn()) {
    emit('back');
  } else {
    navigateTo('login')
  }
}

// 跳转到登录页面
const goToLogin = () => {
  navigateTo('login')
}

// 获取当前活动信息
const fetchCampaign = async () => {
  try {
    const response = await axios.get('/api/key-distribution/campaign')
    if (response.data.success) {
      campaign.value = response.data.data
    }
  } catch (err) {
    console.error('获取活动信息失败:', err)
  }
}

// 验证QQ邮箱
const isQQEmail = (email: string): boolean => {
  return /^[1-9]\d{4,10}@qq\.com$/i.test(email)
}

// 领取密钥
const handleClaim = async () => {
  error.value = ''
  success.value = ''

  if (!email.value) {
    error.value = '请输入邮箱地址'
    return
  }

  if (!isQQEmail(email.value)) {
    error.value = '请使用QQ邮箱（如：123456@qq.com）'
    return
  }

  isLoading.value = true

  try {
    const response = await axios.post('/api/key-distribution/claim', {
      email: email.value
    })

    if (response.data.success) {
      success.value = `密钥已发送至 ${response.data.data.email}，有效期 ${response.data.data.days} 天`
      if (campaign.value) {
        campaign.value.remainingQuota--
      }
    } else {
      error.value = response.data.message || '领取失败'
    }
  } catch (err: any) {
    error.value = err.response?.data?.message || '领取失败，请稍后再试'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchCampaign()
})
</script>

<style scoped>
.getkey-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.getkey-container {
  width: 100%;
  max-width: 420px;
}

.back-btn-wrapper {
  margin-bottom: 16px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: #4b5563;
  font-size: 14px;
  cursor: pointer;
  padding: 8px 0;
  transition: color 0.2s;
}

.back-btn:hover {
  color: #1f2937;
}

.main-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.card-header {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  padding: 32px 24px;
  text-align: center;
  color: white;
}

.icon-wrapper {
  width: 64px;
  height: 64px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.card-header h1 {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 8px;
}

.card-header p {
  font-size: 14px;
  opacity: 0.9;
  margin: 0;
}

.campaign-info {
  padding: 16px 24px;
  background: #f0fdf4;
  border-bottom: 1px solid #bbf7d0;
}

.campaign-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.campaign-name {
  font-size: 14px;
  color: #374151;
  font-weight: 500;
}

.campaign-quota {
  font-size: 13px;
  color: #059669;
  font-weight: 600;
}

.campaign-days {
  font-size: 12px;
  color: #6b7280;
}

.form-section {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
}

.input-wrapper {
  position: relative;
}

.input-wrapper input {
  width: 100%;
  padding: 12px 40px 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 15px;
  transition: all 0.2s;
  box-sizing: border-box;
}

.input-wrapper input:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.input-wrapper input:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
}

.input-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
}

.input-hint {
  font-size: 12px;
  color: #6b7280;
  margin: 8px 0 0;
}

.alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
}

.alert-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
}

.alert-success {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #059669;
}

.alert-success strong {
  display: block;
  margin-bottom: 4px;
}

.claim-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.claim-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.claim-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.claim-btn.success {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.form-footer {
  text-align: center;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.form-footer p {
  font-size: 13px;
  color: #6b7280;
  margin: 4px 0;
}

.bottom-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
}

.link-btn {
  background: none;
  border: none;
  color: #059669;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 8px;
  transition: color 0.2s;
}

.link-btn:hover {
  color: #047857;
  text-decoration: underline;
}

.divider {
  color: #d1d5db;
}

@media (max-width: 480px) {
  .getkey-page {
    padding: 16px;
  }
  
  .card-header {
    padding: 24px 20px;
  }
  
  .card-header h1 {
    font-size: 20px;
  }
  
  .form-section {
    padding: 20px;
  }
}

/* 支持与反馈按钮样式 */
.support-link {
  display: inline-flex;
  align-items: center;
  color: #ff6b6b;
}

.support-link:hover {
  color: #ff5252;
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
  z-index: 1000;
  padding: 20px;
}

.support-modal {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  animation: modalSlideIn 0.3s ease;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
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
  display: flex;
  align-items: center;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.support-close-btn {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.support-close-btn:hover {
  background: #f3f4f6;
  color: #4b5563;
}

.support-modal-body {
  padding: 24px;
}

.support-description {
  display: flex;
  align-items: flex-start;
  color: #4b5563;
  font-size: 14px;
  line-height: 1.6;
  margin: 0 0 24px 0;
}

.support-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.support-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  border-radius: 12px;
  text-decoration: none;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.support-button svg {
  margin-bottom: 8px;
}

.support-button span {
  font-size: 16px;
  font-weight: 600;
}

.support-button small {
  font-size: 12px;
  margin-top: 4px;
  opacity: 0.8;
}

.sponsor-btn {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
  color: white;
}

.sponsor-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(255, 107, 107, 0.4);
}

.feedback-btn {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.feedback-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
}

.support-footer {
  text-align: center;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.support-footer p {
  color: #6b7280;
  font-size: 14px;
  margin: 0;
}
</style>
