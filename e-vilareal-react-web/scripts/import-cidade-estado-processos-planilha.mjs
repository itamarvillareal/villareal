#!/usr/bin/env node
/**
 * Importa **cidade** (col. B) e **UF / estado** (col. C) do cabeçalho do processo a partir de uma planilha com uma única aba.
 *
 * Layout esperado:
 *   Col. A — código do cliente (8 dígitos ou número; reutiliza o último código se A vazio)
 *   Col. B — nome da cidade
 *   Col. C — UF ou nome do estado (normalização básica para sigla de 2 letras)
 *   Col. D — número interno do processo (nº proc.)
 *
 * Leitura: matriz densa A–D a partir das células (não só `sheet_to_json`), para .xls com `!ref` incompleto
 * não omitir linhas (ex. linha 21 com dados).
 *
 * Ficheiro por defeito: `$HOME/Dropbox/sistema/Cidade Processos.xls` (override: env
 * `VILAREAL_PLANILHA_CIDADES_PROCESSOS` ou primeiro argumento posicional).
 *
 * Uso:
 *   VILAREAL_IMPORT_SENHA='***' node scripts/import-cidade-estado-processos-planilha.mjs --login=itamar
 *   node scripts/import-cidade-estado-processos-planilha.mjs "/caminho/Cidade Processos.xls" --dry-run
 *
 * Opções:
 *   --sheet=NomeDaAba     Aba (defeito: primeira aba do livro)
 *   --linha-inicio=N      Primeira linha Excel com dados (defeito: 1)
 *   --pular-se-igual      Não envia PUT se cidade e UF já coincidem com a API
 *   --dry-run
 *
 * Envs: VILAREAL_API_BASE, VILAREAL_IMPORT_SENHA, VILAREAL_IMPORT_CONCURRENCY (defeito 4),
 *       VILAREAL_PLANILHA_CIDADES_PROCESSOS
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';

import { normalizarTextoPlanilha } from './lib/normalizar-texto-planilha.mjs';
import { clientePkFromApiDto } from './lib/vilareal-import-processo-api.mjs';

const LIM_CIDADE = 120;

const DEFAULT_RELATIVO_DROPBOX = path.join('Dropbox', 'sistema', 'Cidade Processos.xls');

/** Siglas válidas (inclui estados + DF). */
const UFS_VALIDAS = new Set([
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]);

/** Nome do estado (sem acento, maiúsculas) → sigla. */
const NOME_ESTADO_PARA_UF = {
  ACRE: 'AC',
  ALAGOAS: 'AL',
  AMAPA: 'AP',
  AMAZONAS: 'AM',
  BAHIA: 'BA',
  CEARA: 'CE',
  'DISTRITO FEDERAL': 'DF',
  'ESPIRITO SANTO': 'ES',
  'ESPÍRITO SANTO': 'ES',
  GOIAS: 'GO',
  'GOIÁS': 'GO',
  MARANHAO: 'MA',
  'MARANHÃO': 'MA',
  'MATO GROSSO': 'MT',
  'MATO GROSSO DO SUL': 'MS',
  'MINAS GERAIS': 'MG',
  PARA: 'PA',
  'PARÁ': 'PA',
  PARAIBA: 'PB',
  'PARAÍBA': 'PB',
  PARANA: 'PR',
  'PARANÁ': 'PR',
  PERNAMBUCO: 'PE',
  PIAUI: 'PI',
  'PIAUÍ': 'PI',
  'RIO DE JANEIRO': 'RJ',
  'RIO GRANDE DO NORTE': 'RN',
  'RIO GRANDE DO SUL': 'RS',
  RONDONIA: 'RO',
  'RONDÔNIA': 'RO',
  RORAIMA: 'RR',
  'SANTA CATARINA': 'SC',
  'SAO PAULO': 'SP',
  'SÃO PAULO': 'SP',
  SERGIPE: 'SE',
  TOCANTINS: 'TO',
};

function defaultPlanilhaPath() {
  const env = (process.env.VILAREAL_PLANILHA_CIDADES_PROCESSOS || '').trim();
  if (env && fs.existsSync(env)) return env;
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (home) {
    const p = path.join(home, DEFAULT_RELATIVO_DROPBOX);
    if (fs.existsSync(p)) return p;
  }
  return path.join(home || '', DEFAULT_RELATIVO_DROPBOX);
}

function parseArgs(argv) {
  const out = {
    file: null,
    login: 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    dryRun: false,
    sheetName: null,
    linhaInicio: 1,
    pularSeIgual: false,
    concurrency: Math.min(
      32,
      Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY || 4) || 4)
    ),
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--pular-se-igual') out.pularSeIgual = true;
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--sheet=')) out.sheetName = a.slice(8).trim();
    else if (a.startsWith('--linha-inicio=')) {
      const n = Number(a.slice(15));
      if (Number.isFinite(n) && n >= 1) out.linhaInicio = Math.floor(n);
    } else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice(14));
      if (Number.isFinite(n) && n >= 1) out.concurrency = Math.min(32, Math.floor(n));
    } else if (!a.startsWith('-') && !out.file) out.file = a;
  }
  return out;
}

function stripDiacritics(s) {
  return String(s)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .trim();
}

/**
 * @param {unknown} val
 * @returns {string | null} sigla 2 letras ou null
 */
function parseUf(val) {
  if (val == null || val === '') return null;
  const raw = normalizarTextoPlanilha(val);
  if (!raw) return null;
  const compact = raw.replace(/\s+/g, ' ').trim();
  const upper2 = compact.toUpperCase();
  if (upper2.length === 2 && UFS_VALIDAS.has(upper2)) return upper2;
  const noAccent = stripDiacritics(compact);
  if (NOME_ESTADO_PARA_UF[noAccent]) return NOME_ESTADO_PARA_UF[noAccent];
  if (NOME_ESTADO_PARA_UF[compact.toUpperCase()]) return NOME_ESTADO_PARA_UF[compact.toUpperCase()];
  const onlyLetters = noAccent.replace(/[^A-Z\s]/g, '').replace(/\s+/g, ' ').trim();
  if (NOME_ESTADO_PARA_UF[onlyLetters]) return NOME_ESTADO_PARA_UF[onlyLetters];
  if (onlyLetters.length === 2 && UFS_VALIDAS.has(onlyLetters)) return onlyLetters;
  const firstTwo = onlyLetters.slice(0, 2);
  if (firstTwo.length === 2 && UFS_VALIDAS.has(firstTwo)) return firstTwo;
  return null;
}

/** Código cliente 8 dígitos. */
function normalizarCodigoCliente8(val) {
  if (val == null || val === '') return null;
  const s = String(val).trim().replace(/\D/g, '');
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return String(n).padStart(8, '0');
}

function parseNumeroInterno(v) {
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

function truncarCidade(s) {
  if (!s) return null;
  const t = s.length > LIM_CIDADE ? s.slice(0, LIM_CIDADE) : s;
  return t;
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

const PAGE_SIZE_MAPA = 100;
/** @type {Map<string, Map<number, number>>} */
const cachesMapaPorCliente = new Map();

/**
 * @param {string} token
 * @param {string} baseUrl
 * @param {string} codigoCliente8
 * @returns {Promise<Map<number, number>>} numeroInterno → processoId
 */
async function obterMapaProcessoId(token, baseUrl, codigoCliente8) {
  if (cachesMapaPorCliente.has(codigoCliente8)) {
    return cachesMapaPorCliente.get(codigoCliente8);
  }
  /** @type {Map<number, number>} */
  const map = new Map();
  const maxTentativas = 6;

  for (let page = 0; ; page += 1) {
    const params = new URLSearchParams();
    params.set('codigoCliente', codigoCliente8);
    params.set('page', String(page));
    params.set('size', String(PAGE_SIZE_MAPA));
    params.append('sort', 'numeroInterno,asc');
    params.append('sort', 'id,asc');
    const url = `${baseUrl}/api/processos?${params.toString()}`;

    let res;
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {
      try {
        res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        break;
      } catch (err) {
        const cod = err?.cause?.code ?? err?.code;
        const msg = String(err?.message ?? '');
        const rede =
          cod === 'ECONNRESET' ||
          cod === 'ETIMEDOUT' ||
          msg.includes('fetch failed') ||
          String(err?.cause?.code ?? '') === 'ECONNRESET';
        if (!rede || tentativa === maxTentativas) throw err;
        await new Promise((r) => setTimeout(r, Math.min(30000, 1500 * tentativa ** 2)));
      }
    }
    if (!res) throw new Error(`GET processos ${codigoCliente8}: sem resposta`);
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`GET processos ${codigoCliente8} falhou ${res.status}: ${t.slice(0, 400)}`);
    }
    const body = await res.json();
    let list;
    let fim = false;
    if (Array.isArray(body)) {
      list = body;
      fim = true;
    } else if (body && Array.isArray(body.content)) {
      list = body.content;
      fim = body.last === true || list.length < PAGE_SIZE_MAPA;
    } else {
      throw new Error('GET processos: resposta inválida (esperado Page ou array)');
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
  return map;
}

/**
 * Corpo PUT a partir do GET (evita limpar usuarioResponsavel / consultaAutomatica / datas).
 * @param {Record<string, unknown>} r
 * @param {{ cidade: string | null; uf: string | null }} patch
 */
function processoResponseParaWriteRequest(r, patch) {
  const consultaAuto = r.consultaAutomatica === true;
  const ativo = r.ativo !== false;

  return {
    clienteId: clientePkFromApiDto(r) ?? r.clienteId,
    numeroInterno: r.numeroInterno,
    unidade: r.unidade ?? null,
    pasta: r.pasta ?? null,
    numeroCnj: r.numeroCnj ?? null,
    numeroProcessoAntigo: r.numeroProcessoAntigo ?? null,
    naturezaAcao: r.naturezaAcao ?? null,
    descricaoAcao: r.descricaoAcao ?? null,
    competencia: r.competencia ?? null,
    fase: r.fase ?? null,
    observacaoFase: r.observacaoFase ?? null,
    tramitacao: r.tramitacao ?? null,
    dataProtocolo: r.dataProtocolo ?? null,
    prazoFatal: r.prazoFatal ?? null,
    proximaConsulta: r.proximaConsulta ?? null,
    observacao: r.observacao ?? null,
    valorCausa: r.valorCausa ?? null,
    uf: patch.uf,
    cidade: patch.cidade,
    consultaAutomatica: consultaAuto,
    ativo,
    consultor: r.consultor ?? null,
    usuarioResponsavelId: r.usuarioResponsavelId ?? null,
  };
}

function igualCidadeUfApi(r, cidade, uf) {
  const apiCid = String(r.cidade ?? '').trim();
  const apiUf = String(r.uf ?? '').trim().toUpperCase();
  const nCid = String(cidade ?? '').trim();
  const nUf = String(uf ?? '').trim().toUpperCase();
  return apiCid === nCid && apiUf === nUf;
}

/**
 * Constrói matriz densa A–D linha a linha a partir das células do worksheet.
 * Evita o problema comum em .xls em que `sheet_to_json` respeita `!ref` desactualizado
 * e **omite linhas** (ex.: dados na linha 21 não aparecem no array).
 *
 * @param {import('xlsx').WorkSheet} ws
 * @param {number} colMaxZero índice 0-based da última coluna (3 = coluna D)
 * @returns {unknown[][]}
 */
function worksheetParaMatrizColunas(ws, colMaxZero) {
  let maxR = -1;
  if (ws && ws['!ref']) {
    try {
      const rng = XLSX.utils.decode_range(ws['!ref']);
      maxR = Math.max(maxR, rng.e.r);
    } catch {
      /* ignore */
    }
  }
  if (ws && typeof ws === 'object') {
    for (const k of Object.keys(ws)) {
      if (!k || k[0] === '!') continue;
      let c;
      try {
        c = XLSX.utils.decode_cell(k);
      } catch {
        continue;
      }
      if (c.c <= colMaxZero) maxR = Math.max(maxR, c.r);
    }
  }
  if (maxR < 0) return [];
  /** @type {unknown[][]} */
  const mat = [];
  for (let R = 0; R <= maxR; R += 1) {
    const row = [];
    for (let C = 0; C <= colMaxZero; C += 1) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (cell == null || cell.t === 'z') {
        row.push(null);
        continue;
      }
      const v = Object.prototype.hasOwnProperty.call(cell, 'v') ? cell.v : null;
      row.push(v ?? null);
    }
    mat.push(row);
  }
  return mat;
}

/** Última linha 1-based com valor em A–D (sobre matriz densa). */
function contarLinhasUsadasAteD(mat) {
  let max = 0;
  for (let i = 0; i < mat.length; i += 1) {
    const row = mat[i];
    if (!Array.isArray(row)) continue;
    for (let j = 0; j < 4; j += 1) {
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
 * @param {unknown[][]} mat
 * @param {number} linhaInicioExcel 1-based
 */
function extrairLinhasPlanilha(mat, linhaInicioExcel) {
  const startIdx = Math.max(0, linhaInicioExcel - 1);
  const total = contarLinhasUsadasAteD(mat);
  /** Incluir até ao fim da matriz (linhas vazias no meio/fim) e nunca parar antes da última linha com dados. */
  const lim = Math.max(mat.length, total);
  /** @type {{ linhaExcel: number; codigoCliente8: string; cidade: string | null; uf: string | null; numeroInterno: number }[]} */
  const out = [];
  /** @type {string | null} */
  let lastCod8 = null;

  for (let i = startIdx; i < lim; i += 1) {
    const row = mat[i];
    if (!Array.isArray(row)) continue;
    const linhaExcel = i + 1;
    const a = row[0];
    const b = row[1];
    const c = row[2];
    const d = row[3];

    const vazio =
      (a == null || String(a).trim() === '') &&
      (b == null || String(b).trim() === '') &&
      (c == null || String(c).trim() === '') &&
      (d == null || String(d).trim() === '');
    if (vazio) continue;

    let cod8 = normalizarCodigoCliente8(a);
    if (!cod8 && lastCod8) cod8 = lastCod8;
    if (cod8) lastCod8 = cod8;

    const cidadeRaw = b != null ? normalizarTextoPlanilha(b) : '';
    const cidade = cidadeRaw ? truncarCidade(cidadeRaw) : null;
    const uf = parseUf(c);
    const numeroInterno = parseNumeroInterno(d);

    if (!cod8) {
      console.warn(`[planilha] linha ${linhaExcel}: código cliente em falta — ignorada`);
      continue;
    }
    if (numeroInterno == null) {
      console.warn(`[planilha] linha ${linhaExcel}: nº processo (col. D) inválido — ignorada`);
      continue;
    }
    if (!cidade && !uf) {
      console.warn(`[planilha] linha ${linhaExcel}: cidade e UF vazias — ignorada`);
      continue;
    }
    if (c && !uf) {
      console.warn(
        `[planilha] linha ${linhaExcel}: col. C "${String(c).slice(0, 40)}" não reconhecida como UF — ` +
          'gravamos só cidade se houver; ajuste o texto ou use sigla (ex.: SP).'
      );
    }

    out.push({ linhaExcel, codigoCliente8: cod8, cidade, uf, numeroInterno });
  }
  return out;
}

function resolverNomeAba(wb, sheetNameOpt) {
  const names = wb.SheetNames || [];
  if (sheetNameOpt) {
    const exact = names.find((n) => String(n).trim() === sheetNameOpt.trim());
    if (!exact) {
      throw new Error(`Aba "${sheetNameOpt}" não encontrada. Disponíveis: ${names.join(', ') || '(nenhuma)'}`);
    }
    return exact;
  }
  const first = names[0];
  if (!first) throw new Error('Workbook sem abas.');
  if (names.length > 1) {
    console.warn(`[aba] Várias abas; usando a primeira: "${first}". Use --sheet= para outra.`);
  }
  return first;
}

async function getProcesso(token, baseUrl, id) {
  const url = `${baseUrl}/api/processos/${id}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GET /api/processos/${id} ${res.status}: ${t.slice(0, 300)}`);
  }
  return res.json();
}

async function putProcesso(token, baseUrl, id, body) {
  const url = `${baseUrl}/api/processos/${id}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, text: txt.slice(0, 500) };
  }
  return { ok: true };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const file = opts.file || defaultPlanilhaPath();

  if (!opts.dryRun && !opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha= (ou use --dry-run).');
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error(`Ficheiro não encontrado: ${file}`);
    console.error('Passe o caminho como argumento ou defina VILAREAL_PLANILHA_CIDADES_PROCESSOS.');
    process.exit(1);
  }

  const wb = XLSX.readFile(file, { cellDates: true });
  const sheetName = resolverNomeAba(wb, opts.sheetName);
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet object ausente: ${sheetName}`);

  /** @type {unknown[][]} */
  const mat = worksheetParaMatrizColunas(ws, 3);

  if (opts.linhaInicio > mat.length) {
    console.warn(
      `[planilha] --linha-inicio=${opts.linhaInicio} é maior que o nº de linhas lidas (${mat.length}). ` +
        'Nenhuma linha será processada. Use --linha-inicio=1 ou o nº da primeira linha Excel com dados.'
    );
  }

  const linhas = extrairLinhasPlanilha(mat, opts.linhaInicio);

  console.log(`Ficheiro: ${file}`);
  console.log(
    `Aba: ${sheetName} | Linhas lidas (A–D): ${mat.length} | última linha com algum valor A–D: ${contarLinhasUsadasAteD(mat) || '—'} | ` +
      `Linhas úteis (após filtro): ${linhas.length} | dry-run: ${opts.dryRun}`
  );

  if (linhas.length === 0) {
    console.log(
      'Nada a importar. Causas frequentes: aba errada (--sheet=), --linha-inicio acima dos dados, ' +
        'cabeçalho na col. A que não é número de cliente, ou colunas deslocadas.'
    );
    return;
  }

  /** @type {string | null} */
  let token = null;
  if (!opts.dryRun) {
    token = await login(opts);
  }

  /** @type {('ok'|'skipSemProc'|'skipIgual'|'fail')[]} */
  const outcomes = [];

  for (let i = 0; i < linhas.length; i += opts.concurrency) {
    const chunk = linhas.slice(i, i + opts.concurrency);
    const part = await Promise.all(
      chunk.map(async (L) => {
        const { linhaExcel, codigoCliente8, cidade, uf, numeroInterno } = L;

        if (opts.dryRun) {
          console.log(
            `[dry-run] L${linhaExcel} cliente=${codigoCliente8} proc=${numeroInterno} cidade=${cidade ?? '—'} uf=${uf ?? '—'}`
          );
          return /** @type {const} */ ('ok');
        }

        try {
          const mapa = await obterMapaProcessoId(token, opts.baseUrl, codigoCliente8);
          const processoId = mapa.get(numeroInterno);
          if (processoId == null) {
            console.warn(
              `[aviso] L${linhaExcel} cliente ${codigoCliente8}: processo nº interno ${numeroInterno} não encontrado na API`
            );
            return /** @type {const} */ ('skipSemProc');
          }

          const r = await getProcesso(token, opts.baseUrl, processoId);
          const codApi = normalizarCodigoCliente8(r.codigoCliente);
          if (codApi && codApi !== codigoCliente8) {
            console.warn(
              `[aviso] L${linhaExcel} processo ${processoId}: código API (${codApi}) ≠ planilha (${codigoCliente8}) — continua mesmo assim`
            );
          }

          const patch = {
            cidade: cidade ?? r.cidade ?? null,
            uf: uf ?? r.uf ?? null,
          };
          if (!patch.cidade && !patch.uf) {
            console.warn(`[aviso] L${linhaExcel}: sem cidade e UF após merge — ignorada`);
            return /** @type {const} */ ('skipSemProc');
          }

          if (opts.pularSeIgual && igualCidadeUfApi(r, patch.cidade, patch.uf)) {
            return /** @type {const} */ ('skipIgual');
          }

          const body = processoResponseParaWriteRequest(r, patch);
          const put = await putProcesso(token, opts.baseUrl, processoId, body);
          if (!put.ok) {
            console.error(`[erro] L${linhaExcel} processo ${processoId}: ${put.status} ${put.text}`);
            return /** @type {const} */ ('fail');
          }
          return /** @type {const} */ ('ok');
        } catch (e) {
          console.error(`[erro] L${linhaExcel}: ${e?.message ?? e}`);
          return /** @type {const} */ ('fail');
        }
      })
    );
    outcomes.push(...part);
  }

  const ok = outcomes.filter((x) => x === 'ok').length;
  const skipSemProc = outcomes.filter((x) => x === 'skipSemProc').length;
  const skipIgual = outcomes.filter((x) => x === 'skipIgual').length;
  const falhas = outcomes.filter((x) => x === 'fail').length;

  console.log('—');
  console.log(
    `Resumo: ok/atualizados=${ok} | sem processo/ignoradas=${skipSemProc} | já iguais (pular)=${skipIgual} | falhas=${falhas}`
  );
  if (falhas > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
