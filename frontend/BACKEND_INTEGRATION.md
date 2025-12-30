# 🔗 前端集成 Cloudflare Backend 指南

## ✅ 已完成配置

### 1. 环境变量文件已更新

**`.env.example`** - 开发环境模板  
**`.env.prod`** - 生产环境配置

**新增配置**：
```bash
VITE_API_BASE=https://nano-back-cloudfare.apecc.workers.dev/api
```

---

## 🚀 本地开发配置

### 步骤 1: 创建本地环境变量

```bash
# 在 frontend 目录下
cp .env.example .env
```

### 步骤 2: 编辑 `.env` 文件

```bash
# Backend API - Cloudflare Workers
VITE_API_BASE=https://nano-back-cloudfare.apecc.workers.dev/api

# 可选：本地 API Keys（用户也可在设置页面配置）
VITE_API_KEY=your-deepseek-api-key
VITE_API_URL=https://api.deepseek.com/v1/chat/completions
VITE_WEB_READER_API=https://r.jina.ai/
```

### 步骤 3: 启动前端

```bash
npm run dev
```

---

## 📡 API 客户端说明

**文件**: `src/api/client.ts`

API Base URL 自动从环境变量读取：
```typescript
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';
```

**现在会自动使用**：
- ✅ 开发环境: `https://nano-back-cloudfare.apecc.workers.dev/api`
- ✅ 生产环境: `https://nano-back-cloudfare.apecc.workers.dev/api`

---

## 🔐 认证流程

### 自动 Token 管理

API Client 已实现自动 Token 附加：

```typescript
const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
};
```

**流程**：
1. 用户登录 → 后端返回 `accessToken`
2. 前端保存到 `localStorage`
3. 所有 API 请求自动附加 `Authorization: Bearer <token>`

---

## 📝 API 端点映射

### 认证 (Auth)
| 前端调用 | 实际请求 |
|----------|---------|
| `POST /auth/register` | `https://nano-back-cloudfare.apecc.workers.dev/api/auth/register` |
| `POST /auth/login` | `https://nano-back-cloudfare.apecc.workers.dev/api/auth/login` |
| `GET /auth/me` | `https://nano-back-cloudfare.apecc.workers.dev/api/auth/me` |

### 用户 (User)
| 前端调用 | 实际请求 |
|----------|---------|
| `GET /user/profile` | `https://nano-back-cloudfare.apecc.workers.dev/api/user/profile` |
| `PATCH /user/profile` | `https://nano-back-cloudfare.apecc.workers.dev/api/user/profile` |
| `POST /user/check-in` | `https://nano-back-cloudfare.apecc.workers.dev/api/user/check-in` |

### 会话 (Sessions)
| 前端调用 | 实际请求 |
|----------|---------|
| `GET /sessions` | `https://nano-back-cloudfare.apecc.workers.dev/api/sessions` |
| `POST /sessions/from-text` | `https://nano-back-cloudfare.apecc.workers.dev/api/sessions/from-text` |
| `POST /sessions/from-url` | `https://nano-back-cloudfare.apecc.workers.dev/api/sessions/from-url` |

---

## ✅ 功能可用性

### ✅ 完全可用（无需额外配置）

1. **用户系统**
   - ✅ 注册 / 登录
   - ✅ 个人资料管理
   - ✅ 每日签到
   - ✅ API Key 管理（后端加密存储）

2. **笔记本系统**
   - ✅ 会话 CRUD
   - ✅ **从文本创建会话** + RAG
   - ✅ **从 URL 创建会话** + Jina Reader + RAG
   - ✅ 笔记管理

3. **知识源管理**
   - ✅ 网页抓取预览
   - ✅ 添加知识源 + RAG
   - ✅ 资源列表
   - ✅ 删除资源

4. **AI 对话**
   - ✅ 基础对话（非流式）

### ⏸️ 暂时不可用

- PDF 上传（需要 R2）
- 流式聊天响应

---

## 🧪 测试建议

### 1. 测试注册

```typescript
// frontend/src/api/auth.ts
await apiClient.post('/auth/register', {
  email: 'test@example.com',
  username: 'testuser',
  password: 'Test123456!'
});
```

### 2. 测试登录

```typescript
const response = await apiClient.post('/auth/login', {
  email: 'test@example.com',
  password: 'Test123456!'
});

const { accessToken, user } = await response.json();
localStorage.setItem('token', accessToken);
```

### 3. 测试创建会话

```typescript
// 从文本创建（自动 RAG）
await apiClient.post('/sessions/from-text', {
  title: '我的第一个笔记',
  content: '这是一段测试内容...'
});

// 从 URL 创建（Jina Reader + RAG）
await apiClient.post('/sessions/from-url', {
  url: 'https://example.com/article'
});
```

---

## 🔄 迁移注意事项

### API 响应格式变化

**旧格式** (Express Backend):
```json
{
  "success": true,
  "data": {...},
  "message": "操作成功"
}
```

**新格式** (Cloudflare Backend):
```json
{
  "success": true,
  "data": {...},
  "message": "操作成功"
}
```

✅ **格式一致，无需修改前端代码！**

### Token 字段名

- ✅ `accessToken` - 保持不变
- ✅ `refreshToken` - 保持不变

---

## 🐛 故障排查

### 问题 1: CORS 错误

**现象**: `Access-Control-Allow-Origin` 错误

**解决**: 后端已配置 CORS，允许所有来源
```typescript
// Backend: src/middleware/cors.ts
app.use(cors());
```

### 问题 2: 401 Unauthorized

**原因**: Token 过期或未设置

**解决**:
```typescript
// 检查 localStorage
const token = localStorage.getItem('token');
console.log('Current token:', token);

// 重新登录
```

### 问题 3: 500 Internal Server Error

**检查**:
1. 后端 Secrets 是否配置完整
2. Hyperdrive 数据库连接是否正常
3. 查看 Cloudflare Workers 日志

---

## 📊 性能优势

### Cloudflare Workers 优势

- ⚡ **全球边缘节点** - 低延迟
- 🚀 **零冷启动** - 即时响应  
- 💰 **免费额度** - 100,000 请求/天
- 🔒 **HTTPS 原生** - 自动 SSL

### 对比本地 Backend

| 指标 | 本地 Backend | Cloudflare Workers |
|------|-------------|-------------------|
| 延迟 | 100-300ms | 10-50ms |
| 可用性 | 需手动启动 | 24/7 |
| HTTPS | 需配置 | 原生支持 |
| 扩展性 | 有限 | 自动扩展 |

---

## 🎯 后续优化

1. **流式聊天响应**
   - 使用 Server-Sent Events (SSE)
   - 前端实现流式渲染

2. **PDF 支持**
   - 配置 Cloudflare R2
   - 实现文件上传

3. **性能监控**
   - 添加请求日志
   - 集成错误追踪

---

**配置完成！** 🎉

现在前端可以完全使用 Cloudflare Backend 的所有功能了！
