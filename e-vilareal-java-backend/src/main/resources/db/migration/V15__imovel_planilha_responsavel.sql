-- Número do imóvel na planilha (col. A) + pessoa proprietária/responsável (col. D).

ALTER TABLE imovel
    ADD COLUMN numero_planilha INT NULL AFTER processo_id,
    ADD COLUMN responsavel_pessoa_id BIGINT NULL AFTER numero_planilha;

CREATE UNIQUE INDEX uk_imovel_numero_planilha ON imovel (numero_planilha);

ALTER TABLE imovel
    ADD CONSTRAINT fk_imovel_responsavel_pessoa FOREIGN KEY (responsavel_pessoa_id) REFERENCES pessoa (id)
        ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX idx_imovel_responsavel_pessoa ON imovel (responsavel_pessoa_id);
