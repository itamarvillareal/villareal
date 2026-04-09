-- Imóveis e locação — paridade com e-vilareal-react-web (imoveisRepository.js / VITE_USE_API_IMOVEIS).
-- clienteId na API = pessoa.id (mesmo contrato de GET /api/clientes).

CREATE TABLE imovel (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pessoa_id BIGINT NOT NULL,
    processo_id BIGINT NULL,
    titulo VARCHAR(255) NULL,
    endereco_completo TEXT NULL,
    condominio VARCHAR(255) NULL,
    unidade VARCHAR(120) NULL,
    tipo_imovel VARCHAR(80) NULL,
    situacao VARCHAR(40) NOT NULL DEFAULT 'DESOCUPADO',
    garagens VARCHAR(80) NULL,
    inscricao_imobiliaria VARCHAR(120) NULL,
    observacoes TEXT NULL,
    campos_extras_json TEXT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_imovel_pessoa FOREIGN KEY (pessoa_id) REFERENCES pessoa (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_imovel_processo FOREIGN KEY (processo_id) REFERENCES processo (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_imovel_pessoa ON imovel (pessoa_id);
CREATE INDEX idx_imovel_processo ON imovel (processo_id);

CREATE TABLE contrato_locacao (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    imovel_id BIGINT NOT NULL,
    locador_pessoa_id BIGINT NULL,
    inquilino_pessoa_id BIGINT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NULL,
    valor_aluguel DECIMAL(19, 2) NOT NULL,
    valor_repasse_pactuado DECIMAL(19, 2) NULL,
    dia_vencimento_aluguel INT NULL,
    dia_repasse INT NULL,
    garantia_tipo VARCHAR(120) NULL,
    valor_garantia DECIMAL(19, 2) NULL,
    dados_bancarios_repasse_json TEXT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'RASCUNHO',
    observacoes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_cl_imovel FOREIGN KEY (imovel_id) REFERENCES imovel (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_cl_locador FOREIGN KEY (locador_pessoa_id) REFERENCES pessoa (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_cl_inquilino FOREIGN KEY (inquilino_pessoa_id) REFERENCES pessoa (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_cl_imovel ON contrato_locacao (imovel_id);

CREATE TABLE locacao_repasse (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    contrato_locacao_id BIGINT NOT NULL,
    competencia_mes VARCHAR(7) NULL,
    valor_recebido_inquilino DECIMAL(19, 2) NULL,
    valor_repassado_locador DECIMAL(19, 2) NULL,
    valor_despesas_repassar DECIMAL(19, 2) NULL,
    remuneracao_escritorio DECIMAL(19, 2) NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'PENDENTE',
    data_repasse_efetiva DATE NULL,
    observacao TEXT NULL,
    lancamento_financeiro_vinculo_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_lr_contrato FOREIGN KEY (contrato_locacao_id) REFERENCES contrato_locacao (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_lr_contrato ON locacao_repasse (contrato_locacao_id);

CREATE TABLE locacao_despesa (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    contrato_locacao_id BIGINT NOT NULL,
    competencia_mes VARCHAR(7) NULL,
    descricao VARCHAR(500) NOT NULL,
    valor DECIMAL(19, 2) NOT NULL,
    categoria VARCHAR(80) NOT NULL DEFAULT 'OUTROS',
    observacao TEXT NULL,
    lancamento_financeiro_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ld_contrato FOREIGN KEY (contrato_locacao_id) REFERENCES contrato_locacao (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_ld_contrato ON locacao_despesa (contrato_locacao_id);
