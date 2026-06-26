-- BB — extrato jun/2026 (depósito judicial / poupança):
-- BANKID 1 (Banco do Brasil), agência 324-7, conta 453259-7/51.

INSERT IGNORE INTO conta_bancaria (numero_banco, banco_nome, tipo, tem_extrato, ativo, ofx_bank_id, ofx_agencia, ofx_conta)
VALUES (3, 'BB', 'REAL', TRUE, TRUE, '1', '324-7', '453259-7/51');

UPDATE conta_bancaria
SET banco_nome = COALESCE(NULLIF(TRIM(banco_nome), ''), 'BB'),
    ofx_bank_id = '1',
    ofx_agencia = '324-7',
    ofx_conta = '453259-7/51',
    tem_extrato = TRUE,
    tipo = 'REAL',
    ativo = TRUE
WHERE numero_banco = 3;
