# Nano Studio Backend (Cloudflare Workers)

> 基于 Cloudflare Workers 的生产环境后端服务

高性能、无服务器的后端API，使用 Hono 框架和 Drizzle ORM，部署在 Cloudflare Workers 边缘网络上。

## ✨ 核心功能

- 🔐 **用户认证** - JWT令牌、注册登录、权限控制
- 📝 **会话管理** - 笔记本会话CRUD、多源内容支持
- 📄 **知识源管理** - PDF/网页/文本解析、MinIO存储
- 💬 **RAG对话** - 基于向量检索的智能问答
- 👤 **用户系统** - 个人资料、签到系统、设置管理
- 🗄️ **数据库** - MySQL + Drizzle ORM + Hyperdrive连接池
- 🔍 **向量搜索** - Qdrant向量数据库集成

## 🛠️ 技术栈

### 核心框架
- **Hono 4.6+** - 超高性能Web框架（专为边缘计算优化）
- **TypeScript 5.3+** - 类型安全
- **Cloudflare Workers** - 边缘计算平台

### 数据库 & ORM
- **Drizzle ORM 0.45+** - 轻量级TypeScript ORM
- **MySQL 8.0+** - 关系型数据库
- **Hyperdrive** - Cloudflare数据库连接池

### 存储 & 向量
- **MinIO** - 对象存储（S3兼容）
- **Qdrant** - 向量数据库（RAG检索）

### 认证 & 加密
- **jsonwebtoken 9.0+** - JWT令牌
- **bcryptjs 3.0+** - 密码加密

### 第三方服务
- **Jina Reader API** - 网页内容抓取
- **AWS SDK** - S3操作（MinIO）

## 📁 项目结构

```
nano-back-cloudfare/
├── src/
│   ├── db/               # 数据库配置
│   │   ├── index.ts      # 数据库连接
│   │   └── schema.ts     # Drizzle Schema定义
│   ├── middleware/       # 中间件
│   │   └── auth.ts       # JWT认证中间件
│   ├── routes/           # API路由
│   │   ├── auth.ts       # 认证路由
│   │   ├── user.ts       # 用户路由
│   │   ├── settings.ts   # 设置路由
│   │   ├── session.ts    # 会话路由
│   │   ├── source.ts     # 知识源路由
│   │   ├── chat.ts       # 聊天路由
│   │   └── upload.ts     # 上传路由
│   ├── services/         # 业务逻辑层
│   │   ├── session.service.ts
│   │   ├── source.service.ts
│   │   ├── minio.service.ts
│   │   ├── jina.service.ts
│   │   ├── qdrant.service.ts
│   │   └── llm.service.ts
│   ├── types/            # TypeScript类型定义
│   └── index.ts          # Worker入口
├── drizzle/              # 数据库迁移
├── wrangler.toml         # Cloudflare配置
├── drizzle.config.ts     # Drizzle配置
├── package.json
└── tsconfig.json
```

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- Cloudflare账号
- MySQL数据库
- MinIO对象存储
- Qdrant向量数据库（可选）

### 1. 安装依赖

```bash
cd nano-back-cloudfare
npm install
```

### 2. 配置环境变量

编辑 `wrangler.toml`：

```toml
[vars]
# JWT配置
JWT_SECRET = "your-jwt-secret-key"
JWT_EXPIRES_IN = "7d"

# MinIO配置
MINIO_ENDPOINT = "minio.yourdomain.com"
MINIO_PORT = "443"
MINIO_USE_SSL = "true"
MINIO_ACCESS_KEY = "your-access-key"
MINIO_SECRET_KEY = "your-secret-key"
MINIO_BUCKET = "nano-studio"

# Qdrant配置
QDRANT_URL = "https://your-qdrant-url"
QDRANT_API_KEY = "your-qdrant-key"

# Jina API
JINA_API_KEY = "your-jina-key"
```

### 3. 配置数据库

在 Cloudflare Dashboard 创建 Hyperdrive 配置，然后在 `wrangler.toml` 中绑定：

```toml
[[hyperdrive]]
binding = "DB"
id = "your-hyperdrive-id"
```

### 4. 数据库迁移

```bash
# 生成迁移文件
npm run db:generate

# 推送到数据库
npm run db:push
```

### 5. 本地开发

```bash
npm run dev
```

服务将在 `http://localhost:8787` 启动

### 6. 部署到生产

```bash
npm run deploy
```

## 📊 数据库Schema

### 核心表

- **users** - 用户表
- **sessions** - 会话表
- **sources** - 知识源表
- **notes** - 笔记表（思维导图、总结）
- **user_settings** - 用户设置

详见 `src/db/schema.ts`

## 🔌 API概览

### 认证 (Auth)
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 退出登录

### 用户 (User)
- `GET /api/user/profile` - 获取用户资料
- `PATCH /api/user/profile` - 更新用户资料
- `POST /api/user/check-in` - 每日签到
- `GET /api/user/check-in/stats` - 签到统计

### 设置 (Settings)
- `GET /api/user/settings` - 获取用户设置
- `PUT /api/user/settings` - 更新用户设置

### 会话 (Session)
- `GET /api/sessions` - 获取所有会话
- `GET /api/sessions/:id` - 获取会话详情
- `POST /api/sessions/from-url` - 从URL创建会话
- `POST /api/sessions/from-text` - 从文本创建会话
- `POST /api/sessions/from-pdf` - 从PDF创建会话
- `PATCH /api/sessions/:id` - 更新会话
- `DELETE /api/sessions/:id` - 删除会话
- `POST /api/sessions/:id/notes` - 保存笔记
- `DELETE /api/sessions/notes/:noteId` - 删除笔记

### 知识源 (Source)
- `DELETE /api/sources/:id` - 删除知识源
- `GET /api/sources/:id/rag-status` - RAG处理状态

### 聊天 (Chat)
- `POST /api/chat/completions` - 流式聊天（SSE）

### 上传 (Upload)
- `POST /api/upload/presigned-url` - 获取预签名上传URL

### 健康检查
- `GET /health` - 健康检查
- `GET /db-test` - 数据库测试
- `GET /qdrant-test` - Qdrant测试

详细 API 测试用例见 [api-tests.http](./api-tests.http)

## 🔧 开发指南

### 添加新路由

1. 在 `src/routes/` 创建新路由文件
2. 使用 Hono 路由：

```typescript
import { Hono } from 'hono';
import { authenticateJWT } from '../middleware/auth';

const myRoute = new Hono();
myRoute.use('*', authenticateJWT);

myRoute.get('/', async (c) => {
    return c.json({ message: 'Hello' });
});

export default myRoute;
```

3. 在 `src/index.ts` 注册路由

### 数据库操作

使用 Drizzle ORM：

```typescript
import { createDb } from '../db';

const db = createDb(c.env);

// 查询
const users = await db.select().from(db.schema.users);

// 插入
await db.insert(db.schema.users).values({
    email: 'user@example.com',
    username: 'user'
});
```

### MinIO文件操作

```typescript
import * as minioService from '../services/minio.service';

// 生成预签名上传URL
const { uploadUrl, objectKey } = await minioService.generatePresignedUploadUrl(
    filename,
    userId,
    c.env
);

// 生成下载URL
const downloadUrl = await minioService.generatePresignedDownloadUrl(
    objectKey,
    c.env
);
```

## 🏗️ 架构设计

### 请求流程

```
Client → Cloudflare Workers → [Auth Middleware] → Route Handler → Service Layer → Database/Storage
```

### 关键组件

1. **Hono App** - 路由和中间件
2. **Auth Middleware** - JWT验证
3. **Service Layer** - 业务逻辑封装
4. **Drizzle ORM** - 数据访问层
5. **Hyperdrive** - 数据库连接池（减少冷启动）

## 📦 环境变量说明

| 变量 | 描述 | 必需 |
|------|------|------|
| JWT_SECRET | JWT密钥 | ✅ |
| MINIO_ENDPOINT | MinIO地址 | ✅ |
| MINIO_ACCESS_KEY | MinIO访问密钥 | ✅ |
| MINIO_SECRET_KEY | MinIO秘密密钥 | ✅ |
| QDRANT_URL | Qdrant向量库地址 | ⚠️ |
| QDRANT_API_KEY | Qdrant API密钥 | ⚠️ |
| JINA_API_KEY | Jina Reader密钥 | ⚠️ |

## 🚀 部署流程

### 1. 准备Cloudflare环境

- 创建 Workers 应用
- 配置 Hyperdrive（数据库）
- 配置环境变量和密钥

### 2. 部署命令

```bash
# 测试构建
npm run build

# 部署到生产
npm run deploy
```

### 3. 验证部署

```bash
curl https://your-worker.workers.dev/health
```

## 🔒 安全最佳实践

1. **密钥管理** - 使用 Cloudflare Secrets 存储敏感信息
2. **CORS配置** - 限制允许的来源
3. **速率限制** - 防止滥用
4. **JWT过期** - 设置合理的过期时间
5. **输入验证** - 所有用户输入进行验证

## 🐛 故障排查

### 数据库连接失败
- 检查 Hyperdrive 配置
- 验证数据库凭据
- 查看 Workers 日志

### MinIO上传失败
- 确认 HTTPS 配置正确
- 检查 CORS 设置
- 验证预签名 URL 有效期

### Qdrant连接问题
- 确认 API 密钥正确
- 检查网络访问权限

## 📊 监控和日志

在 Cloudflare Dashboard 查看：
- Workers 分析
- 实时日志
- 错误追踪
- 性能指标

## 🔗 相关项目

- [frontend](../frontend) - Vue 3前端应用
- [backend](../backend) - 开发环境后端（Express.js）
- [backend-cloudflare-poc](../backend-cloudflare-poc) - POC测试项目

## 📄 许可证

MIT License

---

**部署环境**: Cloudflare Workers  
**数据库**: MySQL + Hyperdrive  
**存储**: MinIO (S3-compatible)  
**向量库**: Qdrant
