-- Repasse interno (banco 900) passa a ter extrato no Financeiro, como conta virtual com movimentação
-- espelhada (débito + crédito por repasse). Idempotente: só altera se ainda estiver sem extrato.
UPDATE conta_bancaria
SET tem_extrato = TRUE,
    banco_nome = COALESCE(NULLIF(TRIM(banco_nome), ''), 'REPASSE INTERNO')
WHERE numero_banco = 900
  AND tem_extrato = FALSE;
