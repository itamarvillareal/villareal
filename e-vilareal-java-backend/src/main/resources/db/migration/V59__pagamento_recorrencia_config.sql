CREATE TABLE pagamento_recorrencia_config (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    imovel_id BIGINT NOT NULL,
    cliente_id BIGINT NULL,
    contrato_locacao_id BIGINT NULL,
    categoria VARCHAR(40) NOT NULL,
    descricao_padrao VARCHAR(500) NOT NULL,
    conta_referencia VARCHAR(50) NULL,
    dia_vencimento TINYINT NOT NULL,
    valor_estimado DECIMAL(19, 2) NULL,
    forma_pagamento VARCHAR(40) NOT NULL,
    responsavel_usuario_id BIGINT NULL,
    prioridade VARCHAR(24) NOT NULL DEFAULT 'NORMAL',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_por_usuario_id BIGINT NOT NULL,
    criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_prc_imovel FOREIGN KEY (imovel_id) REFERENCES imovel (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_prc_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_prc_contrato FOREIGN KEY (contrato_locacao_id) REFERENCES contrato_locacao (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_prc_responsavel FOREIGN KEY (responsavel_usuario_id) REFERENCES usuarios (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_prc_criado_por FOREIGN KEY (criado_por_usuario_id) REFERENCES usuarios (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_prc_dia_vencimento CHECK (dia_vencimento BETWEEN 1 AND 31)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE pagamento
    ADD COLUMN recorrencia_config_id BIGINT NULL AFTER auto_gerado,
    ADD CONSTRAINT fk_pag_recorrencia_config FOREIGN KEY (recorrencia_config_id)
        REFERENCES pagamento_recorrencia_config (id) ON DELETE SET NULL ON UPDATE CASCADE;
