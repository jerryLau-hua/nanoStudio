import jwt from 'jsonwebtoken';
import { hashPassword, comparePassword } from '../utils/encryption';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

interface RegisterData {
    email: string;
    username: string;
    password: string;
}

interface LoginData {
    email: string;
    password: string;
}

interface TokenPayload {
    userId: number;
    email: string;
}

/**
 * 生成 JWT Access Token
 */
export const generateAccessToken = (payload: TokenPayload): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET not configured');
    }

    // @ts-ignore - jsonwebtoken 类型定义问题
    return jwt.sign(payload, secret, {
        expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as string
    });
};

/**
 * 生成 JWT Refresh Token
 */
export const generateRefreshToken = (payload: TokenPayload): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET not configured');
    }

    // @ts-ignore - jsonwebtoken 类型定义问题
    return jwt.sign(payload, secret, {
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '30d') as string
    });
};

/**
 * 用户注册
 */
export const register = async (data: RegisterData) => {
    const { email, username, password } = data;

    // 检查用户是否已存在
    const existingUser = await prisma.user.findFirst({
        where: {
            OR: [
                { email },
                { username }
            ]
        }
    });

    if (existingUser) {
        if (existingUser.email === email) {
            throw new AppError('该邮箱已被注册', 409);
        }
        if (existingUser.username === username) {
            throw new AppError('该用户名已被使用', 409);
        }
    }

    // 哈希密码
    const hashedPassword = await hashPassword(password);

    // 创建用户
    const user = await prisma.user.create({
        data: {
            email,
            username,
            password: hashedPassword,
            settings: {
                create: {
                    apiUrl: 'https://api.deepseek.com/chat/completions',
                    model: 'deepseek-chat'
                }
            }
        },
        select: {
            id: true,
            email: true,
            username: true,
            createdAt: true
        }
    });

    logger.info(`New user registered: ${user.email}`);

    // 生成 Token
    const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email
    });

    const refreshToken = generateRefreshToken({
        userId: user.id,
        email: user.email
    });

    return {
        user,
        accessToken,
        refreshToken
    };
};

/**
 * 用户登录
 */
export const login = async (data: LoginData) => {
    const { email, password } = data;

    // 查找用户
    const user = await prisma.user.findUnique({
        where: { email },
        select: {
            id: true,
            email: true,
            username: true,
            password: true,
            createdAt: true
        }
    });

    if (!user) {
        throw new AppError('邮箱或密码错误', 401);
    }

    // 验证密码
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
        throw new AppError('邮箱或密码错误', 401);
    }

    logger.info(`User logged in: ${user.email}`);

    // 生成 Token
    const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email
    });

    const refreshToken = generateRefreshToken({
        userId: user.id,
        email: user.email
    });

    // 移除密码字段
    const { password: _, ...userWithoutPassword } = user;

    return {
        user: userWithoutPassword,
        accessToken,
        refreshToken
    };
};

/**
 * 获取当前用户信息
 */
export const getCurrentUser = async (userId: number) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            username: true,
            createdAt: true,
            updatedAt: true,
            settings: {
                select: {
                    apiUrl: true,
                    model: true
                    // 不返回 apiKeyEncrypted
                }
            }
        }
    });

    if (!user) {
        throw new AppError('用户不存在', 404);
    }

    return user;
};

/**
 * 刷新 Access Token
 */
export const refreshAccessToken = (refreshToken: string): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET not configured');
    }

    try {
        const decoded = jwt.verify(refreshToken, secret) as TokenPayload;

        // 生成新的 Access Token
        return generateAccessToken({
            userId: decoded.userId,
            email: decoded.email
        });
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new AppError('Refresh Token 已过期，请重新登录', 401);
        }
        if (error instanceof jwt.JsonWebTokenError) {
            throw new AppError('无效的 Refresh Token', 401);
        }
        throw error;
    }
};
