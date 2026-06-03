-- Histórico de execuções de jobs agendados (cron / pipeline).

CREATE TABLE job_run (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    job_name VARCHAR(80) NOT NULL,
    status VARCHAR(20) NOT NULL,
    started_at TIMESTAMP(6) NOT NULL,
    finished_at TIMESTAMP(6) NULL,
    duration_ms BIGINT NULL,
    heartbeat_at TIMESTAMP(6) NULL,
    items_processed INT NOT NULL DEFAULT 0,
    items_failed INT NOT NULL DEFAULT 0,
    error_message VARCHAR(2000) NULL,
    error_stack LONGTEXT NULL,
    metadata_json JSON NULL,
    host_instance VARCHAR(120) NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_job_run_job_started (job_name, started_at DESC),
    INDEX idx_job_run_status_started (status, started_at DESC),
    INDEX idx_job_run_running_heartbeat (status, heartbeat_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
