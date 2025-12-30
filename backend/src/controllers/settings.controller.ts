import { Request, Response, NextFunction } from 'express';
import * as settingsService from '../services/settings.service';
import { AppError } from '../middleware/errorHandler';

/**
 * 获取用户设置
 * GET /api/settings
 */
export const getSettings = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        const settings = await settingsService.getUserSettings(req.user.userId);

        res.status(200).json({
            success: true,
            data: settings
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 更新用户设置
 * PATCH/POST /api/settings
 */
export const updateSettings = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        const { apiUrl, model, apiKey } = req.body;

        // 如果提供了 apiKey，先加密存储
        if (apiKey && typeof apiKey === 'string') {
            await settingsService.setApiKey(req.user.userId, apiKey);
        }

        // 更新其他配置
        const updated = await settingsService.updateSettings(req.user.userId, {
            apiUrl,
            model
        });

        res.status(200).json({
            success: true,
            message: '设置已更新',
            data: updated
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 设置 API Key
 * POST /api/settings/api-key
 */
export const setApiKey = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        const { apiKey } = req.body;

        if (!apiKey || typeof apiKey !== 'string') {
            throw new AppError('API Key 不能为空', 400);
        }

        const result = await settingsService.setApiKey(req.user.userId, apiKey);

        res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 删除 API Key
 * DELETE /api/settings/api-key
 */
export const deleteApiKey = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        const result = await settingsService.deleteApiKey(req.user.userId);

        res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        next(error);
    }
};
