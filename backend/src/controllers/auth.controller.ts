import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

/**
 * 用户注册
 * POST /api/auth/register
 */
export const register = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { email, username, password } = req.body;

        const result = await authService.register({
            email,
            username,
            password
        });

        res.status(201).json({
            success: true,
            message: '注册成功',
            data: {
                user: result.user,
                accessToken: result.accessToken,
                refreshToken: result.refreshToken
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 用户登录
 * POST /api/auth/login
 */
export const login = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { email, password } = req.body;

        const result = await authService.login({
            email,
            password
        });

        res.status(200).json({
            success: true,
            message: '登录成功',
            data: {
                user: result.user,
                accessToken: result.accessToken,
                refreshToken: result.refreshToken
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 用户登出
 * POST /api/auth/logout
 */
export const logout = async (
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // 在实际应用中，可以实现 Token 黑名单机制
        // 这里简单返回成功，客户端需要删除本地存储的 Token

        res.status(200).json({
            success: true,
            message: '登出成功'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 刷新 Access Token
 * POST /api/auth/refresh
 */
export const refresh = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            throw new AppError('缺少 Refresh Token', 400);
        }

        const newAccessToken = authService.refreshAccessToken(refreshToken);

        res.status(200).json({
            success: true,
            message: 'Token 刷新成功',
            data: {
                accessToken: newAccessToken
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
export const getCurrentUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        const user = await authService.getCurrentUser(req.user.userId);

        res.status(200).json({
            success: true,
            data: { user }
        });
    } catch (error) {
        next(error);
    }
};
