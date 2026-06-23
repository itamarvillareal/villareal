-- Diagnóstico de rodadas de cálculo desalinhadas (txt Dropbox vs calculo_rodada na VPS).
-- Populado por scripts/diagnosticar-calculos-txt-vs-db.mjs (--gravar-vps).
-- Tabela-alvo da correção: calculo_rodada (payload_json + parcelamento_aceito).

CREATE TABLE IF NOT EXISTS calculo_rodada_reimport_diag (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo_cliente VARCHAR(8) NOT NULL,
    numero_processo INT NOT NULL,
    dimensao INT NOT NULL,
    esperado_debitos INT NOT NULL DEFAULT 0,
    esperado_titulos INT NOT NULL DEFAULT 0,
    esperado_gravados INT NOT NULL DEFAULT 0,
    txt_aceito TINYINT(1) NOT NULL DEFAULT 0,
    txt_snapshot TINYINT(1) NOT NULL DEFAULT 0,
    db_row_existe TINYINT(1) NOT NULL DEFAULT 0,
    db_calculo_rodada_id BIGINT NULL,
    db_titulos INT NULL,
    db_debitos INT NULL,
    db_gravados INT NULL,
    db_parcelamento_aceito TINYINT(1) NULL,
    motivos JSON NOT NULL,
    precisa_atualizacao TINYINT(1) NOT NULL DEFAULT 0,
    diagnosticado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT uk_calculo_reimport_diag UNIQUE (codigo_cliente, numero_processo, dimensao),
    INDEX idx_calculo_reimport_diag_par (codigo_cliente, numero_processo),
    INDEX idx_calculo_reimport_diag_precisa (precisa_atualizacao, codigo_cliente)
);

CREATE TABLE IF NOT EXISTS calculo_rodada_reimport_par (
    codigo_cliente VARCHAR(8) NOT NULL,
    numero_processo INT NOT NULL,
    dims_txt INT NOT NULL DEFAULT 0,
    dims_com_debitos INT NOT NULL DEFAULT 0,
    dims_afetadas INT NOT NULL DEFAULT 0,
    motivos_resumo JSON NOT NULL,
    precisa_atualizacao TINYINT(1) NOT NULL DEFAULT 0,
    diagnosticado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (codigo_cliente, numero_processo),
    INDEX idx_calculo_reimport_par_precisa (precisa_atualizacao, codigo_cliente)
);
