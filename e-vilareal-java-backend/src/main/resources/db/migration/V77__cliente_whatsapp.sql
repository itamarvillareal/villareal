CREATE TABLE cliente_whatsapp (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    cliente_id BIGINT NOT NULL,
    pessoa_id BIGINT NULL,
    pessoa_contato_id BIGINT NULL,
    numero VARCHAR(20) NOT NULL,
    nome_label VARCHAR(120) NULL,
    principal BOOLEAN NOT NULL DEFAULT FALSE,
    preenchido_automaticamente BOOLEAN NOT NULL DEFAULT FALSE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_cliente_whatsapp_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_cliente_whatsapp_pessoa FOREIGN KEY (pessoa_id) REFERENCES pessoa (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_cliente_whatsapp_pessoa_contato FOREIGN KEY (pessoa_contato_id) REFERENCES pessoa_contato (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT uk_cliente_whatsapp_numero UNIQUE (cliente_id, numero)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_cliente_whatsapp_cliente ON cliente_whatsapp (cliente_id);
CREATE INDEX idx_cliente_whatsapp_numero ON cliente_whatsapp (numero);
CREATE INDEX idx_cliente_whatsapp_pessoa ON cliente_whatsapp (pessoa_id);
