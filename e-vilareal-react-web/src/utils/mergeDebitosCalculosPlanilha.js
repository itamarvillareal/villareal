import { linhaTituloVaziaCalculos } from '../data/calculosTitulosParcelasSync.js';

/**
 * Merge de linhas da planilha `debitos.xlsx` no mapa de rodadas de Cálculos (aba Parcelamento).
 * Colunas: A=código cliente, B=vencimento 1ª parcela, C=valor 1ª parcela, G=processo, H=dimensão.
 * Linha 1 = cabeçalho; dados a partir da linha 2 (índice 1 na matriz).
 *
 * Coluna G agrupa linhas da planilha (nº legado). Se já existir rodada com débitos nesse proc, mantém o nº.
 * Se o proc já existir no cliente (API/rodadas) mas sem cálculo gravado — stub legado — usa sequência compacta
 * (75, 76…) em vez de reaproveitar o nº distante (ex.: 1474).
 *
 * Módulo autossuficiente (sem importar `processosDadosRelatorio`) para o script Node não puxar o grafo da app.
 */

const PARCELAS_POR_PAGINA_MOCK = 20;

function normalizarCliente(val) {
  const s = String(val ?? '').trim();
  if (!s) return '1';
  const n = Number(s);
  if (Number.isNaN(n) || n < 1) return '1';
  return String(n);
}

function normalizarProcesso(val) {
  const s = String(val ?? '').trim();
  if (!s) return 1;
  const n = Number(s);
  if (Number.isNaN(n) || n < 1) return 1;
  return Math.floor(n);
}

function padCliente(val) {
  const n = Number(normalizarCliente(val));
  return String(n).padStart(8, '0');
}

function gerarCabecalhoMock() {
  return { autor: '', reu: '' };
}

function gerarTitulosMock() {
  const vazio = {
    dataVencimento: '',
    valorInicial: '',
    atualizacaoMonetaria: '',
    diasAtraso: '',
    juros: '',
    multa: '',
    honorarios: '',
    total: '',
    descricaoValor: '',
  };
  return Array.from({ length: 60 }, () => ({ ...vazio }));
}

function linhaVaziaParcela() {
  return {
    dataVencimento: '',
    valorParcela: '',
    honorariosParcela: '',
    observacao: '',
    dataPagamento: '',
  };
}

function gerarParcelasMock() {
  return Array.from({ length: PARCELAS_POR_PAGINA_MOCK }, () => linhaVaziaParcela());
}

function criarRodadaMockCalculos(_codClienteRaw, _procRaw, _dimensaoRaw, overrides = {}) {
  const base = {
    pagina: 1,
    paginaParcelamento: 1,
    titulos: gerarTitulosMock(),
    parcelas: gerarParcelasMock(),
    quantidadeParcelasInformada: '00',
    taxaJurosParcelamento: '0,00',
    limpezaAtiva: false,
    snapshotAntesLimpeza: null,
    cabecalho: gerarCabecalhoMock(),
    honorariosDataRecebimento: {},
    parcelamentoAceito: false,
    panelConfig: undefined,
  };
  return { ...base, ...overrides };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Serial Excel (parte inteira) → YYYY-MM-DD (UTC), alinhado a import-agenda-planilha.mjs */
function excelSerialParaISO(serial) {
  if (typeof serial !== 'number' || !Number.isFinite(serial)) return null;
  const whole = Math.floor(serial);
  if (whole < 1) return null;
  const utcMs = (whole - 25569) * 86400 * 1000;
  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Célula de data → ISO yyyy-mm-dd ou null */
function parseDataCelulaParaISO(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) {
    const whole = Math.floor(val);
    if (whole > 20000 && whole < 200000) return excelSerialParaISO(val);
    if (val >= 1 && val <= 31 && val === Math.floor(val)) return null;
  }
  const s = String(val).trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${pad2(br[2])}-${pad2(br[1])}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function isoParaDataBR(iso) {
  if (!iso) return '';
  const parts = String(iso).split('-');
  if (parts.length !== 3) return '';
  const [y, m, d] = parts.map((p) => Number(p));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return '';
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

export function formatBRLDebitos(n) {
  const v = Number(n) || 0;
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

import { parseValorMonetarioBr } from './parseValorMonetarioBr.js';

function parseValorCelula(val) {
  return parseValorMonetarioBr(val);
}

function rodadaKeyFromAGH(codRaw, procRaw, dimRaw) {
  const cod8 = padCliente(codRaw);
  const proc = normalizarProcesso(procRaw);
  const dim = Math.max(0, Math.floor(Number(dimRaw) || 0));
  return `${cod8}:${proc}:${dim}`;
}

function campoValorNaoVazio(s) {
  return String(s ?? '').trim() !== '';
}

function rodadaTemValorTituloOuParcela(rodada) {
  if (!rodada || typeof rodada !== 'object') return false;
  for (const t of Array.isArray(rodada.titulos) ? rodada.titulos : []) {
    if (t && (campoValorNaoVazio(t.valorInicial) || campoValorNaoVazio(t.valorParcela))) return true;
  }
  for (const p of Array.isArray(rodada.parcelas) ? rodada.parcelas : []) {
    if (p && campoValorNaoVazio(p.valorParcela)) return true;
  }
  return false;
}

function rodadaTemConteudoParaProc(rodadasAtual, cod8, proc) {
  const prefix = `${cod8}:${proc}:`;
  for (const [key, rodada] of Object.entries(rodadasAtual || {})) {
    if (!key.startsWith(prefix)) continue;
    if (rodadaTemValorTituloOuParcela(rodada)) return true;
  }
  return false;
}

/** Menor `numero_interno` ≥ 1 ainda não presente no conjunto (sequência compacta). */
export function proximoNumeroInternoDisponivel(usadosSet) {
  const usados = usadosSet instanceof Set ? usadosSet : new Set(usadosSet);
  let n = 1;
  while (usados.has(n)) n += 1;
  return n;
}

/**
 * @param {Record<string, unknown>} rodadasAtual
 * @param {Record<string, number[]>} [numerosInternosApi] cod8 → lista de proc já existentes no cliente
 * @returns {Map<string, Set<number>>}
 */
export function coletarNumerosInternosUsadosPorCliente(rodadasAtual, numerosInternosApi = {}) {
  /** @type {Map<string, Set<number>>} */
  const map = new Map();
  const add = (cod8, ni) => {
    const n = Math.floor(Number(ni));
    if (!Number.isFinite(n) || n < 1) return;
    const key = padCliente(cod8);
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(n);
  };
  for (const key of Object.keys(rodadasAtual || {})) {
    const m = /^(\d{8}):(\d+):\d+$/.exec(key);
    if (m) add(m[1], Number(m[2]));
  }
  for (const [codRaw, lista] of Object.entries(numerosInternosApi || {})) {
    for (const ni of Array.isArray(lista) ? lista : []) add(codRaw, ni);
  }
  return map;
}

function buildApiPorCod8(numerosInternosApi = {}) {
  /** @type {Map<string, Set<number>>} */
  const map = new Map();
  for (const [codRaw, lista] of Object.entries(numerosInternosApi || {})) {
    const cod8 = padCliente(codRaw);
    const set = new Set();
    for (const ni of Array.isArray(lista) ? lista : []) {
      const n = Math.floor(Number(ni));
      if (Number.isFinite(n) && n >= 1) set.add(n);
    }
    map.set(cod8, set);
  }
  return map;
}

export function procLegadoDeveRemapear(cod8, procSheet, usadosPorCod8, apiPorCod8) {
  const cod = padCliente(cod8);
  if (!apiPorCod8?.get(cod)?.has(procSheet)) return false;
  const usados = usadosPorCod8.get(cod);
  if (!usados?.has(procSheet)) return false;
  return procSheet > proximoNumeroInternoDisponivel(usados);
}

/**
 * @param {string} cod8
 * @param {number} procSheet
 * @param {Record<string, unknown>} rodadasAtual
 * @param {Map<string, Set<number>>} usadosPorCod8
 * @param {Map<string, number>} remapCache `${cod8}|${procSheet}` → proc destino
 * @param {string[]} [avisos]
 * @param {number} [sheetRow]
 */
function resolverProcImportacaoDebitos(
  cod8,
  procSheet,
  rodadasAtual,
  usadosPorCod8,
  remapCache,
  avisos,
  sheetRow,
  apiPorCod8
) {
  const cacheKey = `${cod8}|${procSheet}`;
  if (remapCache.has(cacheKey)) return remapCache.get(cacheKey);

  const legado = procLegadoDeveRemapear(cod8, procSheet, usadosPorCod8, apiPorCod8);
  if (rodadaTemConteudoParaProc(rodadasAtual, cod8, procSheet) && !legado) {
    remapCache.set(cacheKey, procSheet);
    return procSheet;
  }

  if (!usadosPorCod8.has(cod8)) usadosPorCod8.set(cod8, new Set());
  const usados = usadosPorCod8.get(cod8);

  let dest = procSheet;
  if (legado) {
    dest = proximoNumeroInternoDisponivel(usados);
    if (dest !== procSheet && Array.isArray(avisos)) {
      const prefix = sheetRow != null ? `Linha ${sheetRow}: ` : '';
      avisos.push(`${prefix}proc ${procSheet} (legado) → ${dest} (sequência compacta).`);
    }
  }

  remapCache.set(cacheKey, dest);
  usados.add(dest);
  return dest;
}

function mesclarRodadasCalculo(dest, src) {
  if (!src) return dest;
  if (!dest) return cloneRodada(src);
  const out = cloneRodada(dest);
  const incoming = cloneRodada(src);
  if (!out || !incoming) return out ?? incoming;
  if (rodadaTemValorTituloOuParcela(incoming) && !rodadaTemValorTituloOuParcela(out)) {
    return incoming;
  }
  if (rodadaTemValorTituloOuParcela(incoming)) {
    return {
      ...out,
      ...incoming,
      cabecalho: { ...(out.cabecalho ?? {}), ...(incoming.cabecalho ?? {}) },
      titulos: incoming.titulos ?? out.titulos,
      parcelas: incoming.parcelas ?? out.parcelas,
    };
  }
  return out;
}

/**
 * Move rodadas em nº de processo legado distante (ex.: 1474) para a sequência compacta (ex.: 75).
 *
 * @param {Record<string, unknown>} rodadas
 * @param {Record<string, number[]>} [numerosInternosApi]
 * @param {string[]} [avisosOut]
 */
export function migrarRodadasLegadoParaSequenciaCompacta(rodadas, numerosInternosApi = {}, avisosOut = []) {
  if (!rodadas || typeof rodadas !== 'object') return {};
  const base = { ...rodadas };
  const avisos = avisosOut;
  const usadosPorCod8 = coletarNumerosInternosUsadosPorCliente(base, numerosInternosApi);
  const apiPorCod8 = buildApiPorCod8(numerosInternosApi);
  const remapProc = new Map();

  for (const key of Object.keys(base)) {
    const m = /^(\d{8}):(\d+):(\d+)$/.exec(key);
    if (!m) continue;
    const cod8 = m[1];
    const proc = Number(m[2]);
    const dim = Number(m[3]);
    if (!procLegadoDeveRemapear(cod8, proc, usadosPorCod8, apiPorCod8)) continue;

    const dest = resolverProcImportacaoDebitos(
      cod8,
      proc,
      base,
      usadosPorCod8,
      remapProc,
      avisos,
      null,
      apiPorCod8
    );
    if (dest === proc) continue;

    const newKey = `${cod8}:${dest}:${dim}`;
    if (newKey === key) continue;

    avisos.push(`Rodada ${key} → ${newKey} (sequência compacta).`);
    base[newKey] = mesclarRodadasCalculo(base[newKey], base[key]);
    delete base[key];
  }
  return base;
}

function cloneRodada(r) {
  try {
    return JSON.parse(JSON.stringify(r));
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, unknown>} rodadasAtual
 * @param {unknown[][]} matrix - primeira linha = cabeçalho
 * @param {{ numerosInternosPorCliente8?: Record<string, number[]> }} [opts]
 * @returns {{ nextRodadas: Record<string, unknown>, stats: { linhasLidas: number, aplicadas: number, ignoradas: number, avisos: string[] } }}
 */
export function mergeDebitosCalculosPlanilha(rodadasAtual, matrix, opts = {}) {
  const avisos = [];
  const base = migrarRodadasLegadoParaSequenciaCompacta(
    rodadasAtual && typeof rodadasAtual === 'object' ? { ...rodadasAtual } : {},
    opts.numerosInternosPorCliente8,
    avisos
  );
  let linhasLidas = 0;
  let ignoradas = 0;
  let aplicadas = 0;

  if (!Array.isArray(matrix) || matrix.length < 2) {
    return {
      nextRodadas: base,
      stats: { linhasLidas: 0, aplicadas: 0, ignoradas: 0, avisos: ['Planilha sem linhas de dados (apenas cabeçalho ou vazia).'] },
    };
  }

  const usadosPorCod8 =
    opts.usadosPorCod8 ??
    coletarNumerosInternosUsadosPorCliente(base, opts.numerosInternosPorCliente8);
  const apiPorCod8 = opts.apiPorCod8 ?? buildApiPorCod8(opts.numerosInternosPorCliente8);
  /** `${cod8}|${procPlanilha}` → proc destino */
  const remapProc = opts.remapProc ?? new Map();

  /** Próximo índice de parcela/título por chave — várias linhas da planilha para o mesmo cliente/proc/dim. */
  const slotNext = new Map();

  for (let i = 1; i < matrix.length; i += 1) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    linhasLidas += 1;
    const sheetRow = i + 1;
    const a = row[0];
    const b = row[1];
    const c = row[2];
    const g = row[6];
    const h = row[7];

    const codNum = Number(String(a ?? '').trim().replace(/\D/g, '') || NaN);
    const procNum = Number(String(g ?? '').trim().replace(/\D/g, '') || NaN);
    if (!Number.isFinite(codNum) || codNum < 1 || !Number.isFinite(procNum) || procNum < 1) {
      ignoradas += 1;
      avisos.push(`Linha ${sheetRow}: ignorada (código cliente ou processo inválido).`);
      continue;
    }

    const dim = h === '' || h == null ? 0 : Math.max(0, Math.floor(Number(h) || 0));
    const cod8 = padCliente(codNum);
    const procDestino = resolverProcImportacaoDebitos(
      cod8,
      procNum,
      base,
      usadosPorCod8,
      remapProc,
      avisos,
      sheetRow,
      apiPorCod8
    );
    const key = rodadaKeyFromAGH(codNum, procDestino, dim);
    const slot = slotNext.get(key) ?? 0;
    slotNext.set(key, slot + 1);

    const iso = parseDataCelulaParaISO(b);
    const dataBR = iso ? isoParaDataBR(iso) : '';
    const valorNum = parseValorCelula(c);
    const valorBRL = valorNum != null ? formatBRLDebitos(valorNum) : '';

    if (!dataBR && !valorBRL) {
      ignoradas += 1;
      avisos.push(`Linha ${sheetRow}: ignorada (sem data nem valor em B/C).`);
      continue;
    }

    let rodada = base[key] ? cloneRodada(base[key]) : null;
    if (!rodada) {
      rodada = criarRodadaMockCalculos(codNum, procDestino, dim);
    }
    if (!rodada) {
      ignoradas += 1;
      avisos.push(`Linha ${sheetRow}: falha ao criar rodada.`);
      continue;
    }

    const parcelas = Array.isArray(rodada.parcelas) ? rodada.parcelas.map((p) => ({ ...p })) : gerarParcelasMock();
    while (parcelas.length <= slot) parcelas.push(linhaVaziaParcela());
    const pSlot = { ...parcelas[slot] };
    if (dataBR) pSlot.dataVencimento = dataBR;
    if (valorBRL) pSlot.valorParcela = valorBRL;
    parcelas[slot] = pSlot;

    /** A aba «Títulos» usa `titulos[i]` — espelha o mesmo índice que `parcelas[i]`. */
    let titulos = Array.isArray(rodada.titulos) ? rodada.titulos.map((t) => ({ ...linhaTituloVaziaCalculos(), ...t })) : gerarTitulosMock();
    if (titulos.length === 0) {
      titulos = gerarTitulosMock();
    }
    while (titulos.length <= slot) {
      titulos.push(linhaTituloVaziaCalculos());
    }
    const tSlot = { ...titulos[slot] };
    if (dataBR) tSlot.dataVencimento = dataBR;
    if (valorBRL) tSlot.valorInicial = valorBRL;
    titulos[slot] = tSlot;

    const maxOcupado = slot + 1;
    let qty = String(rodada.quantidadeParcelasInformada ?? '00').replace(/\D/g, '') || '0';
    let qn = Math.min(9999, Math.max(0, Number(qty)));
    if (dataBR || valorBRL) {
      qn = Math.max(qn, maxOcupado);
    }
    qty = qn <= 99 ? String(qn).padStart(2, '0') : String(qn);

    base[key] = {
      ...rodada,
      parcelas,
      titulos,
      quantidadeParcelasInformada: qty,
    };
    aplicadas += 1;
  }

  return {
    nextRodadas: base,
    stats: { linhasLidas, aplicadas, ignoradas, avisos },
  };
}

const ROW_CABECALHO_PLACEHOLDER = ['cod', 'venc', 'valor', '', '', '', 'proc', 'dim'];

/**
 * Mescla várias matrizes (ex.: uma por folha do Excel). Na 2ª folha em diante, se a 1ª linha
 * já parecer dados (A e G com cliente e processo válidos), insere cabeçalho fictício para o merge
 * manter «linha 1 = cabeçalho» em todas as folhas.
 */
/**
 * @param {Record<string, unknown>} rodadasAtual
 * @param {unknown[][][]} matrices
 * @param {{ numerosInternosPorCliente8?: Record<string, number[]> }} [opts]
 */
export function mergeDebitosCalculosMultiSheet(rodadasAtual, matrices, opts = {}) {
  const list = Array.isArray(matrices) ? matrices : [];
  let acc = rodadasAtual && typeof rodadasAtual === 'object' ? { ...rodadasAtual } : {};
  const avisos = [];
  let linhasLidas = 0;
  let aplicadas = 0;
  let ignoradas = 0;
  let sheetsUsadas = 0;
  const usadosPorCod8 = coletarNumerosInternosUsadosPorCliente(
    acc,
    opts.numerosInternosPorCliente8
  );
  const apiPorCod8 = buildApiPorCod8(opts.numerosInternosPorCliente8);
  const remapProc = new Map();

  for (let i = 0; i < list.length; i += 1) {
    let m = list[i];
    if (!Array.isArray(m) || m.length === 0) continue;
    if (i > 0 && m.length > 0) {
      const first = m[0];
      const codProbe = Number(String(first?.[0] ?? '').replace(/\D/g, '') || NaN);
      const procProbe = Number(String(first?.[6] ?? '').replace(/\D/g, '') || NaN);
      const pareceLinhaDados =
        Number.isFinite(codProbe) &&
        codProbe >= 1 &&
        Number.isFinite(procProbe) &&
        procProbe >= 1;
      if (pareceLinhaDados) {
        m = [ROW_CABECALHO_PLACEHOLDER, ...m];
      }
    }
    const { nextRodadas, stats } = mergeDebitosCalculosPlanilha(acc, m, {
      numerosInternosPorCliente8: opts.numerosInternosPorCliente8,
      usadosPorCod8,
      remapProc,
      apiPorCod8,
    });
    acc = nextRodadas;
    linhasLidas += stats.linhasLidas;
    aplicadas += stats.aplicadas;
    ignoradas += stats.ignoradas;
    for (const a of stats.avisos) avisos.push(`Folha ${i + 1}: ${a}`);
    sheetsUsadas += 1;
  }

  return {
    nextRodadas: acc,
    stats: { linhasLidas, aplicadas, ignoradas, avisos, sheetsUsadas },
  };
}
