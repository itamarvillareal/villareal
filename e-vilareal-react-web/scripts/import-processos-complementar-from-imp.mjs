#!/usr/bin/env node
/**
 * Importação completa a partir de «Processos_imp_Complementar.xls» (duas abas legadas).
 *
 * 1) POST /api/import/informacoes-processos — grava processo (fase, CNJ, descrição) e
 *    **recria partes** (autores/réus, incl. 6.º réu col. 18). Texto extra (ativo planilha,
 *    «Parte Oposta» nome) vai na coluna O quando não couber noutro campo.
 * 2) POST /api/import/complementares-processos — mescla **todos** os campos mapeáveis das
 *    duas abas no cabeçalho (A–L), por chave (código cliente + n.º interno), sem apagar partes.
 *
 * Abas (ordem fixa no .xls):
 *   [0] «Relatório - Andamento Proce (2)» — cabeçalhos: Cliente, …, Proc., Pasta, …
 *   [1] «Relatório - Andamento Processos» — N Pessoa Cliente, autores, réus (11,12,15–18), …
 *
 * Aba 1 — índices 0-based (extensão do map Python + 6.º réu):
 *   4 cliente, 5 ativo proc., 6–10 autores, 11,12,15,16,17,18 réus, 13 proc., 14 fase,
 *   19 CNJ, 20 descrição, 21 «Parte Oposta» (texto livre).
 *
 * Aba 0 — colunas usadas quando resolvível (ver abaixo):
 *   4 Cliente (número = id pessoa cliente; texto = só em complemento C + heurística),
 *   8 obs. fase, 9 prazo fatal, 10 competência, 11 data protocolo, 13 proc., 14 pasta,
 *   15 procedimento, 16 unidade, 17 responsável, 18 valor causa, 19 2.ª data protocolo,
 *   20 descrição, 21 ativo proc.
 *
 * Resolução do código cliente na aba 0 quando col. 4 é **texto**: se, na aba 1, existir
 * **um único** código distinto para aquele n.º interno (proc.), usa-se esse código;
 * caso contrário a linha da aba 0 não gera linha de «informações» (só pode ir para
 * complementares se houver código resolvido).
 *
 * `--ate-linha-excel=N` (opcional): aplica-se **às duas** abas (linhas Excel ≤ N).
 *
 * Uso:
 *   node scripts/import-processos-complementar-from-imp.mjs
 *   node scripts/import-processos-complementar-from-imp.mjs --executar
 *   node scripts/import-processos-complementar-from-imp.mjs --gravar-exemplo=/tmp/preview
 *
 * Envs: VILAREAL_IMPORT_SENHA, VILAREAL_API_BASE, VILAREAL_IMPORT_LOGIN
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';

import { normalizarTextoPlanilha } from './lib/normalizar-texto-planilha.mjs';

/** Aba «Relatório - Andamento Processos» */
const S1 = {
  CLIENTE: 4,
  ATIVO: 5,
  AUTOR: [6, 7, 8, 9, 10],
  REU: [11, 12, 15, 16, 17, 18],
  PROC: 13,
  FASE: 14,
  CNJ: 19,
  DESC: 20,
  PARTE_TEXTO: 21,
};

/** Aba «Relatório - Andamento Proce (2)» */
const S0 = {
  CLIENTE: 4,
  DATA_AUD: 5,
  HORA_AUD: 6,
  TIPO_AUD: 7,
  OBS_FASE: 8,
  PRAZO_FATAL: 9,
  COMPET: 10,
  DATA_PROT: 11,
  ATIVO_CLI: 12,
  PROC: 13,
  PASTA: 14,
  PROCED: 15,
  UNID: 16,
  RESP: 17,
  VALOR: 18,
  DATA_PROT2: 19,
  DESC: 20,
  ATIVO_PROC: 21,
};

const REMAPEAR_PESSOA_PARTE = new Map([
  [9895, 1510], // alinhado ao script Python do backend
]);

const DEFAULT_FILE = path.join(
  process.env.HOME || '',
  'Dropbox',
  'sistema',
  'Processos_imp_Complementar.xls'
);

const FASES_CANONICAS = [
  'Ag. Documentos',
  'Ag. Peticionar',
  'Ag. Verificação',
  'Protocolo / Movimentação',
  'Aguardando Providência',
  'Procedimento Adm.',
  'Em Andamento',
];

function normalizarChaveFase(s) {
  if (s == null) return '';
  return String(s)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/\s+/g, ' ');
}

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

function faseParaColunaM(bruto) {
  const t = parseTexto(bruto);
  if (!t) return '';
  const ch = normalizarChaveFase(t);
  if (ch === 'inativo') return '';
  return FASE_ALIAS_PARA_CANONICA.get(ch) || '';
}

function parseArgs(argv) {
  const out = {
    file: null,
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    executar: false,
    gravarExemplo: null,
    ateLinhaExcel: null,
  };
  for (const a of argv) {
    if (a === '--executar') out.executar = true;
    else if (a.startsWith('--ate-linha-excel=')) {
      const n = Number(a.slice(18));
      if (Number.isFinite(n) && n >= 1) out.ateLinhaExcel = Math.floor(n);
    } else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--gravar-exemplo=')) out.gravarExemplo = a.slice(17);
    else if (!a.startsWith('-') && !out.file) out.file = a;
  }
  return out;
}

function normIdTexto(v) {
  const t = String(v ?? '')
    .trim()
    .replace(/\u00a0/g, ' ');
  if (!t) return '';
  if (/^-?\d+([.,]\d+)?$/.test(t)) {
    const x = parseFloat(t.replace(',', '.'));
    if (Number.isFinite(x) && x === Math.trunc(x)) return String(Math.trunc(x));
  }
  return t;
}

function codigoOito(v) {
  const s = normIdTexto(v);
  if (!s) return '';
  if (/^\d+$/.test(s)) return String(parseInt(s, 10)).padStart(8, '0');
  return s;
}

function parseTexto(v) {
  if (v == null) return '';
  const s = normalizarTextoPlanilha(v);
  return s === '' ? '' : s;
}

function parseProc(v) {
  const s = normIdTexto(v);
  if (!s || !/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n >= 1 ? n : null;
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

/** Data ISO yyyy-mm-dd ou null (aba complementares / G / L). */
function parseDataCelula(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) {
    const whole = Math.floor(val);
    if (whole > 20000 && whole < 200000) return excelSerialParaISO(val);
    if (whole >= 1 && whole < 50000) return excelSerialParaISO(val);
  }
  const s = String(val).trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${pad2(br[2])}-${pad2(br[1])}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function parseValorCausa(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v)
    .replace(/R\$|\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function remapParteId(s) {
  const t = normIdTexto(s);
  if (!t || !/^\d+$/.test(t)) return t;
  let n = parseInt(t, 10);
  let changed = true;
  while (changed) {
    changed = false;
    const to = REMAPEAR_PESSOA_PARTE.get(n);
    if (to != null && to !== n) {
      n = to;
      changed = true;
    }
  }
  return String(n);
}

function linhaDentroLimite(linhaExcel, lim) {
  return lim == null || linhaExcel <= lim;
}

/**
 * Mapa proc → Set de códigos cliente (8 dígitos) vistos na aba 1.
 */
function buildProcParaCodigosCliente(rows1, ateLinhaExcel) {
  const m = new Map();
  for (let r = 1; r < rows1.length; r++) {
    const linhaExcel = r + 1;
    if (!linhaDentroLimite(linhaExcel, ateLinhaExcel)) break;
    const row = rows1[r];
    if (!Array.isArray(row)) continue;
    const proc = parseProc(row[S1.PROC]);
    const cod = codigoOito(row[S1.CLIENTE]);
    if (proc == null || !cod) continue;
    if (!m.has(proc)) m.set(proc, new Set());
    m.get(proc).add(cod);
  }
  return m;
}

/** Resolve código 8 dígitos para linha aba 0. */
function codigoClienteAba0(row0, procParaCodigos) {
  const raw = row0[S0.CLIENTE];
  const s = normIdTexto(raw);
  if (s && /^\d+$/.test(s)) {
    const c = codigoOito(raw);
    return c || null;
  }
  const proc = parseProc(row0[S0.PROC]);
  if (proc == null) return null;
  const set = procParaCodigos.get(proc);
  if (set && set.size === 1) return [...set][0];
  return null;
}

function montarDescricaoColunaO(row1) {
  const desc = parseTexto(row1[S1.DESC]);
  const cnj = parseTexto(row1[S1.CNJ]);
  const parteTxt = parseTexto(row1[S1.PARTE_TEXTO]);
  const ativo = parseTexto(row1[S1.ATIVO]);
  /** API «informações» só tem 5 colunas G–K para réus; o 6.º vai no texto O. */
  const reu6 = remapParteId(normIdTexto(row1[S1.REU[5]]));
  const bits = [];
  if (cnj && desc) bits.push(`CNJ: ${cnj}\n\n${desc}`);
  else if (cnj) bits.push(`CNJ: ${cnj}`);
  else if (desc) bits.push(desc);
  if (parteTxt) bits.push(`Parte Oposta (texto planilha): ${parteTxt}`);
  if (ativo) bits.push(`Processo Ativo/Inativo (planilha): ${ativo}`);
  if (reu6) bits.push(`Réu 6 (N Pessoa, col. legada): ${reu6}`);
  return bits.join('\n\n') || '';
}

function buildInformacoesMatrix(rows1, ateLinhaExcel) {
  const headers = [
    'Cliente (A)',
    'Autor1',
    'Autor2',
    'Autor3',
    'Autor4',
    'Autor5',
    'Reu1',
    'Reu2',
    'Reu3',
    'Reu4',
    'Reu5',
    'Proc (L)',
    'Fase (M)',
    'CNJ (N)',
    'Descricao (O)',
  ];
  const out = [headers];
  let skipped = 0;
  const amostraSkip = [];

  for (let r = 1; r < rows1.length; r++) {
    const linhaExcel = r + 1;
    if (!linhaDentroLimite(linhaExcel, ateLinhaExcel)) break;
    const row = rows1[r];
    if (!Array.isArray(row)) continue;
    const cli = normIdTexto(row[S1.CLIENTE]);
    const proc = parseProc(row[S1.PROC]);
    if (!cli || proc == null) {
      skipped++;
      if (amostraSkip.length < 8) amostraSkip.push({ aba: 1, linhaExcel, motivo: !cli ? 'sem_cliente' : 'sem_proc' });
      continue;
    }
    const codA = codigoOito(row[S1.CLIENTE]);
    if (!codA) {
      skipped++;
      continue;
    }
    const autores = S1.AUTOR.map((i) => remapParteId(normIdTexto(row[i])));
    /** G–K = exactamente 5 réus (índices 11–15 da planilha = 5 colunas). O 6.º está em O via montarDescricaoColunaO. */
    const reus = S1.REU.slice(0, 5).map((i) => remapParteId(normIdTexto(row[i])));
    const faseM = faseParaColunaM(row[S1.FASE]);
    const cnjS = parseTexto(row[S1.CNJ]);
    const oBody = montarDescricaoColunaO(row);

    const line = [codA, ...autores, ...reus, proc, faseM || '', cnjS, oBody];
    out.push(line);
  }
  return { matrix: out, skipped, amostraSkip };
}

/** Linha complementar só a partir da aba 1 (C,K + extras). */
function linhaComplementarBaseAba1(row1) {
  const codA = codigoOito(row1[S1.CLIENTE]);
  const proc = parseProc(row1[S1.PROC]);
  if (!codA || proc == null) return null;

  const desc = parseTexto(row1[S1.DESC]);
  const cnj = parseTexto(row1[S1.CNJ]);
  let colC = '';
  if (cnj && desc) colC = `CNJ: ${cnj}\n\n${desc}`;
  else if (cnj) colC = `CNJ: ${cnj}`;
  else colC = desc;

  const parteTxt = parseTexto(row1[S1.PARTE_TEXTO]);
  if (parteTxt) colC = colC ? `${colC}\n\nParte Oposta (texto): ${parteTxt}` : `Parte Oposta (texto): ${parteTxt}`;

  const ativo = parseTexto(row1[S1.ATIVO]);
  if (ativo) colC = colC ? `${colC}\n\nAtivo/Inativo (col.5): ${ativo}` : `Ativo/Inativo (col.5): ${ativo}`;

  const colK = parseTexto(row1[S1.FASE]);
  return {
    key: `${codA}|${proc}`,
    line: [
      codA,
      proc,
      colC || null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      colK || null,
      null,
    ],
  };
}

/** Campos estruturados aba 0 → fragmentos para C e colunas D–L. */
function complementDeAba0(row0, codA) {
  const proc = parseProc(row0[S0.PROC]);
  if (!codA || proc == null) return null;

  const blobs = [];
  const nomeCli = parseTexto(row0[S0.CLIENTE]);
  if (nomeCli && !/^\d+$/.test(normIdTexto(row0[S0.CLIENTE])))
    blobs.push(`Cliente (nome, aba Proce (2)): ${nomeCli}`);

  const pairs = [
    ['Data Audiência', row0[S0.DATA_AUD]],
    ['Hora Audiência', row0[S0.HORA_AUD]],
    ['Tipo Audiência', row0[S0.TIPO_AUD]],
    ['Cliente Ativo/Inativo (col.12)', row0[S0.ATIVO_CLI]],
    ['Pasta', row0[S0.PASTA]],
    ['Descrição (aba 2)', row0[S0.DESC]],
    ['Processo Ativo/Inativo (col.21)', row0[S0.ATIVO_PROC]],
  ];
  for (const [k, v] of pairs) {
    const t = v != null && String(v).trim() !== '' ? String(v).trim() : '';
    if (t) blobs.push(`${k}: ${t}`);
  }

  const F = parseTexto(row0[S0.COMPET]) || null;
  const G = parseDataCelula(row0[S0.DATA_PROT]) || parseDataCelula(row0[S0.DATA_PROT2]);
  const H = parseTexto(row0[S0.PROCED]) || null;
  const D = null;
  const E = null;
  const I = parseTexto(row0[S0.RESP]) || null;
  const Jraw = parseValorCausa(row0[S0.VALOR]);
  const J = Jraw != null ? Jraw : null;
  const K = parseTexto(row0[S0.OBS_FASE]) || null;
  const L = parseDataCelula(row0[S0.PRAZO_FATAL]);
  const unid = parseTexto(row0[S0.UNID]);
  let Cblob = blobs.length ? `[Aba Proce (2)]\n${blobs.join('\n')}` : '';
  if (unid) Cblob = Cblob ? `${Cblob}\n\nUnidade: ${unid}` : `Unidade: ${unid}`;

  return { F, G, H, I, J, K, L, Cblob: Cblob || null };
}

function mergePreferStr(a, b) {
  const pa = a != null ? String(a).trim() : '';
  const pb = b != null ? String(b).trim() : '';
  if (pa && pb && pa !== pb) return `${pa}\n\n---\n\n${pb}`;
  return pa || pb || null;
}

function mergePreferNum(a, b) {
  if (a != null && Number.isFinite(Number(a))) return a;
  if (b != null && Number.isFinite(Number(b))) return b;
  return a ?? b ?? null;
}

function mergePreferDateIso(a, b) {
  return a || b || null;
}

/**
 * Mapa chave A|B → linha A–L complementares (fundido abas 1 e 0).
 */
function buildComplementaresMerged(rows1, rows0, procParaCodigos, ateLinhaExcel) {
  const headers = [
    'Codigo cliente (A)',
    'Proc. (B)',
    'Obs. processo (C)',
    'Cidade (D)',
    'UF (E)',
    'Competencia (F)',
    'Data protocolo (G)',
    'Procedimento (H)',
    'Responsavel (I)',
    'Valor causa (J)',
    'Obs. fase (K)',
    'Prazo fatal (L)',
  ];
  const map = new Map();

  for (let r = 1; r < rows1.length; r++) {
    const linhaExcel = r + 1;
    if (!linhaDentroLimite(linhaExcel, ateLinhaExcel)) break;
    const row = rows1[r];
    if (!Array.isArray(row)) continue;
    const base = linhaComplementarBaseAba1(row);
    if (!base) continue;
    map.set(base.key, [...base.line]);
  }

  let s0SemCodigo = 0;
  let s0Aplicadas = 0;

  for (let r = 1; r < rows0.length; r++) {
    const linhaExcel = r + 1;
    if (!linhaDentroLimite(linhaExcel, ateLinhaExcel)) break;
    const row0 = rows0[r];
    if (!Array.isArray(row0)) continue;
    const codA = codigoClienteAba0(row0, procParaCodigos);
    const proc = parseProc(row0[S0.PROC]);
    if (proc == null) continue;
    if (!codA) {
      s0SemCodigo++;
      continue;
    }
    const ext = complementDeAba0(row0, codA);
    if (!ext) continue;
    const key = `${codA}|${proc}`;
    let line = map.get(key);
    if (!line) {
      line = [codA, proc, null, null, null, null, null, null, null, null, null, null];
      map.set(key, line);
    }
    if (ext.Cblob) line[2] = mergePreferStr(line[2], ext.Cblob);
    line[5] = mergePreferStr(line[5], ext.F);
    line[6] = mergePreferDateIso(line[6], ext.G);
    line[7] = mergePreferStr(line[7], ext.H);
    line[8] = mergePreferStr(line[8], ext.I);
    if (ext.J != null) line[9] = mergePreferNum(line[9], ext.J);
    line[10] = mergePreferStr(line[10], ext.K);
    line[11] = mergePreferDateIso(line[11], ext.L);
    s0Aplicadas++;
  }

  const out = [headers, ...map.values()];
  return { matrix: out, s0SemCodigo, s0Aplicadas, nKeys: map.size };
}

function matrixInformacoesToBuffer(matrix) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(matrix);
  XLSX.utils.book_append_sheet(wb, ws, 'InformacoesProcessos');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function matrixComplementaresToBuffer(matrix) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(matrix);
  XLSX.utils.book_append_sheet(wb, ws, 'Complementares');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function login(opts) {
  const loginUrl = `${opts.baseUrl}/api/auth/login`;
  const body = JSON.stringify({ login: String(opts.login).trim().toLowerCase(), senha: opts.senha });
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
  if (!loginJson.accessToken) throw new Error('Resposta login sem accessToken');
  return loginJson.accessToken;
}

async function postImport(baseUrl, token, buf, endpoint, filename) {
  const form = new FormData();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  form.append('file', blob, filename);
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal: AbortSignal.timeout(900_000),
  });
  const txt = await res.text();
  if (!res.ok) {
    throw new Error(`${endpoint} → ${res.status}: ${txt.slice(0, 1200)}`);
  }
  try {
    return JSON.parse(txt);
  } catch {
    return { raw: txt };
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const abs = path.resolve(opts.file || DEFAULT_FILE);

  console.log('=== import-processos-complementar-from-imp (completo: 2 abas + informações + complementares) ===\n');
  console.log(
    '[aviso] A fase «informações processos» **recria** autores/réus na base a partir da aba 1 (comportamento da API).'
  );
  console.log(
    '[aviso] Linhas da aba 0 sem código de cliente resolvível (número na col. 4 ou proc. ambíguo na aba 1) não atualizam «informações»; tentam-se mesclar em complementares só com código resolvido.\n'
  );

  if (!fs.existsSync(abs)) {
    console.error(`[erro] Ficheiro não encontrado: ${abs}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(abs);
  if (wb.SheetNames.length < 2) {
    console.error('[erro] Esperadas 2 abas no .xls; encontradas:', wb.SheetNames.length);
    process.exit(1);
  }

  const idx0 = 0;
  const idx1 = 1;
  const rows0 = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[idx0]], { header: 1, defval: null, raw: true });
  const rows1 = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[idx1]], { header: 1, defval: null, raw: true });

  console.log(`[ficheiro] ${abs}`);
  console.log(`[aba0] "${wb.SheetNames[idx0]}" linhas ${rows0.length}`);
  console.log(`[aba1] "${wb.SheetNames[idx1]}" linhas ${rows1.length}`);
  if (opts.ateLinhaExcel != null) {
    console.log(`[filtro] linhas Excel ≤ ${opts.ateLinhaExcel} em **ambas** as abas`);
  }

  const procParaCodigos = buildProcParaCodigosCliente(rows1, opts.ateLinhaExcel);
  const inf = buildInformacoesMatrix(rows1, opts.ateLinhaExcel);
  const comp = buildComplementaresMerged(rows1, rows0, procParaCodigos, opts.ateLinhaExcel);

  console.log(`[informacoes] linhas geradas (dados): ${inf.matrix.length - 1} | ignoradas aba1: ${inf.skipped}`);
  if (inf.amostraSkip.length) console.log('[informacoes skips amostra]', JSON.stringify(inf.amostraSkip, null, 2));

  console.log(
    `[complementares] chaves únicas (processos): ${comp.nKeys} | linhas aba0 mescladas: ${comp.s0Aplicadas} | aba0 sem código resolvido: ${comp.s0SemCodigo}`
  );

  const bufInf = matrixInformacoesToBuffer(inf.matrix);
  const bufComp = matrixComplementaresToBuffer(comp.matrix);

  if (opts.gravarExemplo) {
    const base = path.resolve(opts.gravarExemplo);
    const dir = path.dirname(base);
    const ext = path.extname(base) || '.xlsx';
    const stem = ext ? base.slice(0, -ext.length) : base;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(`${stem}-informacoes${ext}`, bufInf);
    fs.writeFileSync(`${stem}-complementares${ext}`, bufComp);
    console.log(`\n[gravar-exemplo] ${stem}-informacoes${ext} e ${stem}-complementares${ext}`);
  }

  if (!opts.executar) {
    console.log('\n[modo] Verificação apenas. Para importar: --executar (+ VILAREAL_IMPORT_SENHA)');
    process.exit(0);
  }

  if (!opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=...');
    process.exit(1);
  }

  console.log('\n[executar] 1/2 POST /api/import/informacoes-processos …');
  const token = await login(opts);
  const respInf = await postImport(opts.baseUrl, token, bufInf, '/api/import/informacoes-processos', 'imp-informacoes.xlsx');
  const errInf = respInf.linhasComErro ?? respInf.linhas_com_erro ?? 0;
  const okInf = respInf.linhasProcessadasComSucesso ?? respInf.linhas_processadas_com_sucesso ?? 0;
  console.log(`[informacoes] ok=${okInf} erros=${errInf}`);
  if (errInf > 0) {
    console.error('[erro] Importação informações com falhas; a **não** executar complementares por segurança.');
    console.error(JSON.stringify(respInf, null, 2).slice(0, 6000));
    process.exit(2);
  }

  console.log('\n[executar] 2/2 POST /api/import/complementares-processos …');
  const respComp = await postImport(opts.baseUrl, token, bufComp, '/api/import/complementares-processos', 'imp-complementares.xlsx');
  const errC = respComp.linhasComErro ?? respComp.linhas_com_erro ?? 0;
  const okC = respComp.linhasProcessadasComSucesso ?? respComp.linhas_processadas_com_sucesso ?? 0;
  console.log(`[complementares] ok=${okC} erros=${errC}`);
  console.log('\n[api complementares resumo]', JSON.stringify(respComp, null, 2).slice(0, 3500));

  process.exit(errC > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
