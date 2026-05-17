ALTER TABLE financeiro_lancamento
    ADD COLUMN grupo_compensacao VARCHAR(40) NULL
        COMMENT 'Par de compensação (planilha col. M ou Elo UI)';

CREATE INDEX idx_fl_grupo_compensacao ON financeiro_lancamento (grupo_compensacao);
