<template>
  <transition name="tooltip-fade">
    <div v-if="visible" class="api-key-guide-tooltip" :data-ball-side="ballSide || 'right'">
      <div class="tooltip-arrow"></div>
      <div class="tooltip-content">
        <div class="tooltip-header">
          <span class="tooltip-icon">💡</span>
          <h4>欢迎使用 Nano Studio！</h4>
          <button class="close-btn" @click="$emit('dismiss', true)">
            <icon-close :size="14" />
          </button>
        </div>
        <p class="tooltip-message">
          检测到您还未配置 <strong>API Key</strong>，这是使用智能功能的必要步骤。
        </p>
        <div class="tooltip-actions">
          <a-button type="primary" size="small" @click="goToSettings">
            <template #icon>
              <icon-settings />
            </template>
            前往配置
          </a-button>
          <a-button size="small" @click="$emit('dismiss', false)">
            稍后再说
          </a-button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { IconClose, IconSettings } from '@arco-design/web-vue/es/icon';
import { useRouter } from 'vue-router';

defineProps<{
  visible: boolean;
  ballSide?: 'left' | 'right'; // 看板娘在左边还是右边
}>();

const emit = defineEmits<{
  dismiss: [permanent: boolean];
}>();

const router = useRouter();

const goToSettings = () => {
  // 只是临时隐藏，不永久关闭
  // 如果用户配置了API Key，下次检查会自动不显示
  emit('dismiss', false);
  router.push('/profile?tab=settings');
};
</script>

<style scoped>
.api-key-guide-tooltip {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 260px;
  background: linear-gradient(135deg, 
    var(--tooltip-gradient-start, #667eea) 0%, 
    var(--tooltip-gradient-end, #764ba2) 100%);
  border-radius: 12px;
  padding: 2px;
  z-index: 1001;
  animation: bounce 2s ease-in-out infinite;
}

/* 右侧：气泡在左边 */
.api-key-guide-tooltip {
  left: -280px;
}

/* 左侧：气泡在右边 */
.api-key-guide-tooltip[data-ball-side="left"] {
  left: auto;
  right: -280px;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(-50%) translateX(0);
  }
  50% {
    transform: translateY(-50%) translateX(-5px);
  }
}

.tooltip-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 0;
  height: 0;
}

/* 右侧：箭头在右边指向看板娘 */
.tooltip-arrow {
  right: -8px;
  border-left: 10px solid var(--tooltip-gradient-start, #667eea);
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
}

/* 左侧：箭头在左边指向看板娘 */
[data-ball-side="left"] .tooltip-arrow {
  left: -8px;
  right: auto;
  border-left: none;
  border-right: 10px solid var(--tooltip-gradient-start, #667eea);
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
}

.tooltip-content {
  background: var(--tooltip-bg, white);
  border-radius: 10px;
  padding: 16px;
}

.tooltip-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.tooltip-icon {
  font-size: 20px;
}

.tooltip-header h4 {
  flex: 1;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--tooltip-title-color, #1d2129);
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--tooltip-close-color, #86909c);
  transition: color 0.2s;
}

.close-btn:hover {
  color: var(--tooltip-close-hover, #1d2129);
}

.tooltip-message {
  font-size: 13px;
  line-height: 1.6;
  color: var(--tooltip-text-color, #4e5969);
  margin: 0 0 16px 0;
}

.tooltip-message strong {
  color: var(--tooltip-highlight, #667eea);
  font-weight: 600;
}

.tooltip-actions {
  display: flex;
  gap: 8px;
}

/* 暗色模式适配 */
:global(body.dark-theme) .api-key-guide-tooltip {
  --tooltip-gradient-start: #4a5fc1;
  --tooltip-gradient-end: #5a3a7a;
  --tooltip-bg: #2a2a2b;
  --tooltip-title-color: #f5f5f5;
  --tooltip-close-color: #c9cdd4;
  --tooltip-close-hover: #f5f5f5;
  --tooltip-text-color: #c9cdd4;
  --tooltip-highlight: #7b9eff;
}

/* 过渡动画 */
.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: all 0.3s ease;
}

.tooltip-fade-enter-from {
  opacity: 0;
  transform: translateY(-50%) translateX(10px);
}

.tooltip-fade-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(10px);
}

/* 响应式 */
@media (max-width: 768px) {
  .api-key-guide-tooltip {
    left: auto;
    right: 60px;
    width: 240px;
  }
  
  .tooltip-arrow {
    right: auto;
    left: -8px;
    border-left: none;
    border-right: 10px solid #667eea;
  }
}
</style>
