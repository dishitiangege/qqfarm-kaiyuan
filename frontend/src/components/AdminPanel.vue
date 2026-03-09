<template>
  <div class="admin-overlay" @click.self="$emit('close')">
    <div class="admin-panel">
      <div class="admin-header">
        <h2>管理员控制台</h2>
        <button class="close-btn" @click="$emit('close')">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="admin-tabs">
        <button
          :class="['tab-btn', { active: activeTab === 'users' }]"
          @click="switchTab('users')"
        >
          用户管理
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'accounts' }]"
          @click="switchTab('accounts')"
        >
          子账号管理
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'keys' }]"
          @click="switchTab('keys')"
        >
          激活密钥管理
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'keyDistribution' }]"
          @click="switchTab('keyDistribution')"
        >
          密钥发放
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'upgradeKeys' }]"
          @click="switchTab('upgradeKeys')"
        >
          升级密钥管理
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'announcements' }]"
          @click="switchTab('announcements')"
        >
          公告管理
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'pendingUsers' }]"
          @click="switchTab('pendingUsers')"
        >
          用户审批
          <span v-if="pendingUsersCount > 0" class="badge">{{ pendingUsersCount }}</span>
        </button>
        <button
          :class="['tab-btn', { active: activeTab === 'settings' }]"
          @click="switchTab('settings')"
        >
          系统设置
        </button>
      </div>

      <!-- 用户管理 -->
      <div v-if="activeTab === 'users'" class="admin-content">
        <div class="toolbar">
          <div class="search-box">
            <input
              v-model="userSearch"
              type="text"
              placeholder="搜索用户名或邮箱..."
              class="search-input"
              @keyup.enter="searchUsers"
            />
            <button 
              v-if="userSearch" 
              class="clear-search-btn" 
              @click="clearUserSearch"
              title="清除搜索"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <button class="search-btn" @click="searchUsers" :disabled="isLoadingUsers">
              <svg v-if="!isLoadingUsers" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <span v-else class="spinner-small"></span>
              搜索
            </button>
          </div>
          
          <!-- 密钥到期筛选 -->
          <div class="filter-box">
            <select v-model="keyExpiryFilter" class="filter-select" title="密钥到期筛选">
              <option value="all">全部密钥状态</option>
              <option value="expired">已过期</option>
              <option value="expiring-soon">即将过期 (7天内)</option>
              <option value="valid">有效</option>
              <option value="none">未绑定密钥</option>
            </select>
          </div>
          <button
            v-if="selectedUsers.length > 0"
            class="delete-selected-btn"
            @click="deleteSelectedUsers"
            :disabled="isDeletingUsers"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            删除选中 ({{ selectedUsers.length }})
          </button>
          <button class="create-user-btn" @click="openCreateUserDialog">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            创建用户
          </button>
          <button class="refresh-btn" @click="loadUsers" :disabled="isLoadingUsers">
            <svg v-if="!isLoadingUsers" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            <span v-else class="spinner-small"></span>
            {{ isLoadingUsers ? '加载中...' : '刷新' }}
          </button>
        </div>

        <!-- 加载状态 -->
        <div v-if="isLoadingUsers" class="loading-state">
          <div class="spinner"></div>
          <p>正在加载用户列表...</p>
        </div>

        <!-- 空状态 -->
        <div v-else-if="filteredUsers.length === 0" class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <p>暂无用户数据</p>
        </div>

        <div v-else class="data-table">
          <table>
            <thead>
              <tr>
                <th class="checkbox-col">
                  <input
                    type="checkbox"
                    :checked="isAllUsersSelected"
                    @change="toggleSelectAllUsers"
                    title="全选"
                  />
                </th>
                <th>ID</th>
                <th>用户名</th>
                <th>邮箱</th>
                <th>角色</th>
                <th>状态</th>
                <th>绑定密钥</th>
                <th>密钥状态</th>
                <th>密钥到期时间</th>
                <th>子账号</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="user in filteredUsers" :key="user.id">
                <!-- 用户主行 -->
                <tr class="user-main-row" :class="{ 'expanded': expandedUserId === user.id, 'selected': selectedUsers.includes(user.id) }">
                  <td class="checkbox-col">
                    <input
                      type="checkbox"
                      :value="user.id"
                      v-model="selectedUsers"
                      :disabled="user.role === 'admin'"
                    />
                  </td>
                  <td>
                    <button
                      class="expand-btn"
                      @click="toggleUserExpand(user.id)"
                      :class="{ 'expanded': expandedUserId === user.id }"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </button>
                    {{ user.id }}
                  </td>
                  <td>{{ user.username }}</td>
                  <td>{{ user.email || '-' }}</td>
                  <td>
                    <span :class="['role-badge', user.role]">
                      {{ user.role === 'admin' ? '管理员' : '用户' }}
                    </span>
                  </td>
                  <td>
                    <span :class="['status-badge', user.status]">
                      {{ user.status === 'active' ? '正常' : user.status === 'frozen' ? '冻结' : '已删除' }}
                    </span>
                  </td>
                  <td>
                    <span v-if="user.bound_key" class="key-badge" :title="user.bound_key">
                      {{ user.bound_key.substring(0, 8) }}...
                    </span>
                    <span v-else class="no-key">-</span>
                  </td>
                  <td>
                    <span v-if="user.role === 'admin'" class="key-status-badge admin">管理员</span>
                    <span v-else-if="user.isKeyExpired" class="key-status-badge expired">已过期</span>
                    <span v-else-if="user.bound_key" class="key-status-badge valid">有效</span>
                    <span v-else class="key-status-badge none">未绑定</span>
                  </td>
                  <td>
                    <span v-if="user.role === 'admin'" class="no-key">-</span>
                    <span v-else-if="user.key_expires_at" :class="['key-expiry-time', user.isKeyExpired ? 'expired' : '']">
                      {{ formatDate(user.key_expires_at) }}
                    </span>
                    <span v-else class="no-key">-</span>
                  </td>
                  <td>
                    <span v-if="user.role === 'admin'" class="no-key">-</span>
                    <span v-else class="account-count">
                      {{ user.account_count || 0 }} / {{ user.max_accounts || 1 }}
                      <button
                        type="button"
                        class="action-btn edit-max"
                        @click.stop="editMaxAccounts(user)"
                        title="修改上限"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                    </span>
                  </td>
                  <td>{{ formatDate(user.created_at) }}</td>
                  <td>
                    <div class="action-btns">
                      <button
                        v-if="user.status === 'active' && user.role !== 'admin'"
                        class="action-btn freeze"
                        @click="freezeUser(user.id)"
                        title="冻结"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="6" y="4" width="4" height="16"></rect>
                          <rect x="14" y="4" width="4" height="16"></rect>
                        </svg>
                      </button>
                      <button
                        v-if="user.status === 'frozen'"
                        class="action-btn unfreeze"
                        @click="unfreezeUser(user.id)"
                        title="解冻"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                      </button>
                      <button
                        v-if="user.role !== 'admin'"
                        class="action-btn reset-password"
                        @click="resetPassword(user.id)"
                        title="重置密码"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                        </svg>
                      </button>
                      <button
                        v-if="user.role !== 'admin'"
                        class="action-btn change-key"
                        @click="openChangeKeyDialog(user.id)"
                        title="更换密钥"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                        </svg>
                      </button>
                      <button
                        v-if="user.role !== 'admin'"
                        class="action-btn upgrade-key"
                        @click="openBindUpgradeKeyDialog(user.id)"
                        title="绑定升级密钥"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                        </svg>
                      </button>
                      <button
                        v-if="user.role !== 'admin'"
                        class="action-btn delete"
                        @click="deleteUser(user.id)"
                        title="删除"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
                <!-- 用户子账号展开行 -->
                <tr v-if="expandedUserId === user.id" class="user-accounts-row">
                  <td colspan="12" class="accounts-cell">
                    <div class="accounts-panel">
                      <!-- 升级密钥信息 -->
                      <div class="upgrade-keys-section" v-if="user.role !== 'admin'">
                        <div class="section-header">
                          <h4>升级密钥信息</h4>
                          <button
                            v-if="(userUpgradeKeys.get(user.id)?.keys?.length || 0) > 0"
                            class="unbind-upgrade-key-btn"
                            @click="unbindUserUpgradeKey(user.id)"
                            :disabled="isUnbindingUpgradeKey === user.id"
                          >
                            <span v-if="isUnbindingUpgradeKey === user.id" class="spinner-small"></span>
                            <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                              <line x1="12" y1="2" x2="12" y2="12"></line>
                            </svg>
                            解除绑定
                          </button>
                        </div>
                        <div v-if="isLoadingUserUpgradeKeys" class="accounts-loading">
                          <div class="spinner-small"></div>
                          <span>加载中...</span>
                        </div>
                        <div v-else-if="!(userUpgradeKeys.get(user.id)?.keys?.length || 0)" class="upgrade-keys-empty">
                          <p>该用户未绑定升级密钥</p>
                        </div>
                        <div v-else class="upgrade-keys-list">
                          <table class="upgrade-keys-table">
                            <thead>
                              <tr>
                                <th>密钥</th>
                                <th>类型</th>
                                <th>延长天数</th>
                                <th>使用时间</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr v-for="key in userUpgradeKeys.get(user.id)?.keys" :key="key.id">
                                <td class="key-cell">
                                  <code>{{ key.key_value?.substring(0, 16) }}...</code>
                                </td>
                                <td>
                                  <span :class="['upgrade-key-type-badge', key.key_type]">
                                    {{ key.key_type === 'level1' ? '一级' : '二级' }}
                                  </span>
                                </td>
                                <td>{{ key.extend_days }} 天</td>
                                <td>{{ formatDate(key.used_at) }}</td>
                              </tr>
                            </tbody>
                          </table>
                          <!-- 升级记录 -->
                          <div class="upgrade-logs-section" v-if="(userUpgradeKeys.get(user.id)?.logs?.length || 0) > 0">
                            <h5>升级记录</h5>
                            <table class="upgrade-logs-table">
                              <thead>
                                <tr>
                                  <th>时间</th>
                                  <th>密钥类型</th>
                                  <th>原上限</th>
                                  <th>新上限</th>
                                  <th>延长天数</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr v-for="log in userUpgradeKeys.get(user.id)?.logs" :key="log.id">
                                  <td>{{ formatDate(log.created_at) }}</td>
                                  <td>
                                    <span :class="['upgrade-key-type-badge', log.key_type]">
                                      {{ log.key_type === 'level1' ? '一级' : '二级' }}
                                    </span>
                                  </td>
                                  <td>{{ log.old_max_accounts }} 个</td>
                                  <td>{{ log.new_max_accounts }} 个</td>
                                  <td>{{ log.extend_days }} 天</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      <div class="accounts-header">
                        <h4>子账号列表 ({{ userAccounts.get(user.id)?.length || 0 }})</h4>
                        <button class="refresh-accounts-btn" @click="loadUserAccounts(user.id)" :disabled="isLoadingUserAccounts">
                          <span v-if="isLoadingUserAccounts" class="spinner-small"></span>
                          <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                          </svg>
                          刷新
                        </button>
                      </div>

                      <!-- 加载状态 -->
                      <div v-if="isLoadingUserAccounts" class="accounts-loading">
                        <div class="spinner-small"></div>
                        <span>加载中...</span>
                      </div>

                      <!-- 空状态 -->
                      <div v-else-if="!userAccounts.get(user.id) || (userAccounts.get(user.id) || []).length === 0" class="accounts-empty">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                          <line x1="8" y1="21" x2="16" y2="21"></line>
                          <line x1="12" y1="17" x2="12" y2="21"></line>
                        </svg>
                        <p>该用户暂无子账号</p>
                      </div>

                      <!-- 子账号列表 -->
                      <div v-else class="accounts-list">
                        <table class="accounts-table">
                          <thead>
                            <tr>
                              <th>账号ID</th>
                              <th>名称</th>
                              <th>平台</th>
                              <th>Code</th>
                              <th>等级</th>
                              <th>状态</th>
                              <th>运行时间</th>
                              <th>操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="account in userAccounts.get(user.id)" :key="account.id">
                              <td class="account-id">{{ account.id }}</td>
                              <td>{{ account.name }}</td>
                              <td>
                                <span class="platform-badge" :class="account.platform">
                                  {{ account.platform === 'qq' ? 'QQ' : '微信' }}
                                </span>
                              </td>
                              <td class="code-cell" :title="account.code">
                                {{ account.code ? account.code.substring(0, 20) + '...' : '-' }}
                              </td>
                              <td>Lv{{ account.stats?.level || account.level || 0 }}</td>
                              <td>
                                <span class="status-badge" :class="account.status">
                                  {{ account.status === 'active' ? '运行中' : account.status === 'stopped' ? '已停止' : '离线' }}
                                </span>
                              </td>
                              <td>{{ formatOnlineTime(account.stats?.onlineTime) }}</td>
                              <td class="account-actions">
                                <button
                                  v-if="account.status === 'active'"
                                  class="stop-account-btn"
                                  @click="stopUserAccount(user.id, account.id)"
                                  :disabled="isStoppingAccount === account.id"
                                  title="停止脚本运行"
                                >
                                  <span v-if="isStoppingAccount === account.id" class="spinner-small"></span>
                                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="6" y="4" width="4" height="16"></rect>
                                    <rect x="14" y="4" width="4" height="16"></rect>
                                  </svg>
                                  停止
                                </button>
                                <button
                                  class="delete-account-btn"
                                  @click="deleteUserAccount(user.id, account.id)"
                                  :disabled="isDeletingAccount === account.id"
                                  title="删除子账号"
                                >
                                  <span v-if="isDeletingAccount === account.id" class="spinner-small"></span>
                                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                  </svg>
                                  删除
                                </button>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <!-- 用户分页 - 仅在非搜索模式显示 -->
        <div v-if="!isUserSearchMode" class="pagination">
          <button
            :disabled="userPage <= 1"
            @click="userPage--; loadUsers()"
          >
            上一页
          </button>
          <span>第 {{ userPage }} 页</span>
          <button
            :disabled="users.length < userPageSize"
            @click="userPage++; loadUsers()"
          >
            下一页
          </button>
        </div>
        <!-- 搜索/筛选结果显示 -->
        <div v-else class="search-result-info">
          <span>
            显示 {{ filteredUsers.length }} 个用户
            <span v-if="keyExpiryFilter !== 'all'" class="filter-tag">
              ({{ keyExpiryFilterText }})
              <button class="clear-filter-btn" @click="keyExpiryFilter = 'all'" title="清除筛选">×</button>
            </span>
          </span>
        </div>
      </div>

      <!-- 子账号管理 -->
      <div v-else-if="activeTab === 'accounts'" class="admin-content">
        <div class="toolbar">
          <div class="search-box">
            <input
              v-model="accountSearch"
              type="text"
              placeholder="搜索账号名称或ID..."
              class="search-input"
              @keyup.enter="searchAccounts"
            />
            <button
              v-if="accountSearch"
              class="clear-search-btn"
              @click="clearAccountSearch"
              title="清除搜索"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <button class="search-btn" @click="searchAccounts" :disabled="isLoadingAccounts">
              <svg v-if="!isLoadingAccounts" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <span v-else class="spinner-small"></span>
              搜索
            </button>
          </div>
          <div class="toolbar-btns">
            <button
              v-if="selectedAccounts.length > 0"
              class="stop-selected-btn"
              @click="stopSelectedAccounts"
              :disabled="isStoppingSelected"
              title="停止选中的子账号脚本"
            >
              <svg v-if="!isStoppingSelected" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
              <span v-else class="spinner-small"></span>
              {{ isStoppingSelected ? '停止中...' : `一键停止 (${selectedAccounts.length})` }}
            </button>
            <button
              class="restart-all-btn"
              @click="restartAllAccounts"
              :disabled="isRestartingAll"
              title="一键重启所有运行中的脚本"
            >
              <svg v-if="!isRestartingAll" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              <span v-else class="spinner-small"></span>
              {{ isRestartingAll ? '重启中...' : '一键重启全部' }}
            </button>
            <button class="refresh-btn" @click="loadAccounts">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              刷新
            </button>
          </div>
        </div>

        <!-- 加载状态 -->
        <div v-if="isLoadingAccounts" class="loading-state">
          <div class="spinner"></div>
          <p>正在加载子账号列表...</p>
        </div>

        <!-- 空状态 -->
        <div v-else-if="filteredAccounts.length === 0" class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <p>暂无子账号数据</p>
        </div>

        <div v-else class="data-table">
          <table>
            <thead>
              <tr>
                <th class="checkbox-col">
                  <input
                    type="checkbox"
                    :checked="isAllAccountsSelected"
                    @change="toggleSelectAllAccounts"
                    title="全选"
                  />
                </th>
                <th>账号ID</th>
                <th>名称</th>
                <th>所属用户</th>
                <th>平台</th>
                <th>等级</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="account in filteredAccounts" :key="account.account_id" :class="{ 'selected': selectedAccounts.includes(account.account_id) }">
                <td class="checkbox-col">
                  <input
                    type="checkbox"
                    :checked="selectedAccounts.includes(account.account_id)"
                    @change="toggleSelectAccount(account.account_id)"
                  />
                </td>
                <td>{{ account.account_id }}</td>
                <td>{{ account.name }}</td>
                <td>{{ account.owner_name || '-' }}</td>
                <td>{{ account.platform }}</td>
                <td>Lv{{ account.level }}</td>
                <td>
                  <span :class="['status-badge', account.status]">
                    {{ account.status === 'active' ? '运行中' : account.status === 'stopped' ? '已停止' : '离线' }}
                  </span>
                </td>
                <td>
                  <div class="action-btns">
                    <button
                      class="action-btn stop"
                      @click="stopSingleAccount(account.account_id)"
                      title="停止脚本"
                      :disabled="account.status !== 'active'"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="6" y="4" width="4" height="16"></rect>
                        <rect x="14" y="4" width="4" height="16"></rect>
                      </svg>
                    </button>
                    <button
                      class="action-btn delete"
                      @click="deleteAccount(account.account_id)"
                      title="删除"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 账号分页 - 仅在非搜索模式显示 -->
        <div v-if="!isAccountSearchMode" class="pagination">
          <button
            :disabled="accountPage <= 1"
            @click="accountPage--; loadAccounts()"
          >
            上一页
          </button>
          <span>第 {{ accountPage }} 页</span>
          <button
            :disabled="accounts.length < accountPageSize"
            @click="accountPage++; loadAccounts()"
          >
            下一页
          </button>
        </div>
        <!-- 搜索结果显示 -->
        <div v-else class="search-result-info">
          <span>搜索到 {{ filteredAccounts.length }} 个账号</span>
        </div>
      </div>

      <!-- 密钥管理 -->
      <div v-else-if="activeTab === 'keys'" class="admin-content">
        <div class="toolbar">
          <!-- 搜索框 -->
          <div class="search-box">
            <input
              v-model="keySearch"
              type="text"
              placeholder="搜索密钥或用户名..."
              class="search-input"
            />
            <button
              v-if="keySearch"
              class="clear-search-btn"
              @click="keySearch = ''"
              title="清除搜索"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <!-- 排序控件 -->
          <div class="sort-controls">
            <select v-model="keySortField" class="sort-select">
              <option value="createdAt">创建时间</option>
              <option value="expiresAt">过期时间</option>
              <option value="usedAt">使用时间</option>
            </select>
            <button
              class="sort-order-btn"
              @click="keySortOrder = keySortOrder === 'asc' ? 'desc' : 'asc'"
              :title="keySortOrder === 'asc' ? '升序' : '降序'"
            >
              <svg v-if="keySortOrder === 'asc'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <polyline points="19 12 12 19 5 12"></polyline>
              </svg>
            </button>
          </div>
          <button class="generate-key-btn" @click="openGenerateKeyDialog">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            生成密钥
          </button>
          <button
            v-if="selectedKeys.length > 0"
            class="delete-selected-btn"
            @click="deleteSelectedKeys"
            :disabled="isDeletingKeys"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            删除选中 ({{ selectedKeys.length }})
          </button>
          <button class="refresh-btn" @click="loadKeys" :disabled="isLoadingKeys">
            <svg v-if="!isLoadingKeys" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            <span v-else class="spinner-small"></span>
            {{ isLoadingKeys ? '加载中...' : '刷新' }}
          </button>
        </div>

        <!-- 加载状态 -->
        <div v-if="isLoadingKeys" class="loading-state">
          <div class="spinner"></div>
          <p>正在加载密钥列表...</p>
        </div>

        <!-- 空状态 -->
        <div v-else-if="keys.length === 0" class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
          </svg>
          <p>暂无密钥</p>
        </div>

        <div v-else class="keys-container">
          <!-- 有效密钥组 -->
          <div v-if="validKeys.length > 0" class="key-group">
            <div class="key-group-header" @click="isValidKeysExpanded = !isValidKeysExpanded">
              <h4>
                <span class="status-dot valid"></span>
                <span class="expand-icon" :class="{ 'expanded': isValidKeysExpanded }">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </span>
                有效密钥 ({{ validKeys.length }})
              </h4>
              <label class="select-all-label" @click.stop>
                <input
                  type="checkbox"
                  :checked="isAllValidKeysSelected"
                  @change="toggleSelectAllValidKeys"
                />
                全选
              </label>
            </div>
            <div v-show="isValidKeysExpanded" class="key-group-content">
              <div class="data-table">
                <table>
                  <thead>
                    <tr>
                      <th class="checkbox-col">
                        <input
                          type="checkbox"
                          :checked="isAllValidKeysSelected"
                          @change="toggleSelectAllValidKeys"
                        />
                      </th>
                      <th>密钥</th>
                      <th>状态</th>
                      <th>过期时间</th>
                      <th>指定用户</th>
                      <th>使用者</th>
                      <th>使用时间</th>
                      <th>创建时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="key in validKeys" :key="key.id" :class="{ 'selected': selectedKeys.includes(key.id) }">
                      <td class="checkbox-col">
                        <input
                          type="checkbox"
                          :value="key.id"
                          v-model="selectedKeys"
                        />
                      </td>
                      <td class="key-cell">
                        <code>{{ key.key }}</code>
                        <button class="copy-btn" @click="copyKey(key.key)" title="复制">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        </button>
                      </td>
                      <td>
                        <span class="key-status-badge unused">
                          未使用
                        </span>
                      </td>
                      <td>{{ formatDate(key.expiresAt) }}</td>
                      <td>{{ key.assignedUserName || '任意用户' }}</td>
                      <td>{{ key.usedByUserName || '-' }}</td>
                      <td>{{ key.usedAt ? formatDate(key.usedAt) : '-' }}</td>
                      <td>{{ formatDate(key.createdAt) }}</td>
                      <td>
                        <button
                          class="action-btn delete"
                          @click="deleteKey(key.id)"
                          title="删除密钥"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- 已过期但有升级权益的密钥组 -->
          <div v-if="expiredKeysWithUpgrade.length > 0" class="key-group expired-group">
            <div class="key-group-header" @click="isExpiredWithUpgradeExpanded = !isExpiredWithUpgradeExpanded">
              <h4>
                <span class="status-dot expired"></span>
                <span class="expand-icon" :class="{ 'expanded': isExpiredWithUpgradeExpanded }">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </span>
                已过期（有升级权益）({{ expiredKeysWithUpgrade.length }})
                <span class="upgrade-badge-inline" title="这些密钥已过期，但用户仍有升级密钥权益">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                  </svg>
                  升级中
                </span>
              </h4>
              <label class="select-all-label" @click.stop>
                <input
                  type="checkbox"
                  :checked="isAllExpiredWithUpgradeSelected"
                  @change="toggleSelectAllExpiredWithUpgrade"
                />
                全选
              </label>
            </div>
            <div v-show="isExpiredWithUpgradeExpanded" class="key-group-content">
              <div class="data-table">
                <table>
                  <thead>
                    <tr>
                      <th class="checkbox-col">
                        <input
                          type="checkbox"
                          :checked="isAllExpiredWithUpgradeSelected"
                          @change="toggleSelectAllExpiredWithUpgrade"
                        />
                      </th>
                      <th>密钥</th>
                      <th>状态</th>
                      <th>过期时间</th>
                      <th>指定用户</th>
                      <th>使用者</th>
                      <th>使用时间</th>
                      <th>创建时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="key in expiredKeysWithUpgrade" :key="key.id" :class="{ 'selected': selectedKeys.includes(key.id) }">
                      <td class="checkbox-col">
                        <input
                          type="checkbox"
                          :value="key.id"
                          v-model="selectedKeys"
                        />
                      </td>
                      <td class="key-cell">
                        <code>{{ key.key }}</code>
                        <button class="copy-btn" @click="copyKey(key.key)" title="复制">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        </button>
                      </td>
                      <td>
                        <span class="key-status-badge expired">
                          已过期
                        </span>
                      </td>
                      <td>{{ formatDate(key.expiresAt) }}</td>
                      <td>{{ key.assignedUserName || '任意用户' }}</td>
                      <td>
                        <div class="user-cell">
                          <span>{{ key.usedByUserName || '-' }}</span>
                          <span v-if="key.hasUpgradeExpiry" class="upgrade-badge" title="该用户有升级密钥权益">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                            </svg>
                            升级中
                          </span>
                        </div>
                      </td>
                      <td>{{ key.usedAt ? formatDate(key.usedAt) : '-' }}</td>
                      <td>{{ formatDate(key.createdAt) }}</td>
                      <td>
                        <button
                          class="action-btn delete"
                          @click="deleteKey(key.id)"
                          :title="key.canSafelyDelete ? '删除密钥' : '警告：该用户有升级权益，删除将导致用户被冻结'"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- 已过期且无升级权益的密钥组 -->
          <div v-if="expiredKeysWithoutUpgrade.length > 0" class="key-group expired-group">
            <div class="key-group-header" @click="isExpiredWithoutUpgradeExpanded = !isExpiredWithoutUpgradeExpanded">
              <h4>
                <span class="status-dot expired"></span>
                <span class="expand-icon" :class="{ 'expanded': isExpiredWithoutUpgradeExpanded }">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </span>
                已过期（无升级权益）({{ expiredKeysWithoutUpgrade.length }})
              </h4>
              <label class="select-all-label" @click.stop>
                <input
                  type="checkbox"
                  :checked="isAllExpiredWithoutUpgradeSelected"
                  @change="toggleSelectAllExpiredWithoutUpgrade"
                />
                全选
              </label>
            </div>
            <div v-show="isExpiredWithoutUpgradeExpanded" class="key-group-content">
              <div class="data-table">
                <table>
                  <thead>
                    <tr>
                      <th class="checkbox-col">
                        <input
                          type="checkbox"
                          :checked="isAllExpiredWithoutUpgradeSelected"
                          @change="toggleSelectAllExpiredWithoutUpgrade"
                        />
                      </th>
                      <th>密钥</th>
                      <th>状态</th>
                      <th>过期时间</th>
                      <th>指定用户</th>
                      <th>使用者</th>
                      <th>使用时间</th>
                      <th>创建时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="key in expiredKeysWithoutUpgrade" :key="key.id" :class="{ 'selected': selectedKeys.includes(key.id) }">
                      <td class="checkbox-col">
                        <input
                          type="checkbox"
                          :value="key.id"
                          v-model="selectedKeys"
                        />
                      </td>
                      <td class="key-cell">
                        <code>{{ key.key }}</code>
                        <button class="copy-btn" @click="copyKey(key.key)" title="复制">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        </button>
                      </td>
                      <td>
                        <span class="key-status-badge expired">
                          已过期
                        </span>
                      </td>
                      <td>{{ formatDate(key.expiresAt) }}</td>
                      <td>{{ key.assignedUserName || '任意用户' }}</td>
                      <td>{{ key.usedByUserName || '-' }}</td>
                      <td>{{ key.usedAt ? formatDate(key.usedAt) : '-' }}</td>
                      <td>{{ formatDate(key.createdAt) }}</td>
                      <td>
                        <button
                          class="action-btn delete"
                          @click="deleteKey(key.id)"
                          title="删除密钥"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- 已使用密钥组 -->
          <div v-if="usedKeys.length > 0" class="key-group used-group">
            <div class="key-group-header" @click="isUsedKeysExpanded = !isUsedKeysExpanded">
              <h4>
                <span class="status-dot used"></span>
                <span class="expand-icon" :class="{ 'expanded': isUsedKeysExpanded }">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </span>
                已使用且有效密钥 ({{ usedKeys.length }})
              </h4>
              <label class="select-all-label" @click.stop>
                <input
                  type="checkbox"
                  :checked="isAllUsedKeysSelected"
                  @change="toggleSelectAllUsedKeys"
                />
                全选
              </label>
            </div>
            <div v-show="isUsedKeysExpanded" class="key-group-content">
              <div class="data-table">
                <table>
                  <thead>
                    <tr>
                      <th class="checkbox-col">
                        <input
                          type="checkbox"
                          :checked="isAllUsedKeysSelected"
                          @change="toggleSelectAllUsedKeys"
                        />
                      </th>
                      <th>密钥</th>
                      <th>状态</th>
                      <th>过期时间</th>
                      <th>指定用户</th>
                      <th>使用者</th>
                      <th>使用时间</th>
                      <th>创建时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="key in usedKeys" :key="key.id" :class="{ 'selected': selectedKeys.includes(key.id), 'unsafe-delete': !key.canSafelyDelete }">
                      <td class="checkbox-col">
                        <input
                          type="checkbox"
                          :value="key.id"
                          v-model="selectedKeys"
                        />
                      </td>
                      <td class="key-cell">
                        <code>{{ key.key }}</code>
                        <button class="copy-btn" @click="copyKey(key.key)" title="复制">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        </button>
                      </td>
                      <td>
                        <span class="key-status-badge used">
                          已使用
                        </span>
                      </td>
                      <td>{{ formatDate(key.expiresAt) }}</td>
                      <td>{{ key.assignedUserName || '任意用户' }}</td>
                      <td>
                        <div class="user-cell">
                          <span>{{ key.usedByUserName || '-' }}</span>
                          <span v-if="key.hasUpgradeExpiry" class="upgrade-badge" title="该用户有升级密钥权益">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                            </svg>
                            升级中
                          </span>
                        </div>
                      </td>
                      <td>{{ key.usedAt ? formatDate(key.usedAt) : '-' }}</td>
                      <td>{{ formatDate(key.createdAt) }}</td>
                      <td>
                        <button
                          class="action-btn delete"
                          @click="deleteKey(key.id)"
                          :title="key.canSafelyDelete ? '删除密钥' : '警告：该用户有升级权益，删除将导致用户被冻结'"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div class="pagination">
          <button
            :disabled="keyPage <= 1"
            @click="keyPage--; loadKeys()"
          >
            上一页
          </button>
          <span>第 {{ keyPage }} 页</span>
          <button
            :disabled="keys.length < keyPageSize"
            @click="keyPage++; loadKeys()"
          >
            下一页
          </button>
        </div>
      </div>

      <!-- 密钥发放管理 -->
      <div v-else-if="activeTab === 'keyDistribution'" class="admin-content">
        <div class="toolbar">
          <button class="generate-key-btn" @click="openCreateCampaignDialog">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            创建发放活动
          </button>
          <button class="refresh-btn" @click="loadCampaigns" :disabled="isLoadingCampaigns">
            <svg v-if="!isLoadingCampaigns" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            <span v-else class="spinner-small"></span>
            {{ isLoadingCampaigns ? '加载中...' : '刷新' }}
          </button>
        </div>

        <!-- 加载状态 -->
        <div v-if="isLoadingCampaigns" class="loading-state">
          <div class="spinner"></div>
          <p>正在加载发放活动...</p>
        </div>

        <!-- 空状态 -->
        <div v-else-if="campaigns.length === 0" class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <p>暂无发放活动</p>
          <p class="empty-hint">点击上方按钮创建新的密钥发放活动</p>
        </div>

        <div v-else class="data-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>活动名称</th>
                <th>状态</th>
                <th>天数范围</th>
                <th>总数量</th>
                <th>已领取</th>
                <th>剩余</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="campaign in campaigns" :key="campaign.id">
                <td>{{ campaign.id }}</td>
                <td class="campaign-name">{{ campaign.name }}</td>
                <td>
                  <span :class="['status-badge', campaign.is_active ? 'active' : 'inactive']">
                    {{ campaign.is_active ? '进行中' : '已停止' }}
                  </span>
                </td>
                <td>{{ campaign.min_days }} - {{ campaign.max_days }} 天</td>
                <td>{{ campaign.total_quota }}</td>
                <td>{{ campaign.claimed_count }}</td>
                <td>
                  <span :class="['remaining-badge', campaign.remaining_quota === 0 ? 'empty' : campaign.remaining_quota < campaign.total_quota * 0.1 ? 'low' : '']">
                    {{ campaign.remaining_quota }}
                  </span>
                </td>
                <td>{{ formatDate(campaign.created_at) }}</td>
                <td>
                  <div class="action-btns">
                    <button
                      class="action-btn view-keys"
                      @click="viewCampaignKeys(campaign.id)"
                      title="查看已发放密钥"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    </button>
                    <button
                      v-if="campaign.is_active"
                      class="action-btn freeze"
                      @click="stopCampaign(campaign.id)"
                      title="停止活动"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="6" y="4" width="4" height="16"></rect>
                        <rect x="14" y="4" width="4" height="16"></rect>
                      </svg>
                    </button>
                    <button
                      v-else
                      class="action-btn unfreeze"
                      @click="resumeCampaign(campaign.id)"
                      title="恢复活动"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                    </button>
                    <button
                      class="action-btn delete"
                      @click="deleteCampaign(campaign.id)"
                      title="删除活动"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 升级密钥管理 -->
      <div v-else-if="activeTab === 'upgradeKeys'" class="admin-content">
        <div class="toolbar">
          <button class="generate-key-btn" @click="openGenerateUpgradeKeyDialog">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            生成升级密钥
          </button>
          <button
            v-if="selectedUpgradeKeys.length > 0"
            class="delete-selected-btn"
            @click="deleteSelectedUpgradeKeys"
            :disabled="isDeletingUpgradeKeys"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            删除选中 ({{ selectedUpgradeKeys.length }})
          </button>
          <div class="filter-group">
            <select v-model="upgradeKeyFilter.keyType" @change="loadUpgradeKeys">
              <option value="">全部类型</option>
              <option value="level1">一级密钥</option>
              <option value="level2">二级密钥</option>
            </select>
            <select v-model="upgradeKeyFilter.isUsed" @change="loadUpgradeKeys">
              <option value="">全部状态</option>
              <option value="false">未使用</option>
              <option value="true">已使用</option>
            </select>
          </div>
          <button class="refresh-btn" @click="loadUpgradeKeys" :disabled="isLoadingUpgradeKeys">
            <svg v-if="!isLoadingUpgradeKeys" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            <span v-else class="spinner-small"></span>
            {{ isLoadingUpgradeKeys ? '加载中...' : '刷新' }}
          </button>
        </div>

        <!-- 加载状态 -->
        <div v-if="isLoadingUpgradeKeys" class="loading-state">
          <div class="spinner"></div>
          <p>正在加载升级密钥列表...</p>
        </div>

        <!-- 空状态 -->
        <div v-else-if="upgradeKeys.length === 0" class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
          </svg>
          <p>暂无升级密钥</p>
        </div>

        <div v-else class="data-table">
          <table>
            <thead>
              <tr>
                <th class="checkbox-col">
                  <input
                    type="checkbox"
                    :checked="isAllUpgradeKeysSelected"
                    @change="toggleSelectAllUpgradeKeys"
                  />
                </th>
                <th>密钥</th>
                <th>类型</th>
                <th>子账号上限</th>
                <th>延长天数</th>
                <th>状态</th>
                <th>使用者</th>
                <th>使用时间</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="key in upgradeKeys" :key="key.id" :class="{ 'selected': selectedUpgradeKeys.includes(key.id) }">
                <td class="checkbox-col">
                  <input
                    type="checkbox"
                    :value="key.id"
                    v-model="selectedUpgradeKeys"
                  />
                </td>
                <td class="key-cell">
                  <code>{{ key.key_value }}</code>
                  <button class="copy-btn" @click="copyKey(key.key_value)" title="复制">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </td>
                <td>
                  <span :class="['upgrade-key-type-badge', key.key_type]">
                    {{ key.key_type === 'level1' ? '一级' : key.key_type === 'level2' ? '二级' : '自定义' }}
                  </span>
                </td>
                <td>{{ key.max_accounts }} 个</td>
                <td>{{ key.extend_days }} 天</td>
                <td>
                  <span :class="['key-status-badge', key.is_used ? 'used' : 'unused']">
                    {{ key.is_used ? '已使用' : '未使用' }}
                  </span>
                </td>
                <td>{{ key.used_by_username || '-' }}</td>
                <td>{{ key.used_at ? formatDate(key.used_at) : '-' }}</td>
                <td>{{ formatDate(key.created_at) }}</td>
                <td>
                  <div class="action-btns">
                    <button
                      v-if="!key.is_used"
                      class="action-btn edit"
                      @click="openEditExtendDaysDialog(key)"
                      title="修改有效期"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button
                      v-if="!key.is_used"
                      class="action-btn delete"
                      @click="deleteUpgradeKey(key.id)"
                      title="删除密钥"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                    <span v-else class="used-mark">-</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 公告管理 -->
      <div v-else-if="activeTab === 'announcements'" class="admin-content">
        <div class="toolbar">
          <button class="generate-key-btn" @click="openAnnouncementDialog()">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            发布公告
          </button>
          <button class="refresh-btn" @click="loadAnnouncements" :disabled="isLoadingAnnouncements">
            <svg v-if="!isLoadingAnnouncements" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            <span v-else class="spinner-small"></span>
            {{ isLoadingAnnouncements ? '加载中...' : '刷新' }}
          </button>
        </div>

        <!-- 加载状态 -->
        <div v-if="isLoadingAnnouncements" class="loading-state">
          <div class="spinner"></div>
          <p>正在加载公告列表...</p>
        </div>

        <!-- 空状态 -->
        <div v-else-if="announcements.length === 0" class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <p>暂无公告</p>
        </div>

        <div v-else class="data-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>标题</th>
                <th>内容预览</th>
                <th>显示间隔</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="announcement in announcements" :key="announcement.id">
                <td>{{ announcement.id }}</td>
                <td class="announcement-title">{{ announcement.title }}</td>
                <td class="announcement-preview">{{ announcement.content.substring(0, 50) }}{{ announcement.content.length > 50 ? '...' : '' }}</td>
                <td>{{ announcement.interval_hours }}小时</td>
                <td>
                  <span :class="['status-badge', announcement.is_active ? 'active' : 'inactive']">
                    {{ announcement.is_active ? '启用' : '禁用' }}
                  </span>
                </td>
                <td>{{ formatDate(announcement.created_at) }}</td>
                <td class="announcement-actions">
                  <button class="edit-btn" @click="openAnnouncementDialog(announcement)" title="编辑">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button class="delete-account-btn" @click="deleteAnnouncement(announcement.id)" title="删除">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 用户审批 -->
      <div v-else-if="activeTab === 'pendingUsers'" class="admin-content">
        <div class="toolbar">
          <button class="refresh-btn" @click="loadPendingUsers" :disabled="isLoadingPendingUsers">
            <svg v-if="!isLoadingPendingUsers" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            <span v-else class="spinner-small"></span>
            {{ isLoadingPendingUsers ? '加载中...' : '刷新' }}
          </button>
        </div>

        <!-- 加载状态 -->
        <div v-if="isLoadingPendingUsers" class="loading-state">
          <div class="spinner"></div>
          <p>正在加载待审批用户...</p>
        </div>

        <!-- 空状态 -->
        <div v-else-if="pendingUsers.length === 0" class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <p>暂无待审批用户</p>
        </div>

        <div v-else class="data-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>用户名</th>
                <th>邮箱</th>
                <th>密钥过期时间</th>
                <th>注册时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in pendingUsers" :key="user.id">
                <td>{{ user.id }}</td>
                <td>{{ user.username }}</td>
                <td>{{ user.email }}</td>
                <td>{{ formatDate(user.key_expires_at) }}</td>
                <td>{{ formatDate(user.created_at) }}</td>
                <td class="action-btns">
                  <button
                    class="action-btn approve"
                    @click="approveUser(user.id)"
                    :disabled="isApprovingUser === user.id"
                    title="通过审批"
                  >
                    <span v-if="isApprovingUser === user.id" class="spinner-small"></span>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </button>
                  <button
                    class="action-btn reject"
                    @click="rejectUser(user.id)"
                    :disabled="isRejectingUser === user.id"
                    title="拒绝审批"
                  >
                    <span v-if="isRejectingUser === user.id" class="spinner-small"></span>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 公告编辑对话框 -->
      <div v-if="showAnnouncementDialog" class="dialog-overlay" @click.self="showAnnouncementDialog = false">
        <div class="dialog announcement-dialog">
          <div class="dialog-header">
            <h3>{{ editingAnnouncement ? '编辑公告' : '发布公告' }}</h3>
            <button class="close-btn" @click="showAnnouncementDialog = false">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="dialog-body">
            <div class="form-group">
              <label>标题 <span class="required">*</span></label>
              <input v-model="announcementForm.title" type="text" placeholder="请输入公告标题" />
            </div>
            <div class="form-group">
              <label>内容 <span class="required">*</span></label>
              <textarea v-model="announcementForm.content" rows="6" placeholder="请输入公告内容"></textarea>
            </div>
            <div class="form-row">
              <div class="form-group half">
                <label>显示间隔</label>
                <select v-model="announcementForm.intervalHours">
                  <option :value="1">1小时</option>
                  <option :value="2">2小时</option>
                  <option :value="4">4小时</option>
                  <option :value="8">8小时</option>
                  <option :value="12">12小时</option>
                  <option :value="24">24小时</option>
                  <option :value="48">48小时</option>
                  <option :value="72">72小时</option>
                </select>
              </div>
              <div class="form-group half">
                <label>状态</label>
                <select v-model="announcementForm.isActive">
                  <option :value="true">启用</option>
                  <option :value="false">禁用</option>
                </select>
              </div>
            </div>
          </div>
          <div class="dialog-footer">
            <button class="btn-secondary" @click="showAnnouncementDialog = false">取消</button>
            <button class="btn-primary" @click="saveAnnouncement" :disabled="!announcementForm.title || !announcementForm.content || isSavingAnnouncement">
              <span v-if="isSavingAnnouncement" class="spinner-small"></span>
              <span v-else>{{ editingAnnouncement ? '保存' : '发布' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 生成密钥对话框 -->
      <div v-if="showGenerateKeyDialog" class="dialog-overlay" @click.self="showGenerateKeyDialog = false">
        <div class="generate-key-dialog">
          <div class="dialog-header">
            <h3>生成注册密钥</h3>
            <button class="close-btn" @click="showGenerateKeyDialog = false">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="dialog-body">
            <div class="form-group">
              <label>有效期至</label>
              <input
                v-model="newKeyExpiresAt"
                type="datetime-local"
                required
              />
              <div class="quick-select-buttons">
                <button
                  v-for="days in [1, 3, 7, 14, 30]"
                  :key="days"
                  class="quick-select-btn"
                  @click="setKeyExpiry(days)"
                  type="button"
                >
                  {{ days }}天
                </button>
              </div>
            </div>
            <div class="form-group">
              <label>指定用户（可选）</label>
              <select v-model="newKeyAssignedUserId">
                <option :value="null">任意用户</option>
                <option v-for="user in users.filter(u => u.role !== 'admin')" :key="user.id" :value="user.id">
                  {{ user.username }}
                </option>
              </select>
            </div>
            <div v-if="generatedKey" class="generated-key-result">
              <label>生成的密钥</label>
              <div class="key-display">
                <code>{{ generatedKey }}</code>
                <button class="copy-btn" @click="copyKey(generatedKey)">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </div>
              <p class="key-warning">请妥善保存此密钥，关闭后将无法再次查看！</p>
            </div>
          </div>
          <div class="dialog-footer">
            <button class="btn-secondary" @click="showGenerateKeyDialog = false">
              关闭
            </button>
            <button
              v-if="!generatedKey"
              class="btn-primary"
              @click="generateKey"
              :disabled="!newKeyExpiresAt || isGeneratingKey"
            >
              <span v-if="isGeneratingKey" class="spinner-small"></span>
              <span v-else>生成</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 生成升级密钥对话框 -->
      <div v-if="showGenerateUpgradeKeyDialog" class="dialog-overlay" @click.self="showGenerateUpgradeKeyDialog = false">
        <div class="generate-key-dialog">
          <div class="dialog-header">
            <h3>生成升级密钥</h3>
            <button class="close-btn" @click="showGenerateUpgradeKeyDialog = false">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="dialog-body">
            <div class="form-group">
              <label>密钥类型</label>
              <div class="key-type-options">
                <div
                  :class="['key-type-option', { active: upgradeKeyForm.keyType === 'level1' }]"
                  @click="upgradeKeyForm.keyType = 'level1'"
                >
                  <div class="option-header">
                    <span class="option-badge level1">一级密钥</span>
                  </div>
                  <div class="option-benefits">
                    <div class="benefit-item">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      <span>子账号上限提升至 <strong>2 个</strong></span>
                    </div>
                    <div class="benefit-item">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      <span>延长有效期 <strong>15 天</strong></span>
                    </div>
                  </div>
                </div>
                <div
                  :class="['key-type-option', { active: upgradeKeyForm.keyType === 'level2' }]"
                  @click="upgradeKeyForm.keyType = 'level2'"
                >
                  <div class="option-header">
                    <span class="option-badge level2">二级密钥</span>
                  </div>
                  <div class="option-benefits">
                    <div class="benefit-item">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      <span>子账号上限提升至 <strong>3 个</strong></span>
                    </div>
                    <div class="benefit-item">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      <span>延长有效期 <strong>30 天</strong></span>
                    </div>
                  </div>
                </div>
                <div
                  :class="['key-type-option', { active: upgradeKeyForm.keyType === 'custom' }]"
                  @click="upgradeKeyForm.keyType = 'custom'"
                >
                  <div class="option-header">
                    <span class="option-badge custom">自定义密钥</span>
                  </div>
                  <div class="option-benefits">
                    <div class="benefit-item">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      <span>子账号上限 <strong>自由设置</strong></span>
                    </div>
                    <div class="benefit-item">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      <span>有效期天数 <strong>自由设置</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 自定义密钥配置 -->
            <div v-if="upgradeKeyForm.keyType === 'custom'" class="custom-config-section">
              <div class="form-row">
                <div class="form-group half">
                  <label>子账号上限 <span class="required">*</span></label>
                  <div class="number-selector">
                    <button
                      v-for="n in [1, 2, 3, 5, 10]"
                      :key="n"
                      :class="['number-btn', { active: upgradeKeyForm.customMaxAccounts === n }]"
                      @click="upgradeKeyForm.customMaxAccounts = n"
                      type="button"
                    >
                      {{ n }}个
                    </button>
                    <input
                      v-model.number="upgradeKeyForm.customMaxAccounts"
                      type="number"
                      min="1"
                      max="10"
                      class="number-input"
                      placeholder="自定义"
                    />
                  </div>
                  <span class="form-hint">范围：1-10个</span>
                </div>
                <div class="form-group half">
                  <label>有效期天数 <span class="required">*</span></label>
                  <div class="number-selector">
                    <button
                      v-for="days in [15, 30, 60, 90, 180, 365]"
                      :key="days"
                      :class="['number-btn', { active: upgradeKeyForm.customExtendDays === days }]"
                      @click="upgradeKeyForm.customExtendDays = days"
                      type="button"
                    >
                      {{ days }}天
                    </button>
                    <input
                      v-model.number="upgradeKeyForm.customExtendDays"
                      type="number"
                      min="1"
                      max="365"
                      class="number-input"
                      placeholder="自定义"
                    />
                  </div>
                  <span class="form-hint">范围：1-365天</span>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label>生成数量</label>
              <div class="count-selector">
                <button
                  v-for="n in [1, 5, 10, 20, 50]"
                  :key="n"
                  :class="['count-btn', { active: upgradeKeyForm.count === n }]"
                  @click="upgradeKeyForm.count = n"
                  type="button"
                >
                  {{ n }}个
                </button>
                <input
                  v-model.number="upgradeKeyForm.count"
                  type="number"
                  min="1"
                  max="100"
                  class="count-input"
                  placeholder="自定义"
                />
              </div>
              <span class="form-hint">单次最多生成100个密钥</span>
            </div>
            <div v-if="generatedUpgradeKeys.length > 0" class="generated-keys-result">
              <label>生成的密钥 ({{ generatedUpgradeKeys.length }}个)</label>
              <div class="keys-list">
                <div v-for="(key, index) in generatedUpgradeKeys" :key="index" class="key-display-item">
                  <code>{{ key.keyValue }}</code>
                  <button class="copy-btn" @click="copyKey(key.keyValue)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
              </div>
              <p class="key-warning">请妥善保存这些密钥，关闭后将无法再次查看！</p>
            </div>
          </div>
          <div class="dialog-footer">
            <button class="btn-secondary" @click="showGenerateUpgradeKeyDialog = false">
              关闭
            </button>
            <button
              v-if="generatedUpgradeKeys.length === 0"
              class="btn-primary"
              @click="generateUpgradeKeys"
              :disabled="isGeneratingUpgradeKey || upgradeKeyForm.count < 1 || upgradeKeyForm.count > 100 || !isUpgradeKeyFormValid()"
            >
              <span v-if="isGeneratingUpgradeKey" class="spinner-small"></span>
              <span v-else>生成密钥</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 修改子账号上限对话框 -->
      <div v-if="showEditMaxAccountsDialog" class="dialog-overlay" @click.self="showEditMaxAccountsDialog = false">
        <div class="dialog edit-max-dialog">
          <div class="dialog-header">
            <h3>修改子账号上限</h3>
            <button class="close-btn" @click="showEditMaxAccountsDialog = false">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="dialog-body">
            <div class="form-row">
              <div class="form-group half">
                <label>用户</label>
                <div class="info-display">{{ editingUser?.username }}</div>
              </div>
              <div class="form-group half">
                <label>当前上限</label>
                <div class="info-display">{{ editingUser?.max_accounts || 1 }}</div>
              </div>
            </div>
            <div class="form-group">
              <label>新上限 <span class="required">*</span></label>
              <input
                v-model.number="newMaxAccounts"
                type="number"
                min="1"
                placeholder="请输入新的子账号上限"
                class="form-input"
              />
            </div>
          </div>
          <div class="dialog-footer">
            <button class="btn-secondary" @click="showEditMaxAccountsDialog = false">取消</button>
            <button
              class="btn-primary"
              @click="confirmEditMaxAccounts"
              :disabled="!newMaxAccounts || newMaxAccounts < 1"
            >
              确认修改
            </button>
          </div>
        </div>
      </div>

      <!-- 创建发放活动对话框 -->
      <div v-if="showCreateCampaignDialog" class="dialog-overlay" @click.self="showCreateCampaignDialog = false">
        <div class="dialog campaign-dialog">
          <div class="dialog-header">
            <h3>创建密钥发放活动</h3>
            <button class="close-btn" @click="showCreateCampaignDialog = false">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="dialog-body">
            <div class="form-group">
              <label>活动名称 <span class="required">*</span></label>
              <input v-model="campaignForm.name" type="text" placeholder="例如：春节免费领密钥活动" />
            </div>
            <div class="form-row">
              <div class="form-group half">
                <label>最小天数 <span class="required">*</span></label>
                <input v-model.number="campaignForm.minDays" type="number" min="1" max="365" placeholder="例如：3" />
                <span class="form-hint">领取的密钥最少有效天数</span>
              </div>
              <div class="form-group half">
                <label>最大天数 <span class="required">*</span></label>
                <input v-model.number="campaignForm.maxDays" type="number" min="1" max="365" placeholder="例如：7" />
                <span class="form-hint">领取的密钥最多有效天数</span>
              </div>
            </div>
            <div class="form-group">
              <label>发放数量 <span class="required">*</span></label>
              <input v-model.number="campaignForm.totalQuota" type="number" min="1" max="10000" placeholder="例如：100" />
              <span class="form-hint">本次活动总共发放多少个密钥</span>
            </div>
          </div>
          <div class="dialog-footer">
            <button class="btn-secondary" @click="showCreateCampaignDialog = false">取消</button>
            <button
              class="btn-primary"
              @click="createCampaign"
              :disabled="!isCampaignFormValid || isCreatingCampaign"
            >
              <span v-if="isCreatingCampaign" class="spinner-small"></span>
              <span v-else>创建活动</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 查看活动密钥对话框 -->
      <div v-if="showCampaignKeysDialog" class="dialog-overlay" @click.self="showCampaignKeysDialog = false">
        <div class="dialog campaign-keys-dialog">
          <div class="dialog-header">
            <h3>已发放密钥列表</h3>
            <button class="close-btn" @click="showCampaignKeysDialog = false">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="dialog-body">
            <!-- 加载状态 -->
            <div v-if="isLoadingCampaignKeys" class="loading-state">
              <div class="spinner"></div>
              <p>正在加载密钥列表...</p>
            </div>
            <!-- 空状态 -->
            <div v-else-if="campaignKeys.length === 0" class="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
              </svg>
              <p>暂无已发放密钥</p>
            </div>
            <!-- 密钥列表 -->
            <div v-else class="campaign-keys-table">
              <table>
                <thead>
                  <tr>
                    <th>密钥</th>
                    <th>有效天数</th>
                    <th>领取邮箱</th>
                    <th>领取时间</th>
                    <th>到期时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="key in campaignKeys" :key="key.id">
                    <td class="key-cell">
                      <code>{{ key.key_value }}</code>
                      <button class="copy-btn" @click="copyKey(key.key_value)" title="复制">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                    </td>
                    <td>{{ key.valid_days }} 天</td>
                    <td>
                      <span :class="{ 'blacklisted-email': isEmailBlacklisted(key.claimed_by_email) }">
                        {{ key.claimed_by_email || '-' }}
                      </span>
                    </td>
                    <td>{{ key.claimed_at ? formatDate(key.claimed_at) : '-' }}</td>
                    <td>{{ key.expires_at ? formatDate(key.expires_at) : '-' }}</td>
                    <td>
                      <button
                        v-if="key.claimed_by_email && !key.is_used"
                        class="action-btn blacklist"
                        @click="blacklistEmail(key.claimed_by_email, key.key_value)"
                        title="拉黑此邮箱"
                        :disabled="isEmailBlacklisted(key.claimed_by_email)"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                        </svg>
                        <span>{{ isEmailBlacklisted(key.claimed_by_email) ? '已拉黑' : '拉黑' }}</span>
                      </button>
                      <span v-else-if="key.is_used" class="key-used-badge">已使用</span>
                      <span v-else>-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="dialog-footer">
            <button class="btn-secondary" @click="showCampaignKeysDialog = false">关闭</button>
          </div>
        </div>
      </div>

      <!-- 系统设置 -->
      <div v-else-if="activeTab === 'settings'" class="admin-content">
        <div class="settings-section">
          <h3 class="settings-title">注册设置</h3>
          <div class="settings-form">
            <div class="form-group">
              <label class="toggle-label">
                <input
                  type="checkbox"
                  v-model="registrationSettings.enabled"
                  :disabled="isLoadingRegistrationSettings || isSavingRegistrationSettings"
                />
                <span class="toggle-text">开放用户注册</span>
              </label>
              <p class="form-hint">关闭后用户将无法访问注册页面</p>
            </div>

            <div class="form-group">
              <label>注册开放开始时间（可选）</label>
              <input
                type="datetime-local"
                v-model="registrationSettings.startTime"
                :disabled="isLoadingRegistrationSettings || isSavingRegistrationSettings"
              />
              <p class="form-hint">设置后只在指定时间后开放注册，留空表示不限制</p>
            </div>

            <div class="form-group">
              <label>注册开放结束时间（可选）</label>
              <input
                type="datetime-local"
                v-model="registrationSettings.endTime"
                :disabled="isLoadingRegistrationSettings || isSavingRegistrationSettings"
              />
              <p class="form-hint">设置后在指定时间后关闭注册，留空表示不限制</p>
            </div>

            <div class="form-actions">
              <button
                class="btn-primary"
                @click="saveRegistrationSettings"
                :disabled="isLoadingRegistrationSettings || isSavingRegistrationSettings"
              >
                <span v-if="isSavingRegistrationSettings" class="spinner-small"></span>
                {{ isSavingRegistrationSettings ? '保存中...' : '保存设置' }}
              </button>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-title">反检测全局设置</h3>
          <p class="section-desc">用于最高级别控制所有账号的反检测行为</p>
          <div class="settings-form">
            <div class="form-group">
              <label class="toggle-label">
                <input
                  type="checkbox"
                  v-model="antiDetectionSettings.globalEnabled"
                  :disabled="isLoadingAntiDetectionSettings || isSavingAntiDetectionSettings"
                />
                <span class="toggle-text">全局启用反检测系统</span>
              </label>
              <p class="form-hint">关闭后所有账号都会强制按旧逻辑运行，即使账号内已开启反检测</p>
            </div>

            <div class="form-group">
              <label>默认账号开关</label>
              <label class="toggle-label">
                <input
                  type="checkbox"
                  v-model="antiDetectionSettings.defaultConfig.enabled"
                  :disabled="isLoadingAntiDetectionSettings || isSavingAntiDetectionSettings"
                />
                <span class="toggle-text">新账号默认启用反检测</span>
              </label>
            </div>

            <div class="form-group">
              <label>默认拟人强度</label>
              <select
                v-model="antiDetectionSettings.defaultConfig.humanMode.intensity"
                :disabled="isLoadingAntiDetectionSettings || isSavingAntiDetectionSettings"
              >
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </div>

            <div class="form-group">
              <label class="toggle-label">
                <input
                  type="checkbox"
                  v-model="antiDetectionSettings.defaultConfig.protocol.enableTlog"
                  :disabled="isLoadingAntiDetectionSettings || isSavingAntiDetectionSettings"
                />
                <span class="toggle-text">默认启用 Tlog 行为流</span>
              </label>
            </div>

            <div class="form-group">
              <label>默认设备模板</label>
              <select
                v-model="antiDetectionSettings.defaultConfig.protocol.deviceProfile"
                :disabled="isLoadingAntiDetectionSettings || isSavingAntiDetectionSettings"
              >
                <option value="auto">自动</option>
                <option value="iphone15">iPhone 15 Pro</option>
                <option value="iphone14">iPhone 14 Pro</option>
                <option value="android_highend">Android 高端</option>
                <option value="android_midrange">Android 中端</option>
              </select>
            </div>

            <div class="form-actions">
              <button
                class="btn-primary"
                @click="saveAntiDetectionSettings"
                :disabled="isLoadingAntiDetectionSettings || isSavingAntiDetectionSettings"
              >
                <span v-if="isSavingAntiDetectionSettings" class="spinner-small"></span>
                {{ isSavingAntiDetectionSettings ? '保存中...' : '保存反检测设置' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 邮箱黑名单设置 -->
        <div class="settings-section">
          <h3 class="settings-title">邮箱黑名单</h3>
          <p class="section-desc">在黑名单中的邮箱将无法在密钥领取页面领取密钥</p>
          
          <div class="blacklist-form">
            <div class="form-row">
              <div class="form-group">
                <input
                  type="email"
                  v-model="newBlacklistEmail"
                  placeholder="请输入QQ邮箱（如：123456@qq.com）"
                  :disabled="isAddingToBlacklist"
                  @keyup.enter="addToBlacklist"
                />
              </div>
              <div class="form-group flex-2">
                <input
                  type="text"
                  v-model="newBlacklistReason"
                  placeholder="封禁原因（可选）"
                  :disabled="isAddingToBlacklist"
                  @keyup.enter="addToBlacklist"
                />
              </div>
              <button
                class="btn-primary"
                @click="addToBlacklist"
                :disabled="isAddingToBlacklist || !newBlacklistEmail"
              >
                <span v-if="isAddingToBlacklist" class="spinner-small"></span>
                {{ isAddingToBlacklist ? '添加中...' : '添加到黑名单' }}
              </button>
            </div>
          </div>

          <div class="blacklist-table-wrapper">
            <table v-if="emailBlacklist.length > 0" class="data-table blacklist-table">
              <thead>
                <tr>
                  <th>邮箱地址</th>
                  <th>封禁原因</th>
                  <th>添加时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in emailBlacklist" :key="item.email">
                  <td>{{ item.email }}</td>
                  <td>{{ item.reason || '-' }}</td>
                  <td>{{ formatDateTime(item.addedAt) }}</td>
                  <td>
                    <button
                      class="btn-icon btn-danger"
                      @click="removeFromBlacklist(item.email)"
                      title="移除"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <p>黑名单为空，暂无被封禁的邮箱</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 创建用户对话框 -->
      <div v-if="showCreateUserDialog" class="dialog-overlay" @click.self="showCreateUserDialog = false">
        <div class="dialog create-user-dialog modern-dialog">
          <div class="dialog-header modern-header">
            <div class="header-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <line x1="20" y1="8" x2="20" y2="14"></line>
                <line x1="23" y1="11" x2="17" y2="11"></line>
              </svg>
            </div>
            <div class="header-text">
              <h3>快速创建用户</h3>
              <p>填写以下信息快速创建新用户账号</p>
            </div>
            <button class="close-btn" @click="showCreateUserDialog = false">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="dialog-body modern-body">
            <div class="form-grid">
              <div class="form-group modern-form-group">
                <label>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                  QQ邮箱 <span class="required">*</span>
                </label>
                <div class="input-wrapper">
                  <input
                    v-model="createUserForm.email"
                    type="email"
                    placeholder="请输入QQ邮箱（如：123456@qq.com）"
                    @blur="autoFillCreateUsername"
                    class="modern-input"
                  />
                  <span class="input-icon" v-if="createUserForm.email && isValidQQEmail(createUserForm.email)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </span>
                </div>
                <span class="form-hint">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  用户名将自动设置为QQ号
                </span>
              </div>

              <div class="form-group modern-form-group">
                <label>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  用户名
                </label>
                <div class="input-wrapper">
                  <input
                    v-model="createUserForm.username"
                    type="text"
                    placeholder="用户名将自动填充"
                    readonly
                    class="modern-input readonly"
                  />
                  <span class="input-icon lock-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </span>
                </div>
              </div>

              <div class="form-group modern-form-group">
                <label>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  密码 <span class="required">*</span>
                </label>
                <div class="input-wrapper">
                  <input
                    v-model="createUserForm.password"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="请输入密码"
                    class="modern-input"
                  />
                  <button type="button" class="toggle-password" @click="showPassword = !showPassword" title="显示/隐藏密码">
                    <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  </button>
                </div>
              </div>

              <div class="form-group modern-form-group full-width">
                <label>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                  </svg>
                  注册密钥 <span class="required">*</span>
                </label>
                <div class="input-wrapper">
                  <input
                    v-model="createUserForm.registrationKey"
                    type="text"
                    placeholder="请输入注册密钥"
                    class="modern-input"
                  />
                  <span class="input-icon key-icon" v-if="createUserForm.registrationKey">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div class="dialog-footer modern-footer">
            <button class="btn-secondary modern-btn-secondary" @click="showCreateUserDialog = false">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              取消
            </button>
            <button
              class="btn-primary modern-btn-primary"
              @click="confirmCreateUser"
              :disabled="!createUserForm.email || !createUserForm.password || !createUserForm.registrationKey || isCreatingUser"
            >
              <span v-if="isCreatingUser" class="spinner-small"></span>
              <template v-else>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                创建用户
              </template>
            </button>
          </div>
        </div>
      </div>

      <!-- 修改升级密钥有效期对话框 -->
      <div v-if="showEditExtendDaysDialog" class="dialog-overlay" @click.self="showEditExtendDaysDialog = false">
        <div class="dialog edit-extend-days-dialog">
          <div class="dialog-header">
            <h3>修改升级密钥有效期</h3>
            <button class="close-btn" @click="showEditExtendDaysDialog = false">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="dialog-body">
            <div class="form-group">
              <label>密钥</label>
              <div class="info-display">
                <code>{{ editingUpgradeKey?.key_value?.substring(0, 20) }}...</code>
              </div>
            </div>
            <div class="form-group">
              <label>当前有效期</label>
              <div class="info-display">{{ editingUpgradeKey?.extend_days }} 天</div>
            </div>
            <div class="form-group">
              <label>新有效期 <span class="required">*</span></label>
              <div class="days-selector">
                <button
                  v-for="days in [15, 30, 60, 90, 180, 365]"
                  :key="days"
                  :class="['days-btn', { active: newExtendDays === days }]"
                  @click="newExtendDays = days"
                  type="button"
                >
                  {{ days }}天
                </button>
                <input
                  v-model.number="newExtendDays"
                  type="number"
                  min="1"
                  max="365"
                  class="days-input"
                  placeholder="自定义"
                />
              </div>
              <span class="form-hint">有效期天数范围：1-365天</span>
            </div>
            <div class="form-group">
              <label>子账号上限</label>
              <div class="info-display">{{ newExtendDays >= 30 ? 3 : 2 }} 个</div>
              <span class="form-hint">根据有效期自动调整：≥30天为3个，否则为2个</span>
            </div>
          </div>
          <div class="dialog-footer">
            <button class="btn-secondary" @click="showEditExtendDaysDialog = false">取消</button>
            <button
              class="btn-primary"
              @click="confirmEditExtendDays"
              :disabled="!newExtendDays || newExtendDays < 1 || newExtendDays > 365 || isSavingExtendDays"
            >
              <span v-if="isSavingExtendDays" class="spinner-small"></span>
              <span v-else>确认修改</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import { useUserStore } from '../stores/user';
import axios from 'axios';

const userStore = useUserStore();
const emit = defineEmits(['close']);

const activeTab = ref<'users' | 'accounts' | 'keys' | 'keyDistribution' | 'upgradeKeys' | 'announcements' | 'pendingUsers' | 'settings'>('users');
const userSearch = ref('');
const accountSearch = ref('');

// 密钥到期筛选
const keyExpiryFilter = ref<'all' | 'expired' | 'expiring-soon' | 'valid' | 'none'>('all');
const KEY_EXPIRY_DAYS = 7; // 即将过期的天数阈值

// 密钥筛选文本
const keyExpiryFilterText = computed(() => {
  switch (keyExpiryFilter.value) {
    case 'expired':
      return '已过期';
    case 'expiring-soon':
      return '即将过期 (7天内)';
    case 'valid':
      return '有效';
    case 'none':
      return '未绑定密钥';
    default:
      return '全部';
  }
});

// 切换标签页
function switchTab(tab: 'users' | 'accounts' | 'keys' | 'keyDistribution' | 'upgradeKeys' | 'announcements' | 'pendingUsers' | 'settings') {
  activeTab.value = tab;
  // 关闭已发放密钥列表弹窗
  showCampaignKeysDialog.value = false;
  // 切换到设置页时加载注册设置和邮箱黑名单
  if (tab === 'settings') {
    loadRegistrationSettings();
    loadAntiDetectionSettings();
    loadEmailBlacklist();
  }
}

// 用户管理
const users = ref<any[]>([]);
const userPage = ref(1);
const userPageSize = 20;
const isLoadingUsers = ref(false);
const expandedUserId = ref<number | null>(null);
const userAccounts = ref<Map<number, any[]>>(new Map());
const isLoadingUserAccounts = ref(false);
const isDeletingAccount = ref<string | null>(null);
const isStoppingAccount = ref<string | null>(null);
const selectedUsers = ref<number[]>([]);
const isDeletingUsers = ref(false);
const userUpgradeKeys = ref<Map<number, any>>(new Map());
const isLoadingUserUpgradeKeys = ref(false);
const isUnbindingUpgradeKey = ref<number | null>(null);

// 用户审批
const pendingUsers = ref<any[]>([]);
const isLoadingPendingUsers = ref(false);
const isApprovingUser = ref<number | null>(null);
const isRejectingUser = ref<number | null>(null);
const pendingUsersCount = computed(() => pendingUsers.value.length);

// 创建用户
const showCreateUserDialog = ref(false);
const isCreatingUser = ref(false);
const showPassword = ref(false);
const createUserForm = reactive({
  username: '',
  password: '',
  email: '',
  registrationKey: ''
});

// 验证QQ邮箱格式
function isValidQQEmail(email: string): boolean {
  return /^\d+@qq\.com$/i.test(email);
}

// 账号管理
const accounts = ref<any[]>([]);
const accountPage = ref(1);
const accountPageSize = 20;
const isLoadingAccounts = ref(false);
const isRestartingAll = ref(false);
const selectedAccounts = ref<string[]>([]);
const isStoppingSelected = ref(false);

// 密钥管理
const keys = ref<any[]>([]);
const keyPage = ref(1);
const keyPageSize = 20;
const isLoadingKeys = ref(false);
const showGenerateKeyDialog = ref(false);
const newKeyExpiresAt = ref('');
const newKeyAssignedUserId = ref<number | null>(null);
const generatedKey = ref('');
const isGeneratingKey = ref(false);
const selectedKeys = ref<number[]>([]);
const isDeletingKeys = ref(false);

// 密钥搜索和排序
const keySearch = ref('');
const keySortField = ref<'createdAt' | 'expiresAt' | 'usedAt'>('createdAt');
const keySortOrder = ref<'asc' | 'desc'>('desc');
const allKeysForStats = ref<any[]>([]); // 存储所有密钥用于统计

// 密钥分组展开状态 - 默认折叠
const isValidKeysExpanded = ref(false);
// @ts-ignore - 在模板中使用
const isExpiredKeysExpanded = ref(false);
const isUsedKeysExpanded = ref(false);

// 已过期密钥分组展开状态
const isExpiredWithUpgradeExpanded = ref(false);
const isExpiredWithoutUpgradeExpanded = ref(false);

// 修改子账号上限
const showEditMaxAccountsDialog = ref(false);
const editingUser = ref<any>(null);
const newMaxAccounts = ref<number>(1);

// 公告管理
const announcements = ref<any[]>([]);
const isLoadingAnnouncements = ref(false);
const showAnnouncementDialog = ref(false);
const editingAnnouncement = ref<any>(null);
const announcementForm = ref({
  title: '',
  content: '',
  intervalHours: 24,
  isActive: true
});
const isSavingAnnouncement = ref(false);

// 密钥发放管理
const campaigns = ref<any[]>([]);
const isLoadingCampaigns = ref(false);
const showCreateCampaignDialog = ref(false);
const campaignForm = ref({
  name: '',
  minDays: 3,
  maxDays: 7,
  totalQuota: 100
});
const isCreatingCampaign = ref(false);
const showCampaignKeysDialog = ref(false);
const campaignKeys = ref<any[]>([]);
const isLoadingCampaignKeys = ref(false);
const currentCampaignId = ref<number | null>(null);

// 升级密钥管理
const upgradeKeys = ref<any[]>([]);
const isLoadingUpgradeKeys = ref(false);
const showGenerateUpgradeKeyDialog = ref(false);
const upgradeKeyForm = ref({
  keyType: 'level1' as 'level1' | 'level2' | 'custom',
  count: 1,
  customMaxAccounts: 2,
  customExtendDays: 15
});
const isGeneratingUpgradeKey = ref(false);
const generatedUpgradeKeys = ref<any[]>([]);
const selectedUpgradeKeys = ref<number[]>([]);
const isDeletingUpgradeKeys = ref(false);
const upgradeKeyFilter = ref({
  keyType: '' as '' | 'level1' | 'level2' | 'custom',
  isUsed: '' as '' | 'true' | 'false'
});

// 系统设置 - 注册设置
const registrationSettings = ref({
  enabled: true,
  startTime: null as string | null,
  endTime: null as string | null
});
const isLoadingRegistrationSettings = ref(false);
const isSavingRegistrationSettings = ref(false);
const antiDetectionSettings = ref({
  globalEnabled: true,
  defaultConfig: {
    enabled: false,
    humanMode: { intensity: 'medium' as 'low' | 'medium' | 'high' },
    protocol: { enableTlog: true, deviceProfile: 'auto' }
  }
});
const isLoadingAntiDetectionSettings = ref(false);
const isSavingAntiDetectionSettings = ref(false);
const showEditExtendDaysDialog = ref(false);
const editingUpgradeKey = ref<any>(null);
const newExtendDays = ref<number>(15);
const isSavingExtendDays = ref(false);

// 系统设置 - 邮箱黑名单
const emailBlacklist = ref<any[]>([]);
const isLoadingEmailBlacklist = ref(false);
const newBlacklistEmail = ref('');
const newBlacklistReason = ref('');
const isAddingToBlacklist = ref(false);

// 发放活动表单验证
const isCampaignFormValid = computed(() => {
  return campaignForm.value.name.trim() &&
    campaignForm.value.minDays >= 1 &&
    campaignForm.value.maxDays >= campaignForm.value.minDays &&
    campaignForm.value.totalQuota >= 1;
});

// 搜索模式状态
const isUserSearchMode = ref(false);
const isAccountSearchMode = ref(false);
const allUsersForSearch = ref<any[]>([]);
const allAccountsForSearch = ref<any[]>([]);

const filteredUsers = computed(() => {
  // 如果在搜索模式，从所有数据中过滤；否则从当前页过滤
  let sourceData = isUserSearchMode.value ? allUsersForSearch.value : users.value;
  
  // 应用密钥到期筛选
  if (keyExpiryFilter.value !== 'all') {
    const now = new Date();
    const soonThreshold = new Date();
    soonThreshold.setDate(now.getDate() + KEY_EXPIRY_DAYS);
    
    sourceData = sourceData.filter(u => {
      // 管理员不显示密钥状态
      if (u.role === 'admin') return keyExpiryFilter.value === 'all';
      
      const expiryDate = u.key_expires_at ? new Date(u.key_expires_at) : null;
      const isExpired = expiryDate && expiryDate < now;
      const isExpiringSoon = expiryDate && expiryDate >= now && expiryDate <= soonThreshold;
      const isValid = expiryDate && expiryDate > soonThreshold;
      const hasNoKey = !u.bound_key && !expiryDate;
      
      switch (keyExpiryFilter.value) {
        case 'expired':
          return isExpired;
        case 'expiring-soon':
          return isExpiringSoon;
        case 'valid':
          return isValid;
        case 'none':
          return hasNoKey;
        default:
          return true;
      }
    });
  }
  
  // 应用搜索筛选
  if (userSearch.value) {
    const search = userSearch.value.toLowerCase();
    return sourceData.filter(u =>
      u.username.toLowerCase().includes(search) ||
      u.email?.toLowerCase().includes(search)
    );
  }
  
  return sourceData;
});

const filteredAccounts = computed(() => {
  if (!accountSearch.value) return accounts.value;
  const search = accountSearch.value.toLowerCase();
  // 如果在搜索模式，从所有数据中过滤；否则从当前页过滤
  const sourceData = isAccountSearchMode.value ? allAccountsForSearch.value : accounts.value;
  return sourceData.filter(a =>
    a.name.toLowerCase().includes(search) ||
    a.account_id.toLowerCase().includes(search) ||
    a.owner_name?.toLowerCase().includes(search)
  );
});

// 子账号全选状态
const isAllAccountsSelected = computed(() => {
  return filteredAccounts.value.length > 0 && filteredAccounts.value.every(account => selectedAccounts.value.includes(account.account_id));
});

// 切换子账号选中状态
function toggleSelectAccount(accountId: string) {
  const index = selectedAccounts.value.indexOf(accountId);
  if (index > -1) {
    selectedAccounts.value.splice(index, 1);
  } else {
    selectedAccounts.value.push(accountId);
  }
}

// 切换全选子账号
function toggleSelectAllAccounts() {
  if (isAllAccountsSelected.value) {
    // 取消全选
    selectedAccounts.value = [];
  } else {
    // 全选
    selectedAccounts.value = filteredAccounts.value.map(account => account.account_id);
  }
}

// 停止单个账号
async function stopSingleAccount(accountId: string) {
  if (!confirm(`确定要停止账号 ${accountId} 的脚本运行吗？`)) {
    return;
  }

  try {
    const response = await axios.post(`/api/auth/admin/accounts/${accountId}/stop`);
    if (response.data.success) {
      alert(`账号 ${accountId} 已停止运行`);
      await loadAccounts();
    } else {
      alert('停止失败: ' + response.data.message);
    }
  } catch (error: any) {
    console.error('停止账号失败:', error);
    alert('停止失败: ' + (error.response?.data?.message || error.message));
  }
}

// 一键停止选中的账号
async function stopSelectedAccounts() {
  if (selectedAccounts.value.length === 0) {
    alert('请先选择要停止的子账号');
    return;
  }

  if (!confirm(`确定要停止选中的 ${selectedAccounts.value.length} 个子账号吗？`)) {
    return;
  }

  isStoppingSelected.value = true;
  let successCount = 0;
  let failCount = 0;
  const failedAccounts: string[] = [];

  try {
    for (const accountId of selectedAccounts.value) {
      try {
        const response = await axios.post(`/api/auth/admin/accounts/${accountId}/stop`);
        if (response.data.success) {
          successCount++;
        } else {
          failCount++;
          failedAccounts.push(accountId);
        }
      } catch (error) {
        failCount++;
        failedAccounts.push(accountId);
      }
    }

    // 显示结果
    let message = `操作完成！\n\n成功: ${successCount} 个\n失败: ${failCount} 个`;
    if (failedAccounts.length > 0) {
      message += `\n\n失败的账号:\n${failedAccounts.join(', ')}`;
    }
    alert(message);

    // 清空选中状态并刷新列表
    selectedAccounts.value = [];
    await loadAccounts();
  } catch (error: any) {
    console.error('一键停止失败:', error);
    alert('操作失败: ' + (error.message || '未知错误'));
  } finally {
    isStoppingSelected.value = false;
  }
}

// 执行用户搜索 - 加载所有数据
async function searchUsers() {
  if (!userSearch.value.trim()) {
    isUserSearchMode.value = false;
    allUsersForSearch.value = [];
    return;
  }
  
  isLoadingUsers.value = true;
  try {
    // 加载所有用户（使用大pageSize）
    const result = await userStore.getAllUsers(1, 10000);
    if (result && result.list) {
      allUsersForSearch.value = result.list;
      isUserSearchMode.value = true;
    }
  } catch (error: any) {
    console.error('搜索用户失败:', error);
  } finally {
    isLoadingUsers.value = false;
  }
}

// 执行账号搜索 - 加载所有数据
async function searchAccounts() {
  if (!accountSearch.value.trim()) {
    isAccountSearchMode.value = false;
    allAccountsForSearch.value = [];
    return;
  }
  
  isLoadingAccounts.value = true;
  try {
    // 加载所有账号（使用大pageSize）
    const result = await userStore.getAllAccounts(1, 10000);
    if (result && result.list) {
      allAccountsForSearch.value = result.list;
      isAccountSearchMode.value = true;
    }
  } catch (error: any) {
    console.error('搜索账号失败:', error);
  } finally {
    isLoadingAccounts.value = false;
  }
}

// 清除用户搜索
function clearUserSearch() {
  userSearch.value = '';
  isUserSearchMode.value = false;
  allUsersForSearch.value = [];
  userPage.value = 1;
  loadUsers();
}

// 清除账号搜索
function clearAccountSearch() {
  accountSearch.value = '';
  isAccountSearchMode.value = false;
  allAccountsForSearch.value = [];
  accountPage.value = 1;
  loadAccounts();
}

// 通用排序函数
function sortKeys(keys: any[]) {
  return [...keys].sort((a, b) => {
    let aVal: any, bVal: any;

    switch (keySortField.value) {
      case 'createdAt':
        aVal = new Date(a.createdAt || 0).getTime();
        bVal = new Date(b.createdAt || 0).getTime();
        break;
      case 'expiresAt':
        aVal = new Date(a.expiresAt || 0).getTime();
        bVal = new Date(b.expiresAt || 0).getTime();
        break;
      case 'usedAt':
        aVal = a.usedAt ? new Date(a.usedAt).getTime() : 0;
        bVal = b.usedAt ? new Date(b.usedAt).getTime() : 0;
        break;
      default:
        aVal = new Date(a.createdAt || 0).getTime();
        bVal = new Date(b.createdAt || 0).getTime();
    }

    if (keySortOrder.value === 'asc') {
      return aVal - bVal;
    } else {
      return bVal - aVal;
    }
  });
}

// 密钥分组计算属性 - 使用 allKeysForStats 来计算总数（全部数据）

// 已过期但有升级权益的密钥
const expiredKeysWithUpgrade = computed(() => {
  const sourceData = allKeysForStats.value.length > 0 ? allKeysForStats.value : keys.value;
  let result = sourceData.filter(key => isKeyExpired(key.expiresAt) && key.hasUpgradeExpiry);

  // 应用搜索过滤
  if (keySearch.value.trim()) {
    const search = keySearch.value.toLowerCase();
    result = result.filter(key =>
      key.key?.toLowerCase().includes(search) ||
      key.assignedUsername?.toLowerCase().includes(search) ||
      key.usedByUsername?.toLowerCase().includes(search)
    );
  }

  // 应用排序
  return sortKeys(result);
});

// 已过期且无升级权益的密钥
const expiredKeysWithoutUpgrade = computed(() => {
  const sourceData = allKeysForStats.value.length > 0 ? allKeysForStats.value : keys.value;
  let result = sourceData.filter(key => isKeyExpired(key.expiresAt) && !key.hasUpgradeExpiry);

  // 应用搜索过滤
  if (keySearch.value.trim()) {
    const search = keySearch.value.toLowerCase();
    result = result.filter(key =>
      key.key?.toLowerCase().includes(search) ||
      key.assignedUsername?.toLowerCase().includes(search) ||
      key.usedByUsername?.toLowerCase().includes(search)
    );
  }

  // 应用排序
  return sortKeys(result);
});

// 兼容旧的 expiredKeys（合并两部分）
const expiredKeys = computed(() => {
  return [...expiredKeysWithUpgrade.value, ...expiredKeysWithoutUpgrade.value];
});

// 有效密钥：未使用且未过期（同时检查 isUsed 和 usedAt，确保数据一致性）
const validKeys = computed(() => {
  const sourceData = allKeysForStats.value.length > 0 ? allKeysForStats.value : keys.value;
  let result = sourceData.filter(key => !key.isUsed && !key.usedAt && !isKeyExpired(key.expiresAt));
  
  // 应用搜索过滤
  if (keySearch.value.trim()) {
    const search = keySearch.value.toLowerCase();
    result = result.filter(key =>
      key.key?.toLowerCase().includes(search) ||
      key.assignedUsername?.toLowerCase().includes(search) ||
      key.usedByUsername?.toLowerCase().includes(search)
    );
  }
  
  // 应用排序
  return sortKeys(result);
});

// 已使用且有效密钥：已使用但未过期（同时检查 isUsed 和 usedAt，确保数据一致性）
const usedKeys = computed(() => {
  const sourceData = allKeysForStats.value.length > 0 ? allKeysForStats.value : keys.value;
  let result = sourceData.filter(key => key.isUsed && key.usedAt && !isKeyExpired(key.expiresAt));
  
  // 应用搜索过滤
  if (keySearch.value.trim()) {
    const search = keySearch.value.toLowerCase();
    result = result.filter(key =>
      key.key?.toLowerCase().includes(search) ||
      key.assignedUsername?.toLowerCase().includes(search) ||
      key.usedByUsername?.toLowerCase().includes(search)
    );
  }
  
  // 应用排序
  return sortKeys(result);
});

// 全选状态计算属性
const isAllValidKeysSelected = computed(() => {
  return validKeys.value.length > 0 && validKeys.value.every(key => selectedKeys.value.includes(key.id));
});

const isAllExpiredKeysSelected = computed(() => {
  return expiredKeys.value.length > 0 && expiredKeys.value.every(key => selectedKeys.value.includes(key.id));
});

// 已过期但有升级权益的密钥全选状态
const isAllExpiredWithUpgradeSelected = computed(() => {
  return expiredKeysWithUpgrade.value.length > 0 && expiredKeysWithUpgrade.value.every(key => selectedKeys.value.includes(key.id));
});

// 已过期且无升级权益的密钥全选状态
const isAllExpiredWithoutUpgradeSelected = computed(() => {
  return expiredKeysWithoutUpgrade.value.length > 0 && expiredKeysWithoutUpgrade.value.every(key => selectedKeys.value.includes(key.id));
});

const isAllUsedKeysSelected = computed(() => {
  return usedKeys.value.length > 0 && usedKeys.value.every(key => selectedKeys.value.includes(key.id));
});

// 升级密钥全选状态
const isAllUpgradeKeysSelected = computed(() => {
  return upgradeKeys.value.length > 0 && upgradeKeys.value.every(key => selectedUpgradeKeys.value.includes(key.id));
});

// 用户全选状态
const isAllUsersSelected = computed(() => {
  const selectableUsers = filteredUsers.value.filter(u => u.role !== 'admin');
  return selectableUsers.length > 0 && selectableUsers.every(user => selectedUsers.value.includes(user.id));
});

async function loadUsers() {
  isLoadingUsers.value = true;
  selectedUsers.value = []; // 清空选中状态
  try {
    const result = await userStore.getAllUsers(userPage.value, userPageSize);
    if (result && result.list) {
      users.value = result.list;
    } else {
      users.value = [];
      console.warn('用户列表数据格式不正确:', result);
    }
  } catch (error: any) {
    console.error('加载用户列表失败:', error);
    // 认证错误由 onMounted 统一处理，这里不显示弹窗
    const message = error.response?.data?.message || error.message || '加载用户列表失败';
    if (!message.includes('令牌') && !message.includes('过期') && !message.includes('登录')) {
      alert('加载用户列表失败: ' + message);
    }
    throw error; // 向上抛出错误，让 onMounted 捕获
  } finally {
    isLoadingUsers.value = false;
  }
}

// 全选/取消全选用户
function toggleSelectAllUsers() {
  if (isAllUsersSelected.value) {
    // 取消全选
    const selectableIds = filteredUsers.value.filter(u => u.role !== 'admin').map(u => u.id);
    selectedUsers.value = selectedUsers.value.filter(id => !selectableIds.includes(id));
  } else {
    // 全选
    const selectableIds = filteredUsers.value.filter(u => u.role !== 'admin').map(u => u.id);
    selectedUsers.value = [...new Set([...selectedUsers.value, ...selectableIds])];
  }
}

// 批量删除用户
async function deleteSelectedUsers() {
  if (selectedUsers.value.length === 0) return;

  if (!confirm(`确定要删除选中的 ${selectedUsers.value.length} 个用户吗？此操作不可恢复！`)) {
    return;
  }

  isDeletingUsers.value = true;
  try {
    const result = await userStore.deleteUsersBatch(selectedUsers.value);
    alert(`删除完成！\n成功: ${result.data.success.length} 个\n失败: ${result.data.failed.length} 个`);
    selectedUsers.value = [];
    await loadUsers();
  } catch (error: any) {
    alert(error.response?.data?.message || '批量删除失败');
  } finally {
    isDeletingUsers.value = false;
  }
}

// 加载用户升级密钥信息
async function loadUserUpgradeKeys(userId: number) {
  isLoadingUserUpgradeKeys.value = true;
  try {
    const result = await userStore.getUserUpgradeKeyInfo(userId);
    userUpgradeKeys.value.set(userId, result);
  } catch (error: any) {
    console.error('加载用户升级密钥信息失败:', error);
  } finally {
    isLoadingUserUpgradeKeys.value = false;
  }
}

// 解绑用户升级密钥
async function unbindUserUpgradeKey(userId: number) {
  if (!confirm('确定要解除该用户的升级密钥绑定吗？\n\n这将：\n1. 重置用户的子账号上限为1个\n2. 恢复所有已使用的升级密钥为未使用状态\n3. 清除用户的升级到期时间')) {
    return;
  }

  isUnbindingUpgradeKey.value = userId;
  try {
    const result = await userStore.unbindUserUpgradeKey(userId);
    alert(`解绑成功！\n\n已重置 ${result.data.resetKeysCount} 个升级密钥\n子账号上限已从 ${result.data.oldMaxAccounts} 个重置为 ${result.data.newMaxAccounts} 个`);
    // 刷新用户升级密钥信息
    await loadUserUpgradeKeys(userId);
    // 刷新用户列表
    await loadUsers();
  } catch (error: any) {
    alert(error.response?.data?.message || '解绑失败');
  } finally {
    isUnbindingUpgradeKey.value = null;
  }
}

// 打开修改有效期对话框
function openEditExtendDaysDialog(key: any) {
  editingUpgradeKey.value = key;
  newExtendDays.value = key.extend_days;
  showEditExtendDaysDialog.value = true;
}

// 确认修改有效期
async function confirmEditExtendDays() {
  if (!editingUpgradeKey.value || !newExtendDays.value) return;

  isSavingExtendDays.value = true;
  try {
    await userStore.updateUpgradeKeyExtendDays(editingUpgradeKey.value.id, newExtendDays.value);
    alert('有效期修改成功！');
    showEditExtendDaysDialog.value = false;
    await loadUpgradeKeys();
  } catch (error: any) {
    alert(error.response?.data?.message || '修改失败');
  } finally {
    isSavingExtendDays.value = false;
  }
}

// 打开创建用户对话框
function openCreateUserDialog() {
  createUserForm.username = '';
  createUserForm.password = '';
  createUserForm.email = '';
  createUserForm.registrationKey = '';
  showCreateUserDialog.value = true;
}

// 自动填充用户名
function autoFillCreateUsername() {
  const email = createUserForm.email.trim();
  const qqEmailRegex = /^[1-9][0-9]{4,10}@qq\.com$/i;
  if (qqEmailRegex.test(email)) {
    createUserForm.username = email.split('@')[0] || '';
  }
}

// 加载待审批用户列表
async function loadPendingUsers() {
  isLoadingPendingUsers.value = true;
  try {
    const response = await axios.get('/api/auth/admin/pending-users');
    pendingUsers.value = response.data.data || [];
  } catch (error: any) {
    console.error('加载待审批用户失败:', error);
    alert(error.response?.data?.message || '加载失败');
  } finally {
    isLoadingPendingUsers.value = false;
  }
}

// 审批用户
async function approveUser(userId: number) {
  if (!confirm('确定要通过该用户的注册申请吗？')) return;

  isApprovingUser.value = userId;
  try {
    await axios.post(`/api/auth/admin/approve-user/${userId}`);
    alert('审批通过！已发送邮件通知用户。');
    await loadPendingUsers();
  } catch (error: any) {
    alert(error.response?.data?.message || '审批失败');
  } finally {
    isApprovingUser.value = null;
  }
}

// 拒绝用户
async function rejectUser(userId: number) {
  if (!confirm('确定要拒绝该用户的注册申请吗？此操作将删除该用户。')) return;

  isRejectingUser.value = userId;
  try {
    await axios.post(`/api/auth/admin/reject-user/${userId}`);
    alert('已拒绝该用户的注册申请。');
    await loadPendingUsers();
  } catch (error: any) {
    alert(error.response?.data?.message || '操作失败');
  } finally {
    isRejectingUser.value = null;
  }
}

// 加载注册设置
async function loadRegistrationSettings() {
  isLoadingRegistrationSettings.value = true;
  try {
    const response = await axios.get('/api/auth/admin/registration-settings');
    if (response.data.success) {
      registrationSettings.value = response.data.data;
    }
  } catch (error: any) {
    console.error('加载注册设置失败:', error);
    alert(error.response?.data?.message || '加载注册设置失败');
  } finally {
    isLoadingRegistrationSettings.value = false;
  }
}

// 保存注册设置
async function saveRegistrationSettings() {
  isSavingRegistrationSettings.value = true;
  try {
    const response = await axios.put('/api/auth/admin/registration-settings', {
      enabled: registrationSettings.value.enabled,
      startTime: registrationSettings.value.startTime,
      endTime: registrationSettings.value.endTime
    });
    if (response.data.success) {
      alert('注册设置已保存');
      registrationSettings.value = response.data.data;
    }
  } catch (error: any) {
    console.error('保存注册设置失败:', error);
    alert(error.response?.data?.message || '保存失败');
  } finally {
    isSavingRegistrationSettings.value = false;
  }
}

// 加载反检测全局设置
async function loadAntiDetectionSettings() {
  isLoadingAntiDetectionSettings.value = true;
  try {
    const response = await axios.get('/api/auth/admin/anti-detection-settings');
    if (response.data.success && response.data.data) {
      const data = response.data.data;
      antiDetectionSettings.value = {
        globalEnabled: data.globalEnabled !== false,
        defaultConfig: {
          enabled: data.defaultConfig?.enabled === true,
          humanMode: {
            intensity: (['low', 'medium', 'high'].includes(data.defaultConfig?.humanMode?.intensity)
              ? data.defaultConfig.humanMode.intensity
              : 'medium') as 'low' | 'medium' | 'high'
          },
          protocol: {
            enableTlog: data.defaultConfig?.protocol?.enableTlog !== false,
            deviceProfile: data.defaultConfig?.protocol?.deviceProfile || 'auto'
          }
        }
      };
    }
  } catch (error: any) {
    console.error('加载反检测设置失败:', error);
    alert(error.response?.data?.message || '加载反检测设置失败');
  } finally {
    isLoadingAntiDetectionSettings.value = false;
  }
}

// 保存反检测全局设置
async function saveAntiDetectionSettings() {
  isSavingAntiDetectionSettings.value = true;
  try {
    const response = await axios.put('/api/auth/admin/anti-detection-settings', {
      globalEnabled: antiDetectionSettings.value.globalEnabled,
      defaultConfig: antiDetectionSettings.value.defaultConfig
    });
    if (response.data.success) {
      antiDetectionSettings.value = response.data.data;
      const broadcast = response.data.broadcast;
      if (broadcast && typeof broadcast.sentCount === 'number') {
        alert(`反检测设置已保存，已下发到 ${broadcast.sentCount}/${broadcast.runningCount} 个在线账号`);
      } else {
        alert('反检测设置已保存');
      }
    }
  } catch (error: any) {
    console.error('保存反检测设置失败:', error);
    alert(error.response?.data?.message || '保存反检测设置失败');
  } finally {
    isSavingAntiDetectionSettings.value = false;
  }
}

// 加载邮箱黑名单
async function loadEmailBlacklist() {
  isLoadingEmailBlacklist.value = true;
  try {
    const response = await axios.get('/api/auth/admin/email-blacklist');
    if (response.data.success) {
      emailBlacklist.value = response.data.data || [];
    }
  } catch (error: any) {
    console.error('加载邮箱黑名单失败:', error);
    alert(error.response?.data?.message || '加载邮箱黑名单失败');
  } finally {
    isLoadingEmailBlacklist.value = false;
  }
}

// 检查邮箱是否在黑名单中
function isEmailBlacklisted(email: string | null | undefined): boolean {
  if (!email) return false;
  return emailBlacklist.value.some(item => item.email === email);
}

// 拉黑邮箱（从活动密钥列表）
async function blacklistEmail(email: string, keyValue: string) {
  if (!email) {
    alert('邮箱地址不能为空');
    return;
  }

  if (isEmailBlacklisted(email)) {
    alert('该邮箱已在黑名单中');
    return;
  }

  if (!confirm(`确定要将邮箱 ${email} 加入黑名单吗？\n\n该用户领取了密钥 ${keyValue} 但未使用。\n\n拉黑后，该邮箱将无法再领取密钥。`)) {
    return;
  }

  try {
    const response = await axios.post('/api/auth/admin/email-blacklist', {
      email: email,
      reason: `领取密钥未使用: ${keyValue}`
    });
    if (response.data.success) {
      emailBlacklist.value = response.data.data;
      alert('邮箱已添加到黑名单');
    }
  } catch (error: any) {
    console.error('添加邮箱到黑名单失败:', error);
    alert(error.response?.data?.message || '添加失败');
  }
}

// 添加邮箱到黑名单
async function addToBlacklist() {
  if (!newBlacklistEmail.value) {
    alert('请输入邮箱地址');
    return;
  }

  // 验证QQ邮箱格式
  const qqEmailRegex = /^[1-9][0-9]{4,10}@qq\.com$/i;
  if (!qqEmailRegex.test(newBlacklistEmail.value)) {
    alert('请使用正确的QQ邮箱格式（如：123456@qq.com）');
    return;
  }

  isAddingToBlacklist.value = true;
  try {
    const response = await axios.post('/api/auth/admin/email-blacklist', {
      email: newBlacklistEmail.value,
      reason: newBlacklistReason.value
    });
    if (response.data.success) {
      emailBlacklist.value = response.data.data;
      newBlacklistEmail.value = '';
      newBlacklistReason.value = '';
      // 先让 UI 更新，再显示提示
      setTimeout(() => {
        alert('邮箱已添加到黑名单');
      }, 0);
    }
  } catch (error: any) {
    console.error('添加邮箱到黑名单失败:', error);
    alert(error.response?.data?.message || '添加失败');
  } finally {
    isAddingToBlacklist.value = false;
  }
}

// 格式化日期时间
function formatDateTime(dateString: string): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
}

// 从黑名单移除邮箱
async function removeFromBlacklist(email: string) {
  if (!confirm(`确定要从黑名单移除 ${email} 吗？`)) return;

  try {
    const response = await axios.delete(`/api/auth/admin/email-blacklist/${email}`);
    if (response.data.success) {
      emailBlacklist.value = response.data.data;
      alert('邮箱已从黑名单移除');
    }
  } catch (error: any) {
    console.error('从黑名单移除邮箱失败:', error);
    alert(error.response?.data?.message || '移除失败');
  }
}

// 确认创建用户
async function confirmCreateUser() {
  if (!createUserForm.email || !createUserForm.password || !createUserForm.registrationKey) {
    alert('请填写所有必填项');
    return;
  }

  isCreatingUser.value = true;
  try {
    await axios.post('/api/auth/admin/create-user', {
      username: createUserForm.username,
      password: createUserForm.password,
      email: createUserForm.email,
      registrationKey: createUserForm.registrationKey
    });
    alert('用户创建成功！');
    showCreateUserDialog.value = false;
    await loadUsers();
  } catch (error: any) {
    alert(error.response?.data?.message || '创建用户失败');
  } finally {
    isCreatingUser.value = false;
  }
}

async function loadAccounts() {
  isLoadingAccounts.value = true;
  try {
    const result = await userStore.getAllAccounts(accountPage.value, accountPageSize);
    if (result && result.list) {
      accounts.value = result.list;
    } else {
      accounts.value = [];
      console.warn('账号列表数据格式不正确:', result);
    }
  } catch (error: any) {
    console.error('加载账号列表失败:', error);
    // 认证错误由 onMounted 统一处理，这里不显示弹窗
    const message = error.response?.data?.message || error.message || '加载账号列表失败';
    if (!message.includes('令牌') && !message.includes('过期') && !message.includes('登录')) {
      alert('加载账号列表失败: ' + message);
    }
    throw error;
  } finally {
    isLoadingAccounts.value = false;
  }
}

// 一键重启所有运行中的账号
async function restartAllAccounts() {
  if (!confirm('确定要一键重启所有运行中的脚本吗？\n\n这将停止并重新启动所有用户正在运行的农场脚本。')) {
    return;
  }

  isRestartingAll.value = true;
  try {
    const response = await axios.post('/api/auth/admin/accounts/restart-all');
    if (response.data.success) {
      const result = response.data.data;
      alert(`重启完成！\n\n总计: ${result.totalCount} 个\n成功: ${result.restartedCount} 个\n失败: ${result.failedCount || 0} 个\n\n${result.message}`);
      // 刷新账号列表
      await loadAccounts();
    } else {
      alert('重启失败: ' + response.data.message);
    }
  } catch (error: any) {
    console.error('一键重启失败:', error);
    const message = error.response?.data?.message || error.message || '一键重启失败';
    alert('一键重启失败: ' + message);
  } finally {
    isRestartingAll.value = false;
  }
}

async function loadKeys() {
  isLoadingKeys.value = true;
  selectedKeys.value = []; // 清空选中状态
  try {
    // 加载当前页数据
    const result = await userStore.getAllKeys(keyPage.value, keyPageSize);
    if (result && result.list) {
      keys.value = result.list;
    } else {
      keys.value = [];
      console.warn('密钥列表数据格式不正确:', result);
    }

    // 同时加载所有密钥用于统计（使用大pageSize）
    try {
      const allResult = await userStore.getAllKeys(1, 10000);
      if (allResult && allResult.list) {
        allKeysForStats.value = allResult.list;
      }
    } catch (statsError) {
      console.warn('加载密钥统计数据失败:', statsError);
    }
  } catch (error: any) {
    console.error('加载密钥列表失败:', error);
    // 认证错误由 onMounted 统一处理，这里不显示弹窗
    const message = error.response?.data?.message || error.message || '加载密钥列表失败';
    if (!message.includes('令牌') && !message.includes('过期') && !message.includes('登录')) {
      alert('加载密钥列表失败: ' + message);
    }
    throw error;
  } finally {
    isLoadingKeys.value = false;
  }
}

// 全选切换方法
function toggleSelectAllValidKeys() {
  if (isAllValidKeysSelected.value) {
    // 取消全选
    selectedKeys.value = selectedKeys.value.filter(id => !validKeys.value.some(key => key.id === id));
  } else {
    // 全选
    const validIds = validKeys.value.map(key => key.id);
    selectedKeys.value = [...new Set([...selectedKeys.value, ...validIds])];
  }
}

// @ts-ignore - 在模板中使用
function toggleSelectAllExpiredKeys() {
  if (isAllExpiredKeysSelected.value) {
    selectedKeys.value = selectedKeys.value.filter(id => !expiredKeys.value.some(key => key.id === id));
  } else {
    const expiredIds = expiredKeys.value.map(key => key.id);
    selectedKeys.value = [...new Set([...selectedKeys.value, ...expiredIds])];
  }
}

function toggleSelectAllExpiredWithUpgrade() {
  if (isAllExpiredWithUpgradeSelected.value) {
    selectedKeys.value = selectedKeys.value.filter(id => !expiredKeysWithUpgrade.value.some(key => key.id === id));
  } else {
    const ids = expiredKeysWithUpgrade.value.map(key => key.id);
    selectedKeys.value = [...new Set([...selectedKeys.value, ...ids])];
  }
}

function toggleSelectAllExpiredWithoutUpgrade() {
  if (isAllExpiredWithoutUpgradeSelected.value) {
    selectedKeys.value = selectedKeys.value.filter(id => !expiredKeysWithoutUpgrade.value.some(key => key.id === id));
  } else {
    const ids = expiredKeysWithoutUpgrade.value.map(key => key.id);
    selectedKeys.value = [...new Set([...selectedKeys.value, ...ids])];
  }
}

function toggleSelectAllUsedKeys() {
  if (isAllUsedKeysSelected.value) {
    selectedKeys.value = selectedKeys.value.filter(id => !usedKeys.value.some(key => key.id === id));
  } else {
    const usedIds = usedKeys.value.map(key => key.id);
    selectedKeys.value = [...new Set([...selectedKeys.value, ...usedIds])];
  }
}

// ========== 升级密钥管理方法 ==========

async function loadUpgradeKeys() {
  isLoadingUpgradeKeys.value = true;
  selectedUpgradeKeys.value = [];
  try {
    const filters: any = {};
    if (upgradeKeyFilter.value.keyType) {
      filters.keyType = upgradeKeyFilter.value.keyType;
    }
    if (upgradeKeyFilter.value.isUsed !== '') {
      filters.isUsed = upgradeKeyFilter.value.isUsed === 'true';
    }
    const result = await userStore.getAllUpgradeKeys(filters);
    upgradeKeys.value = result || [];
  } catch (error: any) {
    console.error('加载升级密钥列表失败:', error);
    const message = error.response?.data?.message || error.message || '加载升级密钥列表失败';
    if (!message.includes('令牌') && !message.includes('过期') && !message.includes('登录')) {
      alert('加载升级密钥列表失败: ' + message);
    }
    throw error;
  } finally {
    isLoadingUpgradeKeys.value = false;
  }
}

function openGenerateUpgradeKeyDialog() {
  showGenerateUpgradeKeyDialog.value = true;
  generatedUpgradeKeys.value = [];
  upgradeKeyForm.value = {
    keyType: 'level1',
    count: 1,
    customMaxAccounts: 2,
    customExtendDays: 15
  };
}

async function generateUpgradeKeys() {
  if (upgradeKeyForm.value.count < 1 || upgradeKeyForm.value.count > 100) {
    alert('生成数量必须在1-100之间');
    return;
  }

  // 自定义密钥类型需要验证参数
  if (upgradeKeyForm.value.keyType === 'custom') {
    if (!upgradeKeyForm.value.customMaxAccounts || upgradeKeyForm.value.customMaxAccounts < 1 || upgradeKeyForm.value.customMaxAccounts > 10) {
      alert('子账号上限必须在1-10之间');
      return;
    }
    if (!upgradeKeyForm.value.customExtendDays || upgradeKeyForm.value.customExtendDays < 1 || upgradeKeyForm.value.customExtendDays > 365) {
      alert('有效期天数必须在1-365之间');
      return;
    }
  }

  isGeneratingUpgradeKey.value = true;
  try {
    // 准备自定义配置
    const customConfig = upgradeKeyForm.value.keyType === 'custom'
      ? {
          maxAccounts: upgradeKeyForm.value.customMaxAccounts,
          extendDays: upgradeKeyForm.value.customExtendDays
        }
      : undefined;

    const result = await userStore.createUpgradeKey(
      upgradeKeyForm.value.keyType,
      upgradeKeyForm.value.count,
      customConfig
    );
    if (Array.isArray(result)) {
      generatedUpgradeKeys.value = result;
    } else {
      generatedUpgradeKeys.value = [result];
    }
    await loadUpgradeKeys();
  } catch (error: any) {
    alert(error.response?.data?.message || '生成升级密钥失败');
  } finally {
    isGeneratingUpgradeKey.value = false;
  }
}

// 验证升级密钥表单
function isUpgradeKeyFormValid(): boolean {
  if (upgradeKeyForm.value.keyType === 'custom') {
    const maxAccounts = upgradeKeyForm.value.customMaxAccounts;
    const extendDays = upgradeKeyForm.value.customExtendDays;
    return (
      maxAccounts >= 1 && maxAccounts <= 10 &&
      extendDays >= 1 && extendDays <= 365
    );
  }
  return true;
}

async function deleteUpgradeKey(keyId: number) {
  if (!confirm('确定要删除这个升级密钥吗？')) {
    return;
  }

  try {
    await userStore.deleteUpgradeKey(keyId);
    await loadUpgradeKeys();
  } catch (error: any) {
    alert(error.response?.data?.message || '删除失败');
  }
}

async function deleteSelectedUpgradeKeys() {
  if (selectedUpgradeKeys.value.length === 0) return;

  if (!confirm(`确定要删除选中的 ${selectedUpgradeKeys.value.length} 个升级密钥吗？`)) {
    return;
  }

  isDeletingUpgradeKeys.value = true;
  try {
    // 逐个删除选中的密钥
    for (const keyId of selectedUpgradeKeys.value) {
      await userStore.deleteUpgradeKey(keyId);
    }
    selectedUpgradeKeys.value = [];
    await loadUpgradeKeys();
    alert('删除成功');
  } catch (error: any) {
    alert(error.response?.data?.message || '删除失败');
  } finally {
    isDeletingUpgradeKeys.value = false;
  }
}

function toggleSelectAllUpgradeKeys() {
  if (isAllUpgradeKeysSelected.value) {
    selectedUpgradeKeys.value = [];
  } else {
    selectedUpgradeKeys.value = upgradeKeys.value.map(key => key.id);
  }
}

// 删除单个密钥
async function deleteKey(keyId: number) {
  const key = keys.value.find(k => k.id === keyId);
  const isUsed = key?.usedAt;

  // 构建确认消息
  let confirmMessage = '';
  if (!isUsed) {
    confirmMessage = '确定要删除该密钥吗？';
  } else if (key?.canSafelyDelete) {
    confirmMessage = '确定要删除该密钥吗？\n\n该密钥已被使用，但用户已被删除或密钥已过期且无升级权益，删除后不会影响用户。';
  } else {
    // 有升级权益的用户
    confirmMessage = `⚠️ 警告：该密钥正在被用户使用！\n\n`;
    confirmMessage += `使用者：${key.usedByUserName}\n`;
    if (key.hasUpgradeExpiry) {
      confirmMessage += `该用户有升级密钥权益，有效期至：${formatDate(key.usedByUserUpgradeExpires)}\n`;
    }
    confirmMessage += `\n删除此密钥将导致：\n`;
    confirmMessage += `1. 用户被冻结（无法登录）\n`;
    confirmMessage += `2. 用户的所有子账号停止运行\n`;
    if (key.hasUpgradeExpiry) {
      confirmMessage += `3. 用户的升级权益将失效\n`;
    }
    confirmMessage += `\n建议：如果只是想清理过期密钥，请先解绑用户的升级密钥，或等待升级权益到期后再删除。\n\n`;
    confirmMessage += `确定要删除吗？`;
  }

  if (!confirm(confirmMessage)) return;

  try {
    await userStore.deleteKey(keyId);
    alert('密钥删除成功');
    await loadKeys();
  } catch (error: any) {
    console.error('删除密钥失败:', error);
    alert(error.response?.data?.message || '删除密钥失败');
  }
}

// 批量删除选中的密钥
async function deleteSelectedKeys() {
  if (selectedKeys.value.length === 0) return;

  const selectedKeyObjects = keys.value.filter(k => selectedKeys.value.includes(k.id));
  const usedCount = selectedKeyObjects.filter(k => k.usedAt).length;
  const unsafeCount = selectedKeyObjects.filter(k => k.usedAt && !k.canSafelyDelete).length;

  let confirmMessage = `确定要删除选中的 ${selectedKeys.value.length} 个密钥吗？`;

  if (unsafeCount > 0) {
    confirmMessage = `⚠️ 警告：选中的密钥中有 ${unsafeCount} 个正在被活跃用户使用中！\n\n`;
    confirmMessage += `这些用户有升级密钥权益，删除后将导致：\n`;
    confirmMessage += `1. 用户被冻结（无法登录）\n`;
    confirmMessage += `2. 用户的所有子账号停止运行\n`;
    confirmMessage += `3. 用户的升级权益将失效\n\n`;
    confirmMessage += `建议：先解绑这些用户的升级密钥，或等待升级权益到期后再删除。\n\n`;
    confirmMessage += `确定要强制删除吗？`;
  } else if (usedCount > 0) {
    confirmMessage += `\n\n其中 ${usedCount} 个密钥已被使用，但这些用户已被删除或密钥已过期且无升级权益，删除后不会影响用户。`;
  }

  if (!confirm(confirmMessage)) return;

  isDeletingKeys.value = true;
  try {
    const result = await userStore.deleteKeysBatch(selectedKeys.value);
    const message = result.message || `成功删除 ${result.deletedCount} 个密钥`;
    alert(message);
    await loadKeys();
  } catch (error: any) {
    console.error('批量删除密钥失败:', error);
    alert(error.response?.data?.message || '批量删除密钥失败');
  } finally {
    isDeletingKeys.value = false;
  }
}

// 设置密钥过期时间（快速选择）
function setKeyExpiry(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  // 格式化为 datetime-local 格式: YYYY-MM-DDTHH:mm
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  newKeyExpiresAt.value = `${year}-${month}-${day}T${hours}:${minutes}`;
}

// 将日期转换为 MySQL datetime 格式 (YYYY-MM-DD HH:mm:ss)
function toMySQLDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

async function generateKey() {
  if (!newKeyExpiresAt.value) return;

  isGeneratingKey.value = true;
  try {
    const result = await userStore.createKey(
      toMySQLDateTime(newKeyExpiresAt.value),
      newKeyAssignedUserId.value || undefined
    );
    generatedKey.value = result.key;
    await loadKeys();
  } catch (error: any) {
    alert(error.response?.data?.message || '生成密钥失败');
  } finally {
    isGeneratingKey.value = false;
  }
}

function isKeyExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

function openGenerateKeyDialog() {
  // 重置所有相关状态
  generatedKey.value = '';
  newKeyExpiresAt.value = '';
  newKeyAssignedUserId.value = null;
  isGeneratingKey.value = false;
  // 打开弹窗
  showGenerateKeyDialog.value = true;
}

async function copyKey(key: string) {
  if (!key) {
    alert('密钥为空，无法复制');
    return;
  }

  try {
    // 尝试使用现代 Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(key);
      alert('密钥已复制到剪贴板');
      return;
    }

    // 降级方案：使用 textarea 复制
    const textArea = document.createElement('textarea');
    textArea.value = key;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (successful) {
      alert('密钥已复制到剪贴板');
    } else {
      throw new Error('execCommand copy failed');
    }
  } catch (err) {
    console.error('复制失败:', err);
    // 如果复制失败，自动选中文本方便用户手动复制
    alert('自动复制失败，请手动复制密钥');
  }
}

async function freezeUser(userId: number) {
  if (!confirm('确定要冻结该用户吗？')) return;
  try {
    await userStore.freezeUser(userId);
    await loadUsers();
  } catch (error) {
    alert('冻结用户失败');
  }
}

async function unfreezeUser(userId: number) {
  if (!confirm('确定要解冻该用户吗？')) return;
  try {
    await userStore.unfreezeUser(userId);
    await loadUsers();
  } catch (error) {
    alert('解冻用户失败');
  }
}

async function deleteUser(userId: number) {
  if (!confirm('确定要删除该用户吗？此操作不可恢复！')) return;
  try {
    await userStore.deleteUser(userId);
    await loadUsers();
  } catch (error) {
    alert('删除用户失败');
  }
}

async function resetPassword(userId: number) {
  if (!confirm('确定要重置该用户的密码为 "user666" 吗？')) return;
  try {
    const message = await userStore.resetUserPassword(userId, 'user666');
    alert(message);
  } catch (error: any) {
    const message = error.response?.data?.message || '重置密码失败';
    alert(message);
  }
}

// 修改用户子账号上限 - 打开对话框
function editMaxAccounts(user: any) {
  editingUser.value = user;
  newMaxAccounts.value = user.max_accounts || 1;
  showEditMaxAccountsDialog.value = true;
}

// 确认修改子账号上限
async function confirmEditMaxAccounts() {
  if (!editingUser.value || !newMaxAccounts.value || newMaxAccounts.value < 1) return;

  try {
    await userStore.updateUserMaxAccounts(editingUser.value.id, newMaxAccounts.value);
    alert(`子账号上限已修改为: ${newMaxAccounts.value}`);
    showEditMaxAccountsDialog.value = false;
    await loadUsers();
  } catch (error: any) {
    const message = error.response?.data?.message || '修改失败';
    alert(message);
  }
}

// 公告管理 - 加载公告列表
async function loadAnnouncements() {
  isLoadingAnnouncements.value = true;
  try {
    const response = await axios.get('/api/announcements');
    announcements.value = response.data.announcements || [];
  } catch (error: any) {
    console.error('加载公告失败:', error);
    // 认证错误由 onMounted 统一处理，这里不显示弹窗
    const message = error.response?.data?.message || '';
    if (!message.includes('令牌') && !message.includes('过期') && !message.includes('登录')) {
      alert('加载公告列表失败');
    }
    throw error;
  } finally {
    isLoadingAnnouncements.value = false;
  }
}

// 公告管理 - 打开对话框
function openAnnouncementDialog(announcement?: any) {
  if (announcement) {
    editingAnnouncement.value = announcement;
    announcementForm.value = {
      title: announcement.title,
      content: announcement.content,
      intervalHours: announcement.interval_hours,
      isActive: announcement.is_active
    };
  } else {
    editingAnnouncement.value = null;
    announcementForm.value = {
      title: '',
      content: '',
      intervalHours: 24,
      isActive: true
    };
  }
  showAnnouncementDialog.value = true;
}

// 公告管理 - 保存公告
async function saveAnnouncement() {
  if (!announcementForm.value.title || !announcementForm.value.content) return;

  isSavingAnnouncement.value = true;
  try {
    if (editingAnnouncement.value) {
      await axios.put(`/api/announcements/${editingAnnouncement.value.id}`, {
        title: announcementForm.value.title,
        content: announcementForm.value.content,
        intervalHours: announcementForm.value.intervalHours,
        isActive: announcementForm.value.isActive
      });
      alert('公告更新成功');
    } else {
      await axios.post('/api/announcements', {
        title: announcementForm.value.title,
        content: announcementForm.value.content,
        intervalHours: announcementForm.value.intervalHours
      });
      alert('公告发布成功');
    }
    showAnnouncementDialog.value = false;
    await loadAnnouncements();
  } catch (error: any) {
    console.error('保存公告失败:', error);
    alert(error.response?.data?.message || '保存公告失败');
  } finally {
    isSavingAnnouncement.value = false;
  }
}

// 公告管理 - 删除公告
async function deleteAnnouncement(id: number) {
  if (!confirm('确定要删除这条公告吗？')) return;

  try {
    await axios.delete(`/api/announcements/${id}`);
    alert('公告删除成功');
    await loadAnnouncements();
  } catch (error: any) {
    console.error('删除公告失败:', error);
    alert(error.response?.data?.message || '删除公告失败');
  }
}

// 更换用户密钥
async function openChangeKeyDialog(userId: number) {
  const newKey = prompt('请输入新的注册密钥：');
  if (!newKey || !newKey.trim()) return;

  try {
    await userStore.adminChangeUserKey(userId, newKey.trim());
    alert('密钥更换成功');
    await loadUsers();
  } catch (error: any) {
    const message = error.response?.data?.message || '更换密钥失败';
    alert(message);
  }
}

// 为用户绑定升级密钥
async function openBindUpgradeKeyDialog(userId: number) {
  const keyValue = prompt('请输入升级密钥：');
  if (!keyValue || !keyValue.trim()) return;

  try {
    await axios.post(`/api/upgrade-keys/admin/bind/${userId}`, {
      keyValue: keyValue.trim()
    });
    alert('升级密钥绑定成功');
    await loadUsers();
    // 如果当前用户已展开，刷新升级密钥信息
    if (expandedUserId.value === userId) {
      await loadUserUpgradeKeys(userId);
    }
  } catch (error: any) {
    const message = error.response?.data?.message || '绑定升级密钥失败';
    alert(message);
  }
}

// 切换用户展开状态
async function toggleUserExpand(userId: number) {
  if (expandedUserId.value === userId) {
    expandedUserId.value = null;
  } else {
    expandedUserId.value = userId;
    // 如果还没有加载过该用户的账号，则加载
    if (!userAccounts.value.has(userId)) {
      await loadUserAccounts(userId);
    }
    // 如果还没有加载过该用户的升级密钥信息，则加载
    if (!userUpgradeKeys.value.has(userId)) {
      await loadUserUpgradeKeys(userId);
    }
  }
}

// 加载指定用户的子账号
async function loadUserAccounts(userId: number) {
  isLoadingUserAccounts.value = true;
  try {
    const accounts = await userStore.getUserAccounts(userId);
    userAccounts.value.set(userId, accounts);
  } catch (error: any) {
    console.error('加载用户子账号失败:', error);
    const message = error.response?.data?.message || '加载子账号失败';
    alert(message);
  } finally {
    isLoadingUserAccounts.value = false;
  }
}

// 格式化运行时间
function formatOnlineTime(minutes: number): string {
  if (!minutes || minutes <= 0) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}小时${mins}分钟`;
  }
  return `${mins}分钟`;
}

async function deleteAccount(accountId: string) {
  if (!confirm('确定要删除该账号吗？此操作不可恢复！')) return;
  try {
    await userStore.deleteAccount(accountId);
    await loadAccounts();
  } catch (error) {
    alert('删除账号失败');
  }
}

// 删除用户的子账号
async function deleteUserAccount(userId: number, accountId: string) {
  if (!confirm(`确定要删除该子账号吗？\n账号ID: ${accountId}\n此操作不可恢复！`)) return;

  isDeletingAccount.value = accountId;
  try {
    await userStore.adminDeleteAccount(accountId);
    // 重新加载该用户的子账号列表
    await loadUserAccounts(userId);
    alert('子账号删除成功');
  } catch (error: any) {
    console.error('删除子账号失败:', error);
    alert(error.response?.data?.message || '删除子账号失败');
  } finally {
    isDeletingAccount.value = null;
  }
}

// 停止用户的子账号
async function stopUserAccount(userId: number, accountId: string) {
  if (!confirm(`确定要停止该子账号的脚本运行吗？\n账号ID: ${accountId}`)) return;

  isStoppingAccount.value = accountId;
  try {
    await axios.post(`/api/auth/accounts/${accountId}/stop`);
    // 重新加载该用户的子账号列表
    await loadUserAccounts(userId);
    alert('子账号已停止运行');
  } catch (error: any) {
    console.error('停止子账号失败:', error);
    alert(error.response?.data?.message || '停止子账号失败');
  } finally {
    isStoppingAccount.value = null;
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN');
}

// 设置axios认证头
function setAxiosAuthHeader() {
  const token = localStorage.getItem('token');
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
}

// 密钥发放管理 - 加载活动列表
async function loadCampaigns() {
  isLoadingCampaigns.value = true;
  try {
    // 确保设置认证头
    setAxiosAuthHeader();
    const response = await axios.get('/api/admin/key-distribution/campaigns');
    campaigns.value = response.data.campaigns || [];
  } catch (error: any) {
    console.error('加载发放活动失败:', error);
    // 认证错误由 onMounted 统一处理，这里不显示弹窗
    const message = error.response?.data?.message || '';
    if (!message.includes('令牌') && !message.includes('过期') && !message.includes('登录')) {
      alert(message || '加载发放活动失败');
    }
    throw error;
  } finally {
    isLoadingCampaigns.value = false;
  }
}

// 密钥发放管理 - 打开创建对话框
function openCreateCampaignDialog() {
  campaignForm.value = {
    name: '',
    minDays: 3,
    maxDays: 7,
    totalQuota: 100
  };
  showCreateCampaignDialog.value = true;
}

// 密钥发放管理 - 创建活动
async function createCampaign() {
  if (!isCampaignFormValid.value) return;

  isCreatingCampaign.value = true;
  try {
    setAxiosAuthHeader();
    const response = await axios.post('/api/admin/key-distribution/campaigns', {
      name: campaignForm.value.name,
      minDays: campaignForm.value.minDays,
      maxDays: campaignForm.value.maxDays,
      totalQuota: campaignForm.value.totalQuota
    });
    alert(`活动创建成功！\n活动名称：${response.data.campaign.name}\n发放数量：${response.data.distributedKeys?.length || 0} 个密钥`);
    showCreateCampaignDialog.value = false;
    await loadCampaigns();
  } catch (error: any) {
    console.error('创建发放活动失败:', error);
    alert(error.response?.data?.message || '创建发放活动失败');
  } finally {
    isCreatingCampaign.value = false;
  }
}

// 密钥发放管理 - 停止活动
async function stopCampaign(campaignId: number) {
  if (!confirm('确定要停止该发放活动吗？停止后将无法领取密钥。')) return;

  try {
    setAxiosAuthHeader();
    await axios.put(`/api/admin/key-distribution/campaigns/${campaignId}/status`, {
      isActive: false
    });
    alert('活动已停止');
    await loadCampaigns();
  } catch (error: any) {
    console.error('停止活动失败:', error);
    alert(error.response?.data?.message || '停止活动失败');
  }
}

// 密钥发放管理 - 恢复活动
async function resumeCampaign(campaignId: number) {
  try {
    setAxiosAuthHeader();
    await axios.put(`/api/admin/key-distribution/campaigns/${campaignId}/status`, {
      isActive: true
    });
    alert('活动已恢复');
    await loadCampaigns();
  } catch (error: any) {
    console.error('恢复活动失败:', error);
    alert(error.response?.data?.message || '恢复活动失败');
  }
}

// 密钥发放管理 - 删除活动
async function deleteCampaign(campaignId: number) {
  if (!confirm('确定要删除该发放活动吗？此操作不可恢复！')) return;

  try {
    setAxiosAuthHeader();
    await axios.delete(`/api/admin/key-distribution/campaigns/${campaignId}`);
    alert('活动已删除');
    await loadCampaigns();
  } catch (error: any) {
    console.error('删除活动失败:', error);
    alert(error.response?.data?.message || '删除活动失败');
  }
}

// 密钥发放管理 - 查看活动密钥
async function viewCampaignKeys(campaignId: number) {
  currentCampaignId.value = campaignId;
  showCampaignKeysDialog.value = true;
  isLoadingCampaignKeys.value = true;
  campaignKeys.value = [];

  try {
    setAxiosAuthHeader();
    // 同时加载活动密钥和邮箱黑名单
    const [keysResponse, blacklistResponse] = await Promise.all([
      axios.get(`/api/admin/key-distribution/campaigns/${campaignId}`),
      axios.get('/api/auth/admin/email-blacklist')
    ]);
    campaignKeys.value = keysResponse.data.keys || [];
    if (blacklistResponse.data.success) {
      emailBlacklist.value = blacklistResponse.data.data || [];
    }
  } catch (error: any) {
    console.error('加载活动密钥失败:', error);
    alert(error.response?.data?.message || '加载活动密钥失败');
  } finally {
    isLoadingCampaignKeys.value = false;
  }
}

// 标记是否已经显示过认证错误
let hasShownAuthError = false;

onMounted(() => {
  // 重置错误标记
  hasShownAuthError = false;
  // 使用 Promise.allSettled 并行加载，避免一个失败影响其他
  Promise.allSettled([
    loadUsers(),
    loadAccounts(),
    loadKeys(),
    loadUpgradeKeys(),
    loadCampaigns(),
    loadAnnouncements(),
    loadPendingUsers()
  ]).then((results) => {
    // 检查是否有认证错误
    const hasAuthError = results.some(
      (result) =>
        result.status === 'rejected' &&
        (result.reason?.message?.includes('登录已过期') ||
         result.reason?.response?.data?.message?.includes('令牌'))
    );

    if (hasAuthError && !hasShownAuthError) {
      hasShownAuthError = true;
      // 只显示一次错误提示
      alert('登录已过期，请重新登录');
      // 关闭管理员面板
      emit('close');
    }
  });
});
</script>

<style scoped>
.admin-overlay {
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

/* 对话框遮罩层 */
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
  z-index: 1100;
  padding: 20px;
}

.admin-panel {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 1200px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.admin-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1e293b;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #64748b;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.admin-tabs {
  display: flex;
  gap: 8px;
  padding: 16px 24px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
}

.tab-btn {
  padding: 8px 16px;
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

.tab-btn .badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: #ef4444;
  color: white;
  font-size: 11px;
  font-weight: 600;
  border-radius: 9px;
  margin-left: 6px;
}

.admin-content {
  flex: 1;
  overflow: auto;
  padding: 24px;
}

.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.search-box {
  display: flex;
  gap: 8px;
  flex: 1;
  align-items: center;
}

/* 筛选框样式 */
.filter-box {
  display: flex;
  align-items: center;
}

.filter-select {
  padding: 10px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 150px;
}

.filter-select:focus {
  outline: none;
  border-color: #3b82f6;
}

.filter-select:hover {
  border-color: #d1d5db;
}

.search-input {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
}

/* 排序控件样式 */
.sort-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.sort-select {
  padding: 10px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.sort-select:focus {
  outline: none;
  border-color: #3b82f6;
}

.sort-order-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  background: #f1f5f9;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.sort-order-btn:hover {
  background: #e2e8f0;
  color: #374151;
}

.search-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: #3b82f6;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
  white-space: nowrap;
}

.search-btn:hover:not(:disabled) {
  background: #2563eb;
}

.search-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.clear-search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  background: #f1f5f9;
  border: none;
  border-radius: 6px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-search-btn:hover {
  background: #e2e8f0;
  color: #374151;
}

.search-result-info {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
  color: #64748b;
  font-size: 14px;
  background: #f8fafc;
  border-radius: 8px;
  margin-top: 16px;
}

.filter-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  padding: 2px 8px;
  background: #dbeafe;
  color: #1e40af;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.clear-filter-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  margin: 0;
  background: none;
  border: none;
  color: #1e40af;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  border-radius: 50%;
  transition: all 0.2s;
}

.clear-filter-btn:hover {
  background: rgba(30, 64, 175, 0.1);
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: #f1f5f9;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:hover {
  background: #e2e8f0;
}

.create-user-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  border-radius: 8px;
  font-size: 14px;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.create-user-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.toolbar-btns {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.restart-all-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border: none;
  border-radius: 8px;
  font-size: 14px;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.restart-all-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
}

.restart-all-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.stop-selected-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  border: none;
  border-radius: 8px;
  font-size: 14px;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
  animation: pulse-red 2s infinite;
}

@keyframes pulse-red {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
  }
}

.stop-selected-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

.stop-selected-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  animation: none;
}

/* 子账号表格选中样式 */
.data-table tbody tr.selected {
  background: #fef2f2;
}

.data-table tbody tr.selected:hover {
  background: #fee2e2;
}

.checkbox-col {
  width: 40px;
  text-align: center;
}

.checkbox-col input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #3b82f6;
}

.action-btn.stop {
  background: #fee2e2;
  color: #dc2626;
}

.action-btn.stop:hover:not(:disabled) {
  background: #fecaca;
}

.action-btn.stop:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.data-table {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th, td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

th {
  font-weight: 600;
  color: #374151;
  background: #f8fafc;
}

tr:hover {
  background: #f8fafc;
}

.role-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.role-badge.admin {
  background: #fef3c7;
  color: #d97706;
}

.role-badge.user {
  background: #dbeafe;
  color: #2563eb;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.active {
  background: #dcfce7;
  color: #16a34a;
}

.status-badge.frozen {
  background: #fee2e2;
  color: #dc2626;
}

.status-badge.deleted {
  background: #f3f4f6;
  color: #6b7280;
}

.status-badge.offline {
  background: #f3f4f6;
  color: #6b7280;
}

.status-badge.stopped {
  background: #fef3c7;
  color: #d97706;
}

/* 展开按钮 */
.expand-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  margin-right: 8px;
  color: #64748b;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.expand-btn:hover {
  color: #3b82f6;
  background: #f1f5f9;
  border-radius: 4px;
}

.expand-btn.expanded svg {
  transform: rotate(90deg);
}

.expand-btn svg {
  transition: transform 0.2s;
}

/* 用户主行样式 */
.user-main-row {
  transition: background-color 0.2s;
}

.user-main-row:hover {
  background-color: #f8fafc;
}

.user-main-row.expanded {
  background-color: #eff6ff;
}

/* 子账号展开行 */
.user-accounts-row {
  background-color: #f8fafc;
}

.accounts-cell {
  padding: 0 !important;
  border-bottom: none !important;
}

.accounts-panel {
  padding: 16px 24px;
  border-top: 1px dashed #e2e8f0;
}

.accounts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.accounts-header h4 {
  margin: 0;
  font-size: 14px;
  color: #374151;
  font-weight: 600;
}

.refresh-accounts-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #e0e7ff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  color: #4f46e5;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-accounts-btn:hover:not(:disabled) {
  background: #c7d2fe;
}

.refresh-accounts-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 子账号列表样式 */
.accounts-list {
  background: white;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.accounts-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.accounts-table th,
.accounts-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.accounts-table th {
  background: #f1f5f9;
  font-weight: 600;
  color: #374151;
  font-size: 12px;
}

.accounts-table tbody tr:last-child td {
  border-bottom: none;
}

.accounts-table tbody tr:hover {
  background: #f8fafc;
}

.account-id {
  font-family: monospace;
  font-size: 12px;
  color: #6b7280;
}

.code-cell {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
  font-size: 11px;
  color: #6b7280;
}

.account-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stop-account-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid #f59e0b;
  border-radius: 4px;
  background: white;
  color: #f59e0b;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.stop-account-btn:hover:not(:disabled) {
  background: #f59e0b;
  color: white;
}

.stop-account-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.delete-account-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid #ef4444;
  border-radius: 4px;
  background: white;
  color: #ef4444;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.delete-account-btn:hover:not(:disabled) {
  background: #ef4444;
  color: white;
}

.delete-account-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.platform-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.platform-badge.qq {
  background: #dbeafe;
  color: #2563eb;
}

.platform-badge.wx {
  background: #dcfce7;
  color: #16a34a;
}

/* 加载和空状态 */
.accounts-loading,
.accounts-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: #6b7280;
  font-size: 13px;
}

.accounts-empty {
  flex-direction: column;
  color: #9ca3af;
}

.accounts-empty svg {
  margin-bottom: 8px;
  opacity: 0.5;
}

.action-btns {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 6px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.freeze {
  background: #fef3c7;
  color: #d97706;
}

.action-btn.unfreeze {
  background: #dcfce7;
  color: #16a34a;
}

.action-btn.delete {
  background: #fee2e2;
  color: #dc2626;
}

.action-btn.reset-password {
  background: #e0e7ff;
  color: #4f46e5;
}

.action-btn.change-key {
  background: #fef3c7;
  color: #d97706;
}

.action-btn.upgrade-key {
  background: #fce7f3;
  color: #be185d;
}

.action-btn.approve {
  background: #dcfce7;
  color: #16a34a;
}

.action-btn.reject {
  background: #fee2e2;
  color: #dc2626;
}

.action-btn.edit-max {
  background: #f3f4f6;
  color: #6b7280;
  margin-left: 4px;
  padding: 4px 6px;
  min-width: 24px;
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.action-btn.blacklist {
  background: #fee2e2;
  color: #dc2626;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 500;
}

.action-btn.blacklist:hover:not(:disabled) {
  background: #dc2626;
  color: white;
}

.action-btn.blacklist:disabled {
  background: #f3f4f6;
  color: #9ca3af;
  cursor: not-allowed;
}

.blacklisted-email {
  color: #dc2626;
  text-decoration: line-through;
  font-weight: 500;
}

.key-used-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  background: #dcfce7;
  color: #16a34a;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.action-btn:hover {
  opacity: 0.8;
}

/* 子账号数量显示 */
.account-count {
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  color: #374151;
}

/* 密钥标签样式 */
.key-badge {
  font-family: monospace;
  font-size: 12px;
  color: #4f46e5;
  background: #e0e7ff;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: help;
}

.no-key {
  color: #9ca3af;
}

.key-status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.key-status-badge.valid {
  background: #dcfce7;
  color: #16a34a;
}

.key-status-badge.expired {
  background: #fee2e2;
  color: #dc2626;
}

.key-status-badge.admin {
  background: #dbeafe;
  color: #2563eb;
}

.key-status-badge.none {
  background: #f3f4f6;
  color: #6b7280;
}

.key-status-badge.used {
  background: #f3f4f6;
  color: #6b7280;
}

.key-status-badge.unused {
  background: #dcfce7;
  color: #16a34a;
}

/* 密钥到期时间样式 */
.key-expiry-time {
  font-size: 12px;
  color: #374151;
}

.key-expiry-time.expired {
  color: #dc2626;
  font-weight: 500;
}

/* 密钥管理样式 */
.generate-key-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.generate-key-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.key-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.key-cell code {
  font-family: monospace;
  font-size: 12px;
  color: #4f46e5;
  background: #e0e7ff;
  padding: 4px 8px;
  border-radius: 4px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #6b7280;
  transition: color 0.2s;
}

.copy-btn:hover {
  color: #3b82f6;
}

/* 生成密钥对话框 */
.generate-key-dialog {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

@media (max-width: 480px) {
  .dialog-overlay {
    padding: 10px;
  }

  .generate-key-dialog {
    width: 100%;
    max-height: calc(100vh - 20px);
    border-radius: 8px;
  }

  .generate-key-dialog .dialog-header {
    padding: 14px 16px;
  }

  .generate-key-dialog .dialog-body {
    padding: 12px 16px;
    max-height: calc(100vh - 160px);
  }

  .generate-key-dialog .dialog-footer {
    padding: 12px 16px;
    flex-direction: column-reverse;
    gap: 8px;
  }

  .generate-key-dialog .dialog-footer button {
    width: 100%;
  }
}

.generate-key-dialog .dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.generate-key-dialog .dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.generate-key-dialog .dialog-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  max-height: calc(100vh - 200px);
}

.generate-key-dialog .form-group {
  margin-bottom: 16px;
}

.generate-key-dialog .form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}

.generate-key-dialog .form-group input,
.generate-key-dialog .form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s;
  box-sizing: border-box;
}

.generate-key-dialog .form-group input:focus,
.generate-key-dialog .form-group select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* 快速选择按钮 */
.quick-select-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.quick-select-btn {
  padding: 6px 12px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-select-btn:hover {
  background: #e5e7eb;
  border-color: #d1d5db;
}

.quick-select-btn:active {
  background: #d1d5db;
}

.generated-key-result {
  margin-top: 20px;
  padding: 16px;
  background: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 8px;
}

.generated-key-result label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #166534;
  margin-bottom: 8px;
}

.key-display {
  display: flex;
  align-items: stretch;
  gap: 8px;
  margin-bottom: 8px;
}

.key-display code {
  flex: 1;
  min-width: 0;
  font-family: monospace;
  font-size: 14px;
  color: #166534;
  background: white;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid #86efac;
  word-break: break-all;
  display: flex;
  align-items: center;
}

.key-display .copy-btn {
  flex-shrink: 0;
  width: 40px;
  height: auto;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #86efac;
  border-radius: 6px;
  color: #166534;
  cursor: pointer;
  transition: all 0.2s;
}

.key-display .copy-btn:hover {
  background: #f0fdf4;
  border-color: #166534;
}

@media (max-width: 480px) {
  .key-display {
    flex-direction: column;
    align-items: stretch;
  }

  .key-display .copy-btn {
    width: 100%;
    height: 40px;
  }
}

.key-warning {
  margin: 0;
  font-size: 12px;
  color: #dc2626;
}

.generate-key-dialog .dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  background: white;
  flex-shrink: 0;
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

.btn-secondary:hover {
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

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.pagination button {
  padding: 8px 16px;
  background: #f1f5f9;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.pagination button:hover:not(:disabled) {
  background: #e2e8f0;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination span {
  font-size: 14px;
  color: #64748b;
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #64748b;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

.spinner-small {
  display: inline-block;
  width: 14px;
  height: 14px;
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

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #9ca3af;
}

.empty-state svg {
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  font-size: 14px;
  margin: 0;
}

/* 刷新按钮禁用状态 */
.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 修改子账号上限对话框样式 */
.edit-max-dialog {
  max-width: 420px;
  width: 90%;
}

.form-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.form-group.half {
  flex: 1;
  margin-bottom: 0;
}

.info-display {
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #374151;
  min-height: 40px;
  display: flex;
  align-items: center;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s;
  min-height: 40px;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.required {
  color: #ef4444;
}

/* 公告管理样式 */
.announcement-title {
  font-weight: 500;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.announcement-preview {
  color: #6b7280;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.announcement-actions {
  display: flex;
  gap: 8px;
}

.edit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  background: white;
  color: #3b82f6;
  cursor: pointer;
  transition: all 0.2s;
}

.edit-btn:hover {
  background: #3b82f6;
  color: white;
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.active {
  background: #dcfce7;
  color: #16a34a;
}

.status-badge.inactive {
  background: #f3f4f6;
  color: #6b7280;
}

.announcement-dialog {
  background: white;
  border-radius: 16px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.announcement-dialog .dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  flex-shrink: 0;
}

.announcement-dialog .dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: white;
}

.announcement-dialog .dialog-header .close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  transition: all 0.2s;
}

.announcement-dialog .dialog-header .close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.announcement-dialog .dialog-body {
  padding: 24px;
  flex: 1;
  overflow-y: auto;
  background: #f8fafc;
  max-height: calc(90vh - 140px);
}

.announcement-dialog .dialog-footer {
  flex-shrink: 0;
  padding: 16px 24px;
  background: white;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.announcement-dialog .form-group {
  margin-bottom: 20px;
}

.announcement-dialog .form-group:last-child {
  margin-bottom: 0;
}

.announcement-dialog .form-group label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 8px;
}

.announcement-dialog .form-group label .required {
  color: #ef4444;
  margin-left: 4px;
}

.announcement-dialog .form-group input,
.announcement-dialog .form-group textarea,
.announcement-dialog .form-group select {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s;
  box-sizing: border-box;
  font-family: inherit;
  background: white;
}

.announcement-dialog .form-group textarea {
  resize: vertical;
  min-height: 120px;
}

.announcement-dialog .form-group input:focus,
.announcement-dialog .form-group textarea:focus,
.announcement-dialog .form-group select:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.announcement-dialog .form-group input::placeholder,
.announcement-dialog .form-group textarea::placeholder {
  color: #94a3b8;
}

.announcement-dialog .btn-secondary,
.announcement-dialog .btn-primary {
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.announcement-dialog .btn-secondary {
  background: #f1f5f9;
  color: #475569;
}

.announcement-dialog .btn-secondary:hover {
  background: #e2e8f0;
  color: #334155;
}

.announcement-dialog .btn-primary {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.announcement-dialog .btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.announcement-dialog .btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 密钥管理样式 */
.keys-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.key-group {
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  max-height: 500px;
}

.key-group.expired-group {
  background: #fef2f2;
  border-color: #fecaca;
}

.key-group.used-group {
  background: #f3f4f6;
  border-color: #d1d5db;
}

.key-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
  background: inherit;
  border-radius: 12px 12px 0 0;
}

.key-group-header:hover {
  background: rgba(0, 0, 0, 0.02);
}

.key-group-content {
  overflow-y: auto;
  padding: 0 16px 16px 16px;
  flex: 1;
}

.key-group-content::-webkit-scrollbar {
  width: 6px;
}

.key-group-content::-webkit-scrollbar-track {
  background: transparent;
}

.key-group-content::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.key-group-content::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.key-group-header:hover {
  opacity: 0.8;
}

.expand-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
  color: #64748b;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.key-group-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.status-dot.valid {
  background: #22c55e;
}

.status-dot.expired {
  background: #ef4444;
}

.status-dot.used {
  background: #6b7280;
}

.select-all-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #64748b;
  cursor: pointer;
}

.select-all-label input[type="checkbox"] {
  cursor: pointer;
}

.checkbox-col {
  width: 40px;
  text-align: center;
}

.checkbox-col input[type="checkbox"] {
  cursor: pointer;
  width: 16px;
  height: 16px;
}

tr.selected {
  background: #eff6ff !important;
}

.delete-selected-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.delete-selected-btn:hover:not(:disabled) {
  background: #fecaca;
}

.delete-selected-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 密钥发放管理样式 */
.campaign-name {
  font-weight: 500;
  color: #374151;
}

.remaining-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  background: #dcfce7;
  color: #16a34a;
}

.remaining-badge.low {
  background: #fef3c7;
  color: #d97706;
}

.remaining-badge.empty {
  background: #fee2e2;
  color: #dc2626;
}

.action-btn.view-keys {
  background: #dbeafe;
  color: #2563eb;
}

.empty-hint {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 8px;
}

/* 创建活动对话框 */
.campaign-dialog {
  background: white;
  border-radius: 16px;
  max-width: 480px;
  width: 90%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.campaign-dialog .dialog-header {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.campaign-dialog .dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: white;
}

.campaign-dialog .dialog-header .close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  transition: all 0.2s;
}

.campaign-dialog .dialog-header .close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.campaign-dialog .dialog-body {
  flex: 1;
  overflow-y: auto;
  max-height: calc(90vh - 140px);
  padding: 24px;
  background: #f8fafc;
}

.campaign-dialog .dialog-footer {
  flex-shrink: 0;
  padding: 16px 24px;
  background: white;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.campaign-dialog .form-group {
  margin-bottom: 20px;
}

.campaign-dialog .form-group:last-child {
  margin-bottom: 0;
}

.campaign-dialog .form-group label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 8px;
}

.campaign-dialog .form-group label .required {
  color: #ef4444;
  margin-left: 4px;
}

.campaign-dialog .form-hint {
  display: block;
  font-size: 12px;
  color: #64748b;
  margin-top: 6px;
  line-height: 1.4;
}

.campaign-dialog .form-group input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s;
  box-sizing: border-box;
  background: white;
}

.campaign-dialog .form-group input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.campaign-dialog .form-group input::placeholder {
  color: #94a3b8;
}

.campaign-dialog .btn-secondary,
.campaign-dialog .btn-primary {
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.campaign-dialog .btn-secondary {
  background: #f1f5f9;
  color: #475569;
}

.campaign-dialog .btn-secondary:hover {
  background: #e2e8f0;
  color: #334155;
}

.campaign-dialog .btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.campaign-dialog .btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.campaign-dialog .btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 查看密钥对话框 */
.campaign-keys-dialog {
  max-width: 800px;
  width: 90%;
  max-height: 80vh;
}

.campaign-keys-dialog .dialog-body {
  max-height: 60vh;
  overflow-y: auto;
}

.campaign-keys-table {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.campaign-keys-table table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
}

.campaign-keys-table th,
.campaign-keys-table td {
  padding: 12px 16px;
  text-align: left;
}

.campaign-keys-table th {
  font-weight: 600;
  color: #1e293b;
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 2px solid #cbd5e1;
}

.campaign-keys-table tbody tr {
  background: #ffffff;
  transition: all 0.2s ease;
}

.campaign-keys-table tbody tr:nth-child(even) {
  background: #f8fafc;
}

.campaign-keys-table tbody tr:hover {
  background: #e0f2fe;
  transform: scale(1.002);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.campaign-keys-table td {
  border-bottom: 1px solid #e2e8f0;
  color: #334155;
  font-weight: 500;
}

.campaign-keys-table tbody tr:last-child td {
  border-bottom: none;
}

.campaign-keys-table .key-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.campaign-keys-table .key-cell code {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #1e40af;
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  padding: 6px 10px;
  border-radius: 6px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 1px solid #93c5fd;
  font-weight: 600;
}

.campaign-keys-table .copy-btn {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #64748b;
}

.campaign-keys-table .copy-btn:hover {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
}

/* 移动端适配 */
@media (max-width: 640px) {
  .admin-panel {
    width: 100%;
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
    height: 100vh;
  }

  .admin-content {
    padding: 16px;
  }

  .edit-max-dialog {
    width: 95%;
    max-width: none;
    margin: 16px;
  }

  .form-row {
    flex-direction: column;
    gap: 12px;
  }

  .form-group.half {
    width: 100%;
  }

  .dialog-footer {
    flex-direction: column-reverse;
    gap: 8px;
  }

  .dialog-footer button {
    width: 100%;
  }

  .key-group-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .select-all-label {
    margin-left: 16px;
  }

  /* 创建活动弹窗移动端适配 */
  .campaign-dialog {
    width: 95%;
    max-height: 85vh;
    margin: 10px auto;
  }

  .campaign-dialog .dialog-body {
    max-height: calc(85vh - 140px);
    overflow-y: auto;
    padding: 16px;
  }

  .campaign-dialog .dialog-header {
    padding: 16px 20px;
  }

  .campaign-dialog .dialog-footer {
    padding: 12px 20px;
    flex-direction: column-reverse;
    gap: 8px;
  }

  .campaign-dialog .dialog-footer button {
    width: 100%;
  }

  .campaign-dialog .form-group {
    margin-bottom: 12px;
  }

  .campaign-dialog .form-row {
    flex-direction: column;
    gap: 12px;
  }

  .campaign-dialog .form-group.half {
    width: 100%;
  }
}

/* 升级密钥管理样式 */
.upgrade-key-type-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.upgrade-key-type-badge.level1 {
  background: #dbeafe;
  color: #1d4ed8;
}

.upgrade-key-type-badge.level2 {
  background: #fce7f3;
  color: #be185d;
}

.upgrade-key-type-badge.custom {
  background: #ede9fe;
  color: #7c3aed;
}

.filter-group {
  display: flex;
  gap: 8px;
}

.filter-group select {
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.filter-group select:focus {
  outline: none;
  border-color: #3b82f6;
}

/* 生成升级密钥对话框样式 */
.key-type-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.key-type-option {
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.key-type-option:hover {
  border-color: #3b82f6;
}

.key-type-option.active {
  border-color: #3b82f6;
  background: #eff6ff;
}

.key-type-option.active.level1 {
  border-color: #3b82f6;
  background: #dbeafe;
}

.key-type-option.active.level2 {
  border-color: #ec4899;
  background: #fce7f3;
}

.option-header {
  margin-bottom: 12px;
}

.option-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.option-badge.level1 {
  background: #3b82f6;
  color: white;
}

.option-badge.level2 {
  background: #ec4899;
  color: white;
}

.option-badge.custom {
  background: #8b5cf6;
  color: white;
}

.key-type-option.active.custom {
  border-color: #8b5cf6;
  background: #ede9fe;
}

/* 自定义密钥配置区域 */
.custom-config-section {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  margin-top: 8px;
}

/* 数字选择器样式 */
.number-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.number-btn {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.number-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.number-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.number-input {
  width: 80px;
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  text-align: center;
}

.number-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.option-benefits {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-benefits .benefit-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #374151;
}

.option-benefits .benefit-item svg {
  color: #10b981;
  flex-shrink: 0;
}

.count-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.count-btn {
  padding: 8px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: white;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.count-btn:hover {
  border-color: #3b82f6;
}

.count-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.count-input {
  width: 80px;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  text-align: center;
}

.count-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.generated-keys-result {
  margin-top: 20px;
  padding: 16px;
  background: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 8px;
}

.generated-keys-result label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #166534;
  margin-bottom: 12px;
}

.keys-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.key-display-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #bbf7d0;
}

.key-display-item code {
  flex: 1;
  font-family: monospace;
  font-size: 13px;
  color: #166534;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.used-mark {
  color: #9ca3af;
}

/* 升级密钥信息样式 */
.upgrade-keys-section {
  margin-bottom: 20px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.upgrade-keys-section .section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.upgrade-keys-section h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.upgrade-keys-empty {
  padding: 16px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
}

.upgrade-keys-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.upgrade-keys-table,
.upgrade-logs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.upgrade-keys-table th,
.upgrade-keys-table td,
.upgrade-logs-table th,
.upgrade-logs-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.upgrade-keys-table th,
.upgrade-logs-table th {
  font-weight: 500;
  color: #64748b;
  background: #f1f5f9;
}

.upgrade-logs-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #cbd5e1;
}

.upgrade-logs-section h5 {
  margin: 0 0 8px 0;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.unbind-upgrade-key-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 12px;
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.unbind-upgrade-key-btn:hover:not(:disabled) {
  background: #fee2e2;
}

.unbind-upgrade-key-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 用户行选中样式 */
.user-main-row.selected {
  background: #eff6ff;
}

/* 修改有效期对话框样式 */
.days-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.days-btn {
  padding: 6px 12px;
  font-size: 13px;
  color: #374151;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.days-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.days-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.days-input {
  width: 80px;
  padding: 6px 10px;
  font-size: 13px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}

.info-display {
  padding: 8px 12px;
  font-size: 14px;
  color: #374151;
  background: #f3f4f6;
  border-radius: 6px;
}

.info-display code {
  font-family: monospace;
  font-size: 13px;
}

/* 升级权益标识 */
.user-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.upgrade-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 500;
  color: #f59e0b;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 4px;
  width: fit-content;
}

.upgrade-badge svg {
  stroke: #f59e0b;
}

/* 不安全删除的行样式 */
.unsafe-delete {
  background: #fef2f2 !important;
}

.unsafe-delete:hover {
  background: #fee2e2 !important;
}

@media (max-width: 640px) {
  .key-type-options {
    grid-template-columns: 1fr;
  }

  .filter-group {
    flex-direction: column;
    width: 100%;
  }

  .filter-group select {
    width: 100%;
  }
}

/* ========== 现代对话框样式 ========== */
.modern-dialog {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 520px;
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  animation: dialogSlideIn 0.3s ease-out;
}

@keyframes dialogSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modern-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px 24px 20px;
  border-bottom: 1px solid #f1f5f9;
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-radius: 12px;
  color: white;
  flex-shrink: 0;
}

.header-text {
  flex: 1;
}

.header-text h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.header-text p {
  margin: 0;
  font-size: 13px;
  color: #64748b;
}

.modern-header .close-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: #f1f5f9;
  color: #64748b;
  transition: all 0.2s;
}

.modern-header .close-btn:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.modern-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.modern-form-group {
  margin-bottom: 0;
}

.modern-form-group.full-width {
  grid-column: 1 / -1;
}

.modern-form-group label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.modern-form-group label svg {
  color: #3b82f6;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.modern-input {
  width: 100%;
  padding: 12px 14px;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  transition: all 0.2s;
  box-sizing: border-box;
  background: #fafafa;
}

.modern-input:focus {
  outline: none;
  border-color: #3b82f6;
  background: white;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.modern-input.readonly {
  background: #f1f5f9;
  color: #64748b;
  cursor: not-allowed;
}

.input-icon {
  position: absolute;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.input-icon.lock-icon {
  color: #94a3b8;
}

.input-icon.key-icon {
  color: #f59e0b;
}

.toggle-password {
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  cursor: pointer;
  color: #64748b;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.toggle-password:hover {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.modern-form-group .form-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #64748b;
  margin-top: 6px;
}

.modern-form-group .form-hint svg {
  color: #94a3b8;
}

.modern-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 24px;
  border-top: 1px solid #f1f5f9;
  background: #fafafa;
}

.modern-btn-secondary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: white;
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.modern-btn-secondary:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #374151;
}

.modern-btn-primary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.modern-btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
}

.modern-btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 响应式适配 */
@media (max-width: 640px) {
  .modern-dialog {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
    margin: 0;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .modern-form-group.full-width {
    grid-column: 1;
  }

  .modern-header {
    padding: 20px;
  }

  .modern-body {
    padding: 20px;
  }

  .modern-footer {
    padding: 16px 20px 20px;
    flex-direction: column-reverse;
  }

  .modern-footer button {
    width: 100%;
    justify-content: center;
  }
}

/* 系统设置样式 */
.settings-section {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.settings-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #e5e7eb;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  font-weight: 500;
  color: #374151;
}

.toggle-label input[type="checkbox"] {
  width: 1.25rem;
  height: 1.25rem;
  cursor: pointer;
}

.toggle-text {
  font-size: 1rem;
}

.form-hint {
  margin: 0.5rem 0 0 2rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.form-actions {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

/* 邮箱黑名单样式 */
.section-desc {
  margin: -1rem 0 1rem 0;
  font-size: 0.875rem;
  color: #6b7280;
}

.blacklist-form {
  margin-bottom: 1.5rem;
}

.blacklist-form .form-row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.blacklist-form .form-group {
  flex: 1;
  margin: 0;
}

.blacklist-form .form-group.flex-2 {
  flex: 2;
}

.blacklist-form input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.blacklist-form input:focus {
  outline: none;
  border-color: #3b82f6;
  ring: 2px solid #bfdbfe;
}

.blacklist-table-wrapper {
  background: #f9fafb;
  border-radius: 0.5rem;
  padding: 1rem;
  min-height: 200px;
}

.blacklist-table {
  width: 100%;
  border-collapse: collapse;
}

.blacklist-table th,
.blacklist-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.blacklist-table th {
  font-weight: 600;
  color: #374151;
  background: #f3f4f6;
}

.blacklist-table tr:last-child td {
  border-bottom: none;
}

.blacklist-table .btn-icon {
  padding: 0.375rem;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.blacklist-table .btn-danger {
  background: #fee2e2;
  color: #dc2626;
}

.blacklist-table .btn-danger:hover {
  background: #fecaca;
}

.blacklist-table-wrapper .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: #9ca3af;
}

.blacklist-table-wrapper .empty-state svg {
  margin-bottom: 1rem;
  opacity: 0.5;
}

.blacklist-table-wrapper .empty-state p {
  font-size: 0.875rem;
}
</style>
