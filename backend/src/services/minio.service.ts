import * as Minio from 'minio';
import logger from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import fs from 'fs';
import path from 'path';

/**
 * MinIO 客户端实例
 */
let minioClient: Minio.Client | null = null;

/**
 * 从环境变量获取配置
 */
const getMinioConfig = () => {
    const endpoint = process.env.MINIO_ENDPOINT?.replace(/^https?:\/\//, '') || 'localhost';
    const port = parseInt(process.env.MINIO_PORT || '9000');
    const useSSL = process.env.MINIO_USE_SSL === 'true';
    const accessKey = process.env.MINIO_ACCESS_KEY || '';
    const secretKey = process.env.MINIO_SECRET_KEY || '';
    const bucket = process.env.MINIO_BUCKET || 'nano-studio';

    if (!accessKey || !secretKey) {
        throw new Error('MinIO credentials are not configured');
    }

    return { endpoint, port, useSSL, accessKey, secretKey, bucket };
};

/**
 * 初始化 MinIO 客户端
 */
export const initMinioClient = async (): Promise<void> => {
    try {
        const config = getMinioConfig();

        minioClient = new Minio.Client({
            endPoint: config.endpoint,
            port: config.port,
            useSSL: config.useSSL,
            accessKey: config.accessKey,
            secretKey: config.secretKey
        });

        // 检查 bucket 是否存在，不存在则创建
        const bucketExists = await minioClient.bucketExists(config.bucket);
        if (!bucketExists) {
            await minioClient.makeBucket(config.bucket, 'us-east-1');
            logger.info(`MinIO bucket '${config.bucket}' created`);
        }

        logger.info(`MinIO client initialized successfully. Bucket: ${config.bucket}`);
    } catch (error) {
        logger.error('Failed to initialize MinIO client:', error);
        throw new AppError('MinIO initialization failed', 500);
    }
};

/**
 * 获取 MinIO 客户端实例
 */
const getClient = (): Minio.Client => {
    if (!minioClient) {
        throw new AppError('MinIO client not initialized', 500);
    }
    return minioClient;
};

/**
 * 获取 bucket 名称
 */
const getBucket = (): string => {
    return getMinioConfig().bucket;
};

/**
 * 生成对象键（路径）
 * 格式：uploads/{userId}_{timestamp}_{filename}
 */
export const generateObjectKey = (userId: number, filename: string): string => {
    const timestamp = Date.now();
    const ext = path.extname(filename);
    const basename = path.basename(filename, ext)
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 50);

    return `uploads/${userId}_${timestamp}_${basename}${ext}`;
};

/**
 * 上传文件到 MinIO
 * @param buffer 文件 Buffer
 * @param objectKey 对象键（路径）
 * @param contentType MIME 类型
 */
export const uploadFile = async (
    buffer: Buffer,
    objectKey: string,
    contentType: string = 'application/pdf'
): Promise<string> => {
    try {
        const client = getClient();
        const bucket = getBucket();

        await client.putObject(bucket, objectKey, buffer, buffer.length, {
            'Content-Type': contentType
        });

        logger.info(`File uploaded to MinIO: ${objectKey}`);
        return objectKey;
    } catch (error) {
        logger.error('MinIO upload error:', error);
        throw new AppError('Failed to upload file to MinIO', 500);
    }
};

/**
 * 从 MinIO 下载文件到 Buffer
 * @param objectKey 对象键
 */
export const downloadFileToBuffer = async (objectKey: string): Promise<Buffer> => {
    try {
        const client = getClient();
        const bucket = getBucket();

        const chunks: Buffer[] = [];
        const stream = await client.getObject(bucket, objectKey);

        return new Promise((resolve, reject) => {
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', reject);
        });
    } catch (error) {
        logger.error('MinIO download error:', error);
        throw new AppError('Failed to download file from MinIO', 500);
    }
};

/**
 * 从 MinIO 下载文件到本地路径（用于需要文件路径的场景）
 * @param objectKey 对象键
 * @param localPath 本地保存路径
 */
export const downloadFileToPath = async (
    objectKey: string,
    localPath: string
): Promise<void> => {
    try {
        const client = getClient();
        const bucket = getBucket();

        await client.fGetObject(bucket, objectKey, localPath);
        logger.info(`File downloaded from MinIO to: ${localPath}`);
    } catch (error) {
        logger.error('MinIO download to path error:', error);
        throw new AppError('Failed to download file from MinIO', 500);
    }
};

/**
 * 删除 MinIO 中的文件
 * @param objectKey 对象键
 */
export const deleteFile = async (objectKey: string): Promise<void> => {
    try {
        const client = getClient();
        const bucket = getBucket();

        await client.removeObject(bucket, objectKey);
        logger.info(`File deleted from MinIO: ${objectKey}`);
    } catch (error) {
        logger.error('MinIO delete error:', error);
        throw new AppError('Failed to delete file from MinIO', 500);
    }
};

/**
 * 生成预签名 URL（用于文件访问）
 * @param objectKey 对象键
 * @param expirySeconds 过期时间（秒），默认 24 小时
 */
export const generatePresignedUrl = async (
    objectKey: string,
    expirySeconds: number = 24 * 60 * 60
): Promise<string> => {
    try {
        const client = getClient();
        const bucket = getBucket();

        const url = await client.presignedGetObject(bucket, objectKey, expirySeconds);
        return url;
    } catch (error) {
        logger.error('MinIO presigned URL generation error:', error);
        throw new AppError('Failed to generate presigned URL', 500);
    }
};

/**
 * 生成预签名上传 URL（用于前端直接上传）
 * @param userId 用户ID
 * @param filename 文件名
 * @param expirySeconds 过期时间（秒），默认 10 分钟
 */
export const generatePresignedUploadUrl = async (
    userId: string,
    filename: string,
    expirySeconds: number = 600
): Promise<{
    uploadUrl: string;
    downloadUrl: string;
    objectKey: string;
}> => {
    try {
        const client = getClient();
        const bucket = getBucket();

        // 生成对象键
        const objectKey = generateObjectKey(parseInt(userId), filename);

        // 生成上传URL（PUT）
        const uploadUrl = await client.presignedPutObject(bucket, objectKey, expirySeconds);

        // 生成下载URL（GET，有效期24小时）
        const downloadUrl = await client.presignedGetObject(bucket, objectKey, 24 * 60 * 60);

        logger.info(`Generated presigned upload URL for: ${objectKey}`);

        return {
            uploadUrl,
            downloadUrl,
            objectKey
        };
    } catch (error) {
        logger.error('MinIO presigned upload URL generation error:', error);
        throw new AppError('Failed to generate presigned upload URL', 500);
    }
};

/**
 * 检查文件是否存在
 * @param objectKey 对象键
 */
export const fileExists = async (objectKey: string): Promise<boolean> => {
    try {
        const client = getClient();
        const bucket = getBucket();

        await client.statObject(bucket, objectKey);
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * 获取文件元数据
 * @param objectKey 对象键
 */
export const getFileMetadata = async (objectKey: string) => {
    try {
        const client = getClient();
        const bucket = getBucket();

        const stat = await client.statObject(bucket, objectKey);
        return {
            size: stat.size,
            lastModified: stat.lastModified,
            etag: stat.etag,
            contentType: stat.metaData['content-type']
        };
    } catch (error) {
        logger.error('MinIO get metadata error:', error);
        throw new AppError('Failed to get file metadata', 500);
    }
};
