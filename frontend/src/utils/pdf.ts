/**
 * PDF 文本提取工具
 * 使用 pdf.js 在浏览器中提取 PDF 文本内容
 */
import * as pdfjsLib from 'pdfjs-dist';

// 配置 PDF.js worker - 使用 node_modules 中的 worker 文件
// Vite 会自动处理这个路径
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
).toString();

/**
 * 从 PDF 文件中提取文本内容
 * @param file PDF 文件
 * @returns PDF 文本内容
 */
export async function extractPdfText(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    const numPages = pdf.numPages;

    for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
        fullText += pageText + '\n\n';
    }

    return fullText.trim();
}

/**
 * 获取 PDF 元数据
 * @param file PDF 文件
 * @returns PDF 页数等信息
 */
export async function getPdfMetadata(file: File): Promise<{
    numPages: number;
    fileSize: number;
}> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    return {
        numPages: pdf.numPages,
        fileSize: file.size,
    };
}
