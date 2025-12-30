<script setup>
import { ref, nextTick, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import mermaid from 'mermaid';
import { generateFlowDiagram, generateSequenceDiagram, performCodeReview, generateUnitTests } from '../services/codeService';
import { useCodeStore } from '@/store/codeStore';
import { useThemeStore } from '@/store/themeStore';

const codeStore = useCodeStore();
const { results } = storeToRefs(codeStore); // 使用 storeToRefs 保持响应式
const themeStore = useThemeStore();
const { theme } = storeToRefs(themeStore);

const props = defineProps({
  file: Object,        // 当前选中的单个文件
  files: Array,        // 新增：接收项目中的所有文件
  projectLoaded: Boolean
});

const emit = defineEmits(['toggle-panel']); // [新增] 支持折叠事件

// --- 核心数据 ---
const isProcessing = ref(false);

// --- 预览与交互状态 ---
const previewVisible = ref(false);
const isFullScreen = ref(false);
const currentPreviewItem = ref(null);

// 缩放拖拽状态
const scale = ref(1);
const translateX = ref(0);
const translateY = ref(0);
const isDragging = ref(false);
const startX = ref(0);
const startY = ref(0);

// --- 初始化 Mermaid ---
const initializeMermaid = () => {
  const isDark = theme.value === 'dark';
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    securityLevel: 'loose',
    themeVariables: isDark ? {
      primaryColor: '#1e1e1e',
      lineColor: '#666',
      textColor: '#ccc',
      mainBkg: '#1e1e1e',
      nodeBorder: '#666'
    } : {
      primaryColor: '#f0f0f0',
      primaryTextColor: '#1d2129',
      primaryBorderColor: '#86909c',
      lineColor: '#4e5969',
      secondaryColor: '#e8f3ff',
      tertiaryColor: '#ffffff',
      background: '#ffffff',
      mainBkg: '#ffffff',
      secondaryBkg: '#f7f8fa',
      tertiaryBkg: '#ffffff',
      nodeBorder: '#86909c',
      clusterBkg: '#f7f8fa',
      clusterBorder: '#c9cdd4',
      titleColor: '#1d2129',
      edgeLabelBackground: '#ffffff',
      actorBorder: '#86909c',
      actorBkg: '#f7f8fa',
      actorTextColor: '#1d2129',
      actorLineColor: '#86909c',
      signalColor: '#1d2129',
      signalTextColor: '#1d2129',
      labelBoxBkgColor: '#e8f3ff',
      labelBoxBorderColor: '#86909c',
      labelTextColor: '#1d2129',
      loopTextColor: '#1d2129',
      noteBorderColor: '#86909c',
      noteBkgColor: '#fff7e6',
      noteTextColor: '#1d2129',
      textColor: '#1d2129',
      fontSize: '14px'
    }
  });
};

onMounted(() => {
  initializeMermaid();
});

// --- 监听器 ---
// 监听主题变化，重新初始化 mermaid 并重新渲染所有图表
watch(theme, async () => {
  initializeMermaid();
  await nextTick();
  // 重新渲染列表中的所有图表
  const containers = document.querySelectorAll('.mermaid-list-container');
  containers.forEach(el => el.removeAttribute('data-processed'));
  renderPendingMermaid('.mermaid-list-container');
  
  // 如果有预览窗口打开，也重新渲染
  if (currentPreviewItem.value && currentPreviewItem.value.isChart) {
    const previewEl = document.getElementById('preview-mermaid-root');
    if (previewEl) {
      previewEl.removeAttribute('data-processed');
      await renderMermaidByElement(previewEl, currentPreviewItem.value.content, 'preview-' + currentPreviewItem.value.id);
    }
  }
});

watch(() => results.value.length, async () => {
  await nextTick();
  renderPendingMermaid('.mermaid-list-container');
});

watch(() => currentPreviewItem.value, async (newItem) => {
  if (newItem && newItem.isChart) {
    resetZoom();
    await nextTick();
    setTimeout(() => {
      renderMermaidByElement(document.getElementById('preview-mermaid-root'), newItem.content, 'preview-' + newItem.id);
    }, 100);
  }
});

const renderPendingMermaid = (selector) => {
  const containers = document.querySelectorAll(`${selector}:not([data-processed="true"])`);
  containers.forEach(async (el) => {
    const code = el.getAttribute('data-code');
    const id = el.getAttribute('id');
    if (code && id) {
      await renderMermaidByElement(el, code, id);
    }
  });
};

const renderMermaidByElement = async (el, code, id) => {
  try {
    el.removeAttribute('data-processed');
    const { svg } = await mermaid.render(id + '-svg', code);
    el.innerHTML = svg;
    el.setAttribute('data-processed', 'true');
  } catch (e) {
    if(el) el.innerHTML = '<div class="render-error"><icon-exclamation-circle-fill /> 渲染失败</div>';
    console.error(e);
  }
}

// --- 业务操作 ---

const handleAction = async (type) => {
  // 必须确保项目已加载（有文件存在）
  if (!props.projectLoaded || !props.files || props.files.length === 0) return;

  isProcessing.value = true;

  const fileCount = props.files.length;
  const fileNames = props.files.map(f => f.name).slice(0, 3).join(', ') + (fileCount > 3 ? '...' : '');

  const rawResult = {
    id: 'res-' + Date.now(),
    type: type,
    timestamp: new Date().toLocaleTimeString(),
    loading: true,
    progress: 0,
    loadingText: '准备中...',
    title: '',
    content: null,
    isChart: false,
    isCode: false
  };

  results.value.unshift(rawResult);
  const reactiveItem = results.value[0];

  try {
    // 调用真实 service
    if (type === 'flow') {
      reactiveItem.title = '全局业务流程图';
      reactiveItem.isChart = true;
      reactiveItem.loadingText = '正在生成流程图...';
      reactiveItem.progress = 30;
      
      let mermaidCode = '';
      await generateFlowDiagram(props.files, (chunk) => {
        mermaidCode += chunk;
        reactiveItem.progress = Math.min(90, 30 + mermaidCode.length / 10);
      });
      
      reactiveItem.content = mermaidCode;
      reactiveItem.progress = 100;
      
    } else if (type === 'sequence') {
      reactiveItem.title = '全局时序交互图';
      reactiveItem.isChart = true;
      reactiveItem.loadingText = '正在生成时序图...';
      reactiveItem.progress = 30;
      
      let mermaidCode = '';
      await generateSequenceDiagram(props.files, (chunk) => {
        mermaidCode += chunk;
        reactiveItem.progress = Math.min(90, 30 + mermaidCode.length / 10);
      });
      
      reactiveItem.content = mermaidCode;
      reactiveItem.progress = 100;
      
    } else if (type === 'ai') {
      reactiveItem.title = '全项目 AI 审计';
      reactiveItem.isChart = false;
      reactiveItem.loadingText = '正在分析代码...';
      
      const result = await performCodeReview(props.files, (progress, message) => {
        reactiveItem.progress = progress;
        reactiveItem.loadingText = message;
      });
      
      reactiveItem.content = result;
      
    } else if (type === 'test') {
      reactiveItem.title = '集成测试生成';
      reactiveItem.isCode = true;
      reactiveItem.loadingText = '正在生成测试代码...';
      reactiveItem.progress = 30;
      
      let testCode = '';
      await generateUnitTests(props.files, (chunk) => {
        testCode += chunk;
        reactiveItem.progress = Math.min(90, 30 + testCode.length / 10);
      });
      
      reactiveItem.content = testCode;
      reactiveItem.progress = 100;
    }

    await new Promise(r => setTimeout(r, 200));
    reactiveItem.loading = false;

  } catch (error) {
    console.error('操作失败:', error);
    reactiveItem.loading = false;
    reactiveItem.content = `生成失败: ${error.message}`;
  }

  isProcessing.value = false;
};

// 删除条目
const deleteResult = (id) => {
  const index = results.value.findIndex(item => item.id === id);
  if (index !== -1) {
    results.value.splice(index, 1);
  }
  if (currentPreviewItem.value && currentPreviewItem.value.id === id) {
    closePreview();
  }
};

// --- 预览逻辑 ---

const openPreview = (item) => {
  if (item.loading) return;
  currentPreviewItem.value = item;
  previewVisible.value = true;
  isFullScreen.value = false;
};

const closePreview = () => {
  previewVisible.value = false;
  setTimeout(() => {
    currentPreviewItem.value = null;
    isFullScreen.value = false;
  }, 300);
};

const toggleFullScreen = () => {
  isFullScreen.value = !isFullScreen.value;
};

// --- 图表缩放与下载逻辑 ---

const updateZoom = (delta) => {
  let newScale = scale.value + delta;
  if (newScale < 0.1) newScale = 0.1;
  if (newScale > 5) newScale = 5;
  scale.value = parseFloat(newScale.toFixed(2));
};

const resetZoom = () => {
  scale.value = 1;
  translateX.value = 0;
  translateY.value = 0;
};

const handleWheel = (e) => {
  if (!currentPreviewItem.value?.isChart) return;
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  updateZoom(delta);
};

const startDrag = (e) => {
  if (!currentPreviewItem.value?.isChart) return;
  isDragging.value = true;
  startX.value = e.clientX - translateX.value;
  startY.value = e.clientY - translateY.value;
};

const onDrag = (e) => {
  if (!isDragging.value) return;
  e.preventDefault();
  translateX.value = e.clientX - startX.value;
  translateY.value = e.clientY - startY.value;
};

const stopDrag = () => {
  isDragging.value = false;
};

const downloadImage = () => {
  const svgElement = document.querySelector('#preview-mermaid-root svg');
  if (!svgElement) return;

  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svgElement);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const img = new Image();

  const svgRect = svgElement.getBoundingClientRect();
  const exportScale = 2;

  canvas.width = svgRect.width * exportScale;
  canvas.height = svgRect.height * exportScale;

  img.onload = function() {
    // 使用当前主题的背景色
    ctx.fillStyle = theme.value === 'dark' ? "#1e1e1e" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const pngUrl = canvas.toDataURL("image/png");
    const downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `diagram_${currentPreviewItem.value.id}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(source)));
};

const copyCode = (text) => {
  navigator.clipboard.writeText(text);
};
</script>

<template>
  <div class="ops-panel h-full flex flex-col relative overflow-hidden">

    <!-- 1. Header / Toolbar -->
    <div class="ops-header">
      <div class="header-title-row">
        <div class="header-title">INTELLIGENT ACTIONS</div>
        <!-- <a-button 
          type="text" 
          size="small" 
          class="collapse-btn" 
          @click="$emit('toggle-panel')"
          title="收起面板"
        >
          <template #icon><icon-right /></template>
        </a-button> -->
      </div>

      <!-- 只有在 projectLoaded (且 files 数组不为空) 时才允许点击，这里逻辑上已满足 -->
      <div class="action-grid">
        <div class="action-card" :class="{ disabled: !projectLoaded }" @click="handleAction('flow')">
          <div class="icon-box"><icon-mind-mapping /></div>
          <div class="text-box"><div class="card-title">生成流程图</div><div class="card-desc">可视化逻辑跳转</div></div>
        </div>
        <div class="action-card" :class="{ disabled: !projectLoaded }" @click="handleAction('sequence')">
          <div class="icon-box"><icon-link /></div>
          <div class="text-box"><div class="card-title">生成时序图</div><div class="card-desc">对象交互时序</div></div>
        </div>
        <div class="action-card" :class="{ disabled: !projectLoaded }" @click="handleAction('ai')">
          <div class="icon-box"><icon-robot /></div>
          <div class="text-box"><div class="card-title">AI 代码审计</div><div class="card-desc">发现潜在风险</div></div>
        </div>
        <div class="action-card" :class="{ disabled: !projectLoaded }" @click="handleAction('test')">
          <div class="icon-box"><icon-experiment /></div>
          <div class="text-box"><div class="card-title">生成单元测试</div><div class="card-desc">JUnit 5 用例</div></div>
        </div>
      </div>
    </div>

    <!-- 2. Results Stream (List View) -->
    <div class="ops-results-area flex-1 relative">
      <div class="results-scroll-container">

        <div v-if="results.length === 0" class="empty-placeholder">
          <icon-message style="font-size: 32px; opacity: 0.5; margin-bottom: 12px" />
          <p>选择上方功能，结果将在此显示</p>
        </div>

        <transition-group name="list">
          <div
              v-for="item in results"
              :key="item.id"
              class="result-card group"
              @click="openPreview(item)"
          >
            <!-- Result Header -->
            <div class="result-header">
              <div class="header-left">
                <icon-loading v-if="item.loading" spin class="text-blue-500 mr-2" />
                <icon-check-circle-fill v-else class="text-green-500 mr-2" />
                <span class="result-type-badge">{{ item.loading ? '正在生成...' : item.title }}</span>
              </div>
              <div class="header-right">
                <span class="result-time">{{ item.timestamp }}</span>
                <a-button type="text" status="danger" size="mini" class="delete-btn" @click.stop="deleteResult(item.id)">
                  <template #icon><icon-delete /></template>
                </a-button>
              </div>
            </div>

            <!-- Content Preview -->
            <div class="result-body">

              <div v-if="item.loading" class="loading-state-container">
                <div class="loading-info">
                  <span class="loading-text"><icon-code class="mr-1" /> {{ item.loadingText }}</span>
                  <span class="loading-percent">{{ item.progress }}%</span>
                </div>
                <a-progress
                    :percent="item.progress / 100"
                    :show-text="false"
                    color="#165DFF"
                    track-color="#333"
                    size="small"
                    :animation="true"
                    class="custom-progress"
                />
              </div>

              <div v-else>
                <!-- Mermaid List View -->
                <div
                    v-if="item.isChart"
                    :id="item.id"
                    class="mermaid-list-container pointer-events-none"
                    :data-code="item.content"
                ></div>

                <!-- Text/Code Preview -->
                <div v-else class="text-preview">
                  <div v-if="item.type === 'ai'" class="ai-summary-preview">
                    {{ item.content.summary }}
                  </div>
                  <div v-else-if="item.isCode" class="code-preview">
                    {{ item.content.substring(0, 100) }}...
                  </div>
                </div>

                <div class="click-hint">点击查看详情</div>
              </div>
            </div>
          </div>
        </transition-group>

      </div>
    </div>

    <!-- 3. Preview Drawer -->
    <transition name="slide-up">
      <div v-if="previewVisible" class="preview-drawer-mask">
        <div class="mask-bg" @click="closePreview"></div>
        <div
            class="preview-drawer-container"
            :class="{ 'full-screen': isFullScreen }"
        >
          <div class="preview-toolbar">
            <div class="toolbar-left">
              <span class="preview-title">{{ currentPreviewItem?.title }}</span>
            </div>
            <div class="toolbar-right">
              <div v-if="currentPreviewItem?.isChart" class="chart-controls">
                <a-button-group size="small" type="text">
                  <a-button @click="updateZoom(-0.1)" title="缩小">
                    <template #icon><icon-minus /></template>
                  </a-button>
                  <a-button @click="resetZoom" title="重置">
                    {{ Math.round(scale * 100) }}%
                  </a-button>
                  <a-button @click="updateZoom(0.1)" title="放大">
                    <template #icon><icon-plus /></template>
                  </a-button>
                </a-button-group>
                <div class="divider"></div>
                <a-button size="small" type="text" @click="downloadImage" title="下载 PNG">
                  <template #icon><icon-download /></template>
                </a-button>
                <div class="divider"></div>
              </div>

              <a-button size="small" type="text" @click="toggleFullScreen" :title="isFullScreen ? '退出全屏' : '全屏'">
                <template #icon>
                  <icon-fullscreen-exit v-if="isFullScreen" />
                  <icon-fullscreen v-else />
                </template>
              </a-button>

              <a-button size="small" type="text" status="danger" @click="closePreview">
                <template #icon><icon-close /></template>
              </a-button>
            </div>
          </div>

          <div class="preview-content">
            <div
                v-if="currentPreviewItem?.isChart"
                class="chart-viewport"
                @mousedown="startDrag"
                @mousemove="onDrag"
                @mouseup="stopDrag"
                @mouseleave="stopDrag"
                @wheel="handleWheel"
            >
              <div
                  class="chart-canvas"
                  :style="{ transform: `translate(${translateX}px, ${translateY}px) scale(${scale})` }"
              >
                <div id="preview-mermaid-root" class="mermaid-render-target"></div>
              </div>
            </div>

            <div v-else class="text-viewport">
              <div v-if="currentPreviewItem?.type === 'ai'" class="ai-analysis-full">
                <div class="score-card">
                  <div class="score-val">{{ currentPreviewItem.content.score }}</div>
                  <div class="score-label">健康度评分</div>
                </div>
                <h4 class="section-h">分析总结</h4>
                <p class="summary-text">{{ currentPreviewItem.content.summary }}</p>
                <h4 class="section-h">风险清单</h4>
                <div class="risk-list">
                  <div v-for="(risk, idx) in currentPreviewItem.content.risks" :key="idx" class="risk-item">
                    <icon-exclamation-circle-fill class="text-amber-500 mr-2" />
                    {{ risk }}
                  </div>
                </div>
              </div>

              <div v-else-if="currentPreviewItem?.isCode" class="code-full-wrapper">
                <div class="code-actions">
                  <a-button size="mini" type="secondary" @click="copyCode(currentPreviewItem.content)">
                    <template #icon><icon-copy /></template> 复制代码
                  </a-button>
                </div>
                <pre><code>{{ currentPreviewItem.content }}</code></pre>
              </div>
            </div>

          </div>
        </div>
      </div>
    </transition>

  </div>
</template>

<style scoped>
.ops-panel {
  background-color: var(--code-content-bg, #1e1e1e);
  border-left: 1px solid var(--code-border, #1e1e1e);
  font-family: 'Segoe UI', sans-serif;
  color: var(--code-text, #ccc);
}

/* Header & Toolbar */
.ops-header {
  background-color: var(--code-header-bg, #252526);
  padding: 16px;
  border-bottom: 1px solid var(--code-border, #1e1e1e);
}
.header-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.header-title { 
  font-size: 11px; 
  font-weight: bold; 
  color: #bbbbbb; 
}
.collapse-btn {
  color: #bbbbbb !important;
  transition: all 0.2s;
  padding: 4px 8px !important;
  min-width: 32px;
  cursor: pointer;
  position: relative;
  z-index: 10;
}
.collapse-btn:hover {
  background-color: #3e3e42 !important;
  color: #fff !important;
  transform: scale(1.1);
}
.action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.action-card {
  border: none; 
  border-radius: 8px; 
  padding: 14px 16px;
  display: flex; 
  align-items: center; 
  gap: 12px; 
  cursor: pointer; 
  transition: all 0.2s;
  color: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

/* 彩色渐变卡片 - 和 Notebook Studio 一致 */
.action-card:nth-child(1) { 
  background: linear-gradient(135deg, #b37feb 0%, #722ed1 100%); 
}
.action-card:nth-child(2) { 
  background: linear-gradient(135deg, #00d4ff 0%, #0e639c 100%); 
}
.action-card:nth-child(3) { 
  background: linear-gradient(135deg, #aff0b5 0%, #00b42a 100%); 
}
.action-card:nth-child(4) { 
  background: linear-gradient(135deg, #ffbb96 0%, #f77234 100%); 
}

.action-card:hover { 
  transform: translateY(-2px); 
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}
.action-card.disabled { 
  cursor: not-allowed; 
}

.icon-box {
  width: 32px; 
  height: 32px; 
  border-radius: 6px; 
  display: flex; 
  align-items: center; 
  justify-content: center;
  font-size: 18px; 
  color: #fff;
  background-color: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
}
.text-box { flex: 1; overflow: hidden; }
.card-title { font-size: 13px; font-weight: 600; color: #fff; margin-bottom: 2px; }
.card-desc { font-size: 11px; color: rgba(255,255,255,0.85); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Results Stream */
.ops-results-area { background-color: var(--code-content-bg, #1e1e1e); overflow: hidden; display: flex; flex-direction: column; }
.results-scroll-container { flex: 1; overflow-y: auto; padding: 16px; padding-bottom: 40px; }
.empty-placeholder { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #444; font-size: 13px; }

/* Result Card */
.result-card {
  background-color: var(--code-card-bg, #252526); border: 1px solid var(--code-border, #333); border-radius: 6px; margin-bottom: 16px;
  overflow: hidden; cursor: pointer; transition: border-color 0.2s;
}
.result-card:hover { border-color: #555; }

.result-header {
  padding: 8px 12px; background-color: var(--code-header-bg, #2d2d2d); border-bottom: 1px solid var(--code-border, #333);
  display: flex; justify-content: space-between; align-items: center;
}
.header-left { display: flex; align-items: center; }
.header-right { display: flex; align-items: center; gap: 8px; }
.result-type-badge { font-size: 12px; font-weight: 600; color: #ccc; }
.result-time { font-size: 10px; color: #666; }

.delete-btn { opacity: 0; transition: opacity 0.2s; }
.result-card:hover .delete-btn { opacity: 1; }

.result-body { padding: 12px; position: relative; min-height: 60px; }
.click-hint {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: linear-gradient(to bottom, transparent, rgba(0,0,0,0.8));
  color: #fff; font-size: 10px; text-align: center; padding: 4px;
  opacity: 0; transition: opacity 0.2s;
}
.result-card:hover .click-hint { opacity: 1; }

/* Loading State */
.loading-state-container {
  padding: 8px 0;
}
.loading-info {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 6px; font-size: 12px; color: #ccc;
}
.loading-percent { color: #165DFF; font-weight: bold; }

/* Mermaid & Content */
.mermaid-list-container { max-height: 150px; overflow: hidden; opacity: 0.8; mask-image: linear-gradient(to bottom, black 60%, transparent 100%); }
.text-preview { font-size: 12px; color: #888; line-height: 1.4; }
.ai-summary-preview { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.code-preview { font-family: monospace; opacity: 0.7; }


/* --- Preview Drawer --- */
.preview-drawer-mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  z-index: 1000; display: flex; flex-direction: column; justify-content: flex-end;
}
.mask-bg {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0,0,0,0.8); backdrop-filter: blur(4px);
}
.preview-drawer-container {
  position: relative; z-index: 1001;
  background-color: var(--code-content-bg, #1e1e1e); border-top: 1px solid var(--code-border, #333);
  height: 100%; /* 默认全屏 */
  box-shadow: 0 -4px 20px rgba(0,0,0,0.5);
  display: flex; flex-direction: column;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.preview-drawer-container.full-screen {
  height: 100%; border-top: none;
}

/* Drawer Toolbar */
.preview-toolbar {
  height: 48px; background-color: var(--code-header-bg, #252526); border-bottom: 1px solid var(--code-border, #333);
  display: flex; justify-content: space-between; align-items: center; padding: 0 16px;
  flex-shrink: 0;
}
.preview-title { font-weight: bold; color: var(--preview-title-color, #ddd); font-size: 13px; }
.toolbar-right { display: flex; align-items: center; gap: 8px; }

.chart-controls { display: flex; align-items: center; gap: 4px; background: var(--chart-controls-bg, #333); padding: 2px; border-radius: 4px; margin-right: 12px; }
.divider { width: 1px; height: 16px; background-color: var(--divider-color, #444); margin: 0 4px; }

/* Content Viewport */
.preview-content { flex: 1; overflow: hidden; position: relative; background-color: var(--code-content-bg, #1e1e1e); }

/* Chart Viewport */
.chart-viewport { 
  width: 100%; 
  height: 100%; 
  overflow: hidden; 
  cursor: grab; 
  background-image: var(--chart-viewport-bg-image, radial-gradient(#333 1px, transparent 1px)); 
  background-size: 20px 20px; 
  background-color: var(--chart-viewport-bg-color, transparent);
}
.chart-viewport:active { cursor: grabbing; }
.chart-canvas {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  transform-origin: center center;
}
:deep(.mermaid-render-target svg) { max-width: none !important; height: auto !important; }

/* Text Viewport */
.text-viewport { padding: 24px; overflow-y: auto; height: 100%; max-width: 800px; margin: 0 auto; }
.ai-analysis-full .score-card {
  background: linear-gradient(135deg, #1e3c72, #2a5298);
  padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 24px;
}
.score-val { font-size: 32px; font-weight: bold; color: #fff; }
.score-label { font-size: 12px; color: rgba(255,255,255,0.7); }
.section-h { color: #fff; margin: 16px 0 8px 0; border-left: 3px solid #007acc; padding-left: 8px; font-size: 14px; }
.summary-text { color: #ccc; line-height: 1.6; font-size: 13px; }
.risk-item { background-color: rgba(255,166,0,0.1); border: 1px solid rgba(255,166,0,0.2); padding: 8px; margin-bottom: 8px; border-radius: 4px; color: #ddd; font-size: 13px; display: flex; align-items: center; }

.code-full-wrapper { background: #111; padding: 16px; border-radius: 6px; position: relative; }
.code-actions { position: absolute; top: 8px; right: 8px; }
.code-full-wrapper pre { margin: 0; color: #9cdcfe; font-family: 'Consolas', monospace; font-size: 13px; overflow-x: auto; }

/* Animation */
.slide-up-enter-active, .slide-up-leave-active { transition: opacity 0.3s; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; }
.slide-up-enter-active .preview-drawer-container { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.slide-up-leave-active .preview-drawer-container { transition: transform 0.2s ease-in; }
.slide-up-enter-from .preview-drawer-container, .slide-up-leave-to .preview-drawer-container { transform: translateY(100%); }

.list-enter-active, .list-leave-active { transition: all 0.3s ease; }
.list-enter-from, .list-leave-to { opacity: 0; transform: translateY(-10px); }
</style>