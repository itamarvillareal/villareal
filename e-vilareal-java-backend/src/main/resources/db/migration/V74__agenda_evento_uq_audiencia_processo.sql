-- Unique por (usuario_id, processo_ref, origem) apenas para audiências replicadas do formulário de processos.
-- MySQL permite múltiplos NULL em índice UNIQUE; demais origens ficam com uq_audiencia_key NULL.
ALTER TABLE agenda_evento
    ADD COLUMN uq_audiencia_key VARCHAR(220) GENERATED ALWAYS AS (
        CASE WHEN origem = 'processos-audiencia' AND processo_ref IS NOT NULL
             THEN CONCAT(CAST(usuario_id AS CHAR), '|', processo_ref, '|', origem)
             ELSE NULL
        END
    ) VIRTUAL,
    ADD UNIQUE INDEX uq_agenda_audiencia_processo (uq_audiencia_key);
