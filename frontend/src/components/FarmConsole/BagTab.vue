<template>
  <div style="background: white; border-radius: 16px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h3 style="font-size: 18px; font-weight: 600; color: #1e293b; margin: 0;">背包仓库</h3>
      <div style="display: flex; align-items: center; gap: 12px;">
        <span v-if="bagList.length > 0" style="font-size: 14px; color: #64748b;">共 {{ bagList.length }} 种物品</span>
        <span v-if="fruitCount > 0" style="font-size: 14px; color: #22c55e; font-weight: 500;">{{ fruitCount }} 个果实可出售</span>
        <!-- 选择模式切换按钮 -->
        <button
          v-if="fruitItems.length > 0 && !selectMode"
          @click="selectMode = true"
          style="
            padding: 8px 16px;
            background: #f0fdf4;
            color: #16a34a;
            border: 1px solid #86efac;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
          "
        >
          选择售卖
        </button>
        <!-- 退出选择模式按钮 -->
        <button
          v-if="selectMode"
          @click="cancelSelect"
          style="
            padding: 8px 16px;
            background: #f1f5f9;
            color: #64748b;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
          "
        >
          取消
        </button>
        <!-- 售卖选中按钮 -->
        <button
          v-if="selectMode && selectedFruits.size > 0"
          @click="handleSellSelectedFruits"
          :disabled="sellingFruits"
          style="
            padding: 8px 16px;
            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 6px;
          "
          :style="sellingFruits ? 'opacity: 0.6; cursor: not-allowed;' : ''"
        >
          <svg v-if="!sellingFruits" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;">
            <line x1="12" y1="2" x2="12" y2="6"></line>
            <line x1="12" y1="18" x2="12" y2="22"></line>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
            <line x1="2" y1="12" x2="6" y2="12"></line>
            <line x1="18" y1="12" x2="22" y2="12"></line>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
          </svg>
          {{ sellingFruits ? '售卖中...' : `售卖选中 (${selectedFruits.size})` }}
        </button>
        <!-- 全选按钮 -->
        <button
          v-if="selectMode"
          @click="toggleSelectAll"
          style="
            padding: 8px 16px;
            background: #eff6ff;
            color: #3b82f6;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
          "
        >
          {{ isAllSelected ? '取消全选' : '全选' }}
        </button>
      </div>
    </div>
    
    <!-- 选择模式提示 -->
    <div v-if="selectMode" style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
      <span style="font-size: 14px; color: #166534;">点击果实进行选择，选中后点击"售卖选中"按钮</span>
    </div>

    <div v-if="bagList.length === 0" style="text-align: center; padding: 60px; color: #94a3b8;">
      <div style="width: 80px; height: 80px; margin: 0 auto 20px; color: #cbd5e1;">
        <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      </div>
      <p style="font-size: 14px; margin: 0;">背包为空</p>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 8px;">等待数据同步...</p>
    </div>

    <!-- 特殊物品分组 -->
    <div v-if="specialItems.length > 0" style="margin-bottom: 24px;">
      <h4 style="font-size: 14px; font-weight: 600; color: #64748b; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0;">特殊物品</h4>
      <div class="bag-grid">
        <BagItemCard
          v-for="item in specialItems"
          :key="item.id"
          :name="getItemDisplayName(item.id, item.count)"
          :count="item.count"
          :icon="getItemIcon(item.id)"
          :emoji="getItemIconEmoji(item.id)"
          :time-info="getContainerTimeInfo(item.id, item.count)"
          variant="special"
          @image-error="handleImageError"
        />
      </div>
    </div>

    <!-- 种子分组 -->
    <div v-if="seedItems.length > 0" style="margin-bottom: 24px;">
      <h4 style="font-size: 14px; font-weight: 600; color: #64748b; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0;">种子</h4>
      <div class="bag-grid">
        <BagItemCard
          v-for="item in seedItems"
          :key="item.id"
          :name="getItemDisplayName(item.id, item.count)"
          :count="item.count"
          :icon="getItemIcon(item.id)"
          :emoji="getItemIconEmoji(item.id)"
          variant="other"
          @image-error="handleImageError"
        />
      </div>
    </div>

    <!-- 作物分组 -->
    <div v-if="fruitItems.length > 0">
      <h4 style="font-size: 14px; font-weight: 600; color: #64748b; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0;">作物果实</h4>
      <div class="bag-grid">
        <BagItemCard
          v-for="item in fruitItems"
          :key="item.uid || item.id"
          :name="getItemDisplayName(item.id, item.count)"
          :count="item.count"
          :icon="getItemIcon(item.id)"
          :emoji="getItemIconEmoji(item.id)"
          :selected="selectedFruits.has(item.uid || item.id)"
          :selectable="selectMode"
          :show-sellable="!selectMode"
          variant="fruit"
          @click="selectMode && toggleSelect(item)"
          @image-error="handleImageError"
        />
      </div>
    </div>

    <!-- 其他物品分组 -->
    <div v-if="otherItems.length > 0" style="margin-top: 24px;">
      <h4 style="font-size: 14px; font-weight: 600; color: #64748b; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0;">其他物品</h4>
      <div class="bag-grid">
        <BagItemCard
          v-for="item in otherItems"
          :key="item.id"
          :name="getItemDisplayName(item.id, item.count)"
          :count="item.count"
          :icon="getItemIcon(item.id)"
          :emoji="getItemIconEmoji(item.id)"
          variant="other"
          @image-error="handleImageError"
        />
      </div>
    </div>

    <!-- 背包统计 -->
    <div v-if="bagList.length > 0" style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
        <div style="text-align: center; padding: 16px; background: #f8fafc; border-radius: 12px;">
          <div style="font-size: 24px; font-weight: 600; color: #3b82f6;">{{ bagList.length }}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">物品种类</div>
        </div>
        <div style="text-align: center; padding: 16px; background: #f0fdf4; border-radius: 12px;">
          <div style="font-size: 24px; font-weight: 600; color: #22c55e;">{{ fruitCount }}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">果实数量</div>
        </div>
        <div style="text-align: center; padding: 16px; background: #fef3c7; border-radius: 12px;">
          <div style="font-size: 24px; font-weight: 600; color: #d97706;">{{ totalItemCount }}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">总数量</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import axios from 'axios';
import BagItemCard from '../BagItemCard.vue';
import { getItemIcon, getItemIconEmoji, getItemDisplayName, getItemCategory, getContainerTimeInfo } from '../../services/itemService';

const API_BASE_URL = '/api';

interface BagItem {
  id: number;
  count: number;
  name?: string;
  uid?: number;
}

interface Account {
  id: string;
  stats: {
    bag?: BagItem[];
  };
}

const props = defineProps<{
  account: Account;
}>();

const selectMode = ref(false);
const selectedFruits = ref<Set<number>>(new Set());
const sellingFruits = ref(false);

// 获取物品完整分类（包括种子）
function getFullItemCategory(itemId: number): string {
  // 特殊物品
  if (getItemCategory(itemId) === 'special') {
    return 'special';
  }
  // 种子
  if (itemId >= 2001 && itemId <= 2999) {
    return 'seed';
  }
  // 果实
  if (getItemCategory(itemId) === 'fruit') {
    return 'fruit';
  }
  // 其他
  return 'other';
}

// 背包列表
const bagList = computed(() => {
  const items = props.account.stats?.bag || [];
  return [...items].sort((a, b) => {
    const categoryA = getFullItemCategory(Number(a.id));
    const categoryB = getFullItemCategory(Number(b.id));
    const orderDiff = getCategoryOrder(categoryA) - getCategoryOrder(categoryB);
    if (orderDiff !== 0) return orderDiff;
    return Number(a.id) - Number(b.id);
  });
});

// 特殊物品
const specialItems = computed(() => {
  return bagList.value.filter(item => getItemCategory(Number(item.id)) === 'special');
});

// 种子物品
const seedItems = computed(() => {
  return bagList.value.filter(item => {
    const id = Number(item.id);
    return id >= 2001 && id <= 2999;
  });
});

// 果实物品
const fruitItems = computed(() => {
  return bagList.value.filter(item => getItemCategory(Number(item.id)) === 'fruit');
});

// 其他物品
const otherItems = computed(() => {
  return bagList.value.filter(item => {
    const id = Number(item.id);
    const category = getItemCategory(id);
    // 排除特殊物品、种子和果实
    return category !== 'special' && category !== 'fruit' && !(id >= 2001 && id <= 2999);
  });
});

// 果实数量
const fruitCount = computed(() => {
  return fruitItems.value.reduce((sum, item) => sum + (item.count || 0), 0);
});

// 总物品数量
const totalItemCount = computed(() => {
  return bagList.value.reduce((sum, item) => sum + (item.count || 0), 0);
});

// 是否全选
const isAllSelected = computed(() => {
  return fruitItems.value.length > 0 && fruitItems.value.every(item => selectedFruits.value.has(item.uid || item.id));
});

// 获取分类排序
function getCategoryOrder(category: string): number {
  const orders: Record<string, number> = {
    'special': 1,
    'seed': 2,
    'fruit': 3,
    'other': 4
  };
  return orders[category] || 99;
}

// 切换选择
function toggleSelect(item: BagItem) {
  const uid = item.uid || item.id;
  if (selectedFruits.value.has(uid)) {
    selectedFruits.value.delete(uid);
  } else {
    selectedFruits.value.add(uid);
  }
}

// 取消选择
function cancelSelect() {
  selectMode.value = false;
  selectedFruits.value.clear();
}

// 全选/取消全选
function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedFruits.value.clear();
  } else {
    fruitItems.value.forEach(item => {
      selectedFruits.value.add(item.uid || item.id);
    });
  }
}

// 售卖选中果实
async function handleSellSelectedFruits() {
  if (sellingFruits.value || selectedFruits.value.size === 0) return;
  
  // 计算选中的总数量
  const selectedItems = fruitItems.value.filter(item => selectedFruits.value.has(item.uid || item.id));
  const totalCount = selectedItems.reduce((sum, item) => sum + (item.count || 0), 0);
  
  sellingFruits.value = true;
  try {
    const response = await axios.post(`${API_BASE_URL}/accounts/${props.account.id}/sell-fruits`, {
      uids: Array.from(selectedFruits.value)
    });
    
    if (response.data.success) {
      alert(`成功售卖 ${totalCount} 个果实！`);
      selectedFruits.value.clear();
      selectMode.value = false;
    } else {
      alert(response.data.message || '售卖失败');
    }
  } catch (error: any) {
    alert(error.response?.data?.message || '售卖失败，请检查账号是否正在运行');
  } finally {
    sellingFruits.value = false;
  }
}

// 处理图片加载错误
function handleImageError(event?: Event) {
  if (!event) return;
  const img = event.target as HTMLImageElement;
  if (img) {
    img.style.display = 'none';
  }
}
</script>

<style scoped>
.bag-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 16px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .bag-grid {
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 12px;
  }
}

@media (max-width: 640px) {
  .bag-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 10px;
  }
}

@media (max-width: 480px) {
  .bag-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
}

@media (max-width: 360px) {
  .bag-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
}
</style>
