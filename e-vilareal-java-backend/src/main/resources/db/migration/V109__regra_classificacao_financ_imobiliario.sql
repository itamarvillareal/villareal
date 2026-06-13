INSERT INTO financeiro_regra_classificacao (
    padrao_descricao, tipo_match, conta_contabil_id, letra_destino, numero_banco, prioridade, confianca, ativo)
SELECT '%financ imobiliario%', 'CONTAINS', c.id, 'I', NULL, 5, 0.9900, TRUE
FROM financeiro_conta_contabil c
WHERE c.codigo = 'I'
  AND NOT EXISTS (
      SELECT 1 FROM financeiro_regra_classificacao
      WHERE UPPER(padrao_descricao) LIKE '%FINANC IMOBILIARIO%' AND letra_destino = 'I'
  );
