<template>
  <!-- 未登录状态：显示路由页面 -->
  <template v-if="!userStore.isLoggedIn">
    <component :is="currentComponent" />
  </template>

  <!-- 已登录状态：显示主应用或领取密钥页面 -->
  <template v-else>
    <!-- 领取密钥页面 -->
    <GetKeyView v-if="showGetKeyView" @back="showGetKeyView = false" />
    
    <!-- 主应用 -->
    <div v-else class="flex h-screen bg-primary text-primary">
    <!-- 公告弹窗 -->
    <AnnouncementModal />
    <!-- 移动端遮罩层 -->
    <div
      v-if="isSidebarOpen"
      class="mobile-overlay"
      @click="isSidebarOpen = false"
    ></div>

    <!-- 侧边栏 -->
    <Sidebar
      :accounts="userStore.accounts"
      :selectedAccount="selectedAccount"
      :isOpen="isSidebarOpen"
      @select-account="selectAccount"
      @add-account="showAddAccountDialog = true"
      @delete-account="deleteAccount"
      @logout="handleLogout"
      @close="isSidebarOpen = false"
      @get-key="showGetKeyView = true"
    />

    <!-- 主内容区域 -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- 顶部导航栏 -->
      <header class="bg-secondary shadow-md p-5 flex justify-between items-center border-b border-border-color transition-all duration-300">
        <div class="flex items-center gap-3">
          <!-- 移动端菜单按钮 -->
          <button
            class="mobile-menu-btn"
            @click="isSidebarOpen = !isSidebarOpen"
            aria-label="切换菜单"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>

          <!-- 选中账号信息 -->
          <div v-if="selectedAccount" class="selected-account-info">
            <div class="account-avatar">{{ selectedAccount.name.charAt(0) }}</div>
            <div class="account-details">
              <div class="account-name">{{ selectedAccount.name }}</div>
              <div class="account-status" :class="selectedAccount.isRunning ? 'status-running' : 'status-stopped'">
                <span class="status-dot"></span>
                {{ selectedAccount.isRunning ? '运行中' : '已停止' }}
              </div>
            </div>
            <!-- 重新登录按钮 -->
            <ReloginButton @click="showReloginDialog = true" />

            <!-- 全息开关 - 启动/停止脚本 -->
            <HoloToggle
              :model-value="selectedAccount.isRunning || false"
              @update:model-value="toggleScript"
            />
          </div>
        </div>
        <div class="flex items-center gap-3">
          <!-- 管理员入口 -->
          <GlassButton
            v-if="userStore.isAdmin"
            primary
            small
            @click="showAdminPanel = true"
          >
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
              </svg>
            </template>
            管理员
          </GlassButton>

          <!-- 用户卡片 -->
          <div class="user-card" @click="showUserMenu = !showUserMenu">
            <div class="user-avatar">
              {{ userStore.user?.username?.charAt(0)?.toUpperCase() || 'U' }}
            </div>
            <div class="user-info">
              <span class="user-name">{{ userStore.user?.username }}</span>
              <span class="user-role">主账号</span>
            </div>
            <svg class="user-menu-arrow" :class="{ 'open': showUserMenu }" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>

            <!-- 用户下拉菜单 -->
            <div v-if="showUserMenu" class="user-dropdown" @click.stop>
              <div class="dropdown-item" @click="showChangePasswordDialog = true; showUserMenu = false">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <span>修改密码</span>
              </div>
              <div class="dropdown-item" @click="showChangeKeyDialog = true; showUserMenu = false">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                </svg>
                <span>更换密钥</span>
              </div>
              <div class="dropdown-item" @click="showUpgradeKeyDialog = true; showUserMenu = false">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                </svg>
                <span>升级密钥</span>
              </div>
              <div class="dropdown-divider"></div>
              <div class="dropdown-item dropdown-item-danger" @click="handleLogout">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span>退出登录</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- 内容区域 -->
      <main ref="mainContent" class="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 pb-28">
        <!-- 滚动快捷按钮 -->
        <div class="scroll-buttons" v-if="showScrollButtons">
          <button class="scroll-btn scroll-top" @click="scrollToTop" title="回到顶部">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
          </button>
          <button class="scroll-btn scroll-bottom" @click="scrollToBottom" title="回到底部">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>

        <div v-if="userStore.isLoading" class="flex flex-col items-center justify-center h-full">
          <SVGLoader :size="80" class="mb-6" />
          <p class="text-secondary font-medium">加载中...</p>
        </div>
        <FarmConsole
          v-else-if="selectedAccount"
          :account="selectedAccount"
          :logs="accountLogs[selectedAccount.id] || []"
          v-model="activeTab"
          @refresh-data="refreshAccountData(selectedAccount.id)"
          @toggle-script="toggleScript"
          @save-config="saveConfig"
          @relogin="showReloginDialog = true"
          @clear-logs="clearAccountLogs"
        />
        <div v-else class="flex flex-col items-center justify-center h-full fade-in">
          <div class="w-24 h-24 mb-8 text-tertiary flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          </div>
          <h3 class="text-2xl font-bold text-primary mb-3">农场控制台</h3>
          <p class="text-secondary max-w-md text-center">选择左侧账号查看详情，或添加账号开始使用农场机器人</p>
          <GlassButton
            primary
            class="mt-8 px-8 py-3"
            @click="showAddAccountDialog = true"
          >
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </template>
            添加账号
          </GlassButton>
        </div>

        <!-- 页脚 -->
        <footer class="footer mt-5">
          <div class="container">
            <div class="row">
              <div class="col-12 text-center">
                <p class="mb-0">© <a href="https://xuanji.hk-gov.com" target="_blank" rel="noopener noreferrer">
                  Powered by 玄机博客
                </a></p>
              </div>
            </div>
          </div>
        </footer>
      </main>

      <!-- 底部 Tab 导航栏 -->
      <nav v-if="selectedAccount" class="bottom-tab-bar">
        <div class="tab-container">
          <button
            v-for="tab in bottomTabs"
            :key="tab.id"
            class="tab-item"
            :class="{ active: activeTab === tab.id }"
            @click="switchTab(tab.id)"
          >
            <div class="tab-icon" v-html="tab.icon"></div>
            <span class="tab-label">{{ tab.name }}</span>
          </button>
        </div>
      </nav>
    </div>

    <!-- 添加账号对话框 -->
    <AddAccountDialog
      v-if="showAddAccountDialog"
      @close="showAddAccountDialog = false"
      @add-account="addAccount"
    />

    <!-- 重新登录对话框 -->
    <ReloginDialog
      v-if="selectedAccount"
      v-model:visible="showReloginDialog"
      :account-id="selectedAccount.id"
      :account-name="selectedAccount.name"
      @success="handleReloginSuccess"
    />

    <!-- 管理员面板 -->
    <AdminPanel
      v-if="showAdminPanel"
      @close="showAdminPanel = false"
    />

    <!-- 修改密码对话框 -->
    <ChangePasswordDialog
      v-if="showChangePasswordDialog"
      @close="showChangePasswordDialog = false"
      @success="handlePasswordChanged"
    />

    <!-- 更换密钥对话框 -->
    <ChangeKeyDialog
      v-if="showChangeKeyDialog"
      @close="showChangeKeyDialog = false"
    />

    <!-- 升级密钥对话框 -->
    <UpgradeKeyDialog
      v-if="showUpgradeKeyDialog"
      @close="showUpgradeKeyDialog = false"
    />
  </div>
  </template>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, defineAsyncComponent } from 'vue';
import axios from 'axios';
import { useUserStore } from './stores/user';
import { currentComponent } from './router';
import Sidebar from './components/Sidebar.vue';
import FarmConsole from './components/FarmConsole.vue';
import AddAccountDialog from './components/AddAccountDialog.vue';
import ReloginDialog from './components/ReloginDialog.vue';
import GetKeyView from './views/GetKeyView.vue';
import SVGLoader from './components/SVGLoader.vue';
import GlassButton from './components/GlassButton.vue';
import HoloToggle from './components/HoloToggle.vue';
import ReloginButton from './components/ReloginButton.vue';

// 动态导入不常用的对话框组件
const AdminPanel = defineAsyncComponent(() => import('./components/AdminPanel.vue'));
const ChangePasswordDialog = defineAsyncComponent(() => import('./components/ChangePasswordDialog.vue'));
const ChangeKeyDialog = defineAsyncComponent(() => import('./components/ChangeKeyDialog.vue'));
const UpgradeKeyDialog = defineAsyncComponent(() => import('./components/UpgradeKeyDialog.vue'));
const AnnouncementModal = defineAsyncComponent(() => import('./components/AnnouncementModal.vue'));

const userStore = useUserStore();

// 选中的账号
const selectedAccount = ref<any>(null);
const showAddAccountDialog = ref(false);
const showReloginDialog = ref(false);
const showAdminPanel = ref(false);
const showChangePasswordDialog = ref(false);
const showChangeKeyDialog = ref(false);
const showUpgradeKeyDialog = ref(false);
const showUserMenu = ref(false);
const isSidebarOpen = ref(false); // 移动端侧边栏状态
const showGetKeyView = ref(false); // 是否显示领取密钥页面
const accountLogs = ref<Record<string, string[]>>({});
const activeTab = ref('overview');
const mainContent = ref<HTMLElement | null>(null);
const showScrollButtons = ref(false);

// 底部 Tab 配置
const bottomTabs = [
  {
    id: 'overview',
    name: '概览',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`
  },
  {
    id: 'land',
    name: '土地',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`
  },
  {
    id: 'log',
    name: '日志',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`
  },
  {
    id: 'config',
    name: '配置',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`
  },
  {
    id: 'bag',
    name: '背包',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`
  },
  {
    id: 'ranking',
    name: '排行',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>`
  }
];

// 切换 Tab
function switchTab(tabId: string) {
  activeTab.value = tabId;
}
let refreshTimer: number | null = null;
let heartbeatTimer: number | null = null;
let logEventSource: EventSource | null = null; // SSE 连接
let reconnectTimer: number | null = null; // 重连定时器
const RECONNECT_DELAY = 3000; // 重连延迟 3 秒
const MAX_RECONNECT_ATTEMPTS = 5; // 最大重连次数
let reconnectAttempts = 0; // 当前重连次数

// 滚动到顶部
function scrollToTop() {
  mainContent.value?.scrollTo({ top: 0, behavior: 'smooth' });
}

// 滚动到底部
function scrollToBottom() {
  if (mainContent.value) {
    mainContent.value.scrollTo({ top: mainContent.value.scrollHeight, behavior: 'smooth' });
  }
}

// 检查是否显示滚动按钮
function checkScroll() {
  if (mainContent.value) {
    const scrollHeight = mainContent.value.scrollHeight;
    const clientHeight = mainContent.value.clientHeight;
    showScrollButtons.value = scrollHeight > clientHeight + 100; // 内容超过视口100px才显示
  }
}



// 选择账号
function selectAccount(account: any) {
  // 清理其他账号的日志以释放内存（保留当前选中账号的日志）
  const currentId = selectedAccount.value?.id;
  if (currentId && currentId !== account.id) {
    // 只保留当前和即将选中的账号日志，其他全部清理
    const logsToKeep: Record<string, string[]> = {};
    logsToKeep[account.id] = accountLogs.value[account.id] || [];
    accountLogs.value = logsToKeep;
  }

  // 重置重连次数
  reconnectAttempts = 0;

  selectedAccount.value = account;
  refreshAccountData(account.id);
  // 连接 SSE 实时日志
  connectLogStream(account.id);
}

// 当前连接的账号ID
let currentStreamAccountId: string | null = null;

// 连接 SSE 实时日志流
function connectLogStream(accountId: string) {
  // 如果已经在连接同一个账号，不重复连接
  if (currentStreamAccountId === accountId && logEventSource) {
    return;
  }

  // 清除重连定时器
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  // 关闭之前的连接
  if (logEventSource) {
    logEventSource.close();
    logEventSource = null;
  }

  currentStreamAccountId = accountId;

  // 创建 SSE 连接
  const token = localStorage.getItem('token');
  if (!token) {
    scheduleReconnect(accountId);
    return;
  }

  try {
    logEventSource = new EventSource(`/api/auth/accounts/${accountId}/logs/stream?token=${token}`);

    logEventSource.onopen = () => {
      console.log('SSE 连接已建立:', accountId);
      // 连接成功，重置重连次数
      reconnectAttempts = 0;
    };

    logEventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'init') {
          // 初始化日志（历史日志）- 限制最多200条
          const logs = data.logs || [];
          accountLogs.value[accountId] = logs.slice(-200);
        } else if (data.type === 'log') {
          // 实时日志
          const logs = accountLogs.value[accountId] || [];
          logs.push(data.log);
          // 限制日志数量，最多保留 200 条（减少内存占用）
          if (logs.length > 200) {
            logs.shift();
          }
          accountLogs.value[accountId] = logs;
        } else if (data.type === 'error') {
          // 服务端返回的错误，不可恢复，不再重连
          console.error('SSE 服务端错误:', data.code, data.message);
          // 关闭连接
          if (logEventSource) {
            logEventSource.close();
            logEventSource = null;
          }
          // 添加到日志显示
          const logs = accountLogs.value[accountId] || [];
          logs.push(`[系统] 日志连接错误: ${data.message}`);
          accountLogs.value[accountId] = logs;
          // 不再重连
          return;
        }
        // heartbeat 类型不需要处理
      } catch (error) {
        console.error('解析日志数据失败:', error);
      }
    };

    logEventSource.onerror = (error) => {
      console.error('SSE 连接错误:', error);
      // 关闭当前连接
      if (logEventSource) {
        logEventSource.close();
        logEventSource = null;
      }
      // 连接出错时立即刷新账号状态（可能Worker已停止）
      refreshAccountData(accountId);
      // 安排重连
      scheduleReconnect(accountId);
    };
  } catch (error) {
    console.error('创建 SSE 连接失败:', error);
    scheduleReconnect(accountId);
  }
}

// 安排重连
function scheduleReconnect(accountId: string) {
  // 如果当前选中的账号已经不是这个账号，不需要重连
  if (selectedAccount.value?.id !== accountId) {
    return;
  }

  // 检查是否超过最大重连次数
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log(`SSE 重连次数已达上限 (${MAX_RECONNECT_ATTEMPTS})，停止重连`);
    // 添加到日志显示
    const logs = accountLogs.value[accountId] || [];
    logs.push('[系统] 日志连接失败，已达到最大重连次数');
    accountLogs.value[accountId] = logs;
    return;
  }

  // 清除之前的重连定时器
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }

  reconnectAttempts++;
  console.log(`SSE 将在 ${RECONNECT_DELAY}ms 后重连... (第 ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} 次)`);
  reconnectTimer = window.setTimeout(() => {
    console.log('SSE 正在重连...');
    connectLogStream(accountId);
  }, RECONNECT_DELAY);
}

// 添加账号
async function addAccount(accountData: { code: string; platform: 'qq' | 'wx'; accountId?: string; name?: string; avatar?: string }) {
  try {
    // 使用扫码获取到的账号ID，或生成一个临时ID
    const accountId = accountData.accountId || Date.now().toString();

    const newAccount = {
      accountId: accountId,
      name: accountData.name || `新账号-${accountId.slice(-4)}`,
      platform: accountData.platform,
      code: accountData.code,
      config: {
        autoFarm: true,
        autoFriend: true,
        autoTask: true,
        autoSell: false,
        autoFertilize: true,
        useOrganicFertilizer: true,
        seedType: '白萝卜 (Lv1) 1分钟',
        minCropLevel: 0
      }
    };

    await userStore.addAccount(newAccount);
    await userStore.fetchAccounts();
    showAddAccountDialog.value = false;

    // 选中新添加的账号
    const addedAccount = userStore.accounts.find(a => a.id === accountId);
    if (addedAccount) {
      selectAccount(addedAccount);
    }
  } catch (error: any) {
    console.error('添加账号失败:', error);
    const errorMsg = error.response?.data?.message || '添加账号失败';
    alert(errorMsg);
  }
}

// 删除账号
async function deleteAccount(accountId: string) {
  if (!confirm('确定要删除这个账号吗？')) {
    return;
  }

  try {
    await userStore.deleteAccount(accountId);
    await userStore.fetchAccounts();

    if (selectedAccount.value?.id === accountId) {
      selectedAccount.value = null;
    }
  } catch (error) {
    console.error('删除账号失败:', error);
    alert('删除账号失败');
  }
}

// 退出登录
function handleLogout() {
  userStore.logout();
  selectedAccount.value = null;
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// 刷新账号数据 - 从 store 获取最新数据
async function refreshAccountData(accountId: string) {
  // 重新获取账号列表以更新数据
  await userStore.fetchAccounts();

  // 更新选中的账号
  const updatedAccount = userStore.accounts.find(a => a.id === accountId);
  if (updatedAccount && selectedAccount.value?.id === accountId) {
    selectedAccount.value = updatedAccount;
  }
}

// 处理重新登录成功
function handleReloginSuccess() {
  if (selectedAccount.value) {
    refreshAccountData(selectedAccount.value.id);
  }
}

// 处理密码修改成功
function handlePasswordChanged() {
  // 密码修改成功后退出登录，让用户用新密码重新登录
  userStore.logout();
  selectedAccount.value = null;
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// 点击外部关闭用户菜单
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest('.user-card')) {
    showUserMenu.value = false;
  }
}

// 启动/停止脚本
async function toggleScript() {
  if (!selectedAccount.value) return;

  const accountId = selectedAccount.value.id;
  const currentStatus = selectedAccount.value.isRunning;

  try {
    // 调用后端 API 启动/停止脚本
    if (currentStatus) {
      await axios.post(`/api/auth/accounts/${accountId}/stop`);
    } else {
      await axios.post(`/api/auth/accounts/${accountId}/start`);
      // 脚本启动时，在控制台输出性能监控信息
      const _0x9a8b = String.fromCharCode(95,95,120,117,97,110,106,105,95,95);
      if (window[_0x9a8b] && window[_0x9a8b].log) {
        window[_0x9a8b].log();
      }
    }

    // 添加日志
    const logs = accountLogs.value[accountId] || [];
    logs.push(`[${new Date().toLocaleTimeString()}] ${currentStatus ? '脚本已停止' : '脚本已启动'}`);
    // 如果是启动脚本，添加玄机博客信息到日志
    if (!currentStatus) {
      logs.push(`[${new Date().toLocaleTimeString()}] powered by 玄机博客：https://xuanji.hk-gov.com/`);
    }
    accountLogs.value[accountId] = logs;

    // 立即刷新数据
    await refreshAccountData(accountId);

    // 强制更新选中账号的状态
    const updatedAccount = userStore.accounts.find(a => a.id === accountId);
    if (updatedAccount) {
      selectedAccount.value = { ...updatedAccount };
    }
  } catch (error: any) {
    console.error('切换脚本状态失败:', error);
    alert(error.response?.data?.message || (currentStatus ? '停止脚本失败' : '启动脚本失败'));
  }
}

// 清空账号日志
function clearAccountLogs() {
  if (selectedAccount.value) {
    accountLogs.value[selectedAccount.value.id] = [];
  }
}

// 保存配置
async function saveConfig(configData: { config: any; farmInterval: number; friendInterval: number; email: string }) {
  if (!selectedAccount.value) return;

  const accountId = selectedAccount.value.id;

  try {
    // 转换字段名为下划线命名（后端数据库使用下划线）
    const updateData = {
      config: configData.config,
      farm_interval: configData.farmInterval,
      friend_interval: configData.friendInterval,
      email: configData.email
    };
    await userStore.updateAccount(accountId, updateData);
    alert('配置保存成功');
  } catch (error) {
    console.error('保存配置失败:', error);
    alert('保存配置失败');
  }
}

// 开始定时刷新
function startRefreshTimer() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }

  // 每3秒刷新账号数据（不再轮询日志，使用 SSE 实时推送）
  refreshTimer = window.setInterval(async () => {
    await userStore.fetchAccounts();
    // 更新当前选中的账号数据
    if (selectedAccount.value) {
      const accountId = selectedAccount.value.id;
      const updatedAccount = userStore.accounts.find(a => a.id === accountId);
      if (updatedAccount) {
        selectedAccount.value = { ...updatedAccount };
      }
    }
  }, 3000);

  // 每30秒发送心跳（更新主账号在线状态）
  heartbeatTimer = window.setInterval(() => {
    userStore.heartbeat();
  }, 30000);
}

// 密钥过期检查定时器
let keyExpiryTimer: number | null = null;

// 开始密钥过期检查
function startKeyExpiryCheck() {
  // 每 10 秒检查一次密钥是否过期
  keyExpiryTimer = window.setInterval(() => {
    if (userStore.isLoggedIn) {
      userStore.checkKeyExpiry();
    }
  }, 10000);
}

// 组件挂载时初始化
onMounted(async () => {
  await userStore.init();
  if (userStore.isLoggedIn) {
    startRefreshTimer();
    startKeyExpiryCheck(); // 启动密钥过期检查

    // 如果页面刷新前有选中的账号，恢复 SSE 连接
    if (selectedAccount.value) {
      connectLogStream(selectedAccount.value.id);
    }
  }
  document.addEventListener('click', handleClickOutside);

  // 监听滚动事件
  nextTick(() => {
    checkScroll();
    mainContent.value?.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
  });

  // 监听页面可见性变化，页面重新可见时检查并恢复 SSE 连接
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

// 处理页面可见性变化
function handleVisibilityChange() {
  if (document.visibilityState === 'visible' && selectedAccount.value) {
    // 页面重新可见时，刷新账号状态（可能Worker状态已变化）
    refreshAccountData(selectedAccount.value.id);
    // 检查 SSE 连接状态
    if (!logEventSource || logEventSource.readyState === EventSource.CLOSED) {
      console.log('页面重新可见，恢复 SSE 连接');
      connectLogStream(selectedAccount.value.id);
    }
  }
}

// 组件卸载时清理
onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  if (keyExpiryTimer) {
    clearInterval(keyExpiryTimer);
  }
  // 关闭 SSE 连接
  if (logEventSource) {
    logEventSource.close();
    logEventSource = null;
  }
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  mainContent.value?.removeEventListener('scroll', checkScroll);
  window.removeEventListener('resize', checkScroll);
});
</script>

<style>
/* 自定义样式 */
.bg-primary {
  background-color: var(--bg-primary);
}

.text-primary {
  color: var(--text-primary);
}

.bg-secondary {
  background-color: var(--bg-secondary);
}

.text-secondary {
  color: var(--text-secondary);
}

.bg-tertiary {
  background-color: var(--bg-tertiary);
}

.text-tertiary {
  color: var(--text-tertiary);
}

.border-border-color {
  border-color: var(--border-color);
}

.shadow-md {
  box-shadow: var(--shadow-md);
}

.rounded-xl {
  border-radius: var(--radius-xl);
}

.bg-gradient-primary {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
}

.text-gradient {
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.fade-in {
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--bg-tertiary);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 500;
  transition: all 0.2s;
  cursor: pointer;
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

/* 管理员按钮样式 */
.admin-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  border: none;
  border-radius: 10px;
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
}

.admin-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(139, 92, 246, 0.4);
  background: linear-gradient(135deg, #7c3aed, #6d28d9);
}

.admin-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.admin-text {
  white-space: nowrap;
}

/* 用户卡片样式 */
.user-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px 6px 6px;
  background: linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary));
  border: 1px solid var(--border-color);
  border-radius: 50px;
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  user-select: none;
}

.user-card:hover {
  border-color: var(--primary-color);
  box-shadow: 0 2px 12px rgba(59, 130, 246, 0.15);
}

.user-menu-arrow {
  color: var(--text-secondary);
  transition: transform 0.3s ease;
  margin-left: 4px;
}

.user-menu-arrow.open {
  transform: rotate(180deg);
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  border: 1px solid #e2e8f0;
  min-width: 160px;
  padding: 6px;
  z-index: 100;
  animation: dropdownFadeIn 0.2s ease;
}

@keyframes dropdownFadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #374151;
  font-size: 14px;
  font-weight: 500;
}

.dropdown-item:hover {
  background: #f1f5f9;
  color: #3b82f6;
}

.dropdown-item svg {
  color: #6b7280;
}

.dropdown-item:hover svg {
  color: #3b82f6;
}

.dropdown-divider {
  height: 1px;
  background: #e2e8f0;
  margin: 6px 0;
}

.dropdown-item-danger {
  color: #ef4444;
}

.dropdown-item-danger svg {
  color: #ef4444;
}

.dropdown-item-danger:hover {
  background: #fef2f2;
  color: #dc2626;
}

.dropdown-item-danger:hover svg {
  color: #dc2626;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
}

.user-role {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.2;
}

/* 退出按钮样式 */
.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.3s ease;
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  transform: scale(1.1);
}

/* 选中账号信息样式 */
.selected-account-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: 16px;
  padding-left: 16px;
  border-left: 1px solid var(--border-color);
}

.account-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 16px;
  flex-shrink: 0;
}

.account-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.account-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.status-running {
  color: #22c55e;
}

.status-running .status-dot {
  animation: pulse 2s ease-in-out infinite;
}

.status-stopped {
  color: #ef4444;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 移动端菜单按钮 */
.mobile-menu-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 10px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.3s ease;
}

.mobile-menu-btn:hover {
  background: var(--border-color);
}

/* 移动端遮罩层 */
.mobile-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

/* 页脚样式 */
.footer {
  padding: 20px 0;
  margin-top: 40px;
  border-top: 1px solid var(--border-color);
  background: var(--secondary-bg);
}

.footer .container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.footer .text-center {
  text-align: center;
}

.footer p {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.footer a {
  color: var(--primary-color);
  text-decoration: none;
  transition: color 0.2s;
}

.footer a:hover {
  color: var(--primary-hover);
  text-decoration: underline;
}

/* 移动端响应式样式 */
@media (max-width: 768px) {
  .mobile-menu-btn {
    display: flex;
  }

  .mobile-overlay {
    display: block;
  }

  /* 顶部导航栏优化 */
  header {
    padding: 12px 16px !important;
  }

  header h1 {
    font-size: 18px !important;
  }

  /* 选中账号信息移动端适配 */
  .selected-account-info {
    margin-left: 8px;
    padding-left: 8px;
    gap: 8px;
  }

  .account-avatar {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }

  .account-details {
    display: none;
  }

  /* 用户卡片简化 */
  .user-info {
    display: none !important;
  }

  .user-card {
    padding: 4px !important;
  }

  /* 管理员按钮简化 */
  .admin-text {
    display: none;
  }

  .admin-btn {
    padding: 8px !important;
  }

  /* 内容区域优化 */
  main {
    padding: 16px 16px 110px 16px !important;
  }
}

/* 滚动快捷按钮 */
.scroll-buttons {
  position: fixed;
  right: 20px;
  bottom: 100px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 100;
}

.scroll-btn {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: white;
  color: #64748b;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.scroll-btn:hover {
  background: #3b82f6;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.3);
}

.scroll-btn:active {
  transform: translateY(0);
}

/* 底部 Tab 栏样式 - 现代玻璃拟态设计 */
.bottom-tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.08);
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .bottom-tab-bar {
    background: rgba(30, 41, 59, 0.9);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
}

.tab-container {
  display: flex;
  align-items: center;
  justify-content: space-around;
  width: 100%;
  max-width: 700px;
  height: 100%;
  padding: 0 20px;
  gap: 8px;
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 16px;
  flex: 1;
  max-width: 90px;
  position: relative;
}

.tab-item::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 197, 253, 0.1) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.tab-item:hover::before {
  opacity: 1;
}

.tab-item:hover {
  transform: translateY(-2px);
}

.tab-item.active {
  background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
  transform: translateY(-4px);
}

.tab-item.active::before {
  display: none;
}

.tab-item.active .tab-icon {
  color: white;
  transform: translateY(-2px) scale(1.1);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.tab-item.active .tab-label {
  color: white;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.tab-icon {
  color: #64748b;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.tab-icon svg {
  width: 26px;
  height: 26px;
  stroke-width: 1.8;
}

.tab-label {
  font-size: 12px;
  color: #64748b;
  transition: all 0.3s ease;
  white-space: nowrap;
  font-weight: 500;
  position: relative;
  z-index: 1;
}

/* 未选中时的悬停效果 */
.tab-item:not(.active):hover .tab-icon {
  color: #3b82f6;
  transform: scale(1.05);
}

.tab-item:not(.active):hover .tab-label {
  color: #3b82f6;
}

/* 小屏幕手机额外优化 */
@media (max-width: 480px) {
  header .w-10.h-10 {
    width: 32px !important;
    height: 32px !important;
    font-size: 14px !important;
  }

  .logout-btn {
    width: 36px !important;
    height: 36px !important;
  }

  /* 移动端滚动按钮调整 */
  .scroll-buttons {
    right: 12px;
    bottom: 90px;
  }

  .scroll-btn {
    width: 40px;
    height: 40px;
  }

  /* 底部 Tab 栏移动端优化 */
  .bottom-tab-bar {
    height: 70px;
  }

  .tab-container {
    padding: 0 12px;
    gap: 4px;
  }

  .tab-icon svg {
    width: 22px;
    height: 22px;
  }

  .tab-label {
    font-size: 11px;
  }

  .tab-item {
    padding: 8px 10px;
    border-radius: 14px;
    max-width: 70px;
  }

  .tab-item.active {
    transform: translateY(-3px);
  }
}
</style>
