-- Cursor da última busca Gmail por tipo de importação (Projudi, Jusbrasil).
CREATE TABLE email_importacao_sync (
    tipo VARCHAR(32) NOT NULL,
    ultima_sincronizacao_em TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (tipo)
);
