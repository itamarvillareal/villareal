/**
 * Log persistente das consultas automáticas de vínculo (Financeiro × Cálculos).
 * Permanece entre sessões; exclusão apenas pelo usuário master.
 */

export const STORAGE_CONSULTAS_VINCULO_LOG = 'vilareal.financeiro.consultasVinculo.log.v1';
/** '1' = master (pode excluir log); '0' = não master. Ausente = master (escritório single-user). */
export const STORAGE_USUARIO_MASTER = 'vilareal.usuario.master';

export function isUsuarioMaster() {
  if (typeof window === 'undefined') return false;
  const v = window.localStorage.getItem(STORAGE_USUARIO_MASTER);
  if (v === null || v === undefined || v === '') return true;
  return v === '1' || v === 'true' || v === 'sim';
}

export function setUsuarioMaster(habilitado) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_USUARIO_MASTER, habilitado ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function novoId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `cv-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * @returns {{ entries: Array<object>, nextSeq: number }}
 */
export function loadConsultasVinculoLog() {
  if (typeof window === 'undefined') return { entries: [], nextSeq: 1 };
  try {
    const raw = window.localStorage.getItem(STORAGE_CONSULTAS_VINCULO_LOG);
    if (!raw) return { entries: [], nextSeq: 1 };
    const p = JSON.parse(raw);
    if (!p || p.v !== 1 || !Array.isArray(p.entries)) return { entries: [], nextSeq: 1 };
    const entries = p.entries;
    const nextSeq =
      typeof p.nextSeq === 'number' && Number.isFinite(p.nextSeq)
        ? p.nextSeq
        : entries.reduce((m, e) => Math.max(m, Number(e.numero) || 0), 0) + 1;
    return { entries, nextSeq };
  } catch {
    return { entries: [], nextSeq: 1 };
  }
}

export function persistConsultasVinculoLog(entries) {
  if (typeof window === 'undefined') return;
  try {
    const nextSeq =
      entries.length === 0
        ? 1
        : entries.reduce((m, e) => Math.max(m, Number(e.numero) || 0), 0) + 1;
    window.localStorage.setItem(
      STORAGE_CONSULTAS_VINCULO_LOG,
      JSON.stringify({ v: 1, entries, nextSeq })
    );
  } catch {
    /* quota */
  }
}

/**
 * Congela e grava uma nova consulta no fim do log.
 * @param {{ sugestoes: unknown[], matchIndexPorSugestao: object, aprovarSugestao: object, totalSugestoes: number }} snap
 */
export function appendConsultaVinculoLogEntry(snap) {
  const { entries, nextSeq } = loadConsultasVinculoLog();
  const entry = {
    id: novoId(),
    numero: nextSeq,
    producedAtISO: new Date().toISOString(),
    totalSugestoes: snap.totalSugestoes ?? snap.sugestoes?.length ?? 0,
    sugestoes: JSON.parse(JSON.stringify(snap.sugestoes ?? [])),
    matchIndexPorSugestao: { ...(snap.matchIndexPorSugestao || {}) },
    aprovarSugestao: { ...(snap.aprovarSugestao || {}) },
  };
  const nextEntries = [...entries, entry];
  persistConsultasVinculoLog(nextEntries);
  return entry;
}

export function clearConsultasVinculoLog() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_CONSULTAS_VINCULO_LOG);
  } catch {
    /* ignore */
  }
}
