CREATE TABLE cobranca_execucao (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    importacao_id VARCHAR(36) NOT NULL,
    criado_em TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    cliente_codigo CHAR(8) NOT NULL,
    total_titulos INT NOT NULL DEFAULT 0,
    total_inseridos INT NOT NULL DEFAULT 0,
    total_ignorados INT NOT NULL DEFAULT 0,
    total_falhados INT NOT NULL DEFAULT 0,
    processos_criados INT NOT NULL DEFAULT 0,
    revisoes_troca_dono INT NOT NULL DEFAULT 0,
    relatorio_json LONGTEXT NOT NULL,
    UNIQUE KEY uk_cobranca_execucao_importacao (importacao_id),
    INDEX idx_cobranca_execucao_cliente_criado (cliente_codigo, criado_em DESC)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
