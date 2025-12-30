# Nano Studio Backend (Express.js)

> 本地开发调试环境 + 私有服务器部署备选方案

基于 Express.js + Prisma 的后端服务，提供完整的本地开发调试能力，也可作为私有服务器的部署方案（无Cloudflare依赖）。

## 📌 项目定位

### 🔧 开发环境
- **问题**：Cloudflare Workers 本地调试受限
- **解决**：提供完整的本地开发环境
- **优势**：快速迭代、实时调试、数据库直连

### 🏢 私有部署备选
- 不依赖 Cloudflare Workers
- 可部署到任何私有服务器
- 完全自主可控的数据

## 🛠️ 技术栈

### 核心框架
- **Express.js 4.18+** - Node.js Web框架
- **TypeScript 5.3+** - 类型安全
- **Node.js 18.0+** - 运行时

### 数据库 & ORM
- **Prisma 5.22+** - 下一代TypeScript ORM
- **MySQL 8.0+** - 关系型数据库

### 存储 & 向量
- **MinIO 8.0+** - 对象存储（S3兼容）
- **Qdrant** - 向量数据库

### 认证 & 安全
- **jsonwebtoken 9.0+** - JWT Token
- **bcrypt 5.1+** - 密码加密
- **Helmet 7.1+** - HTTP安全头
- **express-rate-limit 7.1+** - 限流

### 工具库
- **Winston 3.11+** - 日志记录
- **Joi 17.11+** - 数据验证
- **Multer 2.0+** - 文件上传
- **pdf-parse 2.4+** - PDF解析

## 📁 项目结构

```
backend/
├── prisma/               # Prisma Schema和迁移
│   ├── schema.prisma     # 数据库模型定义
│   └── migrations/       # 数据库迁移文件
├── src/
│   ├── controllers/      # 控制器层
│   │   ├── auth.controller.ts
│   │   ├── user.controller.ts
│   │   ├── session.controller.ts
│   │   ├── source.controller.ts
│   │   └── chat.controller.ts
│   ├── middleware/       # 中间件
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── validation.middleware.ts
│   ├── routes/           # 路由定义
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── session.routes.ts
│   │   ├── source.routes.ts
│   │   └── chat.routes.ts
│   ├── services/         # 业务逻辑层
│   │   ├── auth.service.ts
│   │   ├── session.service.ts
│   │   ├── minio.service.ts
│   │   ├── qdrant.service.ts
│   │   └── llm.service.ts
│   ├── utils/            # 工具函数
│   │   ├── logger.ts
│   │   └── validators.ts
│   ├── types/            # TypeScript类型
│   ├── config/           # 配置文件
│   │   └── database.ts
│   └── app.ts            # Express应用入口
├── .env                  # 环境变量（需创建）
├── .env.example          # 环境变量示例
├── package.json
└── tsconfig.json
```

## 🚀 快速开始（完整流程）

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- MySQL 8.0+
- MinIO（可选，文件上传功能需要）
- Qdrant（可选，向量检索功能需要）

### Step 1: 安装依赖

```bash
cd backend
npm install
```

### Step 2: 准备 MySQL 数据库

#### 方法一：使用 Docker（推荐）

```bash
# 启动 MySQL 容器
docker run -d \
  --name nano-mysql \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -e MYSQL_DATABASE=nano_studio \
  -p 3306:3306 \
  mysql:8.0

# 验证数据库运行
docker ps | grep nano-mysql
```

#### 方法二：本地 MySQL

```bash
# 登录 MySQL
mysql -u root -p

# 创建数据库
CREATE DATABASE nano_studio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 创建用户（可选）
CREATE USER 'nano_user'@'localhost' IDENTIFIED BY 'nano_password';
GRANT ALL PRIVILEGES ON nano_studio.* TO 'nano_user'@'localhost';
FLUSH PRIVILEGES;

# 退出
EXIT;
```

### Step 3: 配置环境变量

复制示例配置文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 服务器配置
PORT=3000
NODE_ENV=development

# 数据库配置（根据实际情况修改）
DATABASE_URL="mysql://root:root123@localhost:3306/nano_studio"
# 或使用自定义用户
# DATABASE_URL="mysql://nano_user:nano_password@localhost:3306/nano_studio"

# JWT配置（生产环境请修改为强密钥）
JWT_SECRET=dev-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# MinIO配置（可选）
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=nano-studio

# Qdrant配置（可选）
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# Jina API（网页抓取，可选）
JINA_API_KEY=

# CORS配置
CORS_ORIGIN=http://localhost:5173
```

### Step 4: 初始化数据库

#### 生成 Prisma Client

```bash
npm run db:generate
```

#### 运行数据库迁移

```bash
# 开发环境：创建和应用迁移
npm run db:migrate

# 或直接推送 Schema（快速开发）
npm run db:push
```

#### 查看数据库结构

```bash
# 使用 Prisma Studio 可视化管理数据库
npm run db:studio
```

浏览器会自动打开 `http://localhost:5555`

### Step 5: （可选）导入测试数据

如果有种子数据文件：

```bash
npm run db:seed
```

或手动创建测试用户：

```sql
-- 直接在数据库中插入测试用户
USE nano_studio;

INSERT INTO User (email, username, password, createdAt, updatedAt) 
VALUES (
  'test@example.com', 
  'testuser', 
  '$2b$10$YourHashedPasswordHere',  -- 需要先加密密码
  NOW(), 
  NOW()
);
```

**建议：通过 API 注册第一个用户**

```bash
# 启动服务器后调用注册接口
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "username": "admin",
    "password": "Admin123456"
  }'
```

### Step 6: （可选）启动 MinIO

如果需要文件上传功能：

```bash
# 使用 Docker 启动 MinIO
docker run -d \
  --name nano-minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  quay.io/minio/minio server /data --console-address ":9001"

# 创建 bucket（首次需要）
# 访问 http://localhost:9001
# 登录：minioadmin / minioadmin
# 创建名为 "nano-studio" 的 bucket
```

### Step 7: （可选）启动 Qdrant

如果需要向量检索功能：

```bash
# 使用 Docker 启动 Qdrant
docker run -d \
  --name nano-qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  qdrant/qdrant
```

### Step 8: 启动开发服务器

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动

### Step 9: 验证安装

#### 测试健康检查

```bash
curl http://localhost:3000/api/health
```

预期响应：

```json
{
  "status": "ok",
  "timestamp": "2025-12-30T10:15:00.000Z"
}
```

#### 测试数据库连接

```bash
curl http://localhost:3000/api/health/db
```

#### 使用 API 测试文件

在 VS Code 中安装 REST Client 插件，然后打开 `api-tests.http` 进行测试。

### 🎉 完成！

现在你可以：
1. 访问 API：`http://localhost:3000`
2. 使用前端连接：修改前端 `.env` 中的 `VITE_API_URL=http://localhost:3000/api`
3. 查看数据库：`http://localhost:5555` (Prisma Studio)
4. MinIO 控制台：`http://localhost:9001`（如已启动）

---

## 📝 常用命令速查

```bash
# 开发
npm run dev              # 启动开发服务器（热重载）
npm run db:studio        # 打开数据库管理界面

# 数据库
npm run db:generate      # 生成 Prisma Client
npm run db:push          # 快速同步 Schema
npm run db:migrate       # 创建并运行迁移
npm run db:seed          # 导入种子数据

# 生产
npm run build            # 构建项目
npm start                # 启动生产服务器

# 工具
npm test                 # 运行测试
npm run lint             # 代码检查

# Docker 快速启动所有服务
docker-compose up -d     # 如果有 docker-compose.yml
```

## 🐳 Docker Compose 一键启动（推荐）

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root123
      MYSQL_DATABASE: nano_studio
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

  minio:
    image: quay.io/minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

  qdrant:
    image: qdrant/qdrant
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage

volumes:
  mysql_data:
  minio_data:
  qdrant_data:
```

启动所有服务：

```bash
docker-compose up -d
```

停止所有服务：

```bash
docker-compose down
```

## 📊 数据库Schema

### 核心模型

```prisma
model User {
  id        Int       @id @default(autoincrement())
  email     String    @unique
  username  String
  password  String
  sessions  Session[]
  sources   Source[]
  settings  UserSettings?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Session {
  id        Int      @id @default(autoincrement())
  title     String
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  sources   Source[]
  notes     Note[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Source {
  id        Int      @id @default(autoincrement())
  name      String
  type      String   // 'pdf' | 'website' | 'text'
  content   String   @db.Text
  sessionId Int
  session   Session  @relation(fields: [sessionId], references: [id])
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
}
```

详见 `prisma/schema.prisma`

## 🔌 API端点

与 `nano-back-cloudfare` 保持一致的API设计，详见 [api-tests.http](./api-tests.http)

### 核心端点

- 🔐 **Auth**: `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`
- 👤 **User**: `/api/user/profile`, `/api/user/check-in`, `/api/user/check-in/stats`
- ⚙️ **Settings**: `/api/user/settings`
- 📝 **Session**: `/api/sessions/*`
- 📚 **Source**: `/api/sources/*`
- 💬 **Chat**: `/api/chat/completions`
- 📤 **Upload**: `/api/upload/presigned-url`

## 🔧 开发指南

### 添加新的API端点

1. **定义 Prisma Model**（如需要）

```prisma
// prisma/schema.prisma
model NewModel {
  id   Int    @id @default(autoincrement())
  name String
}
```

2. **创建 Controller**

```typescript
// src/controllers/example.controller.ts
export const getExamples = async (req, res) => {
  const examples = await prisma.example.findMany();
  res.json({ data: examples });
};
```

3. **创建 Route**

```typescript
// src/routes/example.routes.ts
import express from 'express';
import { getExamples } from '../controllers/example.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();
router.get('/', authenticateToken, getExamples);

export default router;
```

4. **注册路由**

```typescript
// src/app.ts
import exampleRoutes from './routes/example.routes';
app.use('/api/examples', exampleRoutes);
```

### Prisma操作示例

```typescript
// 查询
const users = await prisma.user.findMany({
  include: { sessions: true }
});

// 创建
const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    username: 'user',
    password: hashedPassword
  }
});

// 更新
await prisma.user.update({
  where: { id: userId },
  data: { username: 'newname' }
});

// 删除
await prisma.user.delete({
  where: { id: userId }
});
```

## 🏢 私有服务器部署

### 1. 构建项目

```bash
npm run build
```

### 2. 配置生产环境变量

```env
NODE_ENV=production
DATABASE_URL=mysql://user:pass@your-db-host:3306/nano_studio
# ... 其他配置
```

### 3. 运行生产服务

```bash
npm start
```

### 4. 使用 PM2 守护进程

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start dist/app.js --name nano-backend

# 查看日志
pm2 logs nano-backend

# 设置开机自启
pm2 startup
pm2 save
```

### 5. Nginx 反向代理

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔒 安全配置

### 生产环境检查清单

- [ ] 设置强 JWT_SECRET
- [ ] 启用 HTTPS
- [ ] 配置 CORS 白名单
- [ ] 启用速率限制
- [ ] 使用环境变量管理敏感信息
- [ ] 定期更新依赖
- [ ] 配置日志记录
- [ ] 数据库备份策略

## 📦 脚本命令

| 命令 | 描述 |
|------|------|
| `npm run dev` | 启动开发服务器（Nodemon热重载）|
| `npm run build` | 构建生产版本 |
| `npm start` | 启动生产服务器 |
| `npm run db:generate` | 生成 Prisma Client |
| `npm run db:push` | 推送Schema到数据库 |
| `npm run db:migrate` | 运行数据库迁移 |
| `npm run db:studio` | 打开 Prisma Studio |
| `npm test` | 运行测试 |
| `npm run lint` | 代码检查 |

## 🐛 常见问题

### 数据库连接失败

```bash
# 检查数据库服务
sudo systemctl status mysql

# 测试连接
mysql -u username -p -h localhost
```

### MinIO连接问题

```bash
# 检查MinIO服务
docker ps | grep minio

# 使用mc工具测试
mc alias set local http://localhost:9000 minioadmin minioadmin
mc ls local
```

### 端口占用

```bash
# 查看端口占用
lsof -i :3000

# 终止进程
kill -9 <PID>
```

## 与 nano-back-cloudfare 的差异

| 特性 | backend (Express.js) | nano-back-cloudfare (Workers) |
|------|----------------------|-------------------------------|
| **用途** | 开发调试 + 私有部署 | 生产环境 |
| **ORM** | Prisma | Drizzle |
| **数据库连接** | 直连 | Hyperdrive连接池 |
| **文件上传** | Multer | 预签名URL |
| **部署** | PM2/Docker | Cloudflare Workers |
| **冷启动** | 无 | 有 |
| **调试** | 完全支持 | 受限 |

## 🔗 相关资源

- [Prisma 文档](https://www.prisma.io/docs)
- [Express.js 文档](https://expressjs.com/)
- [TypeScript 文档](https://www.typescriptlang.org/)

## 🔗 相关项目

- [frontend](../frontend) - Vue 3前端应用
- [nano-back-cloudfare](../nano-back-cloudfare) - 生产环境后端
- [backend-cloudflare-poc](../backend-cloudflare-poc) - POC测试

## 📄 许可证

MIT License

---

**开发环境**: Express.js + Prisma + MySQL  
**生产备选**: 可部署到任何支持Node.js的服务器  
**推荐用途**: 本地开发调试 / 私有服务器部署
