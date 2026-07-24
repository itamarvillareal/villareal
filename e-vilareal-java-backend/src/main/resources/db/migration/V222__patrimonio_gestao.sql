-- Gestão Patrimonial (ativos + passivos) — Fase 1 isolada.
-- Prefixo de tabelas: patrimonio_

-- ---------------------------------------------------------------------------
-- Parâmetros versionados (§6)
-- ---------------------------------------------------------------------------
CREATE TABLE patrimonio_parametro (
    id BIGINT NOT NULL AUTO_INCREMENT,
    versao INT NOT NULL,
    vigente_desde DATETIME(3) NOT NULL,
    vigente_ate DATETIME(3) NULL,
    piso_reserva_meses DECIMAL(6, 2) NOT NULL DEFAULT 6.00,
    alavancagem_alerta DECIMAL(8, 4) NOT NULL DEFAULT 0.4000,
    alavancagem_critico DECIMAL(8, 4) NOT NULL DEFAULT 0.5500,
    comprometimento_renda_max DECIMAL(8, 4) NOT NULL DEFAULT 0.3000,
    banda_rebalanceamento_pp DECIMAL(6, 2) NOT NULL DEFAULT 5.00,
    reflexao_minimo_parcelas DECIMAL(6, 2) NOT NULL DEFAULT 1.00,
    reflexao_horas INT NOT NULL DEFAULT 48,
    teto_amortizacao_anual DECIMAL(19, 2) NULL,
    objetivo_amortizacao VARCHAR(20) NOT NULL DEFAULT 'REDUZIR_PRAZO',
    taxa_referencia_liquida_aa DECIMAL(12, 6) NULL,
    meta_alocacao_rv DECIMAL(8, 4) NULL,
    meta_alocacao_rf DECIMAL(8, 4) NULL,
    meta_alocacao_imoveis DECIMAL(8, 4) NULL,
    meta_alocacao_caixa DECIMAL(8, 4) NULL,
    despesas_fixas_mensais DECIMAL(19, 2) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_patrimonio_parametro_versao (versao),
    KEY idx_patrimonio_parametro_vigente (vigente_desde, vigente_ate)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO patrimonio_parametro (
    versao, vigente_desde, piso_reserva_meses, alavancagem_alerta, alavancagem_critico,
    comprometimento_renda_max, banda_rebalanceamento_pp, reflexao_minimo_parcelas,
    reflexao_horas, objetivo_amortizacao
) VALUES (
    1, UTC_TIMESTAMP(3), 6.00, 0.4000, 0.5500, 0.3000, 5.00, 1.00, 48, 'REDUZIR_PRAZO'
);

-- ---------------------------------------------------------------------------
-- Snapshots de consolidação
-- ---------------------------------------------------------------------------
CREATE TABLE patrimonio_snapshot (
    id BIGINT NOT NULL AUTO_INCREMENT,
    data_ref DATE NOT NULL,
    ativo_total DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    passivo_total DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    patrimonio_liquido DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    alavancagem DECIMAL(12, 6) NULL,
    rv_total DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    rf_total DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    imoveis_total DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    caixa_total DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    caixa_vinculado DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    caixa_livre DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    veiculos_total DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    outros_ativos DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    passivo_imobiliario DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    passivo_veiculo DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    passivo_consorcio DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    passivo_credito_pessoal DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    passivo_cartao DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    passivo_outros DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    origem VARCHAR(30) NOT NULL DEFAULT 'CALCULO',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_patrimonio_snapshot_data (data_ref),
    KEY idx_patrimonio_snapshot_created (created_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Caixa (inclui vinculado a opções)
-- ---------------------------------------------------------------------------
CREATE TABLE patrimonio_caixa (
    id BIGINT NOT NULL AUTO_INCREMENT,
    descricao VARCHAR(200) NOT NULL,
    instituicao VARCHAR(120) NULL,
    valor DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    vinculado TINYINT(1) NOT NULL DEFAULT 0,
    motivo_vinculo VARCHAR(255) NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Renda variável
-- ---------------------------------------------------------------------------
CREATE TABLE patrimonio_ativo_rv (
    id BIGINT NOT NULL AUTO_INCREMENT,
    ticker VARCHAR(20) NOT NULL,
    quantidade DECIMAL(19, 8) NOT NULL DEFAULT 0,
    preco_medio DECIMAL(19, 6) NOT NULL DEFAULT 0,
    preco_atual DECIMAL(19, 6) NULL,
    estrategia_id BIGINT NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    observacao VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_patrimonio_rv_ticker (ticker)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE patrimonio_operacao_rv (
    id BIGINT NOT NULL AUTO_INCREMENT,
    ativo_rv_id BIGINT NULL,
    ticker VARCHAR(20) NOT NULL,
    tipo VARCHAR(10) NOT NULL,
    data_operacao DATE NOT NULL,
    quantidade DECIMAL(19, 8) NOT NULL,
    preco DECIMAL(19, 6) NOT NULL,
    custos DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    observacao VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_patrimonio_op_rv_ticker_data (ticker, data_operacao),
    CONSTRAINT fk_patrimonio_op_rv_ativo FOREIGN KEY (ativo_rv_id)
        REFERENCES patrimonio_ativo_rv (id) ON DELETE SET NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE patrimonio_operacao_opcao (
    id BIGINT NOT NULL AUTO_INCREMENT,
    ticker_ativo VARCHAR(20) NOT NULL,
    ticker_opcao VARCHAR(30) NULL,
    tipo VARCHAR(30) NOT NULL,
    strike DECIMAL(19, 6) NOT NULL,
    vencimento DATE NOT NULL,
    quantidade INT NOT NULL DEFAULT 1,
    premio_estimado DECIMAL(19, 6) NULL,
    premio_realizado DECIMAL(19, 6) NULL,
    premio_pago_recebido DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    margem_exigida DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'ABERTA',
    estrategia_id BIGINT NULL,
    data_abertura DATE NOT NULL,
    data_encerramento DATE NULL,
    observacao VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_patrimonio_opcao_status_venc (status, vencimento),
    KEY idx_patrimonio_opcao_ticker (ticker_ativo)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Renda fixa
-- ---------------------------------------------------------------------------
CREATE TABLE patrimonio_renda_fixa (
    id BIGINT NOT NULL AUTO_INCREMENT,
    instrumento VARCHAR(200) NOT NULL,
    instituicao VARCHAR(120) NULL,
    valor_aplicado DECIMAL(19, 2) NOT NULL,
    valor_atual DECIMAL(19, 2) NULL,
    indexador VARCHAR(30) NULL,
    taxa_contratada DECIMAL(12, 6) NULL,
    vencimento DATE NULL,
    liquidez VARCHAR(30) NOT NULL DEFAULT 'NO_VENCIMENTO',
    reserva_emergencia TINYINT(1) NOT NULL DEFAULT 0,
    rentabilidade_bruta_aa DECIMAL(12, 6) NULL,
    rentabilidade_liquida_aa DECIMAL(12, 6) NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    observacao VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_patrimonio_rf_vencimento (vencimento),
    KEY idx_patrimonio_rf_reserva (reserva_emergencia)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Imóveis patrimoniais (independentes do cadastro operacional)
-- ---------------------------------------------------------------------------
CREATE TABLE patrimonio_imovel (
    id BIGINT NOT NULL AUTO_INCREMENT,
    identificacao VARCHAR(200) NOT NULL,
    endereco VARCHAR(500) NULL,
    valor_aquisicao DECIMAL(19, 2) NULL,
    data_aquisicao DATE NULL,
    valor_atual DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    situacao VARCHAR(30) NOT NULL DEFAULT 'USO_PROPRIO',
    aluguel_mensal DECIMAL(19, 2) NULL,
    indice_reajuste VARCHAR(30) NULL,
    data_base_reajuste DATE NULL,
    vencimento_contrato DATE NULL,
    iptu_mensal DECIMAL(19, 2) NULL,
    condominio_mensal DECIMAL(19, 2) NULL,
    seguro_mensal DECIMAL(19, 2) NULL,
    manutencao_mensal DECIMAL(19, 2) NULL,
    administracao_mensal DECIMAL(19, 2) NULL,
    vacancia_estimada DECIMAL(8, 4) NULL,
    origem_imovel_id BIGINT NULL,
    passivo_id BIGINT NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    observacao VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_patrimonio_imovel_situacao (situacao),
    KEY idx_patrimonio_imovel_origem (origem_imovel_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE patrimonio_imovel_fluxo (
    id BIGINT NOT NULL AUTO_INCREMENT,
    imovel_id BIGINT NOT NULL,
    competencia CHAR(7) NOT NULL,
    aluguel DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    despesas DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    inadimplente TINYINT(1) NOT NULL DEFAULT 0,
    observacao VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_patrimonio_imovel_fluxo (imovel_id, competencia),
    CONSTRAINT fk_patrimonio_imovel_fluxo FOREIGN KEY (imovel_id)
        REFERENCES patrimonio_imovel (id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Veículos (ativos)
-- ---------------------------------------------------------------------------
CREATE TABLE patrimonio_veiculo (
    id BIGINT NOT NULL AUTO_INCREMENT,
    descricao VARCHAR(200) NOT NULL,
    ano INT NULL,
    placa VARCHAR(15) NULL,
    renavam VARCHAR(30) NULL,
    valor_atual DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    passivo_id BIGINT NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Passivos
-- ---------------------------------------------------------------------------
CREATE TABLE patrimonio_passivo (
    id BIGINT NOT NULL AUTO_INCREMENT,
    tipo VARCHAR(40) NOT NULL,
    credor VARCHAR(200) NOT NULL,
    descricao VARCHAR(255) NULL,
    valor_original DECIMAL(19, 2) NOT NULL,
    saldo_devedor DECIMAL(19, 2) NOT NULL,
    sistema_amortizacao VARCHAR(20) NOT NULL,
    taxa_juros_nominal_aa DECIMAL(12, 6) NULL,
    cet_efetivo_aa DECIMAL(12, 6) NOT NULL,
    indexador VARCHAR(30) NULL,
    parcela_atual DECIMAL(19, 2) NOT NULL,
    prazo_remanescente_meses INT NOT NULL,
    dia_vencimento INT NULL,
    seguro_mip_mensal DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    seguro_dfi_mensal DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    taxa_administracao_mensal DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    taxa_administracao_total DECIMAL(19, 2) NULL,
    fundo_reserva DECIMAL(19, 2) NULL,
    consorcio_contemplado TINYINT(1) NULL,
    credito_consorcio DECIMAL(19, 2) NULL,
    permite_reduzir_prazo TINYINT(1) NOT NULL DEFAULT 1,
    permite_reduzir_parcela TINYINT(1) NOT NULL DEFAULT 1,
    carencia_amortizacao_dias INT NULL,
    multa_amortizacao DECIMAL(12, 6) NULL,
    desconto_juros_futuros TINYINT(1) NOT NULL DEFAULT 1,
    bem_vinculado_tipo VARCHAR(30) NULL,
    bem_vinculado_id BIGINT NULL,
    data_inicio DATE NULL,
    data_fim_prevista DATE NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    observacao VARCHAR(1000) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_patrimonio_passivo_tipo (tipo),
    KEY idx_patrimonio_passivo_cet (cet_efetivo_aa),
    KEY idx_patrimonio_passivo_ativo (ativo)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE patrimonio_passivo_parcela (
    id BIGINT NOT NULL AUTO_INCREMENT,
    passivo_id BIGINT NOT NULL,
    numero INT NOT NULL,
    data_vencimento DATE NOT NULL,
    valor_parcela DECIMAL(19, 2) NOT NULL,
    amortizacao DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    juros DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    seguros_taxas DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    saldo_apos DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_patrimonio_passivo_parcela (passivo_id, numero),
    KEY idx_patrimonio_parcela_status (passivo_id, status),
    CONSTRAINT fk_patrimonio_parcela_passivo FOREIGN KEY (passivo_id)
        REFERENCES patrimonio_passivo (id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Amortizações + governança
-- ---------------------------------------------------------------------------
CREATE TABLE patrimonio_amortizacao (
    id BIGINT NOT NULL AUTO_INCREMENT,
    passivo_id BIGINT NOT NULL,
    data_solicitacao DATETIME(3) NOT NULL,
    data_efetivacao DATETIME(3) NULL,
    valor DECIMAL(19, 2) NOT NULL,
    modalidade VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'RASCUNHO',
    racional TEXT NULL,
    justificativa_reserva TEXT NULL,
    cet_vigente_aa DECIMAL(12, 6) NULL,
    retorno_alternativa_aa DECIMAL(12, 6) NULL,
    diferencial_pp DECIMAL(12, 6) NULL,
    economia_vp DECIMAL(19, 2) NULL,
    valor_nominal_eliminado DECIMAL(19, 2) NULL,
    meses_eliminados INT NULL,
    taxa_implicita_aa DECIMAL(12, 6) NULL,
    impacto_pl_12m DECIMAL(19, 2) NULL,
    impacto_pl_36m DECIMAL(19, 2) NULL,
    recomendacao VARCHAR(40) NULL,
    pendente_ate DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_patrimonio_amort_status (status),
    KEY idx_patrimonio_amort_passivo (passivo_id),
    CONSTRAINT fk_patrimonio_amort_passivo FOREIGN KEY (passivo_id)
        REFERENCES patrimonio_passivo (id) ON DELETE RESTRICT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Estratégias (ex.: CSAN3)
-- ---------------------------------------------------------------------------
CREATE TABLE patrimonio_estrategia (
    id BIGINT NOT NULL AUTO_INCREMENT,
    nome VARCHAR(200) NOT NULL,
    ticker VARCHAR(20) NULL,
    horizonte_meses INT NULL,
    capital_mensal DECIMAL(19, 2) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'RASCUNHO',
    adesao_pct DECIMAL(8, 4) NULL,
    observacao VARCHAR(2000) NULL,
    premios_estimados_vs_realizados_ok TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE patrimonio_estrategia_etapa (
    id BIGINT NOT NULL AUTO_INCREMENT,
    estrategia_id BIGINT NOT NULL,
    ordem INT NOT NULL,
    data_prevista DATE NULL,
    descricao VARCHAR(500) NOT NULL,
    parametros_json JSON NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PLANEJADA',
    executado_em DATE NULL,
    resultado_json JSON NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_patrimonio_etapa_estrategia (estrategia_id, ordem),
    CONSTRAINT fk_patrimonio_etapa_estrategia FOREIGN KEY (estrategia_id)
        REFERENCES patrimonio_estrategia (id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE patrimonio_ativo_rv
    ADD CONSTRAINT fk_patrimonio_rv_estrategia FOREIGN KEY (estrategia_id)
        REFERENCES patrimonio_estrategia (id) ON DELETE SET NULL;

ALTER TABLE patrimonio_operacao_opcao
    ADD CONSTRAINT fk_patrimonio_opcao_estrategia FOREIGN KEY (estrategia_id)
        REFERENCES patrimonio_estrategia (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Fluxo de caixa categorizado
-- ---------------------------------------------------------------------------
CREATE TABLE patrimonio_fluxo_caixa (
    id BIGINT NOT NULL AUTO_INCREMENT,
    data_ref DATE NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    categoria VARCHAR(60) NOT NULL,
    descricao VARCHAR(255) NULL,
    valor DECIMAL(19, 2) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_patrimonio_fluxo_data (data_ref)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Alertas
-- ---------------------------------------------------------------------------
CREATE TABLE patrimonio_alerta (
    id BIGINT NOT NULL AUTO_INCREMENT,
    tipo VARCHAR(80) NOT NULL,
    prioridade VARCHAR(20) NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    mensagem TEXT NOT NULL,
    entidade_tipo VARCHAR(40) NULL,
    entidade_id BIGINT NULL,
    disparado_em DATETIME(3) NOT NULL,
    lido_em DATETIME(3) NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_patrimonio_alerta_ativo_prio (ativo, prioridade, disparado_em)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Relatórios arquivados
-- ---------------------------------------------------------------------------
CREATE TABLE patrimonio_relatorio (
    id BIGINT NOT NULL AUTO_INCREMENT,
    tipo VARCHAR(40) NOT NULL,
    data_ref DATE NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    conteudo_json JSON NOT NULL,
    arquivo_pdf LONGBLOB NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_patrimonio_relatorio_tipo_data (tipo, data_ref)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Auditoria de alterações
-- ---------------------------------------------------------------------------
CREATE TABLE patrimonio_auditoria (
    id BIGINT NOT NULL AUTO_INCREMENT,
    entidade_tipo VARCHAR(60) NOT NULL,
    entidade_id BIGINT NOT NULL,
    acao VARCHAR(30) NOT NULL,
    usuario_login VARCHAR(80) NULL,
    antes_json JSON NULL,
    depois_json JSON NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_patrimonio_auditoria_entidade (entidade_tipo, entidade_id),
    KEY idx_patrimonio_auditoria_created (created_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
