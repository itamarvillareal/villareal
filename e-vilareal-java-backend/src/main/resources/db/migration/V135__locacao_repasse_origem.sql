ALTER TABLE locacao_repasse_lancamento
    ADD COLUMN origem VARCHAR(20) NULL AFTER valor;

CREATE INDEX idx_locacao_repasse_origem ON locacao_repasse_lancamento (origem);
