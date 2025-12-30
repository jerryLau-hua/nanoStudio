/**
 * CORS 中间件
 */

import { Context, Next } from 'hono';

export async function cors(c: Context, next: Next) {
    const origin = c.req.header('Origin');

    // 允许所有来源（公共 API）
    // 如果需要限制特定域名，可以添加到 allowedOrigins 数组
    if (origin) {
        c.header('Access-Control-Allow-Origin', origin);
    } else {
        c.header('Access-Control-Allow-Origin', '*');
    }

    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Max-Age', '86400'); // 24 hours

    // Handle preflight requests
    if (c.req.method === 'OPTIONS') {
        return c.text('', 204);
    }

    await next();
}
