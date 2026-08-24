-- AlterTable
ALTER TABLE `apps` ADD COLUMN `buildCmd` VARCHAR(191) NULL,
    ADD COLUMN `commandsPath` VARCHAR(191) NULL,
    ADD COLUMN `deployCommandsCmd` VARCHAR(191) NULL,
    ADD COLUMN `healthcheckUrl` VARCHAR(191) NULL,
    ADD COLUMN `migrateCmd` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `audit_log` MODIFY `action` ENUM('app_start', 'app_stop', 'app_restart', 'app_deploy', 'app_rollback') NOT NULL;

-- CreateTable
CREATE TABLE `deploy_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `appId` INTEGER NOT NULL,
    `appName` VARCHAR(191) NOT NULL,
    `triggeredBy` VARCHAR(191) NOT NULL,
    `mode` ENUM('update', 'rollback') NOT NULL,
    `fromCommit` VARCHAR(191) NULL,
    `toCommit` VARCHAR(191) NULL,
    `status` ENUM('running', 'success', 'failed') NOT NULL DEFAULT 'running',
    `stepsJson` TEXT NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
