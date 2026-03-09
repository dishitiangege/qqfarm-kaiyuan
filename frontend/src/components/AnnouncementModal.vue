<template>
  <div v-if="visibleAnnouncement" class="announcement-overlay" @click.self="closeAnnouncement">
    <div class="announcement-card">
      <!-- 头部 -->
      <div class="announcement-header">
        <h3 class="announcement-title">{{ visibleAnnouncement.title }}</h3>
        <button class="close-btn" @click="closeAnnouncement">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- 内容区 -->
      <div class="announcement-body">
        <div class="announcement-content">{{ visibleAnnouncement.content }}</div>
        <div class="announcement-meta">
          <span class="announcement-time">{{ formatDate(visibleAnnouncement.created_at) }}</span>
          <span class="announcement-interval">每 {{ visibleAnnouncement.interval_hours }} 小时提醒</span>
        </div>
      </div>

      <!-- 底部 -->
      <div class="announcement-footer">
        <button class="btn-confirm" @click="markAsRead">
          <span>我知道了</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';

interface Announcement {
  id: number;
  title: string;
  content: string;
  interval_hours: number;
  created_at: string;
}

interface AnnouncementReadRecord {
  announcementId: number;
  readAt: string;
}

const visibleAnnouncement = ref<Announcement | null>(null);
const STORAGE_KEY = 'farm_bot_announcement_reads';

// 从 localStorage 获取阅读记录
function getReadRecords(): AnnouncementReadRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// 保存阅读记录到 localStorage
function saveReadRecord(record: AnnouncementReadRecord) {
  try {
    const records = getReadRecords();
    // 移除同一公告的旧记录
    const filtered = records.filter(r => r.announcementId !== record.announcementId);
    filtered.push(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('保存阅读记录失败:', error);
  }
}

// 检查公告是否需要显示
function shouldShowAnnouncement(announcement: Announcement): boolean {
  const records = getReadRecords();
  const record = records.find(r => r.announcementId === announcement.id);

  if (!record) {
    // 从未阅读过，需要显示
    return true;
  }

  const readAt = new Date(record.readAt);
  const now = new Date();
  const hoursDiff = (now.getTime() - readAt.getTime()) / (1000 * 60 * 60);

  // 超过间隔时间，需要再次显示
  return hoursDiff >= announcement.interval_hours;
}

// 检查是否有需要显示的公告
async function checkAnnouncements() {
  try {
    const response = await axios.get('/api/announcements/active');
    const announcements: Announcement[] = response.data.announcements || [];

    // 找到第一个需要显示的公告
    const announcementToShow = announcements.find(shouldShowAnnouncement);

    if (announcementToShow) {
      visibleAnnouncement.value = announcementToShow;
    }
  } catch (error) {
    console.error('检查公告失败:', error);
  }
}

// 关闭公告
function closeAnnouncement() {
  visibleAnnouncement.value = null;
}

// 标记为已读
function markAsRead() {
  if (!visibleAnnouncement.value) return;

  // 保存到 localStorage
  saveReadRecord({
    announcementId: visibleAnnouncement.value.id,
    readAt: new Date().toISOString()
  });

  visibleAnnouncement.value = null;
}

// 格式化日期
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 组件挂载时检查公告
onMounted(() => {
  // 延迟一点再检查，避免页面加载时立即弹出
  setTimeout(() => {
    checkAnnouncements();
  }, 1000);
});
</script>

<style scoped>
.announcement-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
  backdrop-filter: blur(5px);
}

.announcement-card {
  position: relative;
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 24px;
  overflow: hidden;
  animation: slideIn 0.4s ease;
  box-shadow: rgba(102, 126, 234, 0.3) 0px 20px 60px -10px, rgba(0, 0, 0, 0.2) 0px 10px 30px -5px;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-30px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 头部 */
.announcement-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 28px 16px;
}

.announcement-title {
  flex: 1;
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

/* 内容区 */
.announcement-body {
  padding: 0 28px 20px;
  overflow-y: auto;
  max-height: 45vh;
}

.announcement-content {
  font-size: 15px;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.95);
  white-space: pre-wrap;
  word-break: break-word;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.announcement-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.announcement-time {
  display: flex;
  align-items: center;
  gap: 4px;
}

.announcement-interval {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  backdrop-filter: blur(5px);
}

/* 底部 */
.announcement-footer {
  padding: 16px 28px 24px;
  display: flex;
  justify-content: flex-end;
}

.btn-confirm {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  border: none;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  color: #667eea;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.btn-confirm:hover {
  transform: scale(1.05);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
  background: white;
}

.btn-confirm svg {
  transition: transform 0.3s;
}

.btn-confirm:hover svg {
  transform: translateX(3px);
}

/* 移动端适配 */
@media (max-width: 480px) {
  .announcement-overlay {
    padding: 16px;
  }

  .announcement-card {
    max-height: 85vh;
  }

  .announcement-header {
    padding: 20px 20px 12px;
  }

  .announcement-title {
    font-size: 17px;
  }

  .announcement-body {
    padding: 0 20px 16px;
  }

  .announcement-content {
    font-size: 14px;
  }

  .announcement-footer {
    padding: 12px 20px 20px;
  }

  .btn-confirm {
    width: 100%;
    justify-content: center;
    padding: 14px;
  }
}
</style>
