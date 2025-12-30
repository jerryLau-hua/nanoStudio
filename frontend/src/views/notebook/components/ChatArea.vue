<template>
  <div class="chat-container">
    <!-- 1. 欢迎/空状态 -->
    <div v-if="store.chatHistory.length === 0" class="welcome-screen">
      <div class="welcome-icon">✨</div>
      <h2>有什么可以帮你的吗？</h2>
      <p>选择左侧的来源，我会基于这些内容回答你的问题。</p>
      <div class="suggestions">
        <a-tag class="sug-tag" checkable @click="useSuggestion('总结一下这份文档')">总结一下这份文档</a-tag>
        <a-tag class="sug-tag" checkable @click="useSuggestion('列出关键日期')">列出关键日期</a-tag>
      </div>
    </div>

    <!-- 2. 消息列表 -->
    <div v-else class="messages" ref="msgContainer">
      <transition-group name="msg-slide" tag="div">
        <div
            v-for="(msg, index) in store.chatHistory"
            :key="msg.timestamp || index"
            :class="['msg-row', msg.role === 'user' ? 'msg-user' : 'msg-ai']"
        >
          <!-- 用户头像 -->
          <a-avatar v-if="msg.role === 'user'" :size="32" class="user-avatar">
            <icon-user />
          </a-avatar>
          
          <!-- AI头像 -->
          <a-avatar v-if="msg.role === 'ai'" :size="32" class="ai-avatar">
            <img alt="AI" src="@/assets/ai.png" />
          </a-avatar>

          <!-- 气泡内容 -->
          <div class="msg-content-wrapper">
            <div class="role-name" v-if="msg.role === 'ai'">Notebook AI</div>
            <!-- 流式中显示加载动画或内容 -->
            <div v-if="msg.isStreaming" class="msg-bubble streaming">
              <span v-if="!msg.content" class="typing-indicator">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
              </span>
              <span v-else>{{ msg.content }}</span>
            </div>
            <div v-else class="msg-bubble markdown-body" v-html="renderMarkdown(msg.content)"></div>
            <!-- 底部工具栏 -->
            <div v-if="!msg.isStreaming" class="msg-actions">
              <icon-copy class="action-icon" @click="copyText(msg.content)" />
              <icon-thumb-up v-if="msg.role === 'ai'" class="action-icon" />
            </div>
          </div>
        </div>
      </transition-group>
    </div>

    <!-- 3. 底部输入框区域 -->
    <div class="input-area">
      <!-- 停止生成按钮 (浮动) -->
      <transition name="fade">
        <div v-if="isStreaming" class="stop-btn-container">
          <a-button shape="round" size="small" @click="store.stopGeneration">
            <template #icon><icon-stop /></template>
            停止生成
          </a-button>
        </div>
      </transition>

      <div class="input-wrapper" :class="{ focused: isInputFocused }">
        <a-textarea
            v-model="inputText"
            placeholder="询问有关来源的问题..."
            :auto-size="{ minRows: 1, maxRows: 4 }"
            @keydown.enter.prevent="send"
            @focus="isInputFocused = true"
            @blur="isInputFocused = false"
            class="custom-textarea"
        />
        <div class="input-actions">
          <a-button
              type="primary"
              shape="circle"
              class="send-btn"
              :disabled="!inputText.trim() || isStreaming"
              @click="send"
          >
            <icon-send v-if="!isStreaming" />
            <icon-loading v-else />
          </a-button>
        </div>
      </div>
      <div class="input-tip">NotebookLM 可能会犯错，请检查重要信息。</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted, computed } from 'vue';
import { useNotebookStore } from '@/store/notebookStore';
import MarkdownIt from 'markdown-it';
import { IconSend, IconStop, IconLoading, IconCopy, IconThumbUp } from '@arco-design/web-vue/es/icon';
import { Message } from '@arco-design/web-vue';

const md = new MarkdownIt({ html: true, linkify: true });
const store = useNotebookStore();
const inputText = ref('');
const msgContainer = ref<HTMLElement | null>(null);
const isInputFocused = ref(false);

// 检测是否正在流式输出
const isStreaming = computed(() => store.chatHistory.some((m: any) => m.isStreaming));

// 检测是否有活跃的来源
const hasActiveSource = computed(() => {
  return store.sources.some((s: any) => s.isSelected && s.status === 'ready');
});

const renderMarkdown = (text: string) => {
  return md.render(text || ' ');
};

const send = () => {
  // 检查输入是否为空或正在流式输出
  if (!inputText.value.trim() || isStreaming.value) return;
  
  // 检查是否有选中的来源
  if (!hasActiveSource.value) {
    Message.warning('请先在左侧面板添加数据来源，并选择至少一个来源唔~');
    return;
  }
  
  store.sendMessage(inputText.value);
  inputText.value = '';
};

const useSuggestion = (text: string) => {
  // 检查是否有选中的来源
  if (!hasActiveSource.value) {
    Message.warning('请先在左侧面板添加数据来源，并选择至少一个来源唔~');
    return;
  }
  
  inputText.value = text;
  send();
};

const copyText = (text: string) => {
  navigator.clipboard.writeText(text);
  Message.success('已复制');
};

const scrollToBottom = () => {
  nextTick(() => {
    if (msgContainer.value) {
      msgContainer.value.scrollTop = msgContainer.value.scrollHeight;
    }
  });
};

// 监听消息列表变化
watch(() => store.chatHistory.length, scrollToBottom);
// 监听流式内容变化 (使用 throttle 或仅在 streaming 时稍微不那么频繁滚动更好，这里简化)
watch(() => store.chatHistory[store.chatHistory.length - 1]?.content, () => {
  if (msgContainer.value) {
    // 只有当用户已经在底部附近时才自动滚动，防止干扰阅读历史
    const isNearBottom = msgContainer.value.scrollHeight - msgContainer.value.scrollTop - msgContainer.value.clientHeight < 100;
    if (isNearBottom) scrollToBottom();
  }
});

onMounted(scrollToBottom);
</script>

<style scoped>
.chat-container { 
  display: flex; 
  flex-direction: column; 
  height: 100%; 
  position: relative; 
  background: var(--nb-content-bg, #fff); 
}

.welcome-screen { 
  flex: 1; 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  justify-content: center; 
  color: var(--nb-text-color, #1d2129); 
  padding-bottom: 40px;
}
.welcome-icon { font-size: 48px; margin-bottom: 16px; animation: bounce 2s infinite; }
.welcome-screen h2 { font-weight: 500; margin-bottom: 8px; }
.welcome-screen p { color: var(--nb-text-disabled, #86909c); margin-bottom: 24px; }
.suggestions { display: flex; gap: 12px; }
.sug-tag { 
  cursor: pointer; 
  padding: 18px 16px; 
  border-radius: 20px; 
  border: 1px solid var(--nb-border-color, #e5e6eb); 
  background: var(--nb-card-bg, white); 
  transition: all 0.2s; 
  font-size: 14px;
}
.sug-tag:hover { border-color: #165DFF; color: #165DFF; background: #f0f6ff; }

@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }

.messages { flex: 1; overflow-y: auto; padding: 20px 40px; scroll-behavior: smooth; }
.msg-row { display: flex; gap: 12px; margin-bottom: 24px; max-width: 900px; margin-left: auto; margin-right: auto; }
.msg-user { flex-direction: row-reverse; }

.ai-avatar { 
  background: var(--nb-card-bg, white); 
  border: 1px solid var(--nb-border-color, #e5e6eb); 
  flex-shrink: 0; 
}
.user-avatar {
  flex-shrink: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}
.msg-content-wrapper { display: flex; flex-direction: column; max-width: 80%; }
.role-name { font-size: 12px; color: var(--nb-text-disabled, #86909c); margin-bottom: 4px; }

.msg-bubble {
  max-width: 600px;
  color: var(--nb-text-color, #1d2129);
  font-size: 15px;
  line-height: 1.7;
  overflow-wrap: break-word;
}
.msg-user .msg-bubble {
  background: var(--nb-user-bubble-bg, #e8f3ff);
  padding: 6px 10px;
  border-radius: 12px 2px 12px 12px;
}
.msg-ai .msg-bubble {
  padding: 6px 10px;
}

/* 流式显示纯文本样式 */
.msg-bubble.streaming {
  white-space: pre-wrap;
  font-family: inherit;
}

/* 打字动画 */
.typing-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.typing-indicator .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--nb-text-disabled, #86909c);
  animation: typing 1.4s infinite;
}

.typing-indicator .dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator .dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-10px);
  }
}

.msg-actions { 
  margin-top: 8px; 
  display: flex; 
  gap: 12px; 
}
.action-icon { 
  color: var(--nb-text-disabled, #86909c); 
  cursor: pointer; 
  font-size: 14px; 
  transition: color 0.2s;
}
.action-icon:hover { 
  color: var(--nb-text-secondary, #4e5969); 
}

.input-area { 
  padding: 8px 40px 10px;  /* 进一步减小 padding */
  background: var(--nb-content-bg, white); 
  z-index: 10; 
  position: relative; 
  max-width: 900px;
  margin: 0 auto; 
  width: 100%; 
  box-sizing: border-box;
}
.stop-btn-container { position: absolute; top: -40px; left: 50%; transform: translateX(-50%); z-index: 20; }

.input-wrapper {
  display: flex; 
  align-items: center;  /* 改为 center，让按钮和输入框垂直居中 */
  gap: 6px;  /* 减小间距 */
  background: var(--nb-input-bg, #f2f3f5); 
  border-radius: 10px;  /* 进一步减小圆角 */
  padding: 4px 8px;  /* 进一步减小 padding */
  border: 1px solid transparent;
  transition: all 0.3s;
  min-height: 36px;  /* 设置最小高度 */
}
.input-wrapper.focused { 
  background: var(--nb-input-focus-bg, #fff); 
  border-color: #165DFF; 
  box-shadow: 0 0 0 2px rgba(22,93,255,0.1); 
}

.custom-textarea { 
  background: transparent !important; 
  border: none !important; 
  padding: 2px 4px !important;  /* 进一步减小 padding */
  font-size: 14px;
  line-height: 1.4;  /* 减小行高 */
}
:deep(.arco-textarea-wrapper) { 
  background: transparent; 
  padding: 0; 
}
:deep(.arco-textarea) {
  min-height: 20px !important;  /* 设置最小高度 */
}

.send-btn { 
  transition: all 0.2s; 
  width: 28px;  /* 进一步减小按钮尺寸 */
  height: 28px;
  flex-shrink: 0;  /* 防止按钮被压缩 */
}
.input-tip { 
  text-align: center; 
  color: var(--nb-text-disabled, #86909c); 
  font-size: 10px;  /* 进一步减小字体 */
  margin-top: 4px;  /* 进一步减小间距 */
  line-height: 1.2;  /* 减小行高 */
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ===== 消息滑入动画 ===== */
.msg-slide-enter-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.msg-slide-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

/* 用户消息从右侧进入 */
.msg-user.msg-slide-enter-from {
  transform: translateX(20px);
}

/* AI消息从左侧进入 */
.msg-ai.msg-slide-enter-from {
  transform: translateX(-20px);
}

/* ===== 欢迎屏幕动画 ===== */
.welcome-screen {
  animation: welcomeFadeIn 0.6s ease forwards;
}

@keyframes welcomeFadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ===== 建议标签悬停效果 ===== */
.sug-tag {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

.sug-tag:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(22, 93, 255, 0.15);
}

/* ===== 发送按钮动画 ===== */
.send-btn {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

.send-btn:not(:disabled):hover {
  transform: scale(1.1);
}

.send-btn:not(:disabled):active {
  transform: scale(0.95);
}

/* 暗色主题直接覆盖 */
:global(body.dark-theme) .chat-container {
  background: #1e1e1e !important;
}

:global(body.dark-theme) .welcome-screen {
  color: #f5f5f5 !important;
}

:global(body.dark-theme) .welcome-screen p {
  color: #86909c !important;
}

:global(body.dark-theme) .sug-tag {
  background: #2a2a2b !important;
  border-color: #3a3a3c !important;
  color: #c9cdd4 !important;
}

:global(body.dark-theme) .ai-avatar {
  background: #2a2a2b !important;
  border-color: #3a3a3c !important;
}

:global(body.dark-theme) .msg-bubble {
  color: #f5f5f5 !important;
}

:global(body.dark-theme) .msg-user .msg-bubble {
  background: #1e3a5f !important;
}

:global(body.dark-theme) .input-area {
  background: #1e1e1e !important;
}

:global(body.dark-theme) .input-wrapper {
  background: #3a3a3c !important;
}

:global(body.dark-theme) .input-wrapper.focused {
  background: #2a2a2b !important;
}

/* 暗色主题：顶部和底部边框改为黑色 */
:global(body.dark-theme) .chat-main {
  border-top: 1px solid #000 !important;
  border-bottom: 1px solid #000 !important;
}
</style>