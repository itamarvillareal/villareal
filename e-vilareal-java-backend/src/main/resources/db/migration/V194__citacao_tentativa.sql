CREATE TABLE citacao_tentativa (
    id BIGINT NOT NULL AUTO_INCREMENT,
    processo_parte_id BIGINT NOT NULL,
    pessoa_endereco_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,

    data_solicitacao DATE NULL,
    andamento_solicitacao_id BIGINT NULL,
    mov_projudi_solicitacao VARCHAR(20) NULL,
    mov_monitorada_solicitacao_id BIGINT NULL,

    data_retorno DATE NULL,
    andamento_retorno_id BIGINT NULL,
    mov_projudi_retorno VARCHAR(20) NULL,
    mov_monitorada_retorno_id BIGINT NULL,

    motivo_retorno TEXT NULL,
    observacao TEXT NULL,

    usuario_id BIGINT NULL,
    criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    atualizado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),
    UNIQUE KEY uk_citacao_parte_endereco (processo_parte_id, pessoa_endereco_id),
    KEY idx_citacao_parte (processo_parte_id),
    KEY idx_citacao_endereco (pessoa_endereco_id),
    KEY idx_citacao_status (status),

    CONSTRAINT fk_citacao_processo_parte
        FOREIGN KEY (processo_parte_id) REFERENCES processo_parte (id) ON DELETE CASCADE,
    CONSTRAINT fk_citacao_pessoa_endereco
        FOREIGN KEY (pessoa_endereco_id) REFERENCES pessoa_endereco (id) ON DELETE RESTRICT,
    CONSTRAINT fk_citacao_andamento_solic
        FOREIGN KEY (andamento_solicitacao_id) REFERENCES processo_andamento (id) ON DELETE SET NULL,
    CONSTRAINT fk_citacao_andamento_retorno
        FOREIGN KEY (andamento_retorno_id) REFERENCES processo_andamento (id) ON DELETE SET NULL,
    CONSTRAINT fk_citacao_movmon_solic
        FOREIGN KEY (mov_monitorada_solicitacao_id) REFERENCES movimentacao_monitorada (id) ON DELETE SET NULL,
    CONSTRAINT fk_citacao_movmon_retorno
        FOREIGN KEY (mov_monitorada_retorno_id) REFERENCES movimentacao_monitorada (id) ON DELETE SET NULL,
    CONSTRAINT fk_citacao_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
