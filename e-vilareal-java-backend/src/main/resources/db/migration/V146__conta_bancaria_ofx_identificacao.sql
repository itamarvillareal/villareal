-- Identificação OFX por conta (BANKID + agência + conta) para validar importação de extrato.

SET @col := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'conta_bancaria' AND column_name = 'ofx_bank_id');
SET @ddl := IF(@col = 0,
    'ALTER TABLE conta_bancaria ADD COLUMN ofx_bank_id VARCHAR(10) NULL AFTER banco_nome, ADD COLUMN ofx_agencia VARCHAR(20) NULL AFTER ofx_bank_id, ADD COLUMN ofx_conta VARCHAR(30) NULL AFTER ofx_agencia, ALGORITHM=INPLACE, LOCK=NONE',
    'DO 0');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- Sicoob VRV — extrato internet banking (OFX Money), arquivo ref. jun/2026:
-- BANKID 756, agência 5024-5, conta corrente 2754-5.
INSERT IGNORE INTO conta_bancaria (numero_banco, banco_nome, tipo, tem_extrato, ativo, ofx_bank_id, ofx_agencia, ofx_conta)
VALUES (29, 'Sicoob VRV', 'REAL', TRUE, TRUE, '756', '5024-5', '2754-5');

UPDATE conta_bancaria
SET banco_nome = COALESCE(NULLIF(TRIM(banco_nome), ''), 'Sicoob VRV'),
    ofx_bank_id = '756',
    ofx_agencia = '5024-5',
    ofx_conta = '2754-5',
    tem_extrato = TRUE,
    tipo = 'REAL',
    ativo = TRUE
WHERE numero_banco = 29;
