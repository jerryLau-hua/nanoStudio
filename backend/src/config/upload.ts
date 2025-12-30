import multer from 'multer';
import path from 'path';
import { AppError } from '../middleware/errorHandler';
import { Request } from 'express';

// 配置存储 - 使用内存存储，文件将上传到 MinIO
const storage = multer.memoryStorage();

// 文件过滤器
const fileFilter = (
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
) => {
    // 只允许 PDF 文件
    if (file.mimetype === 'application/pdf' ||
        path.extname(file.originalname).toLowerCase() === '.pdf') {
        cb(null, true);
    } else {
        cb(new AppError('只允许上传 PDF 文件', 400) as any);
    }
};

// 导出 multer 实例
export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});
