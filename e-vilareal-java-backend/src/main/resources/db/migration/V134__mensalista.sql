CREATE TABLE mensalista (
    id BIGINT NOT NULL AUTO_INCREMENT,
    cliente_id BIGINT NOT NULL,
    valor DECIMAL(19, 2) NOT NULL,
    dia_vencimento TINYINT NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_mensalista_cliente (cliente_id),
    CONSTRAINT fk_mensalista_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_mensalista_ativo ON mensalista (ativo);
