-- Módulo Monitoramento de Pessoas (DataJud / CNJ)
ALTER TABLE cadastro_pessoas
    ADD COLUMN marcado_monitoramento BOOLEAN NOT NULL DEFAULT FALSE
        COMMENT 'Marcado em outro módulo para inclusão/vínculo ao monitoramento CNJ';

CREATE TABLE monitored_people (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    person_id BIGINT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    monitor_mode VARCHAR(40) NOT NULL DEFAULT 'HYBRID',
    global_frequency_type VARCHAR(32) NOT NULL DEFAULT 'HOURS_6',
    global_frequency_value INT NULL,
    preferred_tribunals_json JSON NULL,
    monitor_by_name BOOLEAN NOT NULL DEFAULT FALSE,
    monitor_by_cpf_cnpj BOOLEAN NOT NULL DEFAULT FALSE,
    monitor_by_known_processes BOOLEAN NOT NULL DEFAULT TRUE,
    last_run_at TIMESTAMP NULL,
    next_run_at TIMESTAMP NULL,
    last_status VARCHAR(128) NULL,
    confidence_policy VARCHAR(32) NOT NULL DEFAULT 'STANDARD',
    execution_lock_until TIMESTAMP NULL,
    recent_failure_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(64) NULL,
    updated_by VARCHAR(64) NULL,
    CONSTRAINT fk_monitored_people_person FOREIGN KEY (person_id) REFERENCES cadastro_pessoas (id),
    CONSTRAINT uk_monitored_people_person UNIQUE (person_id)
);

CREATE INDEX idx_monitored_people_schedule ON monitored_people (enabled, next_run_at);

CREATE TABLE monitored_people_search_keys (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    monitored_person_id BIGINT NOT NULL,
    key_type VARCHAR(32) NOT NULL,
    key_value VARCHAR(512) NOT NULL,
    normalized_value VARCHAR(512) NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    priority INT NOT NULL DEFAULT 0,
    notes VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_mpsk_monitored FOREIGN KEY (monitored_person_id) REFERENCES monitored_people (id) ON DELETE CASCADE
);

CREATE INDEX idx_mpsk_person ON monitored_people_search_keys (monitored_person_id, enabled, priority);

CREATE TABLE monitoring_runs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    monitored_person_id BIGINT NOT NULL,
    started_at TIMESTAMP NOT NULL,
    finished_at TIMESTAMP NULL,
    status VARCHAR(32) NOT NULL,
    trigger_type VARCHAR(32) NOT NULL,
    tribunal_alias VARCHAR(128) NULL,
    query_strategy VARCHAR(64) NULL,
    request_payload LONGTEXT NULL,
    response_summary LONGTEXT NULL,
    total_hits INT NOT NULL DEFAULT 0,
    new_hits INT NOT NULL DEFAULT 0,
    updated_hits INT NOT NULL DEFAULT 0,
    duplicates_skipped INT NOT NULL DEFAULT 0,
    error_message LONGTEXT NULL,
    duration_ms BIGINT NULL,
    limitation_note VARCHAR(512) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mrun_person FOREIGN KEY (monitored_person_id) REFERENCES monitored_people (id) ON DELETE CASCADE
);

CREATE INDEX idx_mrun_person_started ON monitoring_runs (monitored_person_id, started_at DESC);

CREATE TABLE monitoring_hits (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    monitored_person_id BIGINT NOT NULL,
    monitoring_run_id BIGINT NOT NULL,
    tribunal VARCHAR(64) NOT NULL,
    process_number VARCHAR(64) NOT NULL,
    process_number_normalized VARCHAR(64) NOT NULL,
    hit_type VARCHAR(64) NOT NULL,
    source_strategy VARCHAR(64) NOT NULL,
    class_name VARCHAR(255) NULL,
    subject_names LONGTEXT NULL,
    court_unit_name VARCHAR(512) NULL,
    filing_date VARCHAR(64) NULL,
    secrecy_level VARCHAR(64) NULL,
    last_movement_name LONGTEXT NULL,
    last_movement_at VARCHAR(64) NULL,
    match_score VARCHAR(16) NOT NULL,
    match_reason VARCHAR(512) NOT NULL,
    raw_payload_json LONGTEXT NULL,
    dedup_hash VARCHAR(128) NOT NULL,
    review_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    suggested_link_note VARCHAR(512) NULL,
    linked_process_id BIGINT NULL,
    linked_client_id BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_mhit_person FOREIGN KEY (monitored_person_id) REFERENCES monitored_people (id) ON DELETE CASCADE,
    CONSTRAINT fk_mhit_run FOREIGN KEY (monitoring_run_id) REFERENCES monitoring_runs (id) ON DELETE CASCADE
);

CREATE INDEX idx_mhit_person_review ON monitoring_hits (monitored_person_id, review_status);
CREATE INDEX idx_mhit_dedup ON monitoring_hits (dedup_hash);

CREATE TABLE monitoring_settings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    scheduler_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    default_frequency_type VARCHAR(32) NOT NULL DEFAULT 'HOURS_6',
    default_frequency_value INT NULL,
    batch_size INT NOT NULL DEFAULT 5,
    retry_limit INT NOT NULL DEFAULT 3,
    request_timeout_ms INT NOT NULL DEFAULT 28000,
    cache_ttl_minutes INT NOT NULL DEFAULT 60,
    tribunal_rate_limits_json JSON NULL,
    strategy_flags_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO monitoring_settings (
    id, scheduler_enabled, default_frequency_type, batch_size, retry_limit, request_timeout_ms, cache_ttl_minutes
) VALUES (1, TRUE, 'HOURS_6', 5, 3, 28000, 60);
