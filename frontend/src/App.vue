<template>
  <a-config-provider :locale="zhCN">
    <!-- 页面路由过渡动画 -->
    <router-view v-slot="{ Component, route }">
      <transition name="page-fade" mode="out-in">
        <component :is="Component" :key="route.path" />
      </transition>
    </router-view>
  </a-config-provider>
</template>

<script setup lang="ts">
import { useThemeStore } from '@/store/themeStore';
// 引入 Arco Design 的中文语言包
import zhCN from '@arco-design/web-vue/es/locale/lang/zh-cn';

// 初始化主题 - 确保应用启动时就应用主题
void useThemeStore(); // Used for side effects - initializes theme on app startup

// 如果你需要支持暗黑模式切换,可以在这里监听状态
</script>

<style>
/* 全局动画变量 */
:root {
  --transition-duration: 0.3s;
  --transition-timing: cubic-bezier(0.4, 0, 0.2, 1);
  --transition-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* 全局基础样式重置 */
html, body {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: var(--app-bg, #f2f3f5);
  /* 添加全局颜色过渡，使主题切换更平滑 */
  transition: background-color var(--transition-duration) var(--transition-timing),
              color var(--transition-duration) var(--transition-timing);
  /* 优化移动端滚动 */
  -webkit-overflow-scrolling: touch;
}

/* 默认情况下，body 允许滚动（Home 页面需要） */
body {
  overflow: auto;
}

/* Notebook 和 Code 页面需要 overflow: hidden */
body.page-notebook,
body.page-code {
  overflow: hidden;
}

/* 暗色主题背景 */
html.dark-theme,
body.dark-theme {
  --app-bg: #1e1e1e;
  background-color: #1e1e1e !important;
}

#app {
  width: 100%;
  height: 100%;
}

/* ===== 页面过渡动画 ===== */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* ===== 全局按钮动画增强 ===== */
.arco-btn {
  transition: all var(--transition-duration) var(--transition-timing) !important;
}

.arco-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.arco-btn:active {
  transform: translateY(0) scale(0.98);
}

/* 主要按钮悬停效果增强 */
.arco-btn-primary:hover {
  box-shadow: 0 4px 16px rgba(22, 93, 255, 0.4);
}

/* 图标按钮旋转效果 */
.arco-btn-text:hover .arco-icon,
.arco-btn-text:hover svg {
  transition: transform 0.3s var(--transition-bounce);
}

/* ===== 暗色主题滚动条样式 ===== */
body.dark-theme ::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

body.dark-theme ::-webkit-scrollbar-track {
  background-color: #1e1e1e;
}

body.dark-theme ::-webkit-scrollbar-thumb {
  background-color: #4e5969;
  border-radius: 5px;
  border: 2px solid #1e1e1e;
}

body.dark-theme ::-webkit-scrollbar-thumb:hover {
  background-color: #6b7785;
}

/* ===== 亮色主题滚动条样式优化 ===== */
body.light-theme ::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

body.light-theme ::-webkit-scrollbar-track {
  background-color: #f7f8fa;
}

body.light-theme ::-webkit-scrollbar-thumb {
  background-color: #c9cdd4;
  border-radius: 5px;
  border: 2px solid #f7f8fa;
}

body.light-theme ::-webkit-scrollbar-thumb:hover {
  background-color: #86909c;
}

/* ===== 通用动画工具类 ===== */
.fade-in {
  animation: fadeIn 0.3s ease forwards;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.scale-in {
  animation: scaleIn 0.3s var(--transition-bounce) forwards;
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

/* ===== 卡片悬停效果 ===== */
.arco-card {
  transition: transform var(--transition-duration) var(--transition-timing),
              box-shadow var(--transition-duration) var(--transition-timing) !important;
}

.arco-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

body.dark-theme .arco-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}
</style>