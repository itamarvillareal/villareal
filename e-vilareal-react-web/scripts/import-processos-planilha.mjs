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
 * PENDENCIA (fase 4): prazos / audiencias via API de prazos ou andamentos — nao implementado neste script.
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

/** Pares (codigoCliente, pessoaId) na aba 1: qualquer linha com D+E validos; valida consistencia do codigo. */
function buildCodPessoaMap(rowsAba1) {
  const m = new Map();
  for (let i = 1; i < rowsAba1.length; i++) {
    const row = rowsAba1[i];
    if (!Array.isArray(row)) continue;
    const cod = normalizarCodigoCliente(row[3]);
    const pid = parsePessoaIdCell(row[4]);
    if (!cod || pid == null) continue;
    const prev = m.get(cod);
    if (prev != null && prev !== pid) {
      throw new Error(`Mapa cod->pessoa_id inconsistente: cod=${cod} tinha ${prev}, linha ${i + 1} tem ${pid}`);
    }
    m.set(cod, pid);
  }
  return m;
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
    if (Array.isArray(row)) ingestOne(row, i + 1, 1, col1.idxCod, col1.idxProc, mapAba1);
  }
  for (let i = 1; i < rowsAba2.length; i++) {
    const row = rowsAba2[i];
    if (Array.isArray(row)) ingestOne(row, i + 1, 2, col2.idxCod, col2.idxProc, mapAba2);
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

function montarObservacao(r1) {
  if (!r1) return null;
  const partes = [
    ['Pasta', parseTexto(r1[14])],
    ['Procedimento', parseTexto(r1[15])],
    ['Responsavel', parseTexto(r1[17])],
    ['ObsFase', parseTexto(r1[8])],
    ['ClienteAtivoPlan', parseTexto(r1[12])],
    ['Audiencia', [parseTexto(r1[5]), parseTexto(r1[6]), parseTexto(r1[7])].filter(Boolean).join(' ')],
  ];
  const s = partes
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' | ');
  return s || null;
}

function buildProcessoWrite(entry, logFase) {
  const { r1, r2, cod, numeroInterno } = entry;
  const pessoaPlan = parsePessoaIdCell(r1?.[4]) ?? parsePessoaIdCell(r2?.[4]);
  if (pessoaPlan == null) {
    return { erro: 'pessoa_id (col E) vazio', entry };
  }
  const descricaoAcao = parseTexto(r1?.[20]) ?? parseTexto(r2?.[20]);
  const competencia = parseTexto(r1?.[10]);
  const unidade = parseTexto(r1?.[16]) ?? competencia;
  const faseRaw = parseTexto(r2?.[14]);
  const fase = normalizarFaseOuNull(faseRaw, logFase);
  const ativo = parseAtivoColunas(r1?.[21], r2?.[5]);
  const body = {
    clienteId: pessoaPlan,
    numeroInterno,
    numeroCnj: parseTexto(r2?.[19]),
    descricaoAcao,
    competencia,
    unidade,
    fase,
    observacaoFase: parseTexto(r1?.[8]),
    observacao: montarObservacao(r1),
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
  if (parseTexto(r2[21]) && out.filter((p) => p.polo === 'REU').length === 0) {
    if (log) console.warn('[parte] Col V texto oposto sem pessoa_id — ignorado (regra planilha).');
  }
  return out;
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

async function ensureCliente(baseUrl, token, cod, pessoaId, stats) {
  const cod8 = normalizarCodigoCliente(cod);
  const url = `${baseUrl}/api/clientes/resolucao?codigoCliente=${encodeURIComponent(cod8)}`;
  const getRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (getRes.ok) {
    const j = await getRes.json();
    const idApi = j.id ?? j.pessoaId;
    if (Number(idApi) !== Number(pessoaId)) {
      throw new Error(`Cliente ${cod8}: API pessoa ${idApi}, planilha ${pessoaId}`);
    }
    stats.jaExistiam++;
    return;
  }
  const postRes = await fetch(`${baseUrl}/api/clientes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ codigoCliente: cod8, pessoaId }),
  });
  const txt = await postRes.text();
  if (postRes.status === 201 || postRes.status === 200) {
    stats.criados++;
    return;
  }
  if (postRes.status === 422 || postRes.status === 409) {
    console.warn(`[cliente] POST ${cod8}: ${postRes.status} — ${txt.slice(0, 200)}`);
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
  const pr = await fetch(`${baseUrl}/api/processos`, {
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
    const prt = await fetch(`${baseUrl}/api/processos/${procId}/partes`, {
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

  const codMap = buildCodPessoaMap(rows1);
  for (let i = 1; i < rows2.length; i++) {
    const row = rows2[i];
    if (!Array.isArray(row)) continue;
    const cod = normalizarCodigoCliente(row[3]);
    const pid = parsePessoaIdCell(row[4]);
    if (!cod || pid == null) continue;
    const prev = codMap.get(cod);
    if (prev != null && prev !== pid) {
      throw new Error(`Mapa cod->pessoa_id inconsistente (aba2 linha ${i + 1}): cod=${cod}`);
    }
    codMap.set(cod, pid);
  }
  console.log(`[mapa] codigos unicos (aba1 D+E + aba2 D+E): ${codMap.size}`);
  const { map: mergedMap, discarded } = collectMerged(rows1, rows2);
  const entries = [...mergedMap.values()];

  const filtrados = entries.filter((e) => linhaTemDadosUteis(e.r1, e.r2));
  console.log(
    `[filtro] linhas descartadas (sem dados uteis): aba1=${discarded.aba1} aba2=${discarded.aba2} | processaveis=${filtrados.length}`
  );

  const samples = [];
  for (const e of filtrados.slice(0, 3)) {
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
    console.log('\n--- Amostra (ate 3 payloads: cliente + processo + partes) ---');
    console.log(JSON.stringify(samples, null, 2));
    console.log('\n--- Resumo dry-run ---');
    console.log(`Clientes unicos (mapa abas 1+2): ${codMap.size}`);
    console.log(`Processos processaveis: ${filtrados.length}`);
    console.log(`Partes estimadas: ${totalPartes}`);
    console.log('Nenhum POST executado.');
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
  process.exit(stats.procFail + stats.falhas > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
