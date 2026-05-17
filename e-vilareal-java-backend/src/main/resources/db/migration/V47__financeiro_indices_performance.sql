-- Índices adicionais (V44 já criou etapa, etapa+banco, etapa+data).

CREATE INDEX idx_lanc_etapa_conta_data
    ON financeiro_lancamento (etapa, conta_contabil_id, data_lancamento);

CREATE INDEX idx_lanc_banco_data
    ON financeiro_lancamento (numero_banco, data_lancamento);

CREATE INDEX idx_lanc_descricao_prefix
    ON financeiro_lancamento (descricao(100));

CREATE INDEX idx_lanc_cliente_processo
    ON financeiro_lancamento (cliente_id, processo_id);

CREATE INDEX idx_lanc_descricao_conta
    ON financeiro_lancamento (descricao(100), conta_contabil_id);
