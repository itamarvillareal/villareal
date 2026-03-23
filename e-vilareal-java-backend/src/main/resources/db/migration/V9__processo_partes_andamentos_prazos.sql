-- Fase 4: partes, andamentos e prazos (dependem de processos)

CREATE TABLE processo_partes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    processo_id BIGINT NOT NULL,
    pessoa_id BIGINT NULL COMMENT 'Cadastro oficial quando houver vínculo',
    nome_livre VARCHAR(255) NULL COMMENT 'Nome sem pessoa cadastrada (litigante avulso)',
    polo VARCHAR(40) NOT NULL COMMENT 'AUTOR, REU, REQUERENTE, REQUERIDO, TERCEIRO, ADVOGADO, OUTRO',
    qualificacao VARCHAR(120) NULL COMMENT 'Ex.: autor, réu, advogado da parte X',
    ordem INT NOT NULL DEFAULT 0 COMMENT 'Ordem de exibição no mesmo polo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_proc_partes_processo FOREIGN KEY (processo_id) REFERENCES processos (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_proc_partes_pessoa FOREIGN KEY (pessoa_id) REFERENCES cadastro_pessoas (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX idx_proc_partes_processo ON processo_partes (processo_id);
CREATE INDEX idx_proc_partes_pessoa ON processo_partes (pessoa_id);

CREATE TABLE processo_andamentos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    processo_id BIGINT NOT NULL,
    movimento_em DATETIME NOT NULL COMMENT 'Data/hora do movimento (ordenação cronológica)',
    titulo VARCHAR(500) NOT NULL COMMENT 'Resumo / tipo de movimento',
    detalhe TEXT NULL,
    origem VARCHAR(40) NOT NULL DEFAULT 'MANUAL' COMMENT 'MANUAL, PUBLICACAO, INTEGRACAO, OUTRO',
    origem_automatica BOOLEAN NOT NULL DEFAULT FALSE,
    usuario_id BIGINT NULL COMMENT 'Quem registrou (quando aplicável)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_proc_and_processo FOREIGN KEY (processo_id) REFERENCES processos (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_proc_and_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX idx_proc_and_processo_movimento ON processo_andamentos (processo_id, movimento_em);

CREATE TABLE processo_prazos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    processo_id BIGINT NOT NULL,
    andamento_id BIGINT NULL COMMENT 'Origem opcional do prazo (ex.: intimação)',
    descricao VARCHAR(500) NOT NULL,
    data_inicio DATE NULL,
    data_fim DATE NOT NULL COMMENT 'Data limite do cumprimento',
    prazo_fatal BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Marca se este prazo é «fatal» na regra de negócio',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDENTE' COMMENT 'PENDENTE, CUMPRIDO, CANCELADO',
    cumprido_em DATETIME NULL,
    observacao TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_proc_prazos_processo FOREIGN KEY (processo_id) REFERENCES processos (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_proc_prazos_andamento FOREIGN KEY (andamento_id) REFERENCES processo_andamentos (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX idx_proc_prazos_processo ON processo_prazos (processo_id);
CREATE INDEX idx_proc_prazos_data_fim ON processo_prazos (data_fim);
CREATE INDEX idx_proc_prazos_status ON processo_prazos (status);
