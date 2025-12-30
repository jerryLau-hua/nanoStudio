/**
 * Drizzle ORM Schema
 * 从 Prisma schema 完整迁移
 */

import {
    mysqlTable,
    int,
    varchar,
    text,
    longtext,
    datetime,
    date,
    bigint,
    json,
    index,
    unique,
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

// ==================== Users Table ====================

export const users = mysqlTable('users', {
    id: int('id').primaryKey().autoincrement(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    username: varchar('username', { length: 255 }).notNull().unique(),
    password: varchar('password', { length: 255 }).notNull(),
    createdAt: datetime('created_at').$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at').$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
});

// ==================== User Settings Table ====================

export const userSettings = mysqlTable('user_settings', {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id').notNull().unique(),
    apiKeyEncrypted: text('api_key_encrypted'),
    apiUrl: varchar('api_url', { length: 500 }).notNull().$defaultFn(() => 'https://api.deepseek.com/chat/completions'),
    model: varchar('model', { length: 100 }).notNull().$defaultFn(() => 'deepseek-chat'),
});

// ==================== CheckIns Table ====================

export const checkIns = mysqlTable('check_ins', {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    createdAt: datetime('created_at').$defaultFn(() => new Date()),
}, (table) => ({
    userIdIdx: index('user_id_idx').on(table.userId),
    userDateUnique: unique('user_date_unique').on(table.userId, table.date),
}));

// ==================== Notebook Sessions Table ====================

export const notebookSessions = mysqlTable('notebook_sessions', {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    preview: text('preview'),
    createdAt: datetime('created_at').$defaultFn(() => new Date()),
    updatedAt: datetime('updated_at').$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
}, (table) => ({
    userIdIdx: index('user_id_idx').on(table.userId),
}));

// ==================== Sources Table ====================

export const sources = mysqlTable('sources', {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id').notNull(),
    sessionId: int('session_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(), // 'pdf', 'website', 'text'
    status: varchar('status', { length: 20 }).notNull(), // 'parsing', 'ready', 'error'
    content: longtext('content').notNull(),
    metadata: json('metadata'),
    createdAt: datetime('created_at').$defaultFn(() => new Date()),
}, (table) => ({
    userIdIdx: index('user_id_idx').on(table.userId),
    sessionIdIdx: index('session_id_idx').on(table.sessionId),
}));

// ==================== Chat Messages Table ====================

export const chatMessages = mysqlTable('chat_messages', {
    id: int('id').primaryKey().autoincrement(),
    sessionId: int('session_id').notNull(),
    role: varchar('role', { length: 20 }).notNull(), // 'user', 'assistant', 'system'
    content: longtext('content').notNull(),
    timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
    createdAt: datetime('created_at').$defaultFn(() => new Date()),
}, (table) => ({
    sessionIdIdx: index('session_id_idx').on(table.sessionId),
}));

// ==================== Notes Table ====================

export const notes = mysqlTable('notes', {
    id: int('id').primaryKey().autoincrement(),
    sessionId: int('session_id').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(), // 'summary', 'mindmap'
    status: varchar('status', { length: 20 }).notNull(), // 'generating', 'done'
    content: json('content').notNull(),
    metadata: json('metadata'),
    createdAt: datetime('created_at').$defaultFn(() => new Date()),
}, (table) => ({
    sessionIdIdx: index('session_id_idx').on(table.sessionId),
}));

// ==================== Relations ====================

export const usersRelations = relations(users, ({ one, many }) => ({
    settings: one(userSettings, {
        fields: [users.id],
        references: [userSettings.userId],
    }),
    checkIns: many(checkIns),
    sessions: many(notebookSessions),
    sources: many(sources),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
    user: one(users, {
        fields: [userSettings.userId],
        references: [users.id],
    }),
}));

export const checkInsRelations = relations(checkIns, ({ one }) => ({
    user: one(users, {
        fields: [checkIns.userId],
        references: [users.id],
    }),
}));

export const notebookSessionsRelations = relations(notebookSessions, ({ one, many }) => ({
    user: one(users, {
        fields: [notebookSessions.userId],
        references: [users.id],
    }),
    sources: many(sources),
    messages: many(chatMessages),
    notes: many(notes),
}));

export const sourcesRelations = relations(sources, ({ one }) => ({
    user: one(users, {
        fields: [sources.userId],
        references: [users.id],
    }),
    session: one(notebookSessions, {
        fields: [sources.sessionId],
        references: [notebookSessions.id],
    }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
    session: one(notebookSessions, {
        fields: [chatMessages.sessionId],
        references: [notebookSessions.id],
    }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
    session: one(notebookSessions, {
        fields: [notes.sessionId],
        references: [notebookSessions.id],
    }),
}));

// ==================== Types ====================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type UserSetting = typeof userSettings.$inferSelect;
export type NewUserSetting = typeof userSettings.$inferInsert;

export type CheckIn = typeof checkIns.$inferSelect;
export type NewCheckIn = typeof checkIns.$inferInsert;

export type NotebookSession = typeof notebookSessions.$inferSelect;
export type NewNotebookSession = typeof notebookSessions.$inferInsert;

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
