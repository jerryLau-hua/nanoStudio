/**
 * Cloudflare Workers + Hyperdrive + MySQL POC (Hono 版本)
 * 使用 Hono 框架提供类似 Express 的开发体验
 */

import { Hono } from 'hono';
import { createDb, schema, type Env } from './db';
import { count } from 'drizzle-orm';
import { cors } from './middleware/cors';
import { logger } from './middleware/logger';
import usersRouter from './routes/users';
import checkInRouter from './routes/check-in';

// 创建 Hono 应用实例
const app = new Hono<{ Bindings: Env }>();

// ==================== 中间件 ====================

// 日志中间件 (类似 Express 的 morgan)
app.use('*', logger);

// CORS 中间件 (类似 Express 的 cors)
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
        service: 'backend-cloudflare-poc',
        framework: 'Hono',
        orm: 'Drizzle ORM',
        database: 'MySQL (via Hyperdrive)',
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
        const result = await db.select({ count: count() }).from(schema.users);
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

// ==================== 路由模块 ====================

// 用户路由 (类似 Express 的 app.use('/users', usersRouter))
app.route('/users', usersRouter);

// 签到路由
app.route('/check-in', checkInRouter);

// ==================== 404 处理 ====================

app.notFound((c) => {
    return c.json(
        {
            error: 'Not Found',
            message: `Route ${c.req.method} ${c.req.path} not found`,
        },
        404
    );
});

// ==================== 错误处理 ====================

app.onError((err, c) => {
    console.error('Application error:', err);
    return c.json(
        {
            error: 'Internal Server Error',
            message: err.message,
        },
        500
    );
});

// ==================== 导出 ====================

export default app;
