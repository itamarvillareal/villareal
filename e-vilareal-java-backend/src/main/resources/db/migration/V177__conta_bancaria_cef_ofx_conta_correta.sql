-- CEF (consolidado 5): extrato jun/2026 confirma conta 0005968205993 (BANKID 104).
-- A conta 0007770852952 passa para CEF Poupança (consolidado 12).

UPDATE conta_bancaria
SET ofx_bank_id = '104',
    ofx_agencia = NULL,
    ofx_conta = '0005968205993',
    banco_nome = COALESCE(NULLIF(TRIM(banco_nome), ''), 'CEF'),
    tem_extrato = TRUE,
    tipo = 'REAL',
    ativo = TRUE
WHERE numero_banco = 5;

UPDATE conta_bancaria
SET ofx_bank_id = '104',
    ofx_agencia = NULL,
    ofx_conta = '0007770852952',
    banco_nome = COALESCE(NULLIF(TRIM(banco_nome), ''), 'CEF Poupança'),
    tem_extrato = TRUE,
    tipo = 'REAL',
    ativo = TRUE
WHERE numero_banco = 12;
