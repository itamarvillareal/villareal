-- Governança patrimonial: renda recorrente, taxa de referência datada, origem da amortização.

ALTER TABLE patrimonio_parametro
    ADD COLUMN renda_mensal_recorrente DECIMAL(19, 2) NULL AFTER despesas_fixas_mensais,
    ADD COLUMN taxa_referencia_atualizada_em DATETIME(3) NULL AFTER taxa_referencia_liquida_aa,
    ADD COLUMN taxa_referencia_stale_dias INT NOT NULL DEFAULT 30 AFTER taxa_referencia_atualizada_em;

ALTER TABLE patrimonio_amortizacao
    ADD COLUMN origem VARCHAR(30) NOT NULL DEFAULT 'SOLICITACAO' AFTER status,
    ADD COLUMN justificativa_teto TEXT NULL AFTER justificativa_reserva,
    ADD COLUMN ultrapassou_teto TINYINT(1) NOT NULL DEFAULT 0 AFTER justificativa_teto;

-- Índice auxiliar para consumo do teto anual
CREATE INDEX idx_patrimonio_amort_efetivada_ano
    ON patrimonio_amortizacao (status, data_efetivacao);
