import { Request, Response, NextFunction } from 'express';
import * as jinaService from '../services/jina.service';
import * as sourceService from '../services/source.service';
import * as pdfService from '../services/pdf.service';
import * as minioService from '../services/minio.service';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import path from 'path';

/**
 * 抓取网页内容（不保存）
 * POST /api/sources/fetch-web
 */
export const fetchWebContent = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        const { url } = req.body;

        if (!url || typeof url !== 'string') {
            throw new AppError('URL 不能为空', 400);
        }

        // 验证 URL 格式
        if (!jinaService.isValidUrl(url)) {
            throw new AppError('无效的 URL 格式', 400);
        }

        logger.info(`User ${req.user.userId} fetching web content from: ${url}`);

        // 使用 Jina Reader 抓取网页内容
        const content = await jinaService.fetchWebContent(url);
        const title = jinaService.extractTitle(content);

        res.status(200).json({
            success: true,
            data: {
                url,
                title,
                content,
                wordCount: content.length
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 上传并预览 PDF
 * POST /api/sources/upload-pdf
 */
export const uploadAndPreviewPDF = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        if (!req.file) {
            throw new AppError('请上传 PDF 文件', 400);
        }

        logger.info(`User ${req.user.userId} uploading PDF: ${req.file.originalname}`);

        // 从 Buffer 提取文本
        const content = await pdfService.extractTextFromPDF(req.file.buffer);
        const metadata = await pdfService.getPDFMetadata(req.file.buffer);
        const title = await pdfService.extractPDFTitle(
            req.file.buffer,
            path.basename(req.file.originalname, '.pdf')
        );

        // 上传到 MinIO（用于可能的后续访问）
        const objectKey = minioService.generateObjectKey(
            req.user.userId,
            req.file.originalname
        );
        await minioService.uploadFile(req.file.buffer, objectKey, req.file.mimetype);

        res.status(200).json({
            success: true,
            data: {
                filename: req.file.originalname,
                title,
                content,
                wordCount: content.length,
                objectKey, // MinIO 对象键
                metadata: {
                    pages: metadata.pages,
                    fileSize: req.file.size,
                    uploadedAt: new Date().toISOString()
                }
            }
        });
    } catch (error) {
        // 文件在内存中，无需清理本地文件
        next(error);
    }
};

/**
 * 添加知识源到会话
 * POST /api/sources
 */
export const addSource = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        const { sessionId, name, type, content, url } = req.body;

        // 验证必填字段
        if (!sessionId || !name || !type || !content) {
            throw new AppError('缺少必填字段', 400);
        }

        // 验证 type
        if (!['text', 'website', 'pdf'].includes(type)) {
            throw new AppError('无效的知识源类型', 400);
        }

        const source = await sourceService.addSource(req.user.userId, {
            sessionId: parseInt(sessionId),
            name,
            type,
            content,
            url
        });

        res.status(201).json({
            success: true,
            message: '知识源已添加',
            data: source
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 获取会话的知识源列表
 * GET /api/sources/session/:sessionId
 */
export const getSessionSources = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        const sessionId = parseInt(req.params.sessionId);

        if (isNaN(sessionId)) {
            throw new AppError('无效的会话ID', 400);
        }

        const sources = await sourceService.getSessionSources(sessionId, req.user.userId);

        res.status(200).json({
            success: true,
            data: sources
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 删除知识源
 * DELETE /api/sources/:id
 */
export const deleteSource = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        const sourceId = parseInt(req.params.id);

        if (isNaN(sourceId)) {
            throw new AppError('无效的知识源ID', 400);
        }

        const result = await sourceService.deleteSource(sourceId, req.user.userId);

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

/**
 * 获取 Source 的 RAG 处理状态
 * GET /api/sources/:id/rag-status
 */
export const getRagStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        const sourceId = parseInt(req.params.id);

        if (isNaN(sourceId)) {
            throw new AppError('无效的知识源ID', 400);
        }

        const status = await sourceService.getRagStatus(sourceId, req.user.userId);

        res.status(200).json({
            success: true,
            data: status
        });
    } catch (error) {
        next(error);
    }
};


