-- BB Conta Corrente — extrato OFX (conta 453259-7, agência 324-7; distinto do BB poupança 453259-7/51).

INSERT IGNORE INTO conta_bancaria (numero_banco, banco_nome, tipo, tem_extrato, ativo, ofx_bank_id, ofx_agencia, ofx_conta)
VALUES (903, 'BB Conta Corrente', 'REAL', TRUE, TRUE, '1', '324-7', '453259-7');

UPDATE conta_bancaria
SET banco_nome = 'BB Conta Corrente',
    ofx_bank_id = '1',
    ofx_agencia = '324-7',
    ofx_conta = '453259-7',
    tem_extrato = TRUE,
    tipo = 'REAL',
    ativo = TRUE
WHERE numero_banco = 903;
