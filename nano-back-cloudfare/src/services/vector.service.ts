/**
 * Qdrant 向量数据库服务
 * Cloudflare Workers 兼容版本
 */

import axios from 'axios';

const COLLECTION_NAME = 'knowledge_chunks';
const VECTOR_SIZE = 1024; // jina-embeddings-v4 维度

/**
 * 初始化集合
 */
export async function initCollection(qdrantUrl: string): Promise<void> {
    try {
        await axios.get(`${qdrantUrl}/collections/${COLLECTION_NAME}`);
        console.log(`Qdrant collection "${COLLECTION_NAME}" already exists`);
    } catch (error: any) {
        if (error.response?.status === 404) {
            try {
                await axios.put(`${qdrantUrl}/collections/${COLLECTION_NAME}`, {
                    vectors: {
                        size: VECTOR_SIZE,
                        distance: 'Cosine',
                    },
                });
                console.log(`Qdrant collection "${COLLECTION_NAME}" created`);
            } catch (createError: any) {
                console.error(`Failed to create collection: ${createError.message}`);
                throw new Error(`创建集合失败: ${createError.message}`);
            }
        } else {
            console.error(`Qdrant init error: ${error.message}`);
            throw new Error(`向量数据库初始化失败: ${error.message}`);
        }
    }
}

/**
 * 添加文本块和向量
 */
export async function addChunks(
    sourceId: number,
    chunks: string[],
    embeddings: number[][],
    qdrantUrl: string
): Promise<string[]> {
    if (!chunks || chunks.length === 0) {
        console.warn(`No chunks to add for source ${sourceId}`);
        return [];
    }

    try {
        await initCollection(qdrantUrl);

        const points = chunks.map((chunk, index) => ({
            id: crypto.randomUUID(),
            vector: embeddings[index],
            payload: {
                sourceId,
                content: chunk,
                position: index,
                createdAt: new Date().toISOString(),
            },
        }));

        await axios.put(
            `${qdrantUrl}/collections/${COLLECTION_NAME}/points?wait=true`,
            { points }
        );

        console.log(`Added ${chunks.length} chunks to Qdrant for source ${sourceId}`);

        return points.map((p) => p.id as string);
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        console.error(`Qdrant add chunks error:`, errorDetail);
        throw new Error(`向量存储失败: ${JSON.stringify(errorDetail)}`);
    }
}

/**
 * 搜索相似文本块
 */
export async function searchSimilar(
    queryEmbedding: number[],
    sourceId: number,
    qdrantUrl: string,
    topK = 3
): Promise<Array<{ content: string; score: number; position: number }>> {
    try {
        await initCollection(qdrantUrl);

        const response = await axios.post(
            `${qdrantUrl}/collections/${COLLECTION_NAME}/points/search`,
            {
                vector: queryEmbedding,
                limit: topK,
                filter: {
                    must: [
                        {
                            key: 'sourceId',
                            match: { value: sourceId },
                        },
                    ],
                },
                with_payload: true,
            }
        );

        const results = response.data.result.map((hit: any) => ({
            content: hit.payload?.content as string,
            score: hit.score,
            position: hit.payload?.position as number,
        }));

        console.log(`Found ${results.length} similar chunks for source ${sourceId}`);

        return results;
    } catch (error: any) {
        console.error(`Qdrant search error: ${error.message}`);
        throw new Error(`向量检索失败: ${error.message}`);
    }
}

/**
 * 删除知识源的所有向量
 */
export async function deleteSourceVectors(sourceId: number, qdrantUrl: string): Promise<void> {
    try {
        await initCollection(qdrantUrl);

        await axios.post(
            `${qdrantUrl}/collections/${COLLECTION_NAME}/points/delete`,
            {
                filter: {
                    must: [
                        {
                            key: 'sourceId',
                            match: { value: sourceId },
                        },
                    ],
                },
            },
            { params: { wait: 'true' } }
        );

        console.log(`Deleted all vectors for source ${sourceId}`);
    } catch (error: any) {
        console.error(`Qdrant delete vectors error: ${error.message}`);
        throw new Error('向量删除失败');
    }
}
