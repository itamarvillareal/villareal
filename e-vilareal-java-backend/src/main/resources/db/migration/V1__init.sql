-- Greenfield schema: Pessoa, complementares, endereços, contatos, usuário, perfis (paridade React)

CREATE TABLE pessoa (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) NOT NULL,
    email VARCHAR(255) NULL,
    telefone VARCHAR(40) NULL,
    data_nascimento DATE NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    marcado_monitoramento BOOLEAN NOT NULL DEFAULT FALSE,
    responsavel_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_pessoa_cpf UNIQUE (cpf),
    CONSTRAINT uk_pessoa_email UNIQUE (email),
    CONSTRAINT fk_pessoa_responsavel FOREIGN KEY (responsavel_id) REFERENCES pessoa (id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX idx_pessoa_nome ON pessoa (nome);
CREATE INDEX idx_pessoa_ativo ON pessoa (ativo);

CREATE TABLE pessoa_complementar (
    pessoa_id BIGINT NOT NULL PRIMARY KEY,
    rg VARCHAR(40) NULL,
    orgao_expedidor VARCHAR(120) NULL,
    profissao VARCHAR(255) NULL,
    nacionalidade VARCHAR(120) NULL,
    estado_civil VARCHAR(40) NULL,
    genero VARCHAR(8) NULL,
    CONSTRAINT fk_pessoa_complementar_pessoa FOREIGN KEY (pessoa_id) REFERENCES pessoa (id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE pessoa_endereco (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pessoa_id BIGINT NOT NULL,
    numero_ordem INT NOT NULL,
    rua VARCHAR(255) NOT NULL,
    bairro VARCHAR(120) NULL,
    estado VARCHAR(2) NULL,
    cidade VARCHAR(120) NULL,
    cep VARCHAR(8) NULL,
    auto_preenchido BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_pessoa_endereco_pessoa FOREIGN KEY (pessoa_id) REFERENCES pessoa (id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_pessoa_endereco_pessoa ON pessoa_endereco (pessoa_id);

CREATE TABLE pessoa_contato (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pessoa_id BIGINT NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    valor VARCHAR(500) NOT NULL,
    data_lancamento DATETIME(3) NOT NULL,
    data_alteracao DATETIME(3) NOT NULL,
    usuario_lancamento VARCHAR(120) NOT NULL,
    CONSTRAINT fk_pessoa_contato_pessoa FOREIGN KEY (pessoa_id) REFERENCES pessoa (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_pessoa_contato_tipo CHECK (tipo IN ('email', 'telefone', 'website'))
);

CREATE INDEX idx_pessoa_contato_pessoa ON pessoa_contato (pessoa_id);

CREATE TABLE perfil (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(80) NOT NULL,
    nome VARCHAR(120) NOT NULL,
    descricao VARCHAR(500) NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_perfil_codigo UNIQUE (codigo)
);

CREATE TABLE usuarios (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pessoa_id BIGINT NOT NULL,
    nome VARCHAR(255) NOT NULL,
    apelido VARCHAR(120) NULL,
    login VARCHAR(120) NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_usuarios_login UNIQUE (login),
    CONSTRAINT uk_usuarios_pessoa UNIQUE (pessoa_id),
    CONSTRAINT fk_usuarios_pessoa FOREIGN KEY (pessoa_id) REFERENCES pessoa (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX idx_usuarios_ativo ON usuarios (ativo);

CREATE TABLE usuario_perfil (
    usuario_id BIGINT NOT NULL,
    perfil_id BIGINT NOT NULL,
    PRIMARY KEY (usuario_id, perfil_id),
    CONSTRAINT fk_usuario_perfil_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_usuario_perfil_perfil FOREIGN KEY (perfil_id) REFERENCES perfil (id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO perfil (id, codigo, nome, descricao, ativo) VALUES
    (1, 'ADMIN', 'Administrador', 'Acesso total', TRUE),
    (2, 'USUARIO', 'Usuário', 'Acesso padrão', TRUE);

ALTER TABLE perfil AUTO_INCREMENT = 3;
