/**
 * 聊天 API（SSE 流式）
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface StreamOptions {
    signal?: AbortSignal;
}

/**
 * SSE 流式聊天（后端自动 RAG 检索）
 */
export const streamChatCompletion = async (
    sessionId: number | null,
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    options: StreamOptions = {}
): Promise<void> => {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
            sessionId, // 如果有 sessionId，后端会自动 RAG 检索
            messages
        }),
        signal: options.signal
    });

    if (!response.ok) {
        throw new Error(`聊天请求失败: ${response.status}`);
    }

    if (!response.body) {
        throw new Error('响应体为空');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // 解码并添加到缓冲区
            buffer += decoder.decode(value, { stream: true });

            // 按行分割
            const lines = buffer.split('\n');
            // 保留最后一个不完整的行
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();

                    if (!data) continue;

                    try {
                        const json = JSON.parse(data);

                        if (json.type === 'content') {
                            onChunk(json.content);
                            // 控制chunk到达速度，让渲染有时间执行
                            await new Promise(resolve => setTimeout(resolve, 30));
                        } else if (json.type === 'error') {
                            throw new Error(json.message);
                        } else if (json.type === 'connected') {
                            console.log('✓ Connected to SSE stream');
                        } else if (json.type === 'done') {
                            console.log('✓ Stream completed');
                        }
                    } catch (parseError) {
                        // JSON 解析错误通常意味着格式问题，将错误抛出
                        console.error('JSON parse error:', parseError);
                        throw parseError;
                    }
                }
            }
        }
    } catch (error) {
        if ((error as Error).name === 'AbortError') {
            console.log('Stream aborted by user');
        } else {
            throw error;
        }
    }
};

export const chatApi = {
    stream: streamChatCompletion
};

export default chatApi;
