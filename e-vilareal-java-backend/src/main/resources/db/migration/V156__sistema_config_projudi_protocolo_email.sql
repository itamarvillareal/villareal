-- Configurações editáveis pelo portal (chave-valor).

CREATE TABLE sistema_config (
    chave VARCHAR(120) NOT NULL PRIMARY KEY,
    valor TEXT NOT NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO sistema_config (chave, valor)
VALUES ('projudi.protocolo.email.destinatarios', 'jr.villareal@gmail.com');
