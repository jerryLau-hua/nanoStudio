/**
 * Jina Reader 网页内容抓取服务
 * Cloudflare Workers 兼容版本
 */

import axios from 'axios';
import { AppError } from '../middleware/auth';

const JINA_READER_BASE_URL = 'https://r.jina.ai/';

/**
 * 使用 Jina Reader 抓取网页内容
 */
export async function fetchWebContent(url: string, jinaApiKey?: string): Promise<string> {
    try {
        console.log(`Fetching web content from: ${url}`);

        // Jina Reader API 用法：https://r.jina.ai/YOUR_URL
        const jinaUrl = `${JINA_READER_BASE_URL}${url}`;

        const headers: any = {
            Accept: 'text/plain',
            'X-Return-Format': 'markdown',
        };

        // 如果提供了 API Key，添加到 headers
        if (jinaApiKey) {
            headers.Authorization = `Bearer ${jinaApiKey}`;
        }

        const response = await axios.get(jinaUrl, {
            headers,
            timeout: 30000, // 30秒超时
        });

        if (response.status !== 200) {
            throw new AppError(`无法抓取网页内容: ${response.statusText}`, 500);
        }

        const content = response.data;

        if (!content || typeof content !== 'string') {
            throw new AppError('抓取的内容为空或格式错误', 500);
        }

        console.log(`Successfully fetched content from ${url}, length: ${content.length}`);

        return content;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED') {
                throw new AppError('网页抓取超时，请重试', 504);
            }
            if (error.response?.status === 404) {
                throw new AppError('网页不存在', 404);
            }
            if (error.response?.status === 403) {
                throw new AppError('无权访问该网页', 403);
            }
        }

        console.error('Jina Reader error:', error);
        throw new AppError('网页内容抓取失败', 500);
    }
}

/**
 * 从 Markdown 内容中提取网页标题
 */
export function extractTitle(content: string): string {
    const titleLineMatch = content.match(/^Title:\s*(.+)$/m);
    if (titleLineMatch && titleLineMatch[1].trim()) {
        const title = titleLineMatch[1].trim();
        if (title.length > 2 && !title.match(/^(首页|Home|Index|Page)$/i)) {
            return title.substring(0, 100);
        }
    }
    return '';
}

/**
 * 验证 URL 是否有效
 */
export function isValidUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * 清理网页内容，移除噪音
 */
export function cleanWebContent(content: string): string {
    let cleaned = content;

    // 1. 移除图片
    cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
    cleaned = cleaned.replace(/\[图片:?\s*[^\]]*\]/gi, '');
    cleaned = cleaned.replace(/\[?Image\s+\d+\]?/gi, '');
    cleaned = cleaned.replace(/图片\s*\d+/g, '');

    // 2. 移除链接（保留文本）
    cleaned = cleaned.replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, (match, text) => {
        if (text.match(/^https?:\/\//)) return '';
        const navWords = ['登录', '注册', '更多', 'more', '点击', 'click'];
        if (navWords.some((w) => text.toLowerCase().includes(w.toLowerCase()))) return '';
        return text;
    });

    // 3. 移除 URL
    cleaned = cleaned.replace(/https?:\/\/[^\s\)]+/g, '');

    // 4. 移除垃圾关键词行
    const garbageKeywords = [
        '转载',
        '分享',
        '收藏',
        '点赞',
        '评论',
        '关注',
        '订阅',
        '阅读量',
        '版权声明',
        'CSDN',
        '博客园',
        '掘金',
        '二维码',
    ];

    cleaned = cleaned
        .split('\n')
        .filter((line) => {
            const lowerLine = line.toLowerCase();
            return !garbageKeywords.some((kw) => lowerLine.includes(kw.toLowerCase()));
        })
        .join('\n');

    // 5. 移除过短的行
    cleaned = cleaned
        .split('\n')
        .filter((line) => {
            const effectiveChars = line.replace(/\s/g, '').length;
            return effectiveChars === 0 || effectiveChars >= 5;
        })
        .join('\n');

    // 6. 清理空白
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned
        .split('\n')
        .map((line) => line.trim())
        .join('\n');

    cleaned = cleaned.trim();

    if (cleaned.length < 100) {
        return '# 内容提取结果\n\n提取的正文内容较少，原始网页可能主要包含图片或多媒体内容。\n\n' + cleaned;
    }

    return cleaned;
}
