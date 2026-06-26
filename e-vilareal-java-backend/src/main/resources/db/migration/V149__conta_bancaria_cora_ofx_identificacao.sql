-- CORA — extrato VRV Soluções (arquivo ref. jun/2026):
-- BANKID 403 (Cora SCD), agência 1, conta 40254494.

INSERT IGNORE INTO conta_bancaria (numero_banco, banco_nome, tipo, tem_extrato, ativo, ofx_bank_id, ofx_agencia, ofx_conta)
VALUES (26, 'CORA', 'REAL', TRUE, TRUE, '403', '1', '40254494');

UPDATE conta_bancaria
SET banco_nome = COALESCE(NULLIF(TRIM(banco_nome), ''), 'CORA'),
    ofx_bank_id = '403',
    ofx_agencia = '1',
    ofx_conta = '40254494',
    tem_extrato = TRUE,
    tipo = 'REAL',
    ativo = TRUE
WHERE numero_banco = 26;
