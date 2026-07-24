const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fmtBRL(v) {
  const n = Number(v);
  return moeda.format(Number.isFinite(n) ? n : 0);
}

export function fmtPct(v) {
  const n = Number(v);
  return `${pct.format(Number.isFinite(n) ? n : 0)}%`;
}

export function recomendacaoTom(rec) {
  switch (rec) {
    case 'AMORTIZAR':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800';
    case 'MANTER_INVESTIDO':
      return 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-800';
    case 'BLOQUEADO_LIQUIDEZ':
    case 'BLOQUEADO_RESERVA':
      return 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800';
    case 'CONSORCIO_NAO_APLICA_JUROS':
      return 'bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-950/40 dark:text-sky-100 dark:border-sky-800';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600';
  }
}

export function recomendacaoLabel(rec) {
  const map = {
    AMORTIZAR: 'Amortizar cria valor',
    MANTER_INVESTIDO: 'Manter investido — amortizar destrói valor',
    INDIFERENTE: 'Indiferente (±0,3 p.p.)',
    CONSORCIO_NAO_APLICA_JUROS: 'Consórcio — lógica de juros não se aplica',
    BLOQUEADO_LIQUIDEZ: 'Bloqueado — caixa livre insuficiente',
    BLOQUEADO_RESERVA: 'Bloqueado — reserva abaixo do piso',
  };
  return map[rec] || rec;
}
