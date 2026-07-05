-- Fila de lotes para assinatura automática via assinador local (pull PKCS#11 no Windows).

CREATE TABLE assinatura_lote (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    status VARCHAR(30) NOT NULL DEFAULT 'LIBERADO',
    peticao_ids JSON NOT NULL,
    credencial_id BIGINT NOT NULL,
    erro_codigo VARCHAR(60) NULL,
    erro_mensagem TEXT NULL,
    locked_at TIMESTAMP(3) NULL,
    locked_by VARCHAR(120) NULL,
    resultado_json JSON NULL,
    criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_assinatura_lote_credencial FOREIGN KEY (credencial_id) REFERENCES projudi_credencial (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_assinatura_lote_status (status),
    INDEX idx_assinatura_lote_status_criado (status, criado_em)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
