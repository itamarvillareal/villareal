-- Fase 4 (núcleo): processos vinculados a clientes
-- Evidência de campos: frontend Processos.jsx + processosHistoricoData.js + docs/database-entities-proposed.md

CREATE TABLE processos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    cliente_id BIGINT NOT NULL,
    numero_interno INT NOT NULL COMMENT 'Número do processo no escopo do cliente (equivalente ao «Proc.» da UI)',
    numero_cnj VARCHAR(32) NULL COMMENT 'Número no padrão CNJ (novo)',
    numero_processo_antigo VARCHAR(64) NULL COMMENT 'Número «antigo» / físico',
    descricao_acao TEXT NULL COMMENT 'Descrição da ação (texto longo quando necessário)',
    natureza_acao VARCHAR(255) NULL COMMENT 'Natureza da ação (grade/cadastro)',
    competencia VARCHAR(120) NULL,
    fase VARCHAR(120) NULL,
    status VARCHAR(80) NULL COMMENT 'Situação processual em texto livre nesta fase',
    tramitacao VARCHAR(120) NULL COMMENT 'Opção de tramitação exibida na UI',
    data_protocolo DATE NULL,
    prazo_fatal DATE NULL COMMENT 'Prazo fatal principal exibido no cadastro (denormalização útil para filtros)',
    proxima_consulta DATE NULL COMMENT 'Próxima consulta agendada (UI Diagnósticos/Processos)',
    observacao TEXT NULL,
    valor_causa DECIMAL(15, 2) NULL,
    uf CHAR(2) NULL,
    cidade VARCHAR(120) NULL,
    comarca VARCHAR(160) NULL,
    vara VARCHAR(255) NULL,
    tribunal VARCHAR(120) NULL,
    consulta_automatica BOOLEAN NOT NULL DEFAULT FALSE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    usuario_responsavel_id BIGINT NULL COMMENT 'Usuário interno responsável (FK opcional)',
    consultor VARCHAR(255) NULL COMMENT 'Nome livre de consultor externo ou texto auxiliar',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_processos_cliente_numero_interno UNIQUE (cliente_id, numero_interno),
    CONSTRAINT fk_processos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_processos_usuario_responsavel FOREIGN KEY (usuario_responsavel_id) REFERENCES usuarios (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX idx_processos_cliente_id ON processos (cliente_id);
CREATE INDEX idx_processos_numero_cnj ON processos (numero_cnj);
CREATE INDEX idx_processos_ativo ON processos (ativo);
CREATE INDEX idx_processos_prazo_fatal ON processos (prazo_fatal);
CREATE INDEX idx_processos_proxima_consulta ON processos (proxima_consulta);
