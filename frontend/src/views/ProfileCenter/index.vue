<template>
  <div class="profile-container">
    <div class="profile-header">
      <a-button type="text" class="back-btn" @click="goBack">
        <icon-arrow-left />
        返回首页
      </a-button>
    </div>

    <div class="profile-content">
      <!-- 用户信息卡片 -->
      <a-card class="profile-card" title="个人信息">
        <div class="user-info">
          <a-avatar :size="80" class="user-avatar-large">
            <icon-user />
          </a-avatar>
          <div class="user-details">
            <h2>{{ user?.username || '用户' }}</h2>
            <p>{{ user?.email || 'user@example.com' }}</p>
          </div>
        </div>
      </a-card>

      <!-- 签到卡片 -->
      <a-card class="check-in-card" title="每日签到">
        <div class="check-in-section">
          <div class="check-in-stats">
            <div class="stat-item">
              <div class="stat-value">{{ checkInStreak }}</div>
              <div class="stat-label">连续签到</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ totalCheckIns }}</div>
              <div class="stat-label">累计签到</div>
            </div>
          </div>
          <a-button 
            type="primary" 
            size="large"
            @click="handleCheckIn" 
            :disabled="hasCheckedInToday"
            :loading="isCheckingIn"
            class="check-in-btn"
          >
            {{ hasCheckedInToday ? '今日已签到 ✓' : '点击签到' }}
          </a-button>
          <p class="last-check-in" v-if="lastCheckInDate">
            上次签到: {{ formatDate(lastCheckInDate) }}
          </p>
        </div>
      </a-card>

      <!-- 个人资料编辑 -->
      <a-card class="edit-card" title="编辑资料">
        <a-form :model="form" layout="vertical">
          <a-form-item label="用户名">
            <a-input v-model="form.username" placeholder="请输入用户名" />
          </a-form-item>
          <a-form-item label="邮箱">
            <a-input v-model="form.email" placeholder="请输入邮箱" disabled />
          </a-form-item>
          <a-form-item>
            <a-button type="primary" @click="handleSaveProfile" :loading="isSaving">
              保存修改
            </a-button>
          </a-form-item>
        </a-form>
      </a-card>

      <!-- 系统设置 -->
      <a-card class="settings-card" title="系统配置">
        <a-form :model="settings" layout="vertical">
          <a-form-item label="API Key" required>
            <a-input-password v-model="settings.apiKey" placeholder="请输入API Key">
              <template #prefix>
                <icon-lock />
              </template>
            </a-input-password>
          </a-form-item>
          <a-form-item label="API URL" required>
            <a-input v-model="settings.apiUrl" placeholder="https://api.openai.com/v1">
              <template #prefix>
                <icon-link />
              </template>
            </a-input>
          </a-form-item>
          <a-form-item required>
            <template #label>
              <span>模型</span>
              <a-tooltip v-if="!isLoadingModels && settings.apiUrl && settings.apiKey" content="手动刷新模型列表">
                <icon-refresh 
                  class="label-tip-icon refresh-icon" 
                  @click="loadModels"
                  :class="{ 'is-loading': isLoadingModels }"
                />
              </a-tooltip>
            </template>
            <a-select
              v-model="settings.model"
              placeholder="选择模型"
              allow-clear
              allow-search
              :loading="isLoadingModels"
            >
              <a-option
                v-for="option in modelOptions"
                :key="option.value"
                :value="option.value"
                :label="option.label"
              >
                <div class="model-option">
                  <component 
                    :is="getProviderIcon(option.ownedBy)" 
                    class="model-icon"
                    :style="{ color: getProviderColor(option.ownedBy) }"
                  />
                  <span>{{ option.label }}</span>
                </div>
              </a-option>
            </a-select>
            <div v-if="isLoadingModels || fetchError || isModelsFetched" class="form-hint" :class="{ 'hint-error': fetchError }">
              <icon-info-circle v-if="!fetchError && !isLoadingModels && isModelsFetched" />
              <icon-exclamation-circle v-if="fetchError" />
              <icon-loading v-if="isLoadingModels" />
              <span v-if="isLoadingModels">正在从 API 获取模型列表...</span>
              <span v-else-if="fetchError">获取失败: {{ fetchError }}</span>
              <span v-else-if="isModelsFetched">已从 API 获取 {{ dynamicModelOptions.length }} 个模型</span>
            </div>
          </a-form-item>
          <a-form-item>
            <a-button type="primary" @click="handleSaveSettings" :loading="isSavingSettings">
              保存设置
            </a-button>
          </a-form-item>
        </a-form>
      </a-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { IconUser, IconArrowLeft, IconLock, IconLink, IconRefresh, IconInfoCircle, IconExclamationCircle, IconLoading } from '@arco-design/web-vue/es/icon';
import { Message } from '@arco-design/web-vue';
import { authApi } from '@/api/auth';
import { settingsApi } from '@/api/settings';
import { userApi } from '@/api/user';
import { useSettingsStore } from '@/store/settingsStore';
import { fetchModels, DEFAULT_MODELS, type ModelOption } from '@/utils/modelApi';
import { getProviderIcon, getProviderColor } from '@/utils/providerIcons';

const router = useRouter();
const settingsStore = useSettingsStore();

// 立即初始化所有状态
const user = ref<any>(authApi.getCurrentUser() || { username:  '', email: '' });
const checkInStreak = ref(0);
const totalCheckIns = ref(0);
const hasCheckedInToday = ref(false);
const lastCheckInDate = ref<string>('');
const isCheckingIn = ref(false);
const isSaving = ref(false);
const isSavingSettings = ref(false);

const form = ref({
  username: user.value?.username || '',
  email: user.value?.email || ''
});

const settings = ref({
  apiKey: '',
  apiUrl: 'https://api.openai.com/v1',
  model: 'gpt-3.5-turbo'
});

// 模型列表相关状态
const isLoadingModels = ref(false);
const dynamicModelOptions = ref<ModelOption[]>([]);
const fetchError = ref<string>('');
const isModelsFetched = ref(false);

// 合并的模型选项列表
const modelOptions = ref<ModelOption[]>(DEFAULT_MODELS);

// 防抖定时器
let debounceTimer: number | null = null;

onMounted(async () => {
  console.log('[ProfileCenter] Component mounted');
  console.log('[ProfileCenter] User:', user.value);
  
  // 加载系统设置（优先从后端加载）
  try {
    const backendSettings = await settingsApi.get();
    if (backendSettings) {
      settings.value = { ...settings.value, ...backendSettings };
      
      // 如果有配置，自动加载模型
      if (settings.value.apiUrl && settings.value.apiKey) {
        loadModels();
      }
    }
  } catch (error) {
    console.error('Failed to load settings from backend:', error);
    //  回退到 localStorage
    const savedSettings = localStorage.getItem('llm_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        settings.value = { ...settings.value, ...parsed };
        
        // 如果有配置，自动加载模型
        if (settings.value.apiUrl && settings.value.apiKey) {
          loadModels();
        }
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
  }
  
  // 加载签到统计
  try {
    const stats = await userApi.getCheckInStats();
    checkInStreak.value = stats.checkInStreak;
    totalCheckIns.value = stats.totalCheckIns;
    hasCheckedInToday.value = stats.hasCheckedInToday;
    if (stats.lastCheckInDate) {
      lastCheckInDate.value = stats.lastCheckInDate;
    }
  } catch (error) {
    console.error('Failed to load check-in stats:', error);
  }
});

// 获取模型列表
const loadModels = async () => {
  const { apiUrl, apiKey } = settings.value;
  
  // 清空之前的状态
  fetchError.value = '';
  
  if (!apiUrl || !apiKey) {
    dynamicModelOptions.value = [];
    isModelsFetched.value = false;
    modelOptions.value = DEFAULT_MODELS;
    return;
  }
  
  isLoadingModels.value = true;
  
  try {
    const models = await fetchModels(apiUrl, apiKey);
    dynamicModelOptions.value = models;
    modelOptions.value = models;
    isModelsFetched.value = true;
    
    // 如果当前选中的模型不在新列表中，清空选择
    if (settings.value.model && !models.find(m => m.value === settings.value.model)) {
      settings.value.model = '';
    }
  } catch (error) {
    console.error('获取模型列表失败:', error);
    fetchError.value = error instanceof Error ? error.message : '未知错误';
    dynamicModelOptions.value = [];
    modelOptions.value = DEFAULT_MODELS;
    isModelsFetched.value = false;
  } finally {
    isLoadingModels.value = false;
  }
};

// 监听 URL 和 API Key 变化，自动获取模型列表
watch([() => settings.value.apiUrl, () => settings.value.apiKey], () => {
  // 清除之前的定时器
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  
  // 使用防抖，避免频繁请求
  debounceTimer = window.setTimeout(() => {
    loadModels();
  }, 800); // 800ms 防抖延迟
});

const handleSaveSettings = async () => {
  if (!settings.value.apiKey.trim() || !settings.value.apiUrl.trim()) {
    Message.warning('请填写完整的设置信息');
    return;
  }
  
  isSavingSettings.value = true;
  try {
    // 1. 保存到后端数据库
    await settingsApi.update(settings.value);
    
    // 2. 更新本地 store（立即生效）
    settingsStore.updateSettings(settings.value);
    
    // 3. 也同步保存到 localStorage 作为备份
    localStorage.setItem('llm_settings', JSON.stringify(settings.value));
    
    Message.success('设置已保存');
  } catch (error: any) {
    console.error('Save settings error:', error);
    Message.error('保存失败: ' + (error.message || '未知错误'));
  } finally {
    isSavingSettings.value = false;
  }
};

const goBack = () => {
  router.push('/');
};

const handleCheckIn = async () => {
  isCheckingIn.value = true;
  try {
    const result = await userApi.checkIn();
    
    // 更新统计数据
    checkInStreak.value = result.stats.checkInStreak;
    totalCheckIns.value = result.stats.totalCheckIns;
    hasCheckedInToday.value = result.stats.hasCheckedInToday;
    if (result.stats.lastCheckInDate) {
      lastCheckInDate.value = result.stats.lastCheckInDate;
    }
    
    Message.success('签到成功！');
  } catch (error: any) {
    Message.error(error.message || '签到失败');
  } finally {
    isCheckingIn.value = false;
  }
};

const handleSaveProfile = async () => {
  if (!form.value.username.trim()) {
    Message.warning('用户名不能为空');
    return;
  }
  
  isSaving.value = true;
  try {
    const updatedUser = await userApi.updateProfile({ username: form.value.username });
    
    // 更新本地用户信息缓存
    authApi.updateCurrentUser({ username: updatedUser.username });
    
    // 同步更新当前页面的user对象
    if (user.value) {
      user.value.username = updatedUser.username;
    }
    
    Message.success('保存成功');
  } catch (error: any) {
    Message.error(error.message || '保存失败');
  } finally {
    isSaving.value = false;
  }
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};
</script>

<style scoped>
.profile-container {
  height: 100vh;
  background: var(--color-bg-1);
  padding: 20px;
  overflow-y: auto;
  box-sizing: border-box;
}

.profile-header {
  max-width: 800px;
  margin: 0 auto 20px;
}

.back-btn {
  color: var(--color-text-2);
}

.profile-content {
  max-width: 1000px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  padding-bottom: 40px;
}

/* User info card - full width */
.profile-card {
  grid-column: 1 / -1;
  animation: fadeInUp 0.5s ease;
}

/* Check-in card - left half */
.check-in-card {
  grid-column: 1 / 2;
  animation: fadeInUp 0.6s ease;
}

/* Edit card - right half */
.edit-card {
  grid-column: 2 / 3;
  animation: fadeInUp 0.6s ease;
}

/* Settings card - full width at bottom */
.settings-card {
  grid-column: 1 / -1;
  animation: fadeInUp 0.7s ease;
}

/* Responsive: stack on smaller screens */
@media (max-width: 768px) {
  .profile-content {
    grid-template-columns: 1fr;
  }
  
  .check-in-card,
  .edit-card,
  .settings-card {
    grid-column: 1 / -1;
  }
}

.user-info {
  display: flex;
  align-items: center;
  gap: 20px;
}

.user-avatar-large {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 32px;
}

.user-details h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  color: var(--color-text-1);
}

.user-details p {
  margin: 0;
  color: var(--color-text-3);
  font-size: 14px;
}

.check-in-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.check-in-stats {
  display: flex;
  gap: 40px;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #165DFF;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: var(--color-text-3);
}

.check-in-btn {
  width: 200px;
  height: 44px;
  font-size: 16px;
  border-radius: 22px;
}

.last-check-in {
  margin: 0;
  color: var(--color-text-3);
  font-size: 12px;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* System settings styles */
.label-tip-icon {
  margin-left: 4px;
  font-size: 14px;
  color: var(--color-text-3);
  cursor: help;
  transition: color 0.2s;
}

.label-tip-icon:hover {
  color: var(--color-text-2);
}

.refresh-icon {
  cursor: pointer;
  transition: transform 0.3s, color 0.2s;
}

.refresh-icon:hover {
  color: #165DFF;
  transform: rotate(90deg);
}

.refresh-icon.is-loading {
  animation: rotate 1s linear infinite;
  pointer-events: none;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.model-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.form-hint {
  font-size: 12px;
  color: var(--color-text-3);
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  line-height: 1.5;
}

.hint-error {
  color: rgb(var(--danger-6));
}

.hint-error :deep(.arco-icon) {
  color: rgb(var(--danger-6));
}
</style>

