CREATE TABLE contrato_honorarios_cobranca_armada (
    id                      BIGINT NOT NULL AUTO_INCREMENT,
    contrato_honorarios_id  BIGINT NOT NULL,
    importacao_id           BIGINT NULL,
    armado_por_usuario_id   BIGINT NOT NULL,
    armado_em               TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_chca_contrato (contrato_honorarios_id),
    CONSTRAINT fk_chca_contrato FOREIGN KEY (contrato_honorarios_id) REFERENCES contrato_honorarios (id),
    CONSTRAINT fk_chca_importacao FOREIGN KEY (importacao_id) REFERENCES contrato_honorarios_importacao (id),
    CONSTRAINT fk_chca_usuario FOREIGN KEY (armado_por_usuario_id) REFERENCES usuarios (id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
