/** Prefixo gravado em `origem` (API) e `loteRef` nos eventos locais. */
export const ORIGEM_AGENDA_LOTE_PREFIX = 'agenda-lote:';

export function criarLoteRefAgenda() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `lote-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function montarOrigemAgendaLote(loteRef) {
  const id = String(loteRef ?? '').trim();
  if (!id) return '';
  return `${ORIGEM_AGENDA_LOTE_PREFIX}${id}`;
}

export function extrairLoteRefDaOrigem(origem) {
  const o = String(origem ?? '').trim();
  if (!o.startsWith(ORIGEM_AGENDA_LOTE_PREFIX)) return '';
  return o.slice(ORIGEM_AGENDA_LOTE_PREFIX.length).trim();
}

export function eventoEhAgendaLote(ev) {
  if (!ev) return false;
  if (String(ev.loteRef ?? '').trim()) return true;
  return !!extrairLoteRefDaOrigem(ev.origem);
}

export function loteRefDoEvento(ev) {
  const direto = String(ev?.loteRef ?? '').trim();
  if (direto) return direto;
  return extrairLoteRefDaOrigem(ev?.origem);
}

export const SUFIXO_ULTIMO_AGENDAMENTO_LOTE = 'Último agendamento';

export function removerSufixoUltimoAgendamento(texto) {
  const t = String(texto ?? '').trim();
  const sufixo = ` — ${SUFIXO_ULTIMO_AGENDAMENTO_LOTE}`;
  if (t.endsWith(sufixo)) return t.slice(0, -sufixo.length).trim();
  if (t === SUFIXO_ULTIMO_AGENDAMENTO_LOTE) return '';
  return t;
}
