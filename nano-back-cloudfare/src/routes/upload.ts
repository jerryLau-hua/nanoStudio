import { Hono } from 'hono';
import { type Env } from '../db';
import { authenticateJWT, getCurrentUser } from '../middleware/auth';
import * as minioService from '../services/minio.service';

const upload = new Hono<{ Bindings: Env }>();

// 所有上传路由都需要认证
upload.use('*', authenticateJWT);

/**
 * 生成预签名上传URL
 * POST /api/upload/presigned-url
 * 
 * 前端流程：
 * 1. 调用此接口获取预签名URL
 * 2. 使用返回的uploadUrl直接上传到MinIO
 * 3. 使用objectKey创建source记录
 */
upload.post('/presigned-url', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const { filename } = await c.req.json();

        if (!filename || typeof filename !== 'string') {
            return c.json({ error: '缺少有效的文件名' }, 400);
        }

        // 验证文件类型（PDF）
        if (!filename.toLowerCase().endsWith('.pdf')) {
            return c.json({ error: '仅支持PDF文件' }, 400);
        }

        // 生成presigned上传URL（10分钟有效期）
        const { uploadUrl, objectKey } = await minioService.generatePresignedUploadUrl(
            filename,
            currentUser.userId.toString(),
            c.env,
            600 // 10分钟
        );

        // 生成下载URL（24小时有效期）
        const downloadUrl = await minioService.generatePresignedDownloadUrl(
            objectKey,
            c.env,
            24 * 60 * 60
        );

        return c.json({
            success: true,
            data: {
                uploadUrl,    // 用于上传
                objectKey,    // 用于后续引用
                downloadUrl,  // 用于下载
                expiresIn: 600
            }
        });
    } catch (error) {
        console.error('Generate presigned URL error:', error);
        return c.json({
            error: '生成上传URL失败',
            details: error instanceof Error ? error.message : String(error)
        }, 500);
    }
});

/* UNUSED ENDPOINT - Removed 2025-12-30
 * 原因：前端使用预签名URL直传MinIO，不经过服务器
 *
/**
 * 服务器端上传（备用方案）
 * POST /api/upload
 * 
 * 适用于小文件或需要服务器验证的场景
 */
/*
upload.post('/', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const formData = await c.req.formData();
        const file = formData.get('file');

        // 类型检查和验证
        if (!file || typeof file === 'string') {
            return c.json({ error: '请上传文件' }, 400);
        }

        // 此时file是File类型
        const fileObj = file as File;

        // 验证文件大小（最大10MB）
        const maxSize = 10 * 1024 * 1024;
        if (fileObj.size > maxSize) {
            return c.json({ error: '文件大小超过10MB限制' }, 400);
        }

        // 验证文件类型
        if (!fileObj.name.toLowerCase().endsWith('.pdf')) {
            return c.json({ error: '仅支持PDF文件' }, 400);
        }

        // 读取文件Buffer
        const buffer = await fileObj.arrayBuffer();

        // 生成对象键
        const objectKey = minioService.generateObjectKey(
            currentUser.userId.toString(),
            fileObj.name
        );

        // 上传到MinIO
        await minioService.uploadFile(
            buffer,
            objectKey,
            c.env,
            fileObj.type || 'application/pdf'
        );

        // 生成下载URL
        const downloadUrl = await minioService.generatePresignedDownloadUrl(
            objectKey,
            c.env
        );

        return c.json({
            success: true,
            data: {
                filename: fileObj.name,
                objectKey,
                downloadUrl,
                size: fileObj.size
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        return c.json({
            error: '文件上传失败',
            details: error instanceof Error ? error.message : String(error)
        }, 500);
    }
});
*/

/* UNUSED ENDPOINT - Removed 2025-12-30
 * 原因：前端未调用，文件删除由 sourceApi.delete() 处理
 *
/**
 * 删除文件
 * DELETE /api/upload/:objectKey
 */
/*
upload.delete('/:objectKey', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const objectKey = decodeURIComponent(c.req.param('objectKey'));

        // 验证objectKey是否属于当前用户
        const userId = currentUser.userId.toString();
        if (!objectKey.startsWith(`uploads/${userId}_`)) {
            return c.json({ error: '无权删除此文件' }, 403);
        }

        await minioService.deleteFile(objectKey, c.env);

        return c.json({
            success: true,
            message: '文件已删除'
        });
    } catch (error) {
        console.error('Delete error:', error);
        return c.json({
            error: '文件删除失败',
            details: error instanceof Error ? error.message : String(error)
        }, 500);
    }
});
*/

export default upload;
