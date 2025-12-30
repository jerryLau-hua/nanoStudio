import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

/**
 * 获取用户资料
 */
export const getUserProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.userId;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                email: true,
                createdAt: true
            }
        });

        if (!user) {
            throw new AppError('用户不存在', 404);
        }

        res.json({ data: user });
    } catch (error) {
        next(error);
    }
};

/**
 * 更新用户资料
 */
export const updateUserProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.userId;
        const { username } = req.body;

        if (!username || !username.trim()) {
            throw new AppError('用户名不能为空', 400);
        }

        // 检查用户名是否已被使用
        const existingUser = await prisma.user.findFirst({
            where: {
                username,
                id: { not: userId }
            }
        });

        if (existingUser) {
            throw new AppError('用户名已被使用', 400);
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { username },
            select: {
                id: true,
                username: true,
                email: true
            }
        });

        logger.info(`User ${userId} updated profile`);
        res.json({ data: updatedUser });
    } catch (error) {
        next(error);
    }
};

/**
 * 每日签到
 */
export const checkIn = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.userId;

        // 获取今天的日期（使用ISO格式的日期字符串，避免时区问题）
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const today = new Date(todayStr + 'T00:00:00.000Z');

        // 检查今天是否已签到
        const existingCheckIn = await prisma.checkIn.findFirst({
            where: {
                userId,
                date: today
            }
        });

        if (existingCheckIn) {
            throw new AppError('今日已签到', 400);
        }

        // 创建签到记录
        let checkInRecord;
        try {
            checkInRecord = await prisma.checkIn.create({
                data: {
                    userId,
                    date: today
                }
            });
        } catch (prismaError: any) {
            // 处理唯一约束冲突（并发情况下可能发生）
            if (prismaError.code === 'P2002') {
                throw new AppError('今日已签到', 400);
            }
            throw prismaError;
        }

        // 获取签到统计
        const stats = await getCheckInStatsForUser(userId);

        logger.info(`User ${userId} checked in`);
        res.json({ data: { checkIn: checkInRecord, stats } });
    } catch (error) {
        next(error);
    }
};

/**
 * 获取签到统计
 */
export const getCheckInStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.userId;
        const stats = await getCheckInStatsForUser(userId);
        res.json({ data: stats });
    } catch (error) {
        next(error);
    }
};

/**
 * 辅助函数：计算用户签到统计
 */
async function getCheckInStatsForUser(userId: number) {
    // 获取总签到次数
    const totalCheckIns = await prisma.checkIn.count({
        where: { userId }
    });

    // 获取最近的签到记录
    const recentCheckIns = await prisma.checkIn.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 100
    });

    // 计算连续签到天数（使用ISO日期字符串避免时区问题）
    let streak = 0;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    for (let i = 0; i < recentCheckIns.length; i++) {
        const checkInDate = new Date(recentCheckIns[i].date);
        const checkInStr = `${checkInDate.getUTCFullYear()}-${String(checkInDate.getUTCMonth() + 1).padStart(2, '0')}-${String(checkInDate.getUTCDate()).padStart(2, '0')}`;

        // 计算期望日期
        const expectedDate = new Date(now);
        expectedDate.setDate(expectedDate.getDate() - i);
        const expectedStr = `${expectedDate.getFullYear()}-${String(expectedDate.getMonth() + 1).padStart(2, '0')}-${String(expectedDate.getDate()).padStart(2, '0')}`;

        if (checkInStr === expectedStr) {
            streak++;
        } else {
            break;
        }
    }

    // 检查今天是否已签到
    const hasCheckedInToday = recentCheckIns.length > 0 && (() => {
        const lastCheckIn = new Date(recentCheckIns[0].date);
        const lastCheckInStr = `${lastCheckIn.getUTCFullYear()}-${String(lastCheckIn.getUTCMonth() + 1).padStart(2, '0')}-${String(lastCheckIn.getUTCDate()).padStart(2, '0')}`;
        return lastCheckInStr === todayStr;
    })();

    // 获取最后签到日期
    const lastCheckInDate = recentCheckIns.length > 0 ? recentCheckIns[0].date : null;

    return {
        totalCheckIns,
        checkInStreak: streak,
        hasCheckedInToday,
        lastCheckInDate
    };
}
