/**
 * Source（知识源）API
 */
import { apiClient } from './client';
import type { NotebookSession } from './session';
import { extractPdfText } from '../utils/pdf';

export interface Source {
    id: number;
    userId: number;
    sessionId: number;
    name: string;
    type: 'pdf' | 'website' | 'text';
    status: 'parsing' | 'ready' | 'error';
    content?: string;
    metadata?: {
        url?: string;
        filename?: string;
        filepath?: string;
        objectKey?: string;
        pages?: number;
        fileSize?: number;
        wordCount?: number;
        rag_status?: 'processing' | 'done' | 'error';
        rag_chunks_count?: number;
    };
    createdAt: string;
}

export const sourceApi = {
    /**
     * 获取预签名上传 URL
     */
    getPresignedUploadUrl: async (filename: string): Promise<{
        uploadUrl: string;
        objectKey: string;
        downloadUrl: string;
    }> => {
        const response = await apiClient.post('/upload/presigned-url', { filename });
        const data = await response.json();
        return data.data || data;
    },

    /**
     * 上传文件到 MinIO（使用预签名 URL）
     */
    uploadToMinio: async (uploadUrl: string, file: File): Promise<void> => {
        const response = await fetch(uploadUrl, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': 'application/pdf',
            },
        });

        if (!response.ok) {
            throw new Error(`MinIO upload failed: ${response.statusText}`);
        }
    },

    /**
     * 创建 PDF 会话（传入 objectKey 和文本内容）
     */
    createPdfSession: async (params: {
        filename: string;
        objectKey: string;
        content: string;
        title?: string;
    }): Promise<NotebookSession> => {
        const response = await apiClient.post('/sessions/from-pdf', params);
        const data = await response.json();
        return data.data || data;
    },

    /**
     * 上传 PDF 并创建会话（完整流程）
     * 
     * 流程：
     * 1. 前端提取 PDF 文本（pdf.js）
     * 2. 获取预签名上传 URL
     * 3. 上传文件到 MinIO
     * 4. 调用后端创建会话
     */
    uploadPdf: async (
        file: File,
        onProgress?: (step: number, message: string) => void
    ): Promise<NotebookSession> => {
        try {
            // 步骤 1: 提取 PDF 文本
            onProgress?.(1, '正在提取PDF文本...');
            const content = await extractPdfText(file);

            // 步骤 2: 获取预签名 URL
            onProgress?.(2, '正在获取上传链接...');
            const { uploadUrl, objectKey } = await sourceApi.getPresignedUploadUrl(file.name);

            // 步骤 3: 上传到 MinIO
            onProgress?.(3, '正在上传文件...');
            await sourceApi.uploadToMinio(uploadUrl, file);

            // 步骤 4: 创建会话
            onProgress?.(4, '正在创建会话...');
            const session = await sourceApi.createPdfSession({
                filename: file.name,
                objectKey,
                content,
                title: file.name.replace(/\.pdf$/i, ''),
            });

            return session;
        } catch (error) {
            console.error('PDF upload failed:', error);
            throw error;
        }
    },

    /**
     * 预览 PDF（不创建会话，仅返回解析的文本）
     * 注意：现在在客户端完成
     */
    previewPdf: async (file: File): Promise<{ text: string; pages: number }> => {
        const text = await extractPdfText(file);
        const arrayBuffer = await file.arrayBuffer();
        const pdfjs = await import('pdfjs-dist');
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

        return {
            text,
            pages: pdf.numPages,
        };
    },

    /**
     * 删除 Source（级联删除向量数据和物理文件）
     */
    delete: async (id: number): Promise<void> => {
        await apiClient.delete(`/sources/${id}`);
    },

    /**
     * 获取 Source 的 RAG 处理状态
     */
    getRagStatus: async (id: number): Promise<{ status: string; chunks_count?: number }> => {
        const response = await apiClient.get(`/sources/${id}/rag-status`);
        return response.json();
    }
};

export default sourceApi;
