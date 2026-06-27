-- Dados de locatário/contrato versionados por par Cod.+Proc. (nº planilha + código cliente + proc.)
ALTER TABLE contrato_locacao
    ADD COLUMN processo_id BIGINT NULL AFTER imovel_id,
    ADD CONSTRAINT fk_contrato_locacao_processo FOREIGN KEY (processo_id) REFERENCES processo (id);

CREATE INDEX idx_contrato_locacao_imovel_processo ON contrato_locacao (imovel_id, processo_id);

UPDATE contrato_locacao c
    JOIN imovel i ON i.id = c.imovel_id
    LEFT JOIN imovel_processo ip ON ip.imovel_id = i.id AND ip.ativo = TRUE
SET c.processo_id = COALESCE(ip.processo_id, i.processo_id)
WHERE c.processo_id IS NULL;

CREATE TABLE imovel_vinculo_locatario (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    numero_planilha INT NOT NULL,
    codigo_cliente CHAR(8) NOT NULL,
    numero_interno INT NOT NULL,
    processo_id BIGINT NULL,
    campos_extras_json TEXT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uk_ivl_planilha_cod_proc UNIQUE (numero_planilha, codigo_cliente, numero_interno),
    CONSTRAINT fk_ivl_processo FOREIGN KEY (processo_id) REFERENCES processo (id)
);

CREATE INDEX idx_ivl_planilha ON imovel_vinculo_locatario (numero_planilha);
