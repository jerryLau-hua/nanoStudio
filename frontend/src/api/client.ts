/**
 * API Client - 统一的 HTTP 请求封装
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';

/**
 * 获取认证 Headers
 */
const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
};

/**
 * 统一错误处理
 */
const handleResponse = async (response: Response) => {
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        const errorMessage = error.message || error.error || `HTTP ${response.status}`;

        // 创建错误对象，附加status信息
        const err: any = new Error(errorMessage);
        err.status = response.status;
        throw err;
    }
    return response;
};

/**
 * API Client 实例
 */
export const apiClient = {
    /**
     * GET 请求
     */
    get: async (url: string) => {
        const response = await fetch(`${API_BASE}${url}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    /**
     * POST 请求
     */
    post: async (url: string, data?: any) => {
        const response = await fetch(`${API_BASE}${url}`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: data ? JSON.stringify(data) : undefined
        });
        return handleResponse(response);
    },

    /**
     * PUT 请求
     */
    put: async (url: string, data?: any) => {
        const response = await fetch(`${API_BASE}${url}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: data ? JSON.stringify(data) : undefined
        });
        return handleResponse(response);
    },

    /**
     * PATCH 请求
     */
    patch: async (url: string, data?: any) => {
        const response = await fetch(`${API_BASE}${url}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: data ? JSON.stringify(data) : undefined
        });
        return handleResponse(response);
    },

    /**
     * DELETE 请求
     */
    delete: async (url: string) => {
        const response = await fetch(`${API_BASE}${url}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(response);
    },

    /**
     * 上传文件（FormData）
     */
    upload: async (url: string, formData: FormData) => {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}${url}`, {
            method: 'POST',
            headers: {
                ...(token && { 'Authorization': `Bearer ${token}` })
                // 不设置 Content-Type，让浏览器自动设置 multipart/form-data
            },
            body: formData
        });
        return handleResponse(response);
    }
};

export default apiClient;
