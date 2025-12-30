/**
 * Session 会话管理路由
 */

import { Hono } from 'hono';
import { createDb, type Env } from '../db';
import { authenticateJWT, getCurrentUser, AppError } from '../middleware/auth';
import * as sessionService from '../services/session.service';

const session = new Hono<{ Bindings: Env }>();

// 所有会话路由都需要认证
session.use('*', authenticateJWT);

/**
 * 获取用户所有会话
 * GET /api/sessions
 */
session.get('/', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const db = createDb(c.env);

        const sessions = await sessionService.getUserSessions(currentUser.userId, db);

        return c.json({
            success: true,
            data: sessions,
        });
    } catch (error) {
        console.error('Get sessions failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode);
        }
        return c.json({ error: 'Failed to get sessions' }, 500);
    }
});

/**
 * 创建新会话
 * POST /api/sessions
 */
session.post('/', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const body = await c.req.json<{ title?: string }>();
        const db = createDb(c.env);

        const newSession = await sessionService.createSession(currentUser.userId, body.title, db);

        return c.json(
            {
                success: true,
                message: '会话已创建',
                data: newSession,
            },
            201
        );
    } catch (error) {
        console.error('Create session failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode);
        }
        return c.json({ error: 'Failed to create session' }, 500);
    }
});

/**
 * 从 URL 创建会话（一步到位）
 * POST /api/sessions/from-url
 */
session.post('/from-url', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const body = await c.req.json<{ url: string }>();

        if (!body.url) {
            throw new AppError('URL 不能为空', 400);
        }

        const db = createDb(c.env);
        const newSession = await sessionService.createSessionFromUrl(currentUser.userId, body.url, db, c.env);

        return c.json(
            {
                success: true,
                data: newSession,
            },
            201
        );
    } catch (error) {
        console.error('Create session from URL failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode);
        }
        return c.json({ error: 'Failed to create session from URL' }, 500);
    }
});

/**
 * 从文本创建会话
 * POST /api/sessions/from-text
 */
session.post('/from-text', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const body = await c.req.json<{ title?: string; content: string }>();

        if (!body.content || body.content.trim().length === 0) {
            throw new AppError('文本内容不能为空', 400);
        }

        const db = createDb(c.env);
        const newSession = await sessionService.createSessionFromText(
            currentUser.userId,
            body.title || '',
            body.content,
            db,
            c.env
        );

        return c.json(
            {
                success: true,
                data: newSession,
            },
            201
        );
    } catch (error) {
        console.error('Create session from text failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode);
        }
        return c.json({ error: 'Failed to create session from text' }, 500);
    }
});



/* UNUSED ENDPOINT - Removed 2025-12-30
 * 原因：与 POST /sessions/from-pdf 功能重复，前端未调用
 * 前端使用预签名URL方式上传（/from-pdf），不使用服务器端上传
 *
/**
 * 从 PDF 创建会话（直接上传文件）
 * POST /api/sessions/from-pdf-upload
 * 
 * 接受 multipart/form-data 文件上传
 */
/*
session.post('/from-pdf-upload', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const formData = await c.req.formData();
        const file = formData.get('file');
        const title = formData.get('title');

        // 类型检查
        if (!file || typeof file === 'string') {
            return c.json({ error: '请上传PDF文件' }, 400);
        }

        const fileObj = file as File;

        // 验证文件类型
        if (!fileObj.name.toLowerCase().endsWith('.pdf')) {
            return c.json({ error: '仅支持PDF文件' }, 400);
        }

        // 验证文件大小（10MB）
        const maxSize = 10 * 1024 * 1024;
        if (fileObj.size > maxSize) {
            return c.json({ error: '文件大小超过10MB' }, 400);
        }

        // 导入 MinIO 服务
        const minioService = await import('../services/minio.service');

        // 上传到 MinIO
        const buffer = await fileObj.arrayBuffer();
        const objectKey = minioService.generateObjectKey(
            currentUser.userId.toString(),
            fileObj.name
        );

        await minioService.uploadFile(buffer, objectKey, c.env, 'application/pdf');

        const db = createDb(c.env);

        // 创建会话
        const sessionTitle = (typeof title === 'string' ? title : '') ||
            fileObj.name.replace(/\\.pdf$/i, '');
        const newSession = await sessionService.createSession(
            currentUser.userId,
            sessionTitle,
            db
        );

        // 创建 source 记录
        await db.insert(db.schema.sources).values({
            userId: currentUser.userId,
            sessionId: newSession.id,
            name: fileObj.name,
            type: 'pdf',
            status: 'ready',
            content: '', // PDF内容由前端提取或后续处理
            metadata: {
                objectKey,
                filename: fileObj.name,
                size: fileObj.size,
                uploadedAt: new Date().toISOString(),
            } as any,
        });

        // 生成公开访问URL（不使用预签名，避免DOMParser错误）
        const downloadUrl = minioService.getPublicUrl(objectKey, c.env);

        return c.json(
            {
                success: true,
                message: 'PDF会话已创建',
                data: {
                    ...newSession,
                    objectKey,
                    downloadUrl,
                },
            },
            201
        );
    } catch (error) {
        console.error('Create session from PDF upload failed:', error);
        return c.json(
            {
                error: 'PDF上传失败',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            500
        );
    }
});
*/

/**
 * 从 PDF 创建会话（使用预签名URL方式）
 * POST /api/sessions/from-pdf
 * 
 * 推荐流程：
 * 1. 前端调用 /api/upload/presigned-url 获取上传URL
 * 2. 前端直接上传PDF到MinIO
 * 3. 前端调用此接口，传入objectKey和文件信息创建会话
 */
session.post('/from-pdf', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const { filename, objectKey, content, title } = await c.req.json();

        // 验证必填字段
        if (!filename || !objectKey) {
            return c.json(
                {
                    error: '缺少必填字段',
                    required: ['filename', 'objectKey'],
                    received: { filename: !!filename, objectKey: !!objectKey }
                },
                400
            );
        }

        // 验证objectKey是否属于当前用户
        const userId = currentUser.userId.toString();
        if (!objectKey.startsWith(`uploads/${userId}_`)) {
            return c.json({ error: '无效的对象键' }, 403);
        }

        const db = createDb(c.env);

        // 调用 service 函数创建会话和处理 RAG
        const newSession = await sessionService.createSessionFromPdf(
            currentUser.userId,
            filename,
            objectKey,
            content || '',
            title,
            db,
            c.env
        );

        return c.json(
            {
                success: true,
                message: 'PDF会话已创建',
                data: newSession,
            },
            201
        );
    } catch (error) {
        console.error('Create session from PDF failed:', error);
        return c.json(
            {
                error: 'PDF会话创建失败',
                details: error instanceof Error ? error.message : String(error),
            },
            500
        );
    }
});

/**
 * 获取单个会话详情
 * GET /api/sessions/:id
 */
session.get('/:id', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const sessionId = parseInt(c.req.param('id'), 10);

        if (isNaN(sessionId)) {
            return c.json({ error: 'Invalid session ID' }, 400);
        }

        const db = createDb(c.env);
        const sessionData = await sessionService.getSessionById(sessionId, currentUser.userId, db);

        return c.json({
            success: true,
            data: sessionData,
        });
    } catch (error) {
        console.error('Get session failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode);
        }
        return c.json({ error: 'Failed to get session' }, 500);
    }
});

/**
 * 更新会话（重命名）
 * PATCH /api/sessions/:id
 */
session.patch('/:id', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const sessionId = parseInt(c.req.param('id'), 10);
        const body = await c.req.json<{ title?: string }>();

        if (isNaN(sessionId)) {
            return c.json({ error: 'Invalid session ID' }, 400);
        }

        const db = createDb(c.env);
        const updated = await sessionService.updateSession(
            sessionId,
            currentUser.userId,
            { title: body.title },
            db
        );

        return c.json({
            success: true,
            data: updated,
        });
    } catch (error) {
        console.error('Update session failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode);
        }
        return c.json({ error: 'Failed to update session' }, 500);
    }
});

/**
 * 删除会话
 * DELETE /api/sessions/:id
 */
session.delete('/:id', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const sessionId = parseInt(c.req.param('id'), 10);

        if (isNaN(sessionId)) {
            return c.json({ error: 'Invalid session ID' }, 400);
        }

        const db = createDb(c.env);
        await sessionService.deleteSession(sessionId, currentUser.userId, db);

        return c.json({
            success: true,
            message: '会话已删除',
        });
    } catch (error) {
        console.error('Delete session failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode);
        }
        return c.json({ error: 'Failed to delete session' }, 500);
    }
});

/**
 * 保存笔记
 * POST /api/sessions/:id/notes
 */
session.post('/:id/notes', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const sessionId = parseInt(c.req.param('id'), 10);
        const body = await c.req.json<{
            title: string;
            type: 'summary' | 'mindmap';
            content: any;
        }>();

        if (isNaN(sessionId)) {
            return c.json({ error: 'Invalid session ID' }, 400);
        }

        const db = createDb(c.env);
        const note = await sessionService.saveNote(
            sessionId,
            currentUser.userId,
            { title: body.title, type: body.type, content: body.content },
            db
        );

        return c.json(
            {
                success: true,
                data: note,
            },
            201
        );
    } catch (error) {
        console.error('Save note failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode);
        }
        return c.json({ error: 'Failed to save note' }, 500);
    }
});

/**
 * 删除笔记
 * DELETE /api/sessions/notes/:noteId
 */
session.delete('/notes/:noteId', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const noteId = parseInt(c.req.param('noteId'), 10);

        if (isNaN(noteId)) {
            return c.json({ error: 'Invalid note ID' }, 400);
        }

        const db = createDb(c.env);
        await sessionService.deleteNote(noteId, currentUser.userId, db);

        return c.json({
            success: true,
            message: '笔记已删除',
        });
    } catch (error) {
        console.error('Delete note failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode);
        }
        return c.json({ error: 'Failed to delete note' }, 500);
    }
});

export default session;
