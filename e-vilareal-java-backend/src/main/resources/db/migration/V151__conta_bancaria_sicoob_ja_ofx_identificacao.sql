-- Sicoob JA (ex-Sicoob JÁ) — extrato internet banking Sicoob, jun/2026:
-- BANKID 756, agência 5024-5, conta corrente 31707-1.

UPDATE conta_bancaria
SET banco_nome = 'Sicoob JA'
WHERE banco_nome IN ('Sicoob JÁ', 'Sicoob JÃ');

UPDATE financeiro_lancamento
SET banco_nome = 'Sicoob JA'
WHERE banco_nome IN ('Sicoob JÁ', 'Sicoob JÃ');

UPDATE financeiro_saldo_inicial
SET banco_nome = 'Sicoob JA'
WHERE banco_nome IN ('Sicoob JÁ', 'Sicoob JÃ');

INSERT INTO conta_bancaria (numero_banco, banco_nome, tipo, tem_extrato, ativo, ofx_bank_id, ofx_agencia, ofx_conta)
SELECT 31, 'Sicoob JA', 'REAL', TRUE, TRUE, '756', '5024-5', '31707-1'
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM conta_bancaria WHERE banco_nome = 'Sicoob JA' OR ofx_conta = '31707-1'
);

UPDATE conta_bancaria
SET banco_nome = 'Sicoob JA',
    ofx_bank_id = '756',
    ofx_agencia = '5024-5',
    ofx_conta = '31707-1',
    tem_extrato = TRUE,
    tipo = 'REAL',
    ativo = TRUE
WHERE banco_nome = 'Sicoob JA'
   OR ofx_conta = '31707-1';

UPDATE financeiro_lancamento fl
INNER JOIN conta_bancaria cb ON cb.banco_nome = 'Sicoob JA'
SET fl.numero_banco = cb.numero_banco
WHERE fl.banco_nome = 'Sicoob JA'
  AND (fl.numero_banco IS NULL OR fl.numero_banco <> cb.numero_banco);
