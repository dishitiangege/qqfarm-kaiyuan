<template>
  <div style="position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px;">
    <div style="background-color: white; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); width: 100%; max-width: 480px; transform: scale(1); transition: all 0.3s ease; max-height: 90vh; overflow-y: auto;">
      <!-- 对话框标题 -->
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid #e2e8f0;">
        <h2 style="font-size: 18px; font-weight: 600; color: #1e293b; margin: 0;">添加账号</h2>
        <button 
          style="padding: 8px; border-radius: 50%; border: none; background: transparent; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center;"
          onmouseover="this.style.backgroundColor='#f1f5f9';"
          onmouseout="this.style.backgroundColor='transparent';"
          @click="$emit('close')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <!-- 对话框内容 -->
      <div style="padding: 24px;">
        <!-- 登录方式切换 -->
        <div style="margin-bottom: 24px;">
          <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 12px;">
            登录方式
          </label>
          <div style="display: flex; gap: 12px; background: #f1f5f9; padding: 4px; border-radius: 10px;">
            <button
              @click="loginMode = 'manual'"
              :style="{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: loginMode === 'manual' ? '#ffffff' : 'transparent',
                color: loginMode === 'manual' ? '#3b82f6' : '#64748b',
                boxShadow: loginMode === 'manual' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }"
            >
              手动输入
            </button>
            <button
              @click="loginMode = 'qrcode'"
              :style="{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: loginMode === 'qrcode' ? '#ffffff' : 'transparent',
                color: loginMode === 'qrcode' ? '#3b82f6' : '#64748b',
                boxShadow: loginMode === 'qrcode' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }"
            >
              扫码登录
            </button>
          </div>
        </div>

        <!-- 手动输入模式 -->
        <div v-if="loginMode === 'manual'">
          <!-- 登录Code输入 -->
          <div style="margin-bottom: 20px;">
            <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 8px;">
              登录 Code
            </label>
            <input 
              type="text" 
              v-model="code"
              placeholder="请输入登录code"
              style="width: 100%; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 15px; color: #1e293b; background-color: white; transition: all 0.2s ease; outline: none; box-sizing: border-box;"
              onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)';"
              onblur="this.style.borderColor='#d1d5db'; this.style.boxShadow='none';"
            />
          </div>
          
          <!-- 平台选择 -->
          <div style="margin-bottom: 28px;">
            <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 12px;">
              平台
            </label>
            <div style="display: flex; gap: 24px;">
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 8px 12px; border-radius: 8px; transition: all 0.2s ease;" onmouseover="this.style.backgroundColor='#f8fafc';" onmouseout="this.style.backgroundColor='transparent';">
                <input 
                  type="radio" 
                  v-model="platform"
                  value="qq"
                  style="width: 20px; height: 20px; accent-color: #3b82f6; cursor: pointer;"
                />
                <span style="font-size: 15px; color: #1e293b; font-weight: 500;">QQ</span>
              </label>
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 8px 12px; border-radius: 8px; transition: all 0.2s ease;" onmouseover="this.style.backgroundColor='#f8fafc';" onmouseout="this.style.backgroundColor='transparent';">
                <input 
                  type="radio" 
                  v-model="platform"
                  value="wx"
                  style="width: 20px; height: 20px; accent-color: #3b82f6; cursor: pointer;"
                />
                <span style="font-size: 15px; color: #1e293b; font-weight: 500;">微信</span>
              </label>
            </div>
          </div>
        </div>

        <!-- 扫码登录模式 -->
        <div v-else>
          <QRCodeLogin @login-success="handleQRCodeSuccess" />
        </div>
        
        <!-- 操作按钮 -->
        <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
          <button 
            style="padding: 10px 24px; font-size: 15px; font-weight: 500; color: #64748b; background-color: #f3f4f6; border: none; border-radius: 10px; cursor: pointer; transition: all 0.2s ease;"
            onmouseover="this.style.backgroundColor='#e5e7eb';"
            onmouseout="this.style.backgroundColor='#f3f4f6';"
            @click="$emit('close')"
          >
            取消
          </button>
          <button 
            v-if="loginMode === 'manual'"
            style="padding: 10px 24px; font-size: 15px; font-weight: 600; color: white; background-color: #3b82f6; border: none; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);"
            onmouseover="this.style.backgroundColor='#2563eb'; this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(59, 130, 246, 0.4)';"
            onmouseout="this.style.backgroundColor='#3b82f6'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(59, 130, 246, 0.3)';"
            @click="handleAddAccount"
          >
            添加
          </button>
          <button
            v-else
            :disabled="!qrCode"
            class="add-btn"
            :class="{ 'btn-disabled': !qrCode, 'btn-enabled': qrCode }"
            @click="handleAddAccount"
          >
            添加账号
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import QRCodeLogin from './QRCodeLogin.vue';

// 登录模式: manual(手动输入) | qrcode(扫码登录)
const loginMode = ref<'manual' | 'qrcode'>('manual');

// 表单数据
const code = ref('');
const platform = ref<'qq' | 'wx'>('qq');
const qrCode = ref('');
const qrUin = ref('');
const qrAvatar = ref('');

// Emits
const emit = defineEmits<{
  'close': [];
  'add-account': [{ code: string; platform: 'qq' | 'wx'; accountId?: string; name?: string; avatar?: string }];
}>();

// 处理扫码登录成功
function handleQRCodeSuccess(data: { code: string; uin: string; avatar: string }) {
  qrCode.value = data.code;
  qrUin.value = data.uin;
  qrAvatar.value = data.avatar;
}

// 处理添加账号
function handleAddAccount() {
  if (loginMode.value === 'manual') {
    // 手动输入模式
    if (!code.value.trim()) {
      alert('请输入登录code');
      return;
    }

    emit('add-account', {
      code: code.value.trim(),
      platform: platform.value
    });
  } else {
    // 扫码登录模式
    if (!qrCode.value) {
      alert('请先完成扫码登录');
      return;
    }

    // 使用扫码获取到的账号信息
    emit('add-account', {
      code: qrCode.value,
      platform: 'qq',
      accountId: qrUin.value,
      name: `QQ账号-${qrUin.value}`,
      avatar: qrAvatar.value
    });
  }
}
</script>

<style scoped>
.add-btn {
  padding: 10px 24px;
  font-size: 15px;
  font-weight: 600;
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.btn-enabled {
  background-color: #3b82f6;
}

.btn-enabled:hover {
  background-color: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.btn-disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}
</style>
