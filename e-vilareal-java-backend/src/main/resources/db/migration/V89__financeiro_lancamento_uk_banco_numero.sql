-- Garante unicidade da chave natural de deduplicação do extrato (banco + número do lançamento).
-- Auditoria pré-migration (Fase 1): 38.353 linhas, 0 pares duplicados, 0 numero_banco NULL.

CREATE UNIQUE INDEX uk_fl_numero_banco_lancamento
    ON financeiro_lancamento (numero_banco, numero_lancamento);
