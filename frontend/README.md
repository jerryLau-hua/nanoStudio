# Nano Studio Frontend

> 现代化的知识管理和笔记系统前端应用

一个基于 Vue 3 + TypeScript 的现代化知识管理平台前端，提供智能笔记、PDF文档解析、RAG对话、思维导图生成等功能。

## ✨ 核心功能

- 📝 **智能笔记系统** - 支持 Markdown 渲染、思维导图、重点简报生成
- 📄 **PDF 知识管理** - 自动提取PDF文本、向量化存储、智能检索
- 💬 **RAG 增强对话** - 基于文档知识的智能问答
- 🌐 **网页抓取** - 一键添加网页作为知识源
- 👤 **用户系统** - 个人中心、签到、配置管理
- 🎨 **精美UI** - 基于 Arco Design 的现代化界面

## 🛠️ 技术栈

### 核心框架
- **Vue 3.5+** - 渐进式 JavaScript 框架
- **TypeScript 5.9+** - 类型安全
- **Vite 7.2+** - 下一代前端构建工具

### UI 组件
- **Arco Design Vue 2.57+** - 字节跳动企业级UI组件库
- **FontAwesome 7.1+** - 图标库
- **Mermaid 11.12+** - 思维导图渲染

### 状态管理 & 路由
- **Pinia 3.0+** - Vue 官方状态管理
- **Vue Router 4.6+** - 官方路由

### 文档处理
- **PDF.js 5.4+** - PDF解析
- **Markdown-it 14.1+** - Markdown渲染
- **highlight.js 11.11+** - 代码高亮

### 开发工具
- **unplugin-auto-import** - 自动导入API
- **unplugin-vue-components** - 组件自动导入

## 📁 项目结构

```
frontend/
├── src/
│   ├── api/              # API调用层
│   │   ├── auth.ts       # 认证API
│   │   ├── session.ts    # 会话API
│   │   ├── source.ts     # 知识源API
│   │   ├── chat.ts       # 聊天API
│   │   ├── settings.ts   # 设置API
│   │   └── user.ts       # 用户API
│   ├── assets/           # 静态资源
│   ├── components/       # 全局组件
│   ├── composables/      # 组合式函数
│   ├── router/           # 路由配置
│   ├── store/            # Pinia状态管理
│   │   ├── notebookStore.ts  # 笔记本状态
│   │   └── settingsStore.ts  # 设置状态
│   ├── utils/            # 工具函数
│   │   ├── pdf.ts        # PDF处理
│   │   ├── apiClient.ts  # HTTP客户端
│   │   └── modelApi.ts   # 模型API
│   ├── views/            # 页面视图
│   │   ├── LoginPage/    # 登录页
│   │   ├── notebook/     # 主笔记本界面
│   │   └── ProfileCenter/ # 个人中心
│   ├── App.vue           # 根组件
│   └── main.ts           # 入口文件
├── public/               # 公共资源
├── index.html            # HTML模板
├── vite.config.ts        # Vite配置
├── tsconfig.json         # TypeScript配置
└── package.json          # 依赖配置
```

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装依赖

```bash
cd frontend
npm install
```

### 开发环境

```bash
npm run dev
```

应用将在 `http://localhost:5173` 启动

### 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist/` 目录

### 预览生产构建

```bash
npm run preview
```

## 🔧 配置说明

### 后端API配置

修改 `src/utils/apiClient.ts` 中的 `BASE_URL`：

```typescript
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
```

或在 `.env` 文件中配置：

```env
VITE_API_URL=https://your-backend-api.com/api
```

### 支持的后端

- **开发环境**: `backend` (Express.js) - 本地调试
- **生产环境**: `nano-back-cloudfare` (Cloudflare Workers)

## 📝 开发指南

### 添加新的API接口

1. 在 `src/api/` 下创建新的API模块
2. 定义类型接口
3. 使用 `apiClient` 发起请求
4. 在 `src/api/index.ts` 中导出

示例：

```typescript
// src/api/example.ts
import apiClient from '@/utils/apiClient';

export interface Example {
    id: number;
    name: string;
}

export const exampleApi = {
    getAll: async (): Promise<Example[]> => {
        const response = await apiClient.get('/examples');
        const data = await response.json();
        return data.data;
    }
};
```

### 添加新页面

1. 在 `src/views/` 下创建新目录
2. 创建 `index.vue` 组件
3. 在 `src/router/index.ts` 中注册路由

```typescript
{
    path: '/example',
    name: 'example',
    component: () => import('../views/Example/index.vue')
}
```

### 状态管理

使用 Pinia 进行状态管理：

```typescript
// src/store/exampleStore.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useExampleStore = defineStore('example', () => {
    const count = ref(0);
    
    const increment = () => {
        count.value++;
    };
    
    return { count, increment };
});
```

## 🎨 UI组件使用

项目使用 Arco Design Vue，已配置自动导入：

```vue
<template>
    <a-button type="primary">点击</a-button>
    <a-input v-model="text" placeholder="输入文本" />
</template>
```

## 📦 主要依赖说明

| 依赖 | 版本 | 用途 |
|------|------|------|
| vue | 3.5.25 | 核心框架 |
| @arco-design/web-vue | 2.57.0 | UI组件库 |
| pinia | 3.0.4 | 状态管理 |
| vue-router | 4.6.3 | 路由 |
| pdfjs-dist | 5.4.530 | PDF解析 |
| markdown-it | 14.1.0 | Markdown渲染 |
| mermaid | 11.12.2 | 图表渲染 |
| highlight.js | 11.11.1 | 代码高亮 |

## 🌐 部署

### Vercel 部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel
```

### Netlify 部署

1. 连接 Git 仓库
2. 构建命令: `npm run build`
3. 输出目录: `dist`

### Nginx 部署

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    root /path/to/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://your-backend-url;
    }
}
```

## 🔒 环境变量

创建 `.env.local` 文件：

```env
# 后端API地址
VITE_API_URL=https://api.yourdomain.com/api

# 其他配置...
```

## 🐛 常见问题

### PDF上传失败

检查后端是否正确配置 MinIO 和 HTTPS。

### CORS 错误

确保后端已配置正确的 CORS 策略。

### 构建失败

清理缓存并重新安装：

```bash
rm -rf node_modules dist
npm install
npm run build
```

## 📄 许可证

MIT License

## 👥 贡献

欢迎提交 Issue 和 Pull Request！

---

**🔗 相关项目**

- [nano-back-cloudfare](../nano-back-cloudfare) - 生产环境后端
- [backend](../backend) - 开发环境后端
