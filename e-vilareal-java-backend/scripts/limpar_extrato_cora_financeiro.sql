-- Atualizado 2026-04-19: removidas referências a colunas dropadas
-- por V34 (classificacao_financeira_id, elo_financeiro_id,
-- parcela_ref, eq_referencia, processo.status, descricao_acao).
--
-- Pós-V34: remove apenas lançamentos do extrato cujo banco normalizado é «CORA».
-- (Elos entre bancos e metadados de referência do extrato deixaram de existir no modelo.)
--
-- Uso:
--   mysql -u root -p nome_da_base < scripts/limpar_extrato_cora_financeiro.sql
--

DELETE FROM financeiro_lancamento
WHERE UPPER(TRIM(COALESCE(banco_nome, ''))) = 'CORA';
