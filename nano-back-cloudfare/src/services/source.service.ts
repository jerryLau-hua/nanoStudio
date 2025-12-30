/**
 * Source 资源管理服务
 * 完整迁移所有业务逻辑
 */

import { eq, and } from 'drizzle-orm';
import { AppError } from '../middleware/auth';

interface AddSourceData {
    sessionId: number;
    name: string;
    type: 'text' | 'website' | 'pdf';
    content: string;
    url?: string;
}

/**
 * 添加知识源到会话
 */
export async function addSource(userId: number, data: AddSourceData, db: any, env: any) {
    const { sessionId, name, type, content, url } = data;

    // 检查会话是否存在且属于当前用户
    const session = await db.query.notebookSessions.findFirst({
        where: and(
            eq(db.schema.notebookSessions.id, sessionId),
            eq(db.schema.notebookSessions.userId, userId)
        ),
    });

    if (!session) {
        throw new AppError('会话不存在或无权访问', 404);
    }

    // 创建知识源
    const [result] = await db.insert(db.schema.sources).values({
        userId,
        sessionId,
        name,
        type,
        status: 'parsing',
        content,
        metadata: {
            ...(url && { url }),
            wordCount: content.length,
            addedAt: new Date().toISOString(),
        },
    });

    const sourceId = result.insertId;

    console.log(`User ${userId} added source ${sourceId} to session ${sessionId}, type: ${type}`);

    // RAG 处理
    if (content && env.QDRANT_URL && env.JINA_API_KEY) {
        try {
            const ragService = await import('./rag.service');
            await ragService.processRAGForSource(sourceId, content, type, db, env);
        } catch (ragError) {
            console.error(`RAG processing failed for source ${sourceId}:`, ragError);
            await db
                .update(db.schema.sources)
                .set({ status: 'ready' })
                .where(eq(db.schema.sources.id, sourceId));
        }
    } else {
        await db
            .update(db.schema.sources)
            .set({ status: 'ready' })
            .where(eq(db.schema.sources.id, sourceId));
    }

    // 返回创建的source
    const source = await db.query.sources.findFirst({
        where: eq(db.schema.sources.id, sourceId),
        columns: {
            id: true,
            name: true,
            type: true,
            status: true,
            metadata: true,
            createdAt: true,
        },
    });

    return source;
}

/**
 * 获取会话的所有知识源
 */
export async function getSessionSources(sessionId: number, userId: number, db: any) {
    // 验证会话权限
    const session = await db.query.notebookSessions.findFirst({
        where: and(
            eq(db.schema.notebookSessions.id, sessionId),
            eq(db.schema.notebookSessions.userId, userId)
        ),
    });

    if (!session) {
        throw new AppError('会话不存在或无权访问', 404);
    }

    const sources = await db.query.sources.findMany({
        where: eq(db.schema.sources.sessionId, sessionId),
        orderBy: [db.schema.sources.createdAt],
        columns: {
            id: true,
            name: true,
            type: true,
            status: true,
            metadata: true,
            createdAt: true,
        },
    });

    return sources;
}

/**
 * 删除知识源（级联删除向量数据）
 */
export async function deleteSource(sourceId: number, userId: number, db: any, env: any) {
    // 1. 检查权限
    const source = await db.query.sources.findFirst({
        where: and(eq(db.schema.sources.id, sourceId), eq(db.schema.sources.userId, userId)),
        with: {
            session: true,
        },
    });

    if (!source) {
        throw new AppError('知识源不存在或无权限', 404);
    }

    try {
        // 2. 删除向量数据（Qdrant）
        if (env.QDRANT_URL) {
            try {
                const vectorService = await import('./vector.service');
                await vectorService.deleteSourceVectors(sourceId, env.QDRANT_URL);
                console.log(`Deleted vector data for source ${sourceId}`);
            } catch (vectorError: any) {
                console.error(`Failed to delete vectors for source ${sourceId}:`, vectorError);
                // 继续执行，不因向量删除失败而中止
            }
        }

        // 3. 删除数据库记录
        await db.delete(db.schema.sources).where(eq(db.schema.sources.id, sourceId));

        console.log(`Source ${sourceId} deleted successfully`);

        return {
            success: true,
            message: '知识源已删除',
        };
    } catch (error) {
        console.error('Delete source error:', error);
        throw error;
    }
}

/**
 * 获取 Source 的 RAG 处理状态
 */
export async function getRagStatus(sourceId: number, userId: number, db: any) {
    const source = await db.query.sources.findFirst({
        where: and(eq(db.schema.sources.id, sourceId), eq(db.schema.sources.userId, userId)),
    });

    if (!source) {
        throw new AppError('知识源不存在或无权限', 404);
    }

    const metadata = (source.metadata as any) || {};

    return {
        status: source.status || 'unknown',
        chunksCount: metadata.chunksCount || 0,
        ragProcessed: metadata.ragProcessed || false,
        sourceId: sourceId,
        sourceName: source.name,
        sourceType: source.type,
        processedAt: metadata.processedAt,
    };
}
