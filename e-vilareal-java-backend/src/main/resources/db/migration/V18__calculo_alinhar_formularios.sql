-- Cálculos: alinhar às diretrizes dos demais formulários (utf8mb4_unicode_ci, auditoria created_at).
-- Tabelas base criadas em V8__calculo.sql; esta migração só ajusta metadados e colunas ausentes.

ALTER TABLE calculo_rodada
    CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE calculo_cliente_config
    CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE calculo_rodada
    ADD COLUMN created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER payload_json;

ALTER TABLE calculo_cliente_config
    ADD COLUMN created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER payload_json;
