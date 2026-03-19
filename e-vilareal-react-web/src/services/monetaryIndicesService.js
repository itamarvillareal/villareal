const STORAGE_KEY = 'vilareal:indices-mensais:v1';

// INPC (variação mensal %): SGS 1649
// IPCA-E / IPCA (variação mensal %): SGS 433 (variação mensal %)
const SGS_SERIES_BY_INDEX = {
  INPC: 1649,
  IPCA: 433,
  'IPCA-E': 433,
};

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

async function fetchSGSMonthlyPercentVar(seriesCode, startDate, endDate) {
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
  if (!Array.isArray(json)) return [];
  return json;
}

async function obterIndicesMensaisPorSGS(seriesCode, cacheSlot, startDate, endDate) {
  if (!startDate || !endDate) return {};
  if (endDate < startDate) return {};

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

  // Regra de disponibilidade do legado:
  // - busca novas competências somente após o dia 10 do mês seguinte
  // - competências anteriores já cacheadas nunca mudam
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

    const seriesRows = await fetchSGSMonthlyPercentVar(seriesCode, fetchStart, fetchEnd);

    // Merge no cache existente.
    for (const row of seriesRows) {
      // Ex: data: "01/01/2020"
      const ds = String(row.data ?? '').trim();
      const [dd, mm, yyyy] = ds.split('/');
      if (!dd || !mm || !yyyy) continue;
      const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      const mk = monthKeyFromDate(d);
      cachedValues[mk] = parseBCBNumber(row.valor);
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
  return obterIndicesMensaisPorSGS(SGS_SERIES_BY_INDEX.INPC, 'INPC', startDate, endDate);
}

// Usado para replicar o cálculo do relatório (IPCA/“IPCA-E”) com variação mensal %.
export async function obterIndicesMensaisIPCA(startDate, endDate) {
  return obterIndicesMensaisPorSGS(SGS_SERIES_BY_INDEX.IPCA, 'IPCA', startDate, endDate);
}

function getCachedValues(cacheSlot) {
  const storage = loadStorage();
  const cacheByIndex = storage[cacheSlot] && typeof storage[cacheSlot] === 'object' ? storage[cacheSlot] : {};
  const cachedValues = cacheByIndex.values && typeof cacheByIndex.values === 'object' ? cacheByIndex.values : {};
  return cachedValues;
}

// Executar no boot do app para evitar buscar competências "antigas".
// Regra pedida:
// - Sempre que o programa iniciar e estivermos após o dia 10,
//   checar se o mês anterior já está no cache; se não, baixar somente esse mês.
export async function atualizarIndicesMensaisAposDia10() {
  const hoje = new Date();
  const dia = hoje.getDate();
  if (dia <= 10) return { skipped: true, reason: 'before_or_equal_day_10' };

  const prevMonthStart = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const prevMonthEnd = new Date(hoje.getFullYear(), hoje.getMonth(), 0); // último dia do mês anterior
  const prevMonthKey = monthKeyFromDate(prevMonthStart);

  const updates = [];

  const specs = [
    { indexName: 'INPC', cacheSlot: 'INPC', seriesCode: SGS_SERIES_BY_INDEX.INPC },
    { indexName: 'IPCA', cacheSlot: 'IPCA', seriesCode: SGS_SERIES_BY_INDEX.IPCA },
  ];

  for (const spec of specs) {
    const cachedValues = getCachedValues(spec.cacheSlot);
    const hasPrev = cachedValues[prevMonthKey] !== undefined;
    if (hasPrev) {
      updates.push({ indexName: spec.indexName, updated: false, monthKey: prevMonthKey });
      continue;
    }

    // Baixa apenas a competência do mês anterior.
    await obterIndicesMensaisPorSGS(spec.seriesCode, spec.cacheSlot, prevMonthStart, prevMonthEnd);
    updates.push({ indexName: spec.indexName, updated: true, monthKey: prevMonthKey });
  }

  return { skipped: false, updates, monthKey: prevMonthKey };
}

