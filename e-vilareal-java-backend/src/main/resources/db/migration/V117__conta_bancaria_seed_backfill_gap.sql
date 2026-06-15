-- Fecha o gap da FASE A (Fase 3, item 3 — FASE B, sub-passo B1).
--
-- A V116 (FASE A) semeou conta_bancaria e fez o backfill no momento do deploy, mas o CÓDIGO de criação
-- de lançamento só passa a popular conta_bancaria_id a partir da FASE B. Logo, lançamentos criados
-- entre o deploy da A e o da B ficaram com conta_bancaria_id NULL (e bancos novos podem nem ter conta).
-- A V117 fecha esse intervalo: garante conta para todo numero_banco presente em financeiro_lancamento
-- e re-faz o backfill nas linhas que ficaram sem FK. A partir do deploy da B, ContaBancariaResolverService
-- garante que todo lançamento novo já nasce com a FK.
--
-- Idempotente / re-executável: INSERT IGNORE (UK numero_banco) + UPDATEs filtrados por IS NULL.
-- Re-rodar não duplica nem altera o resultado.

-- (a) SEED IGNORE: cria conta para qualquer numero_banco em financeiro_lancamento ainda SEM conta
--     (banco surgido após o seed da V116). Default tipo REAL, tem_extrato TRUE; banco_nome em (a.2).
INSERT IGNORE INTO conta_bancaria (numero_banco, banco_nome, tipo, tem_extrato, ativo)
SELECT nb.numero_banco, NULL, 'REAL', TRUE, TRUE
FROM (
    SELECT DISTINCT numero_banco FROM financeiro_lancamento WHERE numero_banco IS NOT NULL
) nb
LEFT JOIN conta_bancaria cb ON cb.numero_banco = nb.numero_banco
WHERE cb.id IS NULL;

-- (a.2) banco_nome canônico só para contas ainda SEM nome (recém-criadas acima): nome NÃO-NULO mais
--       frequente nas duas fontes (empate desfeito alfabeticamente). Determinístico = idempotente.
UPDATE conta_bancaria cb
JOIN (
    SELECT numero_banco, banco_nome FROM (
        SELECT numero_banco, banco_nome,
               ROW_NUMBER() OVER (PARTITION BY numero_banco ORDER BY total DESC, banco_nome ASC) rn
        FROM (
            SELECT numero_banco, banco_nome, SUM(c) total FROM (
                SELECT numero_banco, banco_nome, COUNT(*) c
                FROM financeiro_lancamento
                WHERE numero_banco IS NOT NULL AND banco_nome IS NOT NULL
                GROUP BY numero_banco, banco_nome
                UNION ALL
                SELECT numero_banco, banco_nome, COUNT(*) c
                FROM financeiro_saldo_inicial
                WHERE numero_banco IS NOT NULL AND banco_nome IS NOT NULL
                GROUP BY numero_banco, banco_nome
            ) u
            GROUP BY numero_banco, banco_nome
        ) ranked
    ) m
    WHERE m.rn = 1
) nome ON nome.numero_banco = cb.numero_banco
SET cb.banco_nome = nome.banco_nome
WHERE cb.banco_nome IS NULL;

-- (b) RE-BACKFILL: liga por numero_banco apenas os lançamentos que ficaram sem FK (criados no gap).
--     Idempotente (só toca conta_bancaria_id IS NULL); numero_banco NULL permanece sem conta.
UPDATE financeiro_lancamento fl
JOIN conta_bancaria cb ON cb.numero_banco = fl.numero_banco
SET fl.conta_bancaria_id = cb.id
WHERE fl.conta_bancaria_id IS NULL AND fl.numero_banco IS NOT NULL;
