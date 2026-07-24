-- Tags [CC_CLI:804] legadas: o vínculo real é 00000938 | proc 27.
-- 1) Reaponta lançamentos ainda sem cliente (ou ainda no 804) que carregam a tag.
-- 2) Substitui a tag na descrição detalhada.
-- Idempotente.

UPDATE financeiro_lancamento fl
INNER JOIN cliente c_to
    ON TRIM(c_to.codigo_cliente) IN ('00000938', '938')
INNER JOIN processo p_to
    ON p_to.cliente_id = c_to.id
   AND p_to.numero_interno = 27
LEFT JOIN cliente c_from ON c_from.id = fl.cliente_id
SET fl.cliente_id = c_to.id,
    fl.pessoa_ref_id = c_to.pessoa_id,
    fl.processo_id = p_to.id
WHERE fl.descricao_detalhada LIKE '%[CC_CLI:804]%'
  AND (
    fl.cliente_id IS NULL
    OR TRIM(c_from.codigo_cliente) IN ('00000804', '804')
  );

UPDATE financeiro_lancamento_cartao flc
INNER JOIN cliente c_to
    ON TRIM(c_to.codigo_cliente) IN ('00000938', '938')
INNER JOIN processo p_to
    ON p_to.cliente_id = c_to.id
   AND p_to.numero_interno = 27
LEFT JOIN cliente c_from ON c_from.id = flc.cliente_id
SET flc.cliente_id = c_to.id,
    flc.pessoa_ref_id = c_to.pessoa_id,
    flc.processo_id = p_to.id
WHERE flc.descricao_detalhada LIKE '%[CC_CLI:804]%'
  AND (
    flc.cliente_id IS NULL
    OR TRIM(c_from.codigo_cliente) IN ('00000804', '804')
  );

UPDATE financeiro_lancamento fl
INNER JOIN cliente c ON c.id = fl.cliente_id
SET fl.descricao_detalhada = REPLACE(fl.descricao_detalhada, '[CC_CLI:804]', '[CC_CLI:938]')
WHERE TRIM(c.codigo_cliente) IN ('00000938', '938')
  AND fl.descricao_detalhada LIKE '%[CC_CLI:804]%';

UPDATE financeiro_lancamento_cartao flc
INNER JOIN cliente c ON c.id = flc.cliente_id
SET flc.descricao_detalhada = REPLACE(flc.descricao_detalhada, '[CC_CLI:804]', '[CC_CLI:938]')
WHERE TRIM(c.codigo_cliente) IN ('00000938', '938')
  AND flc.descricao_detalhada LIKE '%[CC_CLI:804]%';

-- Conta Escritório com vínculo completo → VINCULADO
UPDATE financeiro_lancamento fl
INNER JOIN financeiro_conta_contabil c ON c.id = fl.conta_contabil_id
INNER JOIN cliente cl ON cl.id = fl.cliente_id
INNER JOIN processo p ON p.id = fl.processo_id
SET fl.etapa = 'VINCULADO'
WHERE TRIM(cl.codigo_cliente) IN ('00000938', '938')
  AND p.numero_interno = 27
  AND UPPER(TRIM(c.codigo)) = 'A'
  AND fl.etapa IN ('CLASSIFICADO', 'IMPORTADO');
