-- Fase 3: clientes, complementos de pessoas e agenda mínima

CREATE TABLE clientes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo_cliente VARCHAR(8) NOT NULL,
    pessoa_id BIGINT NULL,
    nome_referencia VARCHAR(255) NOT NULL,
    documento_referencia VARCHAR(20) NULL,
    observacao TEXT NULL,
    inativo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_clientes_codigo_cliente UNIQUE (codigo_cliente),
    CONSTRAINT fk_clientes_pessoa FOREIGN KEY (pessoa_id) REFERENCES cadastro_pessoas (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX idx_clientes_pessoa_id ON clientes (pessoa_id);
CREATE INDEX idx_clientes_inativo ON clientes (inativo);
CREATE INDEX idx_clientes_nome_referencia ON clientes (nome_referencia);

CREATE TABLE pessoa_dados_complementares (
    pessoa_id BIGINT PRIMARY KEY,
    rg VARCHAR(30) NULL,
    orgao_expedidor VARCHAR(40) NULL,
    profissao VARCHAR(120) NULL,
    nacionalidade VARCHAR(120) NULL,
    estado_civil VARCHAR(40) NULL,
    genero VARCHAR(20) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_pessoa_dados_complementares FOREIGN KEY (pessoa_id) REFERENCES cadastro_pessoas (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE agenda_eventos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario_id BIGINT NOT NULL,
    data_evento DATE NOT NULL,
    hora_evento TIME NULL,
    descricao TEXT NOT NULL,
    status_curto VARCHAR(10) NULL,
    processo_ref VARCHAR(80) NULL,
    origem VARCHAR(40) NULL DEFAULT 'MANUAL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_agenda_eventos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

CREATE INDEX idx_agenda_usuario_data ON agenda_eventos (usuario_id, data_evento);
CREATE INDEX idx_agenda_data ON agenda_eventos (data_evento);
CREATE INDEX idx_agenda_status_curto ON agenda_eventos (status_curto);
