CREATE TABLE publicacoes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    numero_processo_encontrado VARCHAR(32) NOT NULL,
    processo_id BIGINT NULL,
    cliente_id BIGINT NULL,
    usuario_responsavel_id BIGINT NULL,
    monitoring_hit_id BIGINT NULL,
    data_disponibilizacao DATE NULL,
    data_publicacao DATE NULL,
    fonte VARCHAR(120) NULL,
    diario VARCHAR(200) NULL,
    edicao VARCHAR(80) NULL,
    caderno VARCHAR(120) NULL,
    pagina VARCHAR(40) NULL,
    titulo VARCHAR(255) NULL,
    tipo_publicacao VARCHAR(80) NULL,
    resumo TEXT NULL,
    teor LONGTEXT NOT NULL,
    status_validacao_cnj VARCHAR(40) NULL,
    score_confianca VARCHAR(16) NULL,
    hash_teor VARCHAR(128) NOT NULL,
    hash_conteudo VARCHAR(128) NOT NULL,
    origem_importacao VARCHAR(40) NOT NULL DEFAULT 'MANUAL',
    arquivo_origem_nome VARCHAR(255) NULL,
    arquivo_origem_hash VARCHAR(128) NULL,
    json_referencia LONGTEXT NULL,
    status_tratamento VARCHAR(30) NOT NULL DEFAULT 'PENDENTE',
    lida BOOLEAN NOT NULL DEFAULT FALSE,
    lida_em TIMESTAMP NULL,
    tratada_em TIMESTAMP NULL,
    ignorada_em TIMESTAMP NULL,
    observacao TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_publicacoes_hash_conteudo UNIQUE (hash_conteudo),
    CONSTRAINT fk_publicacoes_processo FOREIGN KEY (processo_id) REFERENCES processos (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_publicacoes_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_publicacoes_usuario FOREIGN KEY (usuario_responsavel_id) REFERENCES usuarios (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_publicacoes_monitoring_hit FOREIGN KEY (monitoring_hit_id) REFERENCES monitoring_hits (id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX idx_publicacoes_numero_processo ON publicacoes (numero_processo_encontrado);
CREATE INDEX idx_publicacoes_data_publicacao ON publicacoes (data_publicacao);
CREATE INDEX idx_publicacoes_status_tratamento ON publicacoes (status_tratamento);
CREATE INDEX idx_publicacoes_origem_importacao ON publicacoes (origem_importacao);
CREATE INDEX idx_publicacoes_processo ON publicacoes (processo_id);
CREATE INDEX idx_publicacoes_cliente ON publicacoes (cliente_id);
CREATE INDEX idx_publicacoes_usuario ON publicacoes (usuario_responsavel_id);
CREATE INDEX idx_publicacoes_monitoring_hit ON publicacoes (monitoring_hit_id);
