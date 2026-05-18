ALTER TABLE processo
    ADD COLUMN papel_cliente VARCHAR(16) NULL COMMENT 'REQUERENTE ou REQUERIDO' AFTER pasta,
    ADD COLUMN audiencia_data DATE NULL AFTER papel_cliente,
    ADD COLUMN audiencia_hora VARCHAR(5) NULL AFTER audiencia_data,
    ADD COLUMN audiencia_tipo VARCHAR(120) NULL AFTER audiencia_hora,
    ADD COLUMN aviso_audiencia VARCHAR(20) NULL COMMENT 'AVISADO ou NAO_AVISADO' AFTER audiencia_tipo;
