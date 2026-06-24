-- Diagnóstico: responsável de histórico (tipo 17 txt) ausente ou divergente em processo_andamento.
-- Populado por scripts/diagnosticar-historico-usuario-txt-vs-db.mjs (--gravar-vps).
-- Correção: UPDATE em processo_andamento.usuario_id / detalhe via dump seletivo.

CREATE TABLE IF NOT EXISTS processo_andamento_usuario_reimport_diag (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    andamento_id BIGINT NOT NULL,
    processo_id BIGINT NOT NULL,
    codigo_cliente CHAR(8) NOT NULL,
    numero_interno INT NOT NULL,
    indice_txt INT NULL,
    movimento_em DATETIME(3) NULL,
    titulo_resumo VARCHAR(500) NULL,
    usuario_txt VARCHAR(200) NULL,
    usuario_db VARCHAR(200) NULL,
    usuario_id_antigo BIGINT NULL,
    usuario_id_novo BIGINT NULL,
    detalhe_antigo TEXT NULL,
    detalhe_novo TEXT NULL,
    motivos JSON NOT NULL,
    precisa_atualizacao TINYINT(1) NOT NULL DEFAULT 0,
    diagnosticado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT uk_andamento_usuario_reimport_diag UNIQUE (andamento_id),
    INDEX idx_andamento_usuario_reimport_par (codigo_cliente, numero_interno),
    INDEX idx_andamento_usuario_reimport_precisa (precisa_atualizacao, codigo_cliente)
);

CREATE TABLE IF NOT EXISTS processo_andamento_usuario_reimport_par (
    codigo_cliente CHAR(8) NOT NULL,
    numero_interno INT NOT NULL,
    processo_id BIGINT NOT NULL,
    andamentos_db INT NOT NULL DEFAULT 0,
    entradas_txt INT NOT NULL DEFAULT 0,
    andamentos_afetados INT NOT NULL DEFAULT 0,
    motivos_resumo JSON NOT NULL,
    precisa_atualizacao TINYINT(1) NOT NULL DEFAULT 0,
    diagnosticado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (codigo_cliente, numero_interno),
    INDEX idx_andamento_usuario_reimport_par_precisa (precisa_atualizacao, codigo_cliente)
);
