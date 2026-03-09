<template>
  <GlassCard
    title="配置中心"
    icon="⚙️"
    :hover="true"
  >
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <!-- 农场操作区域 -->
      <CollapsibleSection
        title="农场操作"
        subtitle="自动种植、收获、维护"
        icon="🌱"
        storageKey="farm_operations"
        :defaultExpanded="true"
      >
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <!-- 自动种植/收获 -->
          <ConfigCard title="自动种植/收获">
            <template #action>
              <NeonCheckbox v-model="localConfig.autoFarm" />
            </template>
          </ConfigCard>

          <!-- 随机种植时间间隔 -->
          <ConfigCard title="随机种植时间间隔" subtitle="每块地种植后的随机延迟">
            <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 120px;">
                  <span style="font-size: 12px; color: #64748b; white-space: nowrap;">最小</span>
                  <input
                    type="number"
                    v-model.number="localConfig.plantIntervalMin"
                    :min="100"
                    :max="20000"
                    placeholder="100"
                    style="
                      flex: 1;
                      min-width: 60px;
                      padding: 8px 12px;
                      border: 1px solid #e2e8f0;
                      border-radius: 8px;
                      font-size: 14px;
                      text-align: center;
                      background: #f8fafc;
                    "
                  >
                  <span style="font-size: 12px; color: #64748b; white-space: nowrap;">ms</span>
                </div>
                <span style="color: #cbd5e1;">~</span>
                <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 120px;">
                  <span style="font-size: 12px; color: #64748b; white-space: nowrap;">最大</span>
                  <input
                    type="number"
                    v-model.number="localConfig.plantIntervalMax"
                    :min="100"
                    :max="20000"
                    placeholder="1000"
                    style="
                      flex: 1;
                      min-width: 60px;
                      padding: 8px 12px;
                      border: 1px solid #e2e8f0;
                      border-radius: 8px;
                      font-size: 14px;
                      text-align: center;
                      background: #f8fafc;
                    "
                  >
                  <span style="font-size: 12px; color: #64748b; white-space: nowrap;">ms</span>
                </div>
              </div>
              <div style="font-size: 11px; color: #94a3b8; line-height: 1.5;">
                范围: 100ms ~ 20000ms，默认 100~1000ms，每种植一块地后会随机延迟指定时间再种下一块
              </div>
            </div>
          </ConfigCard>

          <!-- 自动解锁土地 -->
          <ConfigCard title="自动解锁土地" subtitle="自动解锁新的土地">
            <template #action>
              <NeonCheckbox v-model="localConfig.autoUnlockLand" />
            </template>
          </ConfigCard>

          <!-- 自动升级土地 -->
          <ConfigCard title="自动升级土地" subtitle="自动升级土地等级">
            <template #action>
              <NeonCheckbox v-model="localConfig.autoUpgradeLand" />
            </template>
          </ConfigCard>

          <!-- 自动卖果实 -->
          <ConfigCard title="自动卖果实" subtitle="开启后 10 秒首次售卖，之后每 30 分钟一次；失败时 60 秒后重试">
            <template #action>
              <NeonCheckbox v-model="localConfig.autoSell" />
            </template>
          </ConfigCard>

          <!-- 自动施肥 -->
          <ConfigCard title="自动施肥">
            <template #action>
              <NeonCheckbox v-model="localConfig.autoFertilize" />
            </template>
          </ConfigCard>

          <!-- 自动除草 -->
          <ConfigCard title="自动除草" subtitle="自动清理自己农场的杂草">
            <template #action>
              <NeonCheckbox v-model="localConfig.autoWeed" />
            </template>
          </ConfigCard>

          <!-- 自动除虫 -->
          <ConfigCard title="自动除虫" subtitle="自动清理自己农场的害虫">
            <template #action>
              <NeonCheckbox v-model="localConfig.autoBug" />
            </template>
          </ConfigCard>

          <!-- 自动浇水 -->
          <ConfigCard title="自动浇水" subtitle="自动给自己农场的作物浇水">
            <template #action>
              <NeonCheckbox v-model="localConfig.autoWater" />
            </template>
          </ConfigCard>
        </div>
      </CollapsibleSection>

      <!-- 奖励领取区域 -->
      <CollapsibleSection
        title="奖励领取"
        subtitle="自动领取各类奖励"
        icon="🎁"
        storageKey="rewards"
        :defaultExpanded="false"
      >
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <!-- 自动做任务 -->
          <ConfigCard title="自动做任务">
            <template #action>
              <NeonCheckbox v-model="localConfig.autoTask" />
            </template>
          </ConfigCard>

          <!-- 自动领取邮件奖励 -->
          <ConfigCard title="自动领取邮件奖励" subtitle="自动领取邮件中的奖励">
            <template #action>
              <NeonCheckbox v-model="localConfig.autoClaimEmail" />
            </template>
          </ConfigCard>

          <!-- 自动领取图鉴奖励 -->
          <ConfigCard title="自动领取图鉴奖励" subtitle="自动领取图鉴完成奖励">
            <template #action>
              <NeonCheckbox v-model="localConfig.autoClaimIllustrated" />
            </template>
          </ConfigCard>

          <!-- 自动领取免费礼包 -->
          <ConfigCard title="自动领取免费礼包" subtitle="每小时自动领取免费礼包">
            <template #action>
              <NeonCheckbox v-model="localConfig.autoClaimFreeGifts" />
            </template>
          </ConfigCard>

          <!-- 自动领取会员礼包 -->
          <ConfigCard title="自动领取会员礼包" subtitle="QQ会员每日礼包">
            <template #action>
              <NeonCheckbox v-model="localConfig.autoClaimVip" />
            </template>
          </ConfigCard>

          <!-- 自动完成分享任务 -->
          <ConfigCard title="自动完成分享任务" subtitle="每日分享任务">
            <template #action>
              <NeonCheckbox v-model="localConfig.autoShare" />
            </template>
          </ConfigCard>

          <!-- 自动领取月卡礼包 -->
          <ConfigCard title="自动领取月卡礼包" subtitle="月卡每日奖励">
            <template #action>
              <NeonCheckbox v-model="localConfig.autoClaimMonthCard" />
            </template>
          </ConfigCard>

          <!-- 自动领取开服红包 -->
          <ConfigCard title="自动领取开服红包" subtitle="开服活动红包">
            <template #action>
              <NeonCheckbox v-model="localConfig.autoClaimOpenServer" />
            </template>
          </ConfigCard>
        </div>
      </CollapsibleSection>

      <!-- 好友互动区域 -->
      <CollapsibleSection
        title="好友互动"
        subtitle="偷菜、帮助、白名单设置"
        icon="👥"
        storageKey="friend_interaction"
        :defaultExpanded="false"
      >
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <!-- 好友功能总开关 -->
          <ConfigCard title="好友巡查" subtitle="开启后可使用好友互动功能">
            <template #action>
              <NeonCheckbox v-model="localConfig.enableFriendCheck" />
            </template>
          </ConfigCard>

          <!-- 提示：好友巡查关闭时 -->
          <div v-if="!localConfig.enableFriendCheck" style="padding: 12px 16px; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
            <div style="display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 13px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <span>开启「好友巡查」后可使用好友互动功能（偷菜、浇水、除草等）</span>
            </div>
          </div>

          <!-- 使用固定好友列表 -->
          <ConfigCard title="使用固定好友列表" subtitle="关闭巡查，直接按指定ID偷取">
            <template #action>
              <NeonCheckbox v-model="localConfig.useFixedFriendList" />
            </template>
          </ConfigCard>

          <!-- 固定好友ID列表输入 -->
          <div v-if="localConfig.useFixedFriendList" style="padding: 16px 20px; background: #fef3c7; border-radius: 12px; border: 1px solid #fcd34d;">
            <div style="font-size: 14px; font-weight: 500; color: #92400e; margin-bottom: 8px;">固定好友ID列表</div>
            <div style="font-size: 12px; color: #a16207; margin-bottom: 12px;">填入好友GID，多个用逗号分隔，程序将直接按此列表轮流偷取，不再获取好友列表</div>
            <input 
              type="text" 
              v-model="fixedFriendIdsInput"
              @blur="updateFixedFriendIds"
              placeholder="例如: 123456, 789012, 345678"
              style="width: 100%; padding: 10px 12px; border: 1px solid #fcd34d; border-radius: 8px; font-size: 13px; background: white; box-sizing: border-box;"
            >
            <div style="font-size: 11px; color: #b45309; margin-top: 8px; background: #fffbeb; padding: 8px 12px; border-radius: 6px; border: 1px dashed #fbbf24;">
              <strong>💡 提示：</strong>开启此功能后，程序将跳过获取好友列表的步骤，直接按您输入的ID顺序访问好友农场。适合只想偷取特定好友的情况。
            </div>
          </div>

          <!-- 好友互动功能开关组 -->
          <div v-if="localConfig.enableFriendCheck" style="padding: 20px; background: #f0f9ff; border-radius: 16px; border: 1px solid #bae6fd;">
            <div style="font-size: 14px; font-weight: 600; color: #0369a1; margin-bottom: 16px;">好友互动功能</div>
            
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <!-- 偷菜 -->
              <ConfigCard title="偷菜" subtitle="推荐功能">
                <template #action>
                  <NeonCheckbox v-model="localConfig.enableSteal" />
                </template>
              </ConfigCard>

              <!-- 跳过白萝卜 -->
              <ConfigCard title="跳过白萝卜" subtitle="防狗功能">
                <template #action>
                  <NeonCheckbox v-model="localConfig.skipWhiteRadish" />
                </template>
              </ConfigCard>

              <!-- 跳过指定作物 -->
              <ConfigCard title="跳过指定作物" subtitle="多选功能">
                <template #action>
                  <button
                    @click="showCropSelector = true"
                    style="
                      padding: 6px 14px;
                      font-size: 12px;
                      font-weight: 500;
                      border: 1px solid #e2e8f0;
                      border-radius: 8px;
                      cursor: pointer;
                      background: white;
                      color: #64748b;
                      transition: all 0.2s ease;
                    "
                    onmouseover="this.style.borderColor='#3b82f6'; this.style.color='#3b82f6';"
                    onmouseout="this.style.borderColor='#e2e8f0'; this.style.color='#64748b';"
                  >
                    {{ (localConfig.skipCrops?.length || 0) > 0 ? `已选择 ${localConfig.skipCrops?.length || 0} 种` : '选择作物' }}
                  </button>
                </template>
                <!-- 已选择的作物标签 -->
                <div v-if="(localConfig.skipCrops?.length || 0) > 0" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
                  <span
                    v-for="cropId in localConfig.skipCrops"
                    :key="cropId"
                    style="
                      font-size: 11px;
                      padding: 2px 8px;
                      background: #fee2e2;
                      color: #dc2626;
                      border-radius: 10px;
                      display: flex;
                      align-items: center;
                      gap: 4px;
                    "
                  >
                    {{ getCropNameById(cropId) }}
                    <span
                      @click="removeSkipCrop(cropId)"
                      style="cursor: pointer; font-weight: bold;"
                    >×</span>
                  </span>
                </div>
              </ConfigCard>

              <!-- 帮浇水 -->
              <ConfigCard title="帮浇水">
                <template #action>
                  <NeonCheckbox v-model="localConfig.enableHelpWater" />
                </template>
              </ConfigCard>

              <!-- 帮除草 -->
              <ConfigCard title="帮除草">
                <template #action>
                  <NeonCheckbox v-model="localConfig.enableHelpWeed" />
                </template>
              </ConfigCard>

              <!-- 帮除虫 -->
              <ConfigCard title="帮除虫">
                <template #action>
                  <NeonCheckbox v-model="localConfig.enableHelpBug" />
                </template>
              </ConfigCard>

              <!-- 无经验不帮助 -->
              <ConfigCard title="无经验不帮助" subtitle="经验达上限后自动暂停巡查">
                <template #action>
                  <NeonCheckbox v-model="localConfig.helpOnlyWithExp" />
                </template>
              </ConfigCard>

              <!-- 放虫 -->
              <ConfigCard title="放虫" subtitle="慎用功能">
                <template #action>
                  <NeonCheckbox v-model="localConfig.enablePutBug" />
                </template>
              </ConfigCard>

              <!-- 放草 -->
              <ConfigCard title="放草" subtitle="慎用功能">
                <template #action>
                  <NeonCheckbox v-model="localConfig.enablePutWeed" />
                </template>
              </ConfigCard>

              <!-- 白名单设置 -->
              <div style="font-size: 14px; font-weight: 600; color: #0369a1; margin: 8px 0 12px 0;">白名单设置（GID列表）</div>
              <div style="font-size: 12px; color: #64748b; margin-bottom: 12px;">填入好友GID，多个用逗号分隔，白名单内好友跳过对应互动</div>

              <!-- 偷菜白名单 -->
              <div v-if="localConfig.enableSteal" style="display: flex; flex-direction: column; gap: 6px;">
                <span style="font-size: 13px; color: #1e293b;">偷菜白名单</span>
                <input 
                  type="text" 
                  v-model="stealWhitelistInput"
                  @blur="updateStealWhitelist"
                  placeholder="例如: 123456, 789012"
                  style="padding: 8px 12px; border: 1px solid #bae6fd; border-radius: 8px; font-size: 13px; background: white;"
                >
              </div>

              <!-- 浇水白名单 -->
              <div v-if="localConfig.enableHelpWater" style="display: flex; flex-direction: column; gap: 6px;">
                <span style="font-size: 13px; color: #1e293b;">浇水白名单</span>
                <input 
                  type="text" 
                  v-model="helpWaterWhitelistInput"
                  @blur="updateHelpWaterWhitelist"
                  placeholder="例如: 123456, 789012"
                  style="padding: 8px 12px; border: 1px solid #bae6fd; border-radius: 8px; font-size: 13px; background: white;"
                >
              </div>

              <!-- 除草白名单 -->
              <div v-if="localConfig.enableHelpWeed" style="display: flex; flex-direction: column; gap: 6px;">
                <span style="font-size: 13px; color: #1e293b;">除草白名单</span>
                <input 
                  type="text" 
                  v-model="helpWeedWhitelistInput"
                  @blur="updateHelpWeedWhitelist"
                  placeholder="例如: 123456, 789012"
                  style="padding: 8px 12px; border: 1px solid #bae6fd; border-radius: 8px; font-size: 13px; background: white;"
                >
              </div>

              <!-- 除虫白名单 -->
              <div v-if="localConfig.enableHelpBug" style="display: flex; flex-direction: column; gap: 6px;">
                <span style="font-size: 13px; color: #1e293b;">除虫白名单</span>
                <input 
                  type="text" 
                  v-model="helpBugWhitelistInput"
                  @blur="updateHelpBugWhitelist"
                  placeholder="例如: 123456, 789012"
                  style="padding: 8px 12px; border: 1px solid #bae6fd; border-radius: 8px; font-size: 13px; background: white;"
                >
              </div>

              <!-- 放虫白名单 -->
              <div v-if="localConfig.enablePutBug" style="display: flex; flex-direction: column; gap: 6px;">
                <span style="font-size: 13px; color: #1e293b;">放虫白名单</span>
                <input 
                  type="text" 
                  v-model="putBugWhitelistInput"
                  @blur="updatePutBugWhitelist"
                  placeholder="例如: 123456, 789012"
                  style="padding: 8px 12px; border: 1px solid #bae6fd; border-radius: 8px; font-size: 13px; background: white;"
                >
              </div>

              <!-- 放草白名单 -->
              <div v-if="localConfig.enablePutWeed" style="display: flex; flex-direction: column; gap: 6px;">
                <span style="font-size: 13px; color: #1e293b;">放草白名单</span>
                <input 
                  type="text" 
                  v-model="putWeedWhitelistInput"
                  @blur="updatePutWeedWhitelist"
                  placeholder="例如: 123456, 789012"
                  style="padding: 8px 12px; border: 1px solid #bae6fd; border-radius: 8px; font-size: 13px; background: white;"
                >
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <!-- 高级设置区域 -->
      <CollapsibleSection
        title="高级设置"
        subtitle="肥料、防偷菜、巡查间隔等"
        icon="⚙️"
        storageKey="advanced_settings"
        :defaultExpanded="false"
      >
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <!-- 使用有机肥 -->
          <ConfigCard title="使用有机肥" subtitle="优先使用，不足时用普通肥">
            <template #action>
              <NeonCheckbox v-model="localConfig.useOrganicFertilizer" />
            </template>
          </ConfigCard>

          <!-- 同时使用两种肥料 -->
          <div v-if="localConfig.useOrganicFertilizer" style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: #f0fdf4; border-radius: 12px; border: 1px solid #86efac;">
            <div>
              <span style="font-size: 15px; font-weight: 500; color: #166534;">同时使用普通肥和有机肥</span>
              <span style="font-size: 12px; color: #22c55e; margin-left: 8px;">一株作物两种肥料都使用</span>
            </div>
            <NeonCheckbox v-model="localConfig.useBothFertilizers" />
          </div>

          <!-- 肥料自动补充设置 -->
          <div v-if="localConfig.autoFertilize" style="display: flex; flex-direction: column; gap: 12px; padding: 16px 20px; background: #fefce8; border-radius: 12px; border: 1px solid #fde047;">
            <div style="font-size: 14px; font-weight: 500; color: #854d0e;">肥料自动补充设置</div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              <!-- 普通肥自动补充 -->
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 13px; color: #713f12;">普通肥自动补充</span>
                <NeonCheckbox v-model="localConfig.autoRefillNormalFertilizer" />
              </div>
              <!-- 有机肥自动补充 -->
              <div v-if="localConfig.useOrganicFertilizer" style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 13px; color: #713f12;">有机肥自动补充</span>
                <NeonCheckbox v-model="localConfig.autoRefillOrganicFertilizer" />
              </div>
              <!-- 补充阈值设置 -->
              <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                <span style="font-size: 13px; color: #713f12;">补充阈值（肥料≤{{ localConfig.fertilizerRefillThreshold || 100 }}时补充）</span>
                <input
                  type="number"
                  v-model.number="localConfig.fertilizerRefillThreshold"
                  min="10"
                  max="1000"
                  style="width: 70px; padding: 6px 10px; border: 1px solid #fde047; border-radius: 6px; font-size: 13px; text-align: center;"
                >
              </div>
              <div style="font-size: 11px; color: #a16207; margin-top: 4px;">
                提示：优先使用大容量补充道具（12小时>8小时>4小时>1小时）
              </div>
            </div>
          </div>

          <!-- 防偷菜功能 -->
          <div style="display: flex; flex-direction: column; gap: 12px; padding: 16px 20px; background: #fef2f2; border-radius: 12px; border: 1px solid #fecaca;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 15px; font-weight: 500; color: #1e293b;">防偷菜功能</span>
                <span style="font-size: 12px; color: #64748b;">作物成熟前自动使用有机肥加速并收获</span>
              </div>
              <NeonCheckbox v-model="localConfig.enableAntiSteal" />
            </div>
            
            <!-- 防偷菜时间设置 -->
            <div v-if="localConfig.enableAntiSteal" style="display: flex; flex-direction: column; gap: 10px; margin-top: 8px;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 13px; color: #713f12;">提前加速时间（秒）</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <input
                    type="number"
                    v-model.number="localConfig.antiStealAdvanceTime"
                    min="20"
                    max="120"
                    style="width: 70px; padding: 6px 10px; border: 1px solid #fecaca; border-radius: 6px; font-size: 13px; text-align: center;"
                  >
                  <span style="font-size: 12px; color: #64748b;">秒</span>
                </div>
              </div>
              <div style="font-size: 11px; color: #dc2626; background: #fef2f2; padding: 8px 12px; border-radius: 6px; border: 1px dashed #fca5a5;">
                <strong>⚠️ 重要提醒：</strong>请确保有机化肥剩余充足！当作物距离成熟还有设定时间时，会自动使用有机肥加速到成熟并立即收获，防止他人偷取。时间范围：20-120秒
              </div>
            </div>
          </div>

          <!-- 农场巡查间隔 -->
          <div style="display: flex; flex-direction: column; gap: 12px; padding: 16px 20px; background: #f8fafc; border-radius: 12px;">
            <IntervalSlider
              v-model="localFarmInterval"
              :min="1"
              :max="600"
              :step="1"
              label="农场巡查间隔"
              unit="秒"
              hint="设置农场巡查的时间间隔"
            />
          </div>

          <!-- 好友巡查间隔 -->
          <div style="display: flex; flex-direction: column; gap: 12px; padding: 16px 20px; background: #f8fafc; border-radius: 12px;">
            <IntervalSlider
              v-model="localFriendInterval"
              :min="1"
              :max="600"
              :step="1"
              label="好友巡查间隔"
              unit="秒"
              hint="设置好友巡查的时间间隔"
            />
          </div>

          <!-- 随机时间好友巡查 -->
          <div style="display: flex; flex-direction: column; gap: 12px; padding: 16px 20px; background: #f8fafc; border-radius: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 15px; font-weight: 500; color: #1e293b;">随机时间好友巡查</span>
                <span style="font-size: 12px; color: #64748b;">开启后将在 5-300 秒之间随机选择间隔</span>
              </div>
              <NeonCheckbox v-model="localConfig.enableRandomFriendInterval" />
            </div>
          </div>

          <!-- 反检测设置 -->
          <div style="display: flex; flex-direction: column; gap: 12px; padding: 16px 20px; background: #eef2ff; border-radius: 12px; border: 1px solid #c7d2fe;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
              <div style="display: flex; flex-direction: column; gap: 2px; flex: 1;">
                <span style="font-size: 15px; font-weight: 500; color: #1e293b;">反检测模式</span>
                <span style="font-size: 12px; color: #64748b;">启用拟人调度和协议级行为流上报</span>
              </div>
              <button
                @click="showAntiDetectionIntro = true"
                style="
                  padding: 4px 10px;
                  font-size: 11px;
                  border-radius: 999px;
                  border: 1px solid #a5b4fc;
                  background: rgba(129, 140, 248, 0.08);
                  color: #3730a3;
                  cursor: pointer;
                  white-space: nowrap;
                "
              >
                使用说明
              </button>
              <NeonCheckbox v-model="localConfig.antiDetection.enabled" />
            </div>

            <div v-if="localConfig.antiDetection.enabled" style="display: flex; flex-direction: column; gap: 10px; margin-top: 6px;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 13px; color: #3730a3;">拟人强度</span>
                <select
                  v-model="localConfig.antiDetection.humanMode.intensity"
                  style="padding: 6px 10px; border: 1px solid #c7d2fe; border-radius: 8px; font-size: 13px; background: white;"
                >
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                </select>
              </div>

              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 13px; color: #3730a3;">启用 Tlog 行为流</span>
                <NeonCheckbox v-model="localConfig.antiDetection.protocol.enableTlog" />
              </div>

              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 13px; color: #3730a3;">设备模板</span>
                <select
                  v-model="localConfig.antiDetection.protocol.deviceProfile"
                  style="padding: 6px 10px; border: 1px solid #c7d2fe; border-radius: 8px; font-size: 13px; background: white;"
                >
                  <option value="auto">自动</option>
                  <option value="iphone15">iPhone 15 Pro</option>
                  <option value="iphone14">iPhone 14 Pro</option>
                  <option value="android_highend">Android 高端</option>
                  <option value="android_midrange">Android 中端</option>
                </select>
              </div>
            </div>
          </div>

          <!-- 智能推荐种植 -->
          <div style="padding: 16px 20px; background: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 15px; font-weight: 500; color: #1e293b;">智能推荐种植</span>
                <span style="font-size: 12px; color: #64748b;">自动选择每小时经验最高的作物</span>
                <span style="font-size: 11px; color: #94a3b8; margin-top: 2px;">提示：如需自己选择种子，请关闭此开关</span>
              </div>
              <NeonCheckbox v-model="localConfig.enableSmartPlant" />
            </div>
          </div>

          <!-- 种子选择 -->
          <div v-if="!localConfig.enableSmartPlant" style="padding: 16px 20px; background: #f8fafc; border-radius: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <span style="font-size: 15px; font-weight: 500; color: #1e293b;">种植种子</span>
              <span v-if="selectedPlant" style="font-size: 13px; color: #22c55e; font-weight: 500;">
                {{ selectedPlant.displayName }}
              </span>
            </div>

            <!-- 搜索框 -->
            <div style="position: relative; margin-bottom: 8px;">
              <input
                v-model="plantSearchQuery"
                type="text"
                placeholder="搜索植物名称..."
                style="width: 100%; padding: 10px 12px 10px 36px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; color: #1e293b; background: white; box-sizing: border-box;"
              >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%);">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>

            <!-- 植物列表 -->
            <div style="max-height: 200px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; background: white;">
              <div
                v-for="plant in filteredPlants"
                :key="plant.id"
                @click="selectPlant(plant)"
                :style="{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f1f5f9',
                  backgroundColor: localConfig.seedType === plant.displayName ? '#eff6ff' : 'white',
                  transition: 'all 0.2s'
                }"
                onmouseover="this.style.backgroundColor='#f8fafc'"
                onmouseout="this.style.backgroundColor=this.style.backgroundColor==='#eff6ff'?'#eff6ff':'white'"
              >
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="font-size: 14px; color: #1e293b; font-weight: 500;">{{ plant.name }}</span>
                  <span style="font-size: 12px; color: #64748b;">{{ plant.growTime }}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; margin-top: 4px;">
                  <span style="font-size: 11px; color: #94a3b8;">Lv{{ plant.levelNeed }}</span>
                  <span style="font-size: 11px; color: #94a3b8;">{{ plant.exp }}经验</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 设备信息设置 -->
          <div style="padding: 16px 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
            <div style="font-size: 14px; font-weight: 500; color: #1e293b; margin-bottom: 12px;">设备信息设置</div>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <!-- 设备模板选择 -->
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 13px; color: #64748b;">设备模板</span>
                <select
                  v-model="localConfig.deviceTemplate"
                  @change="applyDeviceTemplate"
                  style="width: 200px; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; background: white;"
                >
                  <option value="">自定义</option>
                  <option value="iphone_15_pro">iPhone 15 Pro</option>
                  <option value="iphone_14_pro">iPhone 14 Pro</option>
                  <option value="iphone_13">iPhone 13</option>
                  <option value="samsung_s24">Samsung S24 Ultra</option>
                  <option value="xiaomi_14">Xiaomi 14</option>
                  <option value="huawei_mate60">Huawei Mate 60 Pro</option>
                  <option value="oneplus_12">OnePlus 12</option>
                  <option value="vivo_x100">vivo X100 Pro</option>
                </select>
              </div>

              <!-- OS -->
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 13px; color: #64748b;">操作系统</span>
                <input
                  type="text"
                  v-model="localConfig.sysSoftware"
                  placeholder="例如: iOS 18.2.1"
                  style="width: 200px; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; text-align: left;"
                >
              </div>

              <!-- Network -->
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 13px; color: #64748b;">网络类型</span>
                <select
                  v-model="localConfig.network"
                  style="width: 200px; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; background: white;"
                >
                  <option value="wifi">WiFi</option>
                  <option value="4g">4G</option>
                  <option value="5g">5G</option>
                </select>
              </div>

              <!-- Memory -->
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 13px; color: #64748b;">内存 (MB)</span>
                <input
                  type="text"
                  v-model="localConfig.memory"
                  placeholder="例如: 8192"
                  style="width: 200px; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; text-align: left;"
                >
              </div>

              <!-- Device ID -->
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 13px; color: #64748b;">设备标识</span>
                <input
                  type="text"
                  v-model="localConfig.deviceId"
                  placeholder="例如: iPhone16,2"
                  style="width: 200px; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; text-align: left;"
                >
              </div>

              <div style="font-size: 11px; color: #94a3b8; line-height: 1.5;">
                提示：选择设备模板可快速填充设备信息，或选择"自定义"手动填写
              </div>
            </div>
          </div>

        </div>
      </CollapsibleSection>

      <!-- 保存按钮 -->
      <div style="display: flex; justify-content: flex-end; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
        <button 
          @click="saveConfig"
          style="padding: 12px 32px; background: #3b82f6; color: white; font-size: 15px; font-weight: 600; border: none; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);"
          onmouseover="this.style.backgroundColor='#2563eb'; this.style.transform='translateY(-1px)';"
          onmouseout="this.style.backgroundColor='#3b82f6'; this.style.transform='translateY(0)';"
        >
          保存配置
        </button>
      </div>
    </div>
  </GlassCard>

  <!-- 作物选择弹窗 -->
  <div v-if="showCropSelector" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;" @click.self="showCropSelector = false">
    <div style="background: white; border-radius: 16px; padding: 24px; width: 90%; max-width: 500px; max-height: 80vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="font-size: 18px; font-weight: 600; color: #1e293b; margin: 0;">选择要跳过的作物</h3>
        <button @click="showCropSelector = false" style="background: none; border: none; font-size: 20px; color: #64748b; cursor: pointer;">×</button>
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
        <div
          v-for="crop in availableCrops"
          :key="crop.id"
          @click="toggleSkipCrop(crop.id)"
          :style="{
            padding: '10px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            border: '1px solid',
            borderColor: localConfig.skipCrops?.includes(crop.id) ? '#22c55e' : '#e2e8f0',
            background: localConfig.skipCrops?.includes(crop.id) ? '#f0fdf4' : 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }"
        >
          <span v-if="localConfig.skipCrops?.includes(crop.id)" style="color: #22c55e;">✓</span>
          <span style="font-size: 13px; color: #1e293b;">{{ crop.name }}</span>
        </div>
      </div>
      <div style="margin-top: 16px; display: flex; justify-content: flex-end;">
        <button 
          @click="showCropSelector = false"
          style="padding: 10px 24px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;"
        >
          确定
        </button>
      </div>
    </div>
  </div>

  <!-- 反检测说明弹窗 -->
  <div
    v-if="showAntiDetectionIntro"
    style="position: fixed; inset: 0; background: rgba(15,23,42,0.55); display: flex; align-items: center; justify-content: center; z-index: 1100;"
    @click.self="showAntiDetectionIntro = false"
  >
    <div
      style="
        width: 92%;
        max-width: 640px;
        max-height: 82vh;
        background: radial-gradient(circle at top, #eef2ff, #0f172a 140%);
        border-radius: 18px;
        padding: 20px 22px 18px 22px;
        box-shadow: 0 18px 45px rgba(15,23,42,0.5);
        border: 1px solid rgba(129,140,248,0.35);
        color: #e5e7eb;
        display: flex;
        flex-direction: column;
        gap: 10px;
      "
    >
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 4px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 18px;">🛡️</span>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 16px; font-weight: 600;">反检测模式说明</span>
            <span style="font-size: 11px; color: #a5b4fc;">降低行为过于“机器化”带来的风控风险，但无法保证绝对安全</span>
          </div>
        </div>
        <button
          @click="showAntiDetectionIntro = false"
          style="border: none; background: transparent; color: #9ca3af; font-size: 18px; cursor: pointer;"
        >
          ×
        </button>
      </div>

      <div style="flex: 1; overflow-y: auto; padding-right: 4px; margin-top: 4px;">
        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 12px; line-height: 1.6;">
          <div style="background: rgba(15,23,42,0.7); border-radius: 10px; padding: 10px 12px; border: 1px solid rgba(148,163,184,0.4);">
            <div style="font-weight: 600; margin-bottom: 4px;">作用概览</div>
            <ul style="margin: 0; padding-left: 18px;">
              <li>统一控制账号的自动操作节奏，避免连续、高频、固定间隔的“机器人行为”</li>
              <li>在协议层补充更完整的设备信息与行为日志，让整体表现更接近正常客户端</li>
              <li>可以按账号单独开启/关闭，不影响默认的安全配置</li>
            </ul>
          </div>

          <div style="background: rgba(15,23,42,0.7); border-radius: 10px; padding: 10px 12px; border: 1px solid rgba(129,140,248,0.4);">
            <div style="font-weight: 600; margin-bottom: 4px;">1. 拟人调度（行为节奏）</div>
            <ul style="margin: 0; padding-left: 18px;">
              <li>同一账号的自动操作（农场、好友、任务等）按队列依次执行，不会并发“秒点一片”</li>
              <li>两次操作之间加入随机延迟，不再是固定间隔；强度越高，抖动越大，节奏越“像人”</li>
              <li>周期性安排短暂休息，长时间运行时会自然出现“在线一阵子 → 歇一会”的模式</li>
            </ul>
            <div style="margin-top: 6px; font-size: 11px; color: #9ca3af;">
              提示：好友巡查、农场巡查的基础间隔仍由「高级设置」里的间隔滑块/随机模式控制，反检测只在其基础上做细粒度节奏调整。
            </div>
          </div>

          <div style="background: rgba(15,23,42,0.7); border-radius: 10px; padding: 10px 12px; border: 1px solid rgba(96,165,250,0.4);">
            <div style="font-weight: 600; margin-bottom: 4px;">2. 协议级反检测（设备信息 & 行为日志）</div>
            <ul style="margin: 0; padding-left: 18px;">
              <li>登录时自动补全常见终端参数（系统版本、分辨率、GPU 等），并为每个账号生成稳定的设备标识</li>
              <li>启动时按正常客户端顺序上报一组“进入游戏”的行为日志，避免只发游戏本身请求</li>
              <li>运行过程中为关键自动操作打点，周期性打包上报，减少“完全没有行为流”的异常特征</li>
            </ul>
            <div style="margin-top: 6px; font-size: 11px; color: #9ca3af;">
              这些上报仅用于模拟正常客户端行为，不会包含账号密码等敏感信息。
            </div>
          </div>

          <div style="background: rgba(15,23,42,0.7); border-radius: 10px; padding: 10px 12px; border: 1px solid rgba(248,250,252,0.15);">
            <div style="font-weight: 600; margin-bottom: 4px;">3. 拟人强度如何选择？</div>
            <ul style="margin: 0; padding-left: 18px;">
              <li><strong>低</strong>：轻微随机化，整体节奏接近当前默认行为，适合更看重效率的用户</li>
              <li><strong>中</strong>（推荐）：在效率与“像真人”之间做折中，适合大部分长期挂起场景</li>
              <li><strong>高</strong>：抖动和休息更明显，更接近日常手动操作的节奏，但整体效率会略下降</li>
            </ul>
          </div>

          <div style="background: rgba(15,23,42,0.7); border-radius: 10px; padding: 10px 12px; border: 1px solid rgba(248,113,113,0.5);">
            <div style="font-weight: 600; margin-bottom: 4px; color: #fecaca;">4. 风险与责任提示</div>
            <ul style="margin: 0; padding-left: 18px;">
              <li>反检测只能在一定程度上降低“过于规律 / 明显脚本行为”的风险，无法保证账号绝对安全</li>
              <li>长时间在线、多账号同时高强度运行，依然可能触发游戏侧的风控策略</li>
              <li>建议：避免在特别重要的账号上长时间高强度挂机，并合理设置巡查间隔和功能开关</li>
            </ul>
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px;">
        <button
          @click="showAntiDetectionIntro = false"
          style="
            padding: 8px 18px;
            border-radius: 999px;
            border: 1px solid rgba(148,163,184,0.7);
            background: rgba(15,23,42,0.9);
            color: #e5e7eb;
            font-size: 12px;
            cursor: pointer;
          "
        >
          我已了解
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import axios from 'axios';
import GlassCard from '../GlassCard.vue';
import ConfigCard from '../ConfigCard.vue';
import NeonCheckbox from '../NeonCheckbox.vue';
import IntervalSlider from '../IntervalSlider.vue';
import CollapsibleSection from '../CollapsibleSection.vue';

const API_BASE_URL = '/api';

interface AccountConfig {
  autoFarm: boolean;
  autoFriend: boolean;
  autoTask: boolean;
  autoSell: boolean;
  autoFertilize: boolean;
  autoWeed?: boolean;
  autoBug?: boolean;
  autoWater?: boolean;
  seedType: string;
  minCropLevel: number;
  enableFriendCheck: boolean;
  enableSteal: boolean;
  enableHelpWater: boolean;
  enableHelpWeed: boolean;
  enableHelpBug: boolean;
  enablePutBug: boolean;
  enablePutWeed: boolean;
  helpOnlyWithExp?: boolean;
  enableSmartPlant?: boolean;
  skipWhiteRadish?: boolean;
  skipCrops?: number[];
  autoUnlockLand?: boolean;
  autoUpgradeLand?: boolean;
  autoClaimEmail?: boolean;
  autoClaimIllustrated?: boolean;
  autoClaimFreeGifts?: boolean;
  autoClaimVip?: boolean;
  autoShare?: boolean;
  autoClaimMonthCard?: boolean;
  autoClaimOpenServer?: boolean;
  autoRefillNormalFertilizer?: boolean;
  autoRefillOrganicFertilizer?: boolean;
  fertilizerRefillThreshold?: number;
  stealWhitelist: number[];
  helpWaterWhitelist: number[];
  helpWeedWhitelist: number[];
  helpBugWhitelist: number[];
  putBugWhitelist: number[];
  putWeedWhitelist: number[];
  enableRandomFriendInterval: boolean;
  plantIntervalMin?: number;
  plantIntervalMax?: number;
  enableAntiSteal?: boolean;
  antiStealAdvanceTime?: number;
  useOrganicFertilizer?: boolean;
  useBothFertilizers?: boolean;
  useFixedFriendList?: boolean;
  fixedFriendIds?: number[];
  os?: string;
  deviceTemplate?: string;
  sysSoftware?: string;
  network?: string;
  memory?: string;
  deviceId?: string;
  antiDetection: {
    enabled: boolean;
    humanMode: {
      intensity: 'low' | 'medium' | 'high';
    };
    protocol: {
      enableTlog: boolean;
      deviceProfile: string;
    };
  };
}

interface Account {
  id: string;
  config: AccountConfig;
  farmInterval: number;
  friendInterval: number;
  email?: string;
  stats?: {
    exp: number;
    coins: number;
    sessionStats?: any;
    todayStats?: any;
    bag?: any[];
    operationLimits?: any;
    tasks?: any;
  };
}

const props = defineProps<{
  account: Account;
}>();

const emit = defineEmits<{
  'save-config': [config: { config: AccountConfig; farmInterval: number; friendInterval: number; email?: string }];
}>();

// 本地配置状态
const localConfig = ref<AccountConfig>({
  ...props.account.config,
  autoSell: props.account.config?.autoSell === true,
  autoWeed: props.account.config?.autoWeed !== false,
  autoBug: props.account.config?.autoBug !== false,
  autoWater: props.account.config?.autoWater !== false,
  enableFriendCheck: props.account.config?.enableFriendCheck !== false,
  enableSteal: props.account.config?.enableSteal !== false,
  enableHelpWater: props.account.config?.enableHelpWater !== false,
  enableHelpWeed: props.account.config?.enableHelpWeed !== false,
  enableHelpBug: props.account.config?.enableHelpBug !== false,
  helpOnlyWithExp: props.account.config?.helpOnlyWithExp !== false,
  enablePutBug: props.account.config?.enablePutBug === true,
  enablePutWeed: props.account.config?.enablePutWeed === true,
  enableSmartPlant: props.account.config?.enableSmartPlant !== false,
  skipWhiteRadish: props.account.config?.skipWhiteRadish === true,
  skipCrops: props.account.config?.skipCrops || [],
  autoUnlockLand: props.account.config?.autoUnlockLand === true,
  autoUpgradeLand: props.account.config?.autoUpgradeLand === true,
  autoClaimEmail: props.account.config?.autoClaimEmail !== false,
  autoClaimIllustrated: props.account.config?.autoClaimIllustrated !== false,
  autoClaimFreeGifts: props.account.config?.autoClaimFreeGifts !== false,
  autoClaimVip: props.account.config?.autoClaimVip !== false,
  autoShare: props.account.config?.autoShare !== false,
  autoClaimMonthCard: props.account.config?.autoClaimMonthCard !== false,
  autoClaimOpenServer: props.account.config?.autoClaimOpenServer !== false,
  autoRefillNormalFertilizer: props.account.config?.autoRefillNormalFertilizer === true,
  autoRefillOrganicFertilizer: props.account.config?.autoRefillOrganicFertilizer === true,
  fertilizerRefillThreshold: props.account.config?.fertilizerRefillThreshold || 100,
  stealWhitelist: props.account.config?.stealWhitelist || [],
  helpWaterWhitelist: props.account.config?.helpWaterWhitelist || [],
  helpWeedWhitelist: props.account.config?.helpWeedWhitelist || [],
  helpBugWhitelist: props.account.config?.helpBugWhitelist || [],
  putBugWhitelist: props.account.config?.putBugWhitelist || [],
  putWeedWhitelist: props.account.config?.putWeedWhitelist || [],
  enableRandomFriendInterval: props.account.config?.enableRandomFriendInterval === true,
  enableAntiSteal: props.account.config?.enableAntiSteal === true,
  antiStealAdvanceTime: props.account.config?.antiStealAdvanceTime || 30,
  useOrganicFertilizer: props.account.config?.useOrganicFertilizer === true,
  useBothFertilizers: props.account.config?.useBothFertilizers === true,
  useFixedFriendList: props.account.config?.useFixedFriendList === true,
  fixedFriendIds: props.account.config?.fixedFriendIds || [],
  plantIntervalMin: props.account.config?.plantIntervalMin || 100,
  plantIntervalMax: props.account.config?.plantIntervalMax || 1000,
  os: props.account.config?.os || 'iOS',
  deviceTemplate: props.account.config?.deviceTemplate || '',
  sysSoftware: props.account.config?.sysSoftware || '',
  network: props.account.config?.network || 'wifi',
  memory: props.account.config?.memory || '',
  deviceId: props.account.config?.deviceId || '',
  antiDetection: {
    enabled: props.account.config?.antiDetection?.enabled === true,
    humanMode: {
      intensity: props.account.config?.antiDetection?.humanMode?.intensity || 'medium'
    },
    protocol: {
      enableTlog: props.account.config?.antiDetection?.protocol?.enableTlog !== false,
      deviceProfile: props.account.config?.antiDetection?.protocol?.deviceProfile || 'auto'
    }
  },
});

const localFarmInterval = ref(props.account.farmInterval || 10);
const localFriendInterval = ref(props.account.friendInterval || 10);
const showCropSelector = ref(false);
const showAntiDetectionIntro = ref(false);
const plantSearchQuery = ref('');

// 白名单输入
const stealWhitelistInput = ref(props.account.config?.stealWhitelist?.join(', ') || '');
const helpWaterWhitelistInput = ref(props.account.config?.helpWaterWhitelist?.join(', ') || '');
const helpWeedWhitelistInput = ref(props.account.config?.helpWeedWhitelist?.join(', ') || '');
const helpBugWhitelistInput = ref(props.account.config?.helpBugWhitelist?.join(', ') || '');
const putBugWhitelistInput = ref(props.account.config?.putBugWhitelist?.join(', ') || '');
const putWeedWhitelistInput = ref(props.account.config?.putWeedWhitelist?.join(', ') || '');
const fixedFriendIdsInput = ref(props.account.config?.fixedFriendIds?.join(', ') || '');

// 植物列表（从API获取，用于种子选择）
const plants = ref<Array<{
  id: number;
  name: string;
  seedId: number;
  levelNeed: number;
  exp: number;
  growTime: number;
  displayName: string;
  hourlyExp: number;
}>>([]);

// 作物列表（从Plant.json加载，用于跳过作物选择）
const availableCrops = ref<Array<{id: number; name: string; level: number}>>([]);

// 加载植物列表
async function loadPlants() {
  try {
    const level = getCurrentLevel();
    const response = await axios.get(`${API_BASE_URL}/plants?level=${level}`);
    if (response.data.success) {
      plants.value = response.data.plants;

      // 如果没有选中任何植物，默认选择第一个
      if (!localConfig.value.seedType && plants.value.length > 0 && plants.value[0]) {
        localConfig.value.seedType = plants.value[0].displayName;
      }
    }
  } catch (error) {
    console.error('加载植物列表失败:', error);
  }
}

// 加载作物列表
async function loadCrops() {
  try {
    const response = await fetch('/gameConfig/Plant.json');
    const plantData = await response.json();
    // 过滤出普通作物（非变异），按等级排序
    const crops = plantData
      .filter((p: any) => p.id >= 1000000 && p.id < 2000000) // 只取普通作物
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        level: p.levelNeed
      }))
      .sort((a: any, b: any) => a.level - b.level);
    availableCrops.value = crops;
  } catch (error) {
    console.error('加载作物列表失败:', error);
    // 使用默认作物列表
    availableCrops.value = [
      { id: 1020002, name: '白萝卜', level: 1 },
      { id: 1020003, name: '胡萝卜', level: 1 },
      { id: 1020059, name: '大白菜', level: 1 },
      { id: 1020065, name: '大蒜', level: 1 },
      { id: 1020064, name: '大葱', level: 1 },
      { id: 1020060, name: '水稻', level: 1 },
      { id: 1020061, name: '小麦', level: 1 },
      { id: 1020004, name: '玉米', level: 1 },
      { id: 1020066, name: '鲜姜', level: 1 },
      { id: 1020005, name: '土豆', level: 1 }
    ];
  }
}

// 设备模板定义
const DEVICE_TEMPLATES: Record<string, { name: string; os: string; sysSoftware: string; network: string; memory: string; deviceId: string }> = {
  iphone_15_pro: { name: 'iPhone 15 Pro', os: 'iOS', sysSoftware: 'iOS 18.2.1', network: 'wifi', memory: '8192', deviceId: 'iPhone16,2' },
  iphone_14_pro: { name: 'iPhone 14 Pro', os: 'iOS', sysSoftware: 'iOS 17.7.2', network: 'wifi', memory: '6144', deviceId: 'iPhone15,3' },
  iphone_13: { name: 'iPhone 13', os: 'iOS', sysSoftware: 'iOS 16.7.2', network: 'wifi', memory: '4096', deviceId: 'iPhone14,5' },
  samsung_s24: { name: 'Samsung S24 Ultra', os: 'Android', sysSoftware: 'Android 14', network: 'wifi', memory: '12288', deviceId: 'SM-S9280' },
  xiaomi_14: { name: 'Xiaomi 14', os: 'Android', sysSoftware: 'Android 14', network: 'wifi', memory: '12288', deviceId: '23127PN0CC' },
  huawei_mate60: { name: 'Huawei Mate 60 Pro', os: 'Android', sysSoftware: 'HarmonyOS 4.0', network: 'wifi', memory: '12288', deviceId: 'ALN-AL00' },
  oneplus_12: { name: 'OnePlus 12', os: 'Android', sysSoftware: 'Android 14', network: 'wifi', memory: '16384', deviceId: 'CPH2581' },
  vivo_x100: { name: 'vivo X100 Pro', os: 'Android', sysSoftware: 'Android 14', network: 'wifi', memory: '16384', deviceId: 'V2324A' },
};

// 应用设备模板
function applyDeviceTemplate() {
  const templateKey = localConfig.value.deviceTemplate;
  if (templateKey && DEVICE_TEMPLATES[templateKey]) {
    const template = DEVICE_TEMPLATES[templateKey];
    localConfig.value.os = template.os;
    localConfig.value.sysSoftware = template.sysSoftware;
    localConfig.value.network = template.network;
    localConfig.value.memory = template.memory;
    localConfig.value.deviceId = template.deviceId;
  }
}

// 根据经验值计算当前等级
function getCurrentLevel(): number {
  const exp = props.account.stats?.exp || 0;
  // 从最高等级向下查找，找到第一个经验值小于等于当前经验值的等级
  // 这里简化处理，实际应该使用RoleLevel.json
  if (exp < 100) return 1;
  if (exp < 300) return 2;
  if (exp < 600) return 3;
  if (exp < 1000) return 4;
  return Math.floor(exp / 500) + 1;
}

// 过滤后的植物列表
const filteredPlants = computed(() => {
  if (!plantSearchQuery.value.trim()) {
    return plants.value;
  }
  const query = plantSearchQuery.value.toLowerCase();
  return plants.value.filter(plant =>
    plant.name.toLowerCase().includes(query)
  );
});

// 选中的植物
const selectedPlant = computed(() => {
  return plants.value.find(p => p.displayName === localConfig.value.seedType);
});

// 选择植物
function selectPlant(plant: typeof plants.value[0]) {
  localConfig.value.seedType = plant.displayName;
}

// 获取作物名称
function getCropNameById(id: number): string {
  const crop = availableCrops.value.find(c => c.id === id);
  return crop?.name || `作物#${id}`;
}

// 切换跳过作物
function toggleSkipCrop(cropId: number) {
  if (!localConfig.value.skipCrops) {
    localConfig.value.skipCrops = [];
  }
  const index = localConfig.value.skipCrops.indexOf(cropId);
  if (index > -1) {
    localConfig.value.skipCrops.splice(index, 1);
  } else {
    localConfig.value.skipCrops.push(cropId);
  }
}

// 移除跳过作物
function removeSkipCrop(cropId: number) {
  if (localConfig.value.skipCrops) {
    const index = localConfig.value.skipCrops.indexOf(cropId);
    if (index > -1) {
      localConfig.value.skipCrops.splice(index, 1);
    }
  }
}

// 更新白名单
function updateStealWhitelist() {
  localConfig.value.stealWhitelist = stealWhitelistInput.value
    .split(/[,，]/)
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n));
}

function updateHelpWaterWhitelist() {
  localConfig.value.helpWaterWhitelist = helpWaterWhitelistInput.value
    .split(/[,，]/)
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n));
}

function updateHelpWeedWhitelist() {
  localConfig.value.helpWeedWhitelist = helpWeedWhitelistInput.value
    .split(/[,，]/)
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n));
}

function updateHelpBugWhitelist() {
  localConfig.value.helpBugWhitelist = helpBugWhitelistInput.value
    .split(/[,，]/)
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n));
}

function updatePutBugWhitelist() {
  localConfig.value.putBugWhitelist = putBugWhitelistInput.value
    .split(/[,，]/)
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n));
}

function updatePutWeedWhitelist() {
  localConfig.value.putWeedWhitelist = putWeedWhitelistInput.value
    .split(/[,，]/)
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n));
}

function updateFixedFriendIds() {
  localConfig.value.fixedFriendIds = fixedFriendIdsInput.value
    .split(/[,，]/)
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n));
}

// 标记是否有未保存的本地修改
const hasLocalChanges = ref(false);

// 更新本地配置的函数
function updateLocalConfig() {
  // 如果有未保存的本地修改，不覆盖本地配置
  if (hasLocalChanges.value) {
    return;
  }

  localConfig.value = {
    ...props.account.config,
    autoSell: props.account.config?.autoSell === true,
    autoWeed: props.account.config?.autoWeed !== false,
    autoBug: props.account.config?.autoBug !== false,
    autoWater: props.account.config?.autoWater !== false,
    enableFriendCheck: props.account.config?.enableFriendCheck !== false,
    enableSteal: props.account.config?.enableSteal !== false,
    enableHelpWater: props.account.config?.enableHelpWater !== false,
    enableHelpWeed: props.account.config?.enableHelpWeed !== false,
    enableHelpBug: props.account.config?.enableHelpBug !== false,
    helpOnlyWithExp: props.account.config?.helpOnlyWithExp !== false,
    enablePutBug: props.account.config?.enablePutBug === true,
    enablePutWeed: props.account.config?.enablePutWeed === true,
    enableSmartPlant: props.account.config?.enableSmartPlant !== false,
    skipWhiteRadish: props.account.config?.skipWhiteRadish === true,
    skipCrops: props.account.config?.skipCrops || [],
    autoUnlockLand: props.account.config?.autoUnlockLand === true,
    autoUpgradeLand: props.account.config?.autoUpgradeLand === true,
    autoClaimEmail: props.account.config?.autoClaimEmail !== false,
    autoClaimIllustrated: props.account.config?.autoClaimIllustrated !== false,
    autoClaimFreeGifts: props.account.config?.autoClaimFreeGifts !== false,
    autoClaimVip: props.account.config?.autoClaimVip !== false,
    autoShare: props.account.config?.autoShare !== false,
    autoClaimMonthCard: props.account.config?.autoClaimMonthCard !== false,
    autoClaimOpenServer: props.account.config?.autoClaimOpenServer !== false,
    autoRefillNormalFertilizer: props.account.config?.autoRefillNormalFertilizer === true,
    autoRefillOrganicFertilizer: props.account.config?.autoRefillOrganicFertilizer === true,
    fertilizerRefillThreshold: props.account.config?.fertilizerRefillThreshold || 100,
    stealWhitelist: props.account.config?.stealWhitelist || [],
    helpWaterWhitelist: props.account.config?.helpWaterWhitelist || [],
    helpWeedWhitelist: props.account.config?.helpWeedWhitelist || [],
    helpBugWhitelist: props.account.config?.helpBugWhitelist || [],
    putBugWhitelist: props.account.config?.putBugWhitelist || [],
    putWeedWhitelist: props.account.config?.putWeedWhitelist || [],
    enableRandomFriendInterval: props.account.config?.enableRandomFriendInterval === true,
    enableAntiSteal: props.account.config?.enableAntiSteal === true,
    antiStealAdvanceTime: props.account.config?.antiStealAdvanceTime || 30,
    useOrganicFertilizer: props.account.config?.useOrganicFertilizer === true,
    useBothFertilizers: props.account.config?.useBothFertilizers === true,
    useFixedFriendList: props.account.config?.useFixedFriendList === true,
    fixedFriendIds: props.account.config?.fixedFriendIds || [],
    plantIntervalMin: props.account.config?.plantIntervalMin || 100,
    plantIntervalMax: props.account.config?.plantIntervalMax || 1000,
    os: props.account.config?.os || 'iOS',
    deviceTemplate: props.account.config?.deviceTemplate || '',
    sysSoftware: props.account.config?.sysSoftware || '',
    network: props.account.config?.network || 'wifi',
    memory: props.account.config?.memory || '',
    deviceId: props.account.config?.deviceId || '',
    antiDetection: {
      enabled: props.account.config?.antiDetection?.enabled === true,
      humanMode: {
        intensity: props.account.config?.antiDetection?.humanMode?.intensity || 'medium'
      },
      protocol: {
        enableTlog: props.account.config?.antiDetection?.protocol?.enableTlog !== false,
        deviceProfile: props.account.config?.antiDetection?.protocol?.deviceProfile || 'auto'
      }
    },
  };
  localFarmInterval.value = props.account.farmInterval || 10;
  localFriendInterval.value = props.account.friendInterval || 10;
  stealWhitelistInput.value = props.account.config?.stealWhitelist?.join(', ') || '';
  helpWaterWhitelistInput.value = props.account.config?.helpWaterWhitelist?.join(', ') || '';
  helpWeedWhitelistInput.value = props.account.config?.helpWeedWhitelist?.join(', ') || '';
  helpBugWhitelistInput.value = props.account.config?.helpBugWhitelist?.join(', ') || '';
  putBugWhitelistInput.value = props.account.config?.putBugWhitelist?.join(', ') || '';
  putWeedWhitelistInput.value = props.account.config?.putWeedWhitelist?.join(', ') || '';
  fixedFriendIdsInput.value = props.account.config?.fixedFriendIds?.join(', ') || '';
}

// 监听账号ID变化，更新本地状态
watch(() => props.account.id, () => {
  // 切换账号时重置修改标记
  hasLocalChanges.value = false;
  updateLocalConfig();
}, { immediate: true });

// 监听本地配置变化，标记有未保存的修改
watch(() => localConfig.value, () => {
  hasLocalChanges.value = true;
}, { deep: true });

// 监听本地间隔变化
watch(() => localFarmInterval.value, () => {
  hasLocalChanges.value = true;
});
watch(() => localFriendInterval.value, () => {
  hasLocalChanges.value = true;
});

// 保存配置
function saveConfig() {
  emit('save-config', {
    config: localConfig.value,
    farmInterval: localFarmInterval.value,
    friendInterval: localFriendInterval.value
  });
  // 保存成功后重置修改标记
  hasLocalChanges.value = false;
}

// 组件挂载时加载植物和作物列表
onMounted(() => {
  loadPlants();
  loadCrops();
});

// 监听账号经验值变化，重新加载植物列表（等级可能变化）
watch(() => props.account.stats?.exp, () => {
  loadPlants();
});
</script>
