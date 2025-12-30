import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import * as jinaService from './jina.service';
import logger from '../utils/logger';

/**
 * 知识源管理服务
 */

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
export const addSource = async (userId: number, data: AddSourceData) => {
    const { sessionId, name, type, content, url } = data;

    // 检查会话是否存在且属于当前用户
    const session = await prisma.notebookSession.findFirst({
        where: {
            id: sessionId,
            userId
        }
    });

    if (!session) {
        throw new AppError('会话不存在或无权访问', 404);
    }

    // 创建知识源
    const source = await prisma.source.create({
        data: {
            userId,
            sessionId,
            name,
            type,
            status: 'ready',
            content,
            metadata: {
                ...(url && { url }),
                wordCount: content.length,
                addedAt: new Date().toISOString()
            }
        },
        select: {
            id: true,
            name: true,
            type: true,
            status: true,
            metadata: true,
            createdAt: true
        }
    });

    logger.info(`User ${userId} added source ${source.id} to session ${sessionId}, type: ${type}`);

    return source;
};

/**
 * 获取会话的所有知识源
 */
export const getSessionSources = async (sessionId: number, userId: number) => {
    // 验证会话权限
    const session = await prisma.notebookSession.findFirst({
        where: {
            id: sessionId,
            userId
        }
    });

    if (!session) {
        throw new AppError('会话不存在或无权访问', 404);
    }

    const sources = await prisma.source.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        select: {
            id: true,
            name: true,
            type: true,
            status: true,
            metadata: true,
            createdAt: true
        }
    });

    return sources;
};

/**
 * 删除知识源（级联删除向量数据和物理文件）
 */
export const deleteSource = async (sourceId: number, userId: number) => {
    // 1. 检查权限
    const source = await prisma.source.findFirst({
        where: {
            id: sourceId,
            userId
        },
        include: {
            session: true
        }
    });

    if (!source) {
        throw new AppError('知识源不存在或无权限', 404);
    }

    try {
        // 2. 删除向量数据（Qdrant）
        try {
            const { deleteSourceVectors } = await import('./vector.service');
            await deleteSourceVectors(sourceId);
            logger.info(`Deleted vector data for source ${sourceId}`);
        } catch (vectorError: any) {
            logger.error(`Failed to delete vector data for source ${sourceId}:`, vectorError);
            // 继续执行，不因向量删除失败而中止
        }

        // 3. 删除物理文件（如果是 PDF）
        if (source.type === 'pdf' && source.metadata) {
            const metadata = source.metadata as any;
            if (metadata.filepath) {
                try {
                    const fs = await import('fs/promises');
                    await fs.unlink(metadata.filepath);
                    logger.info(`Deleted physical file: ${metadata.filepath}`);
                } catch (fileError: any) {
                    logger.error(`Failed to delete file ${metadata.filepath}:`, fileError);
                    // 继续执行
                }
            }
        }

        // 4. 删除数据库记录
        await prisma.source.delete({
            where: { id: sourceId }
        });

        logger.info(`Source ${sourceId} deleted successfully`);

        return {
            success: true,
            message: '知识源已删除'
        };
    } catch (error) {
        logger.error('Delete source error:', error);
        throw error;
    }
};

/**
 * 获取 Source 的 RAG 处理状态
 */
export const getRagStatus = async (sourceId: number, userId: number) => {
    const source = await prisma.source.findFirst({
        where: {
            id: sourceId,
            userId
        }
    });

    if (!source) {
        throw new AppError('知识源不存在或无权限', 404);
    }

    const metadata = (source.metadata as any) || {};

    return {
        status: metadata.rag_status || 'unknown',
        chunks_count: metadata.rag_chunks_count || 0,
        source_id: sourceId,
        source_name: source.name,
        source_type: source.type
    };
};
