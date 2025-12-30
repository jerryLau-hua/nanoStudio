<script setup>
import { ref, computed, onMounted, onUnmounted, reactive, nextTick } from 'vue';
import { useRouter } from 'vue-router'; // 引入路由
// ==========================================
// 核心：组合式函数 (Composables)
// ==========================================

// --- 1. 音频管理 Hook (优化版) ---
const useAudioSystem = (soundEnabled) => {
  let audioCtx = null;
  let masterGain = null;

  // 初始化音频上下文
  const initCtx = () => {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.5; // 全局音量
        masterGain.connect(audioCtx.destination);
      }
    }
    // 恢复被浏览器挂起的上下文
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  };

  const playTone = (type, freqStart, freqEnd, duration, volStart = 0.5) => {
    if (!soundEnabled.value) return;
    try {
      const ctx = initCtx();
      if (!ctx) return;
      
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, t);
      if (freqEnd) {
        osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration * 0.8);
      }
      
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(volStart, t + 0.01); // Attack
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration); // Decay
      
      osc.connect(gain);
      gain.connect(masterGain); 
      
      osc.start(t);
      osc.stop(t + duration + 0.05);
    } catch(e) { console.error(e); }
  };

  return { playTone, initCtx };
};

// --- 2. 粒子背景 Hook ---
const useParticles = () => {
  const getParticleStyle = () => ({
    width: `${Math.random() * 4 + 2}px`,
    height: `${Math.random() * 4 + 2}px`,
    left: `${Math.random() * 100}%`,
    animationDuration: `${Math.random() * 15 + 10}s`,
    animationDelay: `${Math.random() * 5}s`,
  });
  return { getParticleStyle };
};

// --- 3. 电子木鱼 Hook ---
const useWoodenFish = (playTone) => {
  const meritCount = ref(0);
  const isKnocking = ref(false);
  const floatingTexts = ref([]);
  const ripples = ref([]);
  let textIdCounter = 0;
  let rippleIdCounter = 0;

  const knock = (e) => {
    isKnocking.value = true;
    meritCount.value++;
    playTone('triangle', 800, 750, 0.15, 0.8);

    let clientX, clientY;
    if (e.type === 'touchstart' && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    // 1. 计算浮动文字坐标 (相对于容器 .fish-view)
    const container = document.querySelector('.fish-view');
    let textX = 0, textY = 0;
    if (container) {
      const rect = container.getBoundingClientRect();
      textX = clientX - rect.left;
      textY = clientY - rect.top;
    }

    // 2. 计算波纹坐标 (相对于木鱼主体 .fish-wrapper)
    const wrapper = document.querySelector('.fish-wrapper');
    let rippleX = 0, rippleY = 0;
    if (wrapper) {
      const rect = wrapper.getBoundingClientRect();
      rippleX = clientX - rect.left;
      rippleY = clientY - rect.top;
    }

    // 添加浮动文字
    const textId = textIdCounter++;
    const randomAngle = (Math.random() - 0.5) * 30;
    const randomScale = 0.8 + Math.random() * 0.4;
    floatingTexts.value.push({ 
      id: textId, 
      x: textX, 
      y: textY - 50, 
      style: { transform: `rotate(${randomAngle}deg) scale(${randomScale})` }
    });

    // 添加波纹 (使用 rippleX/Y)
    const rippleId = rippleIdCounter++;
    ripples.value.push({ id: rippleId, x: rippleX, y: rippleY });

    setTimeout(() => { isKnocking.value = false; }, 80);
    setTimeout(() => { floatingTexts.value = floatingTexts.value.filter(t => t.id !== textId); }, 800);
    setTimeout(() => { ripples.value = ripples.value.filter(r => r.id !== rippleId); }, 600);
  };

  return { meritCount, isKnocking, floatingTexts, ripples, knock };
};

// --- 4. 赛博求签 Hook (扩充签文库) ---
const useDivination = (playTone) => {
  const isShaking = ref(false);
  const showStick = ref(false);
  const result = ref(null);
  const hintText = ref('长按签筒求签');
  
  let shakeInterval = null;
  let startTime = 0;
  const MIN_SHAKE_TIME = 1000;
  
  // 扩充后的签文库
  const fortunes = [
    { type: '大吉', color: '#ef4444', text: 'Bug 退散', todo: '宜：发布上线', nottodo: '忌：立 Flag' },
    { type: '中吉', color: '#f59e0b', text: '如丝般顺滑', todo: '宜：代码重构', nottodo: '忌：开无聊的会' },
    { type: '小吉', color: '#10b981', text: '稳中向好', todo: '宜：摸鱼划水', nottodo: '忌：通宵熬夜' },
    { type: '末吉', color: '#8b5cf6', text: '再接再厉', todo: '宜：及时备份', nottodo: '忌：rm -rf *' },
    { type: '赛博凶', color: '#3b82f6', text: '404 Not Found', todo: '宜：关机睡觉', nottodo: '忌：写正则' },
    // 新增趣味签文
    { type: '上上签', color: '#db2777', text: '需求冻结', todo: '宜：准时下班', nottodo: '忌：主动加班' },
    { type: '赛博桃花', color: '#ec4899', text: '对象 New 出来了', todo: '宜：面向对象', nottodo: '忌：单例模式' },
    { type: '大凶', color: '#57534e', text: '产品经理来电', todo: '宜：开启勿扰', nottodo: '忌：接听电话' },
    { type: '迷之运', color: '#6366f1', text: '薛定谔的 Bug', todo: '宜：假装没看见', nottodo: '忌：试图复现' },
    { type: '发财', color: '#eab308', text: '年终奖翻倍', todo: '宜：请客吃饭', nottodo: '忌：甚至不看一眼' },
    { type: '欧皇', color: '#f97316', text: '抽啥中啥', todo: '宜：十连抽', nottodo: '忌：犹豫不决' },
  ];

  const startShake = (e) => {
    if (e) e.preventDefault();
    if (result.value || showStick.value) return;

    isShaking.value = true;
    startTime = Date.now();
    hintText.value = '诚心祈祷...';

    playTone('square', 150, 100, 0.1, 0.05);
    shakeInterval = setInterval(() => {
      playTone('square', 100 + Math.random() * 100, null, 0.08, 0.05);
    }, 120);
  };

  const stopShake = () => {
    if (!isShaking.value) return;
    
    clearInterval(shakeInterval);
    isShaking.value = false;
    
    const duration = Date.now() - startTime;
    
    if (duration < MIN_SHAKE_TIME) {
      hintText.value = '心诚则灵 (摇久一点)';
      playTone('sawtooth', 100, 50, 0.3, 0.2);
    } else {
      finish();
    }
  };

  const finish = () => {
    hintText.value = '签出！';
    showStick.value = true;
    playTone('sine', 800, 400, 0.6, 0.3);

    setTimeout(() => {
      const r = Math.floor(Math.random() * fortunes.length);
      result.value = fortunes[r];
      showStick.value = false;
    }, 600);
  };

  const reset = () => { 
    result.value = null; 
    hintText.value = '长按签筒求签';
  };

  return { isShaking, showStick, result, hintText, startShake, stopShake, reset };
};

// --- 5. 2048 游戏 Hook ---
const useGame2048 = () => {
  const board = ref(Array(16).fill(0));
  const score = ref(0);

  const addRandomTile = () => {
    const emptyIndices = board.value.map((val, idx) => val === 0 ? idx : -1).filter(idx => idx !== -1);
    if (emptyIndices.length === 0) return;
    const randomIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    board.value[randomIdx] = Math.random() < 0.9 ? 2 : 4;
  };

  const init = () => {
    board.value = Array(16).fill(0);
    score.value = 0;
    addRandomTile();
    addRandomTile();
  };

  const move = (direction) => {
    let hasMoved = false;
    const size = 4;
    let newBoard = [...board.value];
    let currentScore = score.value;

    const getVal = (r, c) => newBoard[r * size + c];
    const setVal = (r, c, v) => newBoard[r * size + c] = v;

    const processLine = (line) => {
      let filtered = line.filter(v => v !== 0);
      let merged = [];
      for (let i = 0; i < filtered.length; i++) {
        if (i + 1 < filtered.length && filtered[i] === filtered[i+1]) {
          merged.push(filtered[i] * 2);
          currentScore += filtered[i] * 2;
          i++; 
        } else {
          merged.push(filtered[i]);
        }
      }
      while (merged.length < size) merged.push(0);
      return merged;
    };

    const isHorizontal = direction === 'left' || direction === 'right';
    const isReverse = direction === 'right' || direction === 'down';

    if (isHorizontal) {
      for (let r = 0; r < size; r++) {
        let row = [];
        for (let c = 0; c < size; c++) row.push(getVal(r, c));
        if (isReverse) row.reverse();
        let newRow = processLine(row);
        if (isReverse) newRow.reverse();
        for (let c = 0; c < size; c++) {
          if (getVal(r, c) !== newRow[c]) hasMoved = true;
          setVal(r, c, newRow[c]);
        }
      }
    } else {
      for (let c = 0; c < size; c++) {
        let col = [];
        for (let r = 0; r < size; r++) col.push(getVal(r, c));
        if (isReverse) col.reverse();
        let newCol = processLine(col);
        if (isReverse) newCol.reverse();
        for (let r = 0; r < size; r++) {
          if (getVal(r, c) !== newCol[r]) hasMoved = true;
          setVal(r, c, newCol[r]);
        }
      }
    }

    if (hasMoved) {
      board.value = newBoard;
      score.value = currentScore;
      addRandomTile();
    }
  };

  return { board, score, init, move };
};

// --- 6. 深呼吸 Hook ---
const useBreath = () => {
  const text = ref('吸气');
  const opacity = ref(1);
  let interval;

  const start = () => {
    text.value = '吸气';
    const loop = () => {
      text.value = '吸气 (Inhale)'; 
      setTimeout(() => { text.value = '屏气 (Hold)'; }, 3200);
      setTimeout(() => { text.value = '呼气 (Exhale)'; }, 4000);
      setTimeout(() => { text.value = '屏气 (Hold)'; }, 7200);
    };
    loop();
    interval = setInterval(loop, 8000);
  };

  const stop = () => clearInterval(interval);

  return { text, opacity, start, stop };
};

// ==========================================
// 主组件逻辑
// ==========================================

const isDark = ref(true);
const router = useRouter(); // 路由实例
const soundEnabled = ref(true);
const currentView = ref(null); // 'fish', 'divine', '2048', 'breath', 'disclaimer'

const { playTone, initCtx } = useAudioSystem(soundEnabled);
const { getParticleStyle } = useParticles();
const woodenFish = useWoodenFish(playTone);
const divination = useDivination(playTone);
const game2048 = useGame2048();
const breath = useBreath();

const handleThemeChange = (value) => {
  isDark.value = value;
};

// 2048 交互
const handleKeydown = (e) => {
  if (currentView.value === '2048') {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const map = { 'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right' };
      game2048.move(map[e.key]);
    }
  }
};

let touchStartX = 0, touchStartY = 0;
const handleTouchStart = (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
};
const handleTouchMove = (e) => {
  if (currentView.value === '2048') e.preventDefault();
};
const handleTouchEnd = (e) => {
  if (currentView.value !== '2048') return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > Math.abs(dy)) {
    if (Math.abs(dx) > 30) game2048.move(dx > 0 ? 'right' : 'left');
  } else {
    if (Math.abs(dy) > 30) game2048.move(dy > 0 ? 'down' : 'up');
  }
};

// 视图切换
const openModal = (view) => {
  initCtx();
  currentView.value = view;
  if (view === '2048' && game2048.board.value.every(v => v === 0)) game2048.init();
  if (view === 'breath') breath.start();
  if (view === 'divine') divination.reset();
};

const closeModal = () => {
  currentView.value = null;
  breath.stop();
  divination.stopShake();
};

const goHome = () => {
  if (router) {
    router.push('/');
  } else {
    console.warn('Router not available');
  }
};

const currentTitle = computed(() => {
  const map = { 
    'fish': '电子木鱼', 
    '2048': '禅意2048', 
    'breath': '深呼吸', 
    'divine': '赛博求签',
    'disclaimer': '免责声明' // 新增标题
  };
  return currentView.value ? map[currentView.value] : '禅意工具箱';
});

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
});
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('touchmove', handleTouchMove);
  breath.stop();
});
</script>

<template>
  <div class="zen-toolbox-container" :class="{ 'light-theme': !isDark }">
    
    <div class="particles-bg">
      <div class="particle" v-for="i in 20" :key="i" :style="getParticleStyle()"></div>
    </div>

    <div class="top-actions">
      <button @click="goHome" class="action-btn" title="返回主页">
        🏠
      </button>
        <a-switch 
        v-model="isDark" 
        @change="handleThemeChange"
        :checked-color="'#3370ff'"
        :unchecked-color="'#86909c'"
      >
        <template #checked>🌙</template>
        <template #unchecked>☀️</template>
      </a-switch>
      <button @click="soundEnabled = !soundEnabled" class="action-btn" :class="{ 'active': soundEnabled }">
        <span v-if="soundEnabled">🔊</span>
        <span v-else>🔇</span>
      </button>
    </div>
    
    <div class="zen-home">
      <header class="home-header">
        <h1 class="main-title">Nano 禅意工具箱</h1>
        <p class="sub-title">赛博修身 · 电子养性</p>
      </header>

      <div class="card-grid">
        <div class="zen-card" @click="openModal('fish')">
          <div class="card-icon">🐟</div>
          <div class="card-info">
            <h3>电子木鱼</h3>
            <p>敲击积攒功德</p>
          </div>
        </div>
        <div class="zen-card" @click="openModal('divine')">
          <div class="card-icon">🎋</div>
          <div class="card-info">
            <h3>赛博求签</h3>
            <p>遇事不决量子力学</p>
          </div>
        </div>
        <div class="zen-card" @click="openModal('2048')">
          <div class="card-icon">🔢</div>
          <div class="card-info">
            <h3>禅意 2048</h3>
            <p>数字里的智慧</p>
          </div>
        </div>
        <div class="zen-card" @click="openModal('breath')">
          <div class="card-icon">🌬️</div>
          <div class="card-info">
            <h3>深呼吸</h3>
            <p>平复内心焦虑</p>
          </div>
        </div>
      </div>
      
      <div class="footer">
        <p class="version">v1.0.0</p>
        <p class="copyright">
          Powered by Nano Studio @JerryLau· 
          <br>
          <span class="link" @click="openModal('disclaimer')">免责声明</span>
        </p>
      </div>
    </div>

    <transition name="modal-fade">
      <div v-if="currentView" class="modal-overlay" @click.self="closeModal">
        <div class="modal-window">
          <div class="modal-header">
            <h2>{{ currentTitle }}</h2>
            <button class="close-btn" @click="closeModal">✕</button>
          </div>
          <div class="modal-content">
            
            <!-- 1. 木鱼 -->
            <div v-if="currentView === 'fish'" class="view-container fish-view" 
                 @touchstart.prevent="woodenFish.knock" 
                 @mousedown="woodenFish.knock">
              <div class="merit-counter">
                <p class="merit-label">当前功德</p>
                <p class="merit-value">{{ woodenFish.meritCount.value }}</p>
              </div>
              <div :class="['fish-wrapper', woodenFish.isKnocking.value ? 'knocking' : '']">
                <div v-for="r in woodenFish.ripples.value" :key="r.id" 
                     class="ripple" :style="{ left: r.x + 'px', top: r.y + 'px' }"></div>
                <svg viewBox="0 0 200 200" class="real-fish-svg">
                  <defs>
                    <radialGradient id="woodGradient" cx="30%" cy="30%" r="70%">
                      <stop offset="0%" stop-color="var(--fish-color-light)" /> 
                      <stop offset="100%" stop-color="var(--fish-color-dark)" />
                    </radialGradient>
                    <filter id="shadow">
                      <feDropShadow dx="2" dy="4" stdDeviation="3" flood-opacity="0.3"/>
                    </filter>
                  </defs>
                  <path d="M30,100 Q30,40 100,40 Q170,40 170,100 Q170,160 100,160 Q30,160 30,100 Z" fill="url(#woodGradient)" stroke="var(--fish-stroke)" stroke-width="2" filter="url(#shadow)"/>
                  <path d="M50,100 Q100,100 150,100 Q140,115 100,115 Q60,115 50,100" fill="var(--fish-hole)" />
                  <circle cx="70" cy="80" r="8" fill="var(--fish-eye)" />
                  <circle cx="130" cy="80" r="8" fill="var(--fish-eye)" />
                  <path d="M80,50 Q100,60 120,50" fill="none" stroke="var(--fish-stroke)" stroke-width="2" opacity="0.5"/>
                  <path d="M70,140 Q100,130 130,140" fill="none" stroke="var(--fish-stroke)" stroke-width="2" opacity="0.5"/>
                </svg>
                <div :class="['wood-stick', woodenFish.isKnocking.value ? 'stick-hit' : '']">
                  <div class="stick-head"></div><div class="stick-handle"></div>
                </div>
              </div>
              <div class="fish-hint">点击屏幕积攒功德</div>
              <div v-for="item in woodenFish.floatingTexts.value" 
                   :key="item.id" class="merit-float" 
                   :style="{ left: item.x + 'px', top: item.y + 'px', ...item.style }">功德 +1</div>
            </div>

            <!-- 2. 求签 -->
            <div v-if="currentView === 'divine'" class="view-container divine-view">
              <div class="divine-container" 
                   @mousedown="divination.startShake" 
                   @mouseup="divination.stopShake" 
                   @mouseleave="divination.stopShake"
                   @touchstart.prevent="divination.startShake" 
                   @touchend.prevent="divination.stopShake">
                <div class="stick-box" :class="{ 'shake-anim': divination.isShaking.value }">
                   <div class="box-body"><div class="box-label">赛博<br>灵签</div></div>
                   <div class="sticks-top"></div>
                   <div v-if="divination.showStick.value" class="flying-stick"></div>
                </div>
                <div class="divine-hint" :class="{ 'shaking': divination.isShaking.value }">
                  {{ divination.hintText.value }}
                </div>
                <transition name="pop-up">
                  <div v-if="divination.result.value" class="fortune-card" @click.stop="divination.reset">
                    <div class="fortune-header" :style="{ color: divination.result.value.color }">{{ divination.result.value.type }}</div>
                    <div class="fortune-divider"></div>
                    <div class="fortune-text">{{ divination.result.value.text }}</div>
                    <div class="fortune-advice">
                      <p class="todo">{{ divination.result.value.todo }}</p>
                      <p class="nottodo">{{ divination.result.value.nottodo }}</p>
                    </div>
                    <div class="retry-hint">点击卡片再次求签</div>
                  </div>
                </transition>
              </div>
            </div>

            <!-- 3. 2048 -->
            <div v-if="currentView === '2048'" class="view-container game-2048-view">
              <div class="game-header">
                <div class="score-box">
                  <div class="score-label">分数</div>
                  <div class="score-val">{{ game2048.score.value }}</div>
                </div>
                <button @click="game2048.init" class="restart-btn">重置</button>
              </div>
              <div class="game-board" @touchstart="handleTouchStart" @touchmove="handleTouchMove" @touchend="handleTouchEnd">
                <div v-for="(cell, index) in game2048.board.value" :key="index" class="game-cell" :class="cell === 0 ? 'tile-empty' : `tile-${cell}`">
                  {{ cell !== 0 ? cell : '' }}
                </div>
              </div>
              <div class="game-hint"><span class="desktop-hint">使用方向键控制</span><span class="mobile-hint">滑动屏幕控制</span></div>
            </div>

            <!-- 4. 呼吸 -->
            <div v-if="currentView === 'breath'" class="view-container breath-view">
              <div class="breath-visuals">
                <div class="breath-circle circle-outer-1"></div>
                <div class="breath-circle circle-outer-2"></div>
                <div class="breath-circle circle-core"></div>
              </div>
              <div class="breath-text-container">
                <p class="breath-text" :style="{ opacity: breath.opacity.value }">{{ breath.text.value }}</p>
              </div>
            </div>

            <!-- 5. 免责声明 (NEW) -->
            <div v-if="currentView === 'disclaimer'" class="view-container disclaimer-view">
              <div class="disclaimer-content">
                <p>1. 本工具仅供娱乐和解压使用。</p>
                <p>2. “赛博求签”结果均为随机生成，请勿作为现实决策依据（尤其是“删库跑路”等建议）。</p>
                <p>3. “电子木鱼”积攒的功德仅存储于本地内存，刷新即逝，请勿执着。</p>
                <p>4. 开发者不对因使用本工具导致的代码Bug、脱发或情绪波动负责。</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap');

/* --- 变量 --- */
.zen-toolbox-container {
  --bg-start: #171717; --bg-end: #0f0f0f;
  --text-primary: #e5e5e5; --text-secondary: #a3a3a3; --text-accent: #f59e0b;
  --card-bg: rgba(38, 38, 38, 0.8); --card-border: #333; --card-hover-bg: #303030; --card-hover-border: #404040;
  --modal-bg: rgba(26, 26, 26, 0.95); --modal-header-bg: #1f1f1f; --modal-border: #404040; --modal-shadow: rgba(0, 0, 0, 0.8);
  --btn-bg: rgba(255, 255, 255, 0.05); --btn-border: #333; --btn-hover-bg: rgba(255, 255, 255, 0.1);
  --stick-box: #5D4037; --stick-label: #ffecb3;
  --fish-color-light: #A0522D; --fish-color-dark: #5D4037; --fish-stroke: #3E2723; --fish-hole: #2c1a16; --fish-eye: #3E2723;
  --game-bg: #262626; --tile-empty: #525252;
  --breath-outer-1: rgba(30, 58, 138, 0.3); --breath-outer-2: rgba(120, 53, 15, 0.2); --breath-core-bg: #262626; --breath-core-border: #a3a3a3;
  --particle-color: rgba(255, 255, 255, 0.3);
  --ripple-color: rgba(255, 255, 255, 0.3);
}

.zen-toolbox-container.light-theme {
  --bg-start: #f0f2f5; --bg-end: #e2e8f0;
  --text-primary: #1f2937; --text-secondary: #64748b; --text-accent: #d97706;
  --card-bg: rgba(255, 255, 255, 0.9); --card-border: #e2e8f0; --card-hover-bg: #ffffff; --card-hover-border: #cbd5e1;
  --modal-bg: rgba(255, 255, 255, 0.95); --modal-header-bg: #f8fafc; --modal-border: #e2e8f0; --modal-shadow: rgba(0, 0, 0, 0.15);
  --btn-bg: rgba(0, 0, 0, 0.05); --btn-border: #cbd5e1; --btn-hover-bg: rgba(0, 0, 0, 0.1);
  --fish-color-light: #b06a45; --fish-color-dark: #7a4e3a;
  --stick-box: #8d6e63; --stick-label: #fff8e1;
  --game-bg: #cbd5e1; --tile-empty: #94a3b8;
  --breath-outer-1: rgba(59, 130, 246, 0.2); --breath-outer-2: rgba(245, 158, 11, 0.2); --breath-core-bg: #fff; --breath-core-border: #94a3b8;
  --particle-color: rgba(0, 0, 0, 0.1);
  --ripple-color: rgba(0, 0, 0, 0.1);
}

.zen-toolbox-container {
  font-family: 'Noto Serif SC', serif;
  width: 100vw; height: 100vh; margin: 0;
  background: linear-gradient(135deg, var(--bg-start) 0%, var(--bg-end) 100%);
  color: var(--text-primary);
  overflow: hidden; position: relative;
  display: flex; flex-direction: column;
  transition: background 0.5s ease, color 0.5s ease;
}

/* 粒子背景 */
.particles-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; pointer-events: none; z-index: 0; }
.particle { position: absolute; bottom: -10px; background: var(--particle-color); border-radius: 50%; animation: float-up 20s linear infinite; opacity: 0; transition: background 0.5s ease; }
@keyframes float-up { 0% { bottom: -10px; opacity: 0; } 10% { opacity: 0.6; } 90% { opacity: 0.2; } 100% { bottom: 110%; opacity: 0; transform: translateX(20px) scale(1.5); } }

/* 顶部操作栏 */
.top-actions { position: absolute; top: 24px; right: 24px; z-index: 20; display: flex; gap: 12px; align-items: center; }
.action-btn { background: var(--btn-bg); border: 1px solid var(--btn-border); color: var(--text-secondary); width: 36px; height: 36px; border-radius: 50%; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.action-btn:hover { background: var(--btn-hover-bg); color: var(--text-primary); }
.action-btn.active { color: var(--text-accent); border-color: var(--text-accent); }

/* 主页布局 */
.zen-home { padding: 2rem; height: 100%; width: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box; z-index: 10; }
.home-header { margin-bottom: 2rem; text-align: center; }
.main-title { font-size: 2.5rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.5rem 0; letter-spacing: 0.1em; text-shadow: 0 4px 20px rgba(0,0,0,0.1); }
.sub-title { color: var(--text-secondary); font-size: 1.1rem; margin: 0 0 1.5rem 0; }
.card-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2rem; width: 100%; max-width: 800px; padding: 1rem; box-sizing: border-box; }
@media (max-width: 600px) { .card-grid { grid-template-columns: 1fr; } }
.zen-card { background-color: var(--card-bg); border: 1px solid var(--card-border); border-radius: 16px; padding: 2rem; display: flex; flex-direction: column; align-items: center; text-align: center; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 4px 6px rgba(0,0,0,0.05); backdrop-filter: blur(10px); }
.zen-card:hover { transform: translateY(-8px); background-color: var(--card-hover-bg); border-color: var(--card-hover-border); box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
.zen-card:active { transform: scale(0.98); } /* 增加点击态 */
.card-icon { font-size: 3.5rem; margin-bottom: 1rem; transition: transform 0.3s; }
.zen-card:hover .card-icon { transform: scale(1.1) rotate(5deg); }
.card-info h3 { margin: 0 0 0.5rem 0; font-size: 1.2rem; color: var(--text-accent); font-weight: 600; }
.card-info p { margin: 0; font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; }
.footer { margin-top: 2rem; text-align: center; color: var(--text-secondary); font-size: 0.85rem; opacity: 0.7; }
.footer .link { text-decoration: underline; cursor: pointer; transition: color 0.2s; }
.footer .link:hover { color: var(--text-accent); }

/* 模态框 */
.modal-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: var(--modal-shadow); backdrop-filter: blur(8px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 1rem; box-sizing: border-box; }
.modal-window { width: 100%; max-width: 500px; max-height: 90%; background-color: var(--modal-bg); border: 1px solid var(--modal-border); border-radius: 16px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5); display: flex; flex-direction: column; overflow: hidden; transition: all 0.3s ease; }
.modal-header { padding: 1rem 1.5rem; border-bottom: 1px solid var(--modal-border); display: flex; justify-content: space-between; align-items: center; background-color: var(--modal-header-bg); }
.modal-header h2 { margin: 0; font-size: 1.1rem; color: var(--text-primary); }
.close-btn { background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer; padding: 0 0.5rem; }
.modal-content { flex: 1; position: relative; overflow: hidden; min-height: 500px; display: flex; flex-direction: column; justify-content: center; align-items: center; }

/* View Container */
.view-container { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; user-select: none; }

/* 1. 木鱼相关样式 */
.fish-view { gap: 2rem; position: relative; }
.merit-counter { text-align: center; pointer-events: none; z-index: 20; }
.merit-label { color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 0.5rem; letter-spacing: 0.1em; }
.merit-value { font-size: 2.5rem; font-weight: 300; color: var(--text-primary); margin: 0; }
.fish-wrapper { width: 180px; height: 180px; position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.08s cubic-bezier(0.175, 0.885, 0.32, 1.275); z-index: 10; }
.fish-wrapper.knocking { transform: scale(0.95); }
.real-fish-svg { width: 100%; height: 100%; filter: drop-shadow(0 10px 15px rgba(0,0,0,0.3)); pointer-events: none; }
.wood-stick { position: absolute; top: -20px; right: -40px; width: 120px; height: 12px; transform-origin: bottom left; transition: transform 0.08s ease; pointer-events: none; display: flex; align-items: center; }
.stick-handle { width: 100%; height: 100%; background-color: #5D4037; border-radius: 6px; }
.stick-head { width: 24px; height: 24px; background-color: #8D6E63; border-radius: 50%; position: absolute; left: -10px; }
.wood-stick.stick-hit { transform: rotate(-20deg) translate(0, 10px); }
.fish-hint { color: var(--text-secondary); font-size: 0.8rem; letter-spacing: 0.1em; pointer-events: none; margin-top: 1rem; }
.merit-float { position: absolute; pointer-events: none; font-weight: bold; color: var(--text-accent); z-index: 50; animation: float-up-text 0.8s ease-out forwards; white-space: nowrap; }
@keyframes float-up-text { 0% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-80px) scale(1.2); } }
/* 波纹动画 */
.ripple {
  position: absolute;
  width: 20px; height: 20px;
  background: var(--ripple-color);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: ripple-effect 0.6s linear forwards;
  pointer-events: none;
}
@keyframes ripple-effect {
  0% { width: 0; height: 0; opacity: 0.8; }
  100% { width: 300px; height: 300px; opacity: 0; }
}

/* 2. 赛博求签样式 */
.divine-container { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; user-select: none; }
.stick-box { width: 100px; height: 160px; background-color: var(--stick-box); border-radius: 4px 4px 12px 12px; position: relative; box-shadow: 0 10px 20px rgba(0,0,0,0.3); display: flex; justify-content: center; align-items: center; transform-origin: bottom center; transition: transform 0.1s; }
.box-body { width: 80%; height: 80%; border: 2px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; pointer-events: none; }
.box-label { background-color: var(--stick-label); color: #3e2723; writing-mode: vertical-rl; padding: 8px 4px; font-weight: bold; letter-spacing: 4px; border-radius: 2px; font-size: 1.2rem; }
.sticks-top { position: absolute; top: -20px; width: 90%; height: 30px; background-color: rgba(255,255,255,0.1); border-radius: 50%; z-index: -1; }
.shake-anim { animation: shake 0.1s infinite; }
@keyframes shake { 0% { transform: rotate(0deg) translate(0,0); } 25% { transform: rotate(5deg) translate(2px, -2px); } 50% { transform: rotate(0deg) translate(0, 0); } 75% { transform: rotate(-5deg) translate(-2px, -2px); } 100% { transform: rotate(0deg); } }
.flying-stick { position: absolute; top: 0; left: 50%; width: 16px; height: 120px; background-color: #ffecb3; border: 1px solid #d7ccc8; transform: translateX(-50%) translateY(0); z-index: -1; animation: fly-out 0.6s ease-out forwards; }
@keyframes fly-out { 0% { transform: translateX(-50%) translateY(0); opacity: 1; } 100% { transform: translateX(-50%) translateY(-150px) rotate(20deg); opacity: 0; } }
.divine-hint { margin-top: 2rem; color: var(--text-secondary); font-size: 0.9rem; letter-spacing: 1px; transition: all 0.3s; }
.divine-hint.shaking { color: var(--text-accent); font-weight: bold; transform: scale(1.1); }

.fortune-card { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 280px; background: #fff; border-radius: 8px; padding: 2rem; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.5); z-index: 50; color: #333; cursor: pointer; }
.fortune-header { font-size: 3rem; font-weight: bold; margin-bottom: 0.5rem; }
.fortune-divider { height: 2px; background: #eee; width: 100%; margin: 1rem 0; }
.fortune-text { font-size: 1.5rem; margin-bottom: 1.5rem; font-weight: 500; }
.fortune-advice p { margin: 0.5rem 0; font-size: 1rem; }
.todo { color: #10b981; }
.nottodo { color: #ef4444; }
.retry-hint { font-size: 0.8rem; color: #999; margin-top: 1.5rem; }
.pop-up-enter-active { animation: pop-up 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
@keyframes pop-up { 0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; } 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; } }

/* 2048 & 呼吸 (保持原样) */
.game-header { width: 100%; max-width: 320px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.score-box { background-color: var(--card-bg); padding: 0.5rem; border-radius: 0.25rem; text-align: center; min-width: 80px; border: 1px solid var(--card-border); }
.score-label { font-size: 0.7rem; color: var(--text-secondary); }
.score-val { font-size: 1.2rem; font-weight: bold; color: var(--text-primary); }
.restart-btn { background-color: rgba(180, 83, 9, 0.5); color: white; padding: 0.5rem 1rem; border-radius: 0.25rem; font-size: 0.9rem; border: none; cursor: pointer; }
.game-board { background-color: var(--game-bg); padding: 0.75rem; border-radius: 0.5rem; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2); display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; touch-action: none; }
.game-cell { width: 3.5rem; height: 3.5rem; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; font-weight: bold; border-radius: 0.2rem; user-select: none; background-color: var(--tile-empty); color: var(--text-primary); }
@media (min-width: 400px) { .game-cell { width: 4rem; height: 4rem; font-size: 1.3rem; } }
.tile-2 { background-color: #eee4da; color: #776e65; } .tile-4 { background-color: #ede0c8; color: #776e65; } .tile-8 { background-color: #f2b179; color: #f9f6f2; } .tile-16 { background-color: #f59563; color: #f9f6f2; } .tile-32 { background-color: #f67c5f; color: #f9f6f2; } .tile-64 { background-color: #f65e3b; color: #f9f6f2; } .tile-128 { background-color: #edcf72; color: #f9f6f2; } .tile-256 { background-color: #edcc61; color: #f9f6f2; } .tile-512 { background-color: #edc850; color: #f9f6f2; } .tile-1024 { background-color: #edc53f; color: #f9f6f2; } .tile-super { background-color: #3c3a32; color: #f9f6f2; }
.game-hint { margin-top: 1.5rem; font-size: 0.8rem; color: var(--text-secondary); text-align: center; }
.mobile-hint { display: inline; } .desktop-hint { display: none; }
@media (min-width: 640px) { .mobile-hint { display: none; } .desktop-hint { display: inline; } }

.breath-visuals { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.breath-circle { border-radius: 50%; position: absolute; animation: breath-cycle 8s infinite ease-in-out; }
.circle-outer-1 { width: 18rem; height: 18rem; background-color: var(--breath-outer-1); filter: blur(30px); }
.circle-outer-2 { width: 13rem; height: 13rem; background-color: var(--breath-outer-2); filter: blur(20px); animation-delay: 0.2s; }
.circle-core { width: 8rem; height: 8rem; border: 2px solid var(--breath-core-border); background-color: var(--breath-core-bg); box-shadow: 0 0 40px rgba(128,128,128,0.2); }
.breath-text-container { z-index: 10; height: 8rem; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
.breath-text { font-size: 1.4rem; font-weight: 300; letter-spacing: 0.2em; color: var(--text-primary); transition: opacity 1s; }
@keyframes breath-cycle { 0% { transform: scale(0.3); opacity: 0.3; } 40% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1); opacity: 0.8; } 90% { transform: scale(0.3); opacity: 0.3; } 100% { transform: scale(0.3); opacity: 0.3; } }

/* 5. 免责声明样式 */
.disclaimer-view { padding: 2rem; box-sizing: border-box; text-align: left; }
.disclaimer-content { font-size: 0.95rem; line-height: 1.8; color: var(--text-primary); }
.disclaimer-content p { margin-bottom: 1rem; }
</style>