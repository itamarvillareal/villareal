/** Limite inferior alinhado ao histórico importado (Itaú desde 2014). */
export const ANO_MINIMO_PADRAO = 2014;

export function mesAtualIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function anoAtual() {
  return String(new Date().getFullYear());
}

/** Valor especial: sem filtro de data (todos os lançamentos). */
export const PERIODO_TOTAL = 'TOTAL';

/** Valor do filtro: YYYY-MM (mês), YYYY (ano inteiro) ou {@link PERIODO_TOTAL}. */
export function isPeriodoAnoInteiro(val) {
  return /^\d{4}$/.test(String(val ?? '').trim());
}

export function isPeriodoTotal(val) {
  return String(val ?? '').trim().toUpperCase() === PERIODO_TOTAL;
}

export function modoPeriodo(val) {
  if (isPeriodoTotal(val)) return 'total';
  return isPeriodoAnoInteiro(val) ? 'ano' : 'mes';
}

/** Parâmetros `ano`/`mes` para listagem paginada; vazio = sem filtro de período. */
export function periodoParaListagemApi(val) {
  if (isPeriodoTotal(val)) return {};
  return periodoParaAnoMesApi(val);
}

/**
 * Intervalo ISO (inclusive) para filtrar lançamentos.
 * Usa dataInicio/dataFim — suportado pela API mesmo quando ano/mes sozinhos não filtram.
 */
export function periodoParaIntervalo(val) {
  const s = String(val ?? '').trim();
  if (isPeriodoAnoInteiro(s)) {
    const ano = Number(s);
    return { dataInicio: `${ano}-01-01`, dataFim: `${ano}-12-31` };
  }
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  if (!ano || !mes) return null;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return {
    dataInicio: `${ano}-${m[2]}-01`,
    dataFim: `${ano}-${m[2]}-${String(ultimoDia).padStart(2, '0')}`,
  };
}

/** Parâmetros para GET /lancamentos/paginada e similares. */
export function periodoParaQueryApi(val) {
  const intervalo = periodoParaIntervalo(val);
  if (!intervalo) return {};
  return intervalo;
}

/** Mantém ano/mes para endpoints que só aceitam esses campos (ex.: pares sugeridos). */
export function periodoParaAnoMesApi(val) {
  const s = String(val ?? '').trim();
  if (isPeriodoAnoInteiro(s)) {
    return { ano: Number(s) };
  }
  const [ano, mes] = s.split('-').map(Number);
  if (!ano || !mes) return {};
  return { ano, mes };
}

export function dataNoPeriodo(dataIso, periodoVal) {
  if (isPeriodoTotal(periodoVal)) return true;
  const intervalo = periodoParaIntervalo(periodoVal);
  if (!intervalo) return true;
  const d = String(dataIso ?? '').slice(0, 10);
  if (!d) return false;
  return d >= intervalo.dataInicio && d <= intervalo.dataFim;
}

/** Referência YYYY-MM para APIs que exigem mês (ex.: fatura). */
export function periodoParaMesRefObrigatorio(val) {
  if (isPeriodoAnoInteiro(val)) {
    return `${val}-01`;
  }
  return val || mesAtualIso();
}
