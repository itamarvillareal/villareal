-- FK real do repasse interno -> vínculo de ALUGUEL de origem (Fase 3, item 2 — resolve C7/A10).
--
-- Antes, o débito de repasse interno (banco virtual 900) se ligava ao vínculo ALUGUEL apenas pela
-- string numero_lancamento = 'AUTO-REP-{aluguelVinculoId}-D', e a idempotência/reversão dependiam de
-- parsear essa string. A ligação passa a ser uma FK real self-ref em locacao_repasse_lancamento:
-- o vínculo REPASSE aponta origem_aluguel_vinculo_id para o vínculo ALUGUEL que o originou.
-- A string permanece apenas como rótulo (numero_lancamento) — não é mais o mecanismo de ligação.
--
-- Backward-compatible: coluna NULL; o backfill abaixo (única vez que ainda se parseia a string)
-- popula os vínculos REPASSE já existentes antes do app novo atender. ON DELETE SET NULL: remover
-- o ALUGUEL não apaga o REPASSE em cascata (a remoção do par é feita no código, pela FK).
--
-- Rollback:
--   ALTER TABLE locacao_repasse_lancamento DROP FOREIGN KEY fk_lrl_origem_aluguel;
--   DROP INDEX idx_lrl_origem_aluguel ON locacao_repasse_lancamento;
--   ALTER TABLE locacao_repasse_lancamento DROP COLUMN origem_aluguel_vinculo_id;

ALTER TABLE locacao_repasse_lancamento
    ADD COLUMN origem_aluguel_vinculo_id BIGINT NULL;

ALTER TABLE locacao_repasse_lancamento
    ADD CONSTRAINT fk_lrl_origem_aluguel
        FOREIGN KEY (origem_aluguel_vinculo_id)
        REFERENCES locacao_repasse_lancamento (id)
        ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX idx_lrl_origem_aluguel ON locacao_repasse_lancamento (origem_aluguel_vinculo_id);

-- Backfill (único ponto que ainda parseia 'AUTO-REP-{id}-D'): liga cada vínculo REPASSE de débito
-- AUTO ao vínculo ALUGUEL cujo id está embutido no numero_lancamento do débito. O JOIN com alu
-- garante que só populamos quando o id parseado é mesmo um vínculo ALUGUEL existente.
UPDATE locacao_repasse_lancamento rep
    JOIN financeiro_lancamento fl ON fl.id = rep.lancamento_financeiro_id
    JOIN locacao_repasse_lancamento alu
        ON alu.id = CAST(
            SUBSTRING(fl.numero_lancamento, LENGTH('AUTO-REP-') + 1,
                      LENGTH(fl.numero_lancamento) - LENGTH('AUTO-REP-') - LENGTH('-D')) AS UNSIGNED)
        AND alu.papel = 'ALUGUEL'
SET rep.origem_aluguel_vinculo_id = alu.id
WHERE rep.papel = 'REPASSE'
  AND fl.numero_banco = 900
  AND fl.numero_lancamento LIKE 'AUTO-REP-%-D';
