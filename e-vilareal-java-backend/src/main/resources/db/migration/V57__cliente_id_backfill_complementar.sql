-- V57: backfill complementar de cliente_id (padrão B — titular = pessoa do cliente, código diferente).
-- V56 cobriu padrão A (codigo_cliente = LPAD(pessoa_id titular, 8, '0')).

-- =============================================================================
-- Bloco 1 — Processo (fallback por pessoa_id)
-- =============================================================================

UPDATE processo p
SET p.cliente_id = (
    SELECT MIN(c.id)
    FROM cliente c
    WHERE c.pessoa_id = p.pessoa_id
      AND c.inativo = FALSE
)
WHERE p.cliente_id IS NULL;

UPDATE processo p
SET p.cliente_id = (
    SELECT MIN(c.id)
    FROM cliente c
    WHERE c.pessoa_id = p.pessoa_id
)
WHERE p.cliente_id IS NULL;

-- =============================================================================
-- Bloco 2 — Financeiro lançamento (LPAD → pessoa ativo → pessoa qualquer)
-- =============================================================================

UPDATE financeiro_lancamento fl
SET fl.cliente_id = (
    SELECT c.id
    FROM cliente c
    WHERE c.codigo_cliente = LPAD(fl.pessoa_ref_id, 8, '0')
    LIMIT 1
)
WHERE fl.pessoa_ref_id IS NOT NULL
  AND fl.cliente_id IS NULL;

UPDATE financeiro_lancamento fl
SET fl.cliente_id = (
    SELECT MIN(c.id)
    FROM cliente c
    WHERE c.pessoa_id = fl.pessoa_ref_id
      AND c.inativo = FALSE
)
WHERE fl.pessoa_ref_id IS NOT NULL
  AND fl.cliente_id IS NULL;

UPDATE financeiro_lancamento fl
SET fl.cliente_id = (
    SELECT MIN(c.id)
    FROM cliente c
    WHERE c.pessoa_id = fl.pessoa_ref_id
)
WHERE fl.pessoa_ref_id IS NOT NULL
  AND fl.cliente_id IS NULL;

-- =============================================================================
-- Bloco 3 — Log de órfãos restantes
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
SELECT 'financeiro_lancamento', fl.id, fl.pessoa_ref_id, 'sem_cliente_para_pessoa'
FROM financeiro_lancamento fl
WHERE fl.pessoa_ref_id IS NOT NULL
  AND fl.cliente_id IS NULL;

-- =============================================================================
-- Bloco 4 — Validação inline (executar manualmente após migrate)
-- =============================================================================
-- Esperado pós-V57:
-- SELECT COUNT(*) FROM processo WHERE cliente_id IS NULL;  → 0
-- SELECT COUNT(*) FROM financeiro_lancamento WHERE pessoa_ref_id IS NOT NULL AND cliente_id IS NULL;  → 0
