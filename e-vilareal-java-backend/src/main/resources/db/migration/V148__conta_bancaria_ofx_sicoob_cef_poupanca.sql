-- Cadastro OFX extraído dos extratos jun/2026 (Sicoob principal + segunda conta Caixa).

-- Sicoob (consolidado 4) — internet banking Sicoob, mesma agência da VRV, conta 36448-7.
INSERT IGNORE INTO conta_bancaria (numero_banco, banco_nome, tipo, tem_extrato, ativo, ofx_bank_id, ofx_agencia, ofx_conta)
VALUES (4, 'Sicoob', 'REAL', TRUE, TRUE, '756', '5024-5', '36448-7');

UPDATE conta_bancaria
SET banco_nome = COALESCE(NULLIF(TRIM(banco_nome), ''), 'Sicoob'),
    ofx_bank_id = '756',
    ofx_agencia = '5024-5',
    ofx_conta = '36448-7',
    tem_extrato = TRUE,
    tipo = 'REAL',
    ativo = TRUE
WHERE numero_banco = 4;

-- CEF Poupança (consolidado 12) — Caixa BANKID 104, conta 0005968205993 (sem agência no OFX).
INSERT IGNORE INTO conta_bancaria (numero_banco, banco_nome, tipo, tem_extrato, ativo, ofx_bank_id, ofx_agencia, ofx_conta)
VALUES (12, 'CEF Poupança', 'REAL', TRUE, TRUE, '104', NULL, '0005968205993');

UPDATE conta_bancaria
SET banco_nome = COALESCE(NULLIF(TRIM(banco_nome), ''), 'CEF Poupança'),
    ofx_bank_id = '104',
    ofx_agencia = NULL,
    ofx_conta = '0005968205993',
    tem_extrato = TRUE,
    tipo = 'REAL',
    ativo = TRUE
WHERE numero_banco = 12;
