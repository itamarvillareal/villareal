-- Preferência de menu lateral por usuário (visibilidade + ordem).

CREATE TABLE usuario_menu_item (
    usuario_id BIGINT NOT NULL,
    modulo_id VARCHAR(80) NOT NULL,
    visivel TINYINT(1) NOT NULL DEFAULT 1,
    ordem INT NOT NULL DEFAULT 0,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, modulo_id),
    CONSTRAINT fk_umi_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_umi_usuario_ordem (usuario_id, ordem)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
