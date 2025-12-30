/**
 * Session 会话管理服务
 * 基础版本：先实现 CRUD，暂时跳过 RAG 处理
 */

import { eq, desc, and, sql } from 'drizzle-orm';
import { AppError } from '../middleware/auth';
import { processRAGForSource } from './rag.service';

/**
 * 创建新会话
 */
export async function createSession(userId: number, title: string | undefined, db: any) {
    const [result] = await db.insert(db.schema.notebookSessions).values({
        userId,
        title: title || '新会话',
        preview: '',
    });

    // 获取新创建的会话
    const session = await db.query.notebookSessions.findFirst({
        where: eq(db.schema.notebookSessions.id, result.insertId),
        columns: {
            id: true,
            title: true,
            preview: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return session;
}

/**
 * 获取用户的所有会话
 */
export async function getUserSessions(userId: number, db: any) {
    const sessions = await db.query.notebookSessions.findMany({
        where: eq(db.schema.notebookSessions.userId, userId),
        orderBy: [desc(db.schema.notebookSessions.updatedAt)],
        columns: {
            id: true,
            title: true,
            preview: true,
            createdAt: true,
            updatedAt: true,
        },
        with: {
            sources: {
                columns: {
                    id: true,
                },
            },
            messages: {
                columns: {
                    id: true,
                },
            },
        },
    });

    // 添加计数
    const sessionsWithCount = sessions.map((session) => ({
        ...session,
        _count: {
            sources: session.sources.length,
            messages: session.messages.length,
        },
        sources: undefined,
        messages: undefined,
    }));

    return sessionsWithCount;
}

/**
 * 获取会话详情（包含知识源和消息）
 */
export async function getSessionById(sessionId: number, userId: number, db: any) {
    const session = await db.query.notebookSessions.findFirst({
        where: and(
            eq(db.schema.notebookSessions.id, sessionId),
            eq(db.schema.notebookSessions.userId, userId)
        ),
        with: {
            sources: {
                orderBy: [db.schema.sources.createdAt],
                columns: {
                    id: true,
                    name: true,
                    type: true,
                    status: true,
                    content: true,
                    metadata: true,
                    createdAt: true,
                },
            },
            messages: {
                orderBy: [db.schema.chatMessages.timestamp],
                columns: {
                    id: true,
                    role: true,
                    content: true,
                    timestamp: true,
                    createdAt: true,
                },
            },
            notes: {
                orderBy: [desc(db.schema.notes.createdAt)],
                columns: {
                    id: true,
                    title: true,
                    type: true,
                    status: true,
                    content: true,
                    createdAt: true,
                },
            },
        },
    });

    if (!session) {
        throw new AppError('会话不存在或无权访问', 404);
    }

    return session;
}

/**
 * 更新会话（重命名）
 */
export async function updateSession(
    sessionId: number,
    userId: number,
    data: { title?: string; preview?: string },
    db: any
) {
    // 先检查权限
    const session = await db.query.notebookSessions.findFirst({
        where: and(
            eq(db.schema.notebookSessions.id, sessionId),
            eq(db.schema.notebookSessions.userId, userId)
        ),
    });

    if (!session) {
        throw new AppError('会话不存在或无权访问', 404);
    }

    // 更新
    await db
        .update(db.schema.notebookSessions)
        .set({
            title: data.title,
            preview: data.preview,
            updatedAt: new Date(),
        })
        .where(eq(db.schema.notebookSessions.id, sessionId));

    // 返回更新后的数据
    const updated = await db.query.notebookSessions.findFirst({
        where: eq(db.schema.notebookSessions.id, sessionId),
        columns: {
            id: true,
            title: true,
            preview: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return updated;
}

/**
 * 删除会话（级联删除知识源和消息）
 */
export async function deleteSession(sessionId: number, userId: number, db: any) {
    // 检查权限
    const session = await db.query.notebookSessions.findFirst({
        where: and(
            eq(db.schema.notebookSessions.id, sessionId),
            eq(db.schema.notebookSessions.userId, userId)
        ),
    });

    if (!session) {
        throw new AppError('会话不存在或无权访问', 404);
    }

    // 删除会话（数据库级联会自动删除关联数据）
    await db.delete(db.schema.notebookSessions).where(eq(db.schema.notebookSessions.id, sessionId));

    return { success: true, message: '会话已删除' };
}

/**
 * 从文本创建会话（一步完成：创建session + 添加source + RAG）
 */
export async function createSessionFromText(
    userId: number,
    title: string,
    content: string,
    db: any,
    env: any
) {
    if (!content || content.trim().length === 0) {
        throw new AppError('文本内容不能为空', 400);
    }

    const finalTitle = title?.trim() || `文本笔记 ${new Date().toLocaleDateString('zh-CN')}`;
    const preview = content.substring(0, 200);

    // 创建会话
    const [sessionResult] = await db.insert(db.schema.notebookSessions).values({
        userId,
        title: finalTitle,
        preview,
    });

    const sessionId = sessionResult.insertId;

    // 添加文本知识源
    const [sourceResult] = await db.insert(db.schema.sources).values({
        userId,
        sessionId,
        name: finalTitle,
        type: 'text',
        status: 'parsing',
        content: content,
        metadata: {
            wordCount: content.length,
            addedAt: new Date().toISOString(),
        },
    });

    const sourceId = sourceResult.insertId;

    console.log(`Created text source for session ${sessionId}, ${content.length} chars`);

    // RAG 处理
    if (env.QDRANT_URL && env.JINA_API_KEY) {
        try {
            await processRAGForSource(sourceId, content, 'text', db, env);
        } catch (ragError) {
            console.error(`RAG processing failed for source ${sourceId}:`, ragError);
            // RAG 失败，直接设为 ready（不影响基础功能）
            await db
                .update(db.schema.sources)
                .set({ status: 'ready' })
                .where(eq(db.schema.sources.id, sourceId));
        }
    } else {
        // 没有配置 RAG，直接标记为 ready
        console.log('RAG not configured, marking source as ready');
        await db
            .update(db.schema.sources)
            .set({ status: 'ready' })
            .where(eq(db.schema.sources.id, sourceId));
    }

    return getSessionById(sessionId, userId, db);
}

/**
 * 从网址创建会话（完整版 - 使用 Jina Reader）
 */
export async function createSessionFromUrl(userId: number, url: string, db: any, env: any) {
    try {
        // 获取用户设置（获取 Jina API Key）
        const settings = await db.query.userSettings.findFirst({
            where: eq(db.schema.userSettings.userId, userId),
        });

        const jinaApiKey = env.JINA_API_KEY || settings?.jinaApiKey;

        // 1. 抓取网页内容
        const jinaService = await import('./jina.service');
        console.log(`Fetching web content from: ${url}`);

        let webContent = '';
        let webTitle = '';

        try {
            const rawContent = await jinaService.fetchWebContent(url, jinaApiKey);
            webTitle = jinaService.extractTitle(rawContent) || new URL(url).hostname;
            webContent = jinaService.cleanWebContent(rawContent);
            console.log(`Fetched and cleaned content, length: ${webContent.length}`);
        } catch (fetchError) {
            console.error(`Failed to fetch web content: ${fetchError}`);
            webContent = '';
            webTitle = new URL(url).hostname;
        }

        // 2. 创建会话
        const [sessionResult] = await db.insert(db.schema.notebookSessions).values({
            userId,
            title: webTitle,
            preview: webContent.substring(0, 200),
        });

        const sessionId = sessionResult.insertId;

        // 3. 添加网页作为知识源
        const [sourceResult] = await db.insert(db.schema.sources).values({
            userId,
            sessionId,
            name: webTitle,
            type: 'website',
            status: webContent ? 'parsing' : 'error',
            content: webContent,
            metadata: {
                url,
                wordCount: webContent.length,
                fetchedAt: new Date().toISOString(),
            },
        });

        const sourceId = sourceResult.insertId;

        // 4. RAG 处理（如果有内容）
        if (webContent && env.QDRANT_URL && jinaApiKey) {
            try {
                await processRAGForSource(sourceId, webContent, 'website', db, env);
            } catch (ragError) {
                console.error(`RAG processing failed for source ${sourceId}:`, ragError);
                await db
                    .update(db.schema.sources)
                    .set({ status: 'ready', metadata: { ...sourceResult, ragError: 'RAG processing failed' } })
                    .where(eq(db.schema.sources.id, sourceId));
            }
        } else {
            // 没有配置 RAG，直接标记为 ready
            await db
                .update(db.schema.sources)
                .set({ status: 'ready' })
                .where(eq(db.schema.sources.id, sourceId));
        }

        return getSessionById(sessionId, userId, db);
    } catch (error) {
        console.error('Failed to create session from URL:', error);
        throw error;
    }
}

/**
 * 保存笔记
 */
export async function saveNote(
    sessionId: number,
    userId: number,
    noteData: {
        title: string;
        type: 'summary' | 'mindmap';
        content: any;
    },
    db: any
) {
    const session = await db.query.notebookSessions.findFirst({
        where: and(
            eq(db.schema.notebookSessions.id, sessionId),
            eq(db.schema.notebookSessions.userId, userId)
        ),
    });

    if (!session) {
        throw new AppError('会话不存在或无权访问', 404);
    }

    const [result] = await db.insert(db.schema.notes).values({
        sessionId,
        title: noteData.title,
        type: noteData.type,
        status: 'done',
        content: noteData.content,
        metadata: {},
    });

    const note = await db.query.notes.findFirst({
        where: eq(db.schema.notes.id, result.insertId),
    });

    return note;
}

/**
 * 删除笔记
 */
export async function deleteNote(noteId: number, userId: number, db: any) {
    const note = await db.query.notes.findFirst({
        where: eq(db.schema.notes.id, noteId),
        with: {
            session: true,
        },
    });

    if (!note || note.session.userId !== userId) {
        throw new AppError('笔记不存在或无权访问', 404);
    }

    await db.delete(db.schema.notes).where(eq(db.schema.notes.id, noteId));

    return { success: true, message: '笔记已删除' };
}

/**
 * 从 PDF 创建会话（使用 objectKey，前端已上传）
 * @param userId 用户ID
 * @param filename 文件名
 * @param objectKey MinIO对象键
 * @param content PDF文本内容（前端提取）
 * @param title 可选标题
 * @param db 数据库实例
 * @param env 环境变量
 */
export async function createSessionFromPdf(
    userId: number,
    filename: string,
    objectKey: string,
    content: string,
    title: string | undefined,
    db: any,
    env: any
) {
    try {
        // 1. 创建会话
        const sessionTitle = title || filename.replace(/\.pdf$/i, '');
        const preview = content ? content.substring(0, 200) : '';

        const [sessionResult] = await db.insert(db.schema.notebookSessions).values({
            userId,
            title: sessionTitle,
            preview,
        });

        const sessionId = sessionResult.insertId;
        console.log(`Created PDF session ${sessionId} for user ${userId}`);

        // 2. 创建 source 记录
        const [sourceResult] = await db.insert(db.schema.sources).values({
            userId,
            sessionId,
            name: filename,
            type: 'pdf',
            status: 'parsing',
            content: content || '',
            metadata: {
                objectKey,
                filename,
                wordCount: content ? content.length : 0,
                uploadedAt: new Date().toISOString(),
            } as any,
        });

        const sourceId = sourceResult.insertId;
        console.log(`Created PDF source ${sourceId} for session ${sessionId}`);

        // 3. RAG 处理（如果有内容）
        if (content && content.trim().length > 0) {
            if (env.QDRANT_URL && env.JINA_API_KEY) {
                try {
                    console.log(`Starting RAG processing for source ${sourceId}`);
                    await processRAGForSource(sourceId, content, 'pdf', db, env);
                    console.log(`RAG processing completed for source ${sourceId}`);
                } catch (ragError) {
                    console.error(`RAG processing failed for source ${sourceId}:`, ragError);
                    // RAG 失败，标记为 ready 但不影响基础功能
                    await db
                        .update(db.schema.sources)
                        .set({
                            status: 'ready',
                            metadata: {
                                objectKey,
                                filename,
                                wordCount: content.length,
                                uploadedAt: new Date().toISOString(),
                                ragError: 'RAG processing failed'
                            } as any
                        })
                        .where(eq(db.schema.sources.id, sourceId));
                }
            } else {
                // 没有配置 RAG，直接标记为 ready
                console.log('RAG not configured (missing QDRANT_URL or JINA_API_KEY), marking source as ready');
                await db
                    .update(db.schema.sources)
                    .set({ status: 'ready' })
                    .where(eq(db.schema.sources.id, sourceId));
            }
        } else {
            // 没有内容，直接标记为 ready
            console.warn(`No content provided for source ${sourceId}, marking as ready without RAG`);
            await db
                .update(db.schema.sources)
                .set({ status: 'ready' })
                .where(eq(db.schema.sources.id, sourceId));
        }

        // 4. 返回完整会话信息
        return getSessionById(sessionId, userId, db);
    } catch (error) {
        console.error('Failed to create session from PDF:', error);
        throw error;
    }
}
