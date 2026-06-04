-- Regra de início de cobrança por cliente (dias: 1, 30 ou 60).
ALTER TABLE calculo_cliente_config
    ADD COLUMN regra_inicio_cobranca_dias INT NOT NULL DEFAULT 1
        COMMENT 'Dias para início de cobrança: 1, 30 ou 60' AFTER payload_json;

ALTER TABLE calculo_cliente_config
    ADD CONSTRAINT chk_calculo_cliente_config_regra_inicio
        CHECK (regra_inicio_cobranca_dias IN (1, 30, 60));
