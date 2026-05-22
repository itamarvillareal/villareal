CREATE TABLE prestacao_contas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    cliente_id BIGINT NOT NULL,
    periodo_inicio DATE NOT NULL,
    periodo_fim DATE NOT NULL,
    valor_total_pagamentos DECIMAL(19, 2) NOT NULL DEFAULT 0,
    taxa_administracao_percentual DECIMAL(5, 2) NULL,
    taxa_administracao_valor DECIMAL(19, 2) NULL,
    valor_liquido DECIMAL(19, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'RASCUNHO',
    arquivo_pdf_path VARCHAR(500) NULL,
    gerado_por_usuario_id BIGINT NOT NULL,
    observacoes TEXT NULL,
    criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_pc_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_pc_gerado_por FOREIGN KEY (gerado_por_usuario_id) REFERENCES usuarios (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_pc_status CHECK (status IN ('RASCUNHO', 'ENVIADO', 'APROVADO'))
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
