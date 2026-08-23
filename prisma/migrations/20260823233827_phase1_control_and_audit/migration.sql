-- AlterTable
ALTER TABLE `apps` ADD COLUMN `logPath` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `audit_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actorEmail` VARCHAR(191) NOT NULL,
    `action` ENUM('app_start', 'app_stop', 'app_restart') NOT NULL,
    `appId` INTEGER NULL,
    `appName` VARCHAR(191) NOT NULL,
    `success` BOOLEAN NOT NULL,
    `detail` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
