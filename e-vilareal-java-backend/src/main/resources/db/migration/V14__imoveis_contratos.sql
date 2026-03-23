-- Fase 7: núcleo imobiliário — imóveis e contratos de locação
-- Evidência de campos: frontend Imoveis.jsx + imoveisMockData.js + docs pré-fase 7

CREATE TABLE imoveis (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    cliente_id BIGINT NOT NULL COMMENT 'Cliente (locador / titular da relação jurídica na UI)',
    processo_id BIGINT NULL COMMENT 'Processo de administração vinculado (Cod. cliente + Proc. na UI)',
    titulo VARCHAR(200) NULL COMMENT 'Nome de exibição curto',
    endereco_completo TEXT NULL,
    condominio VARCHAR(200) NULL,
    unidade VARCHAR(120) NULL,
    tipo_imovel VARCHAR(40) NULL COMMENT 'Apartamento, casa, etc.',
    situacao VARCHAR(20) NOT NULL DEFAULT 'OCUPADO' COMMENT 'OCUPADO, DESOCUPADO, INATIVO',
    garagens VARCHAR(20) NULL,
    inscricao_imobiliaria VARCHAR(80) NULL,
    observacoes TEXT NULL,
    campos_extras_json JSON NULL COMMENT 'Snapshot utilidades (IPTU, água, energia, gás) sem modelar coluna a coluna nesta fase',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_imoveis_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_imoveis_processo FOREIGN KEY (processo_id) REFERENCES processos (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT uk_imoveis_processo_id UNIQUE (processo_id)
);

CREATE INDEX idx_imoveis_cliente_id ON imoveis (cliente_id);
CREATE INDEX idx_imoveis_situacao ON imoveis (situacao);
CREATE INDEX idx_imoveis_ativo ON imoveis (ativo);

CREATE TABLE contratos_locacao (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    imovel_id BIGINT NOT NULL,
    locador_pessoa_id BIGINT NULL COMMENT 'Locador explícito (cadastro_pessoas); pode redundar com cliente.pessoa',
    inquilino_pessoa_id BIGINT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NULL,
    valor_aluguel DECIMAL(15, 2) NOT NULL,
    valor_repasse_pactuado DECIMAL(15, 2) NULL COMMENT 'Valor pactuado a repassar ao locador (referência contratual)',
    dia_vencimento_aluguel TINYINT NULL COMMENT 'Dia do mês (1-31)',
    dia_repasse TINYINT NULL,
    garantia_tipo VARCHAR(40) NULL,
    valor_garantia DECIMAL(15, 2) NULL,
    dados_bancarios_repasse_json JSON NULL COMMENT 'Banco, agência, conta, PIX — espelho operacional da UI',
    status VARCHAR(20) NOT NULL DEFAULT 'VIGENTE' COMMENT 'RASCUNHO, VIGENTE, ENCERRADO, RESCINDIDO',
    observacoes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_contratos_imovel FOREIGN KEY (imovel_id) REFERENCES imoveis (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_contratos_locador_pessoa FOREIGN KEY (locador_pessoa_id) REFERENCES cadastro_pessoas (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_contratos_inquilino_pessoa FOREIGN KEY (inquilino_pessoa_id) REFERENCES cadastro_pessoas (id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX idx_contratos_imovel_id ON contratos_locacao (imovel_id);
CREATE INDEX idx_contratos_status ON contratos_locacao (status);
CREATE INDEX idx_contratos_data_inicio ON contratos_locacao (data_inicio);
