-- Uso único: apaga lançamentos do extrato CORA e remove vínculos de compensação (elo_financeiro_id)
-- nos demais bancos que compartilhavam o mesmo elo com algum lançamento Cora.
-- Reclassifica esses lançamentos pareados para a conta «N» (Conta Não Identificados).
--
-- mysql -u root -p vilareal < scripts/limpar_extrato_cora_financeiro.sql
--
SET @id_n := (SELECT id FROM financeiro_conta_contabil WHERE codigo = 'N' LIMIT 1);

UPDATE financeiro_lancamento fl
INNER JOIN (
  SELECT DISTINCT elo_financeiro_id AS eid
  FROM financeiro_lancamento
  WHERE UPPER(TRIM(COALESCE(banco_nome, ''))) = 'CORA'
    AND elo_financeiro_id IS NOT NULL
) s ON fl.elo_financeiro_id = s.eid
SET
  fl.elo_financeiro_id = NULL,
  fl.conta_contabil_id = @id_n,
  fl.cliente_id = NULL,
  fl.processo_id = NULL,
  fl.eq_referencia = NULL;

DELETE FROM financeiro_lancamento
WHERE UPPER(TRIM(COALESCE(banco_nome, ''))) = 'CORA';
