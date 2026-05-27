-- Remove duplicatas de audiências replicadas do formulário de processos,
-- mantendo apenas o registro mais recente por (usuario_id, processo_ref, origem).
DELETE ae FROM agenda_evento ae
INNER JOIN (
    SELECT processo_ref, usuario_id, origem, MAX(id) AS max_id
    FROM agenda_evento
    WHERE origem = 'processos-audiencia'
      AND processo_ref IS NOT NULL
    GROUP BY processo_ref, usuario_id, origem
    HAVING COUNT(*) > 1
) dup ON ae.processo_ref = dup.processo_ref
    AND ae.usuario_id = dup.usuario_id
    AND ae.origem = dup.origem
    AND ae.id < dup.max_id;
