CREATE TABLE financeiro_pagamento_fatura_vinculo (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    lancamento_banco_id BIGINT NOT NULL,
    lancamento_cartao_id BIGINT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_fpfv_banco FOREIGN KEY (lancamento_banco_id) REFERENCES financeiro_lancamento (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_fpfv_cartao FOREIGN KEY (lancamento_cartao_id) REFERENCES financeiro_lancamento_cartao (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uk_fpfv_banco UNIQUE (lancamento_banco_id),
    CONSTRAINT uk_fpfv_cartao UNIQUE (lancamento_cartao_id)
);

CREATE INDEX idx_fpfv_banco ON financeiro_pagamento_fatura_vinculo (lancamento_banco_id);
CREATE INDEX idx_fpfv_cartao ON financeiro_pagamento_fatura_vinculo (lancamento_cartao_id);
