-- Log de deduplicação processo (cliente_id, numero_interno) para auditoria em execuções futuras.
-- A V65 não gravou log; esta tabela serve apenas dedups posteriores.

CREATE TABLE IF NOT EXISTS proc_dedup_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    drop_id BIGINT NOT NULL,
    keep_id BIGINT NOT NULL,
    cliente_id BIGINT NOT NULL,
    numero_interno INT NOT NULL,
    drop_pessoa_id BIGINT NULL,
    keep_pessoa_id BIGINT NULL,
    executado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_proc_dedup_log_cliente (cliente_id, numero_interno)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
