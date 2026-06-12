INSERT INTO financeiro_regra_classificacao (
    padrao_descricao, tipo_match, conta_contabil_id, letra_destino, numero_banco, prioridade, confianca, ativo)
SELECT '%vrv%', 'CONTAINS', c.id, 'E', NULL, 5, 0.9900, TRUE
FROM financeiro_conta_contabil c
WHERE c.codigo = 'E'
  AND NOT EXISTS (
      SELECT 1 FROM financeiro_regra_classificacao
      WHERE UPPER(padrao_descricao) LIKE '%VRV%' AND letra_destino = 'E' AND numero_banco IS NULL
  );

INSERT INTO financeiro_regra_classificacao (
    padrao_descricao, tipo_match, conta_contabil_id, letra_destino, numero_banco, prioridade, confianca, ativo)
SELECT '%itamar alexandre%', 'CONTAINS', c.id, 'E', NULL, 5, 0.9900, TRUE
FROM financeiro_conta_contabil c
WHERE c.codigo = 'E'
  AND NOT EXISTS (
      SELECT 1 FROM financeiro_regra_classificacao
      WHERE UPPER(padrao_descricao) LIKE '%ITAMAR ALEXANDRE%' AND letra_destino = 'E'
  );

INSERT INTO financeiro_regra_classificacao (
    padrao_descricao, tipo_match, conta_contabil_id, letra_destino, numero_banco, prioridade, confianca, ativo)
SELECT '%transf pix recebida - itamar%', 'CONTAINS', c.id, 'E', NULL, 5, 0.9900, TRUE
FROM financeiro_conta_contabil c
WHERE c.codigo = 'E'
  AND NOT EXISTS (
      SELECT 1 FROM financeiro_regra_classificacao
      WHERE UPPER(padrao_descricao) LIKE '%TRANSF PIX RECEBIDA - ITAMAR%'
  );
