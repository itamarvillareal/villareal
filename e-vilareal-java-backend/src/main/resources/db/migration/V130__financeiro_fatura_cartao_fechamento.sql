-- Controle de fechamento automático de fatura (crédito-síntese AUTO-FAT no vencimento).
CREATE TABLE financeiro_fatura_cartao_fechamento (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    cartao_id BIGINT NOT NULL,
    data_vencimento DATE NOT NULL,
    lancamento_cartao_id BIGINT NOT NULL,
    valor_total DECIMAL(19, 2) NOT NULL COMMENT 'Soma das compras do ciclo (positiva); o lançamento AUTO-FAT guarda o negativo',
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uk_ffcf_cartao_vencimento UNIQUE (cartao_id, data_vencimento),
    CONSTRAINT uk_ffcf_lancamento UNIQUE (lancamento_cartao_id),
    CONSTRAINT fk_ffcf_cartao FOREIGN KEY (cartao_id) REFERENCES financeiro_cartao (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_ffcf_lancamento FOREIGN KEY (lancamento_cartao_id) REFERENCES financeiro_lancamento_cartao (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX idx_ffcf_vencimento ON financeiro_fatura_cartao_fechamento (data_vencimento);
