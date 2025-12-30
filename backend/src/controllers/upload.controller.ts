import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import * as minioService from '../services/minio.service';

/**
 * 生成预签名上传URL
 * POST /api/upload/presigned-url
 */
export const generatePresignedUrl = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        const { filename } = req.body;

        if (!filename) {
            throw new AppError('文件名不能为空', 400);
        }

        const result = await minioService.generatePresignedUploadUrl(
            req.user.userId.toString(),
            filename
        );

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 删除MinIO文件
 * DELETE /api/upload/:objectKey
 */
export const deleteFile = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.user) {
            throw new AppError('未认证', 401);
        }

        const { objectKey } = req.params;

        await minioService.deleteFile(decodeURIComponent(objectKey));

        res.status(200).json({
            success: true,
            message: '文件已删除'
        });
    } catch (error) {
        next(error);
    }
};
