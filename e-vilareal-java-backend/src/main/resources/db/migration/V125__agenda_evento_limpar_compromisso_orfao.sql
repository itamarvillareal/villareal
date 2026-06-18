-- Remove linhas «Compromisso» (placeholder de hora sem descrição) quando já existe
-- outro compromisso no mesmo usuário/data/hora com descrição real.
DELETE ae FROM agenda_evento ae
INNER JOIN agenda_evento real_ev ON real_ev.usuario_id = ae.usuario_id
    AND real_ev.data_evento = ae.data_evento
    AND real_ev.hora_evento <=> ae.hora_evento
    AND real_ev.id <> ae.id
    AND real_ev.descricao <> 'Compromisso'
WHERE ae.descricao = 'Compromisso'
  AND ae.hora_evento IS NOT NULL;
