<template>
  <a-layout class="notebook-layout">
    <!-- 1. 顶部导航 -->
    <a-layout-header class="header">
      <div class="header-left">
        <a-button type="text" @click="goHome">
          <icon-home />
          返回首页
        </a-button>
        <a-divider direction="vertical" />
        <div class="logo">
          <img src="@/assets/ai.png" class="logo-img" alt="AI" />
          My Nano NotebookLM </div>
      </div>
      <a-space>
        <a-button type="text" class="theme-toggle-btn" @click="themeStore.toggleTheme()">
          <transition name="theme-icon" mode="out-in">
            <icon-sun-fill v-if="themeStore.theme === 'light'" key="sun" class="theme-icon" />
            <icon-moon-fill v-else key="moon" class="theme-icon" />
          </transition>
        </a-button>
        <!-- <a-button type="text">分享</a-button>
        <a-avatar :size="32" style="background-color: #3370ff">User</a-avatar> -->
      </a-space>
    </a-layout-header>

    <!-- 移动端遮罩层 -->
    <div 
      v-if="!leftCollapsed || !rightCollapsed" 
      class="mobile-overlay"
      @click="closeMobileSiders"
    ></div>

    <a-layout class="body-layout">
      <!-- 2. 左侧：来源面板 (支持收起) -->
      <a-layout-sider
          class="sider-sources"
          :width="320"
          collapsible
          :collapsed="leftCollapsed"
          :collapsed-width="0"
          hide-trigger
      >
        <!-- 只有没收起时才渲染内容 -->
        <div class="sider-inner" v-show="!leftCollapsed">
          <!-- 监听 close 事件，实现内部关闭 -->
          <SourcePanel @close="leftCollapsed = true" />
        </div>
      </a-layout-sider>

      <!-- 3. 中间：核心内容区 -->
      <a-layout-content class="main-content">
        <!-- 中间顶部的工具栏：用于在侧边栏收起时把它们点开 -->
        <div class="chat-toolbar">
          <!-- 左侧展开按钮 -->
          <div class="toolbar-left">
            <a-tooltip :content="leftCollapsed ? '展开来源列表' : '收起来源列表'" position="right">
              <a-button 
                shape="circle" 
                size="small" 
                @click="leftCollapsed = !leftCollapsed"
                class="sider-toggle-btn"
              >
                <icon-menu-unfold v-if="leftCollapsed" />
                <icon-menu-fold v-else />
              </a-button>
            </a-tooltip>
          </div>

          <span class="toolbar-title">
            <span v-if="store.activeSourceNames">基于: {{ store.activeSourceNames }}</span>
            <span v-else>无选定来源</span>
          </span>

          <!-- 右侧展开按钮 -->
          <div class="toolbar-right">
            <a-tooltip :content="rightCollapsed ? '打开 Studio' : '关闭 Studio'" position="left">
              <a-button 
                shape="circle" 
                size="small" 
                @click="rightCollapsed = !rightCollapsed"
                class="sider-toggle-btn"
              >
                <icon-apps v-if="rightCollapsed" />
                <icon-close v-else />
              </a-button>
            </a-tooltip>
          </div>
        </div>

        <!-- 真正的对话滚动区 (竖向滚动) -->
        <div class="chat-scroll-area">
          <ChatArea />
        </div>
      </a-layout-content>

      <!-- 4. 右侧：Studio 面板 (支持收起 + 放大) -->
      <a-layout-sider
          class="sider-studio"
          :width="rightExpanded ? 800 : 360"
          collapsible
          :collapsed="rightCollapsed"
          :collapsed-width="0"
          hide-trigger
      >
        <div class="sider-inner" v-show="!rightCollapsed">
          <!-- 传入 isExpanded 状态，并监听 toggle-expand 和 close 事件 -->
          <StudioPanel
              :is-expanded="rightExpanded"
              @toggle-expand="rightExpanded = !rightExpanded"
              @close="rightCollapsed = true"
          />
        </div>
      </a-layout-sider>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useNotebookStore } from '@/store/notebookStore';
import { useThemeStore } from '@/store/themeStore';
import SourcePanel from './components/SourcePanel.vue';
import ChatArea from './components/ChatArea.vue';
import StudioPanel from './components/StudioPanel.vue';
import { IconMenuUnfold, IconMenuFold, IconApps, IconClose, IconHome, IconSunFill, IconMoonFill } from '@arco-design/web-vue/es/icon';

const router = useRouter();
const store = useNotebookStore();
const themeStore = useThemeStore();

// 布局状态控制
const leftCollapsed = ref(false);
const rightCollapsed = ref(false);
const rightExpanded = ref(false); // 控制右侧是否处于"宽屏/放大"模式

const goHome = () => {
  router.push('/');
};

// 移动端关闭侧边栏
const closeMobileSiders = () => {
  leftCollapsed.value = true;
  rightCollapsed.value = true;
};

// 检测屏幕宽度并设置初始状态
const checkMobileView = () => {
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    leftCollapsed.value = true;
    rightCollapsed.value = true;
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

<style scoped>
.notebook-layout { 
  height: 100vh; 
  background: var(--nb-layout-bg, #fff); 
  display: flex; 
  flex-direction: column; 
}
.header {
  height: 60px; flex-shrink: 0; 
  background: var(--nb-header-bg, white); 
  border-bottom: 1px solid var(--nb-border-color, #e5e6eb);
  display: flex; justify-content: space-between; align-items: center; padding: 0 20px; z-index: 10;
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
  color: var(--app-header-text);
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

/* 移动端：简化 logo 文字 */
@media (max-width: 768px) {
  .logo {
    font-size: 14px;
  }
  
  .logo-img {
    width: 20px;
    height: 20px;
  }
}
.body-layout { flex: 1; overflow: hidden; }

/* 侧边栏样式 */
.sider-sources { 
  background: var(--nb-panel-bg, white); 
  height: 100%; 
  position: relative; 
  border-right: 1px solid var(--nb-border-color, #e5e6eb);
}

.sider-studio { 
  background: var(--nb-panel-bg, white); 
  height: 100%; 
  position: relative; 
  border-left: 1px solid var(--nb-border-color, #e5e6eb);
  transition: all 0.3s cubic-bezier(0.34, 0.69, 0.1, 1);
}

/* 平板端：缩小侧边栏宽度 */
@media (min-width: 769px) and (max-width: 1024px) {
  .sider-sources {
    width: 280px !important;
    min-width: 280px !important;
  }
  
  .sider-studio {
    width: 320px !important;
    min-width: 320px !important;
  }
}

/* 移动端遮罩层 */
.mobile-overlay {
  display: none; /* 桌面端隐藏 */
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

/* 移动端：侧边栏覆盖显示 */
@media (max-width: 768px) {
  .sider-sources,
  .sider-studio {
    position: fixed !important;
    top: 56px;
    bottom: 0;
    z-index: 100;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
    transition: transform 0.3s cubic-bezier(0.34, 0.69, 0.1, 1);
  }
  
  .sider-sources {
    left: 0;
    width: 280px !important;
    max-width: 85vw !important;
  }
  
  /* 隐藏时滑出屏幕 */
  .sider-sources.arco-layout-sider-collapsed {
    transform: translateX(-100%);
  }
  
  .sider-studio {
    right: 0;
    width: 320px !important;
    max-width: 90vw !important;
  }
  
  /* 隐藏时滑出屏幕 */
  .sider-studio.arco-layout-sider-collapsed {
    transform: translateX(100%);
  }
  
  /* 移动端默认隐藏侧边栏，显示切换按钮 */
  .sider-toggle-btn {
    display: inline-flex !important;
  }
}

.sider-inner { height: 100%; overflow: hidden; background: inherit; }

/* 中间区域布局 */
.main-content {
  display: flex;
  flex-direction: column;
  background: var(--nb-content-bg, #fff);
  position: relative;
  min-width: 0;
}

/* 中间顶部工具栏 */
.chat-toolbar {
  height: 50px;
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid var(--nb-border-color, #f2f3f5);
  background: var(--nb-content-bg, #fff);
}

.toolbar-title { font-size: 14px; font-weight: 500; color: #4e5969; }

/* 核心：中间滚动区域 */
.chat-scroll-area {
  flex: 1;
  overflow-y: auto;
  height: 0;
}

/* 移动端：工具栏优化 */
@media (max-width: 768px) {
  .chat-toolbar {
    height: 48px;
    padding: 0 12px;
  }
  
  .toolbar-title {
    font-size: 13px;
    /* 移动端截断过长文本 */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 60vw;
  }
}

/* 覆盖 Arco 默认样式，让过渡更平滑 */
:deep(.arco-layout-sider) {
  transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1), 
              min-width 0.35s cubic-bezier(0.4, 0, 0.2, 1), 
              max-width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
:deep(.arco-layout-sider-children) {
  overflow: hidden;
}

/* 侧边栏内容过渡 */
.sider-inner {
  transition: opacity 0.25s ease;
}

/* ===== 主题切换按钮动画 ===== */
.theme-toggle-btn {
  overflow: hidden;
}

.theme-icon {
  font-size: 18px;
  display: block;
}

.theme-icon-enter-active,
.theme-icon-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.theme-icon-enter-from {
  opacity: 0;
  transform: rotate(-90deg) scale(0.5);
}

.theme-icon-leave-to {
  opacity: 0;
  transform: rotate(90deg) scale(0.5);
}

/* ===== 工具栏按钮出现动画 ===== */
.toolbar-left,
.toolbar-right {
  transition: opacity 0.2s ease;
}

/* 暗色主题适配 */
:global(body.dark-theme) .notebook-layout {
  --nb-layout-bg: #1e1e1e;
  --nb-header-bg: #252526;
  --nb-border-color: #3a3a3c;
  --nb-text-color: #f5f5f5;
  
  /* 面板和卡片 */
  --nb-panel-bg: #252526;
  --nb-panel-bg-secondary: #1e1e1e;
  --nb-card-bg: #2a2a2b;
  --nb-content-bg: #1e1e1e;
  
  /* 文本颜色 */
  --nb-text-secondary: #c9cdd4;
  --nb-text-disabled: #86909c;
  
  /* 表单和输入 */
  --nb-input-bg: #3a3a3c;
  --nb-input-focus-bg: #2a2a2b;
  --nb-add-box-bg: #2a2a2b;
  
  /* 边框和分隔线 */
  --nb-item-border: #3a3a3c;
  
  /* 交互元素 */
  --nb-hover-bg: #3a3a3c;
  --nb-tag-bg: #3a3a3c;
  
  /* 用户消息气泡 */
  --nb-user-bubble-bg: #1e3a5f;
  
  /* 画布和节点 */
  --nb-canvas-bg: #1e1e1e;
  --nb-node-bg: #2a2a2b;
  --nb-node-border: #4e5969;
}

:global(body.dark-theme) .sider-sources,
:global(body.dark-theme) .sider-studio {
  background: #252526 !important;
}

:global(body.dark-theme) .main-content {
  background: #1e1e1e !important;
}

:global(body.dark-theme) .chat-toolbar {
  background: #252526 !important;
  border-bottom-color: #3a3a3c !important;
}

:global(body.dark-theme) .toolbar-title {
  color: #c9cdd4;
}

/* 暗色主题：边框改为深色 */
:global(body.dark-theme) .sider-sources {
  border-right-color: #1a1a1a !important;
}

:global(body.dark-theme) .sider-studio {
  border-left-color: #1a1a1a !important;
}

/* 暗色主题：修复侧边栏收起时的闪白屏问题 */
:global(body.dark-theme) .body-layout {
  background: #1e1e1e !important;
}

:global(body.dark-theme) .sider-sources,
:global(body.dark-theme) .sider-studio,
:global(body.dark-theme) .sider-inner {
  background: #252526 !important;
}

:global(body.dark-theme) .main-content,
:global(body.dark-theme) .chat-scroll-area {
  background: #1e1e1e !important;
}

/* 全局颜色过渡 - 主题切换更平滑 */
.notebook-layout,
.header,
.sider-sources,
.sider-studio,
.main-content,
.chat-toolbar {
  transition: background-color 0.3s ease, 
              border-color 0.3s ease,
              color 0.3s ease;
}
</style>