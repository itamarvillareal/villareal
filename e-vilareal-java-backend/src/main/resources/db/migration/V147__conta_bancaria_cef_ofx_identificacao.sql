-- CEF — identificação OFX (extrato Caixa, arquivo ref. jun/2026):
-- BANKID 0104 (código 104), conta 0007770852952 (sem agência no OFX).

INSERT IGNORE INTO conta_bancaria (numero_banco, banco_nome, tipo, tem_extrato, ativo, ofx_bank_id, ofx_agencia, ofx_conta)
VALUES (5, 'CEF', 'REAL', TRUE, TRUE, '104', NULL, '0007770852952');

UPDATE conta_bancaria
SET banco_nome = COALESCE(NULLIF(TRIM(banco_nome), ''), 'CEF'),
    ofx_bank_id = '104',
    ofx_agencia = NULL,
    ofx_conta = '0007770852952',
    tem_extrato = TRUE,
    tipo = 'REAL',
    ativo = TRUE
WHERE numero_banco = 5;
