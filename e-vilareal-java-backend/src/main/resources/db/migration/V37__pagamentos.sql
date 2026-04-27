CREATE TABLE pagamento (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    data_cadastro DATE NOT NULL,
    data_agendamento DATE NULL,
    data_vencimento DATE NOT NULL,
    codigo_barras VARCHAR(180) NULL,
    valor DECIMAL(19, 2) NOT NULL,
    descricao VARCHAR(500) NOT NULL,
    categoria VARCHAR(40) NOT NULL,
    forma_pagamento VARCHAR(40) NOT NULL,
    responsavel_usuario_id BIGINT NULL,
    status VARCHAR(40) NOT NULL,
    prioridade VARCHAR(24) NOT NULL DEFAULT 'NORMAL',
    origem VARCHAR(120) NULL,
    data_pagamento_efetivo DATE NULL,
    observacoes TEXT NULL,
    boleto_arquivo_path VARCHAR(500) NULL,
    comprovante_arquivo_path VARCHAR(500) NULL,
    cliente_id BIGINT NULL,
    processo_id BIGINT NULL,
    imovel_id BIGINT NULL,
    condominio_texto VARCHAR(255) NULL,
    contrato_locacao_id BIGINT NULL,
    fornecedor_texto VARCHAR(255) NULL,
    recorrente BOOLEAN NOT NULL DEFAULT FALSE,
    recorrencia_tipo VARCHAR(20) NULL,
    recorrencia_quantidade_parcelas INT NULL,
    recorrencia_parcela_atual INT NULL,
    recorrencia_valor_fixo BOOLEAN NULL,
    recorrencia_descricao_padrao VARCHAR(500) NULL,
    recorrencia_pagamento_origem_id BIGINT NULL,
    substituido_por_pagamento_id BIGINT NULL,
    cancelado_em TIMESTAMP(3) NULL,
    criado_por_usuario_id BIGINT NOT NULL,
    atualizado_por_usuario_id BIGINT NULL,
    criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_pag_responsavel FOREIGN KEY (responsavel_usuario_id) REFERENCES usuarios (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_pag_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_pag_processo FOREIGN KEY (processo_id) REFERENCES processo (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_pag_imovel FOREIGN KEY (imovel_id) REFERENCES imovel (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_pag_contrato FOREIGN KEY (contrato_locacao_id) REFERENCES contrato_locacao (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_pag_criado_por FOREIGN KEY (criado_por_usuario_id) REFERENCES usuarios (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_pag_atualizado_por FOREIGN KEY (atualizado_por_usuario_id) REFERENCES usuarios (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_pag_vencimento ON pagamento (data_vencimento);
CREATE INDEX idx_pag_status ON pagamento (status);
CREATE INDEX idx_pag_agendamento ON pagamento (data_agendamento);
CREATE INDEX idx_pag_responsavel ON pagamento (responsavel_usuario_id);
CREATE INDEX idx_pag_cliente ON pagamento (cliente_id);
CREATE INDEX idx_pag_processo ON pagamento (processo_id);
CREATE INDEX idx_pag_categoria ON pagamento (categoria);

ALTER TABLE pagamento
    ADD CONSTRAINT fk_pag_rec_origem FOREIGN KEY (recorrencia_pagamento_origem_id) REFERENCES pagamento (id)
        ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE pagamento
    ADD CONSTRAINT fk_pag_substituido FOREIGN KEY (substituido_por_pagamento_id) REFERENCES pagamento (id)
        ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE pagamento_historico (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pagamento_id BIGINT NOT NULL,
    usuario_id BIGINT NOT NULL,
    acao VARCHAR(80) NOT NULL,
    status_anterior VARCHAR(40) NULL,
    status_novo VARCHAR(40) NULL,
    dados_alterados_json TEXT NULL,
    observacao VARCHAR(500) NULL,
    criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_ph_pagamento FOREIGN KEY (pagamento_id) REFERENCES pagamento (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_ph_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_ph_pagamento ON pagamento_historico (pagamento_id);
CREATE INDEX idx_ph_criado ON pagamento_historico (criado_em);
