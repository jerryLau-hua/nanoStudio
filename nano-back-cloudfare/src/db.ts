/**
 * 数据库连接层 - 使用 Drizzle ORM + mysql2
 * 配合 Hyperdrive 使用
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

export interface Env {
    HYPERDRIVE: Hyperdrive;
    JWT_SECRET: string;
    ENCRYPTION_KEY: string;
    DEEPSEEK_API_KEY?: string;
    DEEPSEEK_API_URL?: string;
    QDRANT_URL?: string;
    QDRANT_API_KEY?: string;
    JINA_API_KEY?: string;
}

/**
 * 创建 Drizzle 数据库实例
 * @param env - Cloudflare Workers 环境变量
 * @returns Drizzle DB instance with schema attached
 */
export function createDb(env: Env) {
    // 创建 mysql2 连接池
    const pool = mysql.createPool({
        host: env.HYPERDRIVE.host,
        user: env.HYPERDRIVE.user,
        password: env.HYPERDRIVE.password,
        database: env.HYPERDRIVE.database,
        port: env.HYPERDRIVE.port,
        disableEval: true, // Required for Workers
    });

    // 创建 Drizzle 实例
    const db = drizzle(pool, { schema, mode: 'default' });

    // 手动附加 schema 以便通过 db.schema 访问
    return Object.assign(db, { schema });
}

// 导出 schema 以便在其他地方使用
export { schema };
export type { Env };
