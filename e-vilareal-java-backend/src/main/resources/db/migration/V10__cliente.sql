CREATE TABLE cliente (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo_cliente CHAR(8) NOT NULL,
    pessoa_id BIGINT NOT NULL,
    nome_referencia VARCHAR(255) NULL,
    documento_referencia VARCHAR(20) NULL,
    observacao TEXT NULL,
    inativo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_cliente_codigo UNIQUE (codigo_cliente),
    CONSTRAINT fk_cliente_pessoa FOREIGN KEY (pessoa_id) REFERENCES pessoa (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_cliente_pessoa ON cliente (pessoa_id);
CREATE INDEX idx_cliente_inativo ON cliente (inativo);
