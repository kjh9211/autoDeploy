-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `totpSecret` VARCHAR(191) NOT NULL,
    `role` ENUM('admin', 'viewer') NOT NULL DEFAULT 'admin',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `apps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('node_app', 'static_web', 'discord_bot', 'minecraft') NOT NULL,
    `runtime` ENUM('pm2', 'nssm') NOT NULL,
    `pm2Name` VARCHAR(191) NULL,
    `nssmService` VARCHAR(191) NULL,
    `localPath` VARCHAR(191) NULL,
    `branch` VARCHAR(191) NULL,
    `domain` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `apps_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
