-- Elos auditáveis entre operação de investimento (flip) e lançamentos do extrato.

CREATE TABLE IF NOT EXISTS financeiro_investimento_operacao_lancamento (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    operacao_id BIGINT NOT NULL,
    lancamento_id BIGINT NOT NULL,
    papel VARCHAR(10) NOT NULL,
    valor_alocado DECIMAL(19, 2) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_fiol_operacao (operacao_id),
    INDEX idx_fiol_lancamento (lancamento_id),
    CONSTRAINT uk_fiol_operacao_lancamento UNIQUE (operacao_id, lancamento_id),
    CONSTRAINT fk_fiol_operacao FOREIGN KEY (operacao_id) REFERENCES financeiro_investimento_operacao (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_fiol_lancamento FOREIGN KEY (lancamento_id) REFERENCES financeiro_lancamento (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_fiol_papel CHECK (papel IN ('COMPRA', 'VENDA', 'IRRF', 'IOF', 'CUSTO'))
);
