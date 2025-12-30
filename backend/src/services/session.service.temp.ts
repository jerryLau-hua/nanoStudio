/**
 * 从 objectKey 创建 source（用于前端已上传到MinIO的情况）
 * @param sessionId 会话ID
 * @param userId 用户ID
 * @param filename 文件名
 * @param objectKey MinIO对象键
 * @param content PDF文本内容（前端提取）
 */
export const createSourceFromObjectKey = async (
    sessionId: number,
    userId: number,
    filename: string,
    objectKey: string,
    content: string
) => {
    try {
        // 创建source记录
        const source = await prisma.source.create({
            data: {
                userId,
                sessionId,
                name: filename,
                type: 'pdf',
                status: 'ready', // 前端已提取内容，直接标记为ready
                content,
                metadata: {
                    objectKey,
                    filename,
                    uploadedAt: new Date().toISOString(),
                }
            }
        });

        logger.info(`Source created from objectKey: ${source.id}`);

        // 后台RAG处理
        processRAG(source.id, content).catch(err => {
            logger.error(`RAG processing failed for source ${source.id}:`, err);
        });

        return source;
    } catch (error) {
        logger.error('Failed to create source from objectKey:', error);
        throw error;
    }
};
