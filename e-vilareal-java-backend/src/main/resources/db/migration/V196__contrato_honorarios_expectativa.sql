ALTER TABLE contrato_honorarios
    ADD COLUMN expectativa_valor_estimado DECIMAL(19, 2) NULL,
    ADD COLUMN expectativa_base_tipo VARCHAR(20) NULL,
    ADD COLUMN expectativa_valor_causa_ref DECIMAL(19, 2) NULL,
    ADD COLUMN expectativa_observacao TEXT NULL;
