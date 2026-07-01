-- Regra de início: 1 = importar tudo; 61 = 60+1 condicional (com débito anterior cadastrado).
ALTER TABLE calculo_cliente_config
    DROP CHECK chk_calculo_cliente_config_regra_inicio;

UPDATE calculo_cliente_config
SET regra_inicio_cobranca_dias = 61
WHERE regra_inicio_cobranca_dias IN (30, 60);

ALTER TABLE calculo_cliente_config
    ADD CONSTRAINT chk_calculo_cliente_config_regra_inicio
        CHECK (regra_inicio_cobranca_dias IN (1, 61));

ALTER TABLE calculo_cliente_config
    MODIFY COLUMN regra_inicio_cobranca_dias INT NOT NULL DEFAULT 1
        COMMENT '1=importar tudo; 61=60+1 condicional (débito anterior)';
