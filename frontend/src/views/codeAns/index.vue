<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useThemeStore } from '@/store/themeStore';
import { useCodeStore } from '@/store/codeStore';
import SourcePanel from './components/SourcePanel.vue';
import CodeEditor from './components/CodeEditor.vue';
import OperationPanel from './components/OperationPanel.vue';
import { IconHome, IconSunFill, IconMoonFill, IconMenuUnfold, IconMenuFold, IconApps, IconClose, IconDoubleLeft } from '@arco-design/web-vue/es/icon';

const router = useRouter();
const themeStore = useThemeStore();
const codeStore = useCodeStore();

// --- 全局状态 ---
const projectFiles = ref([]); // 当前项目的所有文件
const currentFileIndex = ref(-1); // 默认索引为 -1，表示初始不选中任何文件
const projectLoaded = ref(false); // 是否已加载项目

// --- 布局状态 ---
const isSiderCollapsed = ref(false); // 控制左侧边栏折叠状态
const siderWidth = ref(300); // 控制左侧边栏宽度
const rightSiderWidth = ref(450); // 控制右侧边栏宽度
const rightCollapsed = ref(false); // [新增] 控制右侧边栏折叠状态

// 计算当前选中的文件对象
const currentFile = computed(() => {
  if (!projectFiles.value.length || currentFileIndex.value === -1) return null;
  return projectFiles.value[currentFileIndex.value];
});

// --- 事件处理 ---

// 1. 处理从左侧 SourcePanel 传来的文件加载事件
const handleProjectLoaded = (files) => {
  projectFiles.value = files;
  currentFileIndex.value = -1;
  projectLoaded.value = true;
  
  // 同步文件到 codeStore
  codeStore.files = files;
  // 自动保存项目
  setTimeout(() => codeStore.saveCurrentProject(), 500);
};

// 2. 处理文件切换
const handleFileSelect = (index) => {
  currentFileIndex.value = index;
};

// 3. 关闭项目
const handleCloseProject = () => {
  // 保存当前项目
  if (codeStore.currentProjectId) {
    codeStore.saveCurrentProject();
  }
  
  projectFiles.value = [];
  projectLoaded.value = false;
  currentFileIndex.value = -1;
  codeStore.clearFiles();
};

// 4. 处理侧边栏折叠切换
const toggleSider = () => {
  isSiderCollapsed.value = !isSiderCollapsed.value;
};

// 4.5. [新增] 处理右侧边栏折叠切换
const toggleRightSider = () => {
  rightCollapsed.value = !rightCollapsed.value;
};

// 5. [修复核心] 处理左侧侧边栏尺寸调整
const handleSiderResize = (newWidth) => {
  // 关键修复：只有在"未折叠"状态下，才记录新的宽度。
  // 这防止了折叠动作本身触发 resize 事件，导致 siderWidth 被错误地更新为收起后的宽度（如 48px）。
  if (!isSiderCollapsed.value) {
    siderWidth.value = newWidth;
  }
};

// 6. [新增修复] 处理右侧侧边栏尺寸调整
// 确保右侧面板在拖拽后能记住宽度，不会意外重置
const handleRightSiderResize = (newWidth) => {
  rightSiderWidth.value = newWidth;
};

// 7. 返回首页
const goHome = () => {
  router.push('/');
};

// 8. 移动端关闭侧边栏
const closeMobileSiders = () => {
  isSiderCollapsed.value = true;
  rightCollapsed.value = true; // [修改] 同时关闭右侧
};

// 9. 检测屏幕宽度并设置初始状态
const checkMobileView = () => {
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    isSiderCollapsed.value = true;
    rightCollapsed.value = true; // [修改] 移动端也默认折叠右侧
  }
};

// 组件挂载时检测
onMounted(() => {
  checkMobileView();
  window.addEventListener('resize', checkMobileView);
});

// 组件卸载时清理
onUnmounted(() => {
  window.removeEventListener('resize', checkMobileView);
});
</script>

<template>
  <a-layout class="app-layout">
    <!-- Header -->
    <a-layout-header class="header">
      <div class="header-left">
        <a-button type="text" @click="goHome">
          <icon-home />
          返回首页
        </a-button>
        <a-divider direction="vertical" />
        <div class="logo">
          <img src="@/assets/main2.png" class="logo-img" alt="code" />
          Code Archaeologist
        </div>
      </div>
      <a-space>
        <a-button type="text" @click="themeStore.toggleTheme()">
          <icon-sun-fill v-if="themeStore.theme === 'light'" />
          <icon-moon-fill v-else />
        </a-button>
        <div v-if="projectLoaded" class="project-info">
          <a-tag color="arcoblue">{{ projectFiles.length }} 个文件已加载</a-tag>
        </div>
      </a-space>
    </a-layout-header>

    <!-- 移动端遮罩层 -->
    <div 
      v-if="!isSiderCollapsed || !rightCollapsed" 
      class="mobile-overlay"
      @click="closeMobileSiders"
    ></div>

    <a-layout class="main-body">

      <!-- 左侧：来源与文件列表 -->
      <a-layout-sider
          :width="isSiderCollapsed ? 0 : siderWidth"
          :collapsed-width="0"
          @resize="handleSiderResize"
          :collapsed="isSiderCollapsed"
          :collapsible="true"
          :trigger="null"
          :resize-directions="isSiderCollapsed ? [] : ['right']"
          class="layout-sider left-sider"
      >
        <SourcePanel
            :project-loaded="projectLoaded"
            :current-file-index="currentFileIndex"
            :files="projectFiles"
            :collapsed="isSiderCollapsed"
            @load-project="handleProjectLoaded"
            @select-file="handleFileSelect"
            @close-project="handleCloseProject"
            @toggle-panel="toggleSider"
        />
      </a-layout-sider>

      <!-- 中间：代码编辑器 -->
      <a-layout-content class="layout-content">
        <!-- 中间工具栏（桌面端和移动端共用）-->
        <div class="mobile-toolbar">
          <a-tooltip :content="isSiderCollapsed ? '展开文件列表' : '收起文件列表'" position="right">
            <a-button 
              shape="circle" 
              size="small" 
              @click="toggleSider"
              class="sider-toggle-btn"
            >
              <icon-menu-unfold v-if="isSiderCollapsed" />
              <icon-menu-fold v-else />
            </a-button>
          </a-tooltip>
          
          <div style="flex: 1;"></div>
          
          <a-tooltip :content="rightCollapsed ? '展开操作面板' : '收起操作面板'" position="left">
            <a-button 
              shape="circle" 
              size="small" 
              @click="toggleRightSider"
              class="sider-toggle-btn"
            >
              <icon-apps v-if="rightCollapsed" />
              <icon-close v-else />
            </a-button>
          </a-tooltip>
        </div>
        
        <CodeEditor
            :file="currentFile"
            :project-loaded="projectLoaded"
        />
      </a-layout-content>

      <!-- 右侧：操作与可视化 -->
      <a-layout-sider
          :width="rightCollapsed ? 0 : rightSiderWidth"
          :collapsed-width="0"
          @resize="handleRightSiderResize"
          :collapsed="rightCollapsed"
          :collapsible="true"
          :trigger="null"
          :resize-directions="rightCollapsed ? [] : ['left']"
          class="layout-sider right-sider"
      >
        <OperationPanel
            v-show="!rightCollapsed"
            :file="currentFile"
            :files="projectFiles"
            :project-loaded="projectLoaded"
            @toggle-panel="toggleRightSider"
        />
      </a-layout-sider>

    </a-layout>
  </a-layout>
</template>

<style scoped>
.app-layout {
  height: 100vh;
  background-color: var(--code-bg, #232324);
  color: var(--code-text, #c9cdd4);
  display: flex;
  flex-direction: column;
}

.header {
  height: 60px;
  flex-shrink: 0;
  background: var(--nb-header-bg, white);
  border-bottom: 1px solid var(--nb-border-color, #e5e6eb);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  z-index: 10;
}

/* 移动端：Header优化 */
@media (max-width: 768px) {
  .header {
    height: 56px;
    padding: 0 12px;
  }
}

.header-left {
  display: flex;
  align-items: center;
}

.logo {
  font-weight: 600;
  font-size: 16px;
  color: var(--nb-text-color, #1d2129);
  display: flex;
  align-items: center;
  gap: 8px;
}

.project-info {
  margin-left: 8px;
}

/* 移动端：简化 header */
@media (max-width: 768px) {
  .logo {
    font-size: 14px;
  }
  
  .project-info {
    display: none; /* 移动端隐藏项目信息 */
  }
}

.main-body {
  flex: 1;
  overflow: hidden;
  display: flex;
}

.layout-sider {
  background-color: var(--code-sider-bg, #252526);
  border-right: 1px solid var(--code-border, #333);
}

.right-sider {
  border-left: 1px solid var(--code-border, #333);
  border-right: none;
  background-color: var(--code-right-sider-bg, #2a2a2b);
}

/* 平板端：调整侧边栏宽度 */
@media (min-width: 769px) and (max-width: 1024px) {
  .left-sider {
    width: 260px !important;
    min-width: 260px !important;
  }
  
  .right-sider {
    width: 380px !important;
    min-width: 380px !important;
  }
}

/* 移动端遮罩层 */
.mobile-overlay {
  display: none;
}

@media (max-width: 768px) {
  .mobile-overlay {
    display: block;
    position: fixed;
    top: 56px;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 99;
    backdrop-filter: blur(2px);
  }
}

/* 中间工具栏样式 - 桌面端和移动端共用 */
.mobile-toolbar {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--code-content-bg, #1e1e1e);
  border-bottom: 1px solid var(--code-border, #333);
  flex-shrink: 0;
}

.sider-toggle-btn {
  display: inline-flex !important;
}

/* 移动端：侧边栏覆盖显示 */
@media (max-width: 768px) {
  .left-sider,
  .right-sider {
    position: fixed !important;
    top: 56px;
    bottom: 0;
    z-index: 100;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    transition: transform 0.3s cubic-bezier(0.34, 0.69, 0.1, 1);
  }
  
  .left-sider {
    left: 0;
    width: 280px !important;
    max-width: 85vw !important;
  }
  
  /* 隐藏时滑出屏幕 */
  .left-sider.arco-layout-sider-collapsed {
    transform: translateX(-100%);
  }
  
  .right-sider {
    right: 0;
    width: 320px !important;
    max-width: 90vw !important;
  }
  
  /* 隐藏时滑出屏幕 */
  .right-sider.arco-layout-sider-collapsed {
    transform: translateX(100%);
  }
}

/* 桌面端右侧展开触发条 */
.desktop-expand-trigger {
  position: fixed;
  top: 60px;
  right: 0;
  bottom: 0;
  width: 4px;
  background: rgba(22, 93, 255, 0.3);
  cursor: pointer;
  z-index: 50;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: transparent;
}

.desktop-expand-trigger:hover {
  width: 24px;
  background: rgba(22, 93, 255, 0.8);
  color: white;
}

/* 移动端隐藏桌面展开触发条 */
@media (max-width: 768px) {
  .desktop-expand-trigger {
    display: none !important;
  }
}

.layout-content {
  background-color: var(--code-content-bg, #1e1e1e);
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 移动端：中间内容区优化 */
@media (max-width: 768px) {
  .layout-content {
    width: 100vw;
  }
}

:deep(.arco-layout-sider-trigger) {
  display: none !important;
  width: 0 !important;
}

:deep(.layout-sider.arco-layout-sider-collapsed) {
  width: 48px !important;
  min-width: 48px !important;
  max-width: 48px !important;
  flex: 0 0 48px !important;
}

/* Light Theme Support */
:global(body.light-theme) .app-layout {
  --code-bg: #f5f5f5;
  --code-text: #1d2129;
  --code-header-bg: #ffffff;
  --code-border: #e5e6eb;
  --code-logo-color: #1d2129;
  --code-sider-bg: #ffffff;
  --code-right-sider-bg: #fafafa;
  --code-content-bg: #ffffff;
  --code-upload-bg: #f7f8fa;
  --code-upload-hover-bg: #e8f3ff;
  --code-card-bg: #e8e9eb;
  --code-card-hover-bg: #dcdee0;
  --code-input-bg: #f2f3f5;
  --code-hover-bg: #f2f3f5;
  --code-active-bg: #e8f3ff;
  --code-accent: #165DFF;
  --code-meta-color: #86909c;
}

/* 强制覆盖所有子组件的硬编码背景 - Light Theme */
:global(body.light-theme) .source-panel,
:global(body.light-theme) .panel-header,
:global(body.light-theme) .editor-wrapper,
:global(body.light-theme) .editor-breadcrumb,
:global(body.light-theme) .code-area-scroll,
:global(body.light-theme) .empty-editor {
  background-color: var(--code-content-bg) !important;
}

:global(body.light-theme) .file-item,
:global(body.light-theme) .tree-root-item {
  color: var(--code-text) !important;
}

:global(body.light-theme) .file-item:hover,
:global(body.light-theme) .tree-root-item:hover {
  background-color: #e8e9eb !important;
}

:global(body.light-theme) .file-item.active {
  background-color: #e8f3ff !important;
  color: #165DFF !important;
}

:global(body.light-theme) .upload-box {
  background-color: #f2f3f5 !important;
  border-color: #e5e6eb !important;
  color: #1d2129 !important;
}

:global(body.light-theme) .upload-box:hover {
  background-color: #e8e9eb !important;
}

:global(body.light-theme) .custom-input {
  background-color: #f2f3f5 !important;
  border-color: #e5e6eb !important;
  color: #1d2129 !important;
}

:global(body.light-theme) .action-card {
  background-color: #e8e9eb !important;
  color: #1d2129 !important;
}

:global(body.light-theme) .action-card:hover {
  background-color: #dcdee0 !important;
}

:global(body.light-theme) .card-title,
:global(body.light-theme) .header-title {
  color: #1d2129 !important;
}

:global(body.light-theme) .code-area-scroll::-webkit-scrollbar-track {
  background: #f5f5f5 !important;
}

:global(body.light-theme) .code-area-scroll::-webkit-scrollbar-thumb {
  background: #c9cdd4 !important;
  border-color: #f5f5f5 !important;
}

/* 白天模式：图表背景改为纯色，去掉小黑点 */
:global(body.light-theme) .chart-viewport {
  --chart-viewport-bg-image: none;
  --chart-viewport-bg-color: #fafafa;
}

/* 白天模式：预览窗口工具栏和相关元素颜色调整 */
:global(body.light-theme) .preview-drawer-container {
  background-color: #ffffff !important;
  border-top-color: #e5e6eb !important;
}

:global(body.light-theme) .preview-toolbar {
  background-color: #ffffff !important;
  border-bottom-color: #e5e6eb !important;
}

:global(body.light-theme) .preview-title {
  color: #1d2129 !important;
  --preview-title-color: #1d2129;
}

:global(body.light-theme) .chart-controls {
  background: #f2f3f5 !important;
  --chart-controls-bg: #f2f3f5;
}

:global(body.light-theme) .divider {
  background-color: #e5e6eb !important;
  --divider-color: #e5e6eb;
}

:global(body.light-theme) .preview-content {
  background-color: #ffffff !important;
}

:global(body.light-theme) .mask-bg {
  background-color: rgba(0, 0, 0, 0.3) !important;
}
.logo-img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

/* 暗色主题适配 */
:global(body.dark-theme) .app-layout {
  --nb-header-bg: #252526;
  --nb-border-color: #3a3a3c;
  --nb-text-color: #f5f5f5;
}

:global(body.dark-theme) .header {
  background: #252526;
  border-bottom-color: #3a3a3c;
}

:global(body.dark-theme) .logo {
  color: #f5f5f5;
}
</style>