<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useSettingsStore } from '@/store/settingsStore';
import { fetchModels, DEFAULT_MODELS, type ModelOption } from '@/utils/modelApi';
import { getProviderIcon, getProviderColor } from '@/utils/providerIcons';
import { settingsApi } from '@/api';
import { Message } from '@arco-design/web-vue';

const props = defineProps({
  visible: Boolean
});

const emit = defineEmits(['update:visible', 'saved']);

const settingsStore = useSettingsStore();

// 本地表单状态
const formData = ref({
  apiKey: '',
  apiUrl: '',
  model: ''
});


// 模型列表相关状态
const isLoadingModels = ref(false);
const dynamicModelOptions = ref<ModelOption[]>([]);
const fetchError = ref<string>('');
const isModelsFetched = ref(false);
const isSaving = ref(false);  // 保存状态

// 合并的模型选项列表
const modelOptions = computed(() => {
  if (dynamicModelOptions.value.length > 0) {
    // 使用动态获取的模型列表
    return dynamicModelOptions.value;
  }
  // 回退到默认列表
  return DEFAULT_MODELS;
});

// 模型来源提示文本
const modelSourceHint = computed(() => {
  if (isLoadingModels.value) {
    return '正在从 API 获取模型列表...';
  }
  if (fetchError.value) {
    return `获取失败: ${fetchError.value}`;
  }
  if (isModelsFetched.value && dynamicModelOptions.value.length > 0) {
    return `已从 API 获取 ${dynamicModelOptions.value.length} 个模型`;
  }
  return '使用默认模型列表';
});

// 防抖定时器
let debounceTimer: number | null = null;

// 获取模型列表
const loadModels = async () => {
  const { apiUrl, apiKey } = formData.value;
  
  // 清空之前的状态
  fetchError.value = '';
  
  if (!apiUrl || !apiKey) {
    dynamicModelOptions.value = [];
    isModelsFetched.value = false;
    return;
  }
  
  isLoadingModels.value = true;
  
  try {
    const models = await fetchModels(apiUrl, apiKey);
    dynamicModelOptions.value = models;
    isModelsFetched.value = true;
    
    // 如果当前选中的模型不在新列表中，清空选择
    if (formData.value.model && !models.find(m => m.value === formData.value.model)) {
      formData.value.model = '';
    }
  } catch (error) {
    console.error('获取模型列表失败:', error);
    fetchError.value = error instanceof Error ? error.message : '未知错误';
    dynamicModelOptions.value = [];
    isModelsFetched.value = false;
  } finally {
    isLoadingModels.value = false;
  }
};

// 监听 URL 和 API Key 变化，自动获取模型列表
watch([() => formData.value.apiUrl, () => formData.value.apiKey], () => {
  // 清除之前的定时器
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  
  // 使用防抖，避免频繁请求
  debounceTimer = window.setTimeout(() => {
    loadModels();
  }, 800); // 800ms 防抖延迟
});

// 监听 visible 变化，打开时加载当前设置
watch(() => props.visible, (newVal) => {
  if (newVal) {
    formData.value = { ...settingsStore.settings };
    // 重置状态
    dynamicModelOptions.value = [];
    isModelsFetched.value = false;
    fetchError.value = '';
    // 如果有 URL 和 Key，自动加载模型
    if (formData.value.apiUrl && formData.value.apiKey) {
      loadModels();
    }
  }
});

const handleSave = async () => {
  isSaving.value = true;
  
  try {
    // 1. 保存到后端数据库
    await settingsApi.update(formData.value);
    
    // 2. 更新本地 store（立即生效）
    settingsStore.updateSettings(formData.value);
    
    Message.success('设置已保存');
    emit('saved');
    handleClose();
  } catch (error: any) {
    console.error('Save settings error:', error);
    Message.error('保存失败: ' + (error.message || '未知错误'));
  } finally {
    isSaving.value = false;
  }
};

const handleClose = () => {
  emit('update:visible', false);
};

const handleReset = () => {
  settingsStore.resetSettings();
  formData.value = { ...settingsStore.settings };
};
</script>

<template>
  <a-modal
    :visible="visible"
    title="API 设置"
    @cancel="handleClose"
    :width="600"
    :footer="false"
  >
    <div class="settings-form">
      <a-form :model="formData" layout="vertical">
        
        <a-form-item required>
          <template #label>
            <span>API Key</span>
            <a-tooltip content="您的 API Key 将保存在本地浏览器中，不会上传到服务器">
              <icon-info-circle class="label-tip-icon" />
            </a-tooltip>
          </template>
          <a-input-password
            v-model="formData.apiKey"
            placeholder="请输入您的 API Key"
            allow-clear
            :visibility-toggle="true"
          >
            <template #prefix>
              <icon-lock />
            </template>
          </a-input-password>
        </a-form-item>

        <a-form-item required>
          <template #label>
            <span>API URL</span>
            <a-tooltip content="支持 OpenAI 兼容的 API 端点">
              <icon-info-circle class="label-tip-icon" />
            </a-tooltip>
          </template>
          <a-input
            v-model="formData.apiUrl"
            placeholder="https://api.deepseek.com/chat/completions"
            allow-clear
          >
            <template #prefix>
              <icon-link />
            </template>
          </a-input>
        </a-form-item>

        <a-form-item required>
          <template #label>
            <span>模型</span>
            <a-tooltip v-if="!isLoadingModels && formData.apiUrl && formData.apiKey" content="手动刷新模型列表">
              <icon-refresh 
                class="label-tip-icon refresh-icon" 
                @click="loadModels"
                :class="{ 'is-loading': isLoadingModels }"
              />
            </a-tooltip>
          </template>
          <a-select
            v-model="formData.model"
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
          <div v-if="modelSourceHint" class="form-hint" :class="{ 'hint-error': fetchError }">
            <icon-info-circle v-if="!fetchError && !isLoadingModels" />
            <icon-exclamation-circle v-if="fetchError" />
            <icon-loading v-if="isLoadingModels" />
            {{ modelSourceHint }}
          </div>
        </a-form-item>

      </a-form>

      <div class="form-actions">
        <a-space>
          <a-button @click="handleReset" type="outline">
            <template #icon><icon-refresh /></template>
            重置为默认
          </a-button>
          <a-button @click="handleClose">取消</a-button>
          <a-button type="primary" @click="handleSave" :loading="isSaving">
            <template #icon><icon-check /></template>
            保存设置
          </a-button>
        </a-space>
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
.settings-form {
  padding: 8px 0;
}

.form-hint {
  font-size: 12px;
  color: var(--color-text-3);
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  line-height: 1.5;
  width: 100%;
  clear: both;
}

.form-hint :deep(.arco-icon) {
  font-size: 14px;
}

.form-actions {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border-2);
  display: flex;
  justify-content: flex-end;
}

:deep(.arco-form-item-label-col) {
  font-weight: 500;
}

:deep(.arco-input-wrapper),
:deep(.arco-select-view) {
  background-color: var(--color-fill-2);
}

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
  color: rgb(var(--primary-6));
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

.hint-error {
  color: rgb(var(--danger-6));
}

.hint-error :deep(.arco-icon) {
  color: rgb(var(--danger-6));
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
</style>
