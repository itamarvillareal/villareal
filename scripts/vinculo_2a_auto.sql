-- 2ª passada: 3 UPDATEs aprovados (177327 removido).
START TRANSACTION;
UPDATE financeiro_lancamento SET imovel_id = 8  WHERE id = 179885 AND imovel_id IS NULL;  -- F-18 / água / 110.00
UPDATE financeiro_lancamento SET imovel_id = 8  WHERE id = 179950 AND imovel_id IS NULL;  -- F-18 / energia / 119.85
UPDATE financeiro_lancamento SET imovel_id = 70 WHERE id = 179869 AND imovel_id IS NULL;  -- 101 C / gás / 13.27
COMMIT;
