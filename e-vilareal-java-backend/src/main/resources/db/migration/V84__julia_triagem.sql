-- Resultado persistido da triagem da Júlia (uma linha por publicação quando vinculada).

CREATE TABLE julia_triagem (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    publicacao_id BIGINT NULL,
    processo_id BIGINT NULL,
    classificacao VARCHAR(120) NULL,
    impacto_cliente VARCHAR(20) NULL,
    prioridade VARCHAR(10) NULL,
    confianca DECIMAL(4, 3) NULL,
    payload_json LONGTEXT NOT NULL,
    modelo VARCHAR(60) NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_julia_triagem_publicacao (publicacao_id),
    CONSTRAINT fk_julia_triagem_publicacao FOREIGN KEY (publicacao_id) REFERENCES publicacoes (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_julia_triagem_processo FOREIGN KEY (processo_id) REFERENCES processo (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_julia_triagem_processo ON julia_triagem (processo_id);
