/**
 * 用户路由模块 - 使用 Drizzle ORM
 */

import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { createDb, schema, type Env } from '../db';

const users = new Hono<{ Bindings: Env }>();

/**
 * 获取用户列表
 * GET /users
 */
users.get('/', async (c) => {
    try {
        const db = createDb(c.env);

        const userList = await db.query.users.findMany({
            columns: {
                id: true,
                email: true,
                username: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: [desc(schema.users.createdAt)],
            limit: 50,
        });

        return c.json({
            success: true,
            count: userList.length,
            users: userList,
        });
    } catch (error) {
        console.error('Get users failed:', error);
        return c.json(
            {
                error: `Failed to fetch users: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
            500
        );
    }
});

/**
 * 获取单个用户（含签到记录）
 * GET /users/:id
 */
users.get('/:id', async (c) => {
    try {
        const id = parseInt(c.req.param('id'), 10);

        if (isNaN(id)) {
            return c.json({ error: 'Invalid user ID' }, 400);
        }

        const db = createDb(c.env);

        // 使用 Drizzle 的关系查询
        const user = await db.query.users.findFirst({
            where: eq(schema.users.id, id),
            columns: {
                password: false, // 排除密码字段
            },
            with: {
                checkIns: {
                    orderBy: [desc(schema.checkIns.date)],
                    limit: 10,
                },
            },
        });

        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        return c.json({
            success: true,
            user,
        });
    } catch (error) {
        console.error('Get user failed:', error);
        return c.json(
            {
                error: `Failed to fetch user: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
            500
        );
    }
});

/**
 * 创建用户
 * POST /users
 */
users.post('/', async (c) => {
    try {
        const body = await c.req.json<{ email: string; username: string; password: string }>();

        // 基本验证
        if (!body.email || !body.username || !body.password) {
            return c.json(
                { error: 'Missing required fields: email, username, password' },
                400
            );
        }

        const db = createDb(c.env);

        // 插入用户
        const result = await db.insert(schema.users).values({
            email: body.email,
            username: body.username,
            password: body.password,
        });

        // 获取新创建的用户
        const newUser = await db.query.users.findFirst({
            where: eq(schema.users.email, body.email),
            columns: {
                password: false,
            },
        });

        return c.json(
            {
                success: true,
                message: 'User created successfully',
                user: newUser,
            },
            201
        );
    } catch (error) {
        console.error('Create user failed:', error);
        return c.json(
            {
                error: `Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
            500
        );
    }
});

export default users;
