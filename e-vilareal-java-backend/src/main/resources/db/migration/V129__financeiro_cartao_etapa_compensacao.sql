ALTER TABLE financeiro_lancamento_cartao
    ADD COLUMN descricao_norm VARCHAR(255) NULL AFTER descricao_detalhada,
    ADD COLUMN etapa VARCHAR(20) NOT NULL DEFAULT 'IMPORTADO' AFTER status,
    ADD COLUMN grupo_compensacao VARCHAR(40) NULL AFTER etapa;

UPDATE financeiro_lancamento_cartao flc
INNER JOIN financeiro_conta_contabil c ON c.id = flc.conta_contabil_id
SET flc.etapa = CASE
    WHEN UPPER(TRIM(c.codigo)) = 'N' THEN 'IMPORTADO'
    WHEN UPPER(TRIM(c.codigo)) = 'E'
        AND flc.grupo_compensacao IS NOT NULL AND TRIM(flc.grupo_compensacao) <> '' THEN 'COMPENSADO'
    WHEN UPPER(TRIM(c.codigo)) = 'A' AND flc.cliente_id IS NOT NULL THEN 'VINCULADO'
    ELSE 'CLASSIFICADO'
END;

CREATE INDEX idx_flc_etapa ON financeiro_lancamento_cartao (etapa);
CREATE INDEX idx_flc_cartao_etapa ON financeiro_lancamento_cartao (cartao_id, etapa);
CREATE INDEX idx_flc_desc_norm ON financeiro_lancamento_cartao (descricao_norm, cartao_id);
