-- Produção: manter somente usuários 1 (Itamar) e 2 (Karla).
-- Remove Ana Luísa (3), Marina teste (100005) e Júlia IA (100006).

-- Evita violação de uq_agenda_audiencia_processo ao mover eventos da Ana para Itamar.
DELETE ae FROM agenda_evento ae
INNER JOIN agenda_evento exist ON exist.usuario_id = 1
  AND ae.origem = 'processos-audiencia'
  AND exist.origem = 'processos-audiencia'
  AND ae.processo_ref = exist.processo_ref
  AND ae.processo_ref IS NOT NULL
WHERE ae.usuario_id = 3;

UPDATE agenda_evento SET usuario_id = 1 WHERE usuario_id = 3;

DELETE FROM agenda_evento WHERE usuario_id = 100005;

DELETE FROM usuarios WHERE id IN (3, 100005, 100006);
