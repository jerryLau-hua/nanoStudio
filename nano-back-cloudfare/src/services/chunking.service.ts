/**
 * 文本分块服务
 * Cloudflare Workers 兼容版本
 */

/**
 * 简单分块（固定大小 + 重叠）
 */
export function chunkText(
    text: string,
    chunkSize = 500,
    overlap = 50
): string[] {
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

    console.log(`Simple chunking: ${chunks.length} chunks created from ${text.length} chars`);
    return chunks;
}

/**
 * 智能分块（按段落）
 */
export function smartChunk(
    text: string,
    chunkSize = 500,
    overlap = 0
): string[] {
    // 按段落分割
    const paragraphs = text
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

    const chunks: string[] = [];
    let currentChunk = '';

    for (const para of paragraphs) {
        // 如果单个段落超过 chunkSize，强制分割
        if (para.length > chunkSize) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }

            const subChunks = chunkText(para, chunkSize, overlap);
            chunks.push(...subChunks);
            continue;
        }

        // 尝试添加段落到当前块
        if (currentChunk.length + para.length + 2 <= chunkSize) {
            currentChunk += (currentChunk ? '\n\n' : '') + para;
        } else {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
            }
            currentChunk = para;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }

    console.log(`Smart chunking: ${chunks.length} chunks created from ${paragraphs.length} paragraphs`);
    return chunks;
}

/**
 * 获取推荐的分块方法
 */
export function getRecommendedChunks(
    text: string,
    contentType: 'text' | 'website' | 'pdf' = 'text'
): string[] {
    switch (contentType) {
        case 'pdf':
            return smartChunk(text, 1500, 100);
        case 'website':
            return smartChunk(text, 1200, 150);
        case 'text':
        default:
            return smartChunk(text, 1000, 100);
    }
}
