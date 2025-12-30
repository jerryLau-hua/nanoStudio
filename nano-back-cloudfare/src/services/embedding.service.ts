/**
 * Embedding 向量化服务
 * 使用 Jina Embeddings V4 API
 */

import axios from 'axios';

const JINA_EMBEDDINGS_API = 'https://api.jina.ai/v1/embeddings';

/**
 * 生成单个文本的向量
 */
export async function generateEmbedding(text: string, jinaApiKey: string): Promise<number[]> {
    try {
        const response = await axios.post(
            JINA_EMBEDDINGS_API,
            {
                model: 'jina-embeddings-v4',
                task: 'text-matching',
                dimensions: 1024,
                input: [text],
            },
            {
                headers: {
                    Authorization: `Bearer ${jinaApiKey}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        return response.data.data[0].embedding;
    } catch (error: any) {
        const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
        console.error(`Jina embedding error: ${errorMsg}`);
        throw new Error(`向量化失败: ${errorMsg}`);
    }
}

/**
 * 批量生成向量
 */
export async function batchGenerateEmbeddings(
    texts: string[],
    jinaApiKey: string
): Promise<number[][]> {
    try {
        // Jina API 限制单次最多 100 条
        const batchSize = 100;
        const results: number[][] = [];

        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);

            const response = await axios.post(
                JINA_EMBEDDINGS_API,
                {
                    model: 'jina-embeddings-v4',
                    task: 'text-matching',
                    dimensions: 1024,
                    input: batch,
                },
                {
                    headers: {
                        Authorization: `Bearer ${jinaApiKey}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const embeddings = response.data.data.map((item: any) => item.embedding);
            results.push(...embeddings);

            console.log(`Generated embeddings for batch ${i / batchSize + 1}, count: ${batch.length}`);
        }

        return results;
    } catch (error: any) {
        const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
        console.error(`Batch embedding error: ${errorMsg}`);
        throw new Error(`批量向量化失败: ${errorMsg}`);
    }
}
