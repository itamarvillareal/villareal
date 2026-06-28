-- Catálogo IBGE (UF + município) e FKs nullable — sem NOT NULL destrutivo nesta entrega.
-- IDEMPOTENTE: guardas information_schema (mesmo padrão de V116/V160).

CREATE TABLE IF NOT EXISTS estado (
    id INT NOT NULL PRIMARY KEY COMMENT 'Código IBGE da UF (2 dígitos)',
    sigla CHAR(2) NOT NULL,
    nome VARCHAR(120) NOT NULL,
    CONSTRAINT uk_estado_sigla UNIQUE (sigla)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS municipio (
    id INT NOT NULL PRIMARY KEY COMMENT 'Código IBGE do município (7 dígitos)',
    nome VARCHAR(120) NOT NULL,
    nome_normalizado VARCHAR(120) NOT NULL,
    uf_id INT NOT NULL,
    favorito BOOLEAN NOT NULL DEFAULT FALSE,
    uso_count INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_municipio_uf FOREIGN KEY (uf_id) REFERENCES estado (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'municipio'
      AND index_name = 'idx_municipio_uf');
SET @ddl := IF(@idx = 0,
    'CREATE INDEX idx_municipio_uf ON municipio (uf_id)',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'municipio'
      AND index_name = 'idx_municipio_nome_normalizado');
SET @ddl := IF(@idx = 0,
    'CREATE INDEX idx_municipio_nome_normalizado ON municipio (nome_normalizado)',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'pessoa_endereco'
      AND column_name = 'municipio_id');
SET @ddl := IF(@col = 0,
    'ALTER TABLE pessoa_endereco ADD COLUMN municipio_id INT NULL AFTER cidade, ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'pessoa_endereco'
      AND column_name = 'cidade_legado');
SET @ddl := IF(@col = 0,
    'ALTER TABLE pessoa_endereco ADD COLUMN cidade_legado VARCHAR(120) NULL AFTER municipio_id, ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @fk := (SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'pessoa_endereco'
      AND constraint_name = 'fk_pessoa_endereco_municipio' AND constraint_type = 'FOREIGN KEY');
SET @ddl := IF(@fk = 0,
    'ALTER TABLE pessoa_endereco ADD CONSTRAINT fk_pessoa_endereco_municipio FOREIGN KEY (municipio_id) REFERENCES municipio (id) ON DELETE SET NULL ON UPDATE CASCADE',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'pessoa_endereco'
      AND index_name = 'idx_pessoa_endereco_municipio');
SET @ddl := IF(@idx = 0,
    'ALTER TABLE pessoa_endereco ADD INDEX idx_pessoa_endereco_municipio (municipio_id), ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'processo'
      AND column_name = 'municipio_id');
SET @ddl := IF(@col = 0,
    'ALTER TABLE processo ADD COLUMN municipio_id INT NULL AFTER cidade, ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'processo'
      AND column_name = 'cidade_legado');
SET @ddl := IF(@col = 0,
    'ALTER TABLE processo ADD COLUMN cidade_legado VARCHAR(120) NULL AFTER municipio_id, ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @fk := (SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'processo'
      AND constraint_name = 'fk_processo_municipio' AND constraint_type = 'FOREIGN KEY');
SET @ddl := IF(@fk = 0,
    'ALTER TABLE processo ADD CONSTRAINT fk_processo_municipio FOREIGN KEY (municipio_id) REFERENCES municipio (id) ON DELETE SET NULL ON UPDATE CASCADE',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'processo'
      AND index_name = 'idx_processo_municipio');
SET @ddl := IF(@idx = 0,
    'ALTER TABLE processo ADD INDEX idx_processo_municipio (municipio_id), ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'imovel'
      AND column_name = 'municipio_id');
SET @ddl := IF(@col = 0,
    'ALTER TABLE imovel ADD COLUMN municipio_id INT NULL AFTER endereco_completo, ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @fk := (SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'imovel'
      AND constraint_name = 'fk_imovel_municipio' AND constraint_type = 'FOREIGN KEY');
SET @ddl := IF(@fk = 0,
    'ALTER TABLE imovel ADD CONSTRAINT fk_imovel_municipio FOREIGN KEY (municipio_id) REFERENCES municipio (id) ON DELETE SET NULL ON UPDATE CASCADE',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'imovel'
      AND index_name = 'idx_imovel_municipio');
SET @ddl := IF(@idx = 0,
    'ALTER TABLE imovel ADD INDEX idx_imovel_municipio (municipio_id), ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
