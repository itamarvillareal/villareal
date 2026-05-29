#!/usr/bin/env node
/**
 * Importa rodadas de cálculo (layout 2026) + opcionalmente pagamentos quando a coluna F (data pagamento, aba 2) está preenchida.
 *
 * Fluxo por chave `codigo8|proc|dim`:
 * 1) Garante `processoId` (GET /api/processos por cliente; se não existir e não for `--sem-criar-processos`, POST mínimo).
 * 2) GET rodada existente; funde com títulos (aba débitos) e parcelas (aba relatório, só linhas com «Cálculo Aceito» = SIM na col L).
 *    Títulos: só linhas com vencimento ou valor inicial; substitui `titulos[]` da rodada (não funde com grade antiga).
 * 3) PUT /api/calculos/rodadas/{cod8}/{proc}/{dim}
 * 4) Se `--skip-pagamentos` não estiver ativo: para cada parcela com data em H, POST /api/pagamentos
 *    (`PAGO_SEM_COMPROVANTE` + `dataPagamentoEfetivo`; demais campos opcionais no servidor).
 *    Só cria pagamento se existir `processoId` (por defeito tenta criar processo em falta; use `--sem-criar-processos` só quando já estiver tudo cadastrado).
 *
 * Uso (igual ao histórico / cálculos legado: ficheiro em `Dropbox/sistema/import-calculo.xls` se não passar caminho):
 *   node scripts/import-calculos-planilha-layout2026.mjs [--login=itamar]
 *   node scripts/import-calculos-planilha-layout2026.mjs "/outro/caminho.xls" --dry-run
 *
 * Opções: --dry-run, --login=, --senha=, --base-url=, --codigo-cliente=00000123, --concurrency=N,
 *         --sem-criar-processos, --skip-pagamentos
 *         --header-row=N, --data-row=N (1-based; aplicam-se às duas abas se não usar overrides por aba)
 *         --header-row-aba1=, --data-row-aba1=, --header-row-aba2=, --data-row-aba2=
 *
 * Envs: VILAREAL_API_BASE, VILAREAL_IMPORT_SENHA, VILAREAL_IMPORT_CONCURRENCY, VILAREAL_IMPORT_CALCULO_XLS
 * (senha também em `.env.import.local` ou `~/.vilareal-import-env`, como nos outros imports.)
 */

import './lib/load-vilareal-import-env.mjs';

import process from 'node:process';
import XLSX from 'xlsx';
import {
  compactarTitulosImport,
  parseLayout2026FromWorkbook,
} from './lib/import-calculo-layout2026-parse.mjs';
import { candidatosImportCalculoXlsParaLog, resolveImportCalculoXlsPath } from './lib/resolve-import-calculo-xls.mjs';
import {
  garantirProcessoNaApi,
  resolverClienteFromApi,
  loginImportApi,
} from './lib/vilareal-import-processo-api.mjs';

const PAGE_SIZE_MAPA_PROCESSOS = 100;

/** @type {Map<string, Map<number, number>>} */
const cachesMapaPorCliente = new Map();

function parseLinhaPlanilha1BasedArg(val, flag) {
  const n = Number(String(val).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    console.error(`[layout2026] ${flag} deve ser um inteiro ≥ 1 (linha 1-based).`);
    process.exit(1);
  }
  return n;
}

function parseArgs(argv) {
  const out = {
    file: null,
    login: 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    dryRun: false,
    codigoCliente: null,
    criarProcessos: true,
    skipPagamentos: false,
    layoutHeaderRow: null,
    layoutDataRow: null,
    layoutHeaderRowAba1: null,
    layoutDataRowAba1: null,
    layoutHeaderRowAba2: null,
    layoutDataRowAba2: null,
    concurrency: Math.min(
      32,
      Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY || 3) || 3)
    ),
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--sem-criar-processos') out.criarProcessos = false;
    else if (a === '--skip-pagamentos') out.skipPagamentos = true;
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--codigo-cliente=')) out.codigoCliente = a.slice(17).trim();
    else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice(14));
      if (Number.isFinite(n) && n >= 1) out.concurrency = Math.min(32, Math.floor(n));
    } else if (a.startsWith('--header-row='))
      out.layoutHeaderRow = parseLinhaPlanilha1BasedArg(a.slice(13), '--header-row');
    else if (a.startsWith('--data-row='))
      out.layoutDataRow = parseLinhaPlanilha1BasedArg(a.slice(11), '--data-row');
    else if (a.startsWith('--header-row-aba1='))
      out.layoutHeaderRowAba1 = parseLinhaPlanilha1BasedArg(a.slice(18), '--header-row-aba1');
    else if (a.startsWith('--data-row-aba1='))
      out.layoutDataRowAba1 = parseLinhaPlanilha1BasedArg(a.slice(16), '--data-row-aba1');
    else if (a.startsWith('--header-row-aba2='))
      out.layoutHeaderRowAba2 = parseLinhaPlanilha1BasedArg(a.slice(18), '--header-row-aba2');
    else if (a.startsWith('--data-row-aba2='))
      out.layoutDataRowAba2 = parseLinhaPlanilha1BasedArg(a.slice(16), '--data-row-aba2');
    else if (!a.startsWith('-') && !out.file) out.file = a;
  }
  return out;
}

/** @param {ReturnType<typeof parseArgs>} opts */
function buildLayout2026WorkbookParseOpts(opts) {
  /** @type {Record<string, number>} */
  const o = {};
  if (opts.layoutHeaderRow != null) o.headerRow = opts.layoutHeaderRow;
  if (opts.layoutDataRow != null) o.dataRow = opts.layoutDataRow;
  if (opts.layoutHeaderRowAba1 != null) o.headerRowAba1 = opts.layoutHeaderRowAba1;
  if (opts.layoutDataRowAba1 != null) o.dataRowAba1 = opts.layoutDataRowAba1;
  if (opts.layoutHeaderRowAba2 != null) o.headerRowAba2 = opts.layoutHeaderRowAba2;
  if (opts.layoutDataRowAba2 != null) o.dataRowAba2 = opts.layoutDataRowAba2;
  return o;
}

/** Mantém apenas chaves `${codigo8}|proc|dim`. */
function filtrarTitulosPorCodigo(map, codigo8) {
  if (!codigo8) return map;
  const out = {};
  const prefix = `${codigo8}|`;
  for (const [k, v] of Object.entries(map)) {
    if (k.startsWith(prefix)) out[k] = v;
  }
  return out;
}

function filtrarParcelamentoPorCodigo(map, codigo8) {
  return filtrarTitulosPorCodigo(map, codigo8);
}

function defaultRodadaPayload() {
  return {
    pagina: 1,
    paginaParcelamento: 1,
    titulos: [],
    parcelas: [],
    quantidadeParcelasInformada: '00',
    taxaJurosParcelamento: '0,00',
    limpezaAtiva: false,
    snapshotAntesLimpeza: null,
    cabecalho: { autor: '', reu: '' },
    honorariosDataRecebimento: {},
    parcelamentoAceito: false,
    debitos: [],
  };
}

/** @param {object[]} rows */
function sanitizarTitulosParaApi(rows) {
  return rows.map((t) => {
    const { _planilhaLinha, _parcelaPlanilha, ...rest } = t;
    return rest;
  });
}

/** @param {object[]} rows */
function sanitizarParcelasParaApi(rows) {
  return rows.map((p) => {
    const { _planilhaLinha, ...rest } = p;
    return rest;
  });
}

function mergeRodadaPayload(existing, titulosEntry, parcEntry) {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? structuredClone(existing)
      : {};
  const { titulos: _titulosExistentes, ...baseSemTitulos } = base;
  const merged = { ...defaultRodadaPayload(), ...baseSemTitulos };

  if (titulosEntry?.titulos?.length) {
    merged.titulos = sanitizarTitulosParaApi(compactarTitulosImport(titulosEntry.titulos));
  } else if (Array.isArray(_titulosExistentes)) {
    merged.titulos = _titulosExistentes;
  }

  if (parcEntry?.parcelas?.length) {
    const parcelas = sanitizarParcelasParaApi(parcEntry.parcelas);
    parcelas.sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));
    merged.parcelas = parcelas;
    merged.parcelamentoAceito = true;
    const nums = parcelas.map((p) => p.numero).filter((n) => n != null && Number.isFinite(Number(n)));
    const maxP = nums.length ? Math.max(...nums.map(Number)) : 0;
    if (maxP > 0) merged.quantidadeParcelasInformada = String(maxP).padStart(2, '0');
  }

  if (!Array.isArray(merged.debitos)) merged.debitos = [];
  return merged;
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

    let res;
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
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
      fim = body.last === true || list.length < PAGE_SIZE_MAPA_PROCESSOS;
    } else {
      throw new Error('GET processos: resposta inválida (Page ou array esperado)');
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
  console.log(`[layout2026] mapa processos cliente ${codigoCliente8}: ${map.size} entradas`);
  return map;
}

/**
 * @returns {Promise<number | null>}
 */
async function garantirProcessoId(token, baseUrl, cod8, numeroInterno, clientePorCod8, criarStub, stats) {
  let map = await obterMapaProcessoId(token, baseUrl, cod8);
  let procId = map.get(numeroInterno);
  if (procId != null) return procId;
  if (!criarStub) return null;

  const garantido = await garantirProcessoNaApi(baseUrl, token, cod8, numeroInterno, clientePorCod8);
  if (garantido.ok && garantido.processo?.id != null) {
    procId = Number(garantido.processo.id);
    if (garantido.criado) stats.processosCriados++;
    map.set(numeroInterno, procId);
    return procId;
  }
  if (!garantido.ok && /duplicate|j[aá]\s*existe/i.test(garantido.erro ?? '')) {
    cachesMapaPorCliente.delete(cod8);
    map = await obterMapaProcessoId(token, baseUrl, cod8);
    return map.get(numeroInterno) ?? null;
  }
  console.warn(
    `[layout2026] falha criar processo cod=${cod8} ni=${numeroInterno}: ${garantido.erro ?? 'erro'}`
  );
  return null;
}

async function getRodada(baseUrl, token, cod8, proc, dim) {
  const url = `${baseUrl}/api/calculos/rodadas/${cod8}/${proc}/${dim}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GET rodada ${cod8}/${proc}/${dim} ${res.status}: ${t.slice(0, 300)}`);
  }
  return res.json();
}

async function putRodada(baseUrl, token, cod8, proc, dim, payload) {
  const url = `${baseUrl}/api/calculos/rodadas/${cod8}/${proc}/${dim}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const txt = await res.text();
  if (res.ok) return { ok: true };
  return { ok: false, status: res.status, text: txt.slice(0, 400) };
}

async function postPagamento(baseUrl, token, body) {
  const res = await fetch(`${baseUrl}/api/pagamentos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (res.ok) {
    try {
      return { ok: true, id: Number(JSON.parse(txt).id) };
    } catch {
      return { ok: true };
    }
  }
  return { ok: false, status: res.status, text: txt.slice(0, 400) };
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

function normalizarCodigoClienteFiltro(raw) {
  if (raw == null || raw === '') return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) return null;
  return String(n).padStart(8, '0');
}

async function mainAsync(opts, trabalhos) {
  if (opts.dryRun) {
    console.log(`[layout2026] dry-run: ${trabalhos.length} rodadas (sem chamadas HTTP).`);
    return;
  }

  const token = await login(opts);
  /** @type {Map<string, number>} */
  const clientePorCod8 = new Map();
  const stats = {
    rodadasOk: 0,
    rodadasFalha: 0,
    pagamentosOk: 0,
    pagamentosFalha: 0,
    pagamentosIgnorados: 0,
    processosCriados: 0,
  };

  await runPool(trabalhos, opts.concurrency, async (job) => {
    const { cod8, numeroProcesso, dimensao, titulosEntry, parcEntry } = job;
    try {
      const processoId = await garantirProcessoId(
        token,
        opts.baseUrl,
        cod8,
        numeroProcesso,
        clientePorCod8,
        opts.criarProcessos,
        stats
      );
      if (processoId == null) {
        console.warn(`[layout2026] sem processoId para ${cod8}|${numeroProcesso}|${dimensao} — rodada será gravada mesmo assim (pagamentos podem ficar sem vínculo ao processo).`);
      }

      const existing = await getRodada(opts.baseUrl, token, cod8, numeroProcesso, dimensao);
      const payload = mergeRodadaPayload(existing, titulosEntry, parcEntry);

      const put = await putRodada(opts.baseUrl, token, cod8, numeroProcesso, dimensao, payload);
      if (!put.ok) {
        stats.rodadasFalha++;
        console.warn(`[layout2026] PUT rodada ${cod8}|${numeroProcesso}|${dimensao}: ${put.status} ${put.text}`);
        return;
      }
      stats.rodadasOk++;

      if (opts.skipPagamentos || !parcEntry?.parcelas?.length) return;

      const clienteCtx = await resolverClienteFromApi(opts.baseUrl, token, cod8, clientePorCod8);
      if (!clienteCtx?.clientePk) {
        console.warn(`[layout2026] POST pagamentos omitidos — sem cliente PK para cod=${cod8}`);
        return;
      }
      const clientePk = clienteCtx.clientePk;
      if (processoId == null) {
        console.warn(
          `[layout2026] POST pagamentos omitidos para ${cod8}|${numeroProcesso}|${dimensao} — sem processoId (use --sem-criar-processos só se já existir processo na API).`
        );
        return;
      }

      for (const raw of parcEntry.parcelas) {
        const dataPgto = raw.dataPagamento;
        if (!dataPgto) {
          stats.pagamentosIgnorados++;
          continue;
        }
        const valor = raw.valorParcela;
        if (valor == null || !Number.isFinite(Number(valor)) || Number(valor) < 0.01) {
          console.warn(
            `[layout2026] parcela ${raw.numero} linha ${raw._planilhaLinha}: valor inválido para pagamento — ignorado`
          );
          stats.pagamentosIgnorados++;
          continue;
        }
        const dataVenc = raw.dataVencimento || dataPgto;
        const obsParts = [`Import layout2026`, `parcela ${raw.numero}`, `planilha L${raw._planilhaLinha ?? '?'}`];
        if (raw.observacao) obsParts.push(String(raw.observacao));

        const body = {
          dataVencimento: dataVenc,
          valor: Number(valor),
          clienteId: clientePk,
          processoId,
          dataPagamentoEfetivo: dataPgto,
          status: 'PAGO_SEM_COMPROVANTE',
          observacoes: obsParts.join(' · '),
          origem: 'IMPORT_CALCULO_LAYOUT2026',
        };

        const pr = await postPagamento(opts.baseUrl, token, body);
        if (pr.ok) stats.pagamentosOk++;
        else {
          stats.pagamentosFalha++;
          console.warn(`[layout2026] POST pagamento parcela ${raw.numero}: ${pr.status} ${pr.text}`);
        }
      }
    } catch (e) {
      stats.rodadasFalha++;
      console.warn(`[layout2026] ${cod8}|${numeroProcesso}|${dimensao}: ${String(e?.message ?? e)}`);
    }
  });

  console.log(
    `[layout2026] rodadas_ok=${stats.rodadasOk} rodadas_falha=${stats.rodadasFalha} processos_criados=${stats.processosCriados} pagamentos_ok=${stats.pagamentosOk} pagamentos_falha=${stats.pagamentosFalha} linhas_parcela_sem_pagamento_ou_invalidas=${stats.pagamentosIgnorados}`
  );
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const abs = resolveImportCalculoXlsPath(opts.file);
  if (!abs) {
    console.error('[layout2026] import-calculo.xls não encontrado. Tentados:');
    for (const p of candidatosImportCalculoXlsParaLog(opts.file)) console.error(' ', p);
    console.error('Passe o caminho como primeiro argumento ou defina VILAREAL_IMPORT_CALCULO_XLS.');
    process.exit(1);
  }
  console.log(`[layout2026] planilha: ${abs}`);

  let codigoClienteFiltro = null;
  if (opts.codigoCliente) {
    codigoClienteFiltro = normalizarCodigoClienteFiltro(opts.codigoCliente);
    if (!codigoClienteFiltro) {
      console.error('[layout2026] --codigo-cliente inválido');
      process.exit(1);
    }
    console.log(`[layout2026] filtro codigo_cliente=${codigoClienteFiltro}`);
  }

  if (!opts.dryRun && !opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=… (como nos outros scripts de import; ou use --dry-run).');
    process.exit(1);
  }

  const wb = XLSX.readFile(abs, { cellDates: true, raw: true });
  const layoutOpts = buildLayout2026WorkbookParseOpts(opts);
  const parsed = parseLayout2026FromWorkbook(wb, layoutOpts);
  if (parsed.layoutLinhas?.aba1) {
    const m = parsed.layoutLinhas.aba1;
    console.log(
      `[layout2026] aba débitos: cabeçalho L${m.header1Based}, dados L${m.data1Based}${m.inferred === false ? '' : ` (inferido${m.score != null ? `, score=${m.score}` : ''})`}`
    );
  }
  if (parsed.layoutLinhas?.aba2) {
    const m = parsed.layoutLinhas.aba2;
    console.log(
      `[layout2026] aba relatório: cabeçalho L${m.header1Based}, dados L${m.data1Based}${m.inferred === false ? '' : ` (inferido${m.score != null ? `, score=${m.score}` : ''})`}`
    );
  }

  let { titulosPorChave, parcelamentoPorChave } = parsed;
  if (codigoClienteFiltro) {
    titulosPorChave = filtrarTitulosPorCodigo(titulosPorChave, codigoClienteFiltro);
    parcelamentoPorChave = filtrarParcelamentoPorCodigo(parcelamentoPorChave, codigoClienteFiltro);
  }

  const keys = new Set([...Object.keys(titulosPorChave), ...Object.keys(parcelamentoPorChave)]);
  const sortedKeys = [...keys].sort();

  /** @type {{ cod8: string, numeroProcesso: number, dimensao: number, titulosEntry: object | null, parcEntry: object | null }[]} */
  const trabalhos = [];
  for (const key of sortedKeys) {
    const [cod8, procS, dimS] = key.split('|');
    trabalhos.push({
      cod8,
      numeroProcesso: Number(procS),
      dimensao: Number(dimS),
      titulosEntry: titulosPorChave[key] ?? null,
      parcEntry: parcelamentoPorChave[key] ?? null,
    });
  }

  console.log(`[layout2026] chaves a processar: ${trabalhos.length} (filtro cliente=${codigoClienteFiltro ?? 'nenhum'})`);

  if (opts.dryRun) {
    const sampleKey = sortedKeys[0];
    if (sampleKey) {
      const tit = titulosPorChave[sampleKey];
      const parc = parcelamentoPorChave[sampleKey];
      const fake = mergeRodadaPayload(null, tit, parc);
      console.log('\n--- Amostra merge (primeira chave; sem GET da API) ---\n');
      console.log(JSON.stringify(fake, null, 2));
    } else {
      console.log('\n[layout2026] dry-run: nenhuma chave após filtros.');
    }
    mainAsync(opts, trabalhos).catch((e) => {
      console.error(e);
      process.exit(1);
    });
    return;
  }

  mainAsync(opts, trabalhos).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

main();
