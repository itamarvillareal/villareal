-- Etapas 5/5b da CONTA ZERO — ferramentas de fluxo de trabalho do acerto:
--   (a) marcação de conferência persistente por lançamento (o "OK" da planilha antiga),
--       com usuário e data; a conferência do processo é derivada (todos os lançamentos
--       conferidos) — lançamento novo em proc conferido volta pendente automaticamente;
--   (b) Ficha do Acerto por cliente (acerto_cliente_config): regras do acordo — percentual
--       de repasse, observações de parcelas internas. Mensalidade NÃO é duplicada aqui:
--       referencia-se o cadastro mensalista;
--   (c) entidade Acerto (acerto_fechamento): o fechamento como evento — cliente, período,
--       saldo final, status RASCUNHO → FECHADO, PDF arquivado (padrão prestação de contas)
--       e vínculo com os grupos de compensação (acerto_fechamento_grupo).
--
-- IDEMPOTÊNCIA: colunas guardadas via information_schema (padrão V203); tabelas com
-- CREATE TABLE IF NOT EXISTS.
--
-- Rollback:
--   ALTER TABLE financeiro_lancamento DROP COLUMN conferido_em, DROP COLUMN conferido_por_usuario_id;
--   DROP TABLE acerto_fechamento_grupo; DROP TABLE acerto_fechamento; DROP TABLE acerto_cliente_config;

-- (a) conferência por lançamento
SET @col := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'financeiro_lancamento'
      AND column_name = 'conferido_em');
SET @ddl := IF(@col = 0,
    'ALTER TABLE financeiro_lancamento ADD COLUMN conferido_em DATETIME NULL',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'financeiro_lancamento'
      AND column_name = 'conferido_por_usuario_id');
SET @ddl := IF(@col = 0,
    'ALTER TABLE financeiro_lancamento ADD COLUMN conferido_por_usuario_id BIGINT NULL',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @fk := (SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'financeiro_lancamento'
      AND constraint_name = 'fk_fin_lanc_conferido_por');
SET @ddl := IF(@fk = 0,
    'ALTER TABLE financeiro_lancamento ADD CONSTRAINT fk_fin_lanc_conferido_por FOREIGN KEY (conferido_por_usuario_id) REFERENCES usuarios (id)',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- (b) Ficha do Acerto por cliente
CREATE TABLE IF NOT EXISTS acerto_cliente_config (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    cliente_id BIGINT NOT NULL,
    percentual_repasse DECIMAL(5,2) NULL,
    observacoes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_acerto_cliente_config_cliente UNIQUE (cliente_id),
    CONSTRAINT fk_acerto_cliente_config_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- (c) Acerto como evento de fechamento
CREATE TABLE IF NOT EXISTS acerto_fechamento (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    cliente_id BIGINT NOT NULL,
    numero_banco INT NOT NULL,
    periodo_inicio DATE NULL,
    periodo_fim DATE NULL,
    data_fechamento DATETIME NULL,
    saldo_final DECIMAL(19,2) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RASCUNHO',
    arquivo_pdf_path VARCHAR(500) NULL,
    observacoes TEXT NULL,
    criado_por_usuario_id BIGINT NULL,
    fechado_por_usuario_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_acerto_fechamento_cliente (cliente_id, numero_banco, status),
    CONSTRAINT fk_acerto_fechamento_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id),
    CONSTRAINT fk_acerto_fechamento_criado_por FOREIGN KEY (criado_por_usuario_id) REFERENCES usuarios (id),
    CONSTRAINT fk_acerto_fechamento_fechado_por FOREIGN KEY (fechado_por_usuario_id) REFERENCES usuarios (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS acerto_fechamento_grupo (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    acerto_fechamento_id BIGINT NOT NULL,
    grupo_compensacao VARCHAR(40) NOT NULL,
    CONSTRAINT uk_acerto_fech_grupo UNIQUE (acerto_fechamento_id, grupo_compensacao),
    CONSTRAINT fk_acerto_fech_grupo_acerto FOREIGN KEY (acerto_fechamento_id)
        REFERENCES acerto_fechamento (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
