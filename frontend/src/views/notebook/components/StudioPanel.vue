<template>
  <div class="studio-panel">
    <!-- 1. 顶部工具栏 -->
    <div class="studio-header">
      <h3>Studio</h3>
      <!-- <a-tooltip content="收起面板">
        <a-button type="text" shape="circle" size="small" @click="emit('close')">
          <icon-menu-fold />
        </a-button>
      </a-tooltip> -->
    </div>

    <!-- 2. 上半部分：功能入口 + 历史列表 -->
    <div class="studio-list">
      <div class="card-grid">
        <!-- 核心功能卡片 -->
        <a-card class="feature-card gradient-purple" hoverable @click="handleGenerate('mindmap')">
          <div class="card-inner">
            <div class="card-icon"><icon-mind-mapping /></div>
            <div class="card-text">
              <div class="card-title">思维导图</div>
              <div class="card-desc">可视化知识结构</div>
            </div>
            <div class="card-arrow"><icon-right /></div>
          </div>
        </a-card>

        <a-card class="feature-card gradient-green" hoverable @click="handleGenerate('summary')">
          <div class="card-inner">
            <div class="card-icon"><icon-file /></div>
            <div class="card-text">
              <div class="card-title">重点简报</div>
              <div class="card-desc">快速生成文档摘要</div>
            </div>
            <div class="card-arrow"><icon-right /></div>
          </div>
        </a-card>

        <div class="list-header" v-if="store.notes.length > 0">
          <span>我的笔记</span>
          <span class="count">{{ store.notes.length }}</span>
        </div>

        <!-- 历史列表 -->
        <transition-group name="list">
          <div
              v-for="note in store.notes"
              :key="note.id"
              class="history-item"
              :class="{ 'active': activeNoteId === note.id }"
              @click="selectNote(note)"
          >
            <div class="history-icon" :class="note.type">
              <icon-mind-mapping v-if="note.type === 'mindmap'" />
              <icon-file v-else />
            </div>
            <div class="history-info">
              <div class="history-title text-truncate">{{ note.title }}</div>
              <div class="history-meta" v-if="note.status === 'generating'">
                <icon-loading spin /> 生成中...
              </div>
              <div class="history-meta" v-else>{{ formatTime(note.createdAt || Date.now()) }}</div>
            </div>
            <div class="history-actions" @click.stop>
              <a-popconfirm 
                  content="删除此笔记？" 
                  okText="删除"
                  cancelText="取消"
                  @ok="deleteNote(note.id)"
              >
                <div class="delete-btn"><icon-delete /></div>
              </a-popconfirm>
            </div>
          </div>
        </transition-group>
      </div>
    </div>

    <!-- 3. 预览窗口 (下半部分/全屏) -->
    <transition name="slide-up">
      <div
          class="preview-dock"
          :class="{ 'fullscreen-mode': isFullscreen }"
          v-if="currentNote"
      >
        <!-- 头部 -->
        <div class="dock-header">
          <div class="dock-title">
            <div class="dock-icon" :class="currentNote.type">
              <icon-mind-mapping v-if="currentNote.type === 'mindmap'" />
              <icon-file v-else />
            </div>
            {{ currentNote.title }}
          </div>
          <div class="dock-actions">
            <a-tooltip :content="isFullscreen ? '退出全屏' : '全屏查看'">
              <a-button type="text" shape="circle" size="small" @click="toggleFullscreen">
                <component :is="isFullscreen ? 'icon-fullscreen-exit' : 'icon-fullscreen'" />
              </a-button>
            </a-tooltip>
            <a-button v-if="!isFullscreen" type="text" shape="circle" size="small" @click="closePreview">
              <icon-close />
            </a-button>
          </div>
        </div>

        <!-- 内容区 -->
        <div class="dock-body" :class="{ 'no-padding': currentNote.type === 'mindmap' }">

          <!-- Loading -->
          <div v-if="currentNote.status === 'generating'" class="loading-state">
            <div class="ai-thinking">
              <icon-loading spin size="30" />
              <p>AI 正在阅读资料并整理思路...</p>
            </div>
          </div>

          <!-- 思维导图 -->
          <div v-else-if="currentNote.type === 'mindmap'" class="canvas-container" ref="canvasRef">
            <div class="canvas-toolbar">
              <a-button-group size="mini">
                <a-button @click="store.toggleAllNodes(currentNote.id, true)"><icon-expand /></a-button>
                <a-button @click="store.toggleAllNodes(currentNote.id, false)"><icon-shrink /></a-button>
                <a-button @click="resetView"><icon-refresh /></a-button>
              </a-button-group>
              <!-- 优化 1：下载按钮改为下载图片 -->
              <a-tooltip content="下载为图片">
                <a-button size="mini" class="dl-btn" @click="downloadMindMapAsImage(currentNote)">
                  <icon-download /> PNG
                </a-button>
              </a-tooltip>
            </div>

            <div
                class="infinite-canvas"
                :style="{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }"
                @mousedown="startDrag"
                @wheel.prevent="handleWheel"
            >
              <MindMapTree v-if="typeof currentNote.content === 'object'" :node="(currentNote.content as any)" />
            </div>
            <div class="zoom-indicator">{{ Math.round(scale * 100) }}%</div>
          </div>

          <!-- 文本简报：优化 2 -->
          <div v-else class="dock-text markdown-body" v-html="renderMarkdown(currentNote.content as string)">
          </div>
        </div>
      </div>
    </transition>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, defineComponent, h } from 'vue';
import { useNotebookStore, type NoteCard } from '@/store/notebookStore';
import MarkdownIt from 'markdown-it';
// 修复导入方式：使用 * as 语法以兼容不同的打包环境
import * as html2canvasPkg from 'html2canvas';
const html2canvas = (html2canvasPkg as any).default || html2canvasPkg;

import {
  IconMindMapping, IconFile, IconClose,
  IconDelete, IconExpand, IconShrink, IconDownload, IconRight, IconLoading, IconRefresh
} from '@arco-design/web-vue/es/icon';
import { Message } from '@arco-design/web-vue';

// --- Markdown 配置 ---
const md = new MarkdownIt({ html: true, linkify: true, breaks: true });
const renderMarkdown = (text: string) => {
  return md.render(text || '');
};

// --- 内部递归组件：MindMapTree ---
const MindMapTree = defineComponent({
  name: 'MindMapTree',
  props: ['node'],
  setup(props) {
    const toggle = () => {
      if (props.node.children && props.node.children.length) {
        props.node.collapsed = !props.node.collapsed;
      }
    };
    return () => {
      const { label, children, collapsed } = props.node;
      const hasChildren = children && children.length > 0;

      return h('div', { class: 'tree-node' }, [
        h('div', { class: 'node-content-wrapper' }, [
          h('div', {
            class: ['node-content', hasChildren ? 'has-child' : ''],
            onClick: toggle
          }, [
            label,
            hasChildren && h('span', { class: 'toggle-dot' }, collapsed ? '+' : '-')
          ])
        ]),
        !collapsed && hasChildren && h('div', { class: 'node-children' },
            children.map((child: any) => h(MindMapTree, { node: child, key: child.id }))
        )
      ]);
    };
  }
});

// --- 主逻辑 ---
const emit = defineEmits(['close']);
const store = useNotebookStore();

const activeNoteId = ref<string | null>(null);
const isFullscreen = ref(false);
const canvasRef = ref<HTMLElement | null>(null);

// 画布状态
const pan = ref({ x: 50, y: 50 });
const scale = ref(1);
const isDragging = ref(false);
const lastPos = { x: 0, y: 0 };

const currentNote = computed(() => store.notes.find((n: any) => n.id === activeNoteId.value) || null);

const formatTime = (date: string | number) => {
  // 如果是ISO字符串或时间戳，都能正确转换
  return new Date(date).toLocaleDateString();
};

const resetView = () => {
  pan.value = { x: 50, y: 50 };
  scale.value = 1;
};

watch(activeNoteId, resetView);

const selectNote = (note: NoteCard) => activeNoteId.value = note.id;
const deleteNote = async (id: string) => {
  if (activeNoteId.value === id) {
    activeNoteId.value = null;
    isFullscreen.value = false;
  }
  // 调用store的deleteNote方法，会同时删除后端数据
  await store.deleteNote(id);
  Message.success('笔记已删除');
};

const toggleFullscreen = () => isFullscreen.value = !isFullscreen.value;
const closePreview = () => { activeNoteId.value = null; isFullscreen.value = false; };

const handleGenerate = (type: 'mindmap' | 'summary') => {
  // 检查是否有选中的来源，提供即时反馈
  const hasActiveSources = store.sources.some((s: any) => s.isSelected && s.status === 'ready');
  
  if (!hasActiveSources) {
    Message.warning('请先在左侧面板选择至少一个来源');
  }
  
  store.generateArtifact(type);
  
  // 自动选中新生成的笔记
  if (store.notes.length > 0 && store.notes[0]) {
    activeNoteId.value = store.notes[0].id;
  }
};

// --- 画布交互 ---
const startDrag = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (target.closest('.node-content')) return;

  isDragging.value = true;
  lastPos.x = e.clientX;
  lastPos.y = e.clientY;
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);
};

const onDrag = (e: MouseEvent) => {
  if (!isDragging.value) return;
  pan.value.x += e.clientX - lastPos.x;
  pan.value.y += e.clientY - lastPos.y;
  lastPos.x = e.clientX;
  lastPos.y = e.clientY;
};

const stopDrag = () => {
  isDragging.value = false;
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
};

const handleWheel = (e: WheelEvent) => {
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  scale.value = Math.max(0.2, Math.min(3, scale.value * delta));
};

// --- 优化修复：下载思维导图为图片 (onclone 策略) ---
const downloadMindMapAsImage = async (note: NoteCard) => {
  if (!canvasRef.value) return;

  // 使用正确的 Message API
  Message.loading({
    content: '正在生成图片...',
    duration: 0
  });

  try {
    const element = canvasRef.value.querySelector('.infinite-canvas') as HTMLElement;
    if (!element) throw new Error("Canvas element not found");

    // 1. 获取真实内容的宽和高（scrollWidth 在缩放时也是基于 layout 的，通常是准确的）
    // 我们需要告诉 html2canvas 我们想截取多大的区域，否则它可能只截取可视区域
    const width = element.scrollWidth + 100; // 加一点 buffer
    const height = element.scrollHeight + 100;

    // 2. 调用 html2canvas
    // 关键改变：直接传递原始 element，不再手动 cloneNode
    const canvas = await html2canvas(element, {
      backgroundColor: '#f7f8fa',
      scale: 2, // 高清
      useCORS: true,
      allowTaint: true,

      // 显式指定尺寸，确保截取完整内容
      width: width,
      height: height,
      windowWidth: width,
      windowHeight: height,

      // 强制坐标从 0,0 开始，防止因为 translate 导致的偏移
      x: 0,
      y: 0,

      // --- 核心修复 ---
      // 使用 onclone 回调在 html2canvas 的虚拟文档中修改样式
      // 这样既不会影响用户界面，也不会导致手动 cloneNode 带来的上下文丢失错误
      onclone: (clonedDoc: Document) => {
        const clonedElement = clonedDoc.querySelector('.infinite-canvas') as HTMLElement;
        if (clonedElement) {
          // 移除 transform (缩放/平移)，让导出的图片是端正的 1:1 视图
          clonedElement.style.transform = 'none';
          clonedElement.style.margin = '20px'; // 增加一点边距
          // 确保内容完全展示
          clonedElement.style.width = 'fit-content';
          clonedElement.style.height = 'fit-content';
        }
      }
    });

    // 3. 下载
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${note.title || 'mindmap'}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Message.clear();
    Message.success('图片导出成功');

  } catch (error) {
    console.error("Export failed:", error);
    Message.clear();
    Message.error('图片导出失败，请检查控制台');
  }
};
</script>

<style scoped>
.studio-panel { 
  display: flex; 
  flex-direction: column; 
  height: 100%; 
  background: var(--nb-panel-bg-secondary, #f7f8fa); 
  position: relative; 
  border-left: 1px solid var(--nb-border-color, #e5e6eb); 
}
.studio-header { 
  padding: 16px 20px; 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  border-bottom: 1px solid var(--nb-border-color, #e5e6eb); 
  background: var(--nb-card-bg, #fff); 
  flex-shrink: 0; 
}
.studio-header h3 { 
  margin: 0; 
  font-size: 16px; 
  color: var(--nb-text-color, #1d2129); 
}

.studio-list { flex: 1; overflow-y: auto; padding: 20px; }
.card-grid { display: flex; flex-direction: column; gap: 12px; }

.feature-card { border-radius: 12px; cursor: pointer; border: none; overflow: hidden; transition: all 0.2s; height: 88px; position: relative;}
.feature-card:hover { transform: translateY(-3px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.card-inner { display: flex; align-items: center; gap: 16px; height: 100%; }
.card-icon { font-size: 24px; width: 48px; height: 48px; background: rgba(255,255,255,0.25); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white;}
.card-text { color: white; flex: 1; }
.card-title { font-weight: bold; font-size: 16px; margin-bottom: 4px; }
.card-desc { font-size: 12px; opacity: 0.9; }
.card-arrow { color: rgba(255,255,255,0.6); font-size: 16px; }

.gradient-purple { background: linear-gradient(135deg, #b37feb 0%, #722ed1 100%); }
.gradient-green { background: linear-gradient(135deg, #aff0b5 0%, #00b42a 100%); }

.list-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  font-size: 13px; 
  color: var(--nb-text-disabled, #86909c); 
  margin: 20px 0 10px; 
  font-weight: 500; 
}
.count { 
  background: var(--nb-tag-bg, #e5e6eb); 
  padding: 2px 8px; 
  border-radius: 10px; 
  font-size: 12px; 
}

.history-item { 
  display: flex; 
  align-items: center; 
  gap: 12px; 
  padding: 12px; 
  background: var(--nb-card-bg, white); 
  border-radius: 8px; 
  cursor: pointer; 
  transition: all 0.2s; 
  border: 1px solid transparent; 
}
.history-item:hover { 
  background: var(--nb-card-bg, #fff); 
  box-shadow: 0 4px 10px rgba(0,0,0,0.05); 
}
.history-item.active { border-color: #165DFF; background: #f0f6ff; }

.history-icon { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 18px; }
.history-icon.mindmap { background: #f4e8ff; color: #722ED1; }
.history-icon.summary { background: #e8ffea; color: #00B42A; }

.history-info { flex: 1; overflow: hidden; }
.history-title { 
  font-size: 14px; 
  color: var(--nb-text-color, #1d2129); 
  font-weight: 500; 
}
.history-meta { 
  font-size: 12px; 
  color: var(--nb-text-disabled, #86909c); 
  margin-top: 4px; 
  display: flex; 
  align-items: center; 
  gap: 4px; 
}
.delete-btn { 
  color: var(--nb-text-disabled, #86909c); 
  padding: 6px; 
  border-radius: 4px; 
  transition: all 0.2s; 
}
.delete-btn:hover { background: #feebeb; color: #f53f3f; }

/* 预览区 */
.preview-dock { 
  height: 45%; 
  min-height: 250px; 
  background: var(--nb-card-bg, white); 
  border-top: 1px solid var(--nb-border-color, #e5e6eb); 
  display: flex; 
  flex-direction: column; 
  box-shadow: 0 -4px 16px rgba(0,0,0,0.08); 
  z-index: 100; 
}
.preview-dock.fullscreen-mode { position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; z-index: 1000; border-top: none; }
.dock-header { 
  padding: 12px 20px; 
  border-bottom: 1px solid var(--nb-item-border, #f2f3f5); 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  background: var(--nb-card-bg, #fff); 
}
.dock-title { 
  font-weight: 600; 
  font-size: 15px; 
  display: flex; 
  align-items: center; 
  gap: 10px; 
  color: var(--nb-text-color, #1d2129); 
}
.dock-icon { width: 24px; height: 24px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 14px; }
.dock-icon.mindmap { background: #f4e8ff; color: #722ED1; }
.dock-icon.summary { background: #e8ffea; color: #00B42A; }

.dock-body { flex: 1; padding: 24px; overflow-y: auto; position: relative; }
.dock-body.no-padding { padding: 0; }

.loading-state { 
  height: 100%; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  color: var(--nb-text-disabled, #86909c); 
  flex-direction: column; 
}
.ai-thinking { text-align: center; gap: 12px; display: flex; flex-direction: column; align-items: center; }

.canvas-container { 
  width: 100%; 
  height: 100%; 
  position: relative; 
  overflow: hidden; 
  background: var(--nb-canvas-bg, #f7f8fa); 
  cursor: grab; 
}
.canvas-container:active { cursor: grabbing; }
.infinite-canvas { position: absolute; top: 0; left: 0; transform-origin: 0 0; }
.canvas-toolbar { 
  position: absolute; 
  top: 16px; 
  left: 16px; 
  background: var(--nb-card-bg, white); 
  padding: 4px; 
  border-radius: 6px; 
  box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
  display: flex; 
  gap: 8px; 
  z-index: 5; 
}
.dl-btn { margin-left: 8px; }
.zoom-indicator { position: absolute; bottom: 16px; right: 16px; background: rgba(0,0,0,0.6); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; pointer-events: none; }

/* 简报文字样式 - Markdown 优化 */
.dock-text { 
  font-size: 15px; 
  line-height: 1.8; 
  color: var(--nb-text-color, #1d2129); 
  max-width: 800px; 
  margin: 0 auto; 
}
.dock-text :deep(h1), .dock-text :deep(h2), .dock-text :deep(h3) { 
  margin-top: 1.5em; 
  margin-bottom: 0.8em; 
  color: var(--nb-text-color, #1d2129); 
  font-weight: 600; 
}
.dock-text :deep(p) { margin-bottom: 1em; }
.dock-text :deep(ul), .dock-text :deep(ol) { padding-left: 20px; margin-bottom: 1em; }
.dock-text :deep(li) { margin-bottom: 0.5em; }
.dock-text :deep(strong) { color: #165DFF; font-weight: 600; }

.slide-up-enter-active, .slide-up-leave-active { transition: all 0.3s cubic-bezier(0.34, 0.69, 0.1, 1); }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); }
</style>

<style>
/* 全局 Tree 样式 */
.tree-node { display: flex; align-items: center; margin: 12px 0; }
.node-content-wrapper { display: flex; align-items: center; }
.node-content {
  background: var(--nb-node-bg, white); 
  border: 1px solid var(--nb-node-border, #c9cdd4); 
  border-radius: 8px; 
  padding: 10px 18px;
  font-size: 14px; 
  font-weight: 500; 
  color: var(--nb-text-color, #1d2129); 
  white-space: nowrap;
  position: relative; 
  transition: all 0.2s; 
  box-shadow: 0 2px 5px rgba(0,0,0,0.03);
  cursor: pointer; 
  z-index: 2; 
  user-select: none;
}
.node-content.has-child { border-color: #165DFF; background: #e8f3ff; color: #165DFF; }
.node-content:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,0.08); }

.node-children { display: flex; flex-direction: column; margin-left: 60px; position: relative; }
.node-children::before { content: ''; position: absolute; left: -30px; top: 0; bottom: 0; width: 1px; background: var(--nb-node-border, #c9cdd4); }
.tree-node > .node-children > .tree-node::before {
  content: ''; position: absolute; left: -30px; top: 50%; width: 30px; height: 1px; background: var(--nb-node-border, #c9cdd4);
}
.toggle-dot { margin-left: 8px; width: 16px; height: 16px; line-height: 14px; text-align: center; background: rgba(22,93,255,0.1); border-radius: 50%; font-size: 12px; }

/* 暗色主题直接覆盖 */
:global(body.dark-theme) .studio-panel {
  background: #1e1e1e !important;
}

:global(body.dark-theme) .studio-header {
  background: #2a2a2b !important;
}

:global(body.dark-theme) .history-item {
  background: #2a2a2b !important;
}

:global(body.dark-theme) .preview-dock {
  background: #2a2a2b !important;
}

:global(body.dark-theme) .dock-header {
  background: #2a2a2b !important;
  border-bottom-color: #3a3a3c !important;
}

:global(body.dark-theme) .canvas-container {
  background: #1e1e1e !important;
}

:global(body.dark-theme) .canvas-toolbar {
  background: #2a2a2b !important;
}

:global(body.dark-theme) .node-content {
  background: #2a2a2b !important;
  border-color: #4e5969 !important;
  color: #f5f5f5 !important;
}

/* 暗色主题：面板左侧边框改为黑色 */
:global(body.dark-theme) .studio-panel {
  border-left: 1px solid #000 !important;
}
</style>