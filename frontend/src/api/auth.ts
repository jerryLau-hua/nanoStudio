/**
 * 认证 API
 */
import { apiClient } from './client';

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    username: string;
    password: string;
}

export interface AuthResponse {
    token: string;
    user: {
        id: number;
        username: string;
        email: string;
    };
}

export const authApi = {
    /**
     * 用户登录
     */
    login: async (credentials: LoginRequest): Promise<AuthResponse> => {
        const response = await apiClient.post('/auth/login', credentials);
        const data = await response.json();

        // 保存 token（使用 accessToken）
        if (data.data?.accessToken) {
            localStorage.setItem('token', data.data.accessToken);
            localStorage.setItem('user', JSON.stringify(data.data.user));
        }

        return {
            token: data.data.accessToken,
            user: data.data.user
        };
    },

    /**
     * 用户注册
     */
    register: async (userData: RegisterRequest): Promise<AuthResponse> => {
        const response = await apiClient.post('/auth/register', userData);
        const data = await response.json();

        // 保存 token（使用 accessToken）
        if (data.data?.accessToken) {
            localStorage.setItem('token', data.data.accessToken);
            localStorage.setItem('user', JSON.stringify(data.data.user));
        }

        return {
            token: data.data.accessToken,
            user: data.data.user
        };
    },

    /**
     * 退出登录
     */
    logout: async () => {
        try {
            // 调用后端 logout API（让后端可以做token黑名单处理）
            await apiClient.post('/auth/logout', {});
        } catch (error) {
            console.error('Logout API failed:', error);
            // 即使后端失败也清除本地缓存
        } finally {
            // 清除本地缓存
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('llm_settings'); // 同时清除设置
        }
    },

    /**
     * 获取当前用户信息
     */
    getCurrentUser: () => {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    },

    /**
     * 更新当前用户信息（用于保存后刷新缓存）
     */
    updateCurrentUser: (userData: Partial<{ id: number; username: string; email: string }>) => {
        const currentUser = authApi.getCurrentUser();
        if (currentUser) {
            const updatedUser = { ...currentUser, ...userData };
            localStorage.setItem('user', JSON.stringify(updatedUser));
        }
    },

    /**
     * 检查是否已登录
     */
    isAuthenticated: (): boolean => {
        return !!localStorage.getItem('token');
    }
};

export default authApi;
