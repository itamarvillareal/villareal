/**
 * Montagem da tabela mês a mês para conferência de índices na tela Cálculos.
 */

/** Mesmo fator aplicado em Calculos.jsx (calcularAtualizacaoMonetariaINPC). */
export const INPC_ESCALA_VBA = 2.027220805003458;

const MESES_PT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

/** Índices (nome canônico) com série mensal real BCB além de INPC/IPCA. IPCA-E usa série própria (IPCA-15). */
export const INDICES_SERIE_OUTROS = ['IPCA-E', 'IGPM', 'SELIC', 'CDI', 'TR', 'POUPANCA'];

/** Normaliza nome da tela para o canônico da série (POUPANÇA→POUPANCA, IGP-M→IGPM). */
export function nomeCanonicoIndiceConferencia(nome) {
  const u = String(nome ?? '')
    .trim()
    .toUpperCase()
    .replace(/Ç/g, 'C');
  if (u === 'IGP-M') return 'IGPM';
  if (u === 'IPCAE') return 'IPCA-E';
  return u;
}

function parseDataEntrada(v) {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  const s = String(v).trim();
  if (!s || s.length < 10) return null;
  const [dd, mm, yyyy] = s.split('/');
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function monthKeyFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatCompetenciaLabel(monthKey) {
  const [y, m] = String(monthKey).split('-');
  const mi = Number(m) - 1;
  if (!y || mi < 0 || mi > 11) return monthKey;
  return `${MESES_PT[mi]}/${y}`;
}

export function formatPercentualBr(n, casas = 4) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })} %`;
}

/** Fator mensal → variação % equivalente (fator 1,045 → 4,5 %). */
export function fatorParaVariacaoPercentual(fator) {
  return (Number(fator) - 1) * 100;
}

/**
 * Intervalo de competências usado no recálculo (paridade com useEffect em Calculos.jsx).
 * @param {{ titulos?: Array, dataCalculo?: string, aceitarPagamento?: boolean, hoje?: string }} opts
 */
export function calcularIntervaloIndicesRodada(opts = {}) {
  const titulos = Array.isArray(opts.titulos) ? opts.titulos : [];
  const dataCalcDate =
    parseDataEntrada(opts.aceitarPagamento ? opts.dataCalculo : opts.hoje) ||
    parseDataEntrada(opts.dataCalculo) ||
    new Date();

  let minDataInicialAtual = null;
  let maxDataFinalAtual = dataCalcDate;

  for (const t of titulos) {
    const venc = parseDataEntrada(t?.dataVencimento);
    if (!venc) continue;
    const esp = t?.datasEspeciais && typeof t.datasEspeciais === 'object' ? t.datasEspeciais : {};
    const diAtual = parseDataEntrada(esp.dataInicialAtual) ?? venc;
    const dfAtual = parseDataEntrada(esp.dataFinalAtual) ?? dataCalcDate;

    if (diAtual && (!minDataInicialAtual || diAtual < minDataInicialAtual)) {
      minDataInicialAtual = diAtual;
    }
    if (dfAtual && dfAtual > maxDataFinalAtual) maxDataFinalAtual = dfAtual;
  }

  const inicio = minDataInicialAtual || dataCalcDate;
  const fim = maxDataFinalAtual || dataCalcDate;
  const fimIpca = new Date(fim.getFullYear(), fim.getMonth() - 1, 1);

  return { inicio, fim, fimIpca, dataCalculo: dataCalcDate };
}

/**
 * @param {Date} inicio
 * @param {Date} fim inclusive (1º dia de cada mês)
 */
export function listarCompetenciasMensais(inicio, fim) {
  if (!inicio || !fim || fim < inicio) return [];
  const start = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const end = new Date(fim.getFullYear(), fim.getMonth(), 1);
  const keys = [];
  for (let cur = new Date(start); cur <= end; cur.setMonth(cur.getMonth() + 1)) {
    keys.push(monthKeyFromDate(cur));
  }
  return keys;
}

/**
 * @param {string} indice
 * @param {Record<string, number>|null} mapInpc
 * @param {Record<string, number>|null} mapIpca
 * @param {{ inicio: Date, fim: Date, fimIpca?: Date }} intervalo
 * @param {Record<string, Record<string, number>>|null} [mapOutros] séries por nome canônico (IGPM, SELIC, …)
 */
export function montarLinhasIndicesConferencia(indice, mapInpc, mapIpca, intervalo, mapOutros = null) {
  const idx = nomeCanonicoIndiceConferencia(indice ?? 'INPC');
  const { inicio, fim, fimIpca } = intervalo;

  if (idx === 'INPC') {
    const keys = listarCompetenciasMensais(inicio, fim);
    return {
      tipo: 'serie',
      indice: idx,
      colunas: ['competencia', 'bcb', 'usado'],
      linhas: keys.map((mk) => {
        const bcb = Number(mapInpc?.[mk] ?? 0);
        const bcbAdj = bcb < 0 ? 0 : bcb;
        const usado = bcbAdj * INPC_ESCALA_VBA;
        return {
          competencia: mk,
          competenciaLabel: formatCompetenciaLabel(mk),
          bcb: bcbAdj,
          bcbLabel: formatPercentualBr(bcbAdj),
          usado,
          usadoLabel: formatPercentualBr(usado),
        };
      }),
      nota: 'Variação «Usado no cálculo» aplica o fator de escala do legado VBA sobre o índice BCB.',
    };
  }

  if (idx === 'IPCA' || idx === 'IPCA-E') {
    // IPCA-E tem série própria (IPCA-15 — fidelidade aos txt legados); IPCA usa a série 433.
    const mapa = idx === 'IPCA-E' ? (mapOutros && typeof mapOutros === 'object' ? mapOutros['IPCA-E'] : null) : mapIpca;
    const end = fimIpca && fimIpca < fim ? fimIpca : new Date(fim.getFullYear(), fim.getMonth() - 1, 1);
    const keys = listarCompetenciasMensais(inicio, end);
    return {
      tipo: 'serie',
      indice: idx,
      colunas: ['competencia', 'valor'],
      linhas: keys.map((mk) => {
        const v = Number(mapa?.[mk] ?? 0);
        return {
          competencia: mk,
          competenciaLabel: formatCompetenciaLabel(mk),
          valor: v,
          valorLabel: formatPercentualBr(v),
        };
      }),
      nota:
        idx === 'IPCA-E'
          ? 'Série IPCA-15 (SGS 7478 — mesma dos txt legados); competências até o mês anterior à data final (regra do relatório).'
          : 'Competências até o mês anterior à data final do cálculo (regra do relatório IPCA).',
    };
  }

  if (idx === 'NENHUM') {
    return {
      tipo: 'fixo',
      indice: idx,
      colunas: ['info'],
      linhas: [],
      nota: 'Índice «Nenhum»: atualização monetária não é aplicada.',
    };
  }

  // IGPM / SELIC / CDI / TR / POUPANCA: série mensal real (BCB, persistida no backend).
  const serie = mapOutros && typeof mapOutros === 'object' ? mapOutros[idx] : null;
  const keys = listarCompetenciasMensais(inicio, fim);
  return {
    tipo: 'serie',
    indice: idx,
    colunas: ['competencia', 'valor'],
    linhas: keys.map((mk) => {
      const v = Number(serie?.[mk] ?? 0);
      return {
        competencia: mk,
        competenciaLabel: formatCompetenciaLabel(mk),
        valor: v,
        valorLabel: formatPercentualBr(v),
      };
    }),
    nota: serie
      ? 'Variação mensal real (SGS/BCB); competência sem dado publicado aparece como 0.'
      : 'Série mensal ainda não carregada — valores exibidos como 0 até a busca concluir.',
  };
}
