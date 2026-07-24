-- Reapontar lançamentos financeiros do cliente 00000804 para 00000938 | processo 27.
-- Resolve IDs por codigo_cliente / numero_interno (não hardcode de PK).
-- Idempotente: seguro em schema vazio ou se o vínculo alvo não existir.

UPDATE financeiro_lancamento fl
INNER JOIN cliente c_from
    ON c_from.id = fl.cliente_id
   AND TRIM(c_from.codigo_cliente) IN ('00000804', '804')
INNER JOIN cliente c_to
    ON TRIM(c_to.codigo_cliente) IN ('00000938', '938')
INNER JOIN processo p_to
    ON p_to.cliente_id = c_to.id
   AND p_to.numero_interno = 27
SET fl.cliente_id = c_to.id,
    fl.pessoa_ref_id = c_to.pessoa_id,
    fl.processo_id = p_to.id;

UPDATE financeiro_lancamento_cartao flc
INNER JOIN cliente c_from
    ON c_from.id = flc.cliente_id
   AND TRIM(c_from.codigo_cliente) IN ('00000804', '804')
INNER JOIN cliente c_to
    ON TRIM(c_to.codigo_cliente) IN ('00000938', '938')
INNER JOIN processo p_to
    ON p_to.cliente_id = c_to.id
   AND p_to.numero_interno = 27
SET flc.cliente_id = c_to.id,
    flc.pessoa_ref_id = c_to.pessoa_id,
    flc.processo_id = p_to.id;

-- Conta Escritório (A) com cliente+processo → etapa VINCULADO
UPDATE financeiro_lancamento fl
INNER JOIN financeiro_conta_contabil c ON c.id = fl.conta_contabil_id
INNER JOIN cliente cl ON cl.id = fl.cliente_id
INNER JOIN processo p ON p.id = fl.processo_id
SET fl.etapa = 'VINCULADO'
WHERE TRIM(cl.codigo_cliente) IN ('00000938', '938')
  AND p.numero_interno = 27
  AND UPPER(TRIM(c.codigo)) = 'A'
  AND fl.cliente_id IS NOT NULL
  AND fl.processo_id IS NOT NULL
  AND fl.etapa IN ('CLASSIFICADO', 'IMPORTADO');

UPDATE financeiro_lancamento_cartao flc
INNER JOIN financeiro_conta_contabil c ON c.id = flc.conta_contabil_id
INNER JOIN cliente cl ON cl.id = flc.cliente_id
INNER JOIN processo p ON p.id = flc.processo_id
SET flc.etapa = 'VINCULADO'
WHERE TRIM(cl.codigo_cliente) IN ('00000938', '938')
  AND p.numero_interno = 27
  AND UPPER(TRIM(c.codigo)) = 'A'
  AND flc.cliente_id IS NOT NULL
  AND flc.processo_id IS NOT NULL
  AND flc.etapa IN ('CLASSIFICADO', 'IMPORTADO');
