import { useSettingsStore } from '@/store/settingsStore';

// --- API 配置 ---
// 使用 settings store 或环境变量作为默认值
const getApiKey = () => {
    const settings = useSettingsStore();
    return settings.settings.apiKey || import.meta.env.VITE_API_KEY || '';
};

const getApiUrl = () => {
    const settings = useSettingsStore();
    return settings.settings.apiUrl || import.meta.env.VITE_API_URL || 'https://api.deepseek.com/chat/completions';
};

const getWebReaderApi = () => {
    // Web Reader API 固定使用 Jina，不允许配置
    return import.meta.env.VITE_WEB_READER_API || 'https://r.jina.ai/';
};

const getModel = () => {
    const settings = useSettingsStore();
    return settings.settings.model || 'deepseek-chat';
};

interface StreamOptions {
    signal?: AbortSignal;
    timeout?: number;
}

/**
 * 1. 抓取网页内容 (调用 Jina Reader)
 * 优化：增加超时控制
 */
export const fetchWebContent = async (url: string, timeout = 15000): Promise<string> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(`${getWebReaderApi()}${url}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
        });
        clearTimeout(id);

        if (!response.ok) {
            throw new Error(`Web Reader Error: ${response.status}`);
        }

        const rawText = await response.text();
        let content = rawText;

        // 尝试解析 JSON，提取真正的 Markdown 内容
        try {
            const json = JSON.parse(rawText);
            // Jina 的结构通常是 data.content
            if (json?.data?.content) {
                content = json.data.content;
            } else if (json?.content) {
                // 兼容可能的其他结构
                content = json.content;
            }
            // 如果解析成功但没有 content 字段，可能请求出错或结构变动，保留 rawText 或抛错
        } catch (e) {
            // 如果解析 JSON 失败，说明返回的可能直接是文本，不做处理
        }

        if (!content || content.length < 50) throw new Error('抓取内容为空或过短');
        return content;
    } catch (error: any) {
        clearTimeout(id);
        console.error("抓取失败:", error);
        if (error.name === 'AbortError') {
            throw new Error('抓取超时，请检查网络或 URL 是否可访问');
        }
        throw error;
    }
};

/**
 * 2. 流式调用 LLM (兼容 OpenAI 格式)
 * 优化：支持 AbortSignal 取消请求，支持超时
 */
export const streamChatCompletion = async (
    messages: any[],
    onChunk: (text: string) => void,
    options: StreamOptions = {}
): Promise<void> => {
    // 模拟演示模式检测
    const apiKey = getApiKey();
    if (!apiKey || apiKey.startsWith('sk-xxx')) {
        await new Promise(r => setTimeout(r, 500));
        onChunk("⚠️ 请配置有效的 API Key 以使用真实生成功能。这里是模拟回复...");
        return;
    }

    const { signal } = options;

    try {
        const response = await fetch(getApiUrl(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getApiKey()}`
            },
            body: JSON.stringify({
                model: getModel(),
                messages: messages,
                stream: true
            }),
            signal // 传递取消信号
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new Error(`API Error: ${response.status} ${errText}`);
        }

        if (!response.body) throw new Error("ReadableStream not supported");

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let done = false;

        while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const json = JSON.parse(line.slice(6));
                            const content = json.choices[0]?.delta?.content || "";
                            if (content) onChunk(content);
                        } catch (e) { /* 忽略解析错误 */ }
                    }
                }
            }
        }
    } catch (e: any) {
        if (e.name === 'AbortError') {
            onChunk('\n[已停止生成]');
            return; // 正常取消，不抛错
        }
        console.error(e);
        onChunk(`\n[网络请求出错: ${e.message || '未知错误'}]`);
        throw e;
    }
};