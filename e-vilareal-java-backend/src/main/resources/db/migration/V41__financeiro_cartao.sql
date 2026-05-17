CREATE TABLE financeiro_cartao (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    numero_cartao INT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    ordem_exibicao INT NOT NULL DEFAULT 0,
    CONSTRAINT uk_fin_cartao_nome UNIQUE (nome),
    CONSTRAINT uk_fin_cartao_numero UNIQUE (numero_cartao)
);

INSERT INTO financeiro_cartao (nome, numero_cartao, ordem_exibicao) VALUES
    ('Mastercard', 7, 70),
    ('Visa', 8, 80),
    ('Mastercard Sicoob', 16, 160),
    ('Mastercard Black', 19, 190),
    ('BTG Cartão', 20, 200);

CREATE TABLE financeiro_lancamento_cartao (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    cartao_id BIGINT NOT NULL,
    conta_contabil_id BIGINT NOT NULL,
    cliente_id BIGINT NULL,
    processo_id BIGINT NULL,
    numero_lancamento VARCHAR(80) NOT NULL,
    data_lancamento DATE NOT NULL,
    data_competencia DATE NULL,
    descricao VARCHAR(500) NOT NULL,
    descricao_detalhada VARCHAR(2000) NULL,
    valor DECIMAL(19, 2) NOT NULL COMMENT 'Sinal da fatura: compra positiva, estorno negativo',
    ref_tipo VARCHAR(1) NOT NULL DEFAULT 'N',
    origem VARCHAR(40) NOT NULL DEFAULT 'MANUAL',
    status VARCHAR(20) NOT NULL DEFAULT 'ATIVO',
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_flc_cartao FOREIGN KEY (cartao_id) REFERENCES financeiro_cartao (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_flc_conta FOREIGN KEY (conta_contabil_id) REFERENCES financeiro_conta_contabil (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_flc_cliente FOREIGN KEY (cliente_id) REFERENCES pessoa (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_flc_processo FOREIGN KEY (processo_id) REFERENCES processo (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_flc_ref CHECK (ref_tipo IN ('N', 'R'))
);

CREATE INDEX idx_flc_cartao ON financeiro_lancamento_cartao (cartao_id);
CREATE INDEX idx_flc_data ON financeiro_lancamento_cartao (data_lancamento);
CREATE INDEX idx_flc_cliente ON financeiro_lancamento_cartao (cliente_id);
CREATE INDEX idx_flc_processo ON financeiro_lancamento_cartao (processo_id);
CREATE INDEX idx_flc_conta ON financeiro_lancamento_cartao (conta_contabil_id);
