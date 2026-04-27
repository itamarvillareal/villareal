-- Módulo IPTU (V38): configuração anual, parcelas por competência e histórico de consultas à prefeitura.
-- Padrão de charset/timestamps alinhado a V14 (imóveis) e V37 (pagamentos).

CREATE TABLE iptu_anual (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    imovel_id BIGINT NOT NULL,
    ano_referencia SMALLINT NOT NULL,
    valor_total_anual DECIMAL(12, 2) NOT NULL,
    dias_mes_divisor TINYINT NOT NULL DEFAULT 30,
    observacoes TEXT NULL,
    anexo_carne_path VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_iptu_anual_imovel FOREIGN KEY (imovel_id) REFERENCES imovel (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_iptu_anual_ano CHECK (ano_referencia BETWEEN 2000 AND 2100),
    CONSTRAINT chk_iptu_anual_valor CHECK (valor_total_anual >= 0),
    CONSTRAINT chk_iptu_anual_divisor CHECK (dias_mes_divisor BETWEEN 1 AND 31),
    CONSTRAINT uq_iptu_anual_imovel_ano UNIQUE (imovel_id, ano_referencia)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_iptu_anual_imovel ON iptu_anual (imovel_id);

CREATE TABLE iptu_parcela (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    iptu_anual_id BIGINT NOT NULL,
    contrato_locacao_id BIGINT NULL,
    competencia_mes VARCHAR(7) NOT NULL,
    dias_cobrados TINYINT NOT NULL,
    mes_completo BOOLEAN NOT NULL,
    valor_calculado DECIMAL(12, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    data_vencimento DATE NULL,
    data_pagamento DATE NULL,
    pagamento_id BIGINT NULL,
    observacoes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_iptu_parcela_anual FOREIGN KEY (iptu_anual_id) REFERENCES iptu_anual (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_iptu_parcela_contrato FOREIGN KEY (contrato_locacao_id) REFERENCES contrato_locacao (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_iptu_parcela_pagamento FOREIGN KEY (pagamento_id) REFERENCES pagamento (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_iptu_parcela_anual ON iptu_parcela (iptu_anual_id);
CREATE INDEX idx_iptu_parcela_status ON iptu_parcela (status);
CREATE INDEX idx_iptu_parcela_venc ON iptu_parcela (data_vencimento);
CREATE INDEX idx_iptu_parcela_competencia ON iptu_parcela (competencia_mes);

CREATE UNIQUE INDEX uq_iptu_parcela_competencia ON iptu_parcela (
    iptu_anual_id,
    competencia_mes,
    (COALESCE(contrato_locacao_id, -(iptu_anual_id)))
);

CREATE TABLE iptu_consulta_debito (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    imovel_id BIGINT NOT NULL,
    data_consulta DATE NOT NULL,
    existe_debito BOOLEAN NOT NULL,
    valor_debito DECIMAL(12, 2) NULL,
    observacoes TEXT NULL,
    anexo_path VARCHAR(500) NULL,
    criado_por_usuario_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_iptu_cons_imovel FOREIGN KEY (imovel_id) REFERENCES imovel (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_iptu_cons_usuario FOREIGN KEY (criado_por_usuario_id) REFERENCES usuarios (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_iptu_cons_imovel_data ON iptu_consulta_debito (imovel_id, data_consulta DESC);

-- Migração legado: copia consultas a partir de campos_extras_json (não remove chaves do JSON).
INSERT INTO iptu_consulta_debito (
    imovel_id,
    data_consulta,
    existe_debito,
    valor_debito,
    observacoes,
    anexo_path,
    criado_por_usuario_id
)
SELECT
    i.id,
    STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(i.campos_extras_json, '$.dataConsIptu')), '%d/%m/%Y'),
    CASE
        WHEN LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(i.campos_extras_json, '$.existeDebIptu')))) IN ('sim', 's', 'true', '1') THEN TRUE
        ELSE FALSE
    END,
    NULL,
    NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(i.campos_extras_json, '$.infoIptuTexto'))), ''),
    NULL,
    NULL
FROM imovel i
WHERE i.campos_extras_json IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(i.campos_extras_json, '$.dataConsIptu')) IS NOT NULL
  AND STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(i.campos_extras_json, '$.dataConsIptu')), '%d/%m/%Y') IS NOT NULL;
