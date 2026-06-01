-- Caixa de entrada da Júlia: estado operacional na própria triagem.

ALTER TABLE julia_triagem
    ADD COLUMN status_caixa VARCHAR(20) NOT NULL DEFAULT 'AGUARDANDO_VOCE'
        COMMENT 'AGUARDANDO_VOCE|POSTERGADO|CONCLUIDO'
        AFTER modelo,
    ADD COLUMN categoria VARCHAR(60) NULL AFTER status_caixa,
    ADD COLUMN postergar_ate DATE NULL AFTER categoria;

CREATE INDEX idx_julia_triagem_caixa ON julia_triagem (status_caixa, postergar_ate);
