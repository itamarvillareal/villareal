ALTER TABLE processo_parte
    ADD COLUMN pessoa_endereco_id BIGINT NULL;

ALTER TABLE processo_parte
    ADD CONSTRAINT fk_processo_parte_pessoa_endereco
        FOREIGN KEY (pessoa_endereco_id) REFERENCES pessoa_endereco (id) ON DELETE SET NULL;

CREATE INDEX idx_processo_parte_pessoa_endereco ON processo_parte (pessoa_endereco_id);
