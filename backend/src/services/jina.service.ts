import axios from 'axios';
import logger from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

/**
 * Jina Reader 网页内容抓取服务
 */

const JINA_READER_BASE_URL = process.env.JINA_READER_API || 'https://r.jina.ai/';

/**
 * 使用 Jina Reader 抓取网页内容
 * @param url 要抓取的网页 URL
 * @returns Markdown 格式的网页内容
 */
export const fetchWebContent = async (url: string): Promise<string> => {
    try {
        logger.info(`Fetching web content from: ${url}`);

        // Jina Reader API 用法：https://r.jina.ai/YOUR_URL
        const jinaUrl = `${JINA_READER_BASE_URL}${encodeURIComponent(url)}`;

        const response = await axios.get(jinaUrl, {
            headers: {
                'Accept': 'text/plain',
                'X-Return-Format': 'markdown'
            },
            timeout: 30000 // 30秒超时
        });

        if (response.status !== 200) {
            throw new AppError(`无法抓取网页内容: ${response.statusText}`, 500);
        }

        const content = response.data;

        if (!content || typeof content !== 'string') {
            throw new AppError('抓取的内容为空或格式错误', 500);
        }

        logger.info(`Successfully fetched content from ${url}, length: ${content.length}`);

        // 返回原始内容，让调用方决定何时清理
        // 这样可以先从原始内容提取标题，再清理内容
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

        logger.error('Jina Reader error:', error);
        throw new AppError('网页内容抓取失败', 500);
    }
};

/**
 * 从 Markdown 内容中提取网页标题
 * Jina Reader 返回的格式通常以 "Title: xxx" 开头
 * @param content Markdown 内容
 * @returns 提取的标题，无法提取返回空字符串
 */
export const extractTitle = (content: string): string => {
    // 只使用 Jina Reader 的 Title: 行（最可靠的来源）
    // 不使用第一个 # 标题，因为那通常是章节标题而不是网页标题
    const titleLineMatch = content.match(/^Title:\s*(.+)$/m);
    if (titleLineMatch && titleLineMatch[1].trim()) {
        const title = titleLineMatch[1].trim();
        // 排除无意义的标题
        if (title.length > 2 && !title.match(/^(首页|Home|Index|Page)$/i)) {
            return title.substring(0, 100);
        }
    }

    // 返回空字符串让调用方使用 URL 作为标题
    return '';
};

/**
 * 验证 URL 是否有效
 */
export const isValidUrl = (url: string): boolean => {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

/**
 * 清理网页内容，移除噪音
 */
export const cleanWebContent = (content: string): string => {
    let cleaned = content;

    // 1. 移除所有图片相关内容
    cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, ''); // Markdown 图片
    cleaned = cleaned.replace(/\[图片:?\s*[^\]]*\]/gi, ''); // [图片: xxx]
    cleaned = cleaned.replace(/\[?Image\s+\d+\]?/gi, ''); // Image 177, [Image 177]
    cleaned = cleaned.replace(/图片\s*\d+/g, ''); // 图片 177

    // 2. 移除所有链接（但保留有意义的链接文本）
    cleaned = cleaned.replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, (match, text) => {
        // 如果链接文本本身是 URL，删除
        if (text.match(/^https?:\/\//)) {
            return '';
        }
        // 如果链接文本是导航词，删除
        const navWords = ['登录', '注册', '更多', 'more', '点击', 'click', '查看', 'view', '下载', 'download'];
        if (navWords.some(w => text.toLowerCase().includes(w.toLowerCase()))) {
            return '';
        }
        // 保留文本但移除链接
        return text;
    });

    // 3. 移除所有 URL
    cleaned = cleaned.replace(/https?:\/\/[^\s\)]+/g, '');

    // 4. 移除 HTML 实体
    cleaned = cleaned.replace(/&[a-z]+;/gi, '');
    cleaned = cleaned.replace(/&#\d+;/g, '');

    // 5. 移除包含垃圾关键词的整行
    const garbageKeywords = [
        '转载', '分享', '收藏', '点赞', '评论', '关注', '订阅',
        '阅读量', '浏览量', '访问量', '字数',
        '上一篇', '下一篇', '相关文章', '推荐阅读', '热门文章',
        '版权声明', '原创', '转载请注明',
        'CSDN', '博客园', '掘金', 'SegmentFault', '简书',
        '举报', '投诉', '反馈',
        'APP下载', '扫码', '二维码',
        '复制代码', '运行代码', '展开代码',
        '发布于', '更新于', '作者', '标签', '分类',
    ];

    cleaned = cleaned.split('\n')
        .filter(line => {
            const lowerLine = line.toLowerCase();
            return !garbageKeywords.some(kw =>
                lowerLine.includes(kw.toLowerCase())
            );
        })
        .join('\n');

    // 6. 移除包含大量特殊字符的行
    cleaned = cleaned.split('\n')
        .filter(line => {
            const specialCount = (line.match(/[^a-zA-Z0-9\u4e00-\u9fa5\s\-_.,!?()（）。，！？：:；;""'']/g) || []).length;
            const totalChars = line.length;
            return totalChars === 0 || specialCount / totalChars < 0.35;
        })
        .join('\n');

    // 7. 移除过短的行（少于5个有效字符）
    cleaned = cleaned.split('\n')
        .filter(line => {
            const effectiveChars = line.replace(/\s/g, '').length;
            return effectiveChars === 0 || effectiveChars >= 5;
        })
        .join('\n');

    // 8. 智能段落过滤 - 只保留有意义的段落
    const paragraphs = cleaned.split(/\n\n+/);
    const meaningfulParagraphs = paragraphs.filter(para => {
        const text = para.trim();
        if (text.length === 0) return false;

        // 保留标题
        if (text.startsWith('#')) return true;

        // 段落至少15个字符
        if (text.length < 15) return false;

        // 检查中文内容
        const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
        if (chineseChars > 8) return true;

        // 检查英文内容
        const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
        if (englishWords > 6) return true;

        return false;
    });

    cleaned = meaningfulParagraphs.join('\n\n');

    // 9. 清理空白字符
    cleaned = cleaned.replace(/[ \t]+/g, ' '); // 多个空格转为一个
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n'); // 最多两个换行
    cleaned = cleaned.split('\n')
        .map(line => line.trim())
        .join('\n');

    // 10. 移除开头结尾空行
    cleaned = cleaned.trim();

    // 11. 如果清理后太短
    if (cleaned.length < 100) {
        return '# 内容提取结果\n\n提取的正文内容较少，原始网页可能主要包含图片或多媒体内容。\n\n' + cleaned;
    }

    return cleaned;
};
