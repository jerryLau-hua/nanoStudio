/**
 * JWT 认证中间件
 */

import { Context, Next } from 'hono';
import { verifyToken, type TokenPayload } from '../utils/jwt';
import type { Env } from '../db';

export class AppError extends Error {
    constructor(public message: string, public statusCode: number = 500) {
        super(message);
        this.name = 'AppError';
    }
}

/**
 * JWT 认证中间件
 * 验证 Authorization header 中的 Bearer token
 */
export async function authenticateJWT(c: Context<{ Bindings: Env }>, next: Next) {
    try {
        const authHeader = c.req.header('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError('No token provided', 401);
        }

        const token = authHeader.substring(7);
        const secret = c.env.JWT_SECRET;

        if (!secret) {
            throw new Error('JWT_SECRET not configured');
        }

        const decoded = verifyToken(token, secret);

        // 将用户信息存储到 context
        c.set('user', decoded);

        await next();
    } catch (error) {
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode);
        }
        if (error instanceof Error) {
            if (error.message.includes('expired')) {
                return c.json({ error: 'Token expired' }, 401);
            }
            if (error.message.includes('Invalid')) {
                return c.json({ error: 'Invalid token' }, 401);
            }
        }
        return c.json({ error: 'Authentication failed' }, 401);
    }
}

/**
 * 获取当前认证用户
 */
export function getCurrentUser(c: Context): TokenPayload {
    const user = c.get('user') as TokenPayload;
    if (!user) {
        throw new AppError('User not authenticated', 401);
    }
    return user;
}
