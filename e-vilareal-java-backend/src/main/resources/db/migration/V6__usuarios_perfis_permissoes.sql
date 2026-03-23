-- Fase 2: usuários, perfis e permissões (RBAC básico)

CREATE TABLE usuarios (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pessoa_id BIGINT NULL,
    nome VARCHAR(255) NOT NULL,
    apelido VARCHAR(120) NULL,
    login VARCHAR(120) NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_login_em DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_usuarios_login UNIQUE (login),
    CONSTRAINT fk_usuarios_pessoa FOREIGN KEY (pessoa_id) REFERENCES cadastro_pessoas (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX idx_usuarios_pessoa_id ON usuarios (pessoa_id);
CREATE INDEX idx_usuarios_ativo ON usuarios (ativo);

CREATE TABLE perfis (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(80) NOT NULL,
    nome VARCHAR(120) NOT NULL,
    descricao VARCHAR(500) NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_perfis_codigo UNIQUE (codigo)
);

CREATE INDEX idx_perfis_ativo ON perfis (ativo);

CREATE TABLE permissoes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(120) NOT NULL,
    modulo VARCHAR(120) NOT NULL,
    descricao VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uk_permissoes_codigo UNIQUE (codigo)
);

CREATE INDEX idx_permissoes_modulo ON permissoes (modulo);

CREATE TABLE usuario_perfil (
    usuario_id BIGINT NOT NULL,
    perfil_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, perfil_id),
    CONSTRAINT fk_usuario_perfil_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
    CONSTRAINT fk_usuario_perfil_perfil FOREIGN KEY (perfil_id) REFERENCES perfis (id) ON DELETE CASCADE
);

CREATE INDEX idx_usuario_perfil_perfil ON usuario_perfil (perfil_id);

CREATE TABLE perfil_permissao (
    perfil_id BIGINT NOT NULL,
    permissao_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (perfil_id, permissao_id),
    CONSTRAINT fk_perfil_permissao_perfil FOREIGN KEY (perfil_id) REFERENCES perfis (id) ON DELETE CASCADE,
    CONSTRAINT fk_perfil_permissao_permissao FOREIGN KEY (permissao_id) REFERENCES permissoes (id) ON DELETE CASCADE
);

CREATE INDEX idx_perfil_permissao_permissao ON perfil_permissao (permissao_id);
