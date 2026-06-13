ALTER TABLE financeiro_lancamento
    ADD COLUMN descricao_norm VARCHAR(255) NULL AFTER descricao_detalhada;

CREATE INDEX idx_fl_norm_banco_conta
    ON financeiro_lancamento (descricao_norm, numero_banco, conta_contabil_id);

CREATE INDEX idx_fl_etapa_norm_banco
    ON financeiro_lancamento (etapa, numero_banco, descricao_norm);
