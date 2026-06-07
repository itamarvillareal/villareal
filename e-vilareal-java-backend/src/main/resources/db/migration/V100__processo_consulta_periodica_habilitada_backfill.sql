-- V98 marcou toda a base como monitorada (DEFAULT TRUE). Corrige: true só com config real.
-- NOT EXISTS (não NOT IN): imune a processo_id NULL em notificacao_destinatario / agendamento_consulta.
UPDATE processo p
SET p.consulta_periodica_habilitada = 0
WHERE p.consulta_periodica_habilitada = 1
  AND NOT EXISTS (SELECT 1 FROM agendamento_consulta a WHERE a.processo_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM notificacao_destinatario n WHERE n.processo_id = p.id);

ALTER TABLE processo
    ALTER COLUMN consulta_periodica_habilitada SET DEFAULT 0;
