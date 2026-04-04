CREATE TABLE financeiro_conta_contabil (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(4) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    ordem_exibicao INT NOT NULL DEFAULT 0,
    CONSTRAINT uk_fin_cc_codigo UNIQUE (codigo),
    CONSTRAINT uk_fin_cc_nome UNIQUE (nome)
);

INSERT INTO financeiro_conta_contabil (codigo, nome, ativo, ordem_exibicao) VALUES
    ('A', 'Conta Escritório', TRUE, 10),
    ('B', 'Conta Trabalhos Extras', TRUE, 20),
    ('C', 'Conta Pessoal', TRUE, 30),
    ('D', 'Conta Veredas', TRUE, 40),
    ('N', 'Conta Não Identificados', TRUE, 50),
    ('E', 'Conta Compensação', TRUE, 60),
    ('F', 'Conta Fundos Investimentos', TRUE, 70),
    ('M', 'Conta Marcenaria', TRUE, 80),
    ('R', 'Conta Rachel', TRUE, 90),
    ('P', 'Conta Pessoa Jurídica', TRUE, 100),
    ('I', 'Conta Imóveis', TRUE, 110),
    ('J', 'Conta Julio', TRUE, 120);

CREATE TABLE financeiro_lancamento (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conta_contabil_id BIGINT NOT NULL,
    cliente_id BIGINT NULL,
    processo_id BIGINT NULL,
    banco_nome VARCHAR(120) NULL,
    numero_banco INT NULL,
    numero_lancamento VARCHAR(80) NOT NULL,
    data_lancamento DATE NOT NULL,
    data_competencia DATE NULL,
    descricao VARCHAR(500) NOT NULL,
    descricao_detalhada VARCHAR(2000) NULL,
    valor DECIMAL(19, 2) NOT NULL,
    natureza VARCHAR(10) NOT NULL,
    ref_tipo VARCHAR(1) NOT NULL DEFAULT 'N',
    eq_referencia VARCHAR(120) NULL,
    parcela_ref VARCHAR(80) NULL,
    origem VARCHAR(40) NOT NULL DEFAULT 'MANUAL',
    status VARCHAR(20) NOT NULL DEFAULT 'ATIVO',
    classificacao_financeira_id BIGINT NULL,
    elo_financeiro_id BIGINT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_fl_conta FOREIGN KEY (conta_contabil_id) REFERENCES financeiro_conta_contabil (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_fl_cliente FOREIGN KEY (cliente_id) REFERENCES pessoa (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_fl_processo FOREIGN KEY (processo_id) REFERENCES processo (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_fl_natureza CHECK (natureza IN ('DEBITO', 'CREDITO')),
    CONSTRAINT chk_fl_ref CHECK (ref_tipo IN ('N', 'R'))
);

CREATE INDEX idx_fl_data ON financeiro_lancamento (data_lancamento);
CREATE INDEX idx_fl_cliente ON financeiro_lancamento (cliente_id);
CREATE INDEX idx_fl_processo ON financeiro_lancamento (processo_id);
CREATE INDEX idx_fl_conta ON financeiro_lancamento (conta_contabil_id);
