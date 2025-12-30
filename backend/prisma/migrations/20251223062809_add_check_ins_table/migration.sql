-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `check_ins` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `check_ins_user_id_idx`(`user_id`),
    UNIQUE INDEX `check_ins_user_id_date_key`(`user_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `api_key_encrypted` TEXT NULL,
    `api_url` VARCHAR(191) NOT NULL DEFAULT 'https://api.deepseek.com/chat/completions',
    `model` VARCHAR(191) NOT NULL DEFAULT 'deepseek-chat',

    UNIQUE INDEX `user_settings_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notebook_sessions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `preview` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `notebook_sessions_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sources` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `session_id` INTEGER NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sources_user_id_idx`(`user_id`),
    INDEX `sources_session_id_idx`(`session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_messages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_id` INTEGER NOT NULL,
    `role` VARCHAR(20) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `timestamp` BIGINT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chat_messages_session_id_idx`(`session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_id` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `content` JSON NOT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notes_session_id_idx`(`session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `check_ins` ADD CONSTRAINT `check_ins_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_settings` ADD CONSTRAINT `user_settings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notebook_sessions` ADD CONSTRAINT `notebook_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sources` ADD CONSTRAINT `sources_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sources` ADD CONSTRAINT `sources_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `notebook_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `notebook_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notes` ADD CONSTRAINT `notes_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `notebook_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
