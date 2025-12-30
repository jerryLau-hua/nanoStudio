/**
 * CORS 中间件
 * 类似 Express 的 cors 中间件
 */

import { cors as honoCors } from 'hono/cors';

export const cors = honoCors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: false,
});
