-- Rendimentos, correção monetária e aplicações → conta F (sugestão e auto-classificação).

INSERT INTO financeiro_regra_classificacao (
    padrao_descricao, tipo_match, conta_contabil_id, letra_destino, numero_banco, prioridade, confianca, ativo)
SELECT 'COR JURS', 'CONTAINS', c.id, 'F', NULL, 5, 0.9900, TRUE
FROM financeiro_conta_contabil c
WHERE c.codigo = 'F'
  AND NOT EXISTS (
      SELECT 1 FROM financeiro_regra_classificacao
      WHERE UPPER(TRIM(padrao_descricao)) = 'COR JURS' AND letra_destino = 'F'
  );

INSERT INTO financeiro_regra_classificacao (
    padrao_descricao, tipo_match, conta_contabil_id, letra_destino, numero_banco, prioridade, confianca, ativo)
SELECT 'CORJURS', 'CONTAINS', c.id, 'F', NULL, 5, 0.9900, TRUE
FROM financeiro_conta_contabil c
WHERE c.codigo = 'F'
  AND NOT EXISTS (
      SELECT 1 FROM financeiro_regra_classificacao
      WHERE UPPER(TRIM(padrao_descricao)) = 'CORJURS' AND letra_destino = 'F'
  );

INSERT INTO financeiro_regra_classificacao (
    padrao_descricao, tipo_match, conta_contabil_id, letra_destino, numero_banco, prioridade, confianca, ativo)
SELECT '%CDB%', 'CONTAINS', c.id, 'F', NULL, 5, 0.9900, TRUE
FROM financeiro_conta_contabil c
WHERE c.codigo = 'F'
  AND NOT EXISTS (
      SELECT 1 FROM financeiro_regra_classificacao
      WHERE UPPER(TRIM(padrao_descricao)) LIKE '%CDB%' AND letra_destino = 'F' AND numero_banco IS NULL
  );

INSERT INTO financeiro_regra_classificacao (
    padrao_descricao, tipo_match, conta_contabil_id, letra_destino, numero_banco, prioridade, confianca, ativo)
SELECT '% LCA %', 'CONTAINS', c.id, 'F', NULL, 5, 0.9900, TRUE
FROM financeiro_conta_contabil c
WHERE c.codigo = 'F'
  AND NOT EXISTS (
      SELECT 1 FROM financeiro_regra_classificacao
      WHERE UPPER(TRIM(padrao_descricao)) LIKE '% LCA %' AND letra_destino = 'F' AND numero_banco IS NULL
  );

INSERT INTO financeiro_regra_classificacao (
    padrao_descricao, tipo_match, conta_contabil_id, letra_destino, numero_banco, prioridade, confianca, ativo)
SELECT '% CRI %', 'CONTAINS', c.id, 'F', NULL, 5, 0.9900, TRUE
FROM financeiro_conta_contabil c
WHERE c.codigo = 'F'
  AND NOT EXISTS (
      SELECT 1 FROM financeiro_regra_classificacao
      WHERE UPPER(TRIM(padrao_descricao)) LIKE '% CRI %' AND letra_destino = 'F' AND numero_banco IS NULL
  );
