CREATE TABLE financeiro_regra_classificacao (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    padrao_descricao VARCHAR(255) NOT NULL,
    tipo_match VARCHAR(20) NOT NULL DEFAULT 'CONTAINS',
    conta_contabil_id BIGINT NOT NULL,
    numero_banco INT NULL,
    prioridade INT NOT NULL DEFAULT 100,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    cliente_id BIGINT NULL,
    processo_id BIGINT NULL,
    criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_frc_conta FOREIGN KEY (conta_contabil_id) REFERENCES financeiro_conta_contabil (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_frc_cliente FOREIGN KEY (cliente_id) REFERENCES pessoa (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_frc_processo FOREIGN KEY (processo_id) REFERENCES processo (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_frc_tipo_match CHECK (tipo_match IN ('CONTAINS', 'REGEX', 'EXACT'))
);

CREATE INDEX idx_regra_ativo ON financeiro_regra_classificacao (ativo, prioridade);

INSERT INTO financeiro_regra_classificacao (padrao_descricao, tipo_match, conta_contabil_id, prioridade) VALUES
    ('CARTAO PERSONNALITE', 'CONTAINS', (SELECT id FROM financeiro_conta_contabil WHERE codigo = 'E'), 10),
    ('PAGTO ELETRON', 'CONTAINS', (SELECT id FROM financeiro_conta_contabil WHERE codigo = 'E'), 10),
    ('FATURA MASTERCARD', 'CONTAINS', (SELECT id FROM financeiro_conta_contabil WHERE codigo = 'E'), 10),
    ('SAQUE', 'CONTAINS', (SELECT id FROM financeiro_conta_contabil WHERE codigo = 'C'), 50),
    ('RENDIMENTO', 'CONTAINS', (SELECT id FROM financeiro_conta_contabil WHERE codigo = 'F'), 50),
    ('APLICACAO', 'CONTAINS', (SELECT id FROM financeiro_conta_contabil WHERE codigo = 'F'), 50),
    ('RESGATE', 'CONTAINS', (SELECT id FROM financeiro_conta_contabil WHERE codigo = 'F'), 50);
