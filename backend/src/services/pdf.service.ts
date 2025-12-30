import fs from 'fs';
import logger from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

/**
 * PDF 解析服务
 * pdf-parse v2.4.5 使用方式：new PDFParse({ buffer }) 或 new PDFParse({ url })
 */

// 从 pdf-parse 导入 PDFParse 类
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PDFParse } = require('pdf-parse');


/**
 * 从 PDF 文件提取文本
 * @param input 文件路径或 Buffer
 */
export const extractTextFromPDF = async (input: string | Buffer): Promise<string> => {
    try {
        const dataBuffer = typeof input === 'string' ? fs.readFileSync(input) : input;

        // v2 API: 参数名是 data 而不是 buffer
        const parser = new PDFParse({ data: dataBuffer });
        const pdfData = await parser.getText();


        let text = pdfData.text;

        // 清理文本
        // 1. 移除多余空行
        text = text.replace(/\n{3,}/g, '\n\n');

        // 2. 移除单独的页码行
        text = text.replace(/^\s*\d+\s*$/gm, '');

        // 3. 移除行首行尾空白
        text = text.split('\n')
            .map((line: string) => line.trim())
            .join('\n');

        // 4. 移除开头结尾空行
        text = text.trim();

        logger.info(`Extracted ${text.length} characters from PDF`);

        return text;
    } catch (error) {
        logger.error('PDF extraction error:', error);

        // 记录详细错误信息
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`PDF parse failed: ${errorMessage}`);

        if (errorMessage.includes('Invalid PDF')) {
            throw new AppError('PDF 文件损坏或格式错误', 400);
        }

        // 抛出详细错误而不是通用错误
        throw new AppError(`PDF 解析失败: ${errorMessage}`, 500);
    }
};

/**
 * 获取 PDF 元数据
 * @param input 文件路径或 Buffer
 */
export const getPDFMetadata = async (input: string | Buffer) => {
    try {
        const dataBuffer = typeof input === 'string' ? fs.readFileSync(input) : input;
        const parser = new PDFParse({ data: dataBuffer });
        const pdfData = await parser.getInfo();

        return {
            pages: pdfData.numpages,
            info: pdfData.info || {},
            metadata: pdfData.metadata || {},
            version: pdfData.version
        };
    } catch (error) {
        logger.error('PDF metadata extraction error:', error);
        throw new AppError('无法读取 PDF 元数据', 500);
    }
};

/**
 * 提取 PDF 标题
 * 优先级：PDF metadata Title > 第一行文本 > 文件名
 * @param input 文件路径或 Buffer
 * @param fallbackFilename 备用文件名
 */
export const extractPDFTitle = async (
    input: string | Buffer,
    fallbackFilename: string
): Promise<string> => {
    try {
        const metadata = await getPDFMetadata(input);

        // 尝试从 PDF metadata 获取标题
        if (metadata.info.Title && metadata.info.Title.trim()) {
            return metadata.info.Title.trim();
        }

        // 尝试从内容第一行获取
        const content = await extractTextFromPDF(input);
        const firstLine = content.split('\n').find(line => line.trim().length > 0);

        if (firstLine && firstLine.length < 100) {
            return firstLine.substring(0, 100);
        }

        // 使用文件名
        return fallbackFilename;
    } catch {
        return fallbackFilename;
    }
};

/**
 * 验证 PDF 文件
 * @param input 文件路径或 Buffer
 */
export const validatePDF = async (input: string | Buffer): Promise<boolean> => {
    try {
        const dataBuffer = typeof input === 'string' ? fs.readFileSync(input) : input;
        const parser = new PDFParse({ data: dataBuffer });
        await parser.getText();
        return true;
    } catch {
        return false;
    }
};
