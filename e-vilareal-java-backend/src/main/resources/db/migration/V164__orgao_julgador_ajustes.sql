-- Busca acento-insensível em órgãos (nome_normalizado) + campos de auditoria.
-- IDEMPOTENTE: guardas information_schema (mesmo padrão da V161). Sem NOT NULL destrutivo.

-- orgao_julgador.nome_normalizado + índice (espelha o que já funciona em municipio)
SET @col := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orgao_julgador'
      AND column_name = 'nome_normalizado');
SET @ddl := IF(@col = 0,
    'ALTER TABLE orgao_julgador ADD COLUMN nome_normalizado VARCHAR(255) NULL AFTER nome, ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'orgao_julgador'
      AND index_name = 'idx_orgao_julgador_nome_normalizado');
SET @ddl := IF(@idx = 0,
    'CREATE INDEX idx_orgao_julgador_nome_normalizado ON orgao_julgador (nome_normalizado)',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- orgao_julgador.fonte (origem do registro: DATAJUD / FALLBACK_JSON)
SET @col := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orgao_julgador'
      AND column_name = 'fonte');
SET @ddl := IF(@col = 0,
    'ALTER TABLE orgao_julgador ADD COLUMN fonte VARCHAR(20) NULL AFTER ativo, ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- orgao_julgador.criado_em / atualizado_em (gerenciados pelo banco; mantém synced_at existente)
SET @col := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orgao_julgador'
      AND column_name = 'criado_em');
SET @ddl := IF(@col = 0,
    'ALTER TABLE orgao_julgador ADD COLUMN criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER synced_at',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orgao_julgador'
      AND column_name = 'atualizado_em');
SET @ddl := IF(@col = 0,
    'ALTER TABLE orgao_julgador ADD COLUMN atualizado_em DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER criado_em',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- tribunal.ultima_sincronizacao (carimbado ao fim de sync bem-sucedida)
SET @col := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'tribunal'
      AND column_name = 'ultima_sincronizacao');
SET @ddl := IF(@col = 0,
    'ALTER TABLE tribunal ADD COLUMN ultima_sincronizacao DATETIME NULL AFTER ativo, ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
