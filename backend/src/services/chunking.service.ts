import logger from '../utils/logger';

/**
 * 文本分块服务
 */

interface ChunkOptions {
    chunkSize?: number;      // 每块大小（字符数）
    overlap?: number;         // 重叠字符数
    splitByParagraph?: boolean; // 是否按段落智能分割
}

/**
 * 简单分块（固定大小 + 重叠）
 */
export const chunkText = (
    text: string,
    options: ChunkOptions = {}
): string[] => {
    const {
        chunkSize = 500,
        overlap = 50
    } = options;

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        const chunk = text.substring(start, end).trim();

        if (chunk.length > 0) {
            chunks.push(chunk);
        }

        start += chunkSize - overlap;
    }

    logger.info(`Simple chunking: ${chunks.length} chunks created from ${text.length} chars`);
    return chunks;
};

/**
 * 智能分块（按段落）
 * 优先保持段落完整性
 */
export const smartChunk = (
    text: string,
    options: ChunkOptions = {}
): string[] => {
    const { chunkSize = 500, overlap = 0 } = options;

    // 按段落分割
    const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0);

    const chunks: string[] = [];
    let currentChunk = '';

    for (const para of paragraphs) {
        // 如果单个段落超过 chunkSize，强制分割
        if (para.length > chunkSize) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }

            // 分割长段落
            const subChunks = chunkText(para, { chunkSize, overlap });
            chunks.push(...subChunks);
            continue;
        }

        // 尝试添加段落到当前块
        if (currentChunk.length + para.length + 2 <= chunkSize) {
            currentChunk += (currentChunk ? '\n\n' : '') + para;
        } else {
            // 当前块已满，保存并开始新块
            if (currentChunk) {
                chunks.push(currentChunk.trim());
            }
            currentChunk = para;
        }
    }

    // 添加最后一块
    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }

    logger.info(`Smart chunking: ${chunks.length} chunks created from ${paragraphs.length} paragraphs`);
    return chunks;
};

/**
 * 按句子分块（中英文）
 */
export const chunkBySentence = (
    text: string,
    options: ChunkOptions = {}
): string[] => {
    const { chunkSize = 500 } = options;

    // 中英文句子分割正则
    const sentenceRegex = /[。！？\.!?]+/g;
    const sentences = text.split(sentenceRegex).map(s => s.trim()).filter(s => s.length > 0);

    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
        if (currentChunk.length + sentence.length + 1 <= chunkSize) {
            currentChunk += (currentChunk ? '。' : '') + sentence;
        } else {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
            }
            currentChunk = sentence;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }

    logger.info(`Sentence chunking: ${chunks.length} chunks created from ${sentences.length} sentences`);
    return chunks;
};

/**
 * 获取推荐的分块方法
 */
export const getRecommendedChunks = (
    text: string,
    contentType: 'text' | 'website' | 'pdf' = 'text'
): string[] => {
    // 根据内容类型选择最佳分块策略
    // 增大 chunk 大小以提升语义匹配度
    switch (contentType) {
        case 'pdf':
            // PDF 通常有清晰的段落结构
            return smartChunk(text, { chunkSize: 1500, overlap: 100 });

        case 'website':
            // 网页内容 - 增大 chunk 以包含更完整的上下文
            return smartChunk(text, { chunkSize: 1200, overlap: 150 });

        case 'text':
        default:
            // 默认智能分块
            return smartChunk(text, { chunkSize: 1000, overlap: 100 });
    }
};
