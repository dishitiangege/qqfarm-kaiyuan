<template>
  <div class="daily-gifts-container">
    <div class="daily-gifts-header">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 12 20 22 4 22 4 12"></polyline>
        <rect x="2" y="7" width="20" height="5"></rect>
        <line x1="12" y1="22" x2="12" y2="7"></line>
        <path d="M12 7L7.5 2.5"></path>
        <path d="M12 7L16.5 2.5"></path>
      </svg>
      <span>每日礼包 & 任务</span>
      <span v-if="dailyGiftsData?.date" class="daily-gifts-date">{{ dailyGiftsData.date }}</span>
      <button
        v-if="accountId"
        class="refresh-btn"
        :disabled="isLoading"
        @click="fetchDailyGifts"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'spin': isLoading }">
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
      </button>
    </div>

    <div v-if="!accountId" class="daily-gifts-empty">
      请选择一个账号查看每日礼包状态
    </div>

    <div v-else-if="isLoading && !hasData" class="daily-gifts-empty">
      加载中...
    </div>

    <div v-else-if="!hasData" class="daily-gifts-empty">
      暂无每日礼包数据，请刷新重试
    </div>

    <div v-else-if="gifts.length === 0" class="daily-gifts-empty">
      暂无每日礼包数据
    </div>

    <div v-else class="daily-gifts-grid">
      <div
        v-for="gift in gifts"
        :key="gift.key"
        class="daily-gift-item"
        :class="{
          'done': gift.doneToday,
          'enabled': gift.enabled && !gift.doneToday,
          'disabled': !gift.enabled
        }"
      >
        <div class="gift-icon" :class="getGiftIconClass(gift)">
          <svg v-if="gift.key === 'email_rewards'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <svg v-else-if="gift.key === 'mall_free_gifts'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
          <svg v-else-if="gift.key === 'daily_share'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
          <svg v-else-if="gift.key === 'vip_daily_gift'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
          <svg v-else-if="gift.key === 'month_card_gift'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <svg v-else-if="gift.key === 'open_server_red_packet'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 12 20 22 4 22 4 12"></polyline>
            <rect x="2" y="7" width="20" height="5"></rect>
            <line x1="12" y1="22" x2="12" y2="7"></line>
          </svg>
        </div>

        <div class="gift-info">
          <div class="gift-name">{{ gift.label }}</div>
          <div class="gift-status" :class="getStatusClass(gift)">
            {{ getStatusText(gift) }}
          </div>
          <div v-if="gift.lastAt && gift.lastAt > 0" class="gift-time">
            {{ formatTime(gift.lastAt) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useUserStore } from '../stores/user';

interface Gift {
  key: string;
  label: string;
  enabled: boolean;
  doneToday: boolean;
  lastAt: number;
  hasGift?: boolean;
  canClaim?: boolean;
  hasCard?: boolean;
  hasClaimable?: boolean;
  hasRedPacket?: boolean;
}

interface DailyGiftsData {
  date: string;
  gifts: Gift[];
}

const props = defineProps<{
  accountId?: string;
  dailyGifts?: DailyGiftsData | null;
}>();

const userStore = useUserStore();
const dailyGiftsData = ref<DailyGiftsData | null>(null);
const isLoading = ref(false);

// 优先使用传入的 dailyGifts，否则使用自己获取的数据
const effectiveDailyGifts = computed(() => props.dailyGifts || dailyGiftsData.value);
const hasData = computed(() => !!effectiveDailyGifts.value);
const gifts = computed(() => effectiveDailyGifts.value?.gifts || []);

// 获取每日礼包数据
async function fetchDailyGifts() {
  if (!props.accountId) return;

  isLoading.value = true;
  try {
    const response = await fetch(`/api/accounts/${props.accountId}/daily-gifts`, {
      headers: {
        'Authorization': `Bearer ${userStore.token}`
      }
    });

    if (!response.ok) {
      throw new Error('获取每日礼包数据失败');
    }

    const result = await response.json();
    if (result.success && result.data) {
      dailyGiftsData.value = result.data;
    }
  } catch (error) {
    console.error('获取每日礼包数据失败:', error);
  } finally {
    isLoading.value = false;
  }
}

// 监听账号ID变化，自动获取数据
watch(() => props.accountId, (newId) => {
  if (newId && !props.dailyGifts) {
    fetchDailyGifts();
  }
}, { immediate: true });

onMounted(() => {
  if (props.accountId && !props.dailyGifts) {
    fetchDailyGifts();
  }
});

function getGiftIconClass(gift: Gift): string {
  if (gift.doneToday) return 'done';
  if (!gift.enabled) return 'disabled';
  return 'pending';
}

function getStatusClass(gift: Gift): string {
  if (gift.doneToday) return 'done';
  if (!gift.enabled) return 'disabled';
  if (gift.key === 'vip_daily_gift' && gift.hasGift === false) return 'disabled';
  if (gift.key === 'month_card_gift' && gift.hasCard === false) return 'disabled';
  if (gift.key === 'open_server_red_packet' && gift.hasRedPacket === false) return 'disabled';
  return 'pending';
}

function getStatusText(gift: Gift): string {
  if (gift.doneToday) return '今日已完成';
  if (!gift.enabled) return '未开启';
  if (gift.key === 'vip_daily_gift' && gift.hasGift === false) return '未开通会员';
  if (gift.key === 'month_card_gift' && gift.hasCard === false) return '未购买月卡';
  if (gift.key === 'open_server_red_packet' && gift.hasRedPacket === false) return '无开服活动';
  return '等待执行';
}

function formatTime(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
</script>

<style scoped>
.daily-gifts-container {
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  margin-top: 20px;
}

.daily-gifts-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.daily-gifts-header svg {
  color: #ec4899;
}

.daily-gifts-date {
  margin-left: auto;
  font-size: 12px;
  color: #94a3b8;
  font-weight: 400;
}

.refresh-btn {
  margin-left: 8px;
  padding: 4px;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: #f1f5f9;
  color: #3b82f6;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.refresh-btn svg.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.daily-gifts-empty {
  text-align: center;
  padding: 40px;
  color: #94a3b8;
  font-size: 14px;
}

.daily-gifts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.daily-gift-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 12px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  transition: all 0.2s ease;
}

.daily-gift-item.done {
  background: #dcfce7;
  border-color: #86efac;
}

.daily-gift-item.enabled {
  background: #dbeafe;
  border-color: #93c5fd;
}

.daily-gift-item.disabled {
  background: #f1f5f9;
  border-color: #e2e8f0;
  opacity: 0.7;
}

.gift-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.gift-icon.done {
  background: #22c55e;
  color: white;
}

.gift-icon.pending {
  background: #3b82f6;
  color: white;
}

.gift-icon.disabled {
  background: #cbd5e1;
  color: #64748b;
}

.gift-info {
  text-align: center;
}

.gift-name {
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
  margin-bottom: 4px;
}

.gift-status {
  font-size: 11px;
  font-weight: 500;
}

.gift-status.done {
  color: #22c55e;
}

.gift-status.pending {
  color: #3b82f6;
}

.gift-status.disabled {
  color: #94a3b8;
}

.gift-time {
  font-size: 10px;
  color: #94a3b8;
  margin-top: 2px;
}

@media (max-width: 768px) {
  .daily-gifts-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  
  .daily-gift-item {
    padding: 12px 8px;
  }
  
  .gift-name {
    font-size: 12px;
  }
  
  .gift-status {
    font-size: 10px;
  }
}
</style>
