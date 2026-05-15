/**
 * Parser partilhado: planilha import-calculo.xls layout 2026.
 * Por defeito tenta inferir linha de cabeçalho/dados nas primeiras linhas (fallback legado L6/L7).
 * Usado por `relatorio-import-calculo-planilha.mjs` e `import-calculos-planilha-layout2026.mjs`.
 */

import XLSX from 'xlsx';
import { parseValorMonetarioBr } from '../../src/utils/parseValorMonetarioBr.js';

/** Exportação atual (Dropbox/import-calculo.xls): cabeçalho da grelha ~L5, dados ~L8 (L6–L7 vazias/seção). */
export const HEADER_ROW_1BASED_LAYOUT2026 = 5;
export const DATA_START_1BASED_LAYOUT2026 = 8;

/** Limite de linhas «sem chave» reportadas em detalhe (evita dezenas de milhares de avisos). */
const MAX_AVISOS_DETALHE_LAYOUT2026 = 250;

function colLetterToIndex0(letter) {
  const s = String(letter ?? '').trim().toUpperCase();
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 65 || c > 90) continue;
    n = n * 26 + (c - 64);
  }
  return Math.max(0, n - 1);
}

/** Colunas fixas da exportação layout 2026 (confirmado em import-calculo.xls maio/2026). */
export const COL_LAYOUT2026 = {
  /* Aba «Relatorio Debitos Cadastrad»: linha com Cód./Proc./Dimensão é ~L5 */
  ABA1_COD_CLIENTE: colLetterToIndex0('C'),
  ABA1_VENCIMENTO: colLetterToIndex0('F'),
  ABA1_VALOR_TITULO: colLetterToIndex0('H'),
  ABA1_PARCELA_REF: colLetterToIndex0('K'),
  ABA1_PROC: colLetterToIndex0('L'),
  ABA1_DIM: colLetterToIndex0('M'),
  /* Aba «Relatório - 001 a 999»: SIM na coluna «Cálculo Aceito» */
  ABA2_COD_CLIENTE: colLetterToIndex0('B'),
  ABA2_VENCIMENTO: colLetterToIndex0('E'),
  ABA2_DATA_PAGAMENTO: colLetterToIndex0('F'),
  ABA2_VALOR: colLetterToIndex0('G'),
  ABA2_OBS_PARCELA: colLetterToIndex0('I'),
  ABA2_PARCELA: colLetterToIndex0('J'),
  ABA2_PROC: colLetterToIndex0('K'),
  ABA2_FLAG_CALCULO_ACEITO_SIM: colLetterToIndex0('L'),
  ABA2_DIM: colLetterToIndex0('S'),
};

function stripAcc(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normHeaderCellLayout2026(s) {
  return stripAcc(String(s ?? '').trim())
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normSheetName(s) {
  return stripAcc(String(s ?? '').trim()).toLowerCase();
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function excelSerialParaISO(serial) {
  if (typeof serial !== 'number' || !Number.isFinite(serial)) return null;
  const whole = Math.floor(serial);
  if (whole < 1) return null;
  const utcMs = (whole - 25569) * 86400 * 1000;
  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function parseDataLayout2026(val) {
  if (val == null || val === '') return null;
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    return `${val.getFullYear()}-${pad2(val.getMonth() + 1)}-${pad2(val.getDate())}`;
  }
  if (typeof val === 'number' && Number.isFinite(val)) {
    const whole = Math.floor(val);
    if (whole > 20000 && whole < 200000) return excelSerialParaISO(val);
  }
  const s = String(val).trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${pad2(br[2])}-${pad2(br[1])}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

export function parseTextoLayout2026(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

export function normalizarCodigoClienteLayout2026(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    return String(Math.trunc(v)).padStart(8, '0');
  }
  let s = String(v).trim();
  s = s.replace(/\.0+$/, '');
  const digits = s.replace(/\D/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) return null;
  return String(n).padStart(8, '0');
}

export function parseNumeroProcessoLayout2026(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const n = Math.trunc(v);
    return n >= 1 ? n : null;
  }
  const s = String(v).trim().replace(/\D/g, '');
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

export function parseDimensaoLayout2026(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const n = Math.trunc(v);
    return n >= 0 ? n : null;
  }
  const s = String(v).trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return null;
  return n >= 0 ? n : null;
}

function parseParcelaNum(v) {
  return parseNumeroProcessoLayout2026(v);
}

const MAPEAMENTO_TITULO_POR_HEADER = [
  { campo: 'dataVencimento', norms: [normHeaderCellLayout2026('Data de Vencimento'), normHeaderCellLayout2026('Vencimento')] },
  { campo: 'valorInicial', norms: [normHeaderCellLayout2026('Valor Inicial'), normHeaderCellLayout2026('Valor'), normHeaderCellLayout2026('Principal')] },
  { campo: 'atualizacaoMonetaria', norms: [normHeaderCellLayout2026('Atualização Monetária'), normHeaderCellLayout2026('Atualizacao Monetaria')] },
  { campo: 'diasAtraso', norms: [normHeaderCellLayout2026('Dias Atraso'), normHeaderCellLayout2026('Dias de Atraso')] },
  { campo: 'juros', norms: [normHeaderCellLayout2026('Juros')] },
  { campo: 'multa', norms: [normHeaderCellLayout2026('Multa')] },
  { campo: 'honorarios', norms: [normHeaderCellLayout2026('Honorários'), normHeaderCellLayout2026('Honorarios')] },
  { campo: 'total', norms: [normHeaderCellLayout2026('Total')] },
  {
    campo: 'descricaoValor',
    norms: [
      normHeaderCellLayout2026('Descrição dos Valores'),
      normHeaderCellLayout2026('Descrição Valor'),
      normHeaderCellLayout2026('Descricao'),
    ],
  },
];

function mapearColunasTitulo(headerRow) {
  const map = {};
  const usados = new Set();
  for (const { campo, norms } of MAPEAMENTO_TITULO_POR_HEADER) {
    for (let c = 0; c < headerRow.length; c++) {
      if (usados.has(c)) continue;
      const h = normHeaderCellLayout2026(headerRow[c]);
      if (norms.includes(h)) {
        map[c] = campo;
        usados.add(c);
        break;
      }
    }
  }
  return map;
}

export function sheetToMatrixLayout2026(wb, sheetName) {
  const sh = wb.Sheets[sheetName];
  if (!sh) return [];
  return XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: true });
}

export function pickAbaDebitosCadastradosLayout2026(sheetNames) {
  for (const n of sheetNames) {
    const x = normSheetName(n);
    if (x.includes('relatorio') && x.includes('debitos') && x.includes('cadastrad')) return n;
  }
  for (const n of sheetNames) {
    const x = normSheetName(n);
    if (x.includes('debitos') && x.includes('cadastrad')) return n;
  }
  return null;
}

export function pickAbaRelatorio001999Layout2026(sheetNames) {
  for (const n of sheetNames) {
    const x = normSheetName(n);
    if (x.includes('relatorio') && (x.includes('001') || x.includes('999'))) return n;
  }
  for (const n of sheetNames) {
    const x = normSheetName(n);
    if (x.startsWith('relatorio') && !x.includes('debitos')) return n;
  }
  return null;
}

function linhaVazia(row) {
  if (!Array.isArray(row)) return true;
  return !row.some((c) => c != null && String(c).trim() !== '');
}

function cel(row, idx) {
  if (!Array.isArray(row) || idx < 0) return null;
  return idx < row.length ? row[idx] : null;
}

function linhaParaTitulo(row, headerRow, colTituloMap) {
  const C = COL_LAYOUT2026;
  const t = {
    dataVencimento: '',
    valorInicial: '',
    atualizacaoMonetaria: '',
    diasAtraso: '',
    juros: '',
    multa: '',
    honorarios: '',
    total: '',
    descricaoValor: '',
    datasEspeciais: null,
  };
  const venc = parseDataLayout2026(cel(row, C.ABA1_VENCIMENTO));
  const val = parseValorMonetarioBr(cel(row, C.ABA1_VALOR_TITULO));
  if (venc) t.dataVencimento = venc;
  if (val != null) t.valorInicial = String(val);

  for (const [cStr, campo] of Object.entries(colTituloMap)) {
    const c = Number(cStr);
    const raw = cel(row, c);
    if (raw == null || String(raw).trim() === '') continue;
    if (campo === 'dataVencimento') {
      const d = parseDataLayout2026(raw);
      if (d) t.dataVencimento = d;
    } else if (campo === 'valorInicial') {
      const vm = parseValorMonetarioBr(raw);
      if (vm != null) t.valorInicial = String(vm);
    } else {
      t[campo] = String(raw).trim();
    }
  }
  return t;
}

export function chaveRodadaLayout2026(cod8, proc, dim) {
  return `${cod8}|${proc}|${dim}`;
}

/**
 * Primeira linha após o cabeçalho com chave (código + proc + dimensão) válida.
 * Há folhas com linhas em branco ou lixo entre cabeçalho (L5) e dados (L8).
 */
function findFirstDataRowAfterHeader(matrix, hIdx, kind) {
  const C = COL_LAYOUT2026;
  const cols =
    kind === 'aba1'
      ? { cod: C.ABA1_COD_CLIENTE, proc: C.ABA1_PROC, dim: C.ABA1_DIM }
      : { cod: C.ABA2_COD_CLIENTE, proc: C.ABA2_PROC, dim: C.ABA2_DIM };

  const lim = Math.min(matrix.length, hIdx + 1 + 250);
  for (let r = hIdx + 1; r < lim; r++) {
    const row = matrix[r];
    if (linhaVazia(row)) continue;
    const cod = normalizarCodigoClienteLayout2026(cel(row, cols.cod));
    const proc = parseNumeroProcessoLayout2026(cel(row, cols.proc));
    const dim = parseDimensaoLayout2026(cel(row, cols.dim));
    if (cod && proc != null && dim != null) return r;
  }
  return Math.min(hIdx + 1, Math.max(0, matrix.length - 1));
}

/**
 * Localiza linha de cabeçalho nas primeiras linhas da folha (exportações variam: cabeçalho pode não ser a linha 6).
 * @param {unknown[][]} matrix
 * @param {'aba1' | 'aba2'} kind
 */
function inferHeaderDataIndices(matrix, kind) {
  const C = COL_LAYOUT2026;
  const codT = normHeaderCellLayout2026('Cód.');
  const procT = normHeaderCellLayout2026('Proc.');
  const dimT = normHeaderCellLayout2026('Dimensão');

  const cols =
    kind === 'aba1'
      ? { cod: C.ABA1_COD_CLIENTE, proc: C.ABA1_PROC, dim: C.ABA1_DIM }
      : { cod: C.ABA2_COD_CLIENTE, proc: C.ABA2_PROC, dim: C.ABA2_DIM };

  let bestR = HEADER_ROW_1BASED_LAYOUT2026 - 1;
  let bestScore = -1;

  const lim = Math.min(80, matrix?.length ?? 0);
  for (let r = 0; r < lim; r++) {
    const row = matrix[r];
    const rawCod = cel(row, cols.cod);
    const rawProc = cel(row, cols.proc);
    const rawDim = cel(row, cols.dim);
    const nc = normHeaderCellLayout2026(rawCod);
    const np = normHeaderCellLayout2026(rawProc);
    const nd = normHeaderCellLayout2026(rawDim);

    let score = 0;
    if (nc === codT) score += 12;
    else if (nc.includes('cod')) score += 4;

    if (np === procT) score += 12;
    else if (np.includes('proc')) score += 4;

    if (nd === dimT) score += 12;
    else if (nd.includes('dimen')) score += 4;

    const codigoData = normalizarCodigoClienteLayout2026(rawCod);
    const procData = parseNumeroProcessoLayout2026(rawProc);
    const dimData = parseDimensaoLayout2026(rawDim);
    if (codigoData && procData != null && dimData != null && score < 22) {
      score -= 10;
    }

    if (score > bestScore) {
      bestScore = score;
      bestR = r;
    }
  }

  const fallbackH = HEADER_ROW_1BASED_LAYOUT2026 - 1;
  const fallbackD = DATA_START_1BASED_LAYOUT2026 - 1;

  if (bestScore < 16) {
    return {
      hIdx: fallbackH,
      dIdx: fallbackD,
      inferred: false,
      score: bestScore,
      header1Based: fallbackH + 1,
      data1Based: fallbackD + 1,
    };
  }

  const dIdx = findFirstDataRowAfterHeader(matrix, bestR, kind);
  return {
    hIdx: bestR,
    dIdx,
    inferred: true,
    score: bestScore,
    header1Based: bestR + 1,
    data1Based: dIdx + 1,
  };
}

/**
 * @param {unknown[][]} matrix
 * @param {'aba1' | 'aba2'} kind
 * @param {{ headerRow?: number | null, dataRow?: number | null, headerRowAba1?: number | null, dataRowAba1?: number | null, headerRowAba2?: number | null, dataRowAba2?: number | null }} opts
 */
function resolveHeaderDataForSheet(matrix, kind, opts) {
  const sharedH = opts.headerRow ?? opts.headerRow1Based ?? null;
  const sharedD = opts.dataRow ?? opts.dataRow1Based ?? null;
  const hr = kind === 'aba1' ? (opts.headerRowAba1 ?? sharedH) : (opts.headerRowAba2 ?? sharedH);
  const dr = kind === 'aba1' ? (opts.dataRowAba1 ?? sharedD) : (opts.dataRowAba2 ?? sharedD);

  if (hr != null && dr != null) {
    return {
      hIdx: hr - 1,
      dIdx: dr - 1,
      meta: { inferred: false, header1Based: hr, data1Based: dr },
    };
  }
  if (hr != null) {
    const hIdx = hr - 1;
    const dIdx = findFirstDataRowAfterHeader(matrix, hIdx, kind);
    return {
      hIdx,
      dIdx,
      meta: { inferred: false, header1Based: hr, data1Based: dIdx + 1 },
    };
  }

  const inf = inferHeaderDataIndices(matrix, kind);
  return {
    hIdx: inf.hIdx,
    dIdx: inf.dIdx,
    meta: {
      inferred: inf.inferred,
      header1Based: inf.header1Based,
      data1Based: inf.data1Based,
      score: inf.score,
    },
  };
}

function pushAvisoCap(avisos, msg, capState) {
  if (capState.n >= MAX_AVISOS_DETALHE_LAYOUT2026) {
    capState.omitidas++;
    return;
  }
  avisos.push(msg);
  capState.n++;
}

/**
 * @param {import('xlsx').WorkBook} wb
 * @param {{ headerRow?: number, dataRow?: number, headerRowAba1?: number, dataRowAba1?: number, headerRowAba2?: number, dataRowAba2?: number, headerRow1Based?: number, dataRow1Based?: number }} [opts]
 */
export function parseLayout2026FromWorkbook(wb, opts = {}) {
  const C = COL_LAYOUT2026;

  const nameDebitos = pickAbaDebitosCadastradosLayout2026(wb.SheetNames);
  const nameRel = pickAbaRelatorio001999Layout2026(wb.SheetNames);

  const avisos = [];
  const capInvalidRows = { n: 0, omitidas: 0 };

  /** @type {Record<string, { titulos: object[], linhas: number[], parcelasRef: number[] }>} */
  const titulosPorChave = {};
  /** @type {Record<string, { parcelas: object[], linhas: number[], aceitarPagamento: boolean }>} */
  const parcelamentoPorChave = {};
  /** @type {{ col: number, letra: string, header: string }[]} */
  let colunasNaoMapeadasDebitos = [];
  /** @type {Record<number, string>} */
  let colTituloMapDebitos = {};

  /** @type {{ aba1: object | null, aba2: object | null }} */
  const layoutLinhas = { aba1: null, aba2: null };

  if (nameDebitos) {
    const m = sheetToMatrixLayout2026(wb, nameDebitos);
    const r1 = resolveHeaderDataForSheet(m, 'aba1', opts);
    const { hIdx: hIdx1, dIdx: dIdx1 } = r1;
    layoutLinhas.aba1 = r1.meta;

    const headerRow = m[hIdx1] || [];
    const colTituloMap = mapearColunasTitulo(headerRow);
    colTituloMapDebitos = colTituloMap;
    colunasNaoMapeadasDebitos = [];
    for (let c = 0; c < headerRow.length; c++) {
      const h = String(headerRow[c] ?? '').trim();
      if (!h) continue;
      if (!Object.prototype.hasOwnProperty.call(colTituloMap, c)) {
        colunasNaoMapeadasDebitos.push({ col: c, letra: XLSX.utils.encode_col(c), header: h });
      }
    }

    for (let i = dIdx1; i < m.length; i++) {
      const row = m[i];
      if (linhaVazia(row)) continue;
      const cod = normalizarCodigoClienteLayout2026(cel(row, C.ABA1_COD_CLIENTE));
      const proc = parseNumeroProcessoLayout2026(cel(row, C.ABA1_PROC));
      const dim = parseDimensaoLayout2026(cel(row, C.ABA1_DIM));
      const parc = parseParcelaNum(cel(row, C.ABA1_PARCELA_REF));
      if (!cod || proc == null || dim == null) {
        pushAvisoCap(
          avisos,
          `Aba débitos linha ${i + 1}: sem código/proc/dimensão válidos — ignorada para agregação.`,
          capInvalidRows
        );
        continue;
      }
      const key = chaveRodadaLayout2026(cod, proc, dim);
      if (!titulosPorChave[key]) {
        titulosPorChave[key] = { titulos: [], linhas: [], parcelasRef: [] };
      }
      const tit = linhaParaTitulo(row, headerRow, colTituloMap);
      titulosPorChave[key].titulos.push({ ...tit, _planilhaLinha: i + 1, _parcelaPlanilha: parc });
      titulosPorChave[key].linhas.push(i + 1);
      if (parc != null) titulosPorChave[key].parcelasRef.push(parc);
    }
  }

  if (nameRel) {
    const m = sheetToMatrixLayout2026(wb, nameRel);
    const r2 = resolveHeaderDataForSheet(m, 'aba2', opts);
    const { hIdx: hIdx2, dIdx: dIdx2 } = r2;
    layoutLinhas.aba2 = r2.meta;

    for (let i = dIdx2; i < m.length; i++) {
      const row = m[i];
      if (linhaVazia(row)) continue;
      const flag = String(cel(row, C.ABA2_FLAG_CALCULO_ACEITO_SIM) ?? '')
        .trim()
        .toUpperCase();
      if (flag !== 'SIM') continue;

      const cod = normalizarCodigoClienteLayout2026(cel(row, C.ABA2_COD_CLIENTE));
      const proc = parseNumeroProcessoLayout2026(cel(row, C.ABA2_PROC));
      const dim = parseDimensaoLayout2026(cel(row, C.ABA2_DIM));
      const parc = parseParcelaNum(cel(row, C.ABA2_PARCELA));
      if (!cod || proc == null || dim == null) {
        pushAvisoCap(
          avisos,
          `Aba relatório linha ${i + 1}: coluna L=SIM mas chave inválida — ignorada.`,
          capInvalidRows
        );
        continue;
      }
      const key = chaveRodadaLayout2026(cod, proc, dim);
      const parcela = {
        numero: parc,
        dataVencimento: parseDataLayout2026(cel(row, C.ABA2_VENCIMENTO)),
        dataPagamento: parseDataLayout2026(cel(row, C.ABA2_DATA_PAGAMENTO)),
        valorParcela: parseValorMonetarioBr(cel(row, C.ABA2_VALOR)),
        honorariosParcela: null,
        observacao: parseTextoLayout2026(cel(row, C.ABA2_OBS_PARCELA)),
      };
      if (parcela.numero == null) {
        pushAvisoCap(
          avisos,
          `Aba relatório linha ${i + 1}: parcela inválida (col. J) — ignorada.`,
          capInvalidRows
        );
        continue;
      }
      if (!parcelamentoPorChave[key]) {
        parcelamentoPorChave[key] = { parcelas: [], linhas: [], aceitarPagamento: true };
      }
      parcelamentoPorChave[key].parcelas.push({ ...parcela, _planilhaLinha: i + 1 });
      parcelamentoPorChave[key].linhas.push(i + 1);
    }
  }

  if (capInvalidRows.omitidas > 0) {
    avisos.push(
      `… mais ${capInvalidRows.omitidas} aviso(s) omitidos (limite ${MAX_AVISOS_DETALHE_LAYOUT2026} linhas inválidas em detalhe).`
    );
  }

  return {
    nameDebitos,
    nameRel,
    titulosPorChave,
    parcelamentoPorChave,
    avisos,
    colunasNaoMapeadasDebitos,
    colTituloMapDebitos,
    layoutLinhas,
  };
}
