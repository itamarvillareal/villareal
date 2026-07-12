-- Etapa 5c: corte manual do histórico pré-sistema (ex.: SE77E acerto até 10/01/2024).
SET @col := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'acerto_cliente_config'
      AND column_name = 'data_ultimo_acerto_conhecido');
SET @ddl := IF(@col = 0,
    'ALTER TABLE acerto_cliente_config ADD COLUMN data_ultimo_acerto_conhecido DATE NULL '
        + 'COMMENT ''Último acerto conhecido (corte manual): lançamentos até esta data formam bloco FECHADO_MANUAL''',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
