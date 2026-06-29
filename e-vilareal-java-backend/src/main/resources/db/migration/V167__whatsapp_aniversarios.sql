CREATE TABLE whatsapp_aniversarios (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pessoa_id BIGINT NOT NULL,
    pessoa_nome VARCHAR(255),
    phone_number VARCHAR(20) NOT NULL,
    data_aniversario DATE NOT NULL,
    ano_envio INT NOT NULL,
    wa_message_id VARCHAR(255),
    status VARCHAR(15) NOT NULL DEFAULT 'SENT',
    error_message VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_aniversario_pessoa_ano (pessoa_id, ano_envio),
    INDEX idx_aniversario_ano (ano_envio),
    INDEX idx_aniversario_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
