#!/usr/bin/env node
/**
 * Importa histórico de andamentos multicliente (.xls/.xlsx).
 * Colunas: A = código cliente, B = nº interno do processo, D = título, E = data/hora, F = responsável (opcionais → null ou valor por defeito onde a API exija).
 *
 * Comportamento por defeito (importação completa):
 * - Antes de importar: DELETE em massa da `origem` escolhida (API; defeito IMPORT_PLANILHA). Desligar: `--nao-limpar-import`.
 * - Outra planilha sem apagar a anterior: `--origem=IMPORT_PLANILHA_500_599` (A–Z, 0–9, _; máx. 40).
 * - Cria processo (stub) em falta: ligado por defeito. Desligar: `--sem-criar-processos`.
 * - Não salta linhas por data vazia (envia movimentoEm null → API usa instante actual).
 * - Responsável vazio / ruído numérico / mapa→null (ex. SISTEMA) → detalhe null; **não catalogado** → texto da planilha em `detalhe`, `usuarioId` null (sem FK).
 * - Faixa de código cliente (col. A): `--apenas-codigos-entre=500,599` (opcional).
 * - Código cliente em falta na linha: reutiliza o último código lido na coluna A (planilhas agrupadas).
 * - Nº interno inválido: usa 1.
 *
 * Aba: "Planilha2" → nome contém "pasta2" → 1.ª aba. Override: --sheet=NomeExato
 *
 * Uso:
 *   VILAREAL_IMPORT_SENHA='***' node scripts/import-historico-planilha.mjs "/caminho/Pasta2.xls" --login=itamar
 *   node scripts/import-historico-planilha.mjs "ficheiro.xls" --dry-run
 *
 * Opções:
 *   --origem=IMPORT_PLANILHA_X   Origem dos andamentos e alvo do DELETE prévio (defeito: IMPORT_PLANILHA ou VILAREAL_IMPORT_ORIGEM)
 *   --apenas-codigos-entre=500,599  Só linhas cuja col. A está nesta faixa de código cliente
 *   --nao-limpar-import          Não apaga andamentos dessa origem antes de importar
 *   --sem-criar-processos        Não cria cabeçalho de processo em falta
 *   --apenas-orfaos             Só linhas sem processo na API (requer criação de stub; combina com --sem-criar-processos desactivado)
 *   --cliente=119 --substituir-andamentos   Só um cliente: apaga todos os andamentos desses processos antes do POST
 *   --processo=7                            Só linhas com nº interno (col. B) igual a 7 (combine com --cliente=)
 *   --apenas-novos           Só faz POST se não existir andamento com o mesmo movimentoEm + título (dedupe na API).
 *                             Desliga automaticamente a limpeza por origem (--nao-limpar-import).
 *                             Concorrência é reduzida a 1 para evitar duplicados em corrida na mesma chave.
 *
 * Envs: VILAREAL_API_BASE, VILAREAL_IMPORT_SENHA, VILAREAL_IMPORT_CONCURRENCY (default 3), VILAREAL_IMPORT_ORIGEM
 * Opcional: `.env.import.local` ou `~/.vilareal-import-env` com `VILAREAL_IMPORT_SENHA=…`
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';

import { normalizarTextoPlanilha } from './lib/normalizar-texto-planilha.mjs';

const DEFAULT_FILE = String.raw`C:\Users\jrvill\Dropbox\sistema\historico_import.xls`;
const SHEET_FALLBACK_PRIMARIO = 'Planilha2';
const ORIGEM_IMPORT_PLANILHA_PADRAO = 'IMPORT_PLANILHA';
/** Máx. texto em `detalhe` (responsável não catalogado); alinha com uso seguro em TEXT. */
const DETALHE_RESPONSAVEL_MAX = 8000;

/** Variantes que normalizam para outro nome ou null (detalhe omitido na API). */
const MAPA_RESPONSAVEL_NORMALIZACAO = {
  ITAMAR2: 'ITAMAR',
  ITAMARR: 'ITAMAR',
  'ITAMAR (SALVO AUTOMATICAMENTE)': 'ITAMAR',
  'ANA LUIZA': 'ANA LUISA',
  LUISA: 'ANA LUISA',
  JESSYCA: 'JESSICA',
  '0)': null,
  '24880': null,
  FERNANDAXLS: 'FERNANDA',
  'RELATÓRIO - DÉBITOS CONDOMINIAIS - FERNANDA': 'FERNANDA',
  'RELATÓRIO - DÉBITOS CONDOMINIAIS - SAVIT': 'SAVIT',
  'RELATÓRIO - DÉBITOS CONDOMINIAIS - ITAMAR': 'ITAMAR',
  'RHAYHANNY (2)': 'RHAYHANNY',
  'ADMINISTRAÇÃO DE IMÓVEIS - ISABELLA': 'ISABELLA',
  SISTEMA: null,
  /** Ruído/colagem na exportação Excel (linha 2287 em lote amplo). */
  '3 (1))': null,
};

/** Nomes reconhecidos (após normalização); fora disto → texto da planilha em detalhe (usuarioId null). */
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
  'PRISCILA',
  'MARIA EDUARDA',
]);

const warnedUnknownResponsavel = new Set();

/**
 * @param {unknown} valorBruto
 * @param {number} linhaExcel
 * @returns {string | null} null = sem texto em detalhe; caso contrário nome catalogado ou texto livre da planilha
 */
function normalizarResponsavel(valorBruto, linhaExcel) {
  if (valorBruto == null) return null;
  const trim = normalizarTextoPlanilha(valorBruto);
  if (!trim) return null;
  if (/^\d+$/.test(trim)) return null;
  if (/^[\d\s.,-]+$/.test(trim) && /\d/.test(trim) && !/[A-Za-zÀ-ÿ]/.test(trim)) return null;
  const upper = trim.toUpperCase();
  const normalizado = upper in MAPA_RESPONSAVEL_NORMALIZACAO ? MAPA_RESPONSAVEL_NORMALIZACAO[upper] : upper;
  if (normalizado === null) return null;
  if (RESPONSAVEIS_RECONHECIDOS.has(normalizado)) {
    return normalizado;
  }
  const livre = trim.length > DETALHE_RESPONSAVEL_MAX ? trim.slice(0, DETALHE_RESPONSAVEL_MAX) : trim;
  const key = livre.slice(0, 120);
  if (!warnedUnknownResponsavel.has(key)) {
    warnedUnknownResponsavel.add(key);
    console.warn(
      `[responsavel] nome não catalogado "${trim.slice(0, 200)}" → detalhe texto livre, usuarioId=null (ex.: linha ${linhaExcel}); outras linhas iguais não repetem aviso`
    );
  }
  return livre;
}

/** @type {Map<string, Map<number, number>>} */
const cachesMapaPorCliente = new Map();

/**
 * Remove todos os andamentos com a origem indicada (ex.: reimportação completa).
 * @returns {Promise<number>}
 */
async function limparAndamentosPorOrigem(baseUrl, token, origem) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/processos/manutencao/andamentos-por-origem/${encodeURIComponent(origem)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const txt = await res.text();
  if (!res.ok) {
    const hint =
      /NoResourceFoundException|No static resource.*andamentos-por-origem/i.test(txt)
        ? ' Reinicie o backend com o código actual (endpoint DELETE /api/processos/manutencao/andamentos-por-origem/{origem}) ou use --nao-limpar-import.'
        : '';
    throw new Error(`DELETE manutencao/andamentos-por-origem falhou ${res.status}: ${txt.slice(0, 500)}${hint}`);
  }
  const j = JSON.parse(txt);
  return Number(j.removidos) || 0;
}

/**
 * @param {string} token
 * @param {string} baseUrl
 * @param {string} codigoCliente8
 */
const PAGE_SIZE_MAPA_PROCESSOS = 100;

async function obterMapaProcessoId(token, baseUrl, codigoCliente8) {
  if (cachesMapaPorCliente.has(codigoCliente8)) {
    return cachesMapaPorCliente.get(codigoCliente8);
  }
  /** @type {Map<number, number>} */
  const map = new Map();
  const maxTentativas = 8;

  for (let page = 0; ; page++) {
    const params = new URLSearchParams();
    params.set('codigoCliente', codigoCliente8);
    params.set('page', String(page));
    params.set('size', String(PAGE_SIZE_MAPA_PROCESSOS));
    params.append('sort', 'numeroInterno,asc');
    params.append('sort', 'id,asc');
    const url = `${baseUrl}/api/processos?${params.toString()}`;

    /** @type {Response | undefined} */
    let res;
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
      try {
        res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        break;
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
          msg.includes('terminated') ||
          String(err?.cause?.code ?? '') === 'ECONNRESET';
        if (!rede || tentativa === maxTentativas) throw err;
        const esperaMs = Math.min(30000, 1500 * tentativa ** 2);
        await new Promise((r) => setTimeout(r, esperaMs));
      }
    }
    if (!res) throw new Error(`GET processos para ${codigoCliente8}: sem resposta`);
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`GET processos para ${codigoCliente8} falhou ${res.status}: ${t.slice(0, 400)}`);
    }
    const body = await res.json();
    let list;
    let fim = false;
    if (Array.isArray(body)) {
      list = body;
      fim = true;
    } else if (body && Array.isArray(body.content)) {
      list = body.content;
      fim = body.last === true || list.length < PAGE_SIZE_MAPA_PROCESSOS;
    } else {
      throw new Error(
        `GET processos para ${codigoCliente8}: resposta invalida (esperado Page JSON com content ou array legado)`
      );
    }
    for (const p of list) {
      const id = p?.id;
      const ni = p?.numeroInterno;
      if (id == null || ni == null) continue;
      const idN = Number(id);
      const niN = Number(ni);
      if (!Number.isFinite(idN) || !Number.isFinite(niN)) continue;
      map.set(niN, idN);
    }
    if (fim) break;
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
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    dryRun: false,
    concurrency: Math.min(
      32,
      Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY || 3) || 3)
    ),
    codigoClienteRaw: null,
    substituirAndamentos: false,
    sheetName: null,
    /** Por defeito: cria POST /api/processos quando o nº interno não existe. */
    criarProcessosOrfaos: true,
    apenasOrfaos: false,
    /** Por defeito: DELETE em massa andamentos IMPORT_PLANILHA antes de importar. */
    limparImportPlanilhaAntes: true,
    /** Origem gravada em cada andamento (e alvo do DELETE prévio). Env: VILAREAL_IMPORT_ORIGEM */
    origem: (process.env.VILAREAL_IMPORT_ORIGEM || '').trim() || ORIGEM_IMPORT_PLANILHA_PADRAO,
    /** Filtro opcional col. A: --apenas-codigos-entre=500,599 */
    codigoClienteMin: /** @type {number | null} */ (null),
    codigoClienteMax: /** @type {number | null} */ (null),
    /** Só POST andamentos cuja chave (data+título) ainda não existe no processo. */
    apenasNovos: false,
    /** Filtro col. B: --processo=7 */
    numeroInternoFiltro: /** @type {number | null} */ (null),
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--apenas-novos') out.apenasNovos = true;
    else if (a === '--substituir-andamentos') out.substituirAndamentos = true;
    else if (a === '--criar-processos-orfaos') out.criarProcessosOrfaos = true;
    else if (a === '--sem-criar-processos') out.criarProcessosOrfaos = false;
    else if (a === '--apenas-orfaos') out.apenasOrfaos = true;
    else if (a === '--nao-limpar-import') out.limparImportPlanilhaAntes = false;
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--cliente=')) out.codigoClienteRaw = a.slice(10).trim();
    else if (a.startsWith('--processo=')) {
      const n = Number(a.slice('--processo='.length).trim());
      if (Number.isFinite(n) && n >= 1) out.numeroInternoFiltro = Math.floor(n);
    }
    else if (a.startsWith('--origem=')) out.origem = a.slice(9).trim();
    else if (a.startsWith('--apenas-codigos-entre=')) {
      const rest = a.slice(23);
      const parts = rest
        .split(/[,;]/)
        .map((x) => x.trim())
        .filter(Boolean);
      if (parts.length === 2) {
        const mn = Number(parts[0]);
        const mx = Number(parts[1]);
        if (Number.isFinite(mn) && Number.isFinite(mx) && mn >= 0 && mx >= mn) {
          out.codigoClienteMin = mn;
          out.codigoClienteMax = mx;
        }
      }
    } else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice(14));
      if (Number.isFinite(n) && n >= 1) out.concurrency = Math.min(32, Math.floor(n));
    } else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--sheet=')) out.sheetName = a.slice(8).trim();
    else if (!a.startsWith('-') && !out.file) out.file = a;
  }
  return out;
}

/** @param {string} origem */
function validarOrigemApi(origem) {
  if (!origem || !/^[A-Za-z0-9_]{1,40}$/.test(origem)) {
    console.error(
      `Origem inválida: "${String(origem)}". Use 1–40 caracteres [A-Za-z0-9_] (regra da API de limpeza em massa).`
    );
    process.exit(1);
  }
}

/** Código 8 dígitos → inteiro (ex. 00000500 → 500). */
function codigoCliente8ParaInt(cod8) {
  const d = String(cod8).replace(/\D/g, '');
  if (!d) return NaN;
  const n = Number.parseInt(d, 10);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Escolhe a aba: --sheet explícito → Planilha2 → nome contém "pasta2" → primeira aba.
 * @param {import('xlsx').WorkBook} wb
 */
function resolverNomeAbaHistorico(wb, opts) {
  const names = wb.SheetNames || [];
  if (opts.sheetName) {
    const exact = names.find((n) => String(n).trim() === opts.sheetName.trim());
    if (!exact) {
      throw new Error(
        `Aba "${opts.sheetName}" não encontrada. Disponíveis: ${names.join(', ') || '(nenhuma)'}`
      );
    }
    return exact;
  }
  if (names.includes(SHEET_FALLBACK_PRIMARIO)) {
    return SHEET_FALLBACK_PRIMARIO;
  }
  const pasta2 = names.find((n) => /pasta\s*2/i.test(String(n)));
  if (pasta2) {
    console.log(`[aba] Usando "${pasta2}" (nome contém Pasta2).`);
    return pasta2;
  }
  const first = names[0];
  if (!first) throw new Error('Workbook sem abas.');
  console.warn(`[aba] Aviso: usando primeira aba "${first}" (não há Planilha2 nem Pasta2 no nome).`);
  return first;
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
 * Todas as linhas com algum conteúdo em A–F; campos em falta: título "Andamento", ni→1, data→null.
 * Código A vazio reutiliza o último código válido da coluna A (mesmo cliente em blocos).
 * @param {unknown[][]} mat
 */
function buildLinhas(mat) {
  const linhas = [];
  const totalLinhas = contarLinhasUsadasAteF(mat);
  const lim = totalLinhas > 0 ? totalLinhas : mat.length;
  /** @type {string | null} */
  let lastCod8 = null;
  for (let i = 0; i < lim; i += 1) {
    const row = mat[i];
    if (!Array.isArray(row)) continue;
    const linhaExcel = i + 1;
    const a = row[0];
    const b = row[1];
    const d = row[3];
    const e = row[4];
    const f = row[5];

    const semConteudo =
      (a == null || String(a).trim() === '') &&
      (b == null || String(b).trim() === '') &&
      (d == null || String(d).trim() === '') &&
      (e == null || String(e).trim() === '') &&
      (f == null || String(f).trim() === '');
    if (semConteudo) continue;

    let cod8 = normalizarCodigoCliente8(a);
    if (!cod8 && lastCod8) cod8 = lastCod8;
    if (cod8) lastCod8 = cod8;
    if (!cod8) {
      console.warn(`[planilha] linha ${linhaExcel}: sem código cliente (col. A) — ignorada`);
      continue;
    }

    const bStr = b == null || b === '' ? '' : String(b).trim();
    let numeroInterno = Number.parseInt(bStr, 10);
    if (!Number.isFinite(numeroInterno) || numeroInterno < 1) {
      if (bStr !== '') {
        console.warn(`[planilha] linha ${linhaExcel}: nº interno inválido "${bStr}" — usa 1`);
      }
      numeroInterno = 1;
    }

    const dStr = d == null || d === '' ? '' : String(d).trim();
    let titulo = normalizarTextoPlanilha(dStr);
    if (!titulo.trim()) titulo = 'Andamento';
    if (titulo.length > 500) titulo = titulo.slice(0, 500);

    const movimentoEm = parseMovimentoEmIso(e);
    if (movimentoEm == null && e != null && String(e).trim() !== '') {
      console.warn(
        `[planilha] linha ${linhaExcel}: data col. E não reconhecida — envia movimentoEm null (API usa instante actual)`
      );
    }

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

function normalizarDetalheResponsavelLinhas(brutas) {
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

/** @returns {Promise<Map<string, number>>} codigoCliente8 → pessoaId (titular) */
async function carregarPessoaIdPorCodigoCliente(token, baseUrl) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/clientes`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GET /api/clientes falhou ${res.status}: ${t.slice(0, 400)}`);
  }
  const list = await res.json();
  /** @type {Map<string, number>} */
  const m = new Map();
  if (!Array.isArray(list)) return m;
  for (const c of list) {
    const cod = normalizarCodigoCliente8(c.codigoCliente);
    const pid = Number(c.pessoaId ?? c.id);
    if (cod && Number.isFinite(pid) && pid > 0) m.set(cod, pid);
  }
  return m;
}

/**
 * Resolve pessoaId para código cliente (cache GET lista + fallback /resolucao).
 * @param {Map<string, number>} cache
 */
async function resolverPessoaIdCliente(token, baseUrl, cod8, cache) {
  if (cache.has(cod8)) return cache.get(cod8);
  const url = `${baseUrl.replace(/\/$/, '')}/api/clientes/resolucao?codigoCliente=${encodeURIComponent(cod8)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const j = await res.json();
  const pid = Number(j.pessoaId ?? j.id);
  if (!Number.isFinite(pid) || pid < 1) return null;
  cache.set(cod8, pid);
  return pid;
}

/**
 * Cria processo mínimo (FK válida para andamentos). 422 + «já existe» → duplicate.
 * @returns {Promise<{ ok: boolean, id?: number, duplicate?: boolean, status?: number, text?: string }>}
 */
async function criarProcessoCabecalhoMinimo(token, baseUrl, pessoaId, numeroInterno) {
  const body = {
    clienteId: pessoaId,
    numeroInterno,
    ativo: true,
    consultaAutomatica: false,
    descricaoAcao: 'Processo criado automaticamente na importação de histórico (cabecalho ausente na API).',
  };
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/processos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (res.status === 201 || res.status === 200) {
    try {
      const j = JSON.parse(txt);
      const id = Number(j.id);
      return { ok: true, id: Number.isFinite(id) ? id : undefined };
    } catch {
      return { ok: false, status: res.status, text: txt.slice(0, 300) };
    }
  }
  if (res.status === 422 && /j[aá]\s*existe/i.test(txt)) {
    return { ok: false, duplicate: true, text: txt };
  }
  return { ok: false, status: res.status, text: txt.slice(0, 300) };
}

/**
 * @param {Map<number, number>} mapa
 * @returns {Promise<{ procId: number | null, mapa: Map<number, number> }>}
 */
async function tentarStubProcessoSeNecessario(
  token,
  baseUrl,
  cod8,
  L,
  mapa,
  pessoaPorCod8,
  stats,
  opts
) {
  let m = mapa;
  let procId = m.get(L.numeroInterno);
  if (procId != null) return { procId, mapa: m };
  if (!opts.criarProcessosOrfaos) return { procId: null, mapa: m };

  const pessoaId =
    pessoaPorCod8.get(cod8) ?? (await resolverPessoaIdCliente(token, baseUrl, cod8, pessoaPorCod8));
  if (!pessoaId) return { procId: null, mapa: m };

  const criado = await criarProcessoCabecalhoMinimo(token, baseUrl, pessoaId, L.numeroInterno);
  if (criado.ok && criado.id != null) {
    procId = criado.id;
    m.set(L.numeroInterno, procId);
    stats.processosStubCriados += 1;
    return { procId, mapa: m };
  }
  if (criado.duplicate) {
    cachesMapaPorCliente.delete(cod8);
    m = await obterMapaProcessoId(token, baseUrl, cod8);
    procId = m.get(L.numeroInterno) ?? null;
    return { procId, mapa: m };
  }
  console.warn(
    `[stub-falha] cod=${cod8} ni=${L.numeroInterno} pessoaId=${pessoaId}: ${criado.status ?? '?'} ${(criado.text || '').slice(0, 200)}`
  );
  return { procId: null, mapa: m };
}

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {number} processoId
 * @param {{ movimentoEm: string | null, titulo: string, detalhe: string | null }} payload
 * @param {string} origem
 */
async function postAndamento(baseUrl, token, processoId, payload, origem) {
  // POST /api/processos/{processoId}/andamentos
  const body = {
    movimentoEm: payload.movimentoEm,
    titulo: payload.titulo,
    detalhe: payload.detalhe,
    origem,
    origemAutomatica: false,
    usuarioId: null,
  };
  const url = `${baseUrl}/api/processos/${processoId}/andamentos`;
  const maxTentativas = 8;
  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      const r = await fetch(url, {
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
      const esperaMs = Math.min(30000, 1500 * tentativa ** 2);
      await new Promise((res) => setTimeout(res, esperaMs));
    }
  }
  return { ok: false, status: 0, text: 'retry_exceeded' };
}

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {number} processoId
 * @returns {Promise<{ id: number }[]>}
 */
async function listarAndamentosIds(baseUrl, token, processoId) {
  const url = `${baseUrl}/api/processos/${processoId}/andamentos`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`GET andamentos proc ${processoId}: ${r.status} ${t.slice(0, 300)}`);
  }
  const list = await r.json();
  if (!Array.isArray(list)) return [];
  return list
    .map((x) => (x?.id != null ? Number(x.id) : null))
    .filter((id) => Number.isFinite(id) && id > 0);
}

/** Título alinhado ao POST (trim + mojibake + maiúsculas + espaços). */
function chaveTituloParaDedupe(titulo) {
  const u = normalizarTextoPlanilha(String(titulo ?? ''))
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  return u.length > 500 ? u.slice(0, 500) : u;
}

/** Data/hora comparável (segundos UTC) para dedupe com a API. */
function chaveMovimentoEmParaDedupe(movimentoEm) {
  if (movimentoEm == null || movimentoEm === '') return '_null_';
  const d = new Date(/** @type {string} */ (movimentoEm));
  if (Number.isNaN(d.getTime())) return String(movimentoEm).slice(0, 48);
  return d.toISOString().slice(0, 19) + 'Z';
}

function chaveAndamentoDedupe(movimentoEm, titulo500) {
  return `${chaveMovimentoEmParaDedupe(movimentoEm)}|${chaveTituloParaDedupe(titulo500)}`;
}

/** Lista completa de andamentos (JSON) para montar chaves de dedupe. */
async function listarAndamentosParaDedupe(baseUrl, token, processoId) {
  const url = `${baseUrl}/api/processos/${processoId}/andamentos`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`GET andamentos proc ${processoId}: ${r.status} ${t.slice(0, 300)}`);
  }
  const list = await r.json();
  return Array.isArray(list) ? list : [];
}

/** @param {unknown[]} list */
function popularSetChavesDeLista(list) {
  const s = new Set();
  for (const x of list) {
    const tit = chaveTituloParaDedupe(x?.titulo ?? '');
    const mov = x?.movimentoEm ?? x?.movimento_em;
    s.add(chaveAndamentoDedupe(mov, tit || 'Andamento'));
  }
  return s;
}

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {number} processoId
 */
async function excluirTodosAndamentosProcesso(baseUrl, token, processoId) {
  const ids = await listarAndamentosIds(baseUrl, token, processoId);
  for (const aid of ids) {
    const url = `${baseUrl}/api/processos/${processoId}/andamentos/${aid}`;
    const r = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok && r.status !== 404) {
      const t = await r.text();
      throw new Error(`DELETE andamento ${aid} proc ${processoId}: ${r.status} ${t.slice(0, 200)}`);
    }
  }
  return ids.length;
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
  /** @type {string | null} */
  let codigoClienteFiltro8 = null;
  if (opts.codigoClienteRaw) {
    codigoClienteFiltro8 = normalizarCodigoCliente8(opts.codigoClienteRaw);
    if (!codigoClienteFiltro8) {
      console.error('Código de cliente inválido para --cliente=', opts.codigoClienteRaw);
      process.exit(1);
    }
  }
  if (opts.substituirAndamentos && !codigoClienteFiltro8 && !opts.dryRun) {
    console.error(
      'Na importação real, use --cliente=N com --substituir-andamentos (evita apagar andamentos de vários clientes).'
    );
    process.exit(1);
  }
  if (opts.apenasOrfaos && !opts.criarProcessosOrfaos) {
    console.error('[import] --apenas-orfaos requer --criar-processos-orfaos.');
    process.exit(1);
  }
  if (opts.apenasNovos) {
    if (opts.limparImportPlanilhaAntes) {
      console.warn(
        '[apenas-novos] Limpeza por origem desligada: não faz sentido apagar por origem antes de deduplicar por conteúdo.'
      );
    }
    opts.limparImportPlanilhaAntes = false;
    if (opts.concurrency > 1) {
      console.warn('[apenas-novos] Concorrência fixada em 1 (evita POST duplicado na mesma chave data+título).');
      opts.concurrency = 1;
    }
  }

  validarOrigemApi(opts.origem);
  warnedUnknownResponsavel.clear();

  const filePath = opts.file || DEFAULT_FILE;
  const abs = path.resolve(filePath);

  if (!fs.existsSync(abs)) {
    console.error('Ficheiro não encontrado:', abs);
    process.exit(1);
  }

  const wb = XLSX.readFile(abs, { cellDates: true, dense: false });
  let sheetNome;
  try {
    sheetNome = resolverNomeAbaHistorico(wb, opts);
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
  const sh = wb.Sheets[sheetNome];
  if (!sh) {
    console.error(`Aba "${sheetNome}" inválida. Abas:`, wb.SheetNames.join(', '));
    process.exit(1);
  }
  console.log(`[planilha] Aba: "${sheetNome}"`);

  const mat = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: true });
  const brutas = buildLinhas(mat);
  const totalLinhas = contarLinhasUsadasAteF(mat);

  normalizarDetalheResponsavelLinhas(brutas);
  let candidatas = [...brutas];

  if (codigoClienteFiltro8) {
    const antes = candidatas.length;
    candidatas = candidatas.filter((L) => L.codigoCliente8 === codigoClienteFiltro8);
    console.log(
      `[filtro] cliente ${codigoClienteFiltro8}: ${candidatas.length} linhas (de ${antes} antes do filtro)`
    );
    if (candidatas.length === 0) {
      console.warn('[filtro] Nenhuma linha para este cliente — verifique o código na coluna A da planilha.');
    }
  }

  if (opts.codigoClienteMin != null && opts.codigoClienteMax != null) {
    const antes = candidatas.length;
    candidatas = candidatas.filter((L) => {
      const n = codigoCliente8ParaInt(L.codigoCliente8);
      return Number.isFinite(n) && n >= opts.codigoClienteMin && n <= opts.codigoClienteMax;
    });
    console.log(
      `[filtro-faixa] códigos cliente ${opts.codigoClienteMin}–${opts.codigoClienteMax}: ${candidatas.length} linhas (de ${antes})`
    );
    if (candidatas.length === 0) {
      console.warn('[filtro-faixa] Nenhuma linha nesta faixa — verifique a coluna A ou o intervalo.');
    }
  }

  if (opts.numeroInternoFiltro != null) {
    const ni = opts.numeroInternoFiltro;
    const antes = candidatas.length;
    candidatas = candidatas.filter((L) => L.numeroInterno === ni);
    console.log(`[filtro] processo (col. B) = ${ni}: ${candidatas.length} linhas (de ${antes})`);
    if (candidatas.length === 0) {
      console.warn('[filtro] Nenhuma linha para este nº interno — verifique a coluna B da planilha.');
    }
  }

  const linhasSemData = candidatas.filter((L) => L.movimentoEm == null).length;

  const porClienteLinhas = contarLinhasPorCliente(candidatas);
  /** @type {Record<string, number>} */
  const respDry = {};
  let respNullDry = 0;
  for (const L of candidatas) {
    const key = L.detalheNorm == null ? null : L.detalheNorm;
    if (key == null) respNullDry += 1;
    else respDry[key] = (respDry[key] || 0) + 1;
  }

  if (opts.dryRun) {
    if (opts.substituirAndamentos && !codigoClienteFiltro8) {
      console.warn('[dry-run] --substituir-andamentos sem --cliente: em execução real, limpará vários processos.');
    }
    console.log(`[dry-run] ficheiro: ${abs}`);
    console.log(`[dry-run] total_linhas_planilha (shape): ${totalLinhas}`);
    console.log(`[dry-run] linhas a importar (após regras A–F): ${brutas.length}`);
    console.log(`[dry-run] movimentoEm null (API usará instante actual): ${linhasSemData}`);
    console.log(`[dry-run] origem (andamentos): ${opts.origem}`);
    console.log(`[dry-run] limpar origem antes (defeito): ${opts.limparImportPlanilhaAntes}`);
    console.log(`[dry-run] criar processos em falta (defeito): ${opts.criarProcessosOrfaos}`);
    console.log(`[dry-run] andamentos a POST (simulação): ${candidatas.length}`);
    if (opts.apenasNovos) {
      console.log(
        '[dry-run] --apenas-novos: na execução real serão omitidos POSTs cuja data+título já existam no processo (requer GET por processo).'
      );
    }
    console.log('\n[dry-run] contagem por cliente:');
    for (const cod of Object.keys(porClienteLinhas).sort()) {
      console.log(`  ${cod}: ${porClienteLinhas[cod]}`);
    }
    console.log('\n[dry-run] contagem por responsavel (catalogados em MAIÚSCULAS; outros = texto livre em detalhe):');
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
            origem: opts.origem,
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

  /** @type {number} */
  let removidosLimpeza = 0;
  if (opts.limparImportPlanilhaAntes) {
    try {
      removidosLimpeza = await limparAndamentosPorOrigem(opts.baseUrl, token, opts.origem);
      console.log(`[limpar] Removidos ${removidosLimpeza} andamento(s) com origem=${opts.origem}`);
      cachesMapaPorCliente.clear();
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  } else {
    console.log(
      `[limpar] Omitido (--nao-limpar-import); podem acumular-se andamentos com origem=${opts.origem} duplicados`
    );
  }

  /** @type {Map<string, number>} */
  let pessoaPorCod8 = new Map();
  if (opts.criarProcessosOrfaos) {
    try {
      pessoaPorCod8 = await carregarPessoaIdPorCodigoCliente(token, opts.baseUrl);
      console.log(
        `[import] mapa inicial GET /api/clientes → ${pessoaPorCod8.size} códigos com pessoaId (criação de processos em falta: ligada)`
      );
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
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
    processosStubCriados: 0,
    pulados_sem_data: linhasSemData,
    pulados_sistema: 0,
    puladosJaExistem: 0,
    /** @type {Record<string, number>} */
    respCriados: {},
    respNull: 0,
    detalheCatalogado: 0,
    detalheTextoLivre: 0,
  };

  if (opts.apenasOrfaos) {
    /** @type {Map<string, object[]>} */
    const orfaosPorCod = new Map();
    for (const cod8 of ordemClientes) {
      let mapa;
      try {
        mapa = await obterMapaProcessoId(token, opts.baseUrl, cod8);
      } catch (e) {
        console.error(e);
        process.exit(1);
      }
      for (const L of candidatasPorCliente.get(cod8) || []) {
        if (mapa.get(L.numeroInterno) == null) {
          if (!orfaosPorCod.has(cod8)) orfaosPorCod.set(cod8, []);
          orfaosPorCod.get(cod8).push(L);
        }
      }
    }
    let nOrf = 0;
    for (const arr of orfaosPorCod.values()) nOrf += arr.length;
    console.log(`[apenas-orfaos] ${nOrf} linha(s) sem processo na API (stub + POST apenas nestas)`);

    const cod8Ordenados = [...orfaosPorCod.keys()].sort((a, b) => Number(a) - Number(b));
    for (const cod8 of cod8Ordenados) {
      let mapa;
      try {
        mapa = await obterMapaProcessoId(token, opts.baseUrl, cod8);
      } catch (e) {
        console.error(e);
        process.exit(1);
      }
      const listaOrf = orfaosPorCod.get(cod8) || [];
      for (const L of listaOrf) {
        touchCliente(cod8);
        const r = await tentarStubProcessoSeNecessario(
          token,
          opts.baseUrl,
          cod8,
          L,
          mapa,
          pessoaPorCod8,
          stats,
          opts
        );
        mapa = r.mapa;
        const procId = r.procId;
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
  } else {
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
        let procId = mapa.get(L.numeroInterno);
        if (procId == null) {
          const r = await tentarStubProcessoSeNecessario(
            token,
            opts.baseUrl,
            cod8,
            L,
            mapa,
            pessoaPorCod8,
            stats,
            opts
          );
          mapa = r.mapa;
          procId = r.procId;
        }
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
  }

  if (opts.substituirAndamentos && tarefas.length > 0) {
    const procIds = [...new Set(tarefas.map((t) => t.procId))];
    console.log(
      `[substituir] A remover andamentos existentes em ${procIds.length} processo(s) antes da importação…`
    );
    let removidos = 0;
    for (const pid of procIds) {
      try {
        const n = await excluirTodosAndamentosProcesso(opts.baseUrl, token, pid);
        removidos += n;
        if (n > 0) console.log(`[substituir] processo ${pid}: ${n} andamento(s) removido(s)`);
      } catch (e) {
        console.error(e);
        process.exit(1);
      }
    }
    console.log(`[substituir] Total removido: ${removidos} andamento(s)`);
  }

  /** @type {Map<number, Set<string>> | null} */
  let chavesPorProcId = null;
  if (opts.apenasNovos && tarefas.length > 0) {
    chavesPorProcId = new Map();
    const ids = [...new Set(tarefas.map((t) => t.procId))].sort((a, b) => a - b);
    console.log(`[apenas-novos] A indexar andamentos existentes em ${ids.length} processo(s)…`);
    let totalChaves = 0;
    for (const pid of ids) {
      const rows = await listarAndamentosParaDedupe(opts.baseUrl, token, pid);
      const set = popularSetChavesDeLista(rows);
      chavesPorProcId.set(pid, set);
      totalChaves += set.size;
    }
    console.log(`[apenas-novos] Chaves já existentes (data+título normalizados): ${totalChaves}`);
  }

  await runPool(tarefas, opts.concurrency, async ({ L, procId, codigoCliente8 }) => {
    touchCliente(codigoCliente8);
    const titulo = String(L.titulo || '').trim() || 'Andamento';
    const titulo500 = titulo.length > 500 ? titulo.slice(0, 500) : titulo;
    const movPost = L.movimentoEm != null ? /** @type {string} */ (L.movimentoEm) : null;
    const chave = chaveAndamentoDedupe(movPost, titulo500);
    if (chavesPorProcId) {
      const set = chavesPorProcId.get(procId);
      if (set && set.has(chave)) {
        stats.puladosJaExistem += 1;
        return;
      }
    }
    const r = await postAndamento(opts.baseUrl, token, procId, {
      movimentoEm: movPost,
      titulo: titulo500,
      detalhe: L.detalheNorm,
    }, opts.origem);
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
    if (chavesPorProcId) {
      if (!chavesPorProcId.has(procId)) chavesPorProcId.set(procId, new Set());
      chavesPorProcId.get(procId).add(chave);
    }
    if (L.detalheNorm == null) {
      stats.respNull += 1;
    } else {
      stats.respCriados[L.detalheNorm] = (stats.respCriados[L.detalheNorm] || 0) + 1;
      if (RESPONSAVEIS_RECONHECIDOS.has(L.detalheNorm)) stats.detalheCatalogado += 1;
      else stats.detalheTextoLivre += 1;
    }
  });

  console.log(
    `[andamentos] criados=${stats.criados} falhas=${stats.falhas} orfaos=${stats.orfaos} processos_stub_criados=${stats.processosStubCriados} pulados_sem_data=${stats.pulados_sem_data} pulados_sistema=${stats.pulados_sistema} pulados_ja_existem=${stats.puladosJaExistem} total_linhas=${totalLinhas}`
  );
  imprimirResumoResponsavel(stats.respCriados, stats.respNull);
  imprimirResumoCliente(porClienteStats);

  const faixaText =
    opts.codigoClienteMin != null && opts.codigoClienteMax != null
      ? `${opts.codigoClienteMin}–${opts.codigoClienteMax}`
      : '(nenhum)';
  console.log('\n======== RELATÓRIO — IMPORTAÇÃO HISTÓRICO ========');
  console.log(`Ficheiro: ${abs}`);
  console.log(`Aba: ${sheetNome}`);
  console.log(`Origem (andamentos / limpeza em massa): ${opts.origem}`);
  console.log(`Filtro faixa código cliente (opcional): ${faixaText}`);
  console.log(`Linhas com conteúdo A–F (shape da folha): ${totalLinhas}`);
  console.log(`Linhas candidatas após filtros no script: ${candidatas.length}`);
  console.log(`Limpeza prévia desta origem: removidos=${removidosLimpeza} (omitida=${!opts.limparImportPlanilhaAntes})`);
  console.log(`POST andamentos com sucesso: ${stats.criados}`);
  console.log(`POST falhou: ${stats.falhas}`);
  console.log(`Pulados (já existiam data+título no processo): ${stats.puladosJaExistem}`);
  console.log(`Órfãos (sem processo após tentativa de stub): ${stats.orfaos}`);
  console.log(`Processos criados (stub): ${stats.processosStubCriados}`);
  console.log(`Linhas com data ausente/ inválida (movimentoEm null → API usa instante): ${stats.pulados_sem_data}`);
  console.log(`detalhe null (sem responsável ou ruído / mapa→null): ${stats.respNull}`);
  console.log(`detalhe nome catalogado (equipa reconhecida): ${stats.detalheCatalogado}`);
  console.log(`detalhe texto livre (não catalogado; usuarioId=null na API): ${stats.detalheTextoLivre}`);
  console.log(
    `Clientes com ≥1 andamento criado: ${Object.keys(porClienteStats).filter((k) => porClienteStats[k].criados > 0).length}`
  );
  console.log('==================================================\n');

  process.exit(stats.falhas > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
