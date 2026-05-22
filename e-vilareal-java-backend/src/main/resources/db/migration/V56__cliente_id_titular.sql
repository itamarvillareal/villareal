-- V56: cliente_id (FK cliente.id) separado de pessoa titular / pessoa_ref.
-- processo.pessoa_id e imovel.pessoa_id = titular/sujeito (permanecem).
-- financeiro_*: legado cliente_id → pessoa_ref_id; novo cliente_id → FK cliente.
-- Backfill: (1) match direto pessoa_id ativo, (2) LPAD codigo legado, (3) match direto sem filtro inativo.
-- Parte B (futuro): NOT NULL, drop legado, UK (cliente_id, numero_interno) — não aplicar aqui.

-- =============================================================================
-- PROCESSO
-- =============================================================================

ALTER TABLE processo
    ADD COLUMN cliente_id BIGINT NULL AFTER pessoa_id;

CREATE INDEX idx_processo_cliente ON processo (cliente_id);

UPDATE processo t
SET t.cliente_id = (
    SELECT MIN(c.id)
    FROM cliente c
    WHERE c.pessoa_id = t.pessoa_id
      AND c.inativo = FALSE
)
WHERE t.cliente_id IS NULL
  AND t.pessoa_id IS NOT NULL;

UPDATE processo t
SET t.cliente_id = (
    SELECT c.id
    FROM cliente c
    WHERE c.codigo_cliente = LPAD(t.pessoa_id, 8, '0')
    LIMIT 1
)
WHERE t.cliente_id IS NULL
  AND t.pessoa_id IS NOT NULL;

UPDATE processo t
SET t.cliente_id = (
    SELECT MIN(c.id)
    FROM cliente c
    WHERE c.pessoa_id = t.pessoa_id
)
WHERE t.cliente_id IS NULL
  AND t.pessoa_id IS NOT NULL;

ALTER TABLE processo
    ADD CONSTRAINT fk_processo_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id)
        ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- FINANCEIRO — lançamento bancário
-- =============================================================================

ALTER TABLE financeiro_lancamento
    DROP FOREIGN KEY fk_fl_cliente;

ALTER TABLE financeiro_lancamento
    CHANGE COLUMN cliente_id pessoa_ref_id BIGINT NULL;

DROP INDEX idx_fl_cliente ON financeiro_lancamento;

CREATE INDEX idx_fl_pessoa_ref ON financeiro_lancamento (pessoa_ref_id);

ALTER TABLE financeiro_lancamento
    ADD COLUMN cliente_id BIGINT NULL AFTER pessoa_ref_id;

UPDATE financeiro_lancamento t
SET t.cliente_id = (
    SELECT MIN(c.id)
    FROM cliente c
    WHERE c.pessoa_id = t.pessoa_ref_id
      AND c.inativo = FALSE
)
WHERE t.cliente_id IS NULL
  AND t.pessoa_ref_id IS NOT NULL;

UPDATE financeiro_lancamento t
SET t.cliente_id = (
    SELECT c.id
    FROM cliente c
    WHERE c.codigo_cliente = LPAD(t.pessoa_ref_id, 8, '0')
    LIMIT 1
)
WHERE t.cliente_id IS NULL
  AND t.pessoa_ref_id IS NOT NULL;

UPDATE financeiro_lancamento t
SET t.cliente_id = (
    SELECT MIN(c.id)
    FROM cliente c
    WHERE c.pessoa_id = t.pessoa_ref_id
)
WHERE t.cliente_id IS NULL
  AND t.pessoa_ref_id IS NOT NULL;

CREATE INDEX idx_fl_cliente ON financeiro_lancamento (cliente_id);

ALTER TABLE financeiro_lancamento
    ADD CONSTRAINT fk_fl_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id)
        ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX idx_lanc_cliente_fk_processo ON financeiro_lancamento (cliente_id, processo_id);

-- =============================================================================
-- FINANCEIRO — lançamento cartão
-- =============================================================================

ALTER TABLE financeiro_lancamento_cartao
    DROP FOREIGN KEY fk_flc_cliente;

ALTER TABLE financeiro_lancamento_cartao
    CHANGE COLUMN cliente_id pessoa_ref_id BIGINT NULL;

DROP INDEX idx_flc_cliente ON financeiro_lancamento_cartao;

CREATE INDEX idx_flc_pessoa_ref ON financeiro_lancamento_cartao (pessoa_ref_id);

ALTER TABLE financeiro_lancamento_cartao
    ADD COLUMN cliente_id BIGINT NULL AFTER pessoa_ref_id;

UPDATE financeiro_lancamento_cartao t
SET t.cliente_id = (
    SELECT MIN(c.id)
    FROM cliente c
    WHERE c.pessoa_id = t.pessoa_ref_id
      AND c.inativo = FALSE
)
WHERE t.cliente_id IS NULL
  AND t.pessoa_ref_id IS NOT NULL;

UPDATE financeiro_lancamento_cartao t
SET t.cliente_id = (
    SELECT c.id
    FROM cliente c
    WHERE c.codigo_cliente = LPAD(t.pessoa_ref_id, 8, '0')
    LIMIT 1
)
WHERE t.cliente_id IS NULL
  AND t.pessoa_ref_id IS NOT NULL;

UPDATE financeiro_lancamento_cartao t
SET t.cliente_id = (
    SELECT MIN(c.id)
    FROM cliente c
    WHERE c.pessoa_id = t.pessoa_ref_id
)
WHERE t.cliente_id IS NULL
  AND t.pessoa_ref_id IS NOT NULL;

CREATE INDEX idx_flc_cliente ON financeiro_lancamento_cartao (cliente_id);

ALTER TABLE financeiro_lancamento_cartao
    ADD CONSTRAINT fk_flc_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id)
        ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- FINANCEIRO — regra de classificação
-- =============================================================================

ALTER TABLE financeiro_regra_classificacao
    DROP FOREIGN KEY fk_frc_cliente;

ALTER TABLE financeiro_regra_classificacao
    CHANGE COLUMN cliente_id pessoa_ref_id BIGINT NULL;

ALTER TABLE financeiro_regra_classificacao
    ADD COLUMN cliente_id BIGINT NULL AFTER pessoa_ref_id;

UPDATE financeiro_regra_classificacao t
SET t.cliente_id = (
    SELECT MIN(c.id)
    FROM cliente c
    WHERE c.pessoa_id = t.pessoa_ref_id
      AND c.inativo = FALSE
)
WHERE t.cliente_id IS NULL
  AND t.pessoa_ref_id IS NOT NULL;

UPDATE financeiro_regra_classificacao t
SET t.cliente_id = (
    SELECT c.id
    FROM cliente c
    WHERE c.codigo_cliente = LPAD(t.pessoa_ref_id, 8, '0')
    LIMIT 1
)
WHERE t.cliente_id IS NULL
  AND t.pessoa_ref_id IS NOT NULL;

UPDATE financeiro_regra_classificacao t
SET t.cliente_id = (
    SELECT MIN(c.id)
    FROM cliente c
    WHERE c.pessoa_id = t.pessoa_ref_id
)
WHERE t.cliente_id IS NULL
  AND t.pessoa_ref_id IS NOT NULL;

ALTER TABLE financeiro_regra_classificacao
    ADD CONSTRAINT fk_frc_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id)
        ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- IMÓVEL
-- =============================================================================

ALTER TABLE imovel
    ADD COLUMN cliente_id BIGINT NULL AFTER pessoa_id;

CREATE INDEX idx_imovel_cliente ON imovel (cliente_id);

UPDATE imovel t
SET t.cliente_id = (
    SELECT MIN(c.id)
    FROM cliente c
    WHERE c.pessoa_id = t.pessoa_id
      AND c.inativo = FALSE
)
WHERE t.cliente_id IS NULL
  AND t.pessoa_id IS NOT NULL;

UPDATE imovel t
SET t.cliente_id = (
    SELECT c.id
    FROM cliente c
    WHERE c.codigo_cliente = LPAD(t.pessoa_id, 8, '0')
    LIMIT 1
)
WHERE t.cliente_id IS NULL
  AND t.pessoa_id IS NOT NULL;

UPDATE imovel t
SET t.cliente_id = (
    SELECT MIN(c.id)
    FROM cliente c
    WHERE c.pessoa_id = t.pessoa_id
)
WHERE t.cliente_id IS NULL
  AND t.pessoa_id IS NOT NULL;

UPDATE imovel i
INNER JOIN processo p ON p.id = i.processo_id
SET i.cliente_id = p.cliente_id
WHERE i.cliente_id IS NULL
  AND p.cliente_id IS NOT NULL;

ALTER TABLE imovel
    ADD CONSTRAINT fk_imovel_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id)
        ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- PUBLICAÇÕES (cliente_ref_id = pessoa titular legado)
-- =============================================================================

ALTER TABLE publicacoes
    ADD COLUMN cliente_id BIGINT NULL AFTER processo_id;

CREATE INDEX idx_publicacoes_cliente ON publicacoes (cliente_id);

UPDATE publicacoes pub
INNER JOIN processo p ON p.id = pub.processo_id
SET pub.cliente_id = p.cliente_id
WHERE pub.cliente_id IS NULL
  AND p.cliente_id IS NOT NULL;

UPDATE publicacoes t
SET t.cliente_id = (
    SELECT MIN(c.id)
    FROM cliente c
    WHERE c.pessoa_id = t.cliente_ref_id
      AND c.inativo = FALSE
)
WHERE t.cliente_id IS NULL
  AND t.cliente_ref_id IS NOT NULL;

UPDATE publicacoes t
SET t.cliente_id = (
    SELECT c.id
    FROM cliente c
    WHERE c.codigo_cliente = LPAD(t.cliente_ref_id, 8, '0')
    LIMIT 1
)
WHERE t.cliente_id IS NULL
  AND t.cliente_ref_id IS NOT NULL;

UPDATE publicacoes t
SET t.cliente_id = (
    SELECT MIN(c.id)
    FROM cliente c
    WHERE c.pessoa_id = t.cliente_ref_id
)
WHERE t.cliente_id IS NULL
  AND t.cliente_ref_id IS NOT NULL;

ALTER TABLE publicacoes
    ADD CONSTRAINT fk_publicacoes_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id)
        ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- TAREFA OPERACIONAL (cliente_id legado = pessoa.id → PK cliente)
-- =============================================================================

UPDATE tarefa_operacional t
SET t.cliente_id = (
    SELECT MIN(c.id)
    FROM cliente c
    WHERE c.pessoa_id = t.cliente_id
      AND c.inativo = FALSE
)
WHERE t.cliente_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM cliente c0 WHERE c0.id = t.cliente_id);

UPDATE tarefa_operacional t
SET t.cliente_id = (
    SELECT c.id
    FROM cliente c
    WHERE c.codigo_cliente = LPAD(t.cliente_id, 8, '0')
    LIMIT 1
)
WHERE t.cliente_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM cliente c0 WHERE c0.id = t.cliente_id);

UPDATE tarefa_operacional t
SET t.cliente_id = (
    SELECT MIN(c.id)
    FROM cliente c
    WHERE c.pessoa_id = t.cliente_id
)
WHERE t.cliente_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM cliente c0 WHERE c0.id = t.cliente_id);

UPDATE tarefa_operacional t
SET t.cliente_id = NULL
WHERE t.cliente_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM cliente c WHERE c.id = t.cliente_id);

ALTER TABLE tarefa_operacional
    ADD CONSTRAINT fk_tarefa_operacional_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id)
        ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- Log de órfãos (registros sem cliente_id após backfill)
-- =============================================================================

CREATE TABLE IF NOT EXISTS migracao_cliente_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    entidade VARCHAR(64) NOT NULL,
    registro_id BIGINT NOT NULL,
    pessoa_id BIGINT NULL,
    motivo VARCHAR(64) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_migracao_cliente_log_entidade (entidade),
    INDEX idx_migracao_cliente_log_motivo (motivo)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO migracao_cliente_log (entidade, registro_id, pessoa_id, motivo)
SELECT 'processo', p.id, p.pessoa_id, 'sem_cliente_para_pessoa'
FROM processo p
WHERE p.cliente_id IS NULL;

INSERT INTO migracao_cliente_log (entidade, registro_id, pessoa_id, motivo)
SELECT 'imovel', i.id, i.pessoa_id, 'sem_cliente_para_pessoa'
FROM imovel i
WHERE i.cliente_id IS NULL
  AND i.pessoa_id IS NOT NULL;

INSERT INTO migracao_cliente_log (entidade, registro_id, pessoa_id, motivo)
SELECT 'financeiro_lancamento', fl.id, fl.pessoa_ref_id, 'sem_cliente_para_pessoa'
FROM financeiro_lancamento fl
WHERE fl.pessoa_ref_id IS NOT NULL
  AND fl.cliente_id IS NULL;

INSERT INTO migracao_cliente_log (entidade, registro_id, pessoa_id, motivo)
SELECT 'financeiro_lancamento_cartao', flc.id, flc.pessoa_ref_id, 'sem_cliente_para_pessoa'
FROM financeiro_lancamento_cartao flc
WHERE flc.pessoa_ref_id IS NOT NULL
  AND flc.cliente_id IS NULL;

INSERT INTO migracao_cliente_log (entidade, registro_id, pessoa_id, motivo)
SELECT 'financeiro_regra_classificacao', r.id, r.pessoa_ref_id, 'sem_cliente_para_pessoa'
FROM financeiro_regra_classificacao r
WHERE r.pessoa_ref_id IS NOT NULL
  AND r.cliente_id IS NULL;

INSERT INTO migracao_cliente_log (entidade, registro_id, pessoa_id, motivo)
SELECT 'publicacoes', pub.id, pub.cliente_ref_id, 'sem_cliente_para_pessoa'
FROM publicacoes pub
WHERE pub.cliente_id IS NULL
  AND (pub.cliente_ref_id IS NOT NULL OR pub.processo_id IS NOT NULL);

-- Validação manual pós-migrate (banco limpo):
-- SELECT COUNT(*) FROM processo WHERE pessoa_id IS NOT NULL AND cliente_id IS NULL;
-- SELECT COUNT(*) FROM financeiro_lancamento WHERE pessoa_ref_id IS NOT NULL AND cliente_id IS NULL;
-- SELECT COUNT(*) FROM migracao_cliente_log;
