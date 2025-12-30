/**
 * Drizzle ORM Schema
 * 从 Prisma schema 转换而来
 */

import { mysqlTable, int, varchar, datetime, date, index, unique } from 'drizzle-orm/mysql-core';
import { relations, sql } from 'drizzle-orm';

// ==================== Users Table ====================

export const users = mysqlTable('users', {
    id: int('id').primaryKey().autoincrement(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    username: varchar('username', { length: 255 }).notNull().unique(),
    password: varchar('password', { length: 255 }).notNull(),
    createdAt: datetime('created_at').$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at').$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
});

// ==================== CheckIns Table ====================

export const checkIns = mysqlTable('check_ins', {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id').notNull(),
    date: date('date', { mode: 'string' }).notNull(), // 使用 string 模式存储 YYYY-MM-DD
    createdAt: datetime('created_at').$defaultFn(() => new Date()),
}, (table) => ({
    userIdIdx: index('user_id_idx').on(table.userId),
    userDateUnique: unique('user_date_unique').on(table.userId, table.date),
}));

// ==================== Relations ====================

export const usersRelations = relations(users, ({ many }) => ({
    checkIns: many(checkIns),
}));

export const checkInsRelations = relations(checkIns, ({ one }) => ({
    user: one(users, {
        fields: [checkIns.userId],
        references: [users.id],
    }),
}));

// ==================== Types ====================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type CheckIn = typeof checkIns.$inferSelect;
export type NewCheckIn = typeof checkIns.$inferInsert;
