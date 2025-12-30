import axios from 'axios';
import logger from '../utils/logger';

/**
 * Jina Embeddings V3 服务
 * 模型：jina-embeddings-v3
 * Task：text-matching（用于检索和匹配）
 */

const JINA_EMBEDDINGS_API = 'https://api.jina.ai/v1/embeddings';
const JINA_API_KEY = process.env.JINA_API_KEY || process.env.JINA_READER_API;

/**
 * 生成单个文本的向量
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
    try {
        const response = await axios.post(
            JINA_EMBEDDINGS_API,
            {
                model: 'jina-embeddings-v4',
                task: 'text-matching',
                dimensions: 1024,
                input: [text]
            },
            {
                headers: {
                    'Authorization': `Bearer ${JINA_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.data[0].embedding;
    } catch (error: any) {
        const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
        const statusCode = error.response?.status;

        logger.error(`Jina embedding error: ${errorMsg}`, { statusCode });
        throw new Error(`向量化失败: ${errorMsg}`);
    }
};

/**
 * 批量生成向量
 */
export const batchGenerateEmbeddings = async (texts: string[]): Promise<number[][]> => {
    try {
        // Jina API 限制单次最多 100 条
        const batchSize = 100;
        const results: number[][] = [];

        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);

            const response = await axios.post(
                JINA_EMBEDDINGS_API,
                {
                    model: 'jina-embeddings-v4',  // 🔥 与查询保持一致
                    task: 'text-matching',
                    dimensions: 1024,
                    input: batch
                },
                {
                    headers: {
                        'Authorization': `Bearer ${JINA_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const embeddings = response.data.data.map((item: any) => item.embedding);
            results.push(...embeddings);

            logger.info(`Generated embeddings for batch ${i / batchSize + 1}, count: ${batch.length}`);
        }

        return results;
    } catch (error: any) {
        const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
        const statusCode = error.response?.status;

        logger.error(`Batch embedding error: ${errorMsg}`, { statusCode });
        throw new Error(`批量向量化失败: ${errorMsg}`);
    }
};
