#!/usr/bin/env node
/**
 * Importa processos + partes (layout Villa Real, 2 abas Excel).
 *
 * Aba 1 (processo): cabecalho linha 1, dados linha 2+. Colunas D-V (indices 3-21).
 * Aba 2 (partes): mesmo padrao. Chave natural: (codigoCliente normalizado, numeroInterno).
 *
 * Uso:
 *   VILAREAL_IMPORT_SENHA='***' node scripts/import-processos-planilha.mjs "<ficheiro.xls>" --login=itamar
 *   node scripts/import-processos-planilha.mjs "<ficheiro.xls>" --login=itamar --dry-run
 *
 * Envs: VILAREAL_IMPORT_SENHA, VILAREAL_API_BASE (ex.: http://localhost:8080), VILAREAL_IMPORT_CONCURRENCY (default 3).
 *
 * Pos-import (Etapa C): POST /api/processos/{id}/andamentos (audiencia F+G+H) e POST .../prazos (J parseavel).
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';

const INDICES_ABA1_UTIL = [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21];
const INDICES_ABA2_UTIL = [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21];

/** Mesmas strings que FasePlanilhaNormalizer.FASES_CANONICAS no backend Java. */
const FASES_CANONICAS = [
  'Ag. Documentos',
  'Ag. Peticionar',
  'Ag. Verificação',
  'Protocolo / Movimentação',
  'Aguardando Providência',
  'Procedimento Adm.',
  'Em Andamento',
];

function buildFaseAliasMap() {
  const m = new Map();
  const add = (k, v) => {
    const nk = normalizarChaveFase(k);
    if (nk) m.set(nk, v);
  };
  for (const c of FASES_CANONICAS) add(c, c);
  add('Aguardando documentos', 'Ag. Documentos');
  add('Ag documentos', 'Ag. Documentos');
  add('Ag. documentos', 'Ag. Documentos');
  add('Aguardando peticionar', 'Ag. Peticionar');
  add('Aguardando peticionamento', 'Ag. Peticionar');
  add('Ag peticionar', 'Ag. Peticionar');
  add('Aguardando verificacao', 'Ag. Verificação');
  add('Ag verificacao', 'Ag. Verificação');
  add('Ag verificação', 'Ag. Verificação');
  add('Protocolo', 'Protocolo / Movimentação');
  add('Protocolo / movimentacao', 'Protocolo / Movimentação');
  add('Movimentacao', 'Protocolo / Movimentação');
  add('Movimentação', 'Protocolo / Movimentação');
  add('Aguardando providencia', 'Aguardando Providência');
  add('Aguardando providência', 'Aguardando Providência');
  add('Procedimento adm', 'Procedimento Adm.');
  add('Procedimento administrativo', 'Procedimento Adm.');
  add('Em andamento', 'Em Andamento');
  return m;
}

const FASE_ALIAS_PARA_CANONICA = buildFaseAliasMap();

function parseArgs(argv) {
  const out = {
    file: null,
    login: 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    dryRun: false,
    concurrency: Math.min(
      32,
      Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY || 3) || 3)
    ),
    sheet1: null,
    sheet2: null,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice(14));
      if (Number.isFinite(n) && n >= 1) out.concurrency = Math.min(32, Math.floor(n));
    } else if (a.startsWith('--sheet1=')) out.sheet1 = a.slice(9);
    else if (a.startsWith('--sheet2=')) out.sheet2 = a.slice(9);
    else if (!a.startsWith('-') && !out.file) out.file = a;
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
  if (typeof val === 'number' && Number.isFinite(val)) {
    const whole = Math.floor(val);
    if (whole > 20000 && whole < 200000) return excelSerialParaISO(val);
  }
  const s = String(val).trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${pad2(br[2])}-${pad2(br[1])}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function parseInt2(v) {
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

function parseTexto(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function normalizarCodigoCliente(v) {
  if (v == null) return null;
  const digits = String(v).replace(/\D/g, '');
  if (!digits) return null;
  return digits.padStart(8, '0');
}

function parseValorCausa(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).replace(/R\$|\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function linhaTemDadosUteis(rowAba1, rowAba2) {
  const algum = (row, indices) =>
    row && indices.some((i) => row[i] != null && String(row[i]).trim() !== '');
  return algum(rowAba1, INDICES_ABA1_UTIL) || algum(rowAba2, INDICES_ABA2_UTIL);
}

function normalizarChaveFase(s) {
  if (s == null) return '';
  return String(s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/\s+/g, ' ');
}

/** Cabecalho de celula para matching (sem acentos, lower). */
function normalizarHeaderCelula(s) {
  if (s == null) return '';
  return String(s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/\s+/g, ' ');
}

/**
 * Coluna do numero interno do processo (nao CNJ, nao «processo ativo» — «processo» contem «proc»).
 */
function matchHeaderNumeroInternoProc(h) {
  if (!h) return false;
  if (h.includes('processo')) return false;
  if (h.includes('cnj') || h.includes('novo')) return false;
  if (h.includes('procediment')) return false;
  if (/\bproc\b|^\s*proc\.|^n[°º]?\s*proc\b/.test(h)) return true;
  if (h.startsWith('proc.') || h === 'proc') return true;
  return false;
}

function findColIndex(headers, pred, fallback) {
  if (!Array.isArray(headers)) return fallback;
  for (let i = 0; i < headers.length; i++) {
    const cell = headers[i];
    const n = normalizarHeaderCelula(cell);
    if (n && pred(n)) return i;
  }
  return fallback;
}

/** Chave natural estavel entre abas (cod 8 digitos + numero interno). */
function chaveProcesso(codClienteRaw, numProcRaw) {
  const cod = normalizarCodigoCliente(codClienteRaw);
  const num = parseInt2(numProcRaw);
  if (!cod || num == null) return null;
  return `${cod}|${num}`;
}

/** Retorna fase canonica (API) ou null + log se desconhecida. */
function normalizarFaseOuNull(raw, log) {
  const t = parseTexto(raw);
  if (!t) return null;
  const ch = normalizarChaveFase(t);
  const hit = FASE_ALIAS_PARA_CANONICA.get(ch);
  if (hit) return hit;
  if (log) console.warn(`[fase] Valor nao canonico, enviando null: "${t}"`);
  return null;
}

function parseAtivoColunas(vAba1V, vAba2F) {
  const tryOne = (v) => {
    const s = String(v ?? '')
      .trim()
      .toUpperCase();
    if (!s) return null;
    if (s.includes('INATIV')) return false;
    if (s.includes('ATIV')) return true;
    return null;
  };
  return tryOne(vAba1V) ?? tryOne(vAba2F);
}

function parsePessoaIdCell(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const n = Math.trunc(v);
    return n > 0 ? n : null;
  }
  const d = String(v).replace(/\D/g, '');
  if (!d) return null;
  const n = Number(d);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Coluna E so representa id numerico da pessoa quando o cabecalho (linha 1, col E)
 * indica "N Pessoa Cliente" (case insensitive, trim, sem acentos).
 * Cabecalho so "Cliente" (texto livre) -> false (Col E ignorada para pessoa_id).
 */
function colEHeaderIsNPessoaCliente(rows) {
  const headers = Array.isArray(rows?.[0]) ? rows[0] : [];
  const h = String(headers[4] ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/\s+/g, ' ');
  if (!h) return false;
  const compact = h.replace(/[^a-z0-9]/g, '');
  return compact.includes('npessoa') && compact.includes('cliente');
}

function pickSheetIndex(names, opts) {
  if (opts != null && /^\d+$/.test(String(opts))) return Number(opts);
  const s = String(opts || '').trim();
  if (s) {
    const i = names.findIndex((n) => String(n).trim() === s);
    if (i >= 0) return i;
  }
  return -1;
}

function resolveSheetPair(wb, args) {
  const names = wb.SheetNames;
  let i1 = pickSheetIndex(names, args.sheet1);
  let i2 = pickSheetIndex(names, args.sheet2);
  if (i1 < 0) {
    i1 = names.findIndex((n) => String(n).includes('Proce (2)'));
  }
  if (i1 < 0) i1 = 0;
  if (i2 < 0) {
    i2 = names.findIndex((n) => {
      const t = String(n);
      return t.includes('Andamento Processos') && !t.includes('(2)');
    });
  }
  if (i2 < 0) i2 = Math.min(1, names.length - 1);
  return { i1, i2, names };
}

function sheetToMatrix(wb, idx) {
  const sh = wb.Sheets[wb.SheetNames[idx]];
  return XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: true });
}

function mergePrefer(dst, src) {
  if (!src) return dst;
  const out = dst ? [...dst] : [];
  const len = Math.max(out.length, src.length);
  for (let i = 0; i < len; i++) {
    const a = out[i];
    const b = src[i];
    const bt = b != null && String(b).trim() !== '';
    const at = a != null && String(a).trim() !== '';
    if (bt) out[i] = b;
    else if (!at) out[i] = a ?? null;
    else out[i] = a;
  }
  return out;
}



/** Data audiencia Col F + hora Col G em ISO-8601 UTC; G vazio => 12:00:00.000Z. */
function buildMovimentoEmAudienciaUtc(r1) {
  const ymd = parseData(r1?.[5]);
  if (!ymd) return null;
  const parts = ymd.split('-').map((x) => parseInt(x, 10));
  const y = parts[0];
  const mo = parts[1];
  const da = parts[2];
  const g = r1?.[6];
  let hh = 12;
  let mm = 0;
  let ss = 0;
  if (g != null && String(g).trim() !== '') {
    if (typeof g === 'number' && Number.isFinite(g) && g >= 0 && g < 1) {
      const secs = Math.round(g * 86400);
      hh = Math.floor(secs / 3600) % 24;
      mm = Math.floor((secs % 3600) / 60);
      ss = secs % 60;
    } else {
      const str = String(g).trim();
      const m = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (m) {
        hh = parseInt(m[1], 10);
        mm = parseInt(m[2], 10);
        ss = m[3] != null ? parseInt(m[3], 10) : 0;
      }
    }
  }
  const t = Date.UTC(y, mo - 1, da, hh, mm, ss, 0);
  return new Date(t).toISOString();
}

function buildAndamentoAudienciaBody(r1) {
  const movimentoEm = buildMovimentoEmAudienciaUtc(r1);
  if (!movimentoEm) return null;
  let titulo = parseTexto(r1?.[7]) ?? 'Audiência';
  if (titulo.length > 500) titulo = titulo.slice(0, 500);
  return {
    movimentoEm,
    titulo,
    detalhe: null,
    origem: 'IMPORT_PLANILHA',
    origemAutomatica: false,
    usuarioId: null,
  };
}

function buildPrazoFatalBody(r1) {
  const dataFim = parseData(r1?.[9]);
  if (!dataFim) return null;
  return {
    dataFim,
    prazoFatal: true,
    status: 'PENDENTE',
    descricao: 'Prazo fatal do processo',
    dataInicio: null,
    observacao: null,
    andamentoId: null,
  };
}

function diagnosticoColJPrawVsNPrazos(rows1, mergedMap, filtrados) {
  const col1 = resolverIndicesProc(rows1, 'Aba1');
  const byKey = new Map();
  for (const e of mergedMap.values()) byKey.set(e.key, e);
  const filtradosKeys = new Set(filtrados.map((e) => e.key));

  const linhas = [];
  for (let i = 1; i < rows1.length; i++) {
    const r = rows1[i];
    if (!Array.isArray(r)) continue;
    const rawJ = r[9];
    if (rawJ == null || String(rawJ).trim() === '') continue;
    const cod = normalizarCodigoCliente(r[col1.idxCod]);
    const ni = parseInt2(r[col1.idxProc]);
    const key = chaveProcesso(r[col1.idxCod], r[col1.idxProc]);
    const temParseRow = parseData(rawJ) != null;
    const entry = key ? byKey.get(key) : null;
    const inFiltrados = entry ? filtradosKeys.has(entry.key) : false;
    const parseMerge = entry ? parseData(entry.r1?.[9]) : null;
    let motivo;
    if (!key) motivo = 'sem_chave_valida(cod_ou_numero_interno_invalidos_aba1)';
    else if (!entry) motivo = 'nao_entrou_no_merge_aba1(ingest_descarta_sem_dados_uteis_so_aba1)';
    else if (!inFiltrados) motivo = 'processo_fora_filtro_linhaTemDadosUteis(r1,r2)';
    else if (!temParseRow) motivo = 'parseData_rejeita_J_bruto(formato_invalido_ou_nao_data)';
    else if (!parseMerge) motivo = 'merge_J_final_vazio_ou_nao_parseavel(outra_linha_mesma_chave_venceu)';
    else motivo = 'parseavel_no_merge_conta_em_n_prazos';

    linhas.push({
      excelLine: i + 1,
      cod: cod ?? String(r[col1.idxCod] ?? ''),
      numeroInterno: ni,
      rawJ: String(rawJ),
      temParseRow,
      inFiltrados,
      parseMergeOk: parseMerge != null,
      motivo,
      chave: key,
    });
  }

  const nPrazos = filtrados.filter((e) => parseData(e.r1?.[9])).length;
  const minLineComJPorChave = new Map();
  for (const L of linhas) {
    if (!L.chave) continue;
    const prev = minLineComJPorChave.get(L.chave);
    if (prev == null || L.excelLine < prev) minLineComJPorChave.set(L.chave, L.excelLine);
  }
  const redundantesMesmaChave = linhas.filter(
    (L) =>
      L.chave &&
      L.motivo === 'parseavel_no_merge_conta_em_n_prazos' &&
      minLineComJPorChave.get(L.chave) !== L.excelLine
  );
  const foraDoNPrazos = linhas.filter((L) => L.motivo !== 'parseavel_no_merge_conta_em_n_prazos');

  return { linhas, nPrazos, redundantesMesmaChave, foraDoNPrazos, minLineComJPorChave };
}

function logDiagnosticoColJ(rep) {
  console.log('\n--- Investigacao Col J (linhas Aba1 com J nao-vazio vs n_prazos) ---');
  console.log('n_linhas_excel_aba1_col_J_nao_vazio: ' + rep.linhas.length);
  console.log('n_prazos_POST_apos_merge_filtrados: ' + rep.nPrazos);
  console.log(
    'Diferenca bruta (linhas - processos com prazo): ' +
      (rep.linhas.length - rep.nPrazos) +
      ' | fora_do_n_prazos=' +
      rep.foraDoNPrazos.length +
      ' | redundantes_mesma_chave=' +
      rep.redundantesMesmaChave.length
  );
  if (rep.foraDoNPrazos.length) {
    console.log('Linhas com J bruto que nao entram no contador n_prazos (exclusao/parse/merge/filtro):');
    for (const L of rep.foraDoNPrazos) {
      console.log(
        '  Excel L' +
          L.excelLine +
          ' cod=' +
          L.cod +
          ' numero_interno=' +
          L.numeroInterno +
          ' J=' +
          JSON.stringify(L.rawJ) +
          ' -> ' +
          L.motivo
      );
    }
  }
  if (rep.redundantesMesmaChave.length) {
    console.log('Linhas redundantes (mesma chave natural que outra linha com J; 1 POST prazo por processo):');
    for (const L of rep.redundantesMesmaChave) {
      console.log(
        '  Excel L' +
          L.excelLine +
          ' cod=' +
          L.cod +
          ' numero_interno=' +
          L.numeroInterno +
          ' J=' +
          JSON.stringify(L.rawJ) +
          ' (primeira L' +
          rep.minLineComJPorChave.get(L.chave) +
          ' com mesma chave)'
      );
    }
  }
}

function pickFirstMidLast(arr) {
  if (arr.length === 0) return [];
  if (arr.length === 1) return [arr[0]];
  if (arr.length === 2) return [arr[0], arr[1]];
  const mid = Math.floor(arr.length / 2);
  return [arr[0], arr[mid], arr[arr.length - 1]];
}

/** Acrescenta pares (codigoCliente, pessoaId) ao mapa a partir de uma aba (Col E valida como id so com cabecalho "N Pessoa Cliente"). */
function mergeCodPessoaMapFromSheet(rows, m, sheetTag) {
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const cod = normalizarCodigoCliente(row[3]);
    const pid = parsePessoaIdCell(row[4]);
    if (!cod || pid == null) continue;
    const prev = m.get(cod);
    if (prev != null && prev !== pid) {
      throw new Error(
        `Mapa cod->pessoa_id inconsistente (${sheetTag} linha ${i + 1}): cod=${cod} tinha ${prev}, linha tem ${pid}`
      );
    }
    m.set(cod, pid);
  }
}

function resolverIndicesProc(rows, nomeAba) {
  const headers = Array.isArray(rows?.[0]) ? rows[0] : [];
  const idxProc = findColIndex(headers, matchHeaderNumeroInternoProc, 13);
  const idxCod = 3;
  if (idxProc !== 13) {
    console.warn(
      `[cols ${nomeAba}] Coluna «Proc.» detectada no indice ${idxProc} (fallback seria 13). Verifique o cabecalho.`
    );
  }
  return { idxCod, idxProc };
}

function collectMerged(rowsAba1, rowsAba2) {
  const discarded = { aba1: 0, aba2: 0 };
  const col1 = resolverIndicesProc(rowsAba1, 'Aba1');
  const col2 = resolverIndicesProc(rowsAba2, 'Aba2');
  const useColE1 = colEHeaderIsNPessoaCliente(rowsAba1);
  const useColE2 = colEHeaderIsNPessoaCliente(rowsAba2);

  /** Evita que texto livre em Col E ("Cliente") sobrescreva o id da outra aba no merge. */
  function rowForIngest(row, which) {
    if (!Array.isArray(row)) return row;
    const use = which === 1 ? useColE1 : useColE2;
    if (use) return row;
    const out = row.slice();
    out[4] = null;
    return out;
  }

  const mapAba1 = new Map();
  const mapAba2 = new Map();

  const ingestOne = (row, line, which, idxCod, idxProc, map) => {
    const k = chaveProcesso(row[idxCod], row[idxProc]);
    if (!k) return null;
    const okUseful =
      which === 1 ? linhaTemDadosUteis(row, null) : linhaTemDadosUteis(null, row);
    if (!okUseful) {
      if (which === 1) discarded.aba1++;
      else discarded.aba2++;
      return null;
    }
    const prev = map.get(k);
    const mergedRow = mergePrefer(prev?.row ?? null, row);
    map.set(k, { row: mergedRow, line });
    return k;
  };

  for (let i = 1; i < rowsAba1.length; i++) {
    const row = rowsAba1[i];
    if (Array.isArray(row)) ingestOne(rowForIngest(row, 1), i + 1, 1, col1.idxCod, col1.idxProc, mapAba1);
  }
  for (let i = 1; i < rowsAba2.length; i++) {
    const row = rowsAba2[i];
    if (Array.isArray(row)) ingestOne(rowForIngest(row, 2), i + 1, 2, col2.idxCod, col2.idxProc, mapAba2);
  }

  const chavesAba1 = new Set(mapAba1.keys());
  const chavesAba2 = new Set(mapAba2.keys());
  let intersecao = 0;
  for (const k of chavesAba1) {
    if (chavesAba2.has(k)) intersecao++;
  }
  const soAba1 = new Set([...chavesAba1].filter((k) => !chavesAba2.has(k)));
  const soAba2 = new Set([...chavesAba2].filter((k) => !chavesAba1.has(k)));

  const debugMerge = process.env.VILAREAL_IMPORT_DEBUG_MERGE === '1';
  if (debugMerge) {
    const sample = (set) => [...set].slice(0, 5).join(', ');
    console.log(`[debug] Aba 1 chaves (amostra 5): ${sample(chavesAba1)}`);
    console.log(`[debug] Aba 2 chaves (amostra 5): ${sample(chavesAba2)}`);
    console.log(`[debug] Interseccao: ${intersecao}`);
    console.log(`[debug] So em Aba 1: ${soAba1.size}`);
    console.log(`[debug] So em Aba 2: ${soAba2.size}`);
    console.log('[debug] Aba1 amostra:');
    for (let i = 1; i <= Math.min(3, rowsAba1.length - 1); i++) {
      const r = rowsAba1[i];
      if (!Array.isArray(r)) continue;
      const c = r[col1.idxCod];
      const p = r[col1.idxProc];
      console.log(
        `  L${i}: cod=${JSON.stringify(c)} (${typeof c}), proc=${JSON.stringify(p)} (${typeof p})`
      );
    }
    console.log('[debug] Aba2 amostra:');
    for (let i = 1; i <= Math.min(3, rowsAba2.length - 1); i++) {
      const r = rowsAba2[i];
      if (!Array.isArray(r)) continue;
      const c = r[col2.idxCod];
      const p = r[col2.idxProc];
      console.log(
        `  L${i}: cod=${JSON.stringify(c)} (${typeof c}), proc=${JSON.stringify(p)} (${typeof p})`
      );
    }
  }

  let comR1R2 = 0;
  const map = new Map();
  const todasChaves = new Set([...mapAba1.keys(), ...mapAba2.keys()]);
  for (const k of todasChaves) {
    const e1 = mapAba1.get(k);
    const e2 = mapAba2.get(k);
    const r1 = e1?.row ?? null;
    const r2 = e2?.row ?? null;
    const parts = k.split('|');
    const cod = parts[0] || null;
    const numeroInterno = parseInt2(parts[1]);
    if (r1 && r2) comR1R2++;
    map.set(k, {
      key: k,
      cod,
      numeroInterno,
      lineAba1: e1?.line ?? null,
      lineAba2: e2?.line ?? null,
      r1,
      r2,
    });
  }

  console.log(
    `[merge] Chaves: ${todasChaves.size} (Aba1=${mapAba1.size}, Aba2=${mapAba2.size}) | intersecao=${intersecao} | so_Aba1=${soAba1.size} | so_Aba2=${soAba2.size} | com_r1_e_r2=${comR1R2}`
  );

  return { map, discarded };
}

function buildProcessoWrite(entry, logFase) {
  const { r1, r2, cod, numeroInterno } = entry;
  const pessoaPlan = parsePessoaIdCell(r1?.[4]) ?? parsePessoaIdCell(r2?.[4]);
  if (pessoaPlan == null) {
    return { erro: 'pessoa_id (col E) vazio', entry };
  }
  const descricaoAcao = parseTexto(r1?.[20]) ?? parseTexto(r2?.[20]);
  const competencia = parseTexto(r1?.[10]);
  const unidade = parseTexto(r1?.[16]);
  const faseRaw = parseTexto(r2?.[14]);
  const fase = normalizarFaseOuNull(faseRaw, logFase);
  const ativo = parseAtivoColunas(r1?.[21], r2?.[5]);
  const body = {
    clienteId: pessoaPlan,
    numeroInterno,
    numeroCnj: parseTexto(r2?.[19]),
    naturezaAcao: descricaoAcao,
    descricaoAcao,
    pasta: parseTexto(r1?.[14]),
    tramitacao: parseTexto(r1?.[15]),
    consultor: parseTexto(r1?.[17]),
    competencia,
    unidade,
    fase,
    observacaoFase: parseTexto(r1?.[8]),
    dataProtocolo: parseData(r1?.[11]),
    prazoFatal: parseData(r1?.[9]),
    valorCausa: parseValorCausa(r1?.[18]),
    ativo: ativo ?? true,
    consultaAutomatica: false,
    importacaoId: 'import-processos-planilha',
  };
  Object.keys(body).forEach((k) => {
    if (body[k] === undefined) delete body[k];
  });
  return { body, pessoaPlan, cod };
}

function collectPartes(r2, log) {
  if (!r2) return [];
  const out = [];
  const autores = [r2[6], r2[7], r2[8], r2[9], r2[10]];
  const reus = [r2[11], r2[12], r2[15], r2[16], r2[17], r2[18]];
  let ordem = 1;
  for (const c of autores) {
    const pid = parsePessoaIdCell(c);
    if (pid != null) {
      out.push({ polo: 'AUTOR', pessoaId: pid, ordem: ordem++ });
    }
  }
  ordem = 1;
  for (const c of reus) {
    const pid = parsePessoaIdCell(c);
    if (pid != null) {
      out.push({ polo: 'REU', pessoaId: pid, ordem: ordem++ });
    }
  }
  return out;
}

async function login(opts) {
  const loginUrl = `${opts.baseUrl}/api/auth/login`;
  const loginNorm = String(opts.login).trim().toLowerCase();
  const body = JSON.stringify({ login: loginNorm, senha: opts.senha });
  const maxTentativas = 12;
  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      const loginRes = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!loginRes.ok) {
        const t = await loginRes.text();
        throw new Error(`Login falhou ${loginRes.status}: ${t.slice(0, 400)}`);
      }
      const loginJson = await loginRes.json();
      const token = loginJson.accessToken;
      if (!token) throw new Error('Resposta login sem accessToken');
      return token;
    } catch (err) {
      const cod = err?.cause?.code ?? err?.code;
      const msg = String(err?.message ?? '');
      const rede =
        cod === 'ECONNRESET' ||
        cod === 'ETIMEDOUT' ||
        cod === 'UND_ERR_CONNECT_TIMEOUT' ||
        cod === 'UND_ERR_BODY_TIMEOUT' ||
        cod === 'UND_ERR_SOCKET' ||
        msg.includes('fetch failed') ||
        msg.includes('terminated');
      if (!rede || tentativa === maxTentativas) throw err;
      const esperaMs = Math.min(45000, 2000 * tentativa ** 2);
      await new Promise((res) => setTimeout(res, esperaMs));
    }
  }
  throw new Error('login: retry excedido');
}

/** Fetch com retries para falhas transitórias de rede (timeout, reset). */
async function fetchComRetryRede(url, options, maxTentativas = 10) {
  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      const cod = err?.cause?.code ?? err?.code;
      const msg = String(err?.message ?? '');
      const rede =
        cod === 'ECONNRESET' ||
        cod === 'ETIMEDOUT' ||
        cod === 'UND_ERR_CONNECT_TIMEOUT' ||
        cod === 'UND_ERR_BODY_TIMEOUT' ||
        cod === 'UND_ERR_SOCKET' ||
        msg.includes('fetch failed') ||
        msg.includes('terminated');
      if (!rede || tentativa === maxTentativas) throw err;
      const esperaMs = Math.min(45000, 1800 * tentativa ** 2);
      await new Promise((res) => setTimeout(res, esperaMs));
    }
  }
  throw new Error('fetchComRetryRede: excedido');
}

async function ensureCliente(baseUrl, token, cod, pessoaId, stats) {
  const cod8 = normalizarCodigoCliente(cod);

  // POST-first: o endpoint POST /api/clientes e idempotente (insere novo ou devolve
  // existente se o par (codigoCliente, pessoaId) coincidir). NAO usamos o GET de
  // resolucao do recurso clientes (fallback numerico: sem mapeamento em
  // planilha_pasta1_cliente nem em cliente, interpreta o codigo como pessoa.id).
  // Esse fallback gera falso positivo de divergencia quando codigoCliente != pessoaId.
  const postRes = await fetch(`${baseUrl}/api/clientes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ codigoCliente: cod8, pessoaId }),
  });
  const txt = await postRes.text();

  if (postRes.status === 201) {
    stats.criados++;
    return;
  }
  if (postRes.status === 200) {
    stats.jaExistiam++;
    return;
  }
  if (postRes.status === 409 || postRes.status === 422) {
    console.warn(`[cliente] POST ${cod8} (pessoaId=${pessoaId}): ${postRes.status} — ${txt.slice(0, 300)}`);
    stats.falhas++;
    return;
  }
  throw new Error(`POST /api/clientes falhou ${postRes.status}: ${txt.slice(0, 400)}`);
}

function isProcessoDuplicado422(status, text) {
  return (
    status === 422 &&
    (text.includes('Ja existe processo') ||
      text.includes('Já existe processo') ||
      text.includes('numero interno'))
  );
}


async function postAndamentoEPrazoAposProcesso(baseUrl, token, entry, procId, stats) {
  const andBody = buildAndamentoAudienciaBody(entry.r1);
  if (andBody) {
    try {
      const res = await fetch(baseUrl + "/api/processos/" + procId + "/andamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(andBody),
      });
      const txt = await res.text();
      if (!res.ok) {
        stats.andamentosFalhas++;
        console.warn("[andamento] POST falhou cod=" + entry.cod + " numeroInterno=" + entry.numeroInterno + ": " + res.status + " " + txt.slice(0, 220));
      } else {
        stats.andamentosCriados++;
      }
    } catch (e) {
      stats.andamentosFalhas++;
      console.warn("[andamento] POST excecao cod=" + entry.cod + " numeroInterno=" + entry.numeroInterno + ": " + String(e && e.message ? e.message : e));
    }
  }
  const prazoBody = buildPrazoFatalBody(entry.r1);
  if (prazoBody) {
    try {
      const res = await fetch(baseUrl + "/api/processos/" + procId + "/prazos", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(prazoBody),
      });
      const txt = await res.text();
      if (!res.ok) {
        stats.prazosFalhas++;
        console.warn("[prazo] POST falhou cod=" + entry.cod + " numeroInterno=" + entry.numeroInterno + ": " + res.status + " " + txt.slice(0, 220));
      } else {
        stats.prazosCriados++;
      }
    } catch (e) {
      stats.prazosFalhas++;
      console.warn("[prazo] POST excecao cod=" + entry.cod + " numeroInterno=" + entry.numeroInterno + ": " + String(e && e.message ? e.message : e));
    }
  }
}

async function postProcessoCompleto(baseUrl, token, entry, stats) {
  const logFase = true;
  const built = buildProcessoWrite(entry, logFase);
  if (built.erro) {
    console.warn(`[linha aba1=${entry.lineAba1} aba2=${entry.lineAba2}] ${built.erro}`);
    stats.procSkip++;
    return;
  }
  const { body } = built;
  const partes = collectPartes(entry.r2, true);
  const pr = await fetchComRetryRede(`${baseUrl}/api/processos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const prTxt = await pr.text();
  if (!pr.ok) {
    if (isProcessoDuplicado422(pr.status, prTxt)) {
      console.warn(`[processo] duplicado chave natural (${entry.key}): ${prTxt.slice(0, 180)}`);
      stats.procDup++;
      return null;
    }
    console.error(`[processo] POST falhou ${entry.key}: ${pr.status} ${prTxt.slice(0, 300)}`);
    stats.procFail++;
    return null;
  }
  let created;
  try {
    created = JSON.parse(prTxt);
  } catch {
    stats.procFail++;
    return null;
  }
  const procId = created.id;
  for (const p of partes) {
    const prt = await fetchComRetryRede(`${baseUrl}/api/processos/${procId}/partes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...p, importacaoId: 'import-processos-planilha' }),
    });
    const ptx = await prt.text();
    if (!prt.ok) {
      console.warn(`[parte] POST falhou processo ${procId}: ${prt.status} ${ptx.slice(0, 200)}`);
      stats.parteFail++;
    } else {
      stats.partesOk++;
    }
  }
  stats.processosOk++;
  await postAndamentoEPrazoAposProcesso(baseUrl, token, entry, procId, stats);
  return { id: procId };
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

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.file) {
    console.error(
      'Uso: node scripts/import-processos-planilha.mjs "<ficheiro.xls>" [--login=itamar] [--dry-run] [--sheet1=0] [--sheet2=1]'
    );
    process.exit(1);
  }
  const abs = path.resolve(opts.file);
  if (!fs.existsSync(abs)) {
    console.error('Ficheiro nao encontrado:', abs);
    process.exit(1);
  }
  if (!opts.senha && !opts.dryRun) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=...');
    process.exit(1);
  }

  const wb = XLSX.readFile(abs);
  const { i1, i2, names } = resolveSheetPair(wb, opts);
  console.log(`Abas: [${i1}] "${names[i1]}" | [${i2}] "${names[i2]}"`);

  const rows1 = sheetToMatrix(wb, i1);
  const rows2 = sheetToMatrix(wb, i2);

  const useE1 = colEHeaderIsNPessoaCliente(rows1);
  const useE2 = colEHeaderIsNPessoaCliente(rows2);
  console.log(
    `[mapa] Col E: aba1 cabecalho="${String(rows1?.[0]?.[4] ?? '').trim()}" usado_como_pessoa_id=${useE1} | aba2 cabecalho="${String(rows2?.[0]?.[4] ?? '').trim()}" usado_como_pessoa_id=${useE2}`
  );
  if (!useE1 && !useE2) {
    throw new Error(
      'Nenhuma aba tem na coluna E o cabecalho "N Pessoa Cliente" (coluna "Cliente" com texto livre nao fornece pessoa_id). Ajuste a planilha ou as abas importadas.'
    );
  }
  const codMap = new Map();
  if (useE1) mergeCodPessoaMapFromSheet(rows1, codMap, 'aba1');
  if (useE2) mergeCodPessoaMapFromSheet(rows2, codMap, 'aba2');
  console.log(`[mapa] codigos unicos (Col E apenas onde cabecalho e "N Pessoa Cliente"): ${codMap.size}`);
  const { map: mergedMap, discarded } = collectMerged(rows1, rows2);
  const entries = [...mergedMap.values()];

  const filtrados = entries.filter((e) => linhaTemDadosUteis(e.r1, e.r2));
  console.log(
    `[filtro] linhas descartadas (sem dados uteis): aba1=${discarded.aba1} aba2=${discarded.aba2} | processaveis=${filtrados.length}`
  );

  const filtradosOk = filtrados.filter((e) => !buildProcessoWrite(e, false).erro);
  const samples = [];
  for (const e of pickFirstMidLast(filtradosOk)) {
    const built = buildProcessoWrite(e, false);
    if (!built.erro) {
      samples.push({
        cliente: { codigoCliente: normalizarCodigoCliente(e.cod), pessoaId: built.pessoaPlan },
        processo: built.body,
        partes: collectPartes(e.r2, false),
      });
    }
  }

  let totalPartes = 0;
  for (const e of filtrados) totalPartes += collectPartes(e.r2, false).length;

  console.log(`Processos apos merge+filtro: ${filtrados.length} | partes estimadas: ${totalPartes}`);

  if (opts.dryRun) {
    const rep = diagnosticoColJPrawVsNPrazos(rows1, mergedMap, filtrados);
    logDiagnosticoColJ(rep);
    const nAndamentos = filtrados.filter((e) => buildAndamentoAudienciaBody(e.r1)).length;
    const nPrazos = rep.nPrazos;
    const andBodies = filtrados
      .map((e) => ({ e, b: buildAndamentoAudienciaBody(e.r1) }))
      .filter((x) => x.b);
    let exemploAndamento = null;
    if (andBodies.length) {
      exemploAndamento =
        andBodies.find((x) => parseTexto(x.e.r1?.[7]))?.b ??
        andBodies.find((x) => x.e.r1?.[6] != null && String(x.e.r1[6]).trim() !== "")?.b ??
        andBodies[0].b;
    }
    const primeiroPrazo = filtrados.find((e) => buildPrazoFatalBody(e.r1));
    console.log("\n--- Amostra (3 processos: primeiro, meio, ultimo — cliente + processo + partes) ---");
    console.log(JSON.stringify(samples, null, 2));
    console.log("\n--- Exemplo payload andamento (dry-run) ---");
    console.log(exemploAndamento ? JSON.stringify(exemploAndamento, null, 2) : "(nenhum elegivel)");
    console.log("\n--- Exemplo payload prazo (dry-run) ---");
    console.log(
      primeiroPrazo ? JSON.stringify(buildPrazoFatalBody(primeiroPrazo.r1), null, 2) : "(nenhum elegivel)"
    );
    console.log("\n--- Contadores finais (alinhados ao import real) ---");
    console.log(`n_andamentos: ${nAndamentos} | n_prazos: ${nPrazos}`);
    console.log("\n--- Resumo dry-run ---");
    console.log(`[clientes] criados=0 ja_existiam=0 falhas=0 (nao executado)`);
    console.log(`[processos] ok=0 dup_ou_422=0 falhas=0 skip=0 (previsto processaveis=${filtrados.length})`);
    console.log(`[partes] ok=0 falhas=0 (estimado=${totalPartes})`);
    console.log(`[prazos] criados=${nPrazos} falhas=0`);
    console.log(`[andamentos] criados=${nAndamentos} falhas=0`);
    console.log(`Clientes unicos (mapa abas 1+2): ${codMap.size}`);
    console.log(`Processos processaveis: ${filtrados.length}`);
    console.log(`Partes estimadas: ${totalPartes}`);
    console.log("Nenhum POST executado.");
    process.exit(0);
  }

  const token = await login(opts);

  const stats = {
    jaExistiam: 0,
    criados: 0,
    falhas: 0,
    processosOk: 0,
    procDup: 0,
    procFail: 0,
    procSkip: 0,
    partesOk: 0,
    parteFail: 0,
    prazosCriados: 0,
    prazosFalhas: 0,
    andamentosCriados: 0,
    andamentosFalhas: 0,
  };

  for (const [cod, pid] of codMap) {
    await ensureCliente(opts.baseUrl, token, cod, pid, stats);
  }
  console.log(
    `[clientes] criados=${stats.criados} ja_existiam=${stats.jaExistiam} falhas=${stats.falhas}`
  );

  const conc = opts.concurrency;
  let idx = 0;
  await runPool(filtrados, conc, async (entry) => {
    const n = ++idx;
    await postProcessoCompleto(opts.baseUrl, token, entry, stats);
    if (filtrados.length > 50 && n % 50 === 0) {
      console.log(`… processos ${n}/${filtrados.length}`);
    }
  });

  console.log(
    `[processos] ok=${stats.processosOk} dup_ou_422=${stats.procDup} falhas=${stats.procFail} skip=${stats.procSkip}`
  );
  console.log(`[partes] ok=${stats.partesOk} falhas=${stats.parteFail}`);
  console.log(`[prazos] criados=${stats.prazosCriados} falhas=${stats.prazosFalhas}`);
  console.log(`[andamentos] criados=${stats.andamentosCriados} falhas=${stats.andamentosFalhas}`);
  process.exit(stats.procFail + stats.falhas > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
