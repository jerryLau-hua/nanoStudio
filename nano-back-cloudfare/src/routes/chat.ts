/**
 * Chat 聊天路由 - 完整版（包含流式响应和 RAG）
 */

import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { eq, and } from 'drizzle-orm';
import { createDb, type Env } from '../db';
import { authenticateJWT, getCurrentUser, AppError } from '../middleware/auth';
import axios from 'axios';

const chat = new Hono<{ Bindings: Env }>();

// 所有聊天路由都需要认证
chat.use('*', authenticateJWT);

/**
 * 流式聊天对话（支持 RAG）
 * POST /api/chat/completions
 */
chat.post('/completions', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const body = await c.req.json<{
            messages: Array<{ role: string; content: string }>;
            sessionId?: number;
        }>();

        if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
            throw new AppError('消息列表不能为空', 400);
        }

        // 验证消息格式
        for (const msg of body.messages) {
            if (!msg.role || (msg.content === undefined || msg.content === null)) {
                throw new AppError('消息格式错误', 400);
            }
            if (!['system', 'user', 'assistant'].includes(msg.role)) {
                throw new AppError('无效的消息角色', 400);
            }
        }

        const db = createDb(c.env);

        // 获取用户设置（API Key）
        const settings = await db.query.userSettings.findFirst({
            where: eq(db.schema.userSettings.userId, currentUser.userId),
        });

        if (!settings?.apiKeyEncrypted) {
            throw new AppError('请先配置 API Key', 400);
        }

        // 解密 API Key
        const { decryptApiKey } = await import('../utils/encryption');
        const apiKey = await decryptApiKey(settings.apiKeyEncrypted, c.env.ENCRYPTION_KEY);

        let enhancedMessages = [...body.messages];

        // 如果提供了 sessionId，使用 RAG 检索相关片段
        if (body.sessionId) {
            try {
                const session = await db.query.notebookSessions.findFirst({
                    where: and(
                        eq(db.schema.notebookSessions.id, body.sessionId),
                        eq(db.schema.notebookSessions.userId, currentUser.userId)
                    ),
                    with: {
                        sources: {
                            where: eq(db.schema.sources.status, 'ready'),
                        },
                    },
                });

                if (session && session.sources && session.sources.length > 0) {
                    // 获取最后一条用户消息作为查询
                    const lastUserMessage = body.messages.filter((m) => m.role === 'user').pop();

                    if (lastUserMessage && lastUserMessage.content && c.env.JINA_API_KEY && c.env.QDRANT_URL) {
                        const userQuery = lastUserMessage.content;

                        // 1. 向量化问题
                        const embeddingService = await import('../services/embedding.service');
                        const queryEmbedding = await embeddingService.generateEmbedding(userQuery, c.env.JINA_API_KEY);

                        // 2. 从所有 sources 中检索相关片段
                        const vectorService = await import('../services/vector.service');
                        const allRelevantChunks: Array<{ content: string; score: number }> = [];

                        for (const source of session.sources) {
                            const results = await vectorService.searchSimilar(
                                queryEmbedding,
                                source.id,
                                c.env.QDRANT_URL,
                                2 // topK: 每个 source 检索 top 2
                            );
                            allRelevantChunks.push(...results);
                        }

                        // 3. 按相似度排序，取 top 3
                        const topChunks = allRelevantChunks.sort((a, b) => b.score - a.score).slice(0, 3);

                        const SIMILARITY_THRESHOLD = 0.3;
                        const relevantChunks = topChunks.filter((c) => c.score >= SIMILARITY_THRESHOLD);

                        if (relevantChunks.length > 0) {
                            // 4. 构建 system prompt
                            const context = relevantChunks
                                .map((c, i) => `[片段${i + 1}，相关度: ${(c.score * 100).toFixed(1)}%]\n${c.content}`)
                                .join('\n\n---\n\n');

                            const systemMessage = {
                                role: 'system' as const,
                                content: `你是一个 AI 助手。以下是从知识库中检索的相关内容片段：\n\n${context}\n\n请基于上述相关内容回答用户的问题。如果内容中没有相关信息，请诚实告知。`,
                            };

                            // 如果已有system消息，替换；否则插入
                            const hasSystemMsg = enhancedMessages.some((m) => m.role === 'system');
                            if (hasSystemMsg) {
                                enhancedMessages = [systemMessage, ...enhancedMessages.filter((m) => m.role !== 'system')];
                            } else {
                                enhancedMessages = [systemMessage, ...enhancedMessages];
                            }

                            console.log(`RAG: Injected ${relevantChunks.length} relevant chunks`);
                        }
                    }
                }
            } catch (ragError) {
                console.error('RAG retrieval failed:', ragError);
            }
        }

        // SSE 流式响应
        return stream(c, async (stream) => {
            // 发送连接成功消息
            await stream.write('data: ' + JSON.stringify({ type: 'connected' }) + '\n\n');

            try {
                const apiUrl = settings.apiUrl || c.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
                const model = settings.model || 'deepseek-chat';

                console.log('Calling DeepSeek API:', {
                    url: apiUrl,
                    model,
                    messagesCount: enhancedMessages.length,
                    hasApiKey: !!apiKey,
                });

                // 使用 fetch 而不是 axios（Workers 兼容）
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model,
                        messages: enhancedMessages,
                        stream: true,
                    }),
                });

                console.log('DeepSeek API response:', {
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok,
                    hasBody: !!response.body,
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('DeepSeek API error:', errorText);
                    throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
                }

                if (!response.body) {
                    throw new Error('No response body');
                }

                let fullResponse = '';

                // 读取流式响应
                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                console.log('Starting to read stream...');

                let buffer = ''; // 缓冲区用于累积跨 chunk 的数据

                while (true) {
                    const { done, value } = await reader.read();

                    if (done) {
                        console.log('Stream reading completed, done=true');
                        break;
                    }

                    // 解码并添加到缓冲区
                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;
                    console.log('Received chunk, length:', chunk.length, 'buffer size:', buffer.length);

                    // 按换行符分割，保留最后一个不完整的部分
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // 保留最后一个可能不完整的行

                    console.log('Processing', lines.length, 'complete lines, buffer has:', buffer.length, 'chars');

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (!trimmedLine) continue;

                        if (trimmedLine.startsWith('data: ')) {
                            const data = trimmedLine.substring(6);

                            if (data === '[DONE]') {
                                console.log('Received [DONE] signal');
                                break;
                            }

                            try {
                                const parsed = JSON.parse(data);
                                const content = parsed.choices?.[0]?.delta?.content;
                                if (content) {
                                    fullResponse += content;
                                    await stream.write('data: ' + JSON.stringify({ type: 'content', content }) + '\n\n');
                                    console.log('Sent content chunk, length:', content.length);
                                }
                            } catch (e) {
                                console.warn('Failed to parse SSE data:', data.substring(0, 100), 'Error:', e);
                            }
                        }
                    }
                }

                console.log('Total response length:', fullResponse.length);

                // 保存聊天记录（如果有sessionId）
                if (body.sessionId && fullResponse) {
                    try {
                        const lastUserMessage = body.messages.filter((m) => m.role === 'user').pop();
                        if (lastUserMessage) {
                            const now = Date.now();

                            // 保存用户消息
                            await db.insert(db.schema.chatMessages).values({
                                sessionId: body.sessionId,
                                role: 'user',
                                content: lastUserMessage.content,
                                timestamp: now,
                            });

                            // 保存AI回复
                            await db.insert(db.schema.chatMessages).values({
                                sessionId: body.sessionId,
                                role: 'assistant',
                                content: fullResponse,
                                timestamp: now + 1,
                            });

                            console.log(`Saved messages to session ${body.sessionId}`);
                        }
                    } catch (saveError) {
                        console.error('Failed to save messages:', saveError);
                    }
                }

                // 发送完成消息
                await stream.write('data: ' + JSON.stringify({ type: 'done' }) + '\n\n');
            } catch (error: any) {
                console.error('Stream error:', error);
                const errorMsg = error.message || '流式响应失败';
                await stream.write('data: ' + JSON.stringify({ type: 'error', message: errorMsg }) + '\n\n');
            }
        });
    } catch (error) {
        console.error('Chat completions failed:', error);
        console.error('Error details:', {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });

        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode as any);
        }

        // 返回更详细的错误信息
        const errorMessage = error instanceof Error ? error.message : 'Chat failed';
        return c.json({
            error: 'Chat failed',
            details: errorMessage
        }, 500);
    }
});

/**
 * 聊天对话（非流式）
 * POST /api/chat/test
 */
chat.post('/test', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const body = await c.req.json<{
            messages: Array<{ role: string; content: string }>;
        }>();

        if (!body.messages || !Array.isArray(body.messages)) {
            throw new AppError('消息列表不能为空', 400);
        }

        const db = createDb(c.env);

        // 获取用户设置（API Key）
        const settings = await db.query.userSettings.findFirst({
            where: eq(db.schema.userSettings.userId, currentUser.userId),
        });

        if (!settings?.apiKeyEncrypted) {
            throw new AppError('请先配置 API Key', 400);
        }

        // 解密 API Key
        const { decryptApiKey } = await import('../utils/encryption');
        const apiKey = await decryptApiKey(settings.apiKeyEncrypted, c.env.ENCRYPTION_KEY);

        // 调用 AI 服务
        const aiService = await import('../services/ai.service');
        const result = await aiService.chatCompletion(
            currentUser.userId,
            body.messages,
            apiKey,
            settings.apiUrl,
            settings.model
        );

        return c.json({
            success: true,
            data: {
                content: result,
            },
        });
    } catch (error) {
        console.error('Chat test failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode as any);
        }
        return c.json({ error: 'Chat failed' }, 500);
    }
});

/**
 * 停止生成
 * POST /api/chat/stop
 */
chat.post('/stop', async (c) => {
    // 客户端断开连接来停止生成
    return c.json({
        success: true,
        message: '已请求停止生成',
    });
});

export default chat;
