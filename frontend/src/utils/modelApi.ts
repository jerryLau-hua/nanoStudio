/**
 * 模型 API 工具函数
 * 用于从 OpenAI 兼容的 API 端点获取可用模型列表
 */

export interface ModelOption {
    label: string;
    value: string;
    ownedBy?: string; // 模型提供商，用于显示图标
}

export interface ModelData {
    id: string;
    object: string;
    created?: number;
    owned_by?: string;
}

export interface ModelsResponse {
    object: string;
    data: ModelData[];
}

/**
 * 从 API URL 构建模型列表端点
 * @param apiUrl - 用户输入的 API URL
 * @returns 模型列表端点 URL
 */
function buildModelsEndpoint(apiUrl: string): string {
    try {
        const url = new URL(apiUrl);

        // 如果 URL 已经包含具体的端点路径（如 /chat/completions），
        // 则替换为 /models 或 /v1/models
        let pathname = url.pathname;

        // 移除尾部斜杠
        pathname = pathname.replace(/\/$/, '');

        // 常见的 API 路径模式处理
        if (pathname.includes('/chat/completions')) {
            pathname = pathname.replace('/chat/completions', '/models');
        } else if (pathname.includes('/completions')) {
            pathname = pathname.replace('/completions', '/models');
        } else if (pathname.endsWith('/v1')) {
            pathname = pathname + '/models';
        } else if (!pathname.includes('/models')) {
            // 如果路径中不包含 models，尝试添加
            if (pathname === '' || pathname === '/') {
                pathname = '/v1/models';
            } else {
                pathname = pathname + '/models';
            }
        }

        url.pathname = pathname;
        return url.toString();
    } catch (error) {
        throw new Error('无效的 API URL 格式');
    }
}

/**
 * 从 API 获取模型列表
 * @param apiUrl - API 基础 URL
 * @param apiKey - API Key
 * @returns 模型选项列表
 */
export async function fetchModels(
    apiUrl: string,
    apiKey: string
): Promise<ModelOption[]> {
    if (!apiUrl || !apiKey) {
        throw new Error('API URL 和 API Key 不能为空');
    }

    try {
        const modelsEndpoint = buildModelsEndpoint(apiUrl);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

        const response = await fetch(modelsEndpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('API Key 无效或已过期');
            } else if (response.status === 404) {
                throw new Error('API 端点不支持模型列表查询');
            } else {
                throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
            }
        }

        const data: ModelsResponse = await response.json();

        if (!data.data || !Array.isArray(data.data)) {
            throw new Error('API 返回的数据格式不正确');
        }

        // 将模型数据转换为下拉选项格式
        const modelOptions: ModelOption[] = data.data
            .filter(model => model.id) // 过滤掉没有 id 的模型
            .map(model => ({
                label: model.id,
                value: model.id,
                ownedBy: model.owned_by // 保留提供商信息
            }))
            .sort((a, b) => a.label.localeCompare(b.label)); // 按名称排序

        if (modelOptions.length === 0) {
            throw new Error('未找到可用的模型');
        }

        return modelOptions;

    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                throw new Error('请求超时，请检查网络连接或 API URL');
            }
            throw error;
        }
        throw new Error('获取模型列表失败');
    }
}

/**
 * 默认模型列表（作为后备选项）
 */
export const DEFAULT_MODELS: ModelOption[] = [
    { label: 'DeepSeek Chat', value: 'deepseek-chat', ownedBy: 'deepseek' },
    { label: 'DeepSeek Coder', value: 'deepseek-coder', ownedBy: 'deepseek' },
    { label: 'GPT-4', value: 'gpt-4', ownedBy: 'openai' },
    { label: 'GPT-4 Turbo', value: 'gpt-4-turbo-preview', ownedBy: 'openai' },
    { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo', ownedBy: 'openai' },
    { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229', ownedBy: 'anthropic' },
    { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet-20240229', ownedBy: 'anthropic' }
];
