/**
 * 日志中间件
 * 类似 Express 的 morgan 中间件
 */

import { logger as honoLogger } from 'hono/logger';

export const logger = honoLogger((message: string) => {
    console.log(message);
});
