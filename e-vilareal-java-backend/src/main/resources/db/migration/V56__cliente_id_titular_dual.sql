-- V56: modelo dual titular (pessoa) × cliente (FK cliente.id).
-- processo.pessoa_id = titular do processo (permanece). cliente do processo = codigo LPAD(titular).
-- Fase 5 (futuro): UK (cliente_id, numero_interno) substitui (pessoa_id, numero_interno) — não aplicar aqui.

-- =============================================================================
-- PROCESSO: adicionar cliente_id (titular de negócio), manter pessoa_id (titular)
-- =============================================================================

ALTER TABLE processo
    ADD COLUMN cliente_id BIGINT NULL AFTER pessoa_id;

CREATE INDEX idx_processo_cliente ON processo (cliente_id);

UPDATE processo p
SET p.cliente_id = (
    SELECT c.id
    FROM cliente c
    WHERE c.codigo_cliente = LPAD(p.pessoa_id, 8, '0')
    LIMIT 1
)
WHERE p.cliente_id IS NULL;

ALTER TABLE processo
    ADD CONSTRAINT fk_processo_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id)
        ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- FINANCEIRO — lançamento: cliente_id legado apontava para pessoa(id)
-- =============================================================================

ALTER TABLE financeiro_lancamento
    DROP FOREIGN KEY fk_fl_cliente;

ALTER TABLE financeiro_lancamento
    CHANGE COLUMN cliente_id pessoa_ref_id BIGINT NULL;

DROP INDEX idx_fl_cliente ON financeiro_lancamento;

CREATE INDEX idx_fl_pessoa_ref ON financeiro_lancamento (pessoa_ref_id);

ALTER TABLE financeiro_lancamento
    ADD COLUMN cliente_id BIGINT NULL AFTER pessoa_ref_id;

UPDATE financeiro_lancamento fl
SET fl.cliente_id = (
    SELECT c.id
    FROM cliente c
    WHERE c.pessoa_id = fl.pessoa_ref_id
    LIMIT 1
)
WHERE fl.pessoa_ref_id IS NOT NULL
  AND fl.cliente_id IS NULL;

UPDATE financeiro_lancamento fl
SET fl.cliente_id = (
    SELECT c.id
    FROM cliente c
    WHERE c.codigo_cliente = LPAD(fl.pessoa_ref_id, 8, '0')
    LIMIT 1
)
WHERE fl.pessoa_ref_id IS NOT NULL
  AND fl.cliente_id IS NULL;

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

UPDATE financeiro_lancamento_cartao fl
SET fl.cliente_id = (
    SELECT c.id
    FROM cliente c
    WHERE c.pessoa_id = fl.pessoa_ref_id
    LIMIT 1
)
WHERE fl.pessoa_ref_id IS NOT NULL
  AND fl.cliente_id IS NULL;

UPDATE financeiro_lancamento_cartao fl
SET fl.cliente_id = (
    SELECT c.id
    FROM cliente c
    WHERE c.codigo_cliente = LPAD(fl.pessoa_ref_id, 8, '0')
    LIMIT 1
)
WHERE fl.pessoa_ref_id IS NOT NULL
  AND fl.cliente_id IS NULL;

CREATE INDEX idx_flc_cliente ON financeiro_lancamento_cartao (cliente_id);

ALTER TABLE financeiro_lancamento_cartao
    ADD CONSTRAINT fk_flc_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id)
        ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- FINANCEIRO — regra classificação
-- =============================================================================

ALTER TABLE financeiro_regra_classificacao
    DROP FOREIGN KEY fk_frc_cliente;

ALTER TABLE financeiro_regra_classificacao
    CHANGE COLUMN cliente_id pessoa_ref_id BIGINT NULL;

ALTER TABLE financeiro_regra_classificacao
    ADD COLUMN cliente_id BIGINT NULL AFTER pessoa_ref_id;

UPDATE financeiro_regra_classificacao r
SET r.cliente_id = (
    SELECT c.id
    FROM cliente c
    WHERE c.pessoa_id = r.pessoa_ref_id
    LIMIT 1
)
WHERE r.pessoa_ref_id IS NOT NULL
  AND r.cliente_id IS NULL;

UPDATE financeiro_regra_classificacao r
SET r.cliente_id = (
    SELECT c.id
    FROM cliente c
    WHERE c.codigo_cliente = LPAD(r.pessoa_ref_id, 8, '0')
    LIMIT 1
)
WHERE r.pessoa_ref_id IS NOT NULL
  AND r.cliente_id IS NULL;

ALTER TABLE financeiro_regra_classificacao
    ADD CONSTRAINT fk_frc_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id)
        ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- IMÓVEL: adicionar cliente_id; manter pessoa_id (titular/vínculo legado)
-- =============================================================================

ALTER TABLE imovel
    ADD COLUMN cliente_id BIGINT NULL AFTER pessoa_id;

CREATE INDEX idx_imovel_cliente ON imovel (cliente_id);

UPDATE imovel i
SET i.cliente_id = (
    SELECT c.id
    FROM cliente c
    WHERE c.pessoa_id = i.pessoa_id
    LIMIT 1
)
WHERE i.pessoa_id IS NOT NULL
  AND i.cliente_id IS NULL;

UPDATE imovel i
SET i.cliente_id = (
    SELECT c.id
    FROM cliente c
    WHERE c.codigo_cliente = LPAD(i.pessoa_id, 8, '0')
    LIMIT 1
)
WHERE i.pessoa_id IS NOT NULL
  AND i.cliente_id IS NULL;

UPDATE imovel i
INNER JOIN processo p ON p.id = i.processo_id
SET i.cliente_id = p.cliente_id
WHERE i.cliente_id IS NULL
  AND p.cliente_id IS NOT NULL;

ALTER TABLE imovel
    ADD CONSTRAINT fk_imovel_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id)
        ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- PUBLICAÇÕES: cliente_ref_id = pessoa titular (legado); cliente_id = FK cliente
-- =============================================================================

ALTER TABLE publicacoes
    ADD COLUMN cliente_id BIGINT NULL AFTER processo_id;

CREATE INDEX idx_publicacoes_cliente ON publicacoes (cliente_id);

UPDATE publicacoes pub
INNER JOIN processo p ON p.id = pub.processo_id
SET pub.cliente_id = p.cliente_id
WHERE pub.cliente_id IS NULL
  AND p.cliente_id IS NOT NULL;

UPDATE publicacoes pub
SET pub.cliente_id = (
    SELECT c.id
    FROM cliente c
    WHERE c.pessoa_id = pub.cliente_ref_id
    LIMIT 1
)
WHERE pub.cliente_ref_id IS NOT NULL
  AND pub.cliente_id IS NULL;

UPDATE publicacoes pub
SET pub.cliente_id = (
    SELECT c.id
    FROM cliente c
    WHERE c.codigo_cliente = LPAD(pub.cliente_ref_id, 8, '0')
    LIMIT 1
)
WHERE pub.cliente_ref_id IS NOT NULL
  AND pub.cliente_id IS NULL;

ALTER TABLE publicacoes
    ADD CONSTRAINT fk_publicacoes_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id)
        ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- TAREFA OPERACIONAL: cliente_id sem FK → FK cliente após backfill
-- =============================================================================

UPDATE tarefa_operacional t
SET t.cliente_id = (
    SELECT c.id
    FROM cliente c
    WHERE c.pessoa_id = t.cliente_id
    LIMIT 1
)
WHERE t.cliente_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM cliente c WHERE c.id = t.cliente_id);

UPDATE tarefa_operacional t
SET t.cliente_id = (
    SELECT c.id
    FROM cliente c
    WHERE c.codigo_cliente = LPAD(t.cliente_id, 8, '0')
    LIMIT 1
)
WHERE t.cliente_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM cliente c WHERE c.id = t.cliente_id);

UPDATE tarefa_operacional t
SET t.cliente_id = NULL
WHERE t.cliente_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM cliente c WHERE c.id = t.cliente_id);

ALTER TABLE tarefa_operacional
    ADD CONSTRAINT fk_tarefa_operacional_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id)
        ON DELETE SET NULL ON UPDATE CASCADE;
