-- Fase 7: repasses ao locador e despesas de locação (com vínculo opcional ao financeiro)

CREATE TABLE repasses_locador (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    contrato_id BIGINT NOT NULL,
    competencia_mes CHAR(7) NOT NULL COMMENT 'YYYY-MM — competência mensal',
    valor_recebido_inquilino DECIMAL(15, 2) NULL COMMENT 'Aluguel / recebimentos do inquilino no mês',
    valor_repassado_locador DECIMAL(15, 2) NULL COMMENT 'Efetivamente repassado ao locador',
    valor_despesas_repassar DECIMAL(15, 2) NULL DEFAULT 0 COMMENT 'Despesas a descontar do repasse',
    remuneracao_escritorio DECIMAL(15, 2) NULL COMMENT 'Diferença operacional (pode ser calculada na UI ou informada)',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE' COMMENT 'PENDENTE, CONFIRMADO, CANCELADO',
    data_repasse_efetiva DATE NULL,
    observacao TEXT NULL,
    lancamento_financeiro_vinculo_id BIGINT NULL COMMENT 'Lançamento espelho opcional (ex.: repasse registrado no financeiro)',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_repasses_contrato FOREIGN KEY (contrato_id) REFERENCES contratos_locacao (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_repasses_lancamento FOREIGN KEY (lancamento_financeiro_vinculo_id) REFERENCES lancamentos_financeiros (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT uk_repasses_contrato_competencia UNIQUE (contrato_id, competencia_mes)
);

CREATE INDEX idx_repasses_contrato ON repasses_locador (contrato_id);
CREATE INDEX idx_repasses_competencia ON repasses_locador (competencia_mes);
CREATE INDEX idx_repasses_status ON repasses_locador (status);

CREATE TABLE despesas_locacao (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    contrato_id BIGINT NOT NULL,
    competencia_mes CHAR(7) NULL COMMENT 'YYYY-MM quando aplicável',
    descricao VARCHAR(500) NOT NULL,
    valor DECIMAL(15, 2) NOT NULL,
    categoria VARCHAR(40) NOT NULL DEFAULT 'OUTROS' COMMENT 'REPASSE_ADMIN, ADMINISTRACAO, OUTROS',
    lancamento_financeiro_id BIGINT NULL COMMENT 'Quando a despesa é o próprio lançamento financeiro',
    observacao TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_despesas_contrato FOREIGN KEY (contrato_id) REFERENCES contratos_locacao (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_despesas_lancamento FOREIGN KEY (lancamento_financeiro_id) REFERENCES lancamentos_financeiros (id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX idx_despesas_contrato ON despesas_locacao (contrato_id);
CREATE INDEX idx_despesas_competencia ON despesas_locacao (competencia_mes);
CREATE INDEX idx_despesas_lancamento ON despesas_locacao (lancamento_financeiro_id);
