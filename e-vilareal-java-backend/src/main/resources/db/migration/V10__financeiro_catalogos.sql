CREATE TABLE contas_contabeis (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(10) NOT NULL,
    nome VARCHAR(120) NOT NULL,
    tipo VARCHAR(30) NOT NULL DEFAULT 'OPERACIONAL',
    natureza_padrao VARCHAR(20) NULL,
    grupo_contabil VARCHAR(80) NULL,
    aceita_vinculo_processo BOOLEAN NOT NULL DEFAULT FALSE,
    aceita_compensacao BOOLEAN NOT NULL DEFAULT FALSE,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    ordem_exibicao INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_contas_contabeis_codigo UNIQUE (codigo),
    CONSTRAINT uk_contas_contabeis_nome UNIQUE (nome)
);

CREATE INDEX idx_contas_contabeis_ativa ON contas_contabeis (ativa);
CREATE INDEX idx_contas_contabeis_ordem ON contas_contabeis (ordem_exibicao);

CREATE TABLE classificacoes_financeiras (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL,
    nome VARCHAR(120) NOT NULL,
    categoria VARCHAR(30) NOT NULL DEFAULT 'GERAL',
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_classificacoes_financeiras_codigo UNIQUE (codigo),
    CONSTRAINT uk_classificacoes_financeiras_nome UNIQUE (nome)
);

CREATE INDEX idx_classificacoes_financeiras_ativa ON classificacoes_financeiras (ativa);
CREATE INDEX idx_classificacoes_financeiras_categoria ON classificacoes_financeiras (categoria);

CREATE TABLE elos_financeiros (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL,
    tipo VARCHAR(30) NOT NULL DEFAULT 'COMPENSACAO',
    descricao VARCHAR(255) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ABERTO',
    data_referencia DATE NULL,
    observacao TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_elos_financeiros_codigo UNIQUE (codigo)
);

CREATE INDEX idx_elos_financeiros_tipo ON elos_financeiros (tipo);
CREATE INDEX idx_elos_financeiros_status ON elos_financeiros (status);
CREATE INDEX idx_elos_financeiros_data_ref ON elos_financeiros (data_referencia);

INSERT INTO contas_contabeis
    (codigo, nome, tipo, natureza_padrao, grupo_contabil, aceita_vinculo_processo, aceita_compensacao, ativa, ordem_exibicao)
VALUES
    ('A', 'Conta Escritório', 'OPERACIONAL', 'CREDITO', 'OPERACIONAL', TRUE, FALSE, TRUE, 10),
    ('B', 'Conta Trabalhos Extras', 'OPERACIONAL', 'CREDITO', 'OPERACIONAL', TRUE, FALSE, TRUE, 20),
    ('C', 'Conta Pessoal', 'OPERACIONAL', 'DEBITO', 'PESSOAL', FALSE, FALSE, TRUE, 30),
    ('D', 'Conta Veredas', 'OPERACIONAL', 'CREDITO', 'OPERACIONAL', TRUE, FALSE, TRUE, 40),
    ('N', 'Conta Não Identificados', 'TRANSITORIA', NULL, 'TRANSITORIA', FALSE, FALSE, TRUE, 50),
    ('E', 'Conta Compensação', 'COMPENSACAO', NULL, 'COMPENSACAO', FALSE, TRUE, TRUE, 60),
    ('F', 'Conta Fundos Investimentos', 'INVESTIMENTO', NULL, 'INVESTIMENTO', FALSE, FALSE, TRUE, 70),
    ('M', 'Conta Marcenaria', 'OPERACIONAL', NULL, 'OPERACIONAL', TRUE, FALSE, TRUE, 80),
    ('R', 'Conta Rachel', 'OPERACIONAL', NULL, 'OPERACIONAL', TRUE, FALSE, TRUE, 90),
    ('P', 'Conta Pessoa Jurídica', 'OPERACIONAL', NULL, 'OPERACIONAL', TRUE, FALSE, TRUE, 100),
    ('I', 'Conta Imóveis', 'OPERACIONAL', NULL, 'IMOVEIS', TRUE, FALSE, TRUE, 110),
    ('J', 'Conta Julio', 'OPERACIONAL', NULL, 'OPERACIONAL', TRUE, FALSE, TRUE, 120);

INSERT INTO classificacoes_financeiras (codigo, nome, categoria, ativa) VALUES
    ('ALUGUEL', 'Aluguel', 'IMOVEIS', TRUE),
    ('REPASSE', 'Repasse', 'IMOVEIS', TRUE),
    ('HONORARIOS', 'Honorários', 'JURIDICO', TRUE),
    ('DESPESA_PROCESSUAL', 'Despesa Processual', 'JURIDICO', TRUE),
    ('TRANSFERENCIA_INTERNA', 'Transferência Interna', 'COMPENSACAO', TRUE),
    ('OUTROS', 'Outros', 'GERAL', TRUE);
