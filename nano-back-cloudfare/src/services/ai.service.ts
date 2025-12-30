/**
 * AI 聊天服务 - 简化版
 * 暂时不包含 RAG 检索，只实现基础对话功能
 */

import axios from 'axios';
import { AppError } from '../middleware/auth';

/**
 * 基础聊天对话（非流式）
 */
export async function chatCompletion(
    userId: number,
    messages: Array<{ role: string; content: string }>,
    apiKey: string,
    apiUrl: string,
    model: string
): Promise<string> {
    try {
        const response = await axios.post(
            apiUrl,
            {
                model,
                messages,
                stream: false,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                timeout: 30000, //30秒超时
            }
        );

        const content = response.data?.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('AI 响应格式错误');
        }

        console.log(`Chat completion for user ${userId}, response length: ${content.length}`);
        return content;
    } catch (error) {
        console.error('AI chat completion failed:', error);
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 401) {
                throw new AppError('API Key 无效', 401);
            }
            if (error.response?.status === 429) {
                throw new AppError('API 调用频率超限', 429);
            }
            throw new AppError(`AI 服务错误: ${error.message}`, 500);
        }
        throw error;
    }
}

// TODO: 流式响应功能
// export async function streamChatCompletion() {
//     // 需要使用 Workers Streams API 实现
// }
