-- V34: Remove colunas confirmadas sem uso em produção.
-- Auditoria: docs/relatorio-O6-gate1.md e docs/relatorio-O6-gate1-confirmacao.md.
-- Verificação contra produção em 2026-04-19: 0% de preenchimento em todas.
-- Remoção do código Java (entidade, DTO, service, frontend) feita nos
-- commits anteriores desta cadeia.

ALTER TABLE financeiro_lancamento
    DROP COLUMN classificacao_financeira_id,
    DROP COLUMN elo_financeiro_id,
    DROP COLUMN parcela_ref,
    DROP COLUMN eq_referencia;

ALTER TABLE processo
    DROP COLUMN status;

ALTER TABLE pessoa_complementar
    DROP COLUMN descricao_acao;
