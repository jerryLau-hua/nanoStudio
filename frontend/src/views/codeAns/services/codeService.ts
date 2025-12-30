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

const getModel = () => {
    const settings = useSettingsStore();
    return settings.settings.model || 'deepseek-chat';
};

interface StreamOptions {
    signal?: AbortSignal;
    timeout?: number;
}

interface CodeFile {
    id: string;
    name: string;
    path: string;
    content: string;
    language: string;
}

/**
 * 提取 Mermaid 代码块（去除 markdown 标记和其他文本）
 */
const extractMermaidCode = (text: string): string => {
    // 移除可能的 markdown 代码块标记
    let cleaned = text.replace(/```mermaid\s*/gi, '').replace(/```\s*/g, '');

    // 如果包含 graph/flowchart/sequenceDiagram 等关键字，提取从这些关键字开始的内容
    const mermaidKeywords = ['graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram', 'gantt', 'pie'];

    for (const keyword of mermaidKeywords) {
        const regex = new RegExp(`(${keyword}[\\s\\S]*)`, 'i');
        const match = cleaned.match(regex);
        if (match && match[1]) {
            cleaned = match[1];
            break;
        }
    }

    // 移除前后的空白字符
    cleaned = cleaned.trim();

    return cleaned;
};

/**
 * 构建提示词 - 将文件内容转换为 LLM 可理解的上下文
 */
const buildCodeContext = (files: CodeFile[]): string => {
    if (!files || files.length === 0) return '';

    let context = `我有以下 ${files.length} 个代码文件：\n\n`;

    files.forEach((file, index) => {
        context += `--- 文件 ${index + 1}: ${file.name} (${file.language}) ---\n`;
        context += `路径: ${file.path}\n`;
        context += `\`\`\`${file.language}\n${file.content}\n\`\`\`\n\n`;
    });

    return context;
};

/**
 * 1. 生成流程图 (Mermaid 格式)
 */
export const generateFlowDiagram = async (
    files: CodeFile[],
    onChunk: (text: string) => void,
    onComplete?: (finalCode: string) => void,
    options: StreamOptions = {}
): Promise<void> => {
    const apiKey = getApiKey();
    if (!apiKey || apiKey.startsWith('sk-xxx')) {
        await new Promise(r => setTimeout(r, 800));
        const mockDiagram = `graph TD
    Start((开始)) --> Init[初始化上下文]
    Init -->|扫描 ${files.length} 个文件| Scan{文件扫描}
    Scan --> Analysis[依赖分析]
    Analysis --> Risk[风险评估]
    Risk --> Report[生成报告]
    style Start fill:#1e1e1e,stroke:#666
    style Report fill:#0e639c,stroke:#0e639c,color:#fff`;
        onChunk(mockDiagram);
        if (onComplete) onComplete(mockDiagram);
        return;
    }

    const context = buildCodeContext(files);
    const messages = [
        {
            role: 'system',
            content: '你是一个专业的代码分析专家。请根据用户提供的代码，生成清晰的业务流程图（Mermaid 格式）。只返回 Mermaid 代码，不要添加任何解释或markdown标记。直接以 graph TD 或 flowchart TD 开头。'
        },
        {
            role: 'user',
            content: `${context}\n\n请分析以上代码的核心业务流程，生成 Mermaid 流程图（graph TD 格式）。只返回 Mermaid 代码，不要任何额外文字。`
        }
    ];

    let fullResponse = '';
    await streamChatCompletion(messages, (chunk) => {
        fullResponse += chunk;
    }, options);

    const cleanedCode = extractMermaidCode(fullResponse);
    onChunk(cleanedCode);
    if (onComplete) onComplete(cleanedCode);
};

/**
 * 2. 生成时序图 (Mermaid 格式)
 */
export const generateSequenceDiagram = async (
    files: CodeFile[],
    onChunk: (text: string) => void,
    onComplete?: (finalCode: string) => void,
    options: StreamOptions = {}
): Promise<void> => {
    const apiKey = getApiKey();
    if (!apiKey || apiKey.startsWith('sk-xxx')) {
        await new Promise(r => setTimeout(r, 800));
        const mockSeq = `sequenceDiagram
    participant U as 用户
    participant A as API网关
    participant S as 核心服务
    participant D as 数据库

    Note over U,D: 基于 ${files.length} 个文件的分析结果
    U->>A: 发起请求
    A->>S: 路由转发
    S->>S: 业务逻辑处理
    S->>D: 数据持久化
    D-->>S: 返回结果
    S-->>A: 响应
    A-->>U: 完成`;
        onChunk(mockSeq);
        if (onComplete) onComplete(mockSeq);
        return;
    }

    const context = buildCodeContext(files);
    const messages = [
        {
            role: 'system',
            content: '你是一个专业的代码分析专家。请根据用户提供的代码，生成方法调用时序图（Mermaid sequenceDiagram 格式）。只返回 Mermaid 代码，不要添加任何解释或markdown标记。直接以 sequenceDiagram 开头。'
        },
        {
            role: 'user',
            content: `${context}\n\n请分析以上代码的方法调用链，生成 Mermaid 时序图（sequenceDiagram 格式）。只返回 Mermaid 代码，不要任何额外文字。`
        }
    ];

    let fullResponse = '';
    await streamChatCompletion(messages, (chunk) => {
        fullResponse += chunk;
    }, options);

    const cleanedCode = extractMermaidCode(fullResponse);
    onChunk(cleanedCode);
    if (onComplete) onComplete(cleanedCode);
};

/**
 * 3. AI 代码审计 - 使用纯文本格式避免 JSON 解析问题
 */
export const performCodeReview = async (
    files: CodeFile[],
    onProgressUpdate: (progress: number, message: string) => void,
    options: StreamOptions = {}
): Promise<{ score: number; summary: string; risks: string[] }> => {
    const apiKey = getApiKey();
    if (!apiKey || apiKey.startsWith('sk-xxx')) {
        onProgressUpdate(30, '分析代码结构...');
        await new Promise((r: any) => setTimeout(r, 500));
        onProgressUpdate(60, '检测潜在风险...');
        await new Promise((r: any) => setTimeout(r, 500));
        onProgressUpdate(90, '生成审计报告...');
        await new Promise((r: any) => setTimeout(r, 300));

        const fileNames = files.map(f => f.name).slice(0, 3).join(', ');
        return {
            score: 88,
            summary: `已完成对项目 ${files.length} 个文件 (${fileNames}) 的深度审计。整体架构遵循 MVC 模式，但在部分 Service 层存在循环依赖风险。`,
            risks: [
                `在 ${files[0]?.name || '某文件'} 中发现硬编码 SQL 语句`,
                "部分 HTTP 请求未设置超时时间",
                "建议增加全局异常处理机制"
            ]
        };
    }

    onProgressUpdate(20, '正在发送代码到AI分析...');

    const context = buildCodeContext(files);
    const messages = [
        {
            role: 'system',
            content: '你是一个资深的代码审计专家。请分析代码质量，按以下格式返回纯文本（不要JSON，不要markdown）：\n第一行：分数（0-100的整数）\n第二行：总结（一段话）\n第三行开始：风险列表，每行一个，以"- "开头'
        },
        {
            role: 'user',
            content: `${context}\n\n请对以上代码进行全面审计，评估代码质量并列出主要风险点。`
        }
    ];

    let fullResponse = '';
    await streamChatCompletion(messages, (chunk) => {
        fullResponse += chunk;
        const progress = Math.min(90, 20 + fullResponse.length / 10);
        onProgressUpdate(progress, 'AI分析中...');
    }, options);

    onProgressUpdate(100, '分析完成');

    // 解析纯文本响应
    try {
        const lines = fullResponse.split('\n').map(line => line.trim()).filter(line => line);

        // 第一行是分数
        const scoreMatch = lines[0]?.match(/\d+/);
        const score = scoreMatch ? parseInt(scoreMatch[0]) : 75;

        // 第二行是总结
        const summary = lines[1] || '代码分析完成';

        // 剩余行是风险列表
        const risks = lines.slice(2)
            .filter(line => line.startsWith('-') || line.startsWith('•') || line.match(/^\d+[.)]/))
            .map(line => line.replace(/^[-•\d.)]\s*/, '').substring(0, 200))
            .filter(risk => risk.length > 0);

        return {
            score: Math.min(100, Math.max(0, score)),
            summary: summary.substring(0, 500),
            risks: risks.length > 0 ? risks : ['未识别到具体风险']
        };

    } catch (e) {
        console.error('解析AI响应失败:', e);
        console.log('原始响应:', fullResponse);

        // 降级返回
        return {
            score: 75,
            summary: fullResponse.substring(0, 300) || '代码分析完成',
            risks: ['响应格式异常，请查看完整响应']
        };
    }
};

/**
 * 4. 生成单元测试
 */
export const generateUnitTests = async (
    files: CodeFile[],
    onChunk: (text: string) => void,
    options: StreamOptions = {}
): Promise<void> => {
    const apiKey = getApiKey();
    if (!apiKey || apiKey.startsWith('sk-xxx')) {
        await new Promise((r: any) => setTimeout(r, 800));
        const mockTest = `/**
 * 基于项目全量代码生成的集成测试
 * 覆盖文件数: ${files.length}
 */
@SpringBootTest
class ProjectIntegrationTest {

    @Autowired
    private OrderService orderService;

    @Test
    void testFullFlow() {
        // 模拟全链路调用
        var result = orderService.process(new Context());
        assertTrue(result.isSuccess());
    }
}`;
        onChunk(mockTest);
        return;
    }

    const context = buildCodeContext(files);
    const messages = [
        {
            role: 'system',
            content: '你是一个单元测试专家。请根据用户提供的代码生成完整的单元测试代码（JUnit 5 或其他主流框架）。只返回测试代码，不要其他解释。'
        },
        {
            role: 'user',
            content: `${context}\n\n请为以上代码生成完整的单元测试，包含主要业务场景和边界情况。只返回测试代码。`
        }
    ];

    await streamChatCompletion(messages, onChunk, options);
};

/**
 * 通用流式调用 LLM (兼容 OpenAI 格式)
 */
const streamChatCompletion = async (
    messages: any[],
    onChunk: (text: string) => void,
    options: StreamOptions = {}
): Promise<void> => {
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
            signal
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
            return;
        }
        console.error(e);
        onChunk(`\n[网络请求出错: ${e.message || '未知错误'}]`);
        throw e;
    }
};
