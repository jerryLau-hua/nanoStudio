import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * MinIO 服务（Cloudflare Workers版本）
 * 使用 AWS SDK S3 Client 与 MinIO 交互
 */

/**
 * 创建 S3 客户端实例
 */
export const getS3Client = (env: any): S3Client => {
    const endpoint = `${env.MINIO_USE_SSL === 'true' ? 'https' : 'http'}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`;

    return new S3Client({
        endpoint,
        region: 'us-east-1', // MinIO默认region
        credentials: {
            accessKeyId: env.MINIO_ACCESS_KEY,
            secretAccessKey: env.MINIO_SECRET_KEY,
        },
        forcePathStyle: true, // MinIO需要path-style访问
    });
};

/**
 * 生成对象键（路径）
 * 格式：uploads/{userId}_{timestamp}_{filename}
 */
export const generateObjectKey = (userId: string, filename: string): string => {
    const timestamp = Date.now();
    const ext = filename.split('.').pop() || '';
    const basename = filename
        .replace(/\.[^/.]+$/, '') // 移除扩展名
        .replace(/[^a-zA-Z0-9]/g, '_') // 移除特殊字符
        .substring(0, 50); // 限制长度

    return `uploads/${userId}_${timestamp}_${basename}.${ext}`;
};

/**
 * 生成预签名上传URL
 * @param filename 文件名
 * @param userId 用户ID
 * @param env 环境变量
 * @param expirySeconds 过期时间（秒），默认10分钟
 * @returns { uploadUrl, objectKey }
 */
export const generatePresignedUploadUrl = async (
    filename: string,
    userId: string,
    env: any,
    expirySeconds: number = 600
): Promise<{ uploadUrl: string; objectKey: string }> => {
    const client = getS3Client(env);
    const objectKey = generateObjectKey(userId, filename);

    // 不指定ContentType，让客户端在上传时设置
    // 这样可以避免签名不匹配的问题
    const command = new PutObjectCommand({
        Bucket: env.MINIO_BUCKET,
        Key: objectKey,
    });

    const uploadUrl = await getSignedUrl(client, command, {
        expiresIn: expirySeconds,
    });

    return { uploadUrl, objectKey };
};

/**
 * 生成预签名下载URL
 * @param objectKey 对象键
 * @param env 环境变量
 * @param expirySeconds 过期时间（秒），默认24小时
 * @returns 下载URL
 */
export const generatePresignedDownloadUrl = async (
    objectKey: string,
    env: any,
    expirySeconds: number = 24 * 60 * 60
): Promise<string> => {
    const client = getS3Client(env);
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');

    const command = new GetObjectCommand({
        Bucket: env.MINIO_BUCKET,
        Key: objectKey,
    });

    const downloadUrl = await getSignedUrl(client, command, {
        expiresIn: expirySeconds,
    });

    return downloadUrl;
};

/**
 * 上传文件到 MinIO（服务器端上传）
 * @param buffer 文件Buffer
 * @param objectKey 对象键
 * @param env 环境变量
 * @param contentType MIME类型
 */
export const uploadFile = async (
    buffer: ArrayBuffer | Uint8Array,
    objectKey: string,
    env: any,
    contentType: string = 'application/pdf'
): Promise<void> => {
    const client = getS3Client(env);

    const command = new PutObjectCommand({
        Bucket: env.MINIO_BUCKET,
        Key: objectKey,
        Body: buffer,
        ContentType: contentType,
    });

    await client.send(command);
};

/**
 * 删除文件
 * @param objectKey 对象键
 * @param env 环境变量
 */
export const deleteFile = async (
    objectKey: string,
    env: any
): Promise<void> => {
    const client = getS3Client(env);

    const command = new DeleteObjectCommand({
        Bucket: env.MINIO_BUCKET,
        Key: objectKey,
    });

    await client.send(command);
};

/**
 * 获取公共访问URL（如果MinIO配置为公开访问）
 * 注意：需要MinIO bucket设置为public-read
 */
export const getPublicUrl = (objectKey: string, env: any): string => {
    const protocol = env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
    return `${protocol}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}/${env.MINIO_BUCKET}/${objectKey}`;
};
