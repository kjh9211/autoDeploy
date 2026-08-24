-- AlterTable
ALTER TABLE `audit_log` MODIFY `action` ENUM('app_start', 'app_stop', 'app_restart', 'app_deploy', 'app_rollback', 'proxy_route_change', 'proxy_certs_reload', 'dns_record_change') NOT NULL;
