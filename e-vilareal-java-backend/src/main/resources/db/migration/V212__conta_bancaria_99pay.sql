-- 99 pay — carteira digital (extrato via PDF/planilha; sem OFX).

INSERT IGNORE INTO conta_bancaria (numero_banco, banco_nome, tipo, tem_extrato, ativo)
VALUES (30, '99 pay', 'REAL', TRUE, TRUE);

UPDATE conta_bancaria
SET banco_nome = '99 pay',
    tem_extrato = TRUE,
    tipo = 'REAL',
    ativo = TRUE
WHERE numero_banco = 30;
