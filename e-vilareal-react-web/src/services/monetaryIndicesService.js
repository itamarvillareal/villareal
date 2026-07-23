import { request } from '../api/httpClient.js';

const STORAGE_KEY = 'vilareal:indices-mensais:v2';

// Séries SGS/BCB usadas no fallback direto (INPC/IPCA/IPCA-E).
// Os demais índices vêm sempre da API backend (que persiste as séries no banco).
// IPCA-E → 7478 (IPCA-15 mensal): é a série que os txt legados «ipca-e» contêm.
const SGS_SERIES_BY_INDEX = {
  INPC: 1649,
  IPCA: 433,
  'IPCA-E': 7478,
};

/** Índices com série mensal real (BCB) suportados pela API backend. */
export const INDICES_SERIE_BCB = ['INPC', 'IPCA', 'IPCA-E', 'IGPM', 'SELIC', 'CDI', 'TR', 'POUPANCA'];

/** Normaliza o nome da tela para o canônico da API (POUPANÇA→POUPANCA, IGP-M→IGPM). */
export function nomeCanonicoIndice(nome) {
  const u = String(nome ?? '')
    .trim()
    .toUpperCase()
    .replace(/Ç/g, 'C');
  if (u === 'IGP-M') return 'IGPM';
  if (u === 'IPCAE') return 'IPCA-E';
  return u;
}

/** true quando o índice tem série mensal real (não é NENHUM nem desconhecido). */
export function indiceTemSerieBcb(nome) {
  return INDICES_SERIE_BCB.includes(nomeCanonicoIndice(nome));
}

function monthKeyFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function toDDMMYYYY(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function toISO(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function parseBCBNumber(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return 0;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // Formato típico: 1.234,56
    return Number(s.replace(/\./g, '').replace(',', '.'));
  }
  if (hasComma) {
    // Decimal em vírgula
    return Number(s.replace(',', '.'));
  }
  // Decimal em ponto (ou inteiro)
  return Number(s);
}

function loadStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Sem persistência não quebra o cálculo (apenas faz buscar de novo).
  }
}

/**
 * Busca a série na API backend (persistida no banco; só retorna competências publicadas).
 * @returns {Promise<Record<string, number>>} chaves `yyyy-MM`
 */
async function fetchSerieApiBackend(indice, startDate, endDate) {
  const resp = await request('/api/calculos/indices-mensais', {
    query: {
      indice,
      dataInicial: toISO(startDate),
      dataFinal: toISO(endDate),
    },
  });
  const values = resp?.values && typeof resp.values === 'object' ? resp.values : {};
  const out = {};
  for (const [mk, v] of Object.entries(values)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[mk] = n;
  }
  return out;
}

/** Fallback direto no BCB (apenas INPC/IPCA — comportamento original). */
async function fetchSerieBcbDireto(seriesCode, startDate, endDate) {
  const dataInicial = toDDMMYYYY(startDate);
  const dataFinal = toDDMMYYYY(endDate);
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesCode}/dados?formato=json&dataInicial=${encodeURIComponent(
    dataInicial,
  )}&dataFinal=${encodeURIComponent(dataFinal)}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Falha ao buscar SGS ${seriesCode}: HTTP ${resp.status}`);
  }
  const json = await resp.json();
  if (!Array.isArray(json)) return {};
  const out = {};
  for (const row of json) {
    // Ex: data: "01/01/2020"
    const ds = String(row.data ?? '').trim();
    const [dd, mm, yyyy] = ds.split('/');
    if (!dd || !mm || !yyyy) continue;
    out[`${yyyy}-${mm}`] = parseBCBNumber(row.valor);
  }
  return out;
}

/** Série do intervalo faltante: API backend primeiro; fallback BCB direto para INPC/IPCA. */
async function fetchSerie(indiceCanonico, startDate, endDate) {
  try {
    return await fetchSerieApiBackend(indiceCanonico, startDate, endDate);
  } catch (err) {
    const seriesCode = SGS_SERIES_BY_INDEX[indiceCanonico];
    if (!seriesCode) throw err;
    return fetchSerieBcbDireto(seriesCode, startDate, endDate);
  }
}

/**
 * Série mensal (%) do índice no intervalo, com cache local por competência.
 *
 * Regra de disponibilidade do legado:
 * - busca novas competências somente após o dia 10 do mês seguinte;
 * - competências anteriores já cacheadas nunca mudam (índice publicado é imutável).
 *
 * @param {string} indice INPC, IPCA, IPCA-E, IGPM, SELIC, CDI, TR, POUPANCA (aceita POUPANÇA)
 * @returns {Promise<Record<string, number>>} chaves `yyyy-MM`; competências sem dado = 0
 */
export async function obterIndicesMensais(indice, startDate, endDate) {
  if (!startDate || !endDate) return {};
  if (endDate < startDate) return {};

  const canonico = nomeCanonicoIndice(indice);
  if (!INDICES_SERIE_BCB.includes(canonico)) {
    throw new Error(`Índice sem série mensal BCB: ${indice}`);
  }
  const cacheSlot = canonico;

  const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  // Monta lista de competências exigidas (inclusive).
  const requiredMonthKeys = [];
  for (let cur = new Date(startMonth); cur <= endMonth; cur.setMonth(cur.getMonth() + 1)) {
    requiredMonthKeys.push(monthKeyFromDate(cur));
  }

  const storage = loadStorage();
  const cacheByIndex = storage[cacheSlot] && typeof storage[cacheSlot] === 'object' ? storage[cacheSlot] : {};
  const cachedValues = cacheByIndex.values && typeof cacheByIndex.values === 'object' ? cacheByIndex.values : {};

  const hoje = new Date();
  const day = hoje.getDate();
  const endOffsetMonths = day >= 10 ? 1 : 2; // antes do dia 10, a competência anterior pode ainda não estar disponível
  const allowedEndMonth = new Date(hoje.getFullYear(), hoje.getMonth() - endOffsetMonths, 1);
  const allowedEndMonthKey = monthKeyFromDate(allowedEndMonth);

  const missing = requiredMonthKeys.filter((mk) => cachedValues[mk] === undefined);
  const missingDisponivelAgora = missing.filter((mk) => mk <= allowedEndMonthKey);

  if (missingDisponivelAgora.length > 0) {
    const missingStart = missingDisponivelAgora[0];
    const missingEnd = missingDisponivelAgora[missingDisponivelAgora.length - 1];

    const [y1, m1] = missingStart.split('-').map((x) => Number(x));
    const [y2, m2] = missingEnd.split('-').map((x) => Number(x));
    const fetchStart = new Date(y1, m1 - 1, 1);
    const fetchEnd = new Date(y2, m2, 0); // último dia do mês

    const serie = await fetchSerie(canonico, fetchStart, fetchEnd);

    // Merge no cache existente (só competências publicadas — meses ausentes serão rebuscados).
    for (const [mk, v] of Object.entries(serie)) {
      cachedValues[mk] = v;
    }

    // Persiste.
    storage[cacheSlot] = { values: cachedValues };
    saveStorage(storage);
  }

  // Retorna apenas o intervalo solicitado.
  const result = {};
  for (const mk of requiredMonthKeys) {
    result[mk] = cachedValues[mk] ?? 0;
  }
  return result;
}

export async function obterIndicesMensaisINPC(startDate, endDate) {
  return obterIndicesMensais('INPC', startDate, endDate);
}

// Usado para replicar o cálculo do relatório (IPCA/“IPCA-E”) com variação mensal %.
export async function obterIndicesMensaisIPCA(startDate, endDate) {
  return obterIndicesMensais('IPCA', startDate, endDate);
}

function getCachedValues(cacheSlot) {
  const storage = loadStorage();
  const cacheByIndex = storage[cacheSlot] && typeof storage[cacheSlot] === 'object' ? storage[cacheSlot] : {};
  const cachedValues = cacheByIndex.values && typeof cacheByIndex.values === 'object' ? cacheByIndex.values : {};
  return cachedValues;
}

// Executar no boot do app para evitar buscar competências "antigas".
// Regra:
// - Sempre que o programa iniciar e estivermos após o dia 10,
//   checar se o mês anterior já está no cache; se não, baixar somente esse mês
//   (todos os índices com série real — o backend também faz isso via job diário).
export async function atualizarIndicesMensaisAposDia10() {
  const hoje = new Date();
  const dia = hoje.getDate();
  if (dia <= 10) return { skipped: true, reason: 'before_or_equal_day_10' };

  const prevMonthStart = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const prevMonthEnd = new Date(hoje.getFullYear(), hoje.getMonth(), 0); // último dia do mês anterior
  const prevMonthKey = monthKeyFromDate(prevMonthStart);

  const updates = [];

  const specs = ['INPC', 'IPCA', 'IPCA-E', 'IGPM', 'SELIC', 'CDI', 'TR', 'POUPANCA'];

  for (const indexName of specs) {
    try {
      const cachedValues = getCachedValues(indexName);
      const hasPrev = cachedValues[prevMonthKey] !== undefined;
      if (hasPrev) {
        updates.push({ indexName, updated: false, monthKey: prevMonthKey });
        continue;
      }

      // Baixa apenas a competência do mês anterior.
      await obterIndicesMensais(indexName, prevMonthStart, prevMonthEnd);
      updates.push({ indexName, updated: true, monthKey: prevMonthKey });
    } catch {
      updates.push({ indexName, updated: false, monthKey: prevMonthKey, failed: true });
    }
  }

  return { skipped: false, updates, monthKey: prevMonthKey };
}
