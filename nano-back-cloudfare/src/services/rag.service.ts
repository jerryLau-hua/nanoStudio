/**
 * RAG 处理：分块和向量化
 */
import { eq } from 'drizzle-orm';

export async function processRAGForSource(
    sourceId: number,
    content: string,
    type: 'text' | 'website' | 'pdf',
    db: any,
    env: any
) {
    try {
        console.log(`Starting RAG processing for source ${sourceId}`);

        if (!content || content.length < 50) {
            console.warn(`Content too short for RAG processing`);
            await db
                .update(db.schema.sources)
                .set({ status: 'ready' })
                .where(eq(db.schema.sources.id, sourceId));
            return;
        }

        // 1. 文本分块
        const chunkingService = await import('./chunking.service');
        const chunks = chunkingService.getRecommendedChunks(content, type);
        console.log(`Generated ${chunks.length} chunks`);

        if (chunks.length === 0) {
            await db
                .update(db.schema.sources)
                .set({ status: 'ready', metadata: { chunksCount: 0, ragProcessed: true } })
                .where(eq(db.schema.sources.id, sourceId));
            return;
        }

        // 2. 生成向量
        const embeddingService = await import('./embedding.service');
        const jinaApiKey = env.JINA_API_KEY;

        if (!jinaApiKey) {
            console.warn('No JINA_API_KEY configured, skipping embedding');
            await db
                .update(db.schema.sources)
                .set({ status: 'ready', metadata: { chunksCount: chunks.length, ragSkipped: true } })
                .where(eq(db.schema.sources.id, sourceId));
            return;
        }

        const embeddings = await embeddingService.batchGenerateEmbeddings(chunks, jinaApiKey);
        console.log(`Generated ${embeddings.length} embeddings`);

        // 3. 存储到向量数据库
        if (env.QDRANT_URL) {
            const vectorService = await import('./vector.service');
            await vectorService.addChunks(sourceId, chunks, embeddings, env.QDRANT_URL);
        }

        // 4. 更新 source metadata
        await db
            .update(db.schema.sources)
            .set({
                status: 'ready',
                metadata: {
                    chunksCount: chunks.length,
                    ragProcessed: true,
                    processedAt: new Date().toISOString(),
                },
            })
            .where(eq(db.schema.sources.id, sourceId));

        console.log(`RAG processing completed for source ${sourceId}`);
    } catch (error) {
        console.error(`RAG processing failed for source ${sourceId}:`, error);
        throw error;
    }
}
