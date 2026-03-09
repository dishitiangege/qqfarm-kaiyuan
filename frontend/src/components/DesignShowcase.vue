<template>
  <div class="showcase-container">
    <h2 class="showcase-title">New Sample 设计元素展示</h2>
    
    <div class="showcase-grid">
      <!-- 霓虹复选框展示 -->
      <div class="showcase-item">
        <h3>霓虹复选框 (NeonCheckbox)</h3>
        <div class="demo-area">
          <NeonCheckbox v-model="checkbox1" label="自动种植/收获" />
          <NeonCheckbox v-model="checkbox2" label="自动施肥" />
          <NeonCheckbox v-model="checkbox3" label="自动卖果实" />
        </div>
        <p class="description">来自 2.html - 发光效果、粒子爆炸动画、边框流动</p>
      </div>

      <!-- 音量滑块展示 -->
      <div class="showcase-item">
        <h3>音量滑块 (VolumeSlider)</h3>
        <div class="demo-area">
          <VolumeSlider 
            v-model="sliderValue" 
            :min="1" 
            :max="60" 
            :step="1"
            label="巡查时间间隔"
            unit="分钟"
            hint="设置好友巡查的时间间隔"
          />
        </div>
        <p class="description">来自 8.html - 渐变填充、图标联动</p>
      </div>

      <!-- 3D卡片展示 -->
      <div class="showcase-item wide">
        <h3>3D悬浮卡片 (Card3D)</h3>
        <div class="demo-area cards">
          <Card3D 
            title="等级统计" 
            description="当前等级和经验进度"
            :show-more="true"
            more-text="查看详情"
          >
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
              </svg>
            </template>
          </Card3D>
          <Card3D 
            title="金币统计" 
            description="当前金币和今日收入"
            :show-more="true"
            more-text="查看详情"
          >
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </template>
          </Card3D>
        </div>
        <p class="description">来自 4.html - 玻璃拟态、多层圆环、hover 3D倾斜</p>
      </div>

      <!-- SVG加载动画展示 -->
      <div class="showcase-item">
        <h3>SVG加载动画 (SVGLoader)</h3>
        <div class="demo-area center">
          <SVGLoader :size="64" />
        </div>
        <p class="description">来自 9.html - 渐变色、路径动画、旋转效果</p>
      </div>
    </div>

    <div class="usage-guide">
      <h3>使用说明</h3>
      <div class="guide-content">
        <h4>1. 霓虹复选框</h4>
        <pre><code>&lt;NeonCheckbox v-model="checked" label="选项文字" /&gt;</code></pre>

        <h4>2. 音量滑块</h4>
        <pre><code>&lt;VolumeSlider 
  v-model="value" 
  :min="1" 
  :max="60" 
  label="时间间隔"
  unit="分钟"
  hint="提示文字"
/&gt;</code></pre>

        <h4>3. 3D悬浮卡片</h4>
        <pre><code>&lt;Card3D 
  title="卡片标题" 
  description="卡片描述"
  :show-more="true"
  more-text="查看更多"
&gt;
  &lt;template #icon&gt;...&lt;/template&gt;
&lt;/Card3D&gt;</code></pre>

        <h4>4. SVG加载动画</h4>
        <pre><code>&lt;SVGLoader :size="64" /&gt;</code></pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import NeonCheckbox from './NeonCheckbox.vue';
import VolumeSlider from './VolumeSlider.vue';
import Card3D from './Card3D.vue';
import SVGLoader from './SVGLoader.vue';

const checkbox1 = ref(true);
const checkbox2 = ref(false);
const checkbox3 = ref(true);
const sliderValue = ref(30);
</script>

<style scoped>
.showcase-container {
  padding: 40px;
  max-width: 1200px;
  margin: 0 auto;
}

.showcase-title {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 32px;
  text-align: center;
}

.showcase-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.showcase-item {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.showcase-item.wide {
  grid-column: span 2;
}

.showcase-item h3 {
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.demo-area {
  padding: 20px;
  background: #f9fafb;
  border-radius: 12px;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.demo-area.cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.demo-area.center {
  align-items: center;
  justify-content: center;
}

.description {
  font-size: 13px;
  color: #6b7280;
  margin-top: 12px;
  font-style: italic;
}

.usage-guide {
  margin-top: 40px;
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.usage-guide h3 {
  font-size: 18px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 20px;
}

.guide-content h4 {
  font-size: 14px;
  font-weight: 600;
  color: #22c55e;
  margin: 20px 0 12px 0;
}

.guide-content pre {
  background: #1e293b;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
}

.guide-content code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 13px;
  color: #e2e8f0;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .showcase-grid {
    grid-template-columns: 1fr;
  }
  
  .showcase-item.wide {
    grid-column: span 1;
  }
  
  .demo-area.cards {
    grid-template-columns: 1fr;
  }
}
</style>
