-- Conta E com grupo incompleto (< 2 lançamentos) não pode estar COMPENSADO.
UPDATE financeiro_lancamento l
INNER JOIN financeiro_conta_contabil c ON c.id = l.conta_contabil_id
INNER JOIN (
    SELECT grupo_compensacao
    FROM financeiro_lancamento
    WHERE status = 'ATIVO'
      AND grupo_compensacao IS NOT NULL
      AND TRIM(grupo_compensacao) <> ''
    GROUP BY grupo_compensacao
    HAVING COUNT(*) < 2
) g ON g.grupo_compensacao = l.grupo_compensacao
SET l.etapa = 'IMPORTADO'
WHERE UPPER(c.codigo) = 'E'
  AND l.grupo_compensacao IS NOT NULL
  AND TRIM(l.grupo_compensacao) <> ''
  AND l.status = 'ATIVO'
  AND l.etapa = 'COMPENSADO';

UPDATE financeiro_lancamento_cartao lc
INNER JOIN financeiro_conta_contabil c ON c.id = lc.conta_contabil_id
INNER JOIN (
    SELECT grupo_compensacao
    FROM financeiro_lancamento_cartao
    WHERE status = 'ATIVO'
      AND grupo_compensacao IS NOT NULL
      AND TRIM(grupo_compensacao) <> ''
    GROUP BY grupo_compensacao
    HAVING COUNT(*) < 2
) g ON g.grupo_compensacao = lc.grupo_compensacao
SET lc.etapa = 'IMPORTADO'
WHERE UPPER(c.codigo) = 'E'
  AND lc.grupo_compensacao IS NOT NULL
  AND TRIM(lc.grupo_compensacao) <> ''
  AND lc.status = 'ATIVO'
  AND lc.etapa = 'COMPENSADO';
