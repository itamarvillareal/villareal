-- Documentos da pessoa no Google Drive (Pessoas/{id8} - nome/{tipo}/).
-- Permite reutilizar .p7s assinados em protocolos futuros sem reassinar.

CREATE TABLE pessoa_documento_drive (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pessoa_id BIGINT NOT NULL,
    tipo VARCHAR(40) NOT NULL,
    nome_arquivo VARCHAR(500) NOT NULL,
    drive_file_id VARCHAR(120) NULL,
    p7s_drive_file_id VARCHAR(120) NULL,
    pdf_sha256 CHAR(64) NULL,
    p7s_sha256 CHAR(64) NULL,
    mime_type VARCHAR(120) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_pessoa_documento_drive_pessoa FOREIGN KEY (pessoa_id) REFERENCES pessoa (id),
    CONSTRAINT chk_pessoa_documento_drive_tipo CHECK (
        tipo IN ('DOCUMENTOS', 'PROCURACOES', 'CONTRATOS', 'DECLARACOES', 'ASSINADOS')
    )
);

CREATE INDEX idx_pessoa_documento_drive_pessoa_tipo ON pessoa_documento_drive (pessoa_id, tipo);
