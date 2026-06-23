/** Intervalos menores que isso são tempo ininterrupto dentro da mesma sessão. */
const GAP_CONTINUO_MS_PADRAO = 5 * 60 * 1000;
/** Pausa igual ou maior encerra a sessão e inicia outra jornada. */
const GAP_NOVA_SESSAO_MS_PADRAO = 30 * 60 * 1000;
/** Sessões com duração menor que isso são ignoradas por completo. */
const SESSAO_MIN_MS_PADRAO = 1 * 60 * 1000;

/** @param {string} diaBr DD/MM/YYYY */
export function parseDiaBrSort(diaBr) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(diaBr ?? '').trim());
  if (!m) return 0;
  return +m[3] * 10000 + +m[2] * 100 + +m[1];
}

/** @param {{ ocorridoEm?: string, dataBr?: string, horaBr?: string }} row */
export function timestampAtividade(row) {
  if (row.ocorridoEm) {
    const t = Date.parse(row.ocorridoEm);
    if (!Number.isNaN(t)) return t;
  }
  const dm = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(row.dataBr ?? '').trim());
  const hm = /^(\d{2}):(\d{2}):(\d{2})/.exec(String(row.horaBr ?? '').trim());
  if (dm && hm) {
    return new Date(+dm[3], +dm[2] - 1, +dm[1], +hm[1], +hm[2], +hm[3]).getTime();
  }
  return NaN;
}

/** @param {{ ocorridoEm?: string, dataBr?: string, horaBr?: string }} row */
export function chaveDiaBr(row) {
  const s = String(row.dataBr ?? '').trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  const t = timestampAtividade(row);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/**
 * Agrupa timestamps em sessões de trabalho.
 * - Pausa ≥ gapNovaSessaoMinutos → nova sessão.
 * - Pausas menores (incl. < gapContinuoMinutos) permanecem na mesma sessão; o tempo
 *   é medido da primeira à última ação do bloco.
 * - Sessões com duração < sessaoMinMinutos são descartadas.
 * @param {number[]} timestampsMs
 * @param {{ gapContinuoMinutos?: number, gapNovaSessaoMinutos?: number, sessaoMinMinutos?: number }} [opts]
 * @returns {Array<{ inicio: number, fim: number, duracaoMs: number }>}
 */
export function agruparSessoesTrabalho(timestampsMs, opts = {}) {
  const gapNovaSessao = (opts.gapNovaSessaoMinutos ?? 30) * 60 * 1000;
  const sessaoMin = (opts.sessaoMinMinutos ?? 1) * 60 * 1000;

  const sorted = [...(timestampsMs ?? [])].filter((t) => !Number.isNaN(t)).sort((a, b) => a - b);
  if (!sorted.length) return [];

  const brutas = [];
  let inicio = sorted[0];
  let fim = sorted[0];
  let anterior = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const ts = sorted[i];
    const gap = ts - anterior;
    if (gap >= gapNovaSessao) {
      brutas.push({ inicio, fim });
      inicio = ts;
      fim = ts;
    } else {
      fim = ts;
    }
    anterior = ts;
  }
  brutas.push({ inicio, fim });

  return brutas
    .map((s) => ({ ...s, duracaoMs: s.fim - s.inicio }))
    .filter((s) => s.duracaoMs >= sessaoMin);
}

/**
 * Estima horas ativas por dia a partir do log de auditoria.
 * Cada sessão de trabalho conta da primeira à última ação do bloco.
 * @param {Array<{ ocorridoEm?: string, dataBr?: string, horaBr?: string }>} atividades
 * @param {{ gapContinuoMinutos?: number, gapNovaSessaoMinutos?: number, sessaoMinMinutos?: number }} [opts]
 */
export function calcularHorasAtivasPorDia(atividades, opts = {}) {
  const porDia = new Map();
  for (const row of atividades ?? []) {
    const ts = timestampAtividade(row);
    const dia = chaveDiaBr(row);
    if (!dia || Number.isNaN(ts)) continue;
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia).push(ts);
  }

  const pontos = [];
  for (const [dia, timestamps] of porDia) {
    const sessoes = agruparSessoesTrabalho(timestamps, opts);
    const ativoMs = sessoes.reduce((s, sessao) => s + sessao.duracaoMs, 0);

    pontos.push({
      dia,
      diaSort: parseDiaBrSort(dia),
      horas: arredondarHoras(ativoMs),
      atividades: timestamps.length,
      sessoes: sessoes.length,
    });
  }

  pontos.sort((a, b) => a.diaSort - b.diaSort);
  return pontos;
}

function arredondarHoras(ms) {
  return Math.round((ms / 3600000) * 100) / 100;
}

/**
 * Preenche dias sem atividade no período com zero horas.
 * @param {Array<{ dia: string, diaSort: number, horas: number, atividades: number }>} pontos
 * @param {string} dataInicioIso yyyy-MM-dd
 * @param {string} dataFimIso yyyy-MM-dd
 */
export function preencherPeriodo(pontos, dataInicioIso, dataFimIso) {
  if (!dataInicioIso || !dataFimIso) return pontos;
  const mapa = new Map(pontos.map((p) => [p.dia, p]));
  const out = [];
  const start = new Date(`${dataInicioIso}T12:00:00`);
  const end = new Date(`${dataFimIso}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return pontos;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dia = `${dd}/${mm}/${d.getFullYear()}`;
    out.push(mapa.get(dia) ?? { dia, diaSort: parseDiaBrSort(dia), horas: 0, atividades: 0, sessoes: 0 });
  }
  return out;
}

export function resumoProdutividade(pontos) {
  const comAtividade = pontos.filter((p) => p.atividades > 0);
  const totalHoras = pontos.reduce((s, p) => s + p.horas, 0);
  const mediaHoras =
    comAtividade.length > 0
      ? Math.round((totalHoras / comAtividade.length) * 100) / 100
      : 0;
  return {
    totalHoras: Math.round(totalHoras * 100) / 100,
    mediaHoras,
    diasComAtividade: comAtividade.length,
    diasNoPeriodo: pontos.length,
  };
}

export { GAP_CONTINUO_MS_PADRAO, GAP_NOVA_SESSAO_MS_PADRAO, SESSAO_MIN_MS_PADRAO };
