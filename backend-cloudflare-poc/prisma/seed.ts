/**
 * 数据库种子数据脚本
 * 添加测试用户和签到记录
 */

import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config();

async function seed() {
    const connection = await createConnection(process.env.DATABASE_URL!);

    try {
        console.log('🌱 开始添加种子数据...');

        // 清空现有数据
        await connection.query('DELETE FROM check_ins');
        await connection.query('DELETE FROM users');
        console.log('✅ 清空现有数据');

        // 添加测试用户
        const users = [
            { email: 'alice@example.com', username: 'alice', password: 'password123' },
            { email: 'bob@example.com', username: 'bob', password: 'password456' },
            { email: 'charlie@example.com', username: 'charlie', password: 'password789' },
        ];

        for (const user of users) {
            await connection.query(
                'INSERT INTO users (email, username, password) VALUES (?, ?, ?)',
                [user.email, user.username, user.password]
            );
            console.log(`✅ 创建用户: ${user.username}`);
        }

        // 获取用户 ID
        const [userRows] = await connection.query('SELECT id FROM users ORDER BY id');
        const userIds = (userRows as any[]).map(row => row.id);

        // 添加签到记录
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        const checkIns = [
            { userId: userIds[0], date: today.toISOString().split('T')[0] },
            { userId: userIds[0], date: yesterday.toISOString().split('T')[0] },
            { userId: userIds[1], date: today.toISOString().split('T')[0] },
            { userId: userIds[2], date: twoDaysAgo.toISOString().split('T')[0] },
        ];

        for (const checkIn of checkIns) {
            await connection.query(
                'INSERT INTO check_ins (user_id, date) VALUES (?, ?)',
                [checkIn.userId, checkIn.date]
            );
            console.log(`✅ 创建签到记录: 用户 ${checkIn.userId}, 日期 ${checkIn.date}`);
        }

        // 显示最终统计
        const [userCount] = await connection.query('SELECT COUNT(*) as count FROM users');
        const [checkInCount] = await connection.query('SELECT COUNT(*) as count FROM check_ins');

        console.log('\n📊 数据统计:');
        console.log(`   用户数: ${(userCount as any[])[0].count}`);
        console.log(`   签到记录数: ${(checkInCount as any[])[0].count}`);
        console.log('\n🎉 种子数据添加完成！');
    } catch (error) {
        console.error('❌ 添加种子数据失败:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

seed().catch(console.error);
