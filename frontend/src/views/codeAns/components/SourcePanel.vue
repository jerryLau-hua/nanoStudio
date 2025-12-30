<script setup>
import { ref } from 'vue';
import { useCodeStore } from '@/store/codeStore';

const store = useCodeStore();

// Props 接收父组件状态
const props = defineProps({
  projectLoaded: Boolean,
  files: Array,
  currentFileIndex: Number,
  collapsed: Boolean
});

const emit = defineEmits(['load-project', 'select-file', 'close-project', 'toggle-panel']);

// --- 状态 ---
const activeTab = ref('local');
const gitUrl = ref('');
const isCloning = ref(false);
const isTreeExpanded = ref(true); // 控制文件树展开/折叠状态
const historyExpanded = ref(true); // 历史区域默认展开

// --- Mock Data ---
const MOCK_GIT_FILES = [
  {
    name: 'OrderService.java',
    language: 'java',
    content: `public class OrderService {\n    // 核心订单逻辑\n    @Transactional\n    public Order createOrder(User user, List<Item> items) {\n        if (!user.isActive()) throw new AuthException("Blocked");\n        LegacyErpClient.syncCheck(user.getId()); // 潜在风险点\n        // ...更多逻辑\n        return new Order(user, items);\n    }\n}`
  },
  {
    name: 'LegacyErpClient.java',
    language: 'java',
    content: `public class LegacyErpClient {\n    public static void syncCheck(Long userId) {\n        // 同步 HTTP 调用，无超时设置\n        HttpClient.post("http://192.168.1.100/erp", userId);\n    }\n}`
  },
  {
    name: 'RedisConfig.java',
    language: 'java',
    content: `@Configuration\npublic class RedisConfig {\n    @Bean\n    public JedisPool jedisPool() {\n        return new JedisPool(new JedisPoolConfig());\n    }\n}`
  }
];

// --- Actions ---

const handleFileUpload = (fileList) => {
  if (!fileList || fileList.length === 0) return;

  const readers = fileList.map(item => {
    return new Promise((resolve) => {
      const fileObj = item.file;
      if (!fileObj) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const name = fileObj.name;
        let language = 'text';
        if (name.endsWith('.java')) language = 'java';
        else if (name.endsWith('.js')) language = 'javascript';
        else if (name.endsWith('.vue')) language = 'html';
        else if (name.endsWith('.xml')) language = 'xml';

        resolve({
          id: Date.now().toString() + Math.random(),
          name: name,
          path: name,
          language: language,
          content: e.target.result
        });
      };
      reader.readAsText(fileObj);
    });
  });

  Promise.all(readers).then(results => {
    const validFiles = results.filter(f => f !== null);
    if (validFiles.length > 0) {
      emit('load-project', validFiles);
    }
  });
};

const handleGitClone = async () => {
  if (!gitUrl.value) return;
  isCloning.value = true;
  await new Promise(r => setTimeout(r, 1000));
  emit('load-project', [...MOCK_GIT_FILES]);
  isCloning.value = false;
};

const loadDemo = async () => {
  isCloning.value = true;
  await new Promise(r => setTimeout(r, 600));
  emit('load-project', [...MOCK_GIT_FILES]);
  isCloning.value = false;
};

// 切换树状结构展开/折叠
const toggleTree = () => {
  isTreeExpanded.value = !isTreeExpanded.value;
};

// 历史项目相关
const handleLoadProject = (projectId) => {
  store.loadProject(projectId);
  // 加载后需要通知父组件
  const project = store.projects.find(p => p.id === projectId);
  if (project && project.files) {
    // 重要：通知父组件加载这些文件
    emit('load-project', project.files);
  }
};

const formatTime = (timestamp) => {
  const now = Date.now();
  const diff = now - timestamp;
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  
  if (diff < min) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / min)}分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)}小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}天前`;
  
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};
</script>

<template>
  <div class="source-panel h-full flex flex-col">

    <!-- Header：包含 Explorer 标题、关闭项目按钮、折叠按钮 -->
    <div class="panel-header" :class="{ 'collapsed-header': collapsed }" v-show="!collapsed">
      <h3 v-if="!collapsed" class="panel-title text-truncate">
        <icon-folder class="mr-2" /> EXPLORER
      </h3>
      <div class="header-actions">
        <a-tooltip content="关闭项目" v-if="projectLoaded && !collapsed">
          <a-button type="text" size="mini" class="icon-btn close-btn" @click="$emit('close-project')">
            <template #icon><icon-close /></template>
          </a-button>
        </a-tooltip>
        <!-- <a-tooltip :content="collapsed ? '展开侧边栏' : '折叠侧边栏'" position="bottom">
          <a-button type="text" size="mini" class="icon-btn toggle-btn" @click="$emit('toggle-panel')">
            <template #icon>
              <icon-menu-unfold v-if="collapsed" />
              <icon-menu-fold v-else />
            </template>
          </a-button>
        </a-tooltip> -->
      </div>
    </div>

    <!-- Body -->
    <div v-show="!collapsed" class="panel-body flex-1 flex flex-col overflow-hidden">

      <!-- 状态 1: 未加载项目 (导入页) -->
      <div v-if="!projectLoaded" class="import-view h-full overflow-y-auto">
        
        <!-- 历史项目区域 -->
        <div v-if="store.projects.length > 0" class="history-section">
          <div class="history-header" @click="historyExpanded = !historyExpanded">
            <icon-folder />
            <span>最近项目 ({{ store.projects.length }})</span>
            <icon-down :class="{ expanded: historyExpanded }" />
            <a-button 
              type="text" 
              size="mini" 
              @click.stop="store.createNewProject"
              title="新建项目"
              style="color: #86909c;"
            >
              <icon-plus />
            </a-button>
          </div>
          
          <transition name="slide">
            <div v-show="historyExpanded" class="history-list">
              <div 
                v-for="project in store.projects.slice(0, 10)" 
                :key="project.id"
                :class="['history-item', { active: project.id === store.currentProjectId }]"
                @click="handleLoadProject(project.id)"
              >
                <div class="project-title">{{ project.title }}</div>
                <div class="project-meta">
                  {{ formatTime(project.timestamp) }} · {{ project.files.length }} 文件
                </div>
                <div class="project-actions" @click.stop>
                  <a-popconfirm 
                    content="删除此项目？" 
                    @ok="store.deleteProject(project.id)"
                  >
                    <a-button type="text" size="mini" style="color: #c53030;">
                      <icon-delete />
                    </a-button>
                  </a-popconfirm>
                </div>
              </div>
            </div>
          </transition>
        </div>
        
        <a-tabs v-model:active-key="activeTab" type="text" class="custom-tabs">
          <a-tab-pane key="local" title="本地上传">
            <div class="upload-container">
              <a-upload
                  draggable
                  multiple
                  :auto-upload="false"
                  @change="handleFileUpload"
                  :show-file-list="false"
              >
                <template #upload-button>
                  <div class="upload-box">
                    <icon-upload style="font-size: 32px; color: #86909c; margin-bottom: 8px" />
                    <p class="text-xs text-gray-400">点击或拖拽文件</p>
                  </div>
                </template>
              </a-upload>
            </div>
          </a-tab-pane>

          <a-tab-pane key="git" title="Git 仓库">
            <div class="git-container">
              <a-input v-model="gitUrl" placeholder="https://github.com/..." class="custom-input">
                <template #prefix><icon-github /></template>
              </a-input>
              <a-button type="primary" long class="action-btn mt-3" :loading="isCloning" @click="handleGitClone">
                <template #icon><icon-download /></template>
                Clone 仓库
              </a-button>
              <div class="divider"><span>OR</span></div>
              <a-button type="outline" long class="demo-btn" @click="loadDemo">
                <template #icon><icon-code /></template>
                加载示例代码
              </a-button>
            </div>
          </a-tab-pane>
        </a-tabs>
      </div>

      <!-- 状态 2: 文件树视图 (已加载) -->
      <div v-else class="file-tree-view flex-1 overflow-auto">
<!--        <div class="file-section-title">PROJECT FILES</div>-->

        <!-- 模拟的项目根节点 (可折叠) -->
        <div class="tree-root-item" @click="toggleTree">
          <span class="arrow-icon">
            <icon-down v-if="isTreeExpanded" />
            <icon-right v-else />
          </span>
          <!-- 复用文件夹图标 -->
          <icon-folder class="folder-icon" />
          <span class="root-name">Project Source</span>
        </div>

        <!-- 文件列表 (作为子节点，受 isTreeExpanded 控制) -->
        <div v-show="isTreeExpanded" class="file-list">
          <div
              v-for="(file, index) in files"
              :key="index"
              class="file-item"
              :class="{ active: currentFileIndex === index }"
              @click="$emit('select-file', index)"
          >
            <!-- 缩进块 -->
            <span class="file-indent"></span>
            <span class="file-icon">
              <icon-file style="color: #b07219;" />
            </span>
            <span class="file-name">{{ file.name }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.source-panel {
  background-color: var(--code-sider-bg, #252526);
  height: 100%;
  color: var(--code-text, #cccccc);
}

.panel-header {
  height: 35px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  font-size: 11px;
  font-weight: bold;
  letter-spacing: 1px;
  color: var(--code-text, #bbbbbb);
  background-color: var(--code-sider-bg, #252526);
  flex-shrink: 0;
  transition: all 0.2s;
}

.panel-header.collapsed-header {
  padding: 0;
  justify-content: center;
}

.panel-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.icon-btn {
  color: #cccccc !important;
  transition: color 0.2s;
}
.icon-btn:hover {
  background-color: #3e3e42 !important;
}

.close-btn:hover {
  color: #fff !important;
  background-color: #c53030 !important;
}

/* Tabs & Upload Styles */
:deep(.arco-tabs-nav-type-text .arco-tabs-tab) { color: var(--code-text, #888); }
:deep(.arco-tabs-nav-type-text .arco-tabs-tab:hover) { color: var(--code-text, #fff); background: transparent; }
:deep(.arco-tabs-nav-type-text .arco-tabs-tab-active) { color: #165DFF; font-weight: 500; border-bottom: 2px solid #165DFF; }
:deep(.arco-tabs-nav::before) { background-color: var(--code-border, #333); }

.upload-container, .git-container { padding: 12px; }
.upload-box {
  background-color: var(--code-upload-bg, #2d2d2d);
  border: 1px dashed var(--code-border, #444);
  border-radius: 4px;
  padding: 24px;
  text-align: center;
  transition: all 0.2s;
  cursor: pointer;
  color: var(--code-text, #ccc);
}
.upload-box:hover { border-color: #165DFF; background-color: var(--code-upload-hover-bg, #333); }

.upload-box :deep(.arco-icon) {
  color: var(--code-text, #86909c) !important;
}

.upload-box p {
  color: var(--code-text, #86909c);
}

.custom-input { 
  background-color: var(--code-input-bg, #3c3c3c); 
  border: 1px solid var(--code-border, #3c3c3c); 
  color: var(--code-text, #ccc); 
}
:deep(.arco-input-wrapper:focus-within), :deep(.arco-input-wrapper:hover) { 
  border-color: #165DFF; 
  background-color: var(--code-input-bg, #3c3c3c); 
}

.action-btn { 
  background-color: #165DFF !important; 
  border: none; 
  color: white !important;
}
.action-btn:hover { 
  background-color: #4080FF !important; 
}
.demo-btn { 
  border-color: var(--code-border, #444); 
  color: var(--code-text, #ccc); 
  background-color: transparent;
}
.demo-btn:hover { 
  border-color: #165DFF; 
  color: #165DFF; 
  background: transparent; 
}

.divider { display: flex; align-items: center; text-align: center; color: #555; font-size: 12px; margin: 16px 0; }
.divider::before, .divider::after { content: ''; flex: 1; border-bottom: 1px solid #333; }
.divider span { padding: 0 10px; }

/* File Tree Styles */
.file-section-title {
  padding: 8px 16px;
  font-size: 11px;
  font-weight: bold;
  color: #888;
  text-transform: uppercase;
}

/* 根节点样式 */
.tree-root-item {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  cursor: pointer;
  color: var(--code-text, #e5e6eb);
  font-weight: bold;
  font-size: 13px;
  user-select: none;
}
.tree-root-item:hover {
  background-color: var(--code-hover-bg, #2a2d2e);
}
.arrow-icon {
  width: 16px;
  margin-right: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--code-text, #ccc);
}
.folder-icon {
  margin-right: 6px;
  color: #dcb67a; /* Folder color */
}

/* 文件列表样式 */
.file-list {
  display: flex;
  flex-direction: column;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  cursor: pointer;
  color: var(--code-text, #cccccc);
  font-size: 13px;
  border-left: 2px solid transparent;
  transition: background-color 0.1s;
}

.file-item:hover {
  background-color: var(--code-hover-bg, #2a2d2e);
}

.file-item.active {
  background-color: var(--code-active-bg, #37373d);
  color: var(--code-accent, #ffffff);
  border-left-color: var(--code-accent, #007acc);
}

/* 缩进，模拟树状结构 */
.file-indent {
  width: 24px;
  flex-shrink: 0;
}

.file-icon {
  margin-right: 6px;
  width: 16px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 历史项目区域 */
.history-section {
  margin-bottom: 16px;
  border-bottom: 1px solid var(--code-border, #333);
  padding-bottom: 12px;
  background: transparent; /* 使用透明背景，继承父容器颜色 */
}

.history-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.2s;
  border-radius: 4px;
  user-select: none;
  color: var(--code-text, #ccc);
}

.history-header:hover {
  background: var(--code-hover-bg, #3e3e42);
}

.history-header span {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
}

.history-header .arco-icon-down {
  transition: transform 0.3s;
}

.history-header .arco-icon-down.expanded {
  transform: rotate(180deg);
}

.history-list {
  max-height: 280px;
  overflow-y: auto;
}

.history-item {
  padding: 10px 12px;
  margin: 4px 8px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: all 0.2s;
  border-radius: 4px;
  position: relative;
  color: var(--code-text, #ccc);
}

.history-item:hover {
  background: var(--code-hover-bg, #3e3e42);
}

.history-item.active {
  background: var(--code-active-bg, #37373d);
  border-left-color: var(--code-accent, #007acc);
}

.project-title {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 30px;
  color: var(--code-text, #e5e6eb);
}

.project-meta {
  font-size: 11px;
  color: var(--code-meta-color, #888);
}

.project-actions {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 0.2s;
}

.history-item:hover .project-actions {
  opacity: 1;
}

.slide-enter-active, .slide-leave-active {
  transition: all 0.3s ease;
  max-height: 400px;
  overflow: hidden;
}

.slide-enter-from, .slide-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>