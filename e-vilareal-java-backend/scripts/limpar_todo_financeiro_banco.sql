-- =============================================================================
-- ZERA dados de movimentação financeira no MySQL (Villareal).
--
-- Remove TODOS os lançamentos em financeiro_lancamento (extratos, OFX/PDF,
-- vínculos cliente/processo, elos de compensação — elo_financeiro_id é coluna
-- nesta mesma tabela; some com as linhas).
--
-- Limpa referências em locação (imóveis) que apontavam para lançamentos.
--
-- NÃO apaga financeiro_conta_contabil (plano: Conta Escritório, N, E, etc.) —
-- só os valores/movimentos. Contas extras criadas pela API também permanecem.
--
-- NÃO altera calculo_rodada / calculo_cliente_config (módulo Cálculos no front).
--
-- Uso (ajuste usuário/base):
--   mysql -u root -p nome_da_base < scripts/limpar_todo_financeiro_banco.sql
--
-- Recomenda-se backup antes: mysqldump …
-- =============================================================================

START TRANSACTION;

-- Vínculos opcionais de locação → lançamento (sem FK no DDL, mas IDs ficariam órfãos)
UPDATE locacao_repasse
SET lancamento_financeiro_vinculo_id = NULL
WHERE lancamento_financeiro_vinculo_id IS NOT NULL;

UPDATE locacao_despesa
SET lancamento_financeiro_id = NULL
WHERE lancamento_financeiro_id IS NOT NULL;

DELETE FROM financeiro_lancamento;

COMMIT;

-- Verificação rápida (opcional):
-- SELECT COUNT(*) AS lancamentos_restantes FROM financeiro_lancamento;
-- SELECT COUNT(*) AS repasses_com_vinculo FROM locacao_repasse WHERE lancamento_financeiro_vinculo_id IS NOT NULL;
-- SELECT COUNT(*) AS despesas_com_lanc FROM locacao_despesa WHERE lancamento_financeiro_id IS NOT NULL;

-- Se o front usar cache local sem API (feature flag), apague também no navegador as chaves
-- `vilareal.financeiro.extratos.v20` e históricos v11–v19 — ver `STORAGE_FINANCEIRO_*` em financeiroData.js.
