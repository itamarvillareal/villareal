-- Staging de petições PROJUDI para assinatura e protocolo (Fase 2).

CREATE TABLE projudi_peticao (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    credencial_id BIGINT NOT NULL,
    numero_processo VARCHAR(40) NOT NULL,
    complemento TEXT NULL,
    id_movimentacao_tipo INT NOT NULL DEFAULT 260,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDENTE_ASSINATURA',
    protocolo_mensagem TEXT NULL,
    protocolado_em TIMESTAMP(3) NULL,
    criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_projudi_peticao_credencial FOREIGN KEY (credencial_id) REFERENCES projudi_credencial (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_projudi_peticao_status (status)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE projudi_peticao_arquivo (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    peticao_id BIGINT NOT NULL,
    ordem INT NOT NULL,
    id_arquivo_tipo INT NOT NULL,
    nome_original VARCHAR(255) NULL,
    pdf_sha256 CHAR(64) NOT NULL,
    pdf_ref VARCHAR(500) NOT NULL,
    drive_file_id VARCHAR(120) NULL,
    p7s_sha256 CHAR(64) NULL,
    conteudo_assinado_sha256 CHAR(64) NULL,
    p7s_ref VARCHAR(500) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDENTE_ASSINATURA',
    criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_projudi_peticao_arquivo_peticao FOREIGN KEY (peticao_id) REFERENCES projudi_peticao (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_projudi_peticao_arquivo_pdf_sha256 (pdf_sha256)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
