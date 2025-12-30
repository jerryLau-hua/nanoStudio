/**
 * 认证服务
 * 处理用户注册、登录等业务逻辑
 */

import { eq, or } from 'drizzle-orm';
import { hashPassword, comparePassword } from '../utils/encryption';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { AppError } from '../middleware/auth';
import type { Env } from '../db';

interface RegisterData {
    email: string;
    username: string;
    password: string;
}

interface LoginData {
    email: string;
    password: string;
}

/**
 * 用户注册
 */
export async function register(data: RegisterData, db: any, env: Env) {
    const { email, username, password } = data;

    // 检查用户是否已存在
    const existingUser = await db.query.users.findFirst({
        where: or(
            eq(db.schema.users.email, email),
            eq(db.schema.users.username, username)
        ),
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
    const [insertResult] = await db.insert(db.schema.users).values({
        email,
        username,
        password: hashedPassword,
    });

    // 创建用户设置
    await db.insert(db.schema.userSettings).values({
        userId: insertResult.insertId,
        apiUrl: 'https://api.deepseek.com/chat/completions',
        model: 'deepseek-chat',
    });

    // 获取新创建的用户
    const user = await db.query.users.findFirst({
        where: eq(db.schema.users.email, email),
        columns: {
            id: true,
            email: true,
            username: true,
            createdAt: true,
        },
    });

    console.log(`New user registered: ${user.email}`);

    // 生成 Token
    const accessToken = generateAccessToken(
        {
            userId: user.id,
            email: user.email,
        },
        env.JWT_SECRET
    );

    const refreshToken = generateRefreshToken(
        {
            userId: user.id,
            email: user.email,
        },
        env.JWT_SECRET
    );

    return {
        user,
        accessToken,
        refreshToken,
    };
}

/**
 * 用户登录
 */
export async function login(data: LoginData, db: any, env: Env) {
    const { email, password } = data;

    // 查找用户
    const user = await db.query.users.findFirst({
        where: eq(db.schema.users.email, email),
    });

    if (!user) {
        throw new AppError('邮箱或密码错误', 401);
    }

    // 验证密码
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
        throw new AppError('邮箱或密码错误', 401);
    }

    console.log(`User logged in: ${user.email}`);

    // 生成 Token
    const accessToken = generateAccessToken(
        {
            userId: user.id,
            email: user.email,
        },
        env.JWT_SECRET
    );

    const refreshToken = generateRefreshToken(
        {
            userId: user.id,
            email: user.email,
        },
        env.JWT_SECRET
    );

    // 移除密码字段
    const { password: _, ...userWithoutPassword } = user;

    return {
        user: userWithoutPassword,
        accessToken,
        refreshToken,
    };
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUserInfo(userId: number, db: any) {
    const user = await db.query.users.findFirst({
        where: eq(db.schema.users.id, userId),
        columns: {
            id: true,
            email: true,
            username: true,
            createdAt: true,
            updatedAt: true,
        },
        with: {
            settings: {
                columns: {
                    apiUrl: true,
                    model: true,
                    // 不返回 apiKeyEncrypted
                },
            },
        },
    });

    if (!user) {
        throw new AppError('用户不存在', 404);
    }

    return user;
}
