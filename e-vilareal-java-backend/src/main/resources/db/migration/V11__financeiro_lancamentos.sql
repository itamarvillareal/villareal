CREATE TABLE lancamentos_financeiros (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conta_contabil_id BIGINT NOT NULL,
    classificacao_financeira_id BIGINT NULL,
    elo_financeiro_id BIGINT NULL,
    cliente_id BIGINT NULL,
    processo_id BIGINT NULL,
    usuario_id BIGINT NULL,
    banco_nome VARCHAR(120) NULL,
    numero_banco INT NULL,
    numero_lancamento VARCHAR(50) NOT NULL,
    data_lancamento DATE NOT NULL,
    data_competencia DATE NULL,
    descricao VARCHAR(500) NOT NULL,
    descricao_detalhada TEXT NULL,
    documento_referencia VARCHAR(120) NULL,
    valor DECIMAL(15,2) NOT NULL,
    natureza VARCHAR(20) NOT NULL,
    ref_tipo VARCHAR(1) NOT NULL DEFAULT 'N',
    eq_referencia VARCHAR(120) NULL,
    parcela_ref VARCHAR(30) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ATIVO',
    origem VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    observacao TEXT NULL,
    metadados_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_lanc_fin_conta_contabil FOREIGN KEY (conta_contabil_id) REFERENCES contas_contabeis (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_lanc_fin_classificacao FOREIGN KEY (classificacao_financeira_id) REFERENCES classificacoes_financeiras (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_lanc_fin_elo FOREIGN KEY (elo_financeiro_id) REFERENCES elos_financeiros (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_lanc_fin_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_lanc_fin_processo FOREIGN KEY (processo_id) REFERENCES processos (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_lanc_fin_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX idx_lanc_fin_data_lancamento ON lancamentos_financeiros (data_lancamento);
CREATE INDEX idx_lanc_fin_data_competencia ON lancamentos_financeiros (data_competencia);
CREATE INDEX idx_lanc_fin_cliente_id ON lancamentos_financeiros (cliente_id);
CREATE INDEX idx_lanc_fin_processo_id ON lancamentos_financeiros (processo_id);
CREATE INDEX idx_lanc_fin_conta_id ON lancamentos_financeiros (conta_contabil_id);
CREATE INDEX idx_lanc_fin_classificacao_id ON lancamentos_financeiros (classificacao_financeira_id);
CREATE INDEX idx_lanc_fin_elo_id ON lancamentos_financeiros (elo_financeiro_id);
CREATE INDEX idx_lanc_fin_natureza ON lancamentos_financeiros (natureza);
CREATE INDEX idx_lanc_fin_status ON lancamentos_financeiros (status);
CREATE INDEX idx_lanc_fin_origem ON lancamentos_financeiros (origem);
CREATE INDEX idx_lanc_fin_banco_numero ON lancamentos_financeiros (banco_nome, numero_lancamento);
CREATE INDEX idx_lanc_fin_eq_ref ON lancamentos_financeiros (eq_referencia);
