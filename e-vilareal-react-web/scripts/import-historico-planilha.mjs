#!/usr/bin/env node
/**
 * Importa histórico de andamentos multicliente a partir de historico_import.xls (aba Planilha2).
 * Coluna A = código cliente (normalizado 8 dígitos); GET /api/processos?codigoCliente= por cliente (cache).
 *
 * Caminho default: C:\Users\jrvill\Dropbox\sistema\historico_import.xls
 *
 * Uso:
 *   VILAREAL_IMPORT_SENHA='***' node scripts/import-historico-planilha.mjs [--login=itamar]
 *   node scripts/import-historico-planilha.mjs "C:\\caminho\\historico_import.xls" --dry-run
 *
 * Envs: VILAREAL_API_BASE, VILAREAL_IMPORT_SENHA, VILAREAL_IMPORT_CONCURRENCY (default 3)
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';

const DEFAULT_FILE = String.raw`C:\Users\jrvill\Dropbox\sistema\historico_import.xls`;
const SHEET_NAME = 'Planilha2';

/** Variantes que normalizam para outro nome, null, ou __SKIP__ (linha não importada). */
const MAPA_RESPONSAVEL_NORMALIZACAO = {
  ITAMARR: 'ITAMAR',
  'ANA LUIZA': 'ANA LUISA',
  JESSYCA: 'JESSICA',
  '0)': null,
  FERNANDAXLS: 'FERNANDA',
  'RELATÓRIO - DÉBITOS CONDOMINIAIS - FERNANDA': 'FERNANDA',
  'RHAYHANNY (2)': 'RHAYHANNY',
  SISTEMA: '__SKIP__',
};

/** Nomes reconhecidos (após normalização; null não entra no set). */
const RESPONSAVEIS_RECONHECIDOS = new Set([
  'KARLA',
  'ISABELLA',
  'ITAMAR',
  'JOABE',
  'ANA LUISA',
  'GIOVANNA',
  'JESSICA',
  'LORENA',
  'VINICIUS',
  'RHAYHANNY',
  'SUZANI',
  'THALITA',
  'IGOR',
  'JACQUELINE',
  'LARISSA',
  'SAVIT',
  'BRUNA',
  'SABRINA',
  'ALINE',
  'LUCAS',
  'FERNANDA',
  'MARESSA',
  'JOÃO PAULO',
  'PATRICIA',
  'MARIA EDUARDA',
]);

/**
 * @param {unknown} valorBruto
 * @param {number} linhaExcel
 * @returns {string | null} null = sem responsável; '__SKIP__' = não importar a linha
 */
function normalizarResponsavel(valorBruto, linhaExcel) {
  if (valorBruto == null) return null;
  const trim = String(valorBruto).trim();
  if (!trim) return null;
  const upper = trim.toUpperCase();
  const normalizado = upper in MAPA_RESPONSAVEL_NORMALIZACAO ? MAPA_RESPONSAVEL_NORMALIZACAO[upper] : upper;
  if (normalizado === null) return null;
  if (normalizado === '__SKIP__') return '__SKIP__';
  if (!RESPONSAVEIS_RECONHECIDOS.has(normalizado)) {
    throw new Error(
      `Responsavel "${trim}" (linha Excel ${linhaExcel}) nao esta no mapa reconhecido.\n` +
        `Decida antes de rodar: adicione "${normalizado}" a RESPONSAVEIS_RECONHECIDOS se for pessoa valida, ` +
        `ou mapeie em MAPA_RESPONSAVEL_NORMALIZACAO se for variante de outro nome.`
    );
  }
  return normalizado;
}

/** @type {Map<string, Map<number, number>>} */
const cachesMapaPorCliente = new Map();

/**
 * @param {string} token
 * @param {string} baseUrl
 * @param {string} codigoCliente8
 */
async function obterMapaProcessoId(token, baseUrl, codigoCliente8) {
  if (cachesMapaPorCliente.has(codigoCliente8)) {
    return cachesMapaPorCliente.get(codigoCliente8);
  }
  const url = `${baseUrl}/api/processos?codigoCliente=${encodeURIComponent(codigoCliente8)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GET processos para ${codigoCliente8} falhou ${res.status}: ${t.slice(0, 400)}`);
  }
  const list = await res.json();
  if (!Array.isArray(list)) {
    throw new Error(`GET processos para ${codigoCliente8}: resposta nao e array`);
  }
  /** @type {Map<number, number>} */
  const map = new Map();
  for (const p of list) {
    const id = p?.id;
    const ni = p?.numeroInterno;
    if (id == null || ni == null) continue;
    const idN = Number(id);
    const niN = Number(ni);
    if (!Number.isFinite(idN) || !Number.isFinite(niN)) continue;
    map.set(niN, idN);
  }
  cachesMapaPorCliente.set(codigoCliente8, map);
  console.log(`[mapa] cliente ${codigoCliente8}: ${map.size} processos carregados`);
  return map;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Código cliente 8 dígitos a partir de célula (ex.: 728 → 00000728). */
function normalizarCodigoCliente8(val) {
  if (val == null || val === '') return null;
  const s = String(val).trim().replace(/\D/g, '');
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return String(n).padStart(8, '0');
}

/** Serial Excel (parte inteira) → meia-noite UTC ISO (mesmo padrão agenda/processos). */
function excelSerialParaIsoMeiaNoiteUtc(serial) {
  if (typeof serial !== 'number' || !Number.isFinite(serial)) return null;
  const whole = Math.floor(serial);
  if (whole < 1) return null;
  const utcMs = (whole - 25569) * 86400 * 1000;
  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T00:00:00.000Z`;
}

/**
 * @param {unknown} val
 * @returns {string | null} ISO UTC completo …Z ou null
 */
function parseMovimentoEmIso(val) {
  if (val == null || val === '') return null;
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    const y = val.getFullYear();
    const mo = val.getMonth() + 1;
    const d = val.getDate();
    const hh = val.getHours();
    const mm = val.getMinutes();
    const ss = val.getSeconds();
    return `${y}-${pad2(mo)}-${pad2(d)}T${pad2(hh)}:${pad2(mm)}:${pad2(ss)}.000Z`;
  }
  if (typeof val === 'number' && Number.isFinite(val)) {
    const whole = Math.floor(val);
    if (whole > 20000 && whole < 200000) {
      return excelSerialParaIsoMeiaNoiteUtc(val);
    }
    const frac = val - whole;
    if (frac > 1e-12 && whole >= 1) {
      const base = excelSerialParaIsoMeiaNoiteUtc(whole);
      if (!base) return null;
      const secInDay = Math.round(frac * 86400);
      const hh = Math.floor(secInDay / 3600) % 24;
      const mm = Math.floor((secInDay % 3600) / 60) % 60;
      const ss = secInDay % 60;
      const y = Number(base.slice(0, 4));
      const mo = Number(base.slice(5, 7));
      const da = Number(base.slice(8, 10));
      const u = Date.UTC(y, mo - 1, da, hh, mm, ss);
      const d2 = new Date(u);
      if (Number.isNaN(d2.getTime())) return null;
      return d2.toISOString();
    }
    return excelSerialParaIsoMeiaNoiteUtc(val);
  }
  const s = String(val).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z`;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}T12:00:00.000Z`;
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const dd = pad2(Number(m[1]));
    const mo = pad2(Number(m[2]));
    const yyyy = m[3];
    return `${yyyy}-${mo}-${dd}T12:00:00.000Z`;
  }
  return null;
}

function parseArgs(argv) {
  const out = {
    file: null,
    login: 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: process.env.VILAREAL_API_BASE || 'http://localhost:8080',
    dryRun: false,
    concurrency: Math.min(
      32,
      Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY || 3) || 3)
    ),
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice(14));
      if (Number.isFinite(n) && n >= 1) out.concurrency = Math.min(32, Math.floor(n));
    } else if (a.startsWith('--base-url=')) out.baseUrl = a.replace(/\/$/, '');
    else if (!a.startsWith('-') && !out.file) out.file = a;
  }
  return out;
}

/**
 * @template T
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, idx: number) => Promise<void>} fn
 */
async function runPool(items, concurrency, fn) {
  const conc = Math.min(Math.max(1, Math.floor(concurrency)), items.length || 1);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: conc }, () => worker()));
}

/** Última linha 1-based com algum valor nas colunas A–F (evita !ref inflado em .xls). */
function contarLinhasUsadasAteF(mat) {
  let max = 0;
  for (let i = 0; i < mat.length; i += 1) {
    const row = mat[i];
    if (!Array.isArray(row)) continue;
    for (let j = 0; j < 6; j += 1) {
      const v = row[j];
      if (v != null && String(v).trim() !== '') {
        max = Math.max(max, i + 1);
        break;
      }
    }
  }
  return max;
}

/**
 * Linhas com A/B/D; guarda responsavelBruto (validação fail-fast depois).
 * @param {unknown[][]} mat
 */
function buildLinhas(mat) {
  const linhas = [];
  const totalLinhas = contarLinhasUsadasAteF(mat);
  const lim = totalLinhas > 0 ? totalLinhas : mat.length;
  for (let i = 0; i < lim; i += 1) {
    const row = mat[i];
    if (!Array.isArray(row)) continue;
    const linhaExcel = i + 1;
    const a = row[0];
    const b = row[1];
    const d = row[3];
    const e = row[4];
    const f = row[5];

    const cod8 = normalizarCodigoCliente8(a);
    const bStr = b == null || b === '' ? '' : String(b).trim();
    const dStr = d == null || d === '' ? '' : String(d).trim();

    if (!cod8 || !bStr || !dStr) {
      continue;
    }

    const movimentoEm = parseMovimentoEmIso(e);
    const numeroInterno = Number.parseInt(bStr, 10);
    if (!Number.isFinite(numeroInterno)) {
      continue;
    }

    let titulo = dStr;
    if (!titulo.trim()) titulo = 'Andamento';
    if (titulo.length > 500) titulo = titulo.slice(0, 500);

    linhas.push({
      linhaExcel,
      codigoCliente8: cod8,
      numeroInterno,
      titulo,
      movimentoEm,
      responsavelBruto: f,
      totalLinhasSheet: totalLinhas,
    });
  }
  return linhas;
}

/** Aplica normalização + validação responsável em todas as linhas (fail-fast). */
function aplicarValidacaoResponsaveis(brutas) {
  for (const L of brutas) {
    L.detalheNorm = normalizarResponsavel(L.responsavelBruto, L.linhaExcel);
  }
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
    throw new Error(`Falha no login ${loginRes.status}: ${t.slice(0, 400)}`);
  }
  const loginJson = await loginRes.json();
  const token = loginJson.accessToken;
  if (!token) throw new Error('Resposta de login sem accessToken');
  return token;
}

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {number} processoId
 * @param {{ movimentoEm: string, titulo: string, detalhe: string | null }} payload
 */
async function postAndamento(baseUrl, token, processoId, payload) {
  // POST /api/processos/{processoId}/andamentos
  const body = {
    movimentoEm: payload.movimentoEm,
    titulo: payload.titulo,
    detalhe: payload.detalhe,
    origem: 'IMPORT_PLANILHA',
    origemAutomatica: false,
    usuarioId: null,
  };
  const r = await fetch(`${baseUrl}/api/processos/${processoId}/andamentos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    return { ok: false, status: r.status, text: t };
  }
  return { ok: true };
}

function imprimirResumoResponsavel(contagemResp, contagemNull) {
  const keys = Object.keys(contagemResp).sort((a, b) => contagemResp[b] - contagemResp[a]);
  console.log('[responsavel] (apenas POSTs com sucesso)');
  for (const k of keys) {
    console.log(`  ${k}: ${contagemResp[k]}`);
  }
  console.log(`  null: ${contagemNull}`);
}

function imprimirResumoCliente(porClienteStats) {
  console.log('[cliente]');
  const keys = Object.keys(porClienteStats).sort();
  for (const k of keys) {
    const s = porClienteStats[k];
    console.log(`  ${k}: ok=${s.criados} falhas=${s.falhas} orfaos=${s.orfaos}`);
  }
}

/** Contagem por código cliente (linhas em brutas). */
function contarLinhasPorCliente(brutas) {
  /** @type {Record<string, number>} */
  const c = {};
  for (const L of brutas) {
    c[L.codigoCliente8] = (c[L.codigoCliente8] || 0) + 1;
  }
  return c;
}

/** Ordem de primeira aparição de cada cliente na planilha (entre candidatas). */
function ordemClientesPrimeiraAparicao(candidatas) {
  const ordem = [];
  const visto = new Set();
  for (const L of candidatas) {
    if (!visto.has(L.codigoCliente8)) {
      visto.add(L.codigoCliente8);
      ordem.push(L.codigoCliente8);
    }
  }
  return ordem;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const filePath = opts.file || DEFAULT_FILE;
  const abs = path.resolve(filePath);

  if (!fs.existsSync(abs)) {
    console.error('Ficheiro não encontrado:', abs);
    process.exit(1);
  }

  const wb = XLSX.readFile(abs, { cellDates: true, dense: false });
  const sh = wb.Sheets[SHEET_NAME];
  if (!sh) {
    console.error(`Aba "${SHEET_NAME}" não encontrada. Abas:`, wb.SheetNames.join(', '));
    process.exit(1);
  }

  const mat = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: true });
  const brutas = buildLinhas(mat);
  const totalLinhas = contarLinhasUsadasAteF(mat);

  try {
    aplicarValidacaoResponsaveis(brutas);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }

  const candidatas = [];
  let puladosSemData = 0;
  for (const L of brutas) {
    if (L.movimentoEm == null) {
      puladosSemData += 1;
      console.warn(`[warn] linha ${L.linhaExcel}: data inválida ou vazia (coluna E) — ignorada`);
      continue;
    }
    candidatas.push(L);
  }

  const porClienteLinhas = contarLinhasPorCliente(brutas);
  /** @type {Record<string, number>} */
  const respDry = {};
  let respNullDry = 0;
  for (const L of brutas) {
    const key = L.detalheNorm == null ? null : L.detalheNorm;
    if (key == null) respNullDry += 1;
    else respDry[key] = (respDry[key] || 0) + 1;
  }

  if (opts.dryRun) {
    let puladosSistemaDry = 0;
    let candidatasSemSkip = 0;
    for (const L of candidatas) {
      if (L.detalheNorm === '__SKIP__') puladosSistemaDry += 1;
      else candidatasSemSkip += 1;
    }
    console.log(`[dry-run] ficheiro: ${abs}`);
    console.log(`[dry-run] total_linhas_planilha (shape): ${totalLinhas}`);
    console.log(`[dry-run] linhas com A/B/D preenchidos (bruto): ${brutas.length}`);
    console.log(`[dry-run] pulados_sem_data: ${puladosSemData}`);
    console.log(`[dry-run] pulados_sistema (__SKIP__): ${puladosSistemaDry}`);
    console.log(`[dry-run] andamentos importáveis (simulação): ${candidatasSemSkip}`);
    console.log('[dry-run] validacao responsaveis: OK (fail-fast passou)');
    console.log('\n[dry-run] contagem por cliente (linhas A/B/D):');
    for (const cod of Object.keys(porClienteLinhas).sort()) {
      console.log(`  ${cod}: ${porClienteLinhas[cod]}`);
    }
    console.log('\n[dry-run] contagem por responsavel (normalizado, todas as linhas brutas):');
    const rk = Object.keys(respDry).sort((a, b) => respDry[b] - respDry[a]);
    for (const k of rk) {
      console.log(`  ${k}: ${respDry[k]}`);
    }
    console.log(`  null: ${respNullDry}`);

    const picks = [];
    if (candidatas.length >= 1) picks.push(candidatas[0]);
    if (candidatas.length >= 3) picks.push(candidatas[Math.floor(candidatas.length / 2)]);
    if (candidatas.length >= 2 && picks.length < 3) picks.push(candidatas[candidatas.length - 1]);
    else if (candidatas.length === 2 && picks.length === 1) picks.push(candidatas[1]);

    console.log('\n[dry-run] Amostra (3 andamentos; sem processoId / sem HTTP):');
    for (const L of picks) {
      console.log(
        JSON.stringify(
          {
            linhaExcel: L.linhaExcel,
            codigoCliente8: L.codigoCliente8,
            numeroInterno: L.numeroInterno,
            movimentoEm: L.movimentoEm,
            titulo: L.titulo,
            detalhe: L.detalheNorm,
            origem: 'IMPORT_PLANILHA',
            origemAutomatica: false,
            usuarioId: null,
          },
          null,
          2
        )
      );
    }
    process.exit(0);
  }

  if (!opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=...');
    process.exit(1);
  }

  let token;
  try {
    token = await login(opts);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }

  /** @type {Record<string, { criados: number, falhas: number, orfaos: number }>} */
  const porClienteStats = {};

  function touchCliente(cod8) {
    if (!porClienteStats[cod8]) {
      porClienteStats[cod8] = { criados: 0, falhas: 0, orfaos: 0 };
    }
  }

  const ordemClientes = ordemClientesPrimeiraAparicao(candidatas);
  /** @type {Map<string, typeof candidatas>} */
  const candidatasPorCliente = new Map();
  for (const L of candidatas) {
    const arr = candidatasPorCliente.get(L.codigoCliente8) || [];
    arr.push(L);
    candidatasPorCliente.set(L.codigoCliente8, arr);
  }

  /** @type {{ L: object, procId: number, codigoCliente8: string }[]} */
  const tarefas = [];

  const stats = {
    criados: 0,
    falhas: 0,
    orfaos: 0,
    pulados_sem_data: puladosSemData,
    pulados_sistema: 0,
    /** @type {Record<string, number>} */
    respCriados: {},
    respNull: 0,
  };

  for (const cod8 of ordemClientes) {
    let mapa;
    try {
      mapa = await obterMapaProcessoId(token, opts.baseUrl, cod8);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
    const linhasCliente = candidatasPorCliente.get(cod8) || [];
    for (const L of linhasCliente) {
      touchCliente(cod8);
      if (L.detalheNorm === '__SKIP__') {
        stats.pulados_sistema += 1;
        continue;
      }
      const procId = mapa.get(L.numeroInterno);
      if (procId == null) {
        stats.orfaos += 1;
        porClienteStats[cod8].orfaos += 1;
        console.warn(
          `[orfao] cod=${cod8} numeroInterno=${L.numeroInterno} -> processo nao encontrado no banco`
        );
        continue;
      }
      tarefas.push({ L, procId, codigoCliente8: cod8 });
    }
  }

  await runPool(tarefas, opts.concurrency, async ({ L, procId, codigoCliente8 }) => {
    touchCliente(codigoCliente8);
    const titulo = String(L.titulo || '').trim() || 'Andamento';
    const titulo500 = titulo.length > 500 ? titulo.slice(0, 500) : titulo;
    const r = await postAndamento(opts.baseUrl, token, procId, {
      movimentoEm: /** @type {string} */ (L.movimentoEm),
      titulo: titulo500,
      detalhe: L.detalheNorm,
    });
    if (!r.ok) {
      stats.falhas += 1;
      porClienteStats[codigoCliente8].falhas += 1;
      console.warn(
        `[falha] linha ${L.linhaExcel} cod=${codigoCliente8} procId=${procId} numeroInterno=${L.numeroInterno}: ${r.status} ${(r.text || '').slice(0, 200)}`
      );
      return;
    }
    stats.criados += 1;
    porClienteStats[codigoCliente8].criados += 1;
    if (L.detalheNorm == null) stats.respNull += 1;
    else stats.respCriados[L.detalheNorm] = (stats.respCriados[L.detalheNorm] || 0) + 1;
  });

  console.log(
    `[andamentos] criados=${stats.criados} falhas=${stats.falhas} orfaos=${stats.orfaos} pulados_sem_data=${stats.pulados_sem_data} pulados_sistema=${stats.pulados_sistema} total_linhas=${totalLinhas}`
  );
  imprimirResumoResponsavel(stats.respCriados, stats.respNull);
  imprimirResumoCliente(porClienteStats);

  process.exit(stats.falhas > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
