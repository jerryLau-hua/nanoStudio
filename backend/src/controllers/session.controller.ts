import { Request, Response, NextFunction } from 'express';
import * as sessionService from '../services/session.service';
import { AppError } from '../middleware/errorHandler';

/**
 * 创建新会话
 * POST /api/sessions
 */
export const createSession = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        const { title } = req.body;

        const session = await sessionService.createSession(req.user.userId, title);

        res.status(201).json({
            success: true,
            message: '会话已创建',
            data: session
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 获取用户所有会话
 * GET /api/sessions
 */
export const getUserSessions = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        const sessions = await sessionService.getUserSessions(req.user.userId);

        res.status(200).json({
            success: true,
            data: sessions
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 获取单个会话详情
 * GET /api/sessions/:id
 */
export const getSessionById = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        const sessionId = parseInt(req.params.id);
        const session = await sessionService.getSessionById(sessionId, req.user.userId);

        res.status(200).json({
            success: true,
            data: session
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 更新会话（重命名）
 * PATCH /api/sessions/:id
 */
export const updateSession = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        const sessionId = parseInt(req.params.id);
        const { title } = req.body;

        const session = await sessionService.updateSession(
            sessionId,
            req.user.userId,
            { title }
        );

        res.status(200).json({
            success: true,
            data: session
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 删除会话
 * DELETE /api/sessions/:id
 */
export const deleteSession = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        const sessionId = parseInt(req.params.id);
        await sessionService.deleteSession(sessionId, req.user.userId);

        res.status(200).json({
            success: true,
            message: '会话已删除'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 从 URL 创建会话（一步到位：session + source + RAG）
 * POST /api/sessions/from-url
 */
export const createSessionFromUrl = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        const { url } = req.body;

        if (!url) {
            throw new AppError('URL 不能为空', 400);
        }

        const session = await sessionService.createSessionFromWebsite(
            req.user.userId,
            url
        );

        res.status(201).json({
            success: true,
            data: session
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 从文本创建会话
 * POST /api/sessions/from-text
 */
export const createSessionFromText = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        const { title, content } = req.body;

        if (!content || content.trim().length === 0) {
            throw new AppError('文本内容不能为空', 400);
        }

        const session = await sessionService.createSessionFromText(
            req.user.userId,
            title || '',
            content
        );

        res.status(201).json({
            success: true,
            data: session
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 从 PDF 创建会话
 * POST /api/sessions/from-pdf
 * 
 * 支持两种格式：
 * 1. multipart/form-data 文件上传（旧格式，兼容性）
 * 2. JSON { filename, objectKey, content, title }（新格式，与Cloudflare Workers一致）
 */
export const createSessionFromPDF = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        let session;

        // 检测是JSON还是文件上传
        if (req.file) {
            // 格式1：文件上传（兼容旧版）
            const { originalname, buffer } = req.file;

            session = await sessionService.createSessionFromPdfBuffer(
                req.user.userId,
                originalname,
                buffer
            );
        } else if (req.body.objectKey) {
            // 格式2：JSON with objectKey（新格式，与Cloudflare Workers一致）
            const { filename, objectKey, content, title } = req.body;

            if (!filename || !objectKey) {
                throw new AppError('filename 和 objectKey 不能为空', 400);
            }

            // 创建会话
            session = await sessionService.createSession(
                req.user.userId,
                title || filename.replace(/\.pdf$/i, '')
            );

            // 创建source记录（使用objectKey）
            await sessionService.createSourceFromObjectKey(
                session.id,
                req.user.userId,
                filename,
                objectKey,
                content || ''
            );
        } else {
            throw new AppError('请上传 PDF 文件或提供 objectKey', 400);
        }

        res.status(201).json({
            success: true,
            data: session
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 保存笔记
 * POST /api/sessions/:id/notes
 */
export const saveSessionNote = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const sessionId = parseInt(req.params.id);
        const { title, type, content } = req.body;

        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        const note = await sessionService.saveNote(
            sessionId,
            req.user.userId,
            { title, type, content }
        );

        res.status(201).json({
            success: true,
            data: note
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 删除笔记
 * DELETE /api/notes/:noteId
 */
export const deleteNote = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const noteId = parseInt(req.params.noteId);

        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        await sessionService.deleteNote(noteId, req.user.userId);

        res.status(200).json({
            success: true,
            message: '笔记已删除'
        });
    } catch (error) {
        next(error);
    }
};
