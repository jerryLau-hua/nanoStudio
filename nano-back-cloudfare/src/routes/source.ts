/**
 * Source 资源管理路由
 * 完整实现所有 API 端点
 */

import { Hono } from 'hono';
import { createDb, type Env } from '../db';
import { authenticateJWT, getCurrentUser, AppError } from '../middleware/auth';
import * as sourceService from '../services/source.service';
import * as jinaService from '../services/jina.service';

const source = new Hono<{ Bindings: Env }>();

// 所有资源路由都需要认证
source.use('*', authenticateJWT);

/* UNUSED ENDPOINT - Removed 2025-12-30
 * 原因：前端未调用，功能已通过 sessionApi.createFromUrl 实现
 *
/**
 * 抓取网页内容（预览，不保存）
 * POST /api/sources/fetch-web
 */
/*
source.post('/fetch-web', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const body = await c.req.json<{ url: string }>();

        if (!body.url || typeof body.url !== 'string') {
            throw new AppError('URL 不能为空', 400);
        }

        // 验证 URL 格式
        if (!jinaService.isValidUrl(body.url)) {
            throw new AppError('无效的 URL 格式', 400);
        }

        console.log(`User ${currentUser.userId} fetching web content from: ${body.url}`);

        // 使用 Jina Reader 抓取网页内容
        const jinaApiKey = c.env.JINA_API_KEY;
        const rawContent = await jinaService.fetchWebContent(body.url, jinaApiKey);
        const title = jinaService.extractTitle(rawContent);
        const cleanedContent = jinaService.cleanWebContent(rawContent);

        return c.json({
            success: true,
            data: {
                url: body.url,
                title,
                content: cleanedContent,
                wordCount: cleanedContent.length,
            },
        });
    } catch (error) {
        console.error('Fetch web content failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode as any);
        }
        return c.json({ error: 'Failed to fetch web content' }, 500);
    }
});
*/

/* UNUSED ENDPOINT - Removed 2025-12-30
 * 原因：返回501未实现，前端未调用
 *
/**
 * 上传并预览 PDF（占位符 - Workers 不支持文件上传到本地文件系统）
 * POST /api/sources/upload-pdf
 */
/*
source.post('/upload-pdf', async (c) => {
    return c.json(
        {
            error: 'PDF 上传功能待实现',
            note: '需要配置 Cloudflare R2 存储',
            workaround: '请先使用文本或 URL 方式添加知识源',
        },
        501
    );
});
*/

/* UNUSED ENDPOINT - Removed 2025-12-30
 * 原因：前端通过 session endpoints (from-url/from-text/from-pdf) 创建 source
 *
/**
 * 添加知识源到会话
 * POST /api/sources
 */
/*
source.post('/', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const body = await c.req.json<{
            sessionId: number;
            name: string;
            type: 'text' | 'website' | 'pdf';
            content: string;
            url?: string;
        }>();

        // 验证必填字段
        if (!body.sessionId || !body.name || !body.type || !body.content) {
            throw new AppError('缺少必填字段', 400);
        }

        // 验证 type
        if (!['text', 'website', 'pdf'].includes(body.type)) {
            throw new AppError('无效的知识源类型', 400);
        }

        const db = createDb(c.env);
        const newSource = await sourceService.addSource(
            currentUser.userId,
            {
                sessionId: body.sessionId,
                name: body.name,
                type: body.type,
                content: body.content,
                url: body.url,
            },
            db,
            c.env
        );

        return c.json(
            {
                success: true,
                message: '知识源已添加',
                data: newSource,
            },
            201
        );
    } catch (error) {
        console.error('Add source failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode as any);
        }
        return c.json({ error: 'Failed to add source' }, 500);
    }
});
*/

/* UNUSED ENDPOINT - Removed 2025-12-30
 * 原因：前端通过 sessionApi.getById() 获取包含 sources 的完整会话信息
 *
/**
 * 获取会话的知识源列表
 * GET /api/sources/session/:sessionId
 */
/*
source.get('/session/:sessionId', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const sessionId = parseInt(c.req.param('sessionId'), 10);

        if (isNaN(sessionId)) {
            throw new AppError('无效的会话ID', 400);
        }

        const db = createDb(c.env);
        const sources = await sourceService.getSessionSources(sessionId, currentUser.userId, db);

        return c.json({
            success: true,
            data: sources,
        });
    } catch (error) {
        console.error('Get session sources failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode as any);
        }
        return c.json({ error: 'Failed to get sources' }, 500);
    }
});
*/

/**
 * 删除知识源
 * DELETE /api/sources/:id
 */
source.delete('/:id', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const sourceId = parseInt(c.req.param('id'), 10);

        if (isNaN(sourceId)) {
            throw new AppError('无效的知识源ID', 400);
        }

        const db = createDb(c.env);
        const result = await sourceService.deleteSource(sourceId, currentUser.userId, db, c.env);

        return c.json(result);
    } catch (error) {
        console.error('Delete source failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode as any);
        }
        return c.json({ error: 'Failed to delete source' }, 500);
    }
});

/**
 * 获取 Source 的 RAG 处理状态
 * GET /api/sources/:id/rag-status
 */
source.get('/:id/rag-status', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const sourceId = parseInt(c.req.param('id'), 10);

        if (isNaN(sourceId)) {
            throw new AppError('无效的知识源ID', 400);
        }

        const db = createDb(c.env);
        const status = await sourceService.getRagStatus(sourceId, currentUser.userId, db);

        return c.json({
            success: true,
            data: status,
        });
    } catch (error) {
        console.error('Get RAG status failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode as any);
        }
        return c.json({ error: 'Failed to get RAG status' }, 500);
    }
});

export default source;
