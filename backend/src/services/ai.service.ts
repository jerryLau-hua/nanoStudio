import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { decryptApiKey } from '../utils/encryption';
import logger from '../utils/logger';

/**
 * AI 服务 - DeepSeek API 代理
 */

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface StreamOptions {
    signal?: AbortSignal;
    onChunk?: (chunk: string) => void;
    onError?: (error: Error) => void;
    onDone?: () => void;
}

/**
 * 获取用户的 API Key（解密）
 */
export const getUserApiKey = async (userId: number): Promise<string> => {
    const settings = await prisma.userSetting.findUnique({
        where: { userId },
        select: { apiKeyEncrypted: true }
    });

    if (!settings?.apiKeyEncrypted) {
        throw new AppError('请先设置  API Key', 400);
    }

    try {
        return decryptApiKey(settings.apiKeyEncrypted);
    } catch (error) {
        logger.error('Failed to decrypt API key:', error);
        throw new AppError('API Key 解密失败，请重新设置', 500);
    }
};

/**
 * 获取用户的 AI 配置
 */
export const getUserAIConfig = async (userId: number) => {
    const settings = await prisma.userSetting.findUnique({
        where: { userId },
        select: {
            apiUrl: true,
            model: true
        }
    });

    if (!settings) {
        throw new AppError('用户设置不存在', 404);
    }

    return {
        apiUrl: settings.apiUrl || 'https://api.deepseek.com/chat/completions',
        model: settings.model || 'deepseek-chat'
    };
};

/**
 * 流式调用 DeepSeek Chat Completion API
 */
export const streamChatCompletion = async (
    userId: number,
    messages: ChatMessage[],
    options: StreamOptions = {}
): Promise<void> => {
    const { signal, onChunk, onError, onDone } = options;

    try {
        // 获取用户的 API Key 和配置
        const apiKey = await getUserApiKey(userId);
        const config = await getUserAIConfig(userId);

        logger.info(`Starting stream chat for user ${userId}, model: ${config.model}`);

        // console.log("config", config);
        console.log("messages", messages);

        // 调用  API
        const response = await fetch(config.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                messages,
                stream: true,
                temperature: 0.7,
                max_tokens: 8000  // 增加到8000，支持更长的思维导图JSON
            }),
            signal
        });

        console.log("response", response);

        if (!response.ok) {
            const errorText = await response.text();
            logger.error(` API error: ${response.status} ${errorText}`);

            if (response.status === 401) {
                throw new AppError('API Key 无效，请检查设置', 401);
            }
            if (response.status === 429) {
                throw new AppError('请求过于频繁，请稍后再试', 429);
            }
            throw new AppError(`AI 服务错误: ${response.statusText}`, response.status);
        }

        // 流式读取响应
        if (!response.body) {
            throw new AppError('响应体为空', 500);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                onDone?.();
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();

                if (!trimmed || trimmed === 'data: [DONE]') {
                    continue;
                }

                if (trimmed.startsWith('data: ')) {
                    try {
                        const jsonStr = trimmed.substring(6);
                        const data = JSON.parse(jsonStr);

                        const content = data.choices?.[0]?.delta?.content;
                        if (content) {
                            onChunk?.(content);
                        }
                    } catch (error) {
                        logger.warn('Failed to parse SSE data:', trimmed);
                    }
                }
            }
        }

        logger.info(`Stream chat completed for user ${userId}`);
    } catch (error) {
        logger.error('Stream chat error:', error);

        if (error instanceof AppError) {
            onError?.(error);
            throw error;
        }

        if ((error as Error).name === 'AbortError') {
            logger.info(`Stream chat aborted for user ${userId}`);
            onError?.(new Error('请求已取消'));
            return;
        }

        const appError = new AppError('AI 服务调用失败', 500);
        onError?.(appError);
        throw appError;
    }
};

/**
 * 非流式调用（用于测试）
 */
export const chatCompletion = async (
    userId: number,
    messages: ChatMessage[]
): Promise<string> => {
    const apiKey = await getUserApiKey(userId);
    const config = await getUserAIConfig(userId);

    const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: config.model,
            messages,
            stream: false
        })
    });

    if (!response.ok) {
        throw new AppError(`AI 服务错误: ${response.statusText}`, response.status);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || '';
};
