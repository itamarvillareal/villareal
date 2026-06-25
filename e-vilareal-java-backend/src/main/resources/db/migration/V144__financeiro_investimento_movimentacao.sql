-- Movimentação BTG (export xlsx) + operações de flip com vínculo ao extrato financeiro_lancamento.

CREATE TABLE IF NOT EXISTS financeiro_investimento_import (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conta_bancaria_id BIGINT NOT NULL,
    arquivo_nome VARCHAR(255) NOT NULL,
    arquivo_hash VARCHAR(64) NULL,
    periodo_inicio DATE NULL,
    periodo_fim DATE NULL,
    total_linhas INT NOT NULL DEFAULT 0,
    linhas_cdb INT NOT NULL DEFAULT 0,
    linhas_vinculadas INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'OK',
    mensagem_erro VARCHAR(2000) NULL,
    importado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_fii_conta (conta_bancaria_id),
    INDEX idx_fii_importado_em (importado_em),
    CONSTRAINT fk_fii_conta_bancaria FOREIGN KEY (conta_bancaria_id) REFERENCES conta_bancaria (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT uk_fii_arquivo_conta_hash UNIQUE (conta_bancaria_id, arquivo_hash),
    CONSTRAINT chk_fii_status CHECK (status IN ('PROCESSANDO', 'OK', 'ERRO'))
);

CREATE TABLE IF NOT EXISTS financeiro_investimento_movimentacao (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    import_id BIGINT NOT NULL,
    conta_bancaria_id BIGINT NOT NULL,
    natureza_mov VARCHAR(10) NOT NULL,
    data_movimentacao DATE NOT NULL,
    tipo_movimentacao VARCHAR(80) NOT NULL,
    produto_raw VARCHAR(500) NOT NULL,
    codigo_produto VARCHAR(40) NULL,
    tipo_produto VARCHAR(10) NULL,
    emissor VARCHAR(120) NULL,
    instituicao VARCHAR(120) NULL,
    quantidade DECIMAL(19, 6) NULL,
    preco_unitario DECIMAL(19, 6) NULL,
    valor_operacao DECIMAL(19, 2) NOT NULL,
    tipo_extrato VARCHAR(1) NULL,
    lancamento_financeiro_id BIGINT NULL,
    vinculo_confianca VARCHAR(10) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_fim_data (data_movimentacao),
    INDEX idx_fim_codigo (codigo_produto),
    INDEX idx_fim_conta (conta_bancaria_id),
    INDEX idx_fim_lancamento (lancamento_financeiro_id),
    CONSTRAINT fk_fim_import FOREIGN KEY (import_id) REFERENCES financeiro_investimento_import (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_fim_conta_bancaria FOREIGN KEY (conta_bancaria_id) REFERENCES conta_bancaria (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_fim_lancamento FOREIGN KEY (lancamento_financeiro_id) REFERENCES financeiro_lancamento (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT uk_fim_dedupe UNIQUE (
        conta_bancaria_id, data_movimentacao, codigo_produto, tipo_movimentacao, natureza_mov, valor_operacao
    ),
    CONSTRAINT chk_fim_natureza_mov CHECK (natureza_mov IN ('CREDITO', 'DEBITO')),
    CONSTRAINT chk_fim_tipo_extrato CHECK (tipo_extrato IS NULL OR tipo_extrato IN ('C', 'V')),
    CONSTRAINT chk_fim_vinculo CHECK (vinculo_confianca IS NULL OR vinculo_confianca IN ('ALTA', 'MEDIA', 'BAIXA'))
);

CREATE TABLE IF NOT EXISTS financeiro_investimento_operacao (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conta_bancaria_id BIGINT NOT NULL,
    codigo_produto VARCHAR(40) NOT NULL,
    tipo_produto VARCHAR(10) NULL,
    emissor VARCHAR(120) NULL,
    status VARCHAR(20) NOT NULL,
    compra_movimentacao_id BIGINT NULL,
    venda_movimentacao_id BIGINT NULL,
    compra_lancamento_id BIGINT NULL,
    venda_lancamento_id BIGINT NULL,
    data_compra DATE NULL,
    data_venda DATE NULL,
    valor_compra_caixa DECIMAL(19, 2) NULL,
    valor_venda_caixa DECIMAL(19, 2) NULL,
    valor_irrf DECIMAL(19, 2) NOT NULL DEFAULT 0,
    valor_iof DECIMAL(19, 2) NOT NULL DEFAULT 0,
    valor_custos DECIMAL(19, 2) NOT NULL DEFAULT 0,
    valor_liquido_entrada DECIMAL(19, 2) NULL,
    lucro_liquido DECIMAL(19, 2) NULL,
    dias_carteira INT NULL,
    taxa_mensal_liquida DECIMAL(12, 8) NULL,
    taxa_anual_liquida DECIMAL(12, 8) NULL,
    vinculo_confianca VARCHAR(10) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_fio_conta (conta_bancaria_id),
    INDEX idx_fio_codigo (codigo_produto),
    INDEX idx_fio_status (status),
    INDEX idx_fio_venda_dt (data_venda),
    CONSTRAINT fk_fio_conta_bancaria FOREIGN KEY (conta_bancaria_id) REFERENCES conta_bancaria (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_fio_compra_mov FOREIGN KEY (compra_movimentacao_id) REFERENCES financeiro_investimento_movimentacao (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_fio_venda_mov FOREIGN KEY (venda_movimentacao_id) REFERENCES financeiro_investimento_movimentacao (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_fio_compra_lanc FOREIGN KEY (compra_lancamento_id) REFERENCES financeiro_lancamento (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_fio_venda_lanc FOREIGN KEY (venda_lancamento_id) REFERENCES financeiro_lancamento (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_fio_status CHECK (status IN ('FECHADA', 'ABERTA', 'LEGADO')),
    CONSTRAINT chk_fio_vinculo CHECK (vinculo_confianca IS NULL OR vinculo_confianca IN ('ALTA', 'MEDIA', 'BAIXA'))
);
