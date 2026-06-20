CREATE TABLE contrato_honorarios (
    id BIGINT NOT NULL AUTO_INCREMENT,
    processo_id BIGINT NULL,
    pessoa_id BIGINT NOT NULL,
    data_contrato DATE NOT NULL,
    forma_assinatura VARCHAR(20) NOT NULL,
    objeto_contrato TEXT NULL,
    tipo_remuneracao VARCHAR(30) NOT NULL,
    percentual_proveito DECIMAL(5, 2) NULL,
    valor_fixo DECIMAL(19, 2) NULL,
    clausula3_texto TEXT NOT NULL,
    gerar_recebiveis TINYINT(1) NOT NULL DEFAULT 0,
    valor_total_parcelas DECIMAL(19, 2) NULL,
    quantidade_parcelas INT NULL,
    forma_pagamento_parcelas VARCHAR(40) NULL,
    criado_em TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    criado_por_usuario_id BIGINT NULL,
    PRIMARY KEY (id),
    KEY idx_contrato_honorarios_processo (processo_id),
    KEY idx_contrato_honorarios_pessoa (pessoa_id),
    KEY idx_contrato_honorarios_data (data_contrato),
    CONSTRAINT fk_contrato_honorarios_processo FOREIGN KEY (processo_id) REFERENCES processo (id),
    CONSTRAINT fk_contrato_honorarios_pessoa FOREIGN KEY (pessoa_id) REFERENCES pessoa (id),
    CONSTRAINT fk_contrato_honorarios_usuario FOREIGN KEY (criado_por_usuario_id) REFERENCES usuarios (id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE contrato_honorarios_parcela (
    id BIGINT NOT NULL AUTO_INCREMENT,
    contrato_honorarios_id BIGINT NOT NULL,
    numero_parcela INT NOT NULL,
    valor DECIMAL(19, 2) NOT NULL,
    data_vencimento DATE NOT NULL,
    pagamento_id BIGINT NULL,
    PRIMARY KEY (id),
    KEY idx_chp_contrato (contrato_honorarios_id),
    CONSTRAINT fk_chp_contrato FOREIGN KEY (contrato_honorarios_id) REFERENCES contrato_honorarios (id) ON DELETE CASCADE,
    CONSTRAINT fk_chp_pagamento FOREIGN KEY (pagamento_id) REFERENCES pagamento (id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
