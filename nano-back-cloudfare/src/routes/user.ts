/**
 * 用户路由
 * GET /api/user/profile - 获取用户资料
 * PATCH /api/user/profile - 更新用户资料
 * POST /api/user/check-in - 每日签到
 * GET /api/user/check-in/stats - 签到统计
 */

import { Hono } from 'hono';
import { eq, and, desc, sql } from 'drizzle-orm';
import { createDb, type Env } from '../db';
import { authenticateJWT, getCurrentUser, AppError } from '../middleware/auth';

const user = new Hono<{ Bindings: Env }>();

// 所有用户路由都需要认证
user.use('*', authenticateJWT);

/**
 * 获取用户资料
 * GET /api/user/profile
 */
user.get('/profile', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const db = createDb(c.env);

        const userProfile = await db.query.users.findFirst({
            where: eq(db.schema.users.id, currentUser.userId),
            columns: {
                id: true,
                username: true,
                email: true,
                createdAt: true,
            },
        });

        if (!userProfile) {
            throw new AppError('用户不存在', 404);
        }

        return c.json({ data: userProfile });
    } catch (error) {
        console.error('Get user profile failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode);
        }
        return c.json({ error: 'Failed to get profile' }, 500);
    }
});

/**
 * 更新用户资料
 * PATCH /api/user/profile
 */
user.patch('/profile', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const body = await c.req.json<{ username: string }>();

        if (!body.username || !body.username.trim()) {
            throw new AppError('用户名不能为空', 400);
        }

        const db = createDb(c.env);

        // 检查用户名是否已被使用
        const existingUser = await db.query.users.findFirst({
            where: and(
                eq(db.schema.users.username, body.username),
                sql`${db.schema.users.id} != ${currentUser.userId}`
            ),
        });

        if (existingUser) {
            throw new AppError('用户名已被使用', 400);
        }

        // 更新用户
        await db
            .update(db.schema.users)
            .set({ username: body.username })
            .where(eq(db.schema.users.id, currentUser.userId));

        // 获取更新后的用户信息
        const updatedUser = await db.query.users.findFirst({
            where: eq(db.schema.users.id, currentUser.userId),
            columns: {
                id: true,
                username: true,
                email: true,
            },
        });

        console.log(`User ${currentUser.userId} updated profile`);
        return c.json({ data: updatedUser });
    } catch (error) {
        console.error('Update user profile failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode);
        }
        return c.json({ error: 'Failed to update profile' }, 500);
    }
});

/**
 * 每日签到
 * POST /api/user/check-in
 */
user.post('/check-in', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const db = createDb(c.env);

        // 获取今天的日期（YYYY-MM-DD）
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // 检查今天是否已签到
        const existingCheckIn = await db.query.checkIns.findFirst({
            where: and(
                eq(db.schema.checkIns.userId, currentUser.userId),
                eq(db.schema.checkIns.date, todayStr)
            ),
        });

        if (existingCheckIn) {
            throw new AppError('今日已签到', 400);
        }

        // 创建签到记录
        let checkInRecord;
        try {
            await db.insert(db.schema.checkIns).values({
                userId: currentUser.userId,
                date: todayStr,
            });

            checkInRecord = await db.query.checkIns.findFirst({
                where: and(
                    eq(db.schema.checkIns.userId, currentUser.userId),
                    eq(db.schema.checkIns.date, todayStr)
                ),
            });
        } catch (dbError: any) {
            // 处理唯一约束冲突（并发情况）
            if (dbError.message && dbError.message.includes('1062')) {
                throw new AppError('今日已签到', 400);
            }
            throw dbError;
        }

        // 获取签到统计
        const stats = await getCheckInStatsForUser(currentUser.userId, db);

        console.log(`User ${currentUser.userId} checked in`);
        return c.json({ data: { checkIn: checkInRecord, stats } });
    } catch (error) {
        console.error('Check-in failed:', error);
        if (error instanceof AppError) {
            return c.json({ error: error.message }, error.statusCode);
        }
        return c.json({ error: 'Check-in failed' }, 500);
    }
});

/**
 * 获取签到统计
 * GET /api/user/check-in/stats
 */
user.get('/check-in/stats', async (c) => {
    try {
        const currentUser = getCurrentUser(c);
        const db = createDb(c.env);

        const stats = await getCheckInStatsForUser(currentUser.userId, db);

        return c.json({ data: stats });
    } catch (error) {
        console.error('Get check-in stats failed:', error);
        return c.json({ error: 'Failed to get stats' }, 500);
    }
});

/**
 * 辅助函数：计算用户签到统计
 */
async function getCheckInStatsForUser(userId: number, db: any) {
    // 获取总签到次数
    const checkIns = await db.query.checkIns.findMany({
        where: eq(db.schema.checkIns.userId, userId),
        orderBy: [desc(db.schema.checkIns.date)],
        limit: 100,
    });

    const totalCheckIns = checkIns.length;

    // 计算连续签到天数
    let streak = 0;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    for (let i = 0; i < checkIns.length; i++) {
        const checkInDate = checkIns[i].date;

        // 计算期望日期
        const expectedDate = new Date(now);
        expectedDate.setDate(expectedDate.getDate() - i);
        const expectedStr = `${expectedDate.getFullYear()}-${String(expectedDate.getMonth() + 1).padStart(2, '0')}-${String(expectedDate.getDate()).padStart(2, '0')}`;

        if (checkInDate === expectedStr) {
            streak++;
        } else {
            break;
        }
    }

    // 检查今天是否已签到
    const hasCheckedInToday = checkIns.length > 0 && checkIns[0].date === todayStr;

    // 获取最后签到日期
    const lastCheckInDate = checkIns.length > 0 ? checkIns[0].date : null;

    return {
        totalCheckIns,
        checkInStreak: streak,
        hasCheckedInToday,
        lastCheckInDate,
    };
}

export default user;
