/**
 * 签到路由模块 - 使用 Drizzle ORM
 */

import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { createDb, schema, type Env } from '../db';

const checkIn = new Hono<{ Bindings: Env }>();

/**
 * 创建签到记录
 * POST /check-in
 */
checkIn.post('/', async (c) => {
    try {
        const body = await c.req.json<{ userId: number }>();

        if (!body.userId) {
            return c.json({ error: 'Missing required field: userId' }, 400);
        }

        const db = createDb(c.env);
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        try {
            // 尝试插入签到记录
            await db.insert(schema.checkIns).values({
                userId: body.userId,
                date: today,
            });
        } catch (error) {
            // 如果是重复键错误（已经签到过），忽略
            // MySQL 错误代码 1062 = ER_DUP_ENTRY
            if (error instanceof Error && error.message.includes('1062')) {
                // 已经签到过，继续获取记录
            } else {
                throw error;
            }
        }

        // 获取签到记录
        const checkInRecord = await db.query.checkIns.findFirst({
            where: sql`${schema.checkIns.userId} = ${body.userId} AND ${schema.checkIns.date} = ${today}`,
        });

        return c.json(
            {
                success: true,
                message: 'Check-in successful',
                checkIn: checkInRecord,
            },
            201
        );
    } catch (error) {
        console.error('Check-in failed:', error);
        return c.json(
            {
                error: `Failed to check in: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
            500
        );
    }
});

export default checkIn;
