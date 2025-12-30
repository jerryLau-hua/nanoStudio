<template>
  <div class="home-wrapper">
    <!-- 粒子背景 -->
    <div class="particles-bg">
      <div class="particle" v-for="i in 20" :key="i" :style="getParticleStyle(i)"></div>
    </div>
    
    <div class="home-container">
    <!-- 右上角操作按钮 -->
    <div class="top-actions">
      <!-- 主题切换 - 左侧 -->
      <a-switch 
        v-model="isDark" 
        @change="handleThemeChange"
        :checked-color="'#3370ff'"
        :unchecked-color="'#86909c'"
      >
        <template #checked>🌙</template>
        <template #unchecked>☀️</template>
      </a-switch>
      
      <!-- 用户头像 - 右侧 -->
      <a-dropdown v-if="isAuthenticated" trigger="hover" position="br">
        <div class="user-avatar-container">
          <a-avatar :size="36" class="user-avatar">
            {{ userInitial }}
          </a-avatar>
        </div>
        <template #content>
          <a-doption @click="navigateTo('/profile')">
            <template #icon>
              <icon-user />
            </template>
            个人中心
          </a-doption>
          <a-doption @click="handleLogout">
            <template #icon>
              <icon-export />
            </template>
            退出登录
          </a-doption>
        </template>
      </a-dropdown>
      <div v-else class="login-prompt" @click="goToLogin">
        未登录
      </div>
    </div>
    
    <!-- 设置模态框 -->
    <SettingsModal v-model:visible="showSettings" @saved="handleSettingsSaved" />
    
    <div class="home-content">
      <!-- Logo 区域 -->
      <div class="logo-section">
        <!-- <div class="logo-icon">🧬</div> -->
         <div class="logo-icon" @click="handleLogoClick">
          <img src="@/assets/main.png" alt="Nano Studio Logo" class="logo-img" />
         </div>
        <h1 class="app-title">Nano Studio</h1>
        <p class="app-subtitle">微空间，大智能</p>
      </div>

      <!-- 功能卡片 -->
      <div class="features-grid">
        <!-- NotebookLM 卡片 -->
        <div class="feature-card card-animate" :style="{animationDelay: '0.1s'}" @click="navigateTo('/notebook')">
          <div class="card-icon-wrapper">
            <div class="card-icon">📚</div>
          </div>
          <h2 class="card-title">Notebook LM</h2>
          <p class="card-description">
            基于知识库的智能问答系统<br/>
            支持 PDF、网页等多种来源
          </p>
          <div class="card-features">
            <span class="feature-tag">智能问答</span>
            <span class="feature-tag">思维导图</span>
            <span class="feature-tag">自动摘要</span>
          </div>
          <a-button type="primary" long class="card-button">
            开始使用
            <icon-arrow-right />
          </a-button>
        </div>

        <!-- Code Archaeologist 卡片 -->
        <div class="feature-card card-animate" :style="{animationDelay: '0.2s'}" @click="navigateTo('/code')">
          <div class="card-icon-wrapper">
            <div class="card-icon">🔍</div>
          </div>
          <h2 class="card-title">Code Archaeologist</h2>
          <p class="card-description">
            代码考古工具<br/>
            深入理解代码库结构
          </p>
          <div class="card-features">
            <span class="feature-tag">代码分析</span>
            <span class="feature-tag">可视化</span>
            <span class="feature-tag">智能导航</span>
          </div>
          <a-button type="primary" long class="card-button">
            开始使用
            <icon-arrow-right />
          </a-button>
        </div>
      </div>

      <!-- 版本信息 -->
      <div class="footer">
        <p class="version">v1.0.0</p>
        <p class="copyright">Powered by Nano Studio @JerryLau</p>
      </div>
      </div>
    </div>

    <!-- 悬浮球 -->
    <div 
      class="floating-ball-container" 
      :style="{
        right: ballPosition.right,
        bottom: ballPosition.bottom,
        left: ballPosition.left,
        top: ballPosition.top
      }"
    >
      <!-- API Key 引导提示 -->
      <ApiKeyGuide 
        :visible="showApiKeyGuide && !showFloatingMenu" 
        :ball-side="ballSide"
        @dismiss="dismissGuide"
      />
      
      <transition name="menu-expand">
        <div v-if="showFloatingMenu" class="floating-menu" :class="menuPosition">
          <div class="menu-item" @click="showUserAgreement">
            <icon-file class="menu-icon" />
            <span>用户协议</span>
          </div>
          <div class="menu-item" @click="showQRCode">
            <icon-qrcode class="menu-icon" />
            <span>交流群</span>
          </div>
        </div>
      </transition>
      <div 
        class="floating-ball" 
        :class="{ 'is-dragging': isDragging }"
        @mousedown="startDrag"
        @touchstart="startTouchDrag"
        @touchend="handleBallTouchEnd"
        @click="handleBallClick"
      >
        <img :src="currentExpression" alt="kanbanniang" class="ghost-image" />
      </div>
    </div>

    <!-- 用户协议弹窗 -->
    <a-modal
      v-model:visible="userAgreementVisible"
      title="用户协议"
      :footer="false"
      :width="600"
    >
      <div class="agreement-content">
        <h3>服务条款</h3>
        <p>欢迎使用 Nano Studio！</p>
        <p>在使用本服务前，请仔细阅读以下服务条款：</p>
        <ol>
          <li>本服务仅供学习和研究使用</li>
          <li>用户需自行承担使用本服务的风险</li>
          <li>禁止用于任何违法违规用途</li>
          <li>我们重视您的隐私，不会收集敏感信息</li>
          <li>服务可能随时更新或中断</li>
        </ol>
        <h3>隐私政策</h3>
        <p>我们承诺保护您的个人隐私，仅收集必要的使用数据以改进服务。</p>
      </div>
    </a-modal>

    <!-- 交流群二维码弹窗 -->
    <a-modal
      v-model:visible="qrcodeVisible"
      title="加入交流群"
      :footer="false"
      :width="400"
    >
      <div class="qrcode-content">
        <div class="qrcode-placeholder">
          <img src="@/assets/q/image.png" alt="群二维码" class="qrcode-image" />
          <p>QQ群号：1073719941</p>
          <p style="font-size: 12px;">或扫描上方二维码</p>
          <p style="font-size: 12px; color: var(--color-text-3);">一起探讨AI应用开发</p>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useThemeStore } from '@/store/themeStore';
import { IconArrowRight, IconUser, IconExport, IconFile, IconQrcode } from '@arco-design/web-vue/es/icon';
import { Message } from '@arco-design/web-vue';
import { authApi } from '@/api/auth';
import SettingsModal from '@/components/SettingsModal.vue';
import ApiKeyGuide from '@/components/ApiKeyGuide.vue';
import { useOnboarding } from '@/composables/useOnboarding';

// --- 彩蛋逻辑 Start ---
const clickCount = ref(0);
let clickTimer: any = null;

const handleLogoClick = () => {
  clickCount.value++;
  
  // 清除之前的定时器
  if (clickTimer) clearTimeout(clickTimer);
  
  // 如果点击次数达到 3 次
  if (clickCount.value === 3) {
    Message.success('🔮 进入Nano Studio 赛博禅意空间...');
    // 使用 router.push 跳转，并带上一个 secret 参数作为"钥匙"
    router.push({ path: '/cyber', query: { key: 'cyber_zen_master' } });
    clickCount.value = 0; // 重置计数
  } else {
    // 如果在 500ms 内没有下一次点击，重置计数
    clickTimer = setTimeout(() => {
      clickCount.value = 0;
    }, 500);
  }
};
// --- 彩蛋逻辑 End ---


// 看板娘表情系统（简化版）
const initExpression = new URL('@/assets/kanbanniang/init.png', import.meta.url).href;
const clickExpression = new URL('@/assets/kanbanniang/click.png', import.meta.url).href;
const currentExpression = ref(initExpression);

// 悬浮球状态
const showFloatingMenu = ref(false);
const userAgreementVisible = ref(false);
const qrcodeVisible = ref(false);
const isDragging = ref(false);
const ballPosition = ref({
  right: '-20px',
  bottom: '120px',
  left: 'auto',
  top: 'auto'
});
const menuPosition = ref('menu-left'); // 'menu-left' 或 'menu-right'
const ballSide = ref<'left' | 'right'>('right'); // 记录看板娘在左边还是右边

const router = useRouter();
const themeStore = useThemeStore();

const showSettings = ref(false);
const isAuthenticated = ref(false);
const currentUser = ref<any>(null);

const isDark = computed({
  get: () => themeStore.theme === 'dark',
  set: (value) => themeStore.setTheme(value ? 'dark' : 'light')
});

const userInitial = computed(() => {
  if (!currentUser.value?.username) return 'U';
  return currentUser.value.username.charAt(0).toUpperCase();
});

// 新手引导
const { showApiKeyGuide, checkApiKeySetup, dismissGuide } = useOnboarding();

onMounted(() => {
  isAuthenticated.value = authApi.isAuthenticated();
  if (isAuthenticated.value) {
    currentUser.value = authApi.getCurrentUser();
    // 检查 API Key 配置状态
    checkApiKeySetup();
  }
});

const navigateTo = (path: string) => {
  // 检查是否需要登录
  if (path !== '/' && !authApi.isAuthenticated()) {
    router.push('/auth?redirect=' + encodeURIComponent(path));
    return;
  }
  router.push(path);
};

const goToLogin = () => {
  router.push('/auth');
};

const handleThemeChange = (value: string | number | boolean) => {
  themeStore.setTheme(value ? 'dark' : 'light');
};

const handleSettingsSaved = () => {
  console.log('Settings saved successfully');
};

const handleLogout = async () => {
  await authApi.logout();
  isAuthenticated.value = false;
  currentUser.value = null;
  Message.success('已退出登录');
};

// 悬浮球拖动相关（优化版）
let dragStartX = 0;
let dragStartY = 0;
let ballStartX = 0;
let ballStartY = 0;
let hasMoved = false;
let animationFrameId: number | null = null;

// 统一的拖动开始处理
const startDragCommon = (clientX: number, clientY: number, target: HTMLElement) => {
  isDragging.value = true;
  hasMoved = false;
  dragStartX = clientX;
  dragStartY = clientY;
  
  // 计算小球当前位置
  const rect = target.closest('.floating-ball-container')?.getBoundingClientRect();
  if (rect) {
    ballStartX = rect.left;
    ballStartY = rect.top;
  }
};

// 鼠标拖动开始
const startDrag = (e: MouseEvent) => {
  startDragCommon(e.clientX, e.clientY, e.target as HTMLElement);
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
  e.preventDefault();
};

// 触摸拖动开始
const startTouchDrag = (e: TouchEvent) => {
  if (e.touches.length !== 1) return;
  const touch = e.touches[0]!; // 非空断言，因为上面已经检查了长度
  startDragCommon(touch.clientX, touch.clientY, e.target as HTMLElement);
  document.addEventListener('touchmove', onTouchDrag, { passive: false });
  document.addEventListener('touchend', stopTouchDrag);
  document.addEventListener('touchcancel', stopTouchDrag);
  // 不要在这里调用 preventDefault()，否则会阻止 click 事件
  // 只在真正开始拖动时才阻止默认行为
};

// 统一的拖动处理
const handleDragMove = (clientX: number, clientY: number) => {
  if (!isDragging.value) return;
  
  const deltaX = clientX - dragStartX;
  const deltaY = clientY - dragStartY;
  
  // 如果移动超过5px，认为是拖动而非点击
  if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
    hasMoved = true;
  }
  
  // 使用 requestAnimationFrame 优化性能
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  
  animationFrameId = requestAnimationFrame(() => {
    const newX = ballStartX + deltaX;
    const newY = ballStartY + deltaY;
    
    // 临时设置位置（拖动中）
    ballPosition.value = {
      left: `${newX}px`,
      top: `${newY}px`,
      right: 'auto',
      bottom: 'auto'
    };
  });
};

// 鼠标拖动
const onDrag = (e: MouseEvent) => {
  handleDragMove(e.clientX, e.clientY);
};

// 触摸拖动
const onTouchDrag = (e: TouchEvent) => {
  if (e.touches.length !== 1) return;
  const touch = e.touches[0]!; // 非空断言
  handleDragMove(touch.clientX, touch.clientY);
  // 在移动时阻止默认行为（如滚动）
  e.preventDefault();
};

// 统一的拖动结束处理
const handleDragEnd = (rect: DOMRect | null) => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  if (hasMoved && rect) {
    // 计算最近的边缘并吸附
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const ballWidth = 48; // 小球宽度
    
    const centerX = rect.left + ballWidth / 2;
    const centerY = rect.top + ballWidth / 2;
    
    // 计算到各边的距离
    const distToLeft = centerX;
    const distToRight = windowWidth - centerX;
    const distToTop = centerY;
    const distToBottom = windowHeight - centerY;
    
    // 找到最近的边
    const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
    
    // 移动端：完全显示；桌面端：半隐藏
    const isMobile = windowWidth <= 768;
    const edgeOffset = isMobile ? 0 : -20;
    
    // 吸附到最近的边
    if (minDist === distToRight) {
      // 吸附右边
      ballPosition.value = {
        right: `${edgeOffset}px`,
        top: `${rect.top}px`,
        left: 'auto',
        bottom: 'auto'
      };
      menuPosition.value = 'menu-left';
      ballSide.value = 'right';
    } else if (minDist === distToLeft) {
      // 吸附左边
      ballPosition.value = {
        left: `${edgeOffset}px`,
        top: `${rect.top}px`,
        right: 'auto',
        bottom: 'auto'
      };
      menuPosition.value = 'menu-right';
      ballSide.value = 'left';
    } else if (minDist === distToTop) {
      // 吸附顶部（吸附到右侧）
      ballPosition.value = {
        right: `${edgeOffset}px`,
        top: `${rect.top}px`,
        left: 'auto',
        bottom: 'auto'
      };
      menuPosition.value = 'menu-left';
      ballSide.value = 'right';
    } else {
      // 吸附底部（吸附到右侧）
      ballPosition.value = {
        right: `${edgeOffset}px`,
        bottom: `${windowHeight - rect.bottom}px`,
        left: 'auto',
        top: 'auto'
      };
      menuPosition.value = 'menu-left';
      ballSide.value = 'right';
    }
  }
  
  isDragging.value = false;
};

// 鼠标拖动结束
const stopDrag = (e: MouseEvent) => {
  if (!isDragging.value) return;
  
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
  
  const rect = (e.target as HTMLElement).closest('.floating-ball-container')?.getBoundingClientRect() || null;
  handleDragEnd(rect);
};

// 触摸拖动结束
const stopTouchDrag = (e: TouchEvent) => {
  if (!isDragging.value) return;
  
  document.removeEventListener('touchmove', onTouchDrag);
  document.removeEventListener('touchend', stopTouchDrag);
  document.removeEventListener('touchcancel', stopTouchDrag);
  
  const rect = (e.target as HTMLElement).closest('.floating-ball-container')?.getBoundingClientRect() || null;
  handleDragEnd(rect);
};

// 悬浮球点击处理（鼠标）
const handleBallClick = () => {
  // 只有在没有拖动的情况下才触发菜单
  if (!hasMoved) {
    showFloatingMenu.value = !showFloatingMenu.value;
    // 切换表情
    currentExpression.value = showFloatingMenu.value ? clickExpression : initExpression;
  }
};

// 悬浮球触摸点击处理
const handleBallTouchEnd = (e: TouchEvent) => {
  // 只有在没有拖动的情况下才触发菜单
  if (!hasMoved && !isDragging.value) {
    // 阻止触发重复的鼠标点击事件
    e.preventDefault();
    showFloatingMenu.value = !showFloatingMenu.value;
    // 切换表情
    currentExpression.value = showFloatingMenu.value ? clickExpression : initExpression;
  }
};

// 悬浮球方法
const showUserAgreement = () => {
  userAgreementVisible.value = true;
  showFloatingMenu.value = false;
};

const showQRCode = () => {
  qrcodeVisible.value = true;
  showFloatingMenu.value = false;
};

// 粒子背景动画
const getParticleStyle = (_index: number) => {
  const size = Math.random() * 4 + 2; // 2-6px
  const duration = Math.random() * 15 + 10; // 10-25s
  const delay = Math.random() * 5; // 0-5s
  const startX = Math.random() * 100; // 0-100%
  
  return {
    width: `${size}px`,
    height: `${size}px`,
    left: `${startX}%`,
    animationDuration: `${duration}s`,
    animationDelay: `${delay}s`,
  };
};
</script>

<style scoped>
/* 粒子背景 */
.particles-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.particle {
  position: absolute;
  bottom: -10px;
  background: radial-gradient(circle, rgba(51, 112, 255, 0.3), rgba(51, 112, 255, 0));
  border-radius: 50%;
  animation: float-up 20s linear infinite;
  opacity: 0;
}

@keyframes float-up {
  0% {
    bottom: -10px;
    opacity: 0;
  }
  10% {
    opacity: 0.6;
  }
  90% {
    opacity: 0.2;
  }
  100% {
    bottom: 110%;
    opacity: 0;
    transform: translateX(calc(50vw - 50%)) scale(1.5);
  }
}

.home-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.home-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px 20px;
  background: linear-gradient(135deg, 
    var(--home-bg-start, #f0f2ff) 0%, 
    var(--home-bg-end, #fef0f5) 100%
  );
  transition: background 0.3s ease;
  position: relative;
  box-sizing: border-box;
}

/* 移动端优化 */
@media (max-width: 768px) {
  .home-container {
    padding: 20px 16px;
    min-height: 100vh;
  }
}

/* 右上角操作按钮 */
.top-actions {
  position: absolute;
  top: 32px;
  right: 32px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  animation: fadeInDown 0.6s ease;
}

/* 移动端：缩小间距 */
@media (max-width: 768px) {
  .top-actions {
    top: 16px;
    right: 16px;
    gap: 8px;
  }
}

.user-avatar-container {
  cursor: pointer;
  transition: transform 0.2s ease;
}

.user-avatar-container:hover {
  transform: scale(1.05);
}

.user-avatar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.login-prompt {
  font-size: 14px;
  color: var(--home-settings-color, #4e5969);
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.login-prompt:hover {
  background: var(--color-fill-2);
  color: #165DFF;
}

.settings-btn {
  color: var(--home-settings-color, #4e5969);
  font-size: 20px;
  transition: all 0.3s ease;
}

.settings-btn:hover {
  color: var(--home-settings-hover, #3370ff);
  transform: rotate(90deg);
}

.home-content {
  max-width: 1200px;
  width: 100%;
  text-align: center;
}

/* 移动端优化 */
@media (max-width: 768px) {
  .home-content {
    padding: 0;
  }
}

/* Logo 区域 */
.logo-section {
  margin-bottom: 60px;
  animation: fadeInDown 0.8s ease;
}

.logo-icon {
  font-size: 80px;
  margin-bottom: 20px;
  animation: float 3s ease-in-out infinite;
}

.logo-img {
  width: 95px;
  height: 95px;
  object-fit: contain;
}

.app-title {
  font-size: 48px;
  font-weight: 700;
  color: var(--home-title-color, #1d2129);
  margin: 0 0 12px 0;
  background: linear-gradient(135deg, #3370ff, #722ed1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.app-subtitle {
  font-size: 18px;
  color: var(--home-subtitle-color, #4e5969);
  margin: 0;
}

/* 移动端：Logo区域优化 */
@media (max-width: 768px) {
  .logo-section {
    margin-bottom: 40px;
  }
  
  .logo-icon {
    font-size: 60px;
  }
  
  .logo-img {
    width: 70px;
    height: 70px;
  }
  
  .app-title {
    font-size: 32px;
  }
  
  .app-subtitle {
    font-size: 14px;
  }
}

/* 功能卡片网格 */
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 32px;
  margin-bottom: 60px;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

/* 平板端优化 */
@media (min-width: 769px) and (max-width: 1024px) {
  .features-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
    margin-bottom: 48px;
  }
}

/* 移动端优化 */
@media (max-width: 768px) {
  .features-grid {
    grid-template-columns: 1fr;
    gap: 20px;
    margin-bottom: 40px;
  }
}

/* 卡片动画 */
.card-animate {
  animation: cardSlideIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  opacity: 0;
  transform: translateY(30px);
}

@keyframes cardSlideIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.feature-card {
  background: var(--card-bg, #ffffff);
  border-radius: 16px;
  padding: 40px 32px;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  border: 2px solid var(--card-border, transparent);
  box-shadow: var(--card-shadow, 0 4px 20px rgba(0, 0, 0, 0.08));
  position: relative;
  overflow: hidden;
}

.feature-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(51, 112, 255, 0.1), transparent);
  transition: left 0.6s;
}

.feature-card:hover::before {
  left: 100%;
}

.feature-card:hover {
  transform: translateY(-12px) scale(1.02);
  box-shadow: var(--card-hover-shadow, 0 16px 48px rgba(51, 112, 255, 0.25));
  border-color: var(--card-hover-border, #3370ff);
}

/* 卡片图标容器 */
.card-icon-wrapper {
  margin-bottom: 20px;
  display: inline-block;
}

.card-icon {
  font-size: 64px;
  display: inline-block;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  animation: float 3s ease-in-out infinite;
}

.feature-card:hover .card-icon {
  transform: scale(1.15) rotate(5deg);
  filter: drop-shadow(0 8px 16px rgba(51, 112, 255, 0.3));
}

.card-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--card-title-color, #1d2129);
  margin: 0 0 12px 0;
}

.card-description {
  font-size: 14px;
  color: var(--card-desc-color, #4e5969);
  line-height: 1.6;
  margin: 0 0 20px 0;
  min-height: 44px;
}

/* 移动端：卡片优化 */
@media (max-width: 768px) {
  .feature-card {
    padding: 32px 24px;
    border-radius: 12px;
  }
  
  /* 移动端禁用 hover 变换效果，保留点击效果 */
  .feature-card:hover {
    transform: none;
  }
  
  .feature-card:active {
    transform: scale(0.98);
  }
  
  .card-icon {
    font-size: 48px;
  }
  
  .card-icon-wrapper {
    margin-bottom: 16px;
  }
  
  .card-title {
    font-size: 20px;
  }
  
  .card-description {
    font-size: 13px;
    min-height: auto;
  }
}

.card-features {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.feature-tag {
  background: var(--tag-bg, #f2f3f5);
  color: var(--tag-color, #4e5969);
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.card-button {
  margin-top: 8px;
}

/* 主题切换区域 */
.theme-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px;
  background: var(--theme-section-bg, rgba(255, 255, 255, 0.8));
  border-radius: 16px;
  backdrop-filter: blur(10px);
  max-width: 400px;
  margin: 0 auto 40px;
  box-shadow: var(--theme-section-shadow, 0 2px 12px rgba(0, 0, 0, 0.06));
}

.theme-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
  color: var(--theme-label-color, #1d2129);
}

/* 页脚 */
.footer {
  color: var(--footer-color, #86909c);
  font-size: 14px;
}

.version {
  margin: 0 0 4px 0;
  font-weight: 500;
}

.copyright {
  margin: 0;
}

/* 移动端：页脚优化 */
@media (max-width: 768px) {
  .footer {
    font-size: 12px;
    padding: 0 16px;
  }
}

/* 动画 */
@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

/* 暗色主题 */
:global(body.dark-theme) .home-container {
  --home-bg-start: #1a1a1a;
  --home-bg-end: #252526;
  --home-title-color: #f5f5f5;
  --home-subtitle-color: #c9cdd4;
  --card-bg: #2a2a2b;
  --card-border: transparent;
  --card-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  --card-hover-shadow: 0 12px 40px rgba(51, 112, 255, 0.4);
  --card-hover-border: #3370ff;
  --card-title-color: #f5f5f5;
  --card-desc-color: #c9cdd4;
  --tag-bg: #3a3a3c;
  --tag-color: #c9cdd4;
  --theme-section-bg: rgba(42, 42, 43, 0.8);
  --theme-section-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  --theme-label-color: #f5f5f5;
  --footer-color: #86909c;
  --home-settings-color: #c9cdd4;
  --home-settings-hover: #3370ff;
}

/* 旧的响应式代码已整合到上面各组件中，此处移除避免重复 */

/* 悬浮球样式 */
.floating-ball-container {
  position: fixed;
  right: -20px;
  bottom: 120px;
  z-index: 1000;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.floating-ball {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-bg-5);
  box-shadow: 0 4px 12px var(--color-border-2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
  cursor: move;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  position: relative;
  border: 2px solid var(--color-border-3);
}

.floating-ball.is-dragging {
  cursor: grabbing;
  box-shadow: 0 8px 24px var(--color-border-3);
  transform: scale(1.1);
}

.ghost-image {
  width: 36px;
  height: 36px;
  object-fit: contain;
  pointer-events: none;
}

.floating-ball:hover {
  box-shadow: 0 6px 20px var(--color-border-2);
  transform: scale(1.05);
}

/* 移动端：悬浮球优化 */
@media (max-width: 768px) {
  .floating-ball-container {
    right: 0; /* 移动端完全显示，不隐藏一半 */
    bottom: 80px;
  }
  
  .floating-ball {
    width: 44px;
    height: 44px;
  }
  
  .ghost-image {
    width: 32px;
    height: 32px;
  }
}

.floating-menu {
  position: absolute;
  bottom: 0;
  background: var(--color-bg-2);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  padding: 8px;
  min-width: 160px;
  border: 1px solid var(--color-border-2);
}

/* 菜单在左侧时（小球在右边） */
.menu-left {
  right: 60px;
}

/* 菜单在右侧时（小球在左边） */
.menu-right {
  left: 60px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--color-text-1);
  font-size: 14px;
}

.menu-item:hover {
  background: var(--color-fill-2);
}

.menu-icon {
  font-size: 18px;
  color: var(--color-text-3);
}

/* 菜单展开动画 */
.menu-expand-enter-active,
.menu-expand-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.menu-expand-enter-from {
  opacity: 0;
  transform: translateX(20px) scale(0.8);
}

.menu-expand-leave-to {
  opacity: 0;
  transform: translateX(20px) scale(0.8);
}

/* 协议内容样式 */
.agreement-content {
  line-height: 1.8;
  color: var(--color-text-1);
}

.agreement-content h3 {
  margin-top: 24px;
  margin-bottom: 12px;
  font-size: 16px;
  color: var(--color-text-1);
}

.agreement-content h3:first-child {
  margin-top: 0;
}

.agreement-content ol {
  padding-left: 24px;
  margin: 12px 0;
}

.agreement-content li {
  margin: 8px 0;
  color: var(--color-text-2);
}

.agreement-content p {
  margin: 12px 0;
  color: var(--color-text-2);
}

/* 二维码内容样式 */
.qrcode-content {
  display: flex;
  justify-content: center;
  padding: 24px 0;
}

.qrcode-placeholder {
  text-align: center;
}

.qrcode-image {
  max-width: 280px;
  max-height: 280px;
  width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
