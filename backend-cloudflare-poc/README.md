# Backend Cloudflare POC

> Cloudflare Workers 技术验证项目

这是一个概念验证(POC)项目，用于测试和验证Cloudflare Workers相关技术方案。

## 📌 项目目的

- 验证 Cloudflare Workers + Hono 框架可行性
- 测试 Drizzle ORM 在边缘计算环境的表现
- 探索 Hyperdrive 数据库连接池方案
- 评估边缘计算部署流程

## ⚠️ 项目状态

**POC 测试项目** - 用于技术验证，不用于生产环境

### 验证完成的技术

- ✅ Cloudflare Workers 基础能力
- ✅ Hono 框架在Workers中的性能
- ✅ Drizzle ORM 集成
- ✅ Hyperdrive 数据库连接
- ✅ JWT 认证流程
- ✅ MinIO S3 兼容存储

### 后续方向

本POC的成功验证促成了 `nano-back-cloudfare` 项目的创建，该项目已投入生产使用。

## 🛠️ 技术栈

- Hono 4.x
- Drizzle ORM
- Cloudflare Workers
- TypeScript

## 🚀 快速启动

```bash
cd backend-cloudflare-poc
npm install
npm run dev
```

## 📝 主要测试内容

1. **性能测试** - 冷启动时间、响应延迟
2. **数据库连接** - Hyperdrive连接池效果
3. **文件上传** - MinIO预签名URL方案
4. **认证流程** - JWT在边缘环境的实现

## 🔗 相关项目

- [nano-back-cloudfare](../nano-back-cloudfare) - 生产环境实现（基于此POC）
- [backend](../backend) - 本地开发环境
- [frontend](../frontend) - 前端应用

## 📄 许可证

MIT License

---

**项目性质**: 技术验证 POC  
**状态**: 已完成验证  
**生产版本**: 请使用 `nano-back-cloudfare`
