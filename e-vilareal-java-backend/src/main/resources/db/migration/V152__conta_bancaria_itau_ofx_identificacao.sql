-- Itaú — extrato conta corrente (OFX ref. jun/2026):
-- BANKID 341 (0341 no arquivo), conta 9664007474 (sem agência no OFX).

INSERT IGNORE INTO conta_bancaria (numero_banco, banco_nome, tipo, tem_extrato, ativo, ofx_bank_id, ofx_agencia, ofx_conta)
VALUES (1, 'Itaú', 'REAL', TRUE, TRUE, '341', NULL, '9664007474');

UPDATE conta_bancaria
SET banco_nome = COALESCE(NULLIF(TRIM(banco_nome), ''), 'Itaú'),
    ofx_bank_id = '341',
    ofx_agencia = NULL,
    ofx_conta = '9664007474',
    tem_extrato = TRUE,
    tipo = 'REAL',
    ativo = TRUE
WHERE numero_banco = 1;
