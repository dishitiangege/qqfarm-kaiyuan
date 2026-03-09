import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import axios from 'axios';

// 使用相对路径，自动适配当前域名
const API_BASE_URL = '';

// 解析 JWT token
function parseJwt(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1]!;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
}

// 检查 token 是否过期
function isTokenExpired(token: string): boolean {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return true;
  // 提前 5 分钟认为过期，避免在请求过程中过期
  return payload.exp * 1000 < Date.now() + 5 * 60 * 1000;
}

// 获取 token 过期时间（用于显示）
function getTokenExpiryTime(token: string): Date | null {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return null;
  return new Date(payload.exp * 1000);
}

interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
  status: string;
  maxAccounts?: number;
  keyExpiresAt?: string;
  upgradeExpiresAt?: string;
}

interface FarmAccount {
  id: string;
  name: string;
  platform: string;
  level: number;
  config: any;
  email: string;
  farmInterval: number;
  friendInterval: number;
  isRunning: boolean;
  status: string;
  stats: any;
  friends: any[];
}

export const useUserStore = defineStore('user', () => {
  // State
  const token = ref<string | null>(localStorage.getItem('token'));
  const user = ref<User | null>(null);
  const accounts = ref<FarmAccount[]>([]);
  const isLoading = ref(false);

  // Getters
  const isLoggedIn = computed(() => !!token.value && !!user.value);
  const isAdmin = computed(() => user.value?.role === 'admin');

  // Actions
  
  // 设置 axios 默认 headers
  function setAuthHeader() {
    if (token.value) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }

  // 添加 axios 请求拦截器，检查 token 是否过期
  let isLoggingOut = false; // 防止重复触发 logout

  axios.interceptors.request.use(
    (config) => {
      // 检查 token 是否过期
      if (token.value && isTokenExpired(token.value)) {
        console.log('[Axios] Token 已过期，清除登录状态');
        if (!isLoggingOut) {
          isLoggingOut = true;
          logout();
          // 延迟重置标志，避免短时间内重复触发
          setTimeout(() => { isLoggingOut = false; }, 1000);
        }
        // 返回一个被拒绝的 Promise，阻止请求继续
        return Promise.reject(new Error('登录已过期，请重新登录'));
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // 添加 axios 响应拦截器，处理 401/403 错误
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      // 处理 401 (未授权) 或 403 (令牌无效/过期)
      if (error.response?.status === 401 || error.response?.status === 403) {
        // 只处理认证相关的错误消息
        const message = error.response?.data?.message || '';
        const isAuthError = message.includes('令牌') ||
                           message.includes('过期') ||
                           message.includes('认证') ||
                           message.includes('登录');

        if (isAuthError && !isLoggingOut) {
          console.log('[Axios] 收到认证错误响应，清除登录状态:', message);
          isLoggingOut = true;
          logout();
          // 延迟重置标志
          setTimeout(() => { isLoggingOut = false; }, 1000);
        }
      }
      return Promise.reject(error);
    }
  );

  // 登录
  async function login(username: string, password: string): Promise<boolean> {
    try {
      isLoading.value = true;
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        username,
        password
      });

      if (response.data.success) {
        token.value = response.data.data.token;
        user.value = response.data.data.user;
        localStorage.setItem('token', token.value!);
        setAuthHeader();
        return true;
      }
      return false;
    } catch (error) {
      console.error('登录失败:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  // 注册
  async function register(username: string, password: string, email?: string, registrationKey?: string): Promise<boolean> {
    try {
      isLoading.value = true;
      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, {
        username,
        password,
        email,
        registrationKey
      });

      return response.data.success;
    } catch (error) {
      console.error('注册失败:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  // 获取当前用户信息
  async function fetchUserInfo(): Promise<boolean> {
    try {
      setAuthHeader();
      const response = await axios.get(`${API_BASE_URL}/api/auth/me`);

      if (response.data.success) {
        user.value = response.data.data;
        return true;
      }
      return false;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      logout();
      return false;
    }
  }

  // 发送心跳（更新活动时间）
  async function heartbeat(): Promise<void> {
    if (!token.value) return;
    try {
      setAuthHeader();
      await axios.post(`${API_BASE_URL}/api/auth/heartbeat`);
    } catch (error) {
      // 心跳失败不处理
    }
  }

  // 获取用户完整信息（包含在线状态）
  async function fetchUserFullInfo(): Promise<boolean> {
    try {
      setAuthHeader();
      const response = await axios.get(`${API_BASE_URL}/api/auth/me/full`);

      if (response.data.success) {
        user.value = response.data.data;
        return true;
      }
      return false;
    } catch (error) {
      console.error('获取用户完整信息失败:', error);
      return false;
    }
  }

  // 获取用户的农场账号
  async function fetchAccounts(): Promise<boolean> {
    try {
      setAuthHeader();
      const response = await axios.get(`${API_BASE_URL}/api/auth/accounts`);

      if (response.data.success) {
        accounts.value = response.data.data;
        return true;
      }
      return false;
    } catch (error) {
      console.error('获取账号列表失败:', error);
      return false;
    }
  }

  // 添加农场账号
  async function addAccount(accountData: any): Promise<boolean> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/accounts`, accountData);
      return response.data.success;
    } catch (error) {
      console.error('添加账号失败:', error);
      throw error;
    }
  }

  // 更新农场账号
  async function updateAccount(accountId: string, updateData: any): Promise<boolean> {
    try {
      const response = await axios.put(`${API_BASE_URL}/api/auth/accounts/${accountId}`, updateData);
      return response.data.success;
    } catch (error) {
      console.error('更新账号失败:', error);
      throw error;
    }
  }

  // 删除农场账号
  async function deleteAccount(accountId: string): Promise<boolean> {
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/auth/accounts/${accountId}`);
      return response.data.success;
    } catch (error) {
      console.error('删除账号失败:', error);
      throw error;
    }
  }

  // 管理员删除任意用户的农场账号
  async function adminDeleteAccount(accountId: string): Promise<boolean> {
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/auth/admin/accounts/${accountId}`);
      return response.data.success;
    } catch (error) {
      console.error('管理员删除账号失败:', error);
      throw error;
    }
  }

  // 修改密码
  async function changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/change-password`, {
        oldPassword,
        newPassword
      });
      return response.data.success;
    } catch (error) {
      console.error('修改密码失败:', error);
      throw error;
    }
  }

  // ========== 管理员功能 ==========

  // 获取所有用户
  async function getAllUsers(page = 1, pageSize = 20): Promise<any> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/admin/users`, {
        params: { page, pageSize }
      });
      return response.data.data;
    } catch (error) {
      console.error('获取用户列表失败:', error);
      throw error;
    }
  }

  // 冻结用户
  async function freezeUser(userId: number): Promise<boolean> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/admin/users/${userId}/freeze`);
      return response.data.success;
    } catch (error) {
      console.error('冻结用户失败:', error);
      throw error;
    }
  }

  // 解冻用户
  async function unfreezeUser(userId: number): Promise<boolean> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/admin/users/${userId}/unfreeze`);
      return response.data.success;
    } catch (error) {
      console.error('解冻用户失败:', error);
      throw error;
    }
  }

  // 删除用户
  async function deleteUser(userId: number): Promise<boolean> {
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/auth/admin/users/${userId}`);
      return response.data.success;
    } catch (error) {
      console.error('删除用户失败:', error);
      throw error;
    }
  }

  // 重置用户密码（管理员）
  async function resetUserPassword(userId: number, password: string = 'user666'): Promise<string> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/admin/users/${userId}/reset-password`, {
        password
      });
      return response.data.message;
    } catch (error) {
      console.error('重置密码失败:', error);
      throw error;
    }
  }

  // 获取所有账号（管理员）
  async function getAllAccounts(page = 1, pageSize = 20, filters?: any): Promise<any> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/admin/accounts`, {
        params: { page, pageSize, ...filters }
      });
      return response.data.data;
    } catch (error) {
      console.error('获取账号列表失败:', error);
      throw error;
    }
  }

  // 获取指定用户的所有农场账号（管理员）
  async function getUserAccounts(userId: number): Promise<any[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/admin/users/${userId}/accounts`);
      return response.data.data;
    } catch (error) {
      console.error('获取用户账号列表失败:', error);
      throw error;
    }
  }

  // ========== 密钥管理功能 ==========

  // 获取所有密钥（管理员）
  async function getAllKeys(page = 1, pageSize = 20): Promise<any> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/keys/admin/keys`, {
        params: { page, pageSize }
      });
      return response.data.data;
    } catch (error) {
      console.error('获取密钥列表失败:', error);
      throw error;
    }
  }

  // 生成密钥（管理员）
  async function createKey(expiresAt: string, assignedUserId?: number): Promise<any> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/keys/admin/keys`, {
        expiresAt,
        assignedUserId
      });
      return response.data.data;
    } catch (error) {
      console.error('生成密钥失败:', error);
      throw error;
    }
  }

  // 管理员更换用户密钥
  async function adminChangeUserKey(userId: number, key: string): Promise<void> {
    try {
      await axios.post(`${API_BASE_URL}/api/keys/admin/users/${userId}/change-key`, { key });
    } catch (error) {
      console.error('更换用户密钥失败:', error);
      throw error;
    }
  }

  // 用户更换自己的密钥
  async function changeMyKey(key: string): Promise<void> {
    try {
      await axios.post(`${API_BASE_URL}/api/keys/change-key`, { key });
    } catch (error) {
      console.error('更换密钥失败:', error);
      throw error;
    }
  }

  // 获取用户当前密钥信息
  async function getMyKeyInfo(): Promise<any> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/keys/my-key`);
      return response.data.data;
    } catch (error) {
      console.error('获取密钥信息失败:', error);
      throw error;
    }
  }

  // 删除单个密钥（管理员）
  async function deleteKey(keyId: number): Promise<boolean> {
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/keys/admin/keys/${keyId}`);
      return response.data.success;
    } catch (error) {
      console.error('删除密钥失败:', error);
      throw error;
    }
  }

  // 批量删除密钥（管理员）
  async function deleteKeysBatch(keyIds: number[]): Promise<any> {
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/keys/admin/keys`, {
        data: { keyIds }
      });
      return response.data.data;
    } catch (error) {
      console.error('批量删除密钥失败:', error);
      throw error;
    }
  }

  // 修改用户子账号上限（管理员）
  async function updateUserMaxAccounts(userId: number, maxAccounts: number): Promise<void> {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/admin/users/${userId}/max-accounts`, {
        maxAccounts
      });
    } catch (error) {
      console.error('修改子账号上限失败:', error);
      throw error;
    }
  }

  // ========== 升级密钥管理功能 ==========

  // 获取所有升级密钥（管理员）
  async function getAllUpgradeKeys(filters?: { keyType?: string; isUsed?: boolean }): Promise<any[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/upgrade-keys/list`, {
        params: filters
      });
      return response.data.data;
    } catch (error) {
      console.error('获取升级密钥列表失败:', error);
      throw error;
    }
  }

  // 创建升级密钥（管理员）
  async function createUpgradeKey(
    keyType: 'level1' | 'level2' | 'custom',
    count: number = 1,
    customConfig?: { maxAccounts: number; extendDays: number }
  ): Promise<any> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/upgrade-keys/create`, {
        keyType,
        count,
        customConfig
      });
      return response.data.data;
    } catch (error) {
      console.error('创建升级密钥失败:', error);
      throw error;
    }
  }

  // 删除升级密钥（管理员）
  async function deleteUpgradeKey(keyId: number): Promise<boolean> {
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/upgrade-keys/${keyId}`);
      return response.data.success;
    } catch (error) {
      console.error('删除升级密钥失败:', error);
      throw error;
    }
  }

  // 获取用户升级密钥信息（管理员）
  async function getUserUpgradeKeyInfo(userId: number): Promise<any> {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/upgrade-keys/user/${userId}`);
      return response.data.data;
    } catch (error) {
      console.error('获取用户升级密钥信息失败:', error);
      throw error;
    }
  }

  // 解绑用户升级密钥（管理员）
  async function unbindUserUpgradeKey(userId: number): Promise<any> {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/upgrade-keys/unbind/${userId}`);
      return response.data;
    } catch (error) {
      console.error('解绑用户升级密钥失败:', error);
      throw error;
    }
  }

  // 修改升级密钥有效期（管理员）
  async function updateUpgradeKeyExtendDays(keyId: number, extendDays: number): Promise<any> {
    try {
      const response = await axios.put(`${API_BASE_URL}/api/upgrade-keys/${keyId}/extend-days`, {
        extendDays
      });
      return response.data.data;
    } catch (error) {
      console.error('修改升级密钥有效期失败:', error);
      throw error;
    }
  }

  // 批量删除用户（管理员）
  async function deleteUsersBatch(userIds: number[]): Promise<any> {
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/auth/admin/users`, {
        data: { userIds }
      });
      return response.data;
    } catch (error) {
      console.error('批量删除用户失败:', error);
      throw error;
    }
  }

  // 退出登录
  function logout() {
    token.value = null;
    user.value = null;
    accounts.value = [];
    localStorage.removeItem('token');
    setAuthHeader();
  }

  // 初始化
  async function init() {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      // 检查 token 是否过期
      if (isTokenExpired(savedToken)) {
        console.log('[UserStore] Token 已过期，清除登录状态');
        logout();
        return;
      }

      token.value = savedToken;
      setAuthHeader();
      await fetchUserInfo();
      if (user.value) {
        // 检查密钥是否过期
        if (user.value.keyExpiresAt) {
          const keyExpiryDate = new Date(user.value.keyExpiresAt);
          if (keyExpiryDate < new Date()) {
            console.log('[UserStore] 密钥已过期，清除登录状态');
            alert('您的密钥已过期，请重新登录');
            logout();
            return;
          }
        }
        await fetchAccounts();
      }
    }
  }

  // 检查并处理 token 过期
  function checkTokenExpiry(): boolean {
    if (token.value && isTokenExpired(token.value)) {
      console.log('[UserStore] Token 已过期，自动退出登录');
      logout();
      return true;
    }
    return false;
  }

  // 获取当前 token 剩余有效时间（小时）
  function getTokenRemainingHours(): number | null {
    if (!token.value) return null;
    const expiryTime = getTokenExpiryTime(token.value);
    if (!expiryTime) return null;
    const remainingMs = expiryTime.getTime() - Date.now();
    return Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60)));
  }

  // 检查密钥是否过期
  function checkKeyExpiry(): boolean {
    if (!user.value?.keyExpiresAt) {
      return false;
    }
    const keyExpiryDate = new Date(user.value.keyExpiresAt);
    if (keyExpiryDate < new Date()) {
      alert('您的密钥已过期，请重新登录');
      logout();
      return true;
    }
    return false;
  }

  return {
    token,
    user,
    accounts,
    isLoading,
    isLoggedIn,
    isAdmin,
    login,
    register,
    fetchUserInfo,
    fetchUserFullInfo,
    heartbeat,
    fetchAccounts,
    addAccount,
    updateAccount,
    deleteAccount,
    adminDeleteAccount,
    changePassword,
    getAllUsers,
    freezeUser,
    unfreezeUser,
    deleteUser,
    resetUserPassword,
    getAllAccounts,
    getUserAccounts,
    getAllKeys,
    createKey,
    deleteKey,
    deleteKeysBatch,
    adminChangeUserKey,
    changeMyKey,
    getMyKeyInfo,
    updateUserMaxAccounts,
    getAllUpgradeKeys,
    createUpgradeKey,
    deleteUpgradeKey,
    getUserUpgradeKeyInfo,
    unbindUserUpgradeKey,
    updateUpgradeKeyExtendDays,
    deleteUsersBatch,
    logout,
    init,
    checkTokenExpiry,
    getTokenRemainingHours,
    checkKeyExpiry
  };
});
