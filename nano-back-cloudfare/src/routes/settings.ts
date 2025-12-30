/**
 * 设置路由
 * GET /api/user/settings - 获取用户设置
 * PUT /api/user/settings - 更新用户设置
 */

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createDb, type Env } from '../db';
import { authenticateJWT, getCurrentUser, AppError } from '../middleware/auth';
import { encryptApiKey, decryptApiKey } from '../utils/encryption';

const settings = new Hono<{ Bindings: Env }>();

// 所有设置路由都需要认证
settings.use('*', authenticateJWT);

/**
 * 获取用户设置
 * GET /api/user/settings
 */
settings.get('/', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const db = createDb(c.env);

        let userSettings = await db.query.userSettings.findFirst({
            where: eq(db.schema.userSettings.userId, currentUser.userId),
        });

        // 如果设置不存在，创建默认设置
        if (!userSettings) {
            await db.insert(db.schema.userSettings).values({
                userId: currentUser.userId,
                apiUrl: 'https://api.deepseek.com/chat/completions',
                model: 'deepseek-chat',
            });

            userSettings = await db.query.userSettings.findFirst({
                where: eq(db.schema.userSettings.userId, currentUser.userId),
            });
        }

        // 解密 API Key（如果存在）
        let apiKey = null;
        if (userSettings?.apiKeyEncrypted) {
            try {
                apiKey = await decryptApiKey(userSettings.apiKeyEncrypted, c.env.ENCRYPTION_KEY);
            } catch (error) {
                console.error('Failed to decrypt API key:', error);
                // 如果解密失败，返回 null
            }
        }

        return c.json({
            data: {
                apiUrl: userSettings?.apiUrl,
                model: userSettings?.model,
                apiKey, // 返回解密后的 API Key
            },
        });
    } catch (error) {
        console.error('Get settings failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode);
        }
        return c.json({ error: 'Failed to get settings' }, 500);
    }
});

/**
 * 更新用户设置
 * PUT /api/user/settings
 */
settings.put('/', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const body = await c.req.json<{
            apiKey?: string;
            apiUrl?: string;
            model?: string;
        }>();

        const db = createDb(c.env);

        // 检查设置是否存在
        const existingSettings = await db.query.userSettings.findFirst({
            where: eq(db.schema.userSettings.userId, currentUser.userId),
        });

        // 准备更新数据
        const updateData: any = {};

        if (body.apiUrl !== undefined) {
            updateData.apiUrl = body.apiUrl;
        }

        if (body.model !== undefined) {
            updateData.model = body.model;
        }

        if (body.apiKey !== undefined) {
            if (body.apiKey === '') {
                // 如果传入空字符串，删除 API Key
                updateData.apiKeyEncrypted = null;
            } else {
                // 加密 API Key
                updateData.apiKeyEncrypted = await encryptApiKey(body.apiKey, c.env.ENCRYPTION_KEY);
            }
        }

        if (!existingSettings) {
            // 创建新设置
            await db.insert(db.schema.userSettings).values({
                userId: currentUser.userId,
                ...updateData,
                apiUrl: updateData.apiUrl || 'https://api.deepseek.com/chat/completions',
                model: updateData.model || 'deepseek-chat',
            });
        } else {
            // 更新现有设置
            await db
                .update(db.schema.userSettings)
                .set(updateData)
                .where(eq(db.schema.userSettings.userId, currentUser.userId));
        }

        // 获取更新后的设置
        const updatedSettings = await db.query.userSettings.findFirst({
            where: eq(db.schema.userSettings.userId, currentUser.userId),
        });

        // 解密 API Key 用于返回
        let apiKey = null;
        if (updatedSettings?.apiKeyEncrypted) {
            try {
                apiKey = await decryptApiKey(updatedSettings.apiKeyEncrypted, c.env.ENCRYPTION_KEY);
            } catch (error) {
                console.error('Failed to decrypt API key:', error);
            }
        }

        console.log(`User ${currentUser.userId} updated settings`);

        return c.json({
            data: {
                apiUrl: updatedSettings?.apiUrl,
                model: updatedSettings?.model,
                apiKey,
            },
        });
    } catch (error) {
        console.error('Update settings failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode);
        }
        return c.json({ error: 'Failed to update settings' }, 500);
    }
});

export default settings;
