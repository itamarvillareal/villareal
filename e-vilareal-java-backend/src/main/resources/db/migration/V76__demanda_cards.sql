-- Cards de demandas para administração de imóveis

CREATE TABLE demanda (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    imovel_id BIGINT NOT NULL,
    cliente_id BIGINT NOT NULL,
    pagamento_id BIGINT NULL,
    descricao VARCHAR(500) NOT NULL,
    categoria VARCHAR(50) NOT NULL,
    fornecedor_texto VARCHAR(255) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ABERTO',
    gera_valor_contabil BOOLEAN NOT NULL DEFAULT FALSE,
    valor_estimado DECIMAL(15, 2) NULL,
    pago_pelo_escritorio BOOLEAN NOT NULL DEFAULT FALSE,
    reembolsavel_cliente BOOLEAN NOT NULL DEFAULT FALSE,
    prazo_cumprimento DATE NULL,
    prazo_finalizacao DATE NULL,
    observacoes TEXT NULL,
    criado_por BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_demanda_imovel FOREIGN KEY (imovel_id) REFERENCES imovel (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_demanda_cliente FOREIGN KEY (cliente_id) REFERENCES cliente (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_demanda_pagamento FOREIGN KEY (pagamento_id) REFERENCES pagamento (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_demanda_usuario FOREIGN KEY (criado_por) REFERENCES usuarios (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_demanda_imovel (imovel_id),
    INDEX idx_demanda_cliente (cliente_id),
    INDEX idx_demanda_status (status),
    INDEX idx_demanda_prazo_fin (prazo_finalizacao),
    INDEX idx_demanda_pagamento (pagamento_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE demanda_historico (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    demanda_id BIGINT NOT NULL,
    status_anterior VARCHAR(30) NULL,
    status_novo VARCHAR(30) NOT NULL,
    descricao_acao VARCHAR(500) NULL,
    usuario_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_demhist_demanda FOREIGN KEY (demanda_id) REFERENCES demanda (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_demhist_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    INDEX idx_demhist_demanda (demanda_id),
    INDEX idx_demhist_data (created_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
