/**
 * Helpers para o checklist de competências (classificação de aluguéis mensais).
 */

export const ESTADO_COMPETENCIA = {
  VINCULADO: 'VINCULADO',
  CANDIDATO_UNICO: 'CANDIDATO_UNICO',
  CANDIDATOS_MULTIPLOS: 'CANDIDATOS_MULTIPLOS',
  SEM_CANDIDATO: 'SEM_CANDIDATO',
};

/** @returns {{ label: string, cls: string, icon: 'ok' | 'warn' | 'empty' | 'multi' }} */
export function infoEstadoCompetencia(estado) {
  switch (String(estado ?? '').toUpperCase()) {
    case ESTADO_COMPETENCIA.VINCULADO:
      return {
        label: 'Aluguel vinculado',
        cls: 'bg-emerald-50 border-emerald-200 text-emerald-900',
        icon: 'ok',
      };
    case ESTADO_COMPETENCIA.CANDIDATO_UNICO:
      return {
        label: '1 candidato',
        cls: 'bg-amber-50 border-amber-200 text-amber-950',
        icon: 'warn',
      };
    case ESTADO_COMPETENCIA.CANDIDATOS_MULTIPLOS:
      return {
        label: 'Vários candidatos',
        cls: 'bg-amber-50 border-amber-300 text-amber-950',
        icon: 'multi',
      };
    case ESTADO_COMPETENCIA.SEM_CANDIDATO:
    default:
      return {
        label: 'Sem candidato',
        cls: 'bg-slate-50 border-slate-200 text-slate-600',
        icon: 'empty',
      };
  }
}

/** Formata AAAA-MM para exibição curta (ex.: jun/2026). */
export function rotuloCompetenciaCurta(competencia) {
  const s = String(competencia ?? '').trim();
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  if (!m) return s || '—';
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const idx = Number(m[2]) - 1;
  return `${meses[idx] ?? m[2]}/${m[1]}`;
}

export function contarPendenciasMatriz(meses) {
  const list = Array.isArray(meses) ? meses : [];
  let pendentes = 0;
  for (const m of list) {
    const e = String(m?.estado ?? '').toUpperCase();
    if (e !== ESTADO_COMPETENCIA.VINCULADO) pendentes++;
  }
  return pendentes;
}

export function itemMatrizPorCompetencia(meses, competencia) {
  return (Array.isArray(meses) ? meses : []).find((m) => m?.competencia === competencia) ?? null;
}
