CREATE TABLE topico (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    categoria VARCHAR(200) NOT NULL,
    subcategoria VARCHAR(200) NULL,
    nome VARCHAR(300) NOT NULL,
    chave_navegacao VARCHAR(500) NOT NULL,
    conteudo_template LONGTEXT NOT NULL,
    tipo_formatacao VARCHAR(50) NULL,
    ordem INT NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_topico_chave_navegacao (chave_navegacao)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX idx_topico_categoria ON topico (categoria);
CREATE INDEX idx_topico_ativo ON topico (ativo);
