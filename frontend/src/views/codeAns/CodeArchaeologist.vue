<script setup>
import { ref, onMounted, nextTick, computed } from 'vue';
import mermaid from 'mermaid';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';

// ----------------------------------------------------------------
// 注意：需要在项目中安装并引入 Arco Design Vue
// npm install @arco-design/web-vue
// main.js: import ArcoVue from '@arco-design/web-vue'; import '@arco-design/web-vue/dist/arco.css'; app.use(ArcoVue);
// ----------------------------------------------------------------

// ---Mock 数据: 模拟 Git 仓库克隆下来的文件 ---
const MOCK_GIT_FILES = [
  {
    name: 'OrderService.java',
    language: 'java',
    content: `public class OrderService {
    // 2015-08-12: JohnD - 临时修复库存扣减问题，勿动！
    @Transactional
    public Order createOrder(User user, List<Item> items) {
        // 1. 权限校验
        if (!user.isActive() || user.getLevel() < 1) {
            throw new AuthException("User blocked");
        }
        // 2. 兼容老ERP系统
        LegacyErpClient.syncCheck(user.getId());
        // 3. 扣减库存
        for (Item item : items) {
            if (!redisTemplate.decr("stock:" + item.getId())) {
                throw new StockException("Out of stock");
            }
        }
        // 4. 计算金额
        BigDecimal total = calculateTotal(items);
        Order order = orderRepository.save(new Order(user, items, total));
        mqProducer.send("order_created", order);
        return order;
    }

    private BigDecimal calculateTotal(List<Item> items) {
        return new BigDecimal("99.00");
    }
}`
  },
  {
    name: 'LegacyErpClient.java',
    language: 'java',
    content: `public class LegacyErpClient {
    /**
     * 同步调用老系统，超时时间 5000ms
     * 注意：高并发下可能导致线程池耗尽
     */
    public static void syncCheck(Long userId) {
        try {
            HttpClient.post("http://192.168.1.100/erp/check", userId);
        } catch (TimeoutException e) {
            log.error("ERP timeout", e);
        }
    }
}`
  },
  {
    name: 'RedisConfig.java',
    language: 'java',
    content: `@Configuration
public class RedisConfig {
    // 这里的连接池配置太小了，经常报错
    @Bean
    public JedisPool jedisPool() {
        JedisPoolConfig config = new JedisPoolConfig();
        config.setMaxTotal(10);
        return new JedisPool(config);
    }
}`
  }
];

// --- 状态定义 ---
const projectLoaded = ref(false); // 是否已加载项目
const importMode = ref('local'); // local | git
const projectFiles = ref([]); // { name, content, language }[]
const currentFileIndex = ref(0);
const gitUrl = ref('');
const gitToken = ref('');
const isCloning = ref(false);

// 历史记录
const historyList = ref([
  { id: 1, type: 'git', title: 'mall-order-service', subtitle: 'github.com/micro/mall-order', date: '2小时前' },
  { id: 2, type: 'local', title: 'LegacyErpClient.java 等 3 个文件', subtitle: '本地上传', date: '昨天' }
]);

// 核心计算属性：当前显示的代码
const currentCode = computed(() => {
  if (projectFiles.value.length === 0) return '';
  return projectFiles.value[currentFileIndex.value].content;
});

const activeTab = ref('diagram');
const isAnalyzing = ref(false);
const hasAnalyzed = ref(false);
const currentStep = ref(0);
const analysisStatus = ref('等待开始...');
const mermaidCode = ref('');
const mermaidContainer = ref(null);
const codeBlock = ref(null);

// --- 缩放与平移状态 ---
const scale = ref(1);
const translateX = ref(0);
const translateY = ref(0);
const isDragging = ref(false);
const startX = ref(0);
const startY = ref(0);

const aiSummary = ref('');
const risks = ref([]);

// --- 样式注入 ---
const injectStyles = () => {
  if (!document.getElementById('fontawesome-cdn')) {
    const link = document.createElement('link');
    link.id = 'fontawesome-cdn';
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    document.head.appendChild(link);
  }
  document.body.setAttribute('arco-theme', 'dark');
};

onMounted(() => {
  injectStyles();
  // 初始化 Mermaid
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    themeVariables: {
      fontFamily: 'Inter, sans-serif',
      primaryColor: '#d97706',
      primaryTextColor: '#fff',
      primaryBorderColor: '#d97706',
      lineColor: '#9ca3af',
      secondaryColor: '#1f2937',
      tertiaryColor: '#1f2937',
      mainBkg: '#1f2937',
      nodeBorder: '#d97706'
    }
  });

  // 从 localStorage 读取历史 (模拟)
  const stored = localStorage.getItem('ca_history');
  if (stored) {
    historyList.value = JSON.parse(stored);
  }
});

// --- 历史记录操作 ---
const addToHistory = (item) => {
  const newItem = {
    id: Date.now(),
    date: '刚刚',
    ...item
  };
  historyList.value.unshift(newItem);
  if (historyList.value.length > 5) historyList.value.pop(); // 限制5条
  localStorage.setItem('ca_history', JSON.stringify(historyList.value));
};

const deleteHistory = (id) => {
  historyList.value = historyList.value.filter(h => h.id !== id);
  localStorage.setItem('ca_history', JSON.stringify(historyList.value));
};

const loadFromHistory = async (item) => {
  // 模拟加载
  isCloning.value = true;
  await new Promise(r => setTimeout(r, 800));
  projectFiles.value = [...MOCK_GIT_FILES]; // 这里为了演示简化，统一加载 Mock 数据
  projectLoaded.value = true;
  currentFileIndex.value = 0;
  isCloning.value = false;
  highlightCode();
};

// --- 文件操作逻辑 ---

// 1. 处理本地文件上传 (支持多文件)
const handleFileUpload = (fileList) => {
  if (!fileList || fileList.length === 0) return;

  // 添加到历史
  addToHistory({
    type: 'local',
    title: `${fileList[0].file.name} 等 ${fileList.length} 个文件`,
    subtitle: '本地上传'
  });

  // 清空当前列表或追加，这里选择追加
  // 使用 FileReader 读取文件内容
  fileList.forEach(fileItem => {
    const reader = new FileReader();
    reader.onload = (e) => {
      projectFiles.value.push({
        name: fileItem.file.name,
        content: e.target.result,
        language: 'java' // 简单写死，实际可根据后缀判断
      });
      // 如果是第一个文件，自动进入编辑器模式
      if (!projectLoaded.value) {
        projectLoaded.value = true;
        currentFileIndex.value = 0;
        highlightCode();
      }
    };
    reader.readAsText(fileItem.file);
  });
};

// 2. 模拟 Git 克隆
const handleGitClone = async () => {
  if (!gitUrl.value) {
    // 简单提示（实际应使用 Arco Message）
    alert('请输入仓库地址');
    return;
  }

  // 添加到历史
  addToHistory({
    type: 'git',
    title: gitUrl.value.split('/').pop().replace('.git', ''),
    subtitle: gitUrl.value
  });

  isCloning.value = true;

  // 模拟网络延迟
  await new Promise(r => setTimeout(r, 1500));

  projectFiles.value = [...MOCK_GIT_FILES];
  projectLoaded.value = true;
  currentFileIndex.value = 0;
  isCloning.value = false;
  highlightCode();
};

// 2.1 快速演示 (优化体验新增)
const loadDemoProject = async () => {
  isCloning.value = true;
  await new Promise(r => setTimeout(r, 600));
  projectFiles.value = [...MOCK_GIT_FILES];
  projectLoaded.value = true;
  currentFileIndex.value = 0;
  isCloning.value = false;
  highlightCode();
};

// 3. 切换文件
const handleFileChange = (index) => {
  currentFileIndex.value = index;
  hasAnalyzed.value = false; // 切换文件后重置分析状态
  highlightCode();
};

// 4. 重置/关闭项目
const closeProject = () => {
  projectLoaded.value = false;
  projectFiles.value = [];
  hasAnalyzed.value = false;
  isAnalyzing.value = false;
  mermaidCode.value = '';
  gitUrl.value = '';
};

// 高亮代码
const highlightCode = () => {
  nextTick(() => {
    if (codeBlock.value) {
      codeBlock.value.removeAttribute('data-highlighted');
      hljs.highlightElement(codeBlock.value);
    }
  });
};

// --- 核心分析逻辑 (Mock) ---
const analyzeCode = async () => {
  if (isAnalyzing.value) return;

  isAnalyzing.value = true;
  hasAnalyzed.value = false;
  currentStep.value = 1;
  resetZoom();

  // 模拟后端步骤
  const steps = [
    { step: 1, msg: `正在解析 ${projectFiles.value[currentFileIndex.value].name} AST...` },
    { step: 2, msg: '提取方法调用链...' },
    { step: 3, msg: 'AI 识别业务语义...' },
    { step: 4, msg: '生成可视化图表...' }
  ];

  for (const s of steps) {
    currentStep.value = s.step;
    analysisStatus.value = s.msg;
    await new Promise(r => setTimeout(r, 600));
  }

  // 根据当前文件名生成不同的图表 (简单的 Mock 逻辑)
  const fileName = projectFiles.value[currentFileIndex.value].name;

  if (fileName.includes('Legacy')) {
    mermaidCode.value = `classDiagram
    class LegacyErpClient {
        +syncCheck(userId)
    }
    class HttpClient {
        +post(url, data)
    }
    LegacyErpClient ..> HttpClient : uses
    note for LegacyErpClient "注意：同步阻塞调用\\n建议增加熔断"`;
    aiSummary.value = "这是一个典型的**同步阻塞**客户端工具类。在高并发场景下，如果外部 ERP 系统响应变慢，会迅速耗尽当前服务的线程池，引发雪崩效应。";
    risks.value = [{ level: 'high', content: '缺少超时熔断机制 (Circuit Breaker)' }, { level: 'medium', content: '硬编码 IP 地址' }];

  } else if (fileName.includes('Redis')) {
    mermaidCode.value = `classDiagram
    class RedisConfig {
        +jedisPool()
    }
    class JedisPoolConfig {
        +setMaxTotal(10)
    }
    RedisConfig --> JedisPoolConfig : creates`;
    aiSummary.value = "Redis 连接池配置存在隐患。`maxTotal` 设置为 10 在生产环境通常太小，容易导致 `JedisConnectionException: Could not get a resource from the pool`。";
    risks.value = [{ level: 'medium', content: '连接池 maxTotal=10 过小' }];

  } else {
    // 默认 OrderService
    mermaidCode.value = `sequenceDiagram
    participant User
    participant OrderService
    participant LegacyErpClient
    participant Redis
    participant OrderRepo
    participant MQ

    User->>OrderService: createOrder(items)
    activate OrderService

    OrderService->>OrderService: checkUserActive()
    alt User Inactive
        OrderService-->>User: AuthException
    end

    OrderService->>LegacyErpClient: syncCheck(userId)

    loop Every Item
        OrderService->>Redis: decr("stock:" + itemId)
    end

    OrderService->>OrderRepo: save(order)
    OrderService->>MQ: send("order_created")

    OrderService-->>User: return Order
    deactivate OrderService`;
    aiSummary.value = `这段代码实现了订单创建的核心流程，但包含了典型的“遗留债”：\n1. **混合逻辑**：业务校验、Redis 操作、DB 操作全部耦合在一个方法里。\n2. **绕过服务层**：直接操作 Redis 扣减库存。`;
    risks.value = [
      { level: 'high', content: '高风险：Redis 操作无回滚机制' },
      { level: 'medium', content: '中风险：同步调用老 ERP 系统' }
    ];
  }

  isAnalyzing.value = false;
  hasAnalyzed.value = true;
  currentStep.value = 5;

  await renderMermaid();
};

const renderMermaid = async () => {
  await nextTick();
  if (mermaidContainer.value) {
    mermaidContainer.value.removeAttribute('data-processed');
    mermaidContainer.value.innerHTML = mermaidCode.value;
    try {
      await mermaid.run({ nodes: [mermaidContainer.value] });
    } catch (e) {
      console.error('Mermaid render error', e);
    }
  }
};

// --- 图片交互 ---
const handleWheel = (e) => {
  if (activeTab.value !== 'diagram') return;
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  updateZoom(delta);
};
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
const startDrag = (e) => {
  if (activeTab.value !== 'diagram') return;
  isDragging.value = true;
  startX.value = e.clientX - translateX.value;
  startY.value = e.clientY - translateY.value;
  document.body.style.cursor = 'grabbing';
};
const onDrag = (e) => {
  if (!isDragging.value) return;
  translateX.value = e.clientX - startX.value;
  translateY.value = e.clientY - startY.value;
};
const stopDrag = () => {
  isDragging.value = false;
  document.body.style.cursor = 'default';
};
const exportImage = () => {
  const svgElement = mermaidContainer.value.querySelector('svg');
  if (!svgElement) return;
  const viewBox = svgElement.getAttribute('viewBox');
  let width, height;
  if (viewBox) {
    const parts = viewBox.split(/\s+|,/);
    width = parseFloat(parts[2]);
    height = parseFloat(parts[3]);
  } else {
    const bbox = svgElement.getBBox();
    width = bbox.width;
    height = bbox.height;
  }
  const serializer = new XMLSerializer();
  const clonedSvg = svgElement.cloneNode(true);
  clonedSvg.setAttribute('width', width);
  clonedSvg.setAttribute('height', height);
  clonedSvg.style.maxWidth = '';
  clonedSvg.style.width = '';
  clonedSvg.style.height = '';
  clonedSvg.style.transform = '';
  let source = serializer.serializeToString(clonedSvg);
  if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  const svgBlob = new Blob([source], {type: "image/svg+xml;charset=utf-8"});
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement("canvas");
    const exportScale = 2;
    canvas.width = width * exportScale;
    canvas.height = height * exportScale;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#232324";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const pngUrl = canvas.toDataURL("image/png");
    const downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = "archaeologist_diagram.png";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  };
  img.src = url;
};
</script>

<template>
  <a-layout class="app-container">

    <!-- Header -->
    <a-layout-header class="app-header">
      <div class="header-left">
        <div class="logo-box">
          <i class="fa-solid fa-bone"></i>
        </div>
        <div class="title-box">
          <h1 class="app-title">Code Archaeologist</h1>
          <p class="app-subtitle">基于 Arco Design 的遗留系统智能分析</p>
        </div>
      </div>

      <a-space>
        <!-- 3. 关闭按钮：在项目打开时显示 -->
        <a-tooltip v-if="projectLoaded" content="关闭当前项目">
          <a-button type="text" status="danger" shape="circle" @click="closeProject">
            <template #icon><i class="fa-solid fa-power-off text-lg"></i></template>
          </a-button>
        </a-tooltip>

        <a-divider direction="vertical" v-if="projectLoaded" />

        <a-tag color="green" bordered>
          <template #icon><i class="fa-solid fa-check-circle"></i></template>
          AST 引擎就绪
        </a-tag>
        <a-button type="text" shape="circle">
          <i class="fa-brands fa-github text-lg github-icon"></i>
        </a-button>
      </a-space>
    </a-layout-header>

    <a-layout class="app-body">

      <!-- 左侧面板：分为“导入模式”和“编辑模式” -->
      <a-layout-sider :width="600" :resize-directions="['right']" class="app-sider">

        <!-- 模式 A: 项目导入页 (未加载时显示) -->
        <div v-if="!projectLoaded" class="import-container-wrapper">
          <div class="import-container">
            <div class="import-header">
              <h2><i class="fa-solid fa-folder-open"></i> 导入遗留项目</h2>
              <p>支持上传本地文件或连接 Git 仓库</p>
            </div>

            <a-tabs v-model:active-key="importMode" type="capsule" size="large" class="import-tabs">
              <a-tab-pane key="local" title="本地文件">
                <!-- 1. 优化后的上传区域 -->
                <div class="upload-area">
                  <a-upload
                      draggable
                      multiple
                      :auto-upload="false"
                      @change="handleFileUpload"
                      :show-file-list="false"
                      class="upload-dragger"
                  >
                    <template #upload-button>
                      <div class="dragger-content">
                        <div class="dragger-icon-wrapper">
                          <i class="fa-solid fa-cloud-arrow-up"></i>
                        </div>
                        <div class="dragger-text">
                          <strong>点击或拖拽文件到此处</strong>
                          <div class="sub-text">支持 .java, .xml, .properties (多选)</div>
                        </div>
                      </div>
                    </template>
                  </a-upload>
                </div>
              </a-tab-pane>

              <a-tab-pane key="git" title="Git 仓库">
                <div class="git-form">
                  <a-form layout="vertical">
                    <a-form-item label="仓库地址">
                      <a-input v-model="gitUrl" placeholder="https://github.com/username/repo.git">
                        <template #prefix><i class="fa-brands fa-git-alt"></i></template>
                      </a-input>
                    </a-form-item>
                    <a-button type="primary" long size="large" @click="handleGitClone" :loading="isCloning">
                      <template #icon><i class="fa-solid fa-download"></i></template>
                      {{ isCloning ? '正在 Clone 代码...' : '克隆并分析' }}
                    </a-button>
                  </a-form>
                </div>
              </a-tab-pane>
            </a-tabs>

            <!-- 2. 历史记录模块 -->
            <div class="history-section" v-if="historyList.length > 0">
              <div class="history-title">最近打开</div>
              <div class="history-list">
                <div v-for="item in historyList" :key="item.id" class="history-item" @click="loadFromHistory(item)">
                  <div class="history-icon">
                    <i :class="item.type === 'git' ? 'fa-brands fa-git-alt' : 'fa-solid fa-file-code'"></i>
                  </div>
                  <div class="history-info">
                    <div class="history-name">{{ item.title }}</div>
                    <div class="history-meta">{{ item.subtitle }} · {{ item.date }}</div>
                  </div>
                  <button class="history-delete" @click.stop="deleteHistory(item.id)">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>
            </div>

            <!-- 快速演示入口 -->
            <div class="demo-link-wrapper" v-if="historyList.length === 0">
              <a-link @click="loadDemoProject" class="demo-link">
                <i class="fa-solid fa-flask"></i> 没有代码？加载示例项目体验
              </a-link>
            </div>
          </div>
        </div>

        <!-- 模式 B: 代码编辑器 (加载后显示) -->
        <div v-else class="editor-container h-full flex flex-col">
          <div class="code-header">
            <div class="file-switcher">
              <i class="fa-brands fa-java java-icon mr-2"></i>
              <!-- 文件切换器 -->
              <a-select
                  :model-value="currentFileIndex"
                  @change="handleFileChange"
                  :bordered="false"
                  class="file-select"
                  :trigger-props="{ autoFitPopupMinWidth: true }"
              >
                <a-option v-for="(file, index) in projectFiles" :key="index" :value="index">
                  {{ file.name }}
                </a-option>
              </a-select>
            </div>
            <div class="file-meta">
              {{ projectFiles.length }} 个文件
            </div>
          </div>

          <div class="code-area">
            <pre class="code-pre"><code ref="codeBlock" class="language-java h-full">{{ currentCode }}</code></pre>

            <div class="analyze-btn-wrapper">
              <a-button
                  type="primary"
                  shape="round"
                  size="large"
                  :loading="isAnalyzing"
                  @click="analyzeCode"
                  class="analyze-btn shadow-xl"
              >
                <template #icon>
                  <i v-if="!isAnalyzing" class="fa-solid fa-magnifying-glass-chart"></i>
                </template>
                {{ isAnalyzing ? `分析当前文件` : '开始考古分析' }}
              </a-button>
            </div>
          </div>
        </div>

      </a-layout-sider>

      <!-- Right Panel: Visualization & Insights -->
      <a-layout-content class="right-panel">

        <!-- Tabs -->
        <a-tabs v-model:active-key="activeTab" class="custom-tabs">
          <a-tab-pane key="diagram">
            <template #title>
              <span class="tab-label"><i class="fa-solid fa-project-diagram"></i> 可视化图表</span>
            </template>
          </a-tab-pane>
          <a-tab-pane key="analysis">
            <template #title>
              <span class="tab-label"><i class="fa-solid fa-file-invoice"></i> AI 逻辑精讲</span>
            </template>
          </a-tab-pane>
        </a-tabs>

        <!-- Content Container -->
        <div class="content-container" @mouseup="stopDrag" @mouseleave="stopDrag">

          <!-- Floating Toolbar for Diagram -->
          <div v-if="activeTab === 'diagram' && hasAnalyzed" class="floating-toolbar">
            <a-space direction="vertical">
              <a-button-group>
                <a-button @click="updateZoom(0.1)" title="放大"><i class="fa-solid fa-plus"></i></a-button>
                <a-button @click="updateZoom(-0.1)" title="缩小"><i class="fa-solid fa-minus"></i></a-button>
                <a-button @click="resetZoom" title="重置"><i class="fa-solid fa-compress"></i></a-button>
              </a-button-group>
              <a-button type="primary" status="warning" @click="exportImage" style="width: 100%">
                <template #icon><i class="fa-solid fa-download"></i></template>
              </a-button>
            </a-space>
          </div>

          <!-- Empty State -->
          <div v-if="!hasAnalyzed && !isAnalyzing" class="empty-state">
            <a-empty :description="projectLoaded ? '点击左侧“开始分析”生成图表' : '请先在左侧导入项目代码'">
              <template #image>
                <i class="fa-solid fa-diagram-project empty-icon"></i>
              </template>
            </a-empty>
          </div>

          <!-- Analyzing State -->
          <div v-if="isAnalyzing" class="analyzing-state">
            <a-steps :current="currentStep" direction="vertical" class="analyze-steps">
              <a-step description="解析 Java 源码结构">AST 解析</a-step>
              <a-step description="提取 MethodCallExpr">调用链提取</a-step>
              <a-step description="分析业务语义">AI 识别</a-step>
              <a-step description="Mermaid 渲染">图表生成</a-step>
            </a-steps>
            <div class="loading-text">
              <a-spin />
              <span>{{ analysisStatus }}</span>
            </div>
          </div>

          <!-- Diagram Viewport -->
          <div
              v-show="activeTab === 'diagram' && hasAnalyzed && !isAnalyzing"
              class="diagram-viewport"
              @wheel="handleWheel"
              @mousedown="startDrag"
              @mousemove="onDrag"
          >
            <div
                class="diagram-transform-layer"
                :style="{ transform: `translate(${translateX}px, ${translateY}px) scale(${scale})` }"
            >
              <div ref="mermaidContainer" class="mermaid select-none pointer-events-none">
                {{ mermaidCode }}
              </div>
            </div>

            <div class="zoom-indicator">
              缩放: {{ Math.round(scale * 100) }}%
            </div>
          </div>

          <!-- Analysis View -->
          <div v-show="activeTab === 'analysis' && hasAnalyzed && !isAnalyzing" class="analysis-view">
            <div class="analysis-content">

              <a-card title="AI 考古总结" :bordered="false" class="analysis-card">
                <template #extra><a-tag color="arcoblue">GPT-4 Turbo</a-tag></template>
                <div class="ai-text">
                  {{ aiSummary }}
                </div>
              </a-card>

              <a-card title="风险预警" :bordered="false" class="analysis-card">
                <template #extra><a-tag color="red">{{ risks.length }} 个风险点</a-tag></template>

                <a-list :bordered="false">
                  <a-list-item v-for="(risk, idx) in risks" :key="idx" class="risk-item">
                    <a-alert :type="risk.level === 'high' ? 'error' : (risk.level === 'medium' ? 'warning' : 'info')" show-icon>
                      {{ risk.content }}
                    </a-alert>
                  </a-list-item>
                </a-list>
              </a-card>
            </div>
          </div>
        </div>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<style scoped>
/* 保持原有基础样式，新增导入页样式 */
.app-container {
  height: 100vh;
  overflow: hidden;
  font-family: 'Inter', sans-serif;
  background-color: #232324;
  color: #e5e6eb;
  display: flex;
  flex-direction: column;
}

.app-header {
  height: 64px;
  border-bottom: 1px solid #333;
  background-color: #232324;
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-box {
  width: 32px;
  height: 32px;
  background-color: rgb(22,93,255); /* Arco Blue */
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  box-shadow: 0 4px 10px rgba(0,0,0,0.2);
}

.title-box .app-title {
  font-size: 18px;
  font-weight: bold;
  color: #f2f3f5;
  margin: 0;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.title-box .app-subtitle {
  font-size: 12px;
  color: #86909c;
  margin: 0;
}

.github-icon {
  color: #86909c;
}

.app-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  background-color: #232324;
}

.app-sider {
  border-right: 1px solid #333;
  background-color: #17171a;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Import Container Styles - Fully Optimized */
.import-container-wrapper {
  height: 100%;
  overflow-y: auto; /* Allow scrolling for history list */
}

.import-container {
  padding: 32px 24px;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  max-width: 440px;
  margin: 0 auto;
}

.import-header {
  text-align: center;
  margin-bottom: 24px;
}

.import-header h2 {
  color: #f2f3f5;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 20px;
}

.import-header p {
  color: #86909c;
  font-size: 13px;
}

.import-tabs {
  flex-shrink: 0;
}

/* 优化上传区域 - 解决切割感 */
.upload-area {
  margin-top: 16px;
  height: 180px; /* Reduced height */
  padding: 4px; /* 关键修复：添加padding防止内部边框被容器裁剪 */
}

/* 修正后的上传区域样式 - 移动边框到内部 */
.upload-dragger {
  height: 100%;
  width: 100%;
  background-color: rgba(255, 255, 255, 0.02);
  border: 1px dashed #4e5969; /* 把边框加回来 */
  border-radius: 8px;
  transition: all 0.3s;
  box-sizing: border-box; /* 核心修复：防止宽度溢出 */
}

.upload-dragger:hover {
  border-color: rgb(22,93,255);
  background-color: rgba(22,93,255, 0.05);
}

.dragger-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #86909c;
  padding: 16px;
}

.dragger-icon-wrapper {
  width: 48px;
  height: 48px;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  font-size: 20px;
  color: #c9cdd4;
}

.dragger-text strong {
  display: block;
  color: #f2f3f5;
  font-weight: 500;
  margin-bottom: 4px;
  font-size: 14px;
}

.sub-text {
  font-size: 12px;
  color: #86909c;
}

.git-form {
  padding: 16px 0;
}

/* 历史记录样式 */
.history-section {
  margin-top: 32px;
  border-top: 1px solid #333;
  padding-top: 20px;
}

.history-title {
  font-size: 12px;
  color: #86909c;
  margin-bottom: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 6px;
  background-color: rgba(255,255,255,0.03);
  cursor: pointer;
  transition: background-color 0.2s;
  position: relative;
}

.history-item:hover {
  background-color: rgba(255,255,255,0.08);
}

.history-icon {
  width: 32px;
  height: 32px;
  background-color: #232324;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #86909c;
  border: 1px solid #333;
}

.history-info {
  flex: 1;
  overflow: hidden;
}

.history-name {
  font-size: 13px;
  color: #e5e6eb;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-meta {
  font-size: 11px;
  color: #86909c;
  margin-top: 2px;
}

.history-delete {
  background: none;
  border: none;
  color: #4e5969;
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
  opacity: 0;
  transition: all 0.2s;
}

.history-item:hover .history-delete {
  opacity: 1;
}

.history-delete:hover {
  background-color: rgba(245, 63, 63, 0.1);
  color: #f53f3f;
}

.demo-link-wrapper {
  margin-top: 32px;
  text-align: center;
}
.demo-link {
  font-size: 13px;
  color: #86909c;
}
.demo-link:hover {
  color: rgb(22,93,255);
}

/* Editor Styles */
.code-header {
  height: 48px;
  background-color: #2a2a2b;
  border-bottom: 1px solid #333;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.file-switcher {
  display: flex;
  align-items: center;
  flex: 1;
}

/* 覆盖 Arco Select 样式使其融入 Header */
.file-select {
  width: 300px;
  background-color: transparent !important;
}

:deep(.arco-select-view-value) {
  color: #f2f3f5 !important;
  font-size: 14px;
  font-weight: 500;
}

.file-meta {
  font-size: 12px;
  color: #4e5969;
}

.java-icon {
  color: #ff7d00;
}

.code-area {
  flex: 1;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

.code-pre {
  margin: 0;
  height: 100%;
  overflow: auto;
  padding: 16px;
  font-size: 13px;
  line-height: 1.6;
  font-family: 'JetBrains Mono', monospace;
  flex: 1;
}

.analyze-btn-wrapper {
  position: absolute;
  bottom: 24px;
  right: 24px;
  z-index: 10;
}

.analyze-btn {
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.right-panel {
  background-color: #232324;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  flex: 1;
}

.custom-tabs {
  background-color: #232324;
  border-bottom: 1px solid #333;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.content-container {
  flex: 1;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

.floating-toolbar {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 20;
}

.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  font-size: 48px;
  color: #4e5969;
  margin-bottom: 16px;
}

.analyzing-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
}

.analyze-steps {
  margin-bottom: 32px;
}

.loading-text {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgb(22,93,255);
}

.diagram-viewport {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=');
}

.diagram-transform-layer {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: center;
  transition: transform 0.075s ease-out;
}

.zoom-indicator {
  position: absolute;
  bottom: 16px;
  right: 16px;
  background-color: rgba(0,0,0,0.5);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #86909c;
  pointer-events: none;
  border: 1px solid #374151;
}

.analysis-view {
  height: 100%;
  overflow: auto;
  padding: 24px;
  background-color: #232324;
}

.analysis-content {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.analysis-card {
  background-color: #2a2a2b;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.ai-text {
  color: #c9cdd4;
  line-height: 1.6;
  white-space: pre-line;
  font-size: 15px;
}

.risk-item {
  padding: 12px 0 !important;
  background-color: transparent !important;
  border-bottom: 1px solid #333 !important;
}

/* Global Overrides */
:deep(.mermaid svg) {
  max-width: none !important;
  height: auto;
}

:deep(.arco-card-header) {
  border-bottom: 1px solid #333;
  color: #e5e6eb;
}

:deep(.arco-tabs-nav::before) {
  background-color: #333;
}

:deep(.arco-empty-description) {
  color: #86909c;
}

:deep(.arco-upload-wrapper), :deep(.arco-upload-drag) {
  height: 100%;
  display: block;
  box-sizing: border-box; /* 确保盒模型包含padding */
}

/* 移除 Arco 内部默认边框和背景，确保样式统一由外层控制 */
:deep(.arco-upload-drag) {
  border: none;
  background-color: transparent;
  height: 100%;
}

:deep(.arco-tabs-content) {
  padding-top: 16px;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #17171a; }
::-webkit-scrollbar-thumb { background: #4e4e50; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #6b6b6d; }
</style>