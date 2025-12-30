/**
 * 会话 API
 */
import { apiClient } from './client';
import type { Source } from './source';

export interface NotebookSession {
    id: number;
    userId?: number;
    title: string;
    preview?: string;
    chatHistory?: any[];
    notes?: any[];
    createdAt: string;
    updatedAt?: string;
    sources?: Source[];
    _count?: {
        sources?: number;
        messages?: number;
        notes?: number;
    };
}

export interface CreateSessionFromUrlRequest {
    url: string;
}

export const sessionApi = {
    /**
     * 获取所有会话
     */
    getAll: async (): Promise<NotebookSession[]> => {
        const response = await apiClient.get('/sessions');
        const data = await response.json();
        return data.data || data;  // 兼容 {data: [...]} 和直接返回 [...]
    },

    /**
     * 获取单个会话详情（包含 sources）
     */
    getById: async (id: number): Promise<NotebookSession> => {
        const response = await apiClient.get(`/sessions/${id}`);
        const data = await response.json();
        return data.data || data;  // 兼容 {data: {...}} 和直接返回 {...}
    },

    /**
     * 从 URL 创建会话（后端自动抓取网页 + RAG 处理）
     */
    createFromUrl: async (url: string): Promise<NotebookSession> => {
        const response = await apiClient.post('/sessions/from-url', { url });
        const data = await response.json();
        return data.data || data;
    },

    /**
     * 从文本创建会话（后端自动 RAG 处理）
     */
    createFromText: async (title: string, content: string): Promise<NotebookSession> => {
        const response = await apiClient.post('/sessions/from-text', { title, content });
        const data = await response.json();
        return data.data || data;
    },

    /**
     * 更新会话（标题、聊天记录、笔记等）
     */
    update: async (id: number, data: Partial<NotebookSession>): Promise<NotebookSession> => {
        const response = await apiClient.patch(`/sessions/${id}`, data);
        const result = await response.json();
        return result.data || result;
    },

    /**
     * 删除会话（级联删除 sources 和向量数据）
     */
    delete: async (id: number): Promise<void> => {
        await apiClient.delete(`/sessions/${id}`);
    },

    /**
     * 保存笔记
     */
    saveNote: async (sessionId: number, note: {
        title: string;
        type: 'summary' | 'mindmap';
        content: any;
    }) => {
        const response = await apiClient.post(`/sessions/${sessionId}/notes`, note);
        const data = await response.json();
        return data.data;
    },

    /**
     * 删除笔记
     */
    deleteNote: async (noteId: number): Promise<void> => {
        await apiClient.delete(`/sessions/notes/${noteId}`);
    }
};

export default sessionApi;
