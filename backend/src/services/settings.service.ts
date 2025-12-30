import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { encryptApiKey, decryptApiKey } from '../utils/encryption';
import logger from '../utils/logger';

/**
 * 用户设置管理服务
 */

/**
 * 获取用户设置（不返回加密的 API Key）
 */
export const getUserSettings = async (userId: number) => {
    const settings = await prisma.userSetting.findUnique({
        where: { userId },
        select: {
            apiUrl: true,
            model: true
            // 不选择 apiKeyEncrypted
        }
    });

    if (!settings) {
        throw new AppError('用户设置不存在', 404);
    }

    // 检查是否已设置 API Key（不返回实际值）
    const fullSettings = await prisma.userSetting.findUnique({
        where: { userId },
        select: { apiKeyEncrypted: true }
    });

    return {
        ...settings,
        hasApiKey: !!fullSettings?.apiKeyEncrypted
    };
};

/**
 * 更新用户设置（apiUrl, model）
 */
export const updateSettings = async (userId: number, data: {
    apiUrl?: string;
    model?: string;
}) => {
    const updated = await prisma.userSetting.update({
        where: { userId },
        data: {
            ...(data.apiUrl && { apiUrl: data.apiUrl }),
            ...(data.model && { model: data.model })
        },
        select: {
            apiUrl: true,
            model: true
        }
    });

    logger.info(`User ${userId} updated settings`);

    return updated;
};

/**
 * 设置/更新 API Key（加密存储）
 */
export const setApiKey = async (userId: number, apiKey: string) => {
    // 移除格式校验，支持各种 API（Gemini, OpenAI, DeepSeek 等）
    // 不同的 API 提供商有不同的 Key 格式

    if (!apiKey || apiKey.trim().length === 0) {
        throw new Error('API Key 不能为空');
    }

    // 加密 API Key
    const encrypted = encryptApiKey(apiKey);

    // 更新或创建设置
    await prisma.userSetting.upsert({
        where: { userId },
        update: { apiKeyEncrypted: encrypted },
        create: {
            userId,
            apiKeyEncrypted: encrypted,
            apiUrl: 'https://api.deepseek.com/chat/completions',
            model: 'deepseek-chat'
        }
    });

    return { message: 'API Key 已保存' };
};

/**
 * 获取解密的 API Key（仅内部使用，不对外暴露）
 */
export const getUserApiKey = async (userId: number): Promise<string> => {
    const settings = await prisma.userSetting.findUnique({
        where: { userId },
        select: { apiKeyEncrypted: true }
    });

    if (!settings?.apiKeyEncrypted) {
        throw new AppError('请先设置 DeepSeek API Key', 400);
    }

    try {
        return decryptApiKey(settings.apiKeyEncrypted);
    } catch (error) {
        logger.error('Failed to decrypt API key:', error);
        throw new AppError('API Key 解密失败，请重新设置', 500);
    }
};

/**
 * 删除 API Key
 */
export const deleteApiKey = async (userId: number) => {
    await prisma.userSetting.update({
        where: { userId },
        data: { apiKeyEncrypted: null }
    });

    logger.info(`User ${userId} deleted API key`);

    return { success: true, message: 'API Key 已删除' };
};
