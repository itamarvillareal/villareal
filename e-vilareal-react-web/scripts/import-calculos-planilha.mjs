#!/usr/bin/env node
/**
 * Importa rodadas de cálculos (parcelas + débitos) a partir de import-calculo.xls.
 *
 * Layout: cabeçalhos na linha 5 (1-based), dados da linha 8.
 * Detecção de colunas por texto do cabeçalho (trim + lower + sem acentos).
 *
 * Uso:
 *   node scripts/import-calculos-planilha.mjs "C:\\Users\\...\\import-calculo.xls" [--dry-run] [--codigo-cliente=00000491] [--login=itamar]
 *
 * Env: VILAREAL_API_BASE, VILAREAL_IMPORT_SENHA, VILAREAL_IMPORT_CONCURRENCY (default 3)
 *
 * PUT /api/calculos/rodadas/{codigoCliente}/{numeroProcesso}/{dimensao}
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';

const DEFAULT_FILE = 'C:\\Users\\jrvill\\Dropbox\\sistema\\import-calculo.xls';

const HEADER_LINE_1BASED = 5;
const DATA_START_1BASED = 8;

function stripAcc(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normHeaderCell(s) {
  return stripAcc(String(s ?? '').trim())
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normSheetName(s) {
  return stripAcc(String(s ?? '').trim()).toLowerCase();
}

function colLetter(idx0) {
  let n = idx0 + 1;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
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

function parseData(val) {
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

function parseValorMonetario(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const t = String(v).trim().replace(/\s/g, '');
  if (!t) return null;
  if (/R\$/i.test(t)) {
    const s = t.replace(/R\$/gi, '').replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  if (t.includes(',')) {
    const s = t.replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseTexto(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function normalizarCodigoCliente(v) {
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

function parseNumeroProcesso(v) {
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

function parseDimensao(v) {
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

function parseArgs(argv) {
  const out = {
    file: null,
    login: 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    dryRun: false,
    codigoCliente: null,
    concurrency: Math.min(
      32,
      Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY || 3) || 3)
    ),
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--codigo-cliente=')) out.codigoCliente = a.slice(17).trim();
    else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice(14));
      if (Number.isFinite(n) && n >= 1) out.concurrency = Math.min(32, Math.floor(n));
    } else if (!a.startsWith('-') && !out.file) out.file = a;
  }
  return out;
}

/** Mantém apenas chaves `${codigo8}|proc|dim`. */
function filtrarMapPorCodigoCliente(map, codigo8) {
  if (!codigo8) return map;
  const out = new Map();
  const prefix = `${codigo8}|`;
  for (const [k, v] of map) {
    if (k.startsWith(prefix)) out.set(k, v);
  }
  return out;
}

function somaMap(m) {
  let s = 0;
  for (const v of m.values()) s += v;
  return s;
}

/** @param {Map<string, number>} m */
function formatarContagemPorCliente(m) {
  const keys = [...m.keys()].sort((a, b) => Number(a) - Number(b));
  if (!keys.length) return '(nenhum)';
  return keys.map((k) => `${Number(k)}=${m.get(k)}`).join(', ');
}

function pickAba1(sheetNames) {
  for (const n of sheetNames) {
    const x = normSheetName(n);
    if (x.startsWith('relatorio') && !x.startsWith('relatorio debitos')) return n;
  }
  return null;
}

function pickAba2(sheetNames) {
  for (const n of sheetNames) {
    const x = normSheetName(n);
    if (x.startsWith('relatorio debitos')) return n;
  }
  return null;
}

/**
 * @param {unknown[]} headerRow - linha 5
 * @param {{ field: string, label: string, norm: string }[]} required
 * @returns {Record<string, number>}
 */
function resolveHeaderColumns(headerRow, required) {
  const row = Array.isArray(headerRow) ? headerRow : [];
  const missing = [];
  const map = {};
  for (const { field, label, norm } of required) {
    let idx = -1;
    for (let c = 0; c < row.length; c++) {
      if (normHeaderCell(row[c]) === norm) {
        idx = c;
        break;
      }
    }
    if (idx < 0) missing.push(label);
    else map[field] = idx;
  }
  if (missing.length) {
    console.error(
      `[import-calculos] Cabeçalhos esperados não encontrados na linha ${HEADER_LINE_1BASED}:\n  - ${missing.join('\n  - ')}`
    );
    process.exit(1);
  }
  return map;
}

const ABA1_REQUIRED = [
  { field: 'codigoCliente', label: 'Cód.', norm: normHeaderCell('Cód.') },
  { field: 'numeroProcesso', label: 'Proc.', norm: normHeaderCell('Proc.') },
  { field: 'dimensao', label: 'Dimensão', norm: normHeaderCell('Dimensão') },
  { field: 'calculoAceito', label: 'Cálculo Aceito', norm: normHeaderCell('Cálculo Aceito') },
  { field: 'parcela', label: 'Parcela', norm: normHeaderCell('Parcela') },
  { field: 'dataVencimento', label: 'Data de Vencimento', norm: normHeaderCell('Data de Vencimento') },
  { field: 'dataPagamento', label: 'Data de Pagamento', norm: normHeaderCell('Data de Pagamento') },
  { field: 'valor', label: 'Valor', norm: normHeaderCell('Valor') },
  { field: 'valorHonorarios', label: 'Valor Honorários', norm: normHeaderCell('Valor Honorários') },
  { field: 'obs', label: 'Obs', norm: normHeaderCell('Obs') },
];

const ABA2_REQUIRED = [
  { field: 'codigoCliente', label: 'Cód.', norm: normHeaderCell('Cód.') },
  { field: 'numeroProcesso', label: 'Proc.', norm: normHeaderCell('Proc.') },
  { field: 'dimensao', label: 'Dimensão', norm: normHeaderCell('Dimensão') },
  { field: 'dataVencimento', label: 'Data de Vencimento', norm: normHeaderCell('Data de Vencimento') },
  { field: 'dataPagamento', label: 'Data de Pagamento', norm: normHeaderCell('Data de Pagamento') },
  { field: 'valor', label: 'Valor', norm: normHeaderCell('Valor') },
  { field: 'chaveCod', label: 'Chave Cod.', norm: normHeaderCell('Chave Cod.') },
  { field: 'chaveDesc', label: 'Chave Descrição', norm: normHeaderCell('Chave Descrição') },
  { field: 'dataInicialJuros', label: 'Data Inicial Juros', norm: normHeaderCell('Data Inicial Juros') },
  {
    field: 'dataInicialAtualizacaoMonetaria',
    label: 'Data Inicial Atualização Monetária',
    norm: normHeaderCell('Data Inicial Atualização Monetária'),
  },
];

function sheetToMatrix(wb, sheetName) {
  const sh = wb.Sheets[sheetName];
  if (!sh) return [];
  return XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: true });
}

function parseAba1Rows(matrix, col) {
  const parcelasPorChave = new Map();
  /** Linhas que viram parcela (SIM + chave válida + parcela válida), por código 8 dígitos. */
  const linhasPorCliente = new Map();
  const start = DATA_START_1BASED - 1;
  for (let i = start; i < matrix.length; i++) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    const aceitoRaw = row[col.calculoAceito];
    const aceito = String(aceitoRaw ?? '')
      .trim()
      .toUpperCase();
    if (aceito !== 'SIM') continue;

    const codigoCliente = normalizarCodigoCliente(row[col.codigoCliente]);
    const numeroProcesso = parseNumeroProcesso(row[col.numeroProcesso]);
    const dimensao = parseDimensao(row[col.dimensao]);
    if (!codigoCliente || numeroProcesso == null || dimensao == null) {
      console.warn(
        `[import-calculos] Aba1 linha ${i + 1}: SIM mas dados de chave inválidos (código/proc/dimensão) — ignorada`
      );
      continue;
    }
    const key = `${codigoCliente}|${numeroProcesso}|${dimensao}`;
    const parcela = {
      numero: parseNumeroProcesso(row[col.parcela]),
      dataVencimento: parseData(row[col.dataVencimento]),
      dataPagamento: parseData(row[col.dataPagamento]),
      valorParcela: parseValorMonetario(row[col.valor]),
      honorariosParcela: parseValorMonetario(row[col.valorHonorarios]),
      observacao: parseTexto(row[col.obs]),
    };
    if (parcela.numero == null) {
      console.warn(`[import-calculos] Aba1 linha ${i + 1}: Parcela inválida — ignorada`);
      continue;
    }
    if (!parcelasPorChave.has(key)) parcelasPorChave.set(key, []);
    parcelasPorChave.get(key).push(parcela);
    linhasPorCliente.set(codigoCliente, (linhasPorCliente.get(codigoCliente) ?? 0) + 1);
  }
  for (const [, arr] of parcelasPorChave) {
    arr.sort((a, b) => a.numero - b.numero);
  }
  return { parcelasPorChave, linhasPorCliente };
}

function parseAba2Rows(matrix, col) {
  const debitosPorChave = new Map();
  /** Linhas com chave válida que viram débito, por código 8 dígitos. */
  const linhasPorCliente = new Map();
  const start = DATA_START_1BASED - 1;
  const ordemGlobalPorChave = new Map();

  for (let i = start; i < matrix.length; i++) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    const rawCod = row[col.codigoCliente];
    const rawProc = row[col.numeroProcesso];
    const rawDim = row[col.dimensao];
    const semChave =
      (rawCod == null || String(rawCod).trim() === '') &&
      (rawProc == null || String(rawProc).trim() === '') &&
      (rawDim == null || String(rawDim).trim() === '');
    if (semChave) continue;

    const codigoCliente = normalizarCodigoCliente(rawCod);
    const numeroProcesso = parseNumeroProcesso(rawProc);
    const dimensao = parseDimensao(rawDim);
    if (!codigoCliente || numeroProcesso == null || dimensao == null) {
      console.warn(`[import-calculos] Aba2 linha ${i + 1}: chave inválida — linha ignorada`);
      continue;
    }
    const key = `${codigoCliente}|${numeroProcesso}|${dimensao}`;
    const pos = (ordemGlobalPorChave.get(key) ?? 0) + 1;
    ordemGlobalPorChave.set(key, pos);

    const debito = {
      posicao: pos,
      chaveCodigo: parseTexto(row[col.chaveCod]),
      chaveDescricao: parseTexto(row[col.chaveDesc]),
      dataVencimento: parseData(row[col.dataVencimento]),
      dataPagamento: parseData(row[col.dataPagamento]),
      valor: parseValorMonetario(row[col.valor]),
      dataInicialJuros: parseData(row[col.dataInicialJuros]),
      dataInicialAtualizacaoMonetaria: parseData(row[col.dataInicialAtualizacaoMonetaria]),
    };
    if (!debitosPorChave.has(key)) debitosPorChave.set(key, []);
    debitosPorChave.get(key).push(debito);
    linhasPorCliente.set(codigoCliente, (linhasPorCliente.get(codigoCliente) ?? 0) + 1);
  }
  return { debitosPorChave, linhasPorCliente };
}

function buildRodadas(parcelasPorChave, debitosPorChave) {
  const keys = new Set([...parcelasPorChave.keys(), ...debitosPorChave.keys()]);
  const sortedKeys = [...keys].sort();
  const items = [];
  for (const key of sortedKeys) {
    const parcelas = parcelasPorChave.get(key) ?? [];
    const debitos = debitosPorChave.get(key) ?? [];
    const inA = parcelas.length > 0;
    const payload = inA
      ? { parcelamentoAceito: true, parcelas, debitos }
      : { parcelamentoAceito: false, parcelas: [], debitos };
    const [cod8, procS, dimS] = key.split('|');
    items.push({
      key,
      cod8,
      numeroProcesso: Number(procS),
      dimensao: Number(dimS),
      scenario: inA ? 'A' : 'B',
      payload,
    });
  }
  return { items, sortedKeys };
}

async function login(opts) {
  const loginUrl = `${opts.baseUrl}/api/auth/login`;
  const loginNorm = String(opts.login).trim().toLowerCase();
  const loginRes = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: loginNorm, senha: opts.senha }),
  });
  if (!loginRes.ok) {
    const t = await loginRes.text();
    throw new Error(`Login falhou ${loginRes.status}: ${t.slice(0, 400)}`);
  }
  const loginJson = await loginRes.json();
  const token = loginJson.accessToken;
  if (!token) throw new Error('Resposta login sem accessToken');
  return token;
}

async function runPool(items, concurrency, fn) {
  let i = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

/** PUT /api/calculos/rodadas/{codigoCliente8}/{numeroProcesso}/{dimensao} — substituição total da rodada. */
async function putRodada(baseUrl, token, item, stats) {
  const url = `${baseUrl}/api/calculos/rodadas/${item.cod8}/${item.numeroProcesso}/${item.dimensao}`;
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(item.payload),
    });
    const txt = await res.text();
    if (res.status === 200 || res.status === 201) {
      if (item.scenario === 'A') stats.criadas_A++;
      else stats.criadas_B++;
      return;
    }
    stats.falhas++;
    console.warn(`[import-calculos] PUT falhou ${item.key}: ${res.status} ${txt.slice(0, 300)}`);
  } catch (e) {
    stats.falhas++;
    console.warn(`[import-calculos] PUT exceção ${item.key}: ${String(e?.message ?? e)}`);
  }
}

function printDetectedHeaders(title, colMap, labels) {
  console.log(`\n=== ${title} — cabeçalhos (linha ${HEADER_LINE_1BASED}) ===`);
  for (const { field, label } of labels) {
    const idx = colMap[field];
    console.log(`  ${label} → coluna ${colLetter(idx)} (índice ${idx})`);
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const filePath = opts.file || DEFAULT_FILE;
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

  let codigoClienteFiltro = null;
  if (opts.codigoCliente) {
    codigoClienteFiltro = normalizarCodigoCliente(opts.codigoCliente);
    if (!codigoClienteFiltro) {
      console.error('[import-calculos] --codigo-cliente inválido (use ex.: 00000491 ou 491)');
      process.exit(1);
    }
    console.log(`[filtro] processando APENAS codigo_cliente=${codigoClienteFiltro}`);
  }

  if (!fs.existsSync(abs)) {
    console.error(`Ficheiro não encontrado: ${abs}`);
    process.exit(1);
  }
  if (!opts.dryRun && !opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=... (ou use --dry-run)');
    process.exit(1);
  }

  const wb = XLSX.readFile(abs, { cellDates: true, raw: true });
  const name1 = pickAba1(wb.SheetNames);
  const name2 = pickAba2(wb.SheetNames);
  if (!name1) {
    console.error('[import-calculos] Nenhuma aba com nome começando por "Relatório" (excl. "Relatorio Debitos").');
    process.exit(1);
  }
  if (!name2) {
    console.error('[import-calculos] Aba "Relatorio Debitos Cadastrados" não encontrada.');
    process.exit(1);
  }

  const m1 = sheetToMatrix(wb, name1);
  const m2 = sheetToMatrix(wb, name2);
  const hIdx = HEADER_LINE_1BASED - 1;
  const header1 = m1[hIdx] || [];
  const header2 = m2[hIdx] || [];

  const col1 = resolveHeaderColumns(header1, ABA1_REQUIRED);
  const col2 = resolveHeaderColumns(header2, ABA2_REQUIRED);

  const { parcelasPorChave: parcelasFull, linhasPorCliente: linhasAba1PorCliente } = parseAba1Rows(m1, col1);
  const { debitosPorChave: debitosFull, linhasPorCliente: linhasAba2PorCliente } = parseAba2Rows(m2, col2);

  const aba1LinhasAntes = somaMap(linhasAba1PorCliente);
  const aba2LinhasAntes = somaMap(linhasAba2PorCliente);

  let parcelasPorChave = parcelasFull;
  let debitosPorChave = debitosFull;
  if (codigoClienteFiltro) {
    const alvo1 = linhasAba1PorCliente.get(codigoClienteFiltro) ?? 0;
    const alvo2 = linhasAba2PorCliente.get(codigoClienteFiltro) ?? 0;
    console.log(
      `[filtro] aba1 parcelas (linhas): ${aba1LinhasAntes} -> ${alvo1} (outros clientes descartados)`
    );
    console.log(
      `[filtro] aba2 débitos (linhas): ${aba2LinhasAntes} -> ${alvo2} (outros clientes descartados)`
    );
    parcelasPorChave = filtrarMapPorCodigoCliente(parcelasFull, codigoClienteFiltro);
    debitosPorChave = filtrarMapPorCodigoCliente(debitosFull, codigoClienteFiltro);
  }

  const { items } = buildRodadas(parcelasPorChave, debitosPorChave);

  let totalParcelas = 0;
  let totalDebitos = 0;
  for (const it of items) {
    totalParcelas += it.payload.parcelas.length;
    totalDebitos += it.payload.debitos.length;
  }

  const countA = items.filter((i) => i.scenario === 'A').length;
  const countB = items.filter((i) => i.scenario === 'B').length;

  if (opts.dryRun) {
    console.log('\n[pré-filtro] aba1 parcelas (linhas SIM→parcela válida) por cliente:');
    console.log(`  ${formatarContagemPorCliente(linhasAba1PorCliente)}  |  total=${aba1LinhasAntes}`);
    console.log('[pré-filtro] aba2 débitos (linhas com chave válida) por cliente:');
    console.log(`  ${formatarContagemPorCliente(linhasAba2PorCliente)}  |  total=${aba2LinhasAntes}`);
    if (codigoClienteFiltro) {
      const a1 = linhasAba1PorCliente.get(codigoClienteFiltro) ?? 0;
      const a2 = linhasAba2PorCliente.get(codigoClienteFiltro) ?? 0;
      console.log('\n[pós-filtro] linhas só do cliente filtrado:');
      console.log(`  aba1 parcelas=${a1}  aba2 débitos=${a2}  |  soma=${a1 + a2}`);
    }
    const codigosRodadas = [...new Set(items.map((i) => i.cod8))].sort((a, b) => Number(a) - Number(b));
    console.log(`\n[import-calculos] códigos nas rodadas (efetivo): ${codigosRodadas.join(', ') || '(nenhum)'}`);

    printDetectedHeaders(`Aba 1 (${name1})`, col1, ABA1_REQUIRED);
    printDetectedHeaders(`Aba 2 (${name2})`, col2, ABA2_REQUIRED);
    console.log(`\n[import-calculos] Rodadas cenário A: ${countA} | cenário B: ${countB} | total chaves: ${items.length}`);

    const firstA = items.find((i) => i.scenario === 'A');
    const firstB = items.find((i) => i.scenario === 'B');
    const last = items.length ? items[items.length - 1] : null;

    console.log('\n--- Amostra: primeira rodada cenário A (JSON) ---');
    console.log(firstA ? JSON.stringify(firstA.payload, null, 2) : '(nenhuma)');
    console.log('\n--- Amostra: primeira rodada cenário B (JSON) ---');
    console.log(firstB ? JSON.stringify(firstB.payload, null, 2) : '(nenhuma)');
    console.log('\n--- Amostra: última rodada do universo (JSON) ---');
    console.log(last ? JSON.stringify(last.payload, null, 2) : '(nenhuma)');

    console.log(`\n[rodadas]   criadas_A=${countA}  criadas_B=${countB}  falhas=0  total=${items.length}`);
    console.log(`[parcelas]  total=${totalParcelas}`);
    console.log(`[debitos]   total=${totalDebitos}`);
    return;
  }

  (async () => {
    const token = await login(opts);
    const stats = { criadas_A: 0, criadas_B: 0, falhas: 0 };
    await runPool(items, opts.concurrency, async (item) => {
      await putRodada(opts.baseUrl, token, item, stats);
    });
    const total = stats.criadas_A + stats.criadas_B + stats.falhas;
    console.log(
      `[rodadas]   criadas_A=${stats.criadas_A}  criadas_B=${stats.criadas_B}  falhas=${stats.falhas}  total=${total}`
    );
    console.log(`[parcelas]  total=${totalParcelas}`);
    console.log(`[debitos]   total=${totalDebitos}`);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

main();
