-- Regra: lançamentos "Lucro" no 99 Pay (numero_banco 30) → conta F (Fundos Investimentos)
INSERT INTO financeiro_regra_classificacao (padrao_descricao, tipo_match, conta_contabil_id, numero_banco, prioridade, ativo)
SELECT
    'Lucro',
    'CONTAINS',
    (SELECT id FROM financeiro_conta_contabil WHERE codigo = 'F' LIMIT 1),
    30,
    10,
    TRUE
WHERE NOT EXISTS (
    SELECT 1
    FROM financeiro_regra_classificacao
    WHERE UPPER(padrao_descricao) = 'LUCRO'
      AND numero_banco = 30
);
