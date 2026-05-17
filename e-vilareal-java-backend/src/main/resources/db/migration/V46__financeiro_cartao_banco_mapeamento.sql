-- Mapeamento débito bancário → cartão (pagamento de fatura).
-- IDs de financeiro_cartao (seed V41): 1=Mastercard, 2=Visa, 3=Mastercard Sicoob, 4=Mastercard Black, 5=BTG Cartão

CREATE TABLE financeiro_cartao_banco_mapeamento (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    cartao_id BIGINT NOT NULL,
    numero_banco INT NOT NULL,
    padrao_descricao VARCHAR(255) NOT NULL,
    tipo_match ENUM('CONTAINS', 'REGEX') NOT NULL DEFAULT 'CONTAINS',
    tolerancia_valor DECIMAL(5, 4) NOT NULL DEFAULT 0.05,
    tolerancia_dias INT NOT NULL DEFAULT 31,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_fcbbm_cartao FOREIGN KEY (cartao_id) REFERENCES financeiro_cartao (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX idx_fcbbm_ativo_cartao ON financeiro_cartao_banco_mapeamento (ativo, cartao_id);

INSERT INTO financeiro_cartao_banco_mapeamento (cartao_id, numero_banco, padrao_descricao, tipo_match) VALUES
    (2, 1, 'CARTAO PERSONNALITE', 'CONTAINS'),
    (2, 1, 'PAGTO ELETRON COBRANCA', 'CONTAINS'),
    (3, 4, 'FATURA MASTERCARD', 'CONTAINS'),
    (4, 1, 'MASTERCARD BLACK', 'CONTAINS'),
    (5, 21, 'FATURA CARTAO', 'CONTAINS');
