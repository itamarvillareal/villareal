ALTER TABLE pessoa_endereco
    ADD COLUMN origem VARCHAR(30) NULL AFTER auto_preenchido,
    ADD COLUMN data_origem DATE NULL AFTER origem,
    ADD COLUMN criado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER data_origem,
    ADD COLUMN atualizado_em DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3) AFTER criado_em;

CREATE INDEX idx_pessoa_endereco_dedup ON pessoa_endereco (pessoa_id, cep);
