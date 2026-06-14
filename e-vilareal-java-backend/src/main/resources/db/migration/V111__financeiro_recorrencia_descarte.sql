CREATE TABLE financeiro_recorrencia_descarte (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    descricao_norm VARCHAR(255) NOT NULL,
    numero_banco INT NOT NULL,
    somente_vinculo BOOLEAN NOT NULL DEFAULT FALSE,
    cliente_id BIGINT NOT NULL DEFAULT 0,
    processo_id BIGINT NOT NULL DEFAULT 0,
    criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT uk_frd_escopo UNIQUE (descricao_norm, numero_banco, somente_vinculo, cliente_id, processo_id)
);

CREATE INDEX idx_frd_padrao ON financeiro_recorrencia_descarte (descricao_norm, numero_banco);
