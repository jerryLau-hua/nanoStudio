/**
 * 认证路由
 * POST /api/auth/register - 用户注册
 * POST /api/auth/login - 用户登录
 * POST /api/auth/refresh - 刷新 Token
 * GET /api/auth/me - 获取当前用户信息
 */

import { Hono } from 'hono';
import { createDb, type Env } from '../db';
import { authenticateJWT, getCurrentUser, AppError } from '../middleware/auth';
import { refreshAccessToken } from '../utils/jwt';
import * as authService from '../services/auth.service';

const auth = new Hono<{ Bindings: Env }>();

/**
 * 用户注册
 * POST /api/auth/register
 */
auth.post('/register', async (c) => {
    try {
        const body = await c.req.json<{ email: string; username: string; password: string }>();

        // 基本验证
        if (!body.email || !body.username || !body.password) {
            return c.json(
                { error: 'Missing required fields: email, username, password' },
                400
            );
        }

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(body.email)) {
            return c.json({ error: '邮箱格式不正确' }, 400);
        }

        // 验证密码强度
        if (body.password.length < 6) {
            return c.json({ error: '密码长度至少为 6 个字符' }, 400);
        }

        const db = createDb(c.env);
        const result = await authService.register(body, db, c.env);

        return c.json(
            {
                success: true,
                message: '注册成功',
                data: result,
            },
            201
        );
    } catch (error) {
        console.error('Register failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode);
        }
        return c.json(
            {
                error: `注册失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
            500
        );
    }
});

/**
 * 用户登录
 * POST /api/auth/login
 */
auth.post('/login', async (c) => {
    try {
        const body = await c.req.json<{ email: string; password: string }>();

        // 基本验证
        if (!body.email || !body.password) {
            return c.json({ error: 'Missing required fields: email, password' }, 400);
        }

        const db = createDb(c.env);
        const result = await authService.login(body, db, c.env);

        return c.json({
            success: true,
            message: '登录成功',
            data: result,
        });
    } catch (error) {
        console.error('Login failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode);
        }
        return c.json(
            {
                error: `登录失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
            500
        );
    }
});

/**
 * 刷新 Token
 * POST /api/auth/refresh
 */
auth.post('/refresh', async (c) => {
    try {
        const body = await c.req.json<{ refreshToken: string }>();

        if (!body.refreshToken) {
            return c.json({ error: 'Missing refresh token' }, 400);
        }

        const newAccessToken = refreshAccessToken(body.refreshToken, c.env.JWT_SECRET);

        return c.json({
            success: true,
            data: {
                accessToken: newAccessToken,
            },
        });
    } catch (error) {
        console.error('Token refresh failed:', error);
        return c.json(
            {
                error: `刷新 Token 失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
            401
        );
    }
});

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
auth.get('/me', authenticateJWT, async (c) => {
    try {
        const user = getCurrentUser(c);
        const db = createDb(c.env);

        const userInfo = await authService.getCurrentUserInfo(user.userId, db);

        return c.json({
            success: true,
            data: {
                user: userInfo,
            },
        });
    } catch (error) {
        console.error('Get current user failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode);
        }
        return c.json(
            {
                error: `获取用户信息失败: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
            500
        );
    }
});

/**
 * 登出（客户端操作，服务端无需处理）
 * POST /api/auth/logout
 */
auth.post('/logout', authenticateJWT, async (c) => {
    return c.json({
        success: true,
        message: '登出成功',
    });
});

export default auth;
