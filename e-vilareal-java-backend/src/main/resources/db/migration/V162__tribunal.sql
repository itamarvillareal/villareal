-- Catálogo de tribunais de justiça estaduais (27 TJs). Só TJGO ativo nesta entrega.

CREATE TABLE tribunal (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sigla VARCHAR(8) NOT NULL,
    nome VARCHAR(120) NOT NULL,
    uf_id INT NULL,
    datajud_alias VARCHAR(64) NOT NULL COMMENT 'Índice Elasticsearch DataJud (ex.: api_publica_tjgo)',
    ativo BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uk_tribunal_sigla UNIQUE (sigla),
    CONSTRAINT fk_tribunal_uf FOREIGN KEY (uf_id) REFERENCES estado (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_tribunal_ativo ON tribunal (ativo);

INSERT INTO tribunal (sigla, nome, uf_id, datajud_alias, ativo) VALUES
    ('TJAC', 'Tribunal de Justiça do Acre', 12, 'api_publica_tjac', FALSE),
    ('TJAL', 'Tribunal de Justiça de Alagoas', 27, 'api_publica_tjal', FALSE),
    ('TJAP', 'Tribunal de Justiça do Amapá', 16, 'api_publica_tjap', FALSE),
    ('TJAM', 'Tribunal de Justiça do Amazonas', 13, 'api_publica_tjam', FALSE),
    ('TJBA', 'Tribunal de Justiça da Bahia', 29, 'api_publica_tjba', FALSE),
    ('TJCE', 'Tribunal de Justiça do Ceará', 23, 'api_publica_tjce', FALSE),
    ('TJDFT', 'Tribunal de Justiça do Distrito Federal e Territórios', 53, 'api_publica_tjdft', FALSE),
    ('TJES', 'Tribunal de Justiça do Espírito Santo', 32, 'api_publica_tjes', FALSE),
    ('TJGO', 'Tribunal de Justiça de Goiás', 52, 'api_publica_tjgo', TRUE),
    ('TJMA', 'Tribunal de Justiça do Maranhão', 21, 'api_publica_tjma', FALSE),
    ('TJMT', 'Tribunal de Justiça de Mato Grosso', 51, 'api_publica_tjmt', FALSE),
    ('TJMS', 'Tribunal de Justiça de Mato Grosso do Sul', 50, 'api_publica_tjms', FALSE),
    ('TJMG', 'Tribunal de Justiça de Minas Gerais', 31, 'api_publica_tjmg', FALSE),
    ('TJPA', 'Tribunal de Justiça do Pará', 15, 'api_publica_tjpa', FALSE),
    ('TJPB', 'Tribunal de Justiça da Paraíba', 25, 'api_publica_tjpb', FALSE),
    ('TJPR', 'Tribunal de Justiça do Paraná', 41, 'api_publica_tjpr', FALSE),
    ('TJPE', 'Tribunal de Justiça de Pernambuco', 26, 'api_publica_tjpe', FALSE),
    ('TJPI', 'Tribunal de Justiça do Piauí', 22, 'api_publica_tjpi', FALSE),
    ('TJRJ', 'Tribunal de Justiça do Rio de Janeiro', 33, 'api_publica_tjrj', FALSE),
    ('TJRN', 'Tribunal de Justiça do Rio Grande do Norte', 24, 'api_publica_tjrn', FALSE),
    ('TJRS', 'Tribunal de Justiça do Rio Grande do Sul', 43, 'api_publica_tjrs', FALSE),
    ('TJRO', 'Tribunal de Justiça de Rondônia', 11, 'api_publica_tjro', FALSE),
    ('TJRR', 'Tribunal de Justiça de Roraima', 14, 'api_publica_tjrr', FALSE),
    ('TJSC', 'Tribunal de Justiça de Santa Catarina', 42, 'api_publica_tjsc', FALSE),
    ('TJSE', 'Tribunal de Justiça de Sergipe', 28, 'api_publica_tjse', FALSE),
    ('TJSP', 'Tribunal de Justiça de São Paulo', 35, 'api_publica_tjsp', FALSE),
    ('TJTO', 'Tribunal de Justiça do Tocantins', 17, 'api_publica_tjto', FALSE);
