/**
 * 错误消息工具 - 将技术错误转换为友好的用户提示
 */

export interface FriendlyError {
    message: string;
    type: 'network' | 'auth' | 'validation' | 'server' | 'unknown';
}

/**
 * 错误代码映射表
 */
const ERROR_MESSAGES: Record<number, string> = {
    // 客户端错误 4xx
    400: '请求参数有误，请检查后重试',
    401: '登录已过期，请重新登录',
    403: '没有权限访问此资源',
    404: '请求的资源不存在',
    409: '数据冲突，该资源已存在',
    422: '提交的数据格式不正确',
    429: '请求过于频繁，请稍后再试',

    // 服务器错误 5xx
    500: '服务器出错了，请稍后再试',
    502: '网关错误，服务暂时不可用',
    503: '服务暂时不可用，请稍后再试',
    504: '请求超时，请检查网络连接',
};

/**
 * 特定错误消息映射
 */
const CUSTOM_MESSAGES: Record<string, string> = {
    'Failed to fetch': '无法连接到服务器，请检查网络连接',
    'Network request failed': '网络请求失败，请检查网络连接',
    'Timeout': '请求超时，请检查网络连接',
    'CORS': '跨域请求被阻止，请联系管理员',
    'Invalid email or password': '邮箱或密码错误',
    'User not found': '用户不存在',
    'Email already exists': '该邮箱已被注册',
    'Username already exists': '该用户名已被使用',
    'Token expired': '登录已过期，请重新登录',
    'Invalid token': '登录凭证无效，请重新登录',
};

/**
 * 将错误转换为友好提示
 */
export function getFriendlyErrorMessage(error: any): FriendlyError {
    // 1. 网络错误（Failed to fetch, TypeError等）
    if (error instanceof TypeError || error.message?.includes('fetch')) {
        return {
            message: '无法连接到服务器，请检查网络连接或稍后再试',
            type: 'network',
        };
    }

    // 2. HTTP 状态码错误
    if (error.status || error.message?.includes('HTTP')) {
        const statusMatch = error.message?.match(/HTTP (\d+)/);
        const status = error.status || (statusMatch ? parseInt(statusMatch[1]) : null);

        if (status) {
            // 认证错误
            if (status === 401 || status === 403) {
                return {
                    message: ERROR_MESSAGES[status] || '身份验证失败',
                    type: 'auth',
                };
            }

            // 其他mapped错误
            if (ERROR_MESSAGES[status]) {
                return {
                    message: ERROR_MESSAGES[status],
                    type: status >= 500 ? 'server' : 'validation',
                };
            }
        }
    }

    // 3. 自定义错误消息匹配
    const errorMsg = error.message || String(error);
    for (const [key, value] of Object.entries(CUSTOM_MESSAGES)) {
        if (errorMsg.includes(key)) {
            return {
                message: value,
                type: key.includes('email') || key.includes('password') ? 'validation' : 'unknown',
            };
        }
    }

    // 4. 已经是中文错误消息（后端返回）
    if (errorMsg && /[\u4e00-\u9fa5]/.test(errorMsg)) {
        return {
            message: errorMsg,
            type: 'validation',
        };
    }

    // 5. 默认错误消息
    return {
        message: '操作失败，请稍后重试',
        type: 'unknown',
    };
}

/**
 * 简化版：直接返回友好的错误消息字符串
 */
export function getErrorMessage(error: any): string {
    return getFriendlyErrorMessage(error).message;
}
