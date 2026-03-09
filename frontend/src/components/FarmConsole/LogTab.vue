<template>
  <div class="log-page">
    <!-- 日志头部 -->
    <div class="log-header">
      <div class="log-title-section">
        <h3 class="log-title">📋 运行日志</h3>
        <label class="auto-scroll-label">
          <input type="checkbox" v-model="autoScroll" class="auto-scroll-checkbox">
          <span>自动滚动</span>
        </label>
      </div>
      <div class="log-actions">
        <button v-if="logs.length > 0" @click="scrollToBottom" class="log-btn log-btn-primary">
          ⬇️ 滚动到底部
        </button>
        <button v-if="logs.length > 0" @click="$emit('clear-logs')" class="log-btn log-btn-danger">
          🗑️ 清空日志
        </button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="log-filters">
      <div class="filter-row">
        <div class="filter-group">
          <label class="filter-label">模块</label>
          <select v-model="logFilter.module" class="filter-select">
            <option value="">全部模块</option>
            <option v-for="(config, key) in moduleConfig" :key="key" :value="key">
              {{ config.icon }} {{ config.label }}
            </option>
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label">级别</label>
          <select v-model="logFilter.level" class="filter-select">
            <option value="">全部级别</option>
            <option v-for="(config, key) in levelConfig" :key="key" :value="key">
              {{ config.label }}
            </option>
          </select>
        </div>
      </div>
      <div class="filter-row">
        <div class="filter-group filter-group-full">
          <label class="filter-label">关键词（空格分词）</label>
          <input 
            v-model="logFilter.keyword" 
            type="text" 
            class="filter-input" 
            placeholder="输入关键词搜索日志..."
          >
        </div>
      </div>
    </div>

    <!-- 日志列表 -->
    <div ref="logContainer" class="log-container">
      <div v-if="filteredLogs.length === 0" class="log-empty">
        <div class="log-empty-icon">📋</div>
        <div class="log-empty-text">{{ logs.length === 0 ? '暂无日志' : '没有匹配的日志' }}</div>
        <div v-if="logs.length > 0 && filteredLogs.length === 0" class="log-empty-hint">请调整筛选条件</div>
      </div>
      <div v-else class="log-list">
        <LogItem
          v-for="(log, index) in filteredLogs"
          :key="`${log.id || log.time || index}_${index}`"
          :time="log.time || (typeof log === 'string' && log.includes(']') ? (log.split(']')[0] || '').replace('[', '') : '')"
          :module="log.module"
          :module-icon="log.module ? getModuleIcon(log.module) : ''"
          :module-label="log.module ? getModuleLabel(log.module) : ''"
          :level="log.level || 'info'"
          :level-label="log.level ? getLevelLabel(log.level) : '信息'"
          :message="log.message || (typeof log === 'string' ? log : '')"
        />
      </div>
    </div>

    <!-- 日志统计 -->
    <div v-if="logs.length > 0" class="log-stats">
      <span class="log-stat">共 {{ logs.length }} 条日志</span>
      <span v-if="filteredLogs.length !== logs.length" class="log-stat">显示 {{ filteredLogs.length }} 条</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import LogItem from '../LogItem.vue';

const props = defineProps<{
  logs: (string | LogEntry)[];
}>();

interface LogEntry {
  id?: string;
  time?: string;
  timestamp?: string;
  module?: string;
  level?: string;
  message?: string;
}

const emit = defineEmits<{
  'clear-logs': [];
}>();

const logContainer = ref<HTMLElement | null>(null);
const autoScroll = ref(false);

// 模块配置
const moduleConfig = {
  farm: { label: '农场', color: '#22c55e', icon: '🌾' },
  friend: { label: '好友', color: '#3b82f6', icon: '👥' },
  shop: { label: '商店', color: '#a855f7', icon: '🛒' },
  warehouse: { label: '仓库', color: '#f59e0b', icon: '📦' },
  system: { label: '系统', color: '#64748b', icon: '⚙️' },
  auth: { label: '登录', color: '#10b981', icon: '🔐' },
  task: { label: '任务', color: '#ec4899', icon: '📋' },
  other: { label: '其他', color: '#6b7280', icon: '📝' }
};

// 级别配置
const levelConfig = {
  debug: { label: '调试', color: '#6b7280' },
  info: { label: '信息', color: '#3b82f6' },
  success: { label: '成功', color: '#22c55e' },
  warning: { label: '警告', color: '#f59e0b' },
  error: { label: '错误', color: '#ef4444' }
};

// 日志筛选状态
const logFilter = ref({
  module: '',
  level: '',
  keyword: ''
});

// 获取模块图标
function getModuleIcon(module: string): string {
  return moduleConfig[module as keyof typeof moduleConfig]?.icon || '📝';
}

// 获取模块标签
function getModuleLabel(module: string): string {
  return moduleConfig[module as keyof typeof moduleConfig]?.label || '其他';
}

// 获取级别标签
function getLevelLabel(level: string): string {
  return levelConfig[level as keyof typeof levelConfig]?.label || '信息';
}

// 解析日志条目
function parseLog(log: any): any {
  if (typeof log === 'object' && log !== null && log.module) {
    return log;
  }
  if (typeof log === 'string') {
    const match = log.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*(.*)$/);
    if (match) {
      const time = match[1];
      let message = match[2] || '';
      let module = 'other';
      let level = 'info';

      const moduleMatch = message.match(/^\[(.+?)\]\s*(.*)$/);
      if (moduleMatch) {
        const moduleTag = moduleMatch[1];
        message = moduleMatch[2] || '';

        switch (moduleTag) {
          case '农场': module = 'farm'; break;
          case '好友': module = 'friend'; break;
          case '商店': module = 'shop'; break;
          case '仓库': module = 'warehouse'; break;
          case '系统': module = 'system'; break;
          case '登录':
          case '认证': module = 'auth'; break;
          case '任务': module = 'task'; break;
          case '错误': module = 'other'; level = 'error'; break;
          case '警告': module = 'other'; level = 'warning'; break;
          case '成功': module = 'other'; level = 'success'; break;
        }
      }

      return { time, message, module, level };
    }
    return { message: log, module: 'other', level: 'info' };
  }
  return { message: String(log), module: 'other', level: 'info' };
}

// 检查日志是否可合并（进行中类型的日志）
function isMergeableLog(log: any): boolean {
  if (log.level !== 'info') return false;
  const msg = (log.message || '').toLowerCase();
  return msg.includes('开始') ||
         msg.includes('正在') ||
         msg.includes('准备') ||
         msg.includes('检查') ||
         msg.includes('获取') ||
         msg.includes('发送') ||
         msg.includes('收到') ||
         msg.includes('解析') ||
         msg.includes('发现') ||
         msg.includes('没有') ||
         msg.includes('共有');
}

// 从好友巡查日志中提取摘要
function extractFriendCheckSummary(logs: any[]): string | null {
  let stealCount = 0;
  let waterCount = 0;
  let weedCount = 0;
  let bugCount = 0;

  for (const log of logs) {
    const msg = log.message || '';
    if (msg.includes('偷取')) stealCount++;
    if (msg.includes('浇水')) waterCount++;
    if (msg.includes('除草')) weedCount++;
    if (msg.includes('除虫')) bugCount++;
  }

  if (stealCount > 0 || waterCount > 0 || weedCount > 0 || bugCount > 0) {
    const parts = [];
    if (stealCount > 0) parts.push(`偷菜${stealCount}次`);
    if (waterCount > 0) parts.push(`浇水${waterCount}次`);
    if (weedCount > 0) parts.push(`除草${weedCount}次`);
    if (bugCount > 0) parts.push(`除虫${bugCount}次`);
    return parts.join('，');
  }
  return null;
}

// 过滤后的日志列表
const filteredLogs = computed(() => {
  let result = props.logs.map((log, index) => {
    const parsed = parseLog(log);
    // 生成唯一ID：使用原始索引 + 时间 + 消息内容的前30个字符 + 随机数
    const logContent = typeof log === 'string' ? log : parsed.message || '';
    const uniqueId = `${index}_${parsed.time || Date.now()}_${logContent.toString().slice(0, 30)}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      ...parsed,
      id: uniqueId
    };
  });

  if (logFilter.value.module) {
    result = result.filter(log => log.module === logFilter.value.module);
  }

  if (logFilter.value.level) {
    result = result.filter(log => log.level === logFilter.value.level);
  }

  if (logFilter.value.keyword.trim()) {
    const keywords = logFilter.value.keyword.trim().toLowerCase().split(/\s+/);
    result = result.filter(log => {
      const message = (log.message || '').toLowerCase();
      return keywords.every(keyword => message.includes(keyword));
    });
  }

  // 合并同一秒内、同一模块的连续"进行中"日志 或 完全重复的日志
  const merged: any[] = [];
  let currentGroup: any[] = [];
  let currentGroupKey = '';
  let lastLogMessage = '';
  let duplicateCount = 0;

  for (let i = 0; i < result.length; i++) {
    const log = result[i];
    const groupKey = `${log.time}_${log.module}`;
    const logMessage = log.message || '';

    // 检查是否为完全重复的日志（同一秒、同一模块、同一消息）
    const isDuplicate = groupKey === currentGroupKey && logMessage === lastLogMessage;

    if ((isMergeableLog(log) || isDuplicate) && groupKey === currentGroupKey) {
      // 继续当前组
      currentGroup.push(log);
      if (isDuplicate) {
        duplicateCount++;
      }
    } else {
      // 结束当前组，尝试提取摘要
      if (currentGroup.length >= 3 || duplicateCount >= 2) {
        // 尝试提取好友巡查摘要
        const summary = extractFriendCheckSummary(currentGroup);
        if (summary) {
          // 保留第一条和最后一条，中间替换为摘要
          merged.push(currentGroup[0]);
          merged.push({
            ...currentGroup[0],
            message: `  ↳ ${summary}`,
            level: 'success'
          });
          merged.push(currentGroup[currentGroup.length - 1]);
        } else if (duplicateCount >= 2) {
          // 重复日志，只保留一条并标记次数
          merged.push({
            ...currentGroup[0],
            message: `${logMessage} (重复 ${currentGroup.length} 次)`,
            level: 'warning'
          });
        } else {
          // 其他情况，保留第一条和最后一条
          merged.push(currentGroup[0]);
          if (currentGroup.length > 1) {
            merged.push({
              ...currentGroup[0],
              message: `  ↳ ...${currentGroup.length - 2} 个步骤`,
              level: 'info'
            });
            merged.push(currentGroup[currentGroup.length - 1]);
          }
        }
      } else if (currentGroup.length > 0) {
        // 组太小，直接添加
        merged.push(...currentGroup);
      }

      // 开始新组
      if (isMergeableLog(log)) {
        currentGroup = [log];
        currentGroupKey = groupKey;
        lastLogMessage = logMessage;
        duplicateCount = 0;
      } else {
        currentGroup = [];
        currentGroupKey = '';
        lastLogMessage = '';
        duplicateCount = 0;
        merged.push(log);
      }
    }
  }

  // 处理最后一组
  if (currentGroup.length >= 3 || duplicateCount >= 2) {
    const summary = extractFriendCheckSummary(currentGroup);
    if (summary) {
      merged.push(currentGroup[0]);
      merged.push({
        ...currentGroup[0],
        message: `  ↳ ${summary}`,
        level: 'success'
      });
      merged.push(currentGroup[currentGroup.length - 1]);
    } else if (duplicateCount >= 2) {
      // 重复日志，只保留一条并标记次数
      merged.push({
        ...currentGroup[0],
        message: `${currentGroup[0].message} (重复 ${currentGroup.length} 次)`,
        level: 'warning'
      });
    } else {
      merged.push(currentGroup[0]);
      merged.push({
        ...currentGroup[0],
        message: `  ↳ ...${currentGroup.length - 2} 个步骤`,
        level: 'info'
      });
      merged.push(currentGroup[currentGroup.length - 1]);
    }
  } else if (currentGroup.length > 0) {
    merged.push(...currentGroup);
  }

  return merged;
});

// 自动滚动
watch(() => props.logs.length, async () => {
  await nextTick();
  if (autoScroll.value && logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight;
  }
});

// 手动滚动到底部
function scrollToBottom() {
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight;
  }
}
</script>

<style scoped>
.log-page {
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 
    0 4px 6px -1px rgba(0, 0, 0, 0.05),
    0 10px 15px -3px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.log-title-section {
  display: flex;
  align-items: center;
  gap: 16px;
}

.log-title {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.auto-scroll-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #64748b;
  transition: color 0.2s;
}

.auto-scroll-label:hover {
  color: #1e293b;
}

.auto-scroll-checkbox {
  cursor: pointer;
  width: 16px;
  height: 16px;
  accent-color: #3b82f6;
}

.log-actions {
  display: flex;
  gap: 8px;
}

.log-btn {
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.log-btn-primary {
  background: #3b82f6;
  color: white;
}

.log-btn-primary:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.log-btn-danger {
  background: #ef4444;
  color: white;
}

.log-btn-danger:hover {
  background: #dc2626;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

.log-filters {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  border: 1px solid #e2e8f0;
}

.filter-row {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.filter-row:last-child {
  margin-bottom: 0;
}

.filter-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-group-full {
  flex: 2;
}

.filter-label {
  font-size: 12px;
  color: #475569;
  font-weight: 500;
}

.filter-select,
.filter-input {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: #1e293b;
  outline: none;
  transition: all 0.2s;
}

.filter-select:focus,
.filter-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.filter-input::placeholder {
  color: #94a3b8;
}

.log-container {
  background: #ffffff;
  border-radius: 12px;
  padding: 16px;
  max-height: 500px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  font-family: 'JetBrains Mono', 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.02);
}

.log-container::-webkit-scrollbar {
  width: 8px;
}

.log-container::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

.log-container::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.log-container::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.log-empty {
  color: #64748b;
  text-align: center;
  padding: 60px 20px;
}

.log-empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.4;
}

.log-empty-text {
  font-size: 16px;
  color: #475569;
  margin-bottom: 8px;
}

.log-empty-hint {
  font-size: 13px;
  color: #94a3b8;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.log-stats {
  display: flex;
  gap: 16px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.log-stat {
  font-size: 12px;
  color: #64748b;
}
</style>
