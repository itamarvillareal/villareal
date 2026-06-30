-- Sicoob VRV — VRV SOLUCOES LTDA (CNPJ 39.720.563/0001-90)
-- Conta corrente OFX: BANKID 756, agência 5024-5, conta 36448-7.
--
-- Sicoob (consolidado 4) — conta corrente OFX: mesma agência, conta 2754-5.
-- V146/V148 tinham as duas contas invertidas entre VRV (29) e Sicoob (4).

UPDATE conta_bancaria
SET ofx_bank_id = '756',
    ofx_agencia = '5024-5',
    ofx_conta = '36448-7'
WHERE numero_banco = 29;

UPDATE conta_bancaria
SET ofx_bank_id = '756',
    ofx_agencia = '5024-5',
    ofx_conta = '2754-5'
WHERE numero_banco = 4;
