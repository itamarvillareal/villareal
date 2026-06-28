-- Dados de locatário/contrato versionados por par Cod.+Proc. (nº planilha + código cliente + proc.)
-- IDEMPOTENTE: DDL MySQL não é transacional; falha parcial deixa colunas/índices criados sem registro Flyway.

SET @col := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'contrato_locacao'
      AND column_name = 'processo_id');
SET @ddl := IF(@col = 0,
    'ALTER TABLE contrato_locacao ADD COLUMN processo_id BIGINT NULL AFTER imovel_id, ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @fk := (SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'contrato_locacao'
      AND constraint_name = 'fk_contrato_locacao_processo' AND constraint_type = 'FOREIGN KEY');
SET @ddl := IF(@fk = 0,
    'ALTER TABLE contrato_locacao ADD CONSTRAINT fk_contrato_locacao_processo FOREIGN KEY (processo_id) REFERENCES processo (id)',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'contrato_locacao'
      AND index_name = 'idx_contrato_locacao_imovel_processo');
SET @ddl := IF(@idx = 0,
    'ALTER TABLE contrato_locacao ADD INDEX idx_contrato_locacao_imovel_processo (imovel_id, processo_id), ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

UPDATE contrato_locacao c
    JOIN imovel i ON i.id = c.imovel_id
    LEFT JOIN imovel_processo ip ON ip.imovel_id = i.id AND ip.ativo = TRUE
SET c.processo_id = COALESCE(ip.processo_id, i.processo_id)
WHERE c.processo_id IS NULL;

CREATE TABLE IF NOT EXISTS imovel_vinculo_locatario (
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
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'imovel_vinculo_locatario'
      AND index_name = 'idx_ivl_planilha');
SET @ddl := IF(@idx = 0,
    'CREATE INDEX idx_ivl_planilha ON imovel_vinculo_locatario (numero_planilha)',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
