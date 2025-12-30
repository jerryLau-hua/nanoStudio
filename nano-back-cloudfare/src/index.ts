/**
 * Nano Studio Backend - Cloudflare Workers
 * 使用 Hono 框架 + Drizzle ORM
 */

import { Hono } from 'hono';
import { createDb, type Env } from './db';
import { count } from 'drizzle-orm';
import { cors } from './middleware/cors';
import { logger } from './middleware/logger';

// 导入路由
import authRouter from './routes/auth';
import userRouter from './routes/user';
import settingsRouter from './routes/settings';
import sessionRouter from './routes/session';
import chatRouter from './routes/chat';
import sourceRouter from './routes/source';
import uploadRouter from './routes/upload';

// 创建 Hono 应用实例
const app = new Hono<{ Bindings: Env }>();

// ==================== 中间件 ====================

// 日志中间件
app.use('*', logger);

// CORS 中间件
app.use('*', cors);

// ==================== 基础路由 ====================

/**
 * 健康检查端点
 * GET /health
 */
app.get('/health', (c) => {
    return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'nano-back-cloudfare',
        framework: 'Hono',
        orm: 'Drizzle ORM',
        database: 'MySQL (via Hyperdrive)',
        version: '1.0.0',
    });
});

/**
 * 数据库连接测试端点
 * GET /db-test
 */
app.get('/db-test', async (c) => {
    try {
        const db = createDb(c.env);

        // 执行简单查询测试连接
        const result = await db.select({ count: count() }).from(db.schema.users);
        const userCount = result[0]?.count || 0;

        return c.json({
            status: 'ok',
            database: 'connected',
            userCount,
            message: 'Database connection successful via Hyperdrive',
            orm: 'Drizzle ORM',
            driver: 'mysql2/promise',
        });
    } catch (error) {
        console.error('Database test failed:', error);
        return c.json(
            {
                error: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                details: error instanceof Error ? error.stack : undefined,
            },
            500
        );
    }
});

// ==================== API 路由 ====================

// 认证路由
app.route('/api/auth', authRouter);

// 用户路由
app.route('/api/user', userRouter);

// 设置路由（兼容前端路径）
app.route('/api/user/settings', settingsRouter);
app.route('/api/settings', settingsRouter);

// 会话路由
app.route('/api/sessions', sessionRouter);

// 资源路由
app.route('/api/sources', sourceRouter);

// 聊天路由
app.route('/api/chat', chatRouter);

// 文件上传路由
app.route('/api/upload', uploadRouter);

// ==================== 404 处理 ====================

app.notFound((c) => {
    return c.json(
        {
            error: 'Not Found',
            message: `Route ${c.req.method} ${c.req.path} not found`,
            timestamp: new Date().toISOString(),
        },
        404
    );
});

// ==================== 错误处理 ====================

app.onError((err, c) => {
    console.error('Application error:', err);

    // 如果是自定义错误
    if (err.name === 'AppError') {
        return c.json(
            {
                error: err.message,
            },
            (err as any).statusCode || 500
        );
    }

    // 通用错误处理
    return c.json(
        {
            error: 'Internal Server Error',
            message: err.message,
        },
        500
    );
});

// 测试 Qdrant 连接
app.get('/qdrant-test', async (c) => {
    try {
        // 1. 获取基础配置
        // 确保你的 wrangler.toml 或环境里配置了 QDRANT_URL (不带末尾斜杠，如 http://8.140.x.x:6333)
        const qdrantUrl = c.env.QDRANT_URL;

        if (!qdrantUrl) {
            return c.json({ error: 'QDRANT_URL not configured' }, 500);
        }

        // 2. 构造请求头 (关键修复)
        // 很多云厂商会拦截 Cloudflare Workers 默认的 User-Agent
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            // 👇 伪装成 Chrome 浏览器，防止被防火墙当做 Bot 拦截
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        };

        // 如果你有 api-key，就在这里加上；如果没有，千万别传空的 api-key
        if (c.env.QDRANT_API_KEY) {
            headers['api-key'] = c.env.QDRANT_API_KEY;
        }

        // --- 测试 1: 基础连接 (/healthz) ---
        // 注意：Qdrant 的健康检查通常是 /healthz 而不是 /health
        const healthResponse = await fetch(`${qdrantUrl}/healthz`, {
            method: 'GET',
            headers: headers
        });

        // 如果失败，读取错误信息 (看看是谁拦截的)
        const healthErrorMsg = !healthResponse.ok ? await healthResponse.text() : null;


        // --- 测试 2: 获取集合列表 (/collections) ---
        const collectionsResponse = await fetch(`${qdrantUrl}/collections`, {
            method: 'GET',
            headers: headers
        });

        const collectionsErrorMsg = !collectionsResponse.ok ? await collectionsResponse.text() : null;
        const collectionsData = collectionsResponse.ok ? await collectionsResponse.json() : null;


        // 3. 返回详细调试结果
        return c.json({
            success: true,
            qdrantUrl,
            debug_tips: "如果状态是 403 且 error_body 包含 HTML，通常是被 WAF/防火墙 拦截了",
            tests: {
                health: {
                    status: healthResponse.status,
                    ok: healthResponse.ok,
                    // 如果被拦截，这里会显示拦截者的信息
                    error_body: healthErrorMsg,
                },
                collections: {
                    status: collectionsResponse.status,
                    ok: collectionsResponse.ok,
                    data: collectionsData,
                    error_body: collectionsErrorMsg,
                },
            },
            timestamp: new Date().toISOString(),
        });

    } catch (error: any) {
        return c.json({
            error: 'Qdrant test failed',
            message: error.message,
            stack: error.stack,
            cause: "可能是网络不通，或者是 Cloudflare 限制了非标准端口（如 6333 没开 HTTPS）",
        }, 500);
    }
});
// ==================== 导出 ====================

export default app;
