-- Órgãos julgadores (varas, juizados, câmaras) sincronizados via DataJud + FK em processo.

CREATE TABLE orgao_julgador (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tribunal_id INT NOT NULL,
    codigo_cnj INT NOT NULL COMMENT 'orgaoJulgador.codigo no índice DataJud',
    nome VARCHAR(255) NOT NULL,
    grau VARCHAR(8) NULL COMMENT 'G1, G2, JE, TR',
    tipo VARCHAR(32) NOT NULL DEFAULT 'OUTRO',
    municipio_id INT NULL,
    favorito BOOLEAN NOT NULL DEFAULT FALSE,
    uso_count INT NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    synced_at TIMESTAMP(6) NULL,
    CONSTRAINT uk_orgao_julgador_tribunal_codigo UNIQUE (tribunal_id, codigo_cnj),
    CONSTRAINT fk_orgao_julgador_tribunal FOREIGN KEY (tribunal_id) REFERENCES tribunal (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_orgao_julgador_municipio FOREIGN KEY (municipio_id) REFERENCES municipio (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_orgao_julgador_tribunal ON orgao_julgador (tribunal_id);
CREATE INDEX idx_orgao_julgador_municipio ON orgao_julgador (municipio_id);
CREATE INDEX idx_orgao_julgador_ativo ON orgao_julgador (ativo);
CREATE INDEX idx_orgao_julgador_nome ON orgao_julgador (nome);

ALTER TABLE processo
    ADD COLUMN orgao_julgador_id BIGINT NULL AFTER municipio_id,
    ADD CONSTRAINT fk_processo_orgao_julgador FOREIGN KEY (orgao_julgador_id) REFERENCES orgao_julgador (id)
        ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX idx_processo_orgao_julgador ON processo (orgao_julgador_id);
