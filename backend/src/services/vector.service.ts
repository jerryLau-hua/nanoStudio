import axios from 'axios';
import logger from '../utils/logger';
import { randomUUID } from 'crypto';

/**
 * Qdrant 向量数据库服务
 * 使用 REST API 直接调用（绕过客户端库的 fetch 问题）
 */

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION_NAME = 'knowledge_chunks';
const VECTOR_SIZE = 1024; // jina-embeddings-v3 维度

/**
 * 初始化集合（如果不存在）
 */
export const initCollection = async (): Promise<void> => {
    try {
        // 检查集合是否存在
        const response = await axios.get(`${QDRANT_URL}/collections/${COLLECTION_NAME}`);
        logger.info(`Qdrant collection "${COLLECTION_NAME}" already exists`);
    } catch (error: any) {
        if (error.response?.status === 404) {
            // 集合不存在，创建
            try {
                await axios.put(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
                    vectors: {
                        size: VECTOR_SIZE,
                        distance: 'Cosine'
                    }
                });
                logger.info(`Qdrant collection "${COLLECTION_NAME}" created`);
            } catch (createError: any) {
                logger.error(`Failed to create collection: ${createError.message}`);
                throw new Error(`创建集合失败: ${createError.message}`);
            }
        } else {
            // 其他错误
            const errorMsg = error.message || 'Unknown error';

            if (error.code === 'ECONNREFUSED') {
                logger.error(`Qdrant connection refused at ${QDRANT_URL}`);
                throw new Error(`无法连接到 Qdrant: ${QDRANT_URL}`);
            }

            logger.error(`Qdrant init error: ${errorMsg}`);
            throw new Error(`向量数据库初始化失败: ${errorMsg}`);
        }
    }
};

/**
 * 添加文本块和向量
 */
export const addChunks = async (
    sourceId: number,
    chunks: string[],
    embeddings: number[][]
): Promise<string[]> => {
    // 防御性检查：如果没有chunks，直接返回空数组
    if (!chunks || chunks.length === 0) {
        logger.warn(`No chunks to add for source ${sourceId}, skipping vector storage`);
        return [];
    }

    try {
        await initCollection();

        const points = chunks.map((chunk, index) => ({
            id: randomUUID(), // 使用 UUID 作为 point ID
            vector: embeddings[index],
            payload: {
                sourceId,
                content: chunk,
                position: index,
                createdAt: new Date().toISOString()
            }
        }));

        // 使用 REST API 插入向量
        const response = await axios.put(
            `${QDRANT_URL}/collections/${COLLECTION_NAME}/points?wait=true`,
            { points }
        );

        logger.info(`Added ${chunks.length} chunks to Qdrant for source ${sourceId}`);

        return points.map(p => p.id as string);
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        logger.error(`Qdrant add chunks error:`, errorDetail);
        throw new Error(`向量存储失败: ${JSON.stringify(errorDetail)}`);
    }
};

/**
 * 搜索相似文本块
 */
export const searchSimilar = async (
    queryEmbedding: number[],
    sourceId: number,
    topK = 3
): Promise<Array<{ content: string; score: number; position: number }>> => {
    try {
        await initCollection();

        const response = await axios.post(
            `${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`,
            {
                vector: queryEmbedding,
                limit: topK,
                filter: {
                    must: [
                        {
                            key: 'sourceId',
                            match: { value: sourceId }
                        }
                    ]
                },
                with_payload: true
            }
        );

        const results = response.data.result.map((hit: any) => ({
            content: hit.payload?.content as string,
            score: hit.score,
            position: hit.payload?.position as number
        }));

        logger.info(`Found ${results.length} similar chunks for source ${sourceId}`);

        return results;
    } catch (error: any) {
        logger.error(`Qdrant search error: ${error.message}`);
        throw new Error(`向量检索失败: ${error.message}`);
    }
};

/**
 * 删除知识源的所有向量
 */
export const deleteSourceVectors = async (sourceId: number): Promise<void> => {
    try {
        await initCollection();

        await axios.post(
            `${QDRANT_URL}/collections/${COLLECTION_NAME}/points/delete`,
            {
                filter: {
                    must: [
                        {
                            key: 'sourceId',
                            match: { value: sourceId }
                        }
                    ]
                }
            },
            { params: { wait: 'true' } }
        );

        logger.info(`Deleted all vectors for source ${sourceId}`);
    } catch (error: any) {
        logger.error(`Qdrant delete vectors error: ${error.message}`);
        throw new Error(`向量删除失败: ${error.message}`);
    }
};

/**
 * 获取集合统计信息
 */
export const getCollectionInfo = async () => {
    try {
        const response = await axios.get(`${QDRANT_URL}/collections/${COLLECTION_NAME}`);
        const info = response.data.result;

        return {
            pointsCount: info.points_count || 0,
            vectorsCount: info.indexed_vectors_count || 0,
            status: info.status
        };
    } catch (error: any) {
        logger.error(`Qdrant get collection info error: ${error.message}`);
        return null;
    }
};
