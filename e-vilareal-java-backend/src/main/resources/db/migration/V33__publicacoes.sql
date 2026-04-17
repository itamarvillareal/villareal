-- Publicações importadas (PDF/DataJud/monitoramento) — paridade com `publicacoesRepository.js` / fase 6.
CREATE TABLE publicacoes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    numero_processo_encontrado VARCHAR(120) NOT NULL,
    processo_id BIGINT NULL,
    cliente_ref_id BIGINT NULL,
    data_disponibilizacao DATE NULL,
    data_publicacao DATE NULL,
    fonte VARCHAR(120) NULL,
    diario VARCHAR(200) NULL,
    titulo VARCHAR(255) NULL,
    tipo_publicacao VARCHAR(80) NULL,
    resumo TEXT NULL,
    teor LONGTEXT NOT NULL,
    status_validacao_cnj VARCHAR(40) NULL,
    score_confianca VARCHAR(16) NULL,
    hash_teor VARCHAR(128) NOT NULL DEFAULT '',
    hash_conteudo VARCHAR(128) NOT NULL,
    origem_importacao VARCHAR(40) NOT NULL DEFAULT 'MANUAL',
    arquivo_origem_nome VARCHAR(255) NULL,
    arquivo_origem_hash VARCHAR(128) NULL,
    json_referencia LONGTEXT NULL,
    status_tratamento VARCHAR(30) NOT NULL DEFAULT 'PENDENTE',
    lida TINYINT(1) NOT NULL DEFAULT 0,
    observacao TEXT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_publicacoes_hash_conteudo (hash_conteudo),
    CONSTRAINT fk_publicacoes_processo FOREIGN KEY (processo_id) REFERENCES processo (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_publicacoes_data_pub ON publicacoes (data_publicacao);
CREATE INDEX idx_publicacoes_status ON publicacoes (status_tratamento);
CREATE INDEX idx_publicacoes_processo ON publicacoes (processo_id);
CREATE INDEX idx_publicacoes_cliente_ref ON publicacoes (cliente_ref_id);
CREATE INDEX idx_publicacoes_origem ON publicacoes (origem_importacao);
