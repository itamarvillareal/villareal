-- Clientes materializados por conversa WhatsApp (phone_number) para abas/grupos por cliente.

CREATE TABLE whatsapp_conversa_cliente (
    id             BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    phone_number   VARCHAR(20)  NOT NULL,
    cliente_codigo CHAR(8)      NOT NULL,
    cliente_nome   VARCHAR(255) NOT NULL,
    atualizado_em  TIMESTAMP(3) NOT NULL,
    UNIQUE KEY uk_wcc_phone_cliente (phone_number, cliente_codigo),
    INDEX idx_wcc_phone (phone_number),
    INDEX idx_wcc_cliente_codigo (cliente_codigo)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
