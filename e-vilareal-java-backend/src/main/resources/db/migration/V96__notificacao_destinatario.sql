-- Destinatários de notificação: padrão global (processo_id NULL) e override por processo.

CREATE TABLE notificacao_destinatario (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    processo_id BIGINT NULL,
    canal VARCHAR(20) NOT NULL,
    valor VARCHAR(255) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifdest_processo FOREIGN KEY (processo_id) REFERENCES processo (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_notifdest_processo (processo_id),
    INDEX idx_notifdest_canal (canal)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
