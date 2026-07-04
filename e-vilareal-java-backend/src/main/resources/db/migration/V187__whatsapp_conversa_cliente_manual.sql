-- Edições manuais de grupos por cliente (não tocadas pelo job de materialização automática).

CREATE TABLE whatsapp_conversa_cliente_manual (
    id             BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    phone_number   VARCHAR(20)  NOT NULL,
    cliente_codigo CHAR(8)      NOT NULL,
    cliente_nome   VARCHAR(255) NOT NULL,
    acao           VARCHAR(10)  NOT NULL,
    criado_por     VARCHAR(100) NOT NULL,
    criado_em      TIMESTAMP(3) NOT NULL,
    UNIQUE KEY uk_wccm_phone_cliente (phone_number, cliente_codigo),
    INDEX idx_wccm_phone (phone_number),
    INDEX idx_wccm_cliente (cliente_codigo)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
