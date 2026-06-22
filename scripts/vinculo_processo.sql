-- Varredura por processo (1:1 imovel_processo). Dry-run — revise antes de aplicar.
-- Lançamentos: 97
START TRANSACTION;
UPDATE financeiro_lancamento SET imovel_id = 8 WHERE processo_id = 1946 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- 28 lançamento(s)
UPDATE financeiro_lancamento SET imovel_id = 65 WHERE processo_id = 16021 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- 6 lançamento(s)
UPDATE financeiro_lancamento SET imovel_id = 70 WHERE processo_id = 16025 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- 63 lançamento(s)
UPDATE financeiro_lancamento SET imovel_id = 42 WHERE processo_id = 16033 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- 0 lançamento(s)
UPDATE financeiro_lancamento SET imovel_id = 73 WHERE processo_id = 16053 AND imovel_id IS NULL AND status = 'ATIVO' AND natureza = 'DEBITO';  -- 0 lançamento(s)
-- COMMIT;
