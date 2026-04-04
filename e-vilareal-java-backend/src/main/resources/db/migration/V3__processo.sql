CREATE TABLE processo (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pessoa_id BIGINT NOT NULL,
    numero_interno INT NOT NULL,
    numero_cnj VARCHAR(100) NULL,
    numero_processo_antigo VARCHAR(100) NULL,
    natureza_acao VARCHAR(255) NULL,
    descricao_acao TEXT NULL,
    competencia VARCHAR(120) NULL,
    fase VARCHAR(120) NULL,
    status VARCHAR(120) NULL,
    tramitacao VARCHAR(120) NULL,
    data_protocolo DATE NULL,
    prazo_fatal DATE NULL,
    proxima_consulta DATE NULL,
    observacao TEXT NULL,
    valor_causa DECIMAL(19, 2) NULL,
    uf VARCHAR(2) NULL,
    cidade VARCHAR(120) NULL,
    consulta_automatica BOOLEAN NOT NULL DEFAULT FALSE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    consultor VARCHAR(255) NULL,
    usuario_responsavel_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_processo_pessoa FOREIGN KEY (pessoa_id) REFERENCES pessoa (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_processo_usuario_resp FOREIGN KEY (usuario_responsavel_id) REFERENCES usuarios (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT uk_processo_pessoa_numero UNIQUE (pessoa_id, numero_interno)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_processo_pessoa ON processo (pessoa_id);

CREATE TABLE processo_parte (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    processo_id BIGINT NOT NULL,
    pessoa_id BIGINT NULL,
    nome_livre VARCHAR(500) NULL,
    polo VARCHAR(40) NOT NULL,
    qualificacao VARCHAR(255) NULL,
    ordem INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_processo_parte_processo FOREIGN KEY (processo_id) REFERENCES processo (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_processo_parte_pessoa FOREIGN KEY (pessoa_id) REFERENCES pessoa (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_processo_parte_processo ON processo_parte (processo_id);

CREATE TABLE processo_parte_advogado (
    id BIGINT NOT NULL AUTO_INCREMENT,
    processo_parte_id BIGINT NOT NULL,
    advogado_pessoa_id BIGINT NOT NULL,
    ordem INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_processo_parte_advogado (processo_parte_id, advogado_pessoa_id),
    CONSTRAINT fk_ppa_parte FOREIGN KEY (processo_parte_id) REFERENCES processo_parte (id) ON DELETE CASCADE,
    CONSTRAINT fk_ppa_advogado FOREIGN KEY (advogado_pessoa_id) REFERENCES pessoa (id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_ppa_parte ON processo_parte_advogado (processo_parte_id);

CREATE TABLE processo_andamento (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    processo_id BIGINT NOT NULL,
    movimento_em DATETIME(3) NOT NULL,
    titulo VARCHAR(500) NOT NULL,
    detalhe TEXT NULL,
    origem VARCHAR(40) NOT NULL DEFAULT 'MANUAL',
    origem_automatica BOOLEAN NOT NULL DEFAULT FALSE,
    usuario_id BIGINT NULL,
    CONSTRAINT fk_processo_andamento_processo FOREIGN KEY (processo_id) REFERENCES processo (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_processo_andamento_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_processo_andamento_processo ON processo_andamento (processo_id);

CREATE TABLE processo_prazo (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    processo_id BIGINT NOT NULL,
    andamento_id BIGINT NULL,
    descricao VARCHAR(500) NULL,
    data_inicio DATE NULL,
    data_fim DATE NOT NULL,
    prazo_fatal BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(40) NULL,
    observacao TEXT NULL,
    CONSTRAINT fk_processo_prazo_processo FOREIGN KEY (processo_id) REFERENCES processo (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_processo_prazo_andamento FOREIGN KEY (andamento_id) REFERENCES processo_andamento (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_processo_prazo_processo ON processo_prazo (processo_id);
