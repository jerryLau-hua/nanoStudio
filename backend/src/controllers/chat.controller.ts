import { Request, Response, NextFunction } from 'express';
import * as aiService from '../services/ai.service';
import * as embeddingService from '../services/embedding.service';
import * as vectorService from '../services/vector.service';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';


/**
 * 流式聊天完成
 * POST /api/chat/completions
 */
export const streamCompletions = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        const { messages, sessionId } = req.body;

        // console.log('Received messages:', JSON.stringify(messages, null, 2));

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            throw new AppError('消息列表不能为空', 400);
        }

        // 验证消息格式（放宽验证，允许空 content）
        for (const msg of messages) {
            // console.log('Validating message:', msg);
            if (!msg.role) {
                console.error('Invalid message - missing role:', msg);
                throw new AppError('消息缺少 role 字段', 400);
            }
            // content 可以为空字符串（某些情况下合法）
            if (msg.content === undefined || msg.content === null) {
                console.error('Invalid message - content is undefined/null:', msg);
                throw new AppError('消息 content 不能为 undefined 或 null', 400);
            }
            if (!['system', 'user', 'assistant'].includes(msg.role)) {
                throw new AppError('无效的消息角色', 400);
            }
        }

        // 如果提供了 sessionId，使用 RAG 检索相关片段
        let enhancedMessages = [...messages];

        if (sessionId) {
            const prisma = (await import('../config/database')).default;
            const session = await prisma.notebookSession.findFirst({
                where: {
                    id: parseInt(sessionId),
                    userId: req.user.userId
                },
                include: {
                    sources: {
                        where: { status: 'ready' },
                        select: {
                            id: true,
                            name: true,
                            type: true
                        }
                    }
                }
            });

            if (session && session.sources.length > 0) {
                try {
                    // 获取用户最后一条消息作为查询
                    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();

                    if (lastUserMessage && lastUserMessage.content) {
                        const userQuery = lastUserMessage.content;

                        // 1. 向量化问题
                        logger.info(`RAG: Generating embedding for query: "${userQuery.substring(0, 50)}..."`);
                        const queryEmbedding = await embeddingService.generateEmbedding(userQuery);

                        // 2. 从所有 sources 中检索相关片段
                        const allRelevantChunks: Array<{ content: string; score: number; position: number; sourceId: number }> = [];

                        for (const source of session.sources) {
                            const results = await vectorService.searchSimilar(
                                queryEmbedding,
                                source.id,
                                2 // 每个 source 检索 top 2
                            );

                            results.forEach(r => {
                                allRelevantChunks.push({
                                    ...r,
                                    sourceId: source.id
                                });
                            });
                        }

                        // 3. 按相似度排序，取 top 3
                        const topChunks = allRelevantChunks
                            .sort((a, b) => b.score - a.score)
                            .slice(0, 3);

                        // 设置相似度阈值（调整为更实用的值）
                        // Jina v4 嵌入的相似度通常较低，30% 是合理阈值
                        const SIMILARITY_THRESHOLD = 0.30;
                        const relevantChunks = topChunks.filter(c => c.score >= SIMILARITY_THRESHOLD);

                        if (relevantChunks.length > 0) {
                            // 4. 构建 system prompt（只包含高相关性片段）
                            const context = relevantChunks
                                .map((c, i) => `[片段${i + 1}，相关度: ${(c.score * 100).toFixed(1)}%]\n${c.content}`)
                                .join('\n\n---\n\n');

                            const systemMessage = {
                                role: 'system' as const,
                                content: `你是一个 AI 助手。以下是从知识库中检索的相关内容片段：

${context}

请基于上述相关内容回答用户的问题。如果内容中没有相关信息，请诚实告知。`
                            };

                            // 如果已有system消息，替换；否则插入
                            const hasSystemMsg = enhancedMessages.some((m: any) => m.role === 'system');
                            if (hasSystemMsg) {
                                enhancedMessages = [systemMessage, ...enhancedMessages.filter((m: any) => m.role !== 'system')];
                            } else {
                                enhancedMessages = [systemMessage, ...enhancedMessages];
                            }

                            const avgSimilarity = (relevantChunks.reduce((sum, c) => sum + c.score, 0) / relevantChunks.length * 100).toFixed(1);
                            logger.info(`RAG: Injected ${relevantChunks.length} relevant chunks (avg similarity: ${avgSimilarity}%)`);
                        } else {
                            // 相似度过低，不注入知识库上下文
                            const maxScore = topChunks.length > 0 ? (topChunks[0].score * 100).toFixed(1) : '0';
                            logger.warn(`RAG: No high-relevance chunks (max: ${maxScore}%, threshold: 30%). Skipping knowledge base context.`);
                        }
                    }
                } catch (ragError) {
                    // RAG 失败不影响主流程
                    logger.error('RAG retrieval failed:', ragError);
                    logger.info('Falling back to chat without context');
                }
            }
        }

        // SSE 流式响应
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲

        // 发送连接成功消息
        const connectedMsg = `data: ${JSON.stringify({ type: 'connected' })}\n\n`;
        res.write(connectedMsg);

        // 处理客户端断开连接
        const abortController = new AbortController();
        req.on('close', () => {
            logger.info('Client disconnected, aborting stream');
            abortController.abort();
        });

        try {
            // 用于累积完整的AI回复
            let fullResponse = '';

            // 获取用户的最后一条消息（用于保存）
            const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();

            // 调用后端 AI 服务流式生成
            await aiService.streamChatCompletion(
                req.user.userId,
                enhancedMessages,
                {
                    signal: abortController.signal,
                    onChunk: (chunk: string) => {
                        // 累积响应
                        fullResponse += chunk;
                        // 发送内容片段
                        const data = `data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`;
                        res.write(data);
                    },
                    onDone: async () => {
                        // 保存消息到数据库（如果有sessionId）
                        if (sessionId && lastUserMessage) {
                            try {
                                const prisma = (await import('../config/database')).default;

                                // 获取数据库中已有的消息数量
                                const existingCount = await prisma.chatMessage.count({
                                    where: { sessionId: parseInt(sessionId) }
                                });

                                // 计算前端发送的用户消息数量（不包含system）
                                const userMsgCount = messages.filter((m: any) => m.role === 'user').length;
                                const assistantMsgCount = messages.filter((m: any) => m.role === 'assistant').length;
                                const frontendMsgCount = userMsgCount + assistantMsgCount;

                                // 只有当前端发送的消息数量大于数据库中的消息数量时才保存
                                // 这意味着有新消息需要保存
                                if (frontendMsgCount > existingCount || existingCount === 0) {
                                    const now = Date.now();

                                    // 保存用户消息
                                    await prisma.chatMessage.create({
                                        data: {
                                            sessionId: parseInt(sessionId),
                                            role: 'user',
                                            content: lastUserMessage.content,
                                            timestamp: now
                                        }
                                    });

                                    // 保存AI回复
                                    await prisma.chatMessage.create({
                                        data: {
                                            sessionId: parseInt(sessionId),
                                            role: 'assistant',
                                            content: fullResponse,
                                            timestamp: now + 1
                                        }
                                    });

                                    logger.info(`Saved messages to session ${sessionId} (total: ${existingCount + 2})`);
                                } else {
                                    logger.info(`Skipped saving duplicate messages to session ${sessionId}`);
                                }
                            } catch (saveError) {
                                logger.error('Failed to save messages:', saveError);
                            }
                        }

                        // 发送完成消息
                        const doneMsg = `data: ${JSON.stringify({ type: 'done' })}\n\n`;
                        res.write(doneMsg);
                        res.end();
                    },
                    onError: (error: Error) => {
                        // 发送错误消息
                        const errorMsg = `data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`;
                        res.write(errorMsg);
                        res.end();
                    }
                }
            );
        } catch (error) {
            // 如果还没有开始流式响应，使用标准错误处理
            if (!res.headersSent) {
                next(error);
            } else {
                // 已经开始流式响应，发送错误事件
                const message = error instanceof AppError ? error.message : '服务器错误';
                res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
                res.end();
            }
        }
    } catch (error) {
        // 如果还没有开始流式响应，使用标准错误处理
        if (!res.headersSent) {
            next(error);
        } else {
            // 已经开始流式响应，发送错误事件
            const message = error instanceof AppError ? error.message : '服务器错误';
            res.write(`data: ${JSON.stringify({ type: 'error', message })}\\n\\n`);
            res.end();
        }
    }
};


/**
 * 停止生成
 * POST /api/chat/stop
 */
export const stopGeneration = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // 客户端主动断开连接来停止生成
        // 这里只是一个占位符，实际的中断由客户端关闭连接触发
        res.status(200).json({
            success: true,
            message: '已请求停止生成'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 非流式聊天（用于测试）
 * POST /api/chat/test
 */
export const testCompletion = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        const { messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            throw new AppError('消息列表不能为空', 400);
        }

        const result = await aiService.chatCompletion(req.user.userId, messages);

        res.status(200).json({
            success: true,
            data: { content: result }
        });
    } catch (error) {
        next(error);
    }
};
