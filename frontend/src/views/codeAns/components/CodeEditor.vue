<script setup>
import { ref, watch, nextTick, onMounted } from 'vue';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';

const props = defineProps({
  file: Object,
  projectLoaded: Boolean
});

const codeBlock = ref(null);

// 高亮逻辑
const highlight = () => {
  nextTick(() => {
    if (codeBlock.value) {
      codeBlock.value.removeAttribute('data-highlighted');
      hljs.highlightElement(codeBlock.value);
    }
  });
};

// 监听文件变化
watch(() => props.file, () => {
  if (props.file) highlight();
}, { deep: true });

onMounted(() => {
  if (props.file) highlight();
});
</script>

<template>
  <div class="editor-wrapper">
    <!-- 顶部文件名面包屑 -->
    <div class="editor-breadcrumb" v-if="projectLoaded && file">
      <icon-code class="breadcrumb-icon" />
      <span class="file-name">{{ file.name }}</span>
      <span class="lang-badge">{{ file.language || 'text' }}</span>
    </div>

    <!-- 代码区域：使用 Flex 滚动方案修复显示和滚动问题 -->
    <div class="code-area-scroll" v-if="projectLoaded && file">
      <pre class="code-pre"><code ref="codeBlock" :class="'language-' + (file.language || 'plaintext')">{{ file.content }}</code></pre>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-editor">
      <a-empty>
        <template #image>
          <!-- 使用 Arco 图标 -->
          <icon-code-square style="font-size: 64px; color: #4e5969; opacity: 0.8" />
        </template>
        <template #description>
          <span style="color: #86909c">请在左侧选择代码文件以开始</span>
        </template>
      </a-empty>
    </div>
  </div>
</template>

<style scoped>
.editor-wrapper {
  background-color: var(--code-content-bg, #1e1e1e);
  height: 100%;
  /* 修复核心：显式声明 Flex 布局，确保子元素能够填充和滚动 */
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 防止 wrapper 本身出现滚动条 */
}

.editor-breadcrumb {
  height: 40px;
  background-color: var(--code-header-bg, #252526);
  border-bottom: 1px solid var(--code-border, #1e1e1e);
  display: flex;
  align-items: center;
  padding: 0 16px;
  font-size: 13px;
  color: var(--code-text, #e5e6eb);
  flex-shrink: 0; /* 防止面包屑被压缩 */
}

.breadcrumb-icon {
  margin-right: 8px;
  color: #86909c;
  font-size: 16px;
}

.file-name {
  font-weight: 500;
}

.lang-badge {
  font-size: 10px;
  background-color: #333;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 8px;
  color: #86909c;
  text-transform: uppercase;
}

/* 核心修复：更稳健的 Flex 滚动布局 */
.code-area-scroll {
  flex: 1; /* 占据剩余空间 */
  min-height: 0; /* 关键：允许 flex 子项收缩，触发内部滚动 */
  overflow: auto; /* 开启滚动条（x轴和y轴） */
  position: relative;
  background-color: var(--code-content-bg, #1e1e1e);
}

.code-pre {
  margin: 0;
  padding: 20px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 14px;
  line-height: 1.6;
  tab-size: 4;
  /* 移除 min-height: 100%，避免某些情况下导致双重滚动条，由 code-area-scroll 处理背景 */
  box-sizing: border-box;
}

/* 确保 Highlight.js 的背景色与编辑器融合或覆盖 */
.code-pre code.hljs {
  background: transparent; /* 让背景色透出，避免色差 */
  padding: 0; /* 移除 hljs 默认 padding，由 pre 控制 */
  overflow-x: visible; /* 让 pre 处理滚动 */
}

.empty-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: var(--code-content-bg, #1e1e1e);
  color: #86909c;
}

/* 滚动条样式优化 */
.code-area-scroll::-webkit-scrollbar { width: 12px; height: 12px; }
.code-area-scroll::-webkit-scrollbar-track { background: var(--code-content-bg, #1e1e1e); }
.code-area-scroll::-webkit-scrollbar-thumb { background: #424242; border-radius: 6px; border: 3px solid var(--code-content-bg, #1e1e1e); }
.code-area-scroll::-webkit-scrollbar-thumb:hover { background: #4f4f4f; }
</style>