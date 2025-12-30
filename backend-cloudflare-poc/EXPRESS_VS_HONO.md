# Express vs Hono - 代码对比指南

本文档展示了如何从 Express 迁移到 Hono 框架。两者的 API 非常相似！

## 📦 基础设置

### Express (backend 项目)
```typescript
import express from 'express';
import cors from 'cors';

const app = express();

app.use(express.json());
app.use(cors());
```

### Hono (backend-cloudflare-poc)
```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// JSON 解析是内置的，无需显式配置
app.use('*', cors());
```

---

## 🛣️ 路由定义

### Express
```typescript
// 基础路由
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 带参数的路由
app.get('/users/:id', async (req, res) => {
  const id = req.params.id;
  res.json({ id });
});

// POST 请求
app.post('/users', async (req, res) => {
  const body = req.body;
  res.status(201).json({ user: body });
});
```

### Hono
```typescript
// 基础路由
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// 带参数的路由
app.get('/users/:id', async (c) => {
  const id = c.req.param('id');
  return c.json({ id });
});

// POST 请求
app.post('/users', async (c) => {
  const body = await c.req.json();
  return c.json({ user: body }, 201);
});
```

**主要区别：**
- Express 使用 `req, res`，Hono 使用 `c` (Context)
- Express: `req.params.id`，Hono: `c.req.param('id')`
- Express: `res.json()`，Hono: `return c.json()`
- Express: `req.body`，Hono: `await c.req.json()`

---

## 🔧 中间件

### Express
```typescript
import cors from 'cors';
import morgan from 'morgan';

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST']
}));

app.use(morgan('combined'));

// 自定义中间件
app.use((req, res, next) => {
  console.log('Custom middleware');
  next();
});
```

### Hono
```typescript
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST']
}));

app.use('*', logger());

// 自定义中间件
app.use('*', async (c, next) => {
  console.log('Custom middleware');
  await next();
});
```

**主要区别：**
- Hono 的中间件需要指定路径模式 (如 `'*'`)
- Hono: `await next()`，Express: `next()`

---

## 📁 路由模块化

### Express
```typescript
// routes/users.ts
import { Router } from 'express';

const router = Router();

router.get('/', async (req, res) => {
  res.json({ users: [] });
});

router.get('/:id', async (req, res) => {
  res.json({ id: req.params.id });
});

export default router;

// app.ts
import usersRouter from './routes/users';
app.use('/users', usersRouter);
```

### Hono
```typescript
// routes/users.ts
import { Hono } from 'hono';

const users = new Hono();

users.get('/', async (c) => {
  return c.json({ users: [] });
});

users.get('/:id', async (c) => {
  return c.json({ id: c.req.param('id') });
});

export default users;

// index.ts
import usersRouter from './routes/users';
app.route('/users', usersRouter);
```

**主要区别：**
- Express: `Router()`，Hono: `new Hono()`
- Express: `app.use()`，Hono: `app.route()`

---

## ❌ 错误处理

### Express
```typescript
// 404 处理
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found'
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: err.message
  });
});
```

### Hono
```typescript
// 404 处理
app.notFound((c) => {
  return c.json(
    { error: 'Not Found' },
    404
  );
});

// 错误处理
app.onError((err, c) => {
  console.error(err);
  return c.json(
    { error: err.message },
    500
  );
});
```

**主要区别：**
- Hono 提供了专门的 `notFound()` 和 `onError()` 方法
- 更简洁、类型安全

---

## 🗄️ 数据库集成 (Prisma)

### Express
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

app.get('/users', async (req, res) => {
  const users = await prisma.user.findMany();
  res.json({ users });
});
```

### Hono (Cloudflare Workers)
```typescript
import { createPrismaClient } from './db';

app.get('/users', async (c) => {
  const prisma = createPrismaClient(c.env);
  const users = await prisma.user.findMany();
  return c.json({ users });
});
```

**主要区别：**
- Cloudflare Workers 使用 Prisma Client for Edge
- 需要通过环境变量传递配置

---

## 🚀 启动服务器

### Express
```typescript
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Hono (Cloudflare Workers)
```typescript
// 不需要显式启动服务器
export default app;

// Cloudflare Workers 自动处理请求
```

---

## 📊 相似度总结

| 功能 | Express | Hono | 相似度 |
|------|---------|------|--------|
| 路由定义 | ✅ | ✅ | 95% |
| 中间件 | ✅ | ✅ | 90% |
| 路由模块化 | ✅ | ✅ | 95% |
| 错误处理 | ✅ | ✅ | 85% |
| 请求/响应 API | ✅ | ✅ | 80% |

## 🎯 迁移要点

### 快速替换清单

1. **导入**
   - `express` → `hono`
   - `Router` → `Hono`

2. **路由处理器**
   - `(req, res)` → `(c)`
   - `res.json()` → `return c.json()`
   - `req.params.id` → `c.req.param('id')`
   - `req.body` → `await c.req.json()`

3. **中间件**
   - `app.use(middleware)` → `app.use('*', middleware)`
   - `next()` → `await next()`

4. **路由挂载**
   - `app.use('/path', router)` → `app.route('/path', router)`

5. **错误处理**
   - 404 中间件 → `app.notFound()`
   - 错误中间件 → `app.onError()`

---

## 💡 Hono 的额外优势

1. **类型安全**: 完整的 TypeScript 支持
2. **轻量级**: 比 Express 更小的包体积
3. **多平台**: 支持 Cloudflare Workers、Deno、Bun、Node.js
4. **性能**: 专为边缘计算优化
5. **内置功能**: JSON 解析、CORS、Logger 等都是内置的

---

## 🔗 参考资源

- [Hono 官方文档](https://hono.dev/)
- [Hono 迁移指南](https://hono.dev/getting-started/migration)
- [Express vs Hono 性能对比](https://hono.dev/concepts/benchmarks)
