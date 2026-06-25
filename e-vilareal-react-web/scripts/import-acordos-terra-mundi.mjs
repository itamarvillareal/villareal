#!/usr/bin/env node
/**
 * Importa acordos Canal Gestão (Acordos_Terra_Mundi.xlsx) → calculo_rodada na API.
 *
 * Uso:
 *   node scripts/import-acordos-terra-mundi.mjs "/caminho/Acordos_Terra_Mundi.xlsx" --dry-run
 *   node scripts/import-acordos-terra-mundi.mjs "/caminho/arquivo.xlsx" --aplicar --base-url=https://portal.villarealadvocacia.adv.br
 *
 * Requer mapa de contatos (--contatos-json= ou ~/Dropbox/tmp/contatos-unidades-terra-mundi.json).
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import {
  acordoUnidadeParaContatos,
  acordoUnidadeParaProcessoDb,
  montarPayloadDimSaldo,
  montarPayloadRodadaAcordo,
  montarTituloConsolidado,
  parseAcordosWorkbook,
  totalTituloNum,
  unidadeContatosCompacta,
  valorNumerico,
} from './lib/import-acordos-terra-mundi-parse.mjs';
import {
  buscarProcesso,
  loginImportApi,
  resolverClienteFromApi,
} from './lib/vilareal-import-processo-api.mjs';
import {
  garantirPartesCobrancaCondominio,
} from './lib/processo-partes-cobranca-condominio.mjs';

const COD8 = '00000299';
const DEFAULT_CONTATOS = path.join(os.homedir(), 'Dropbox/tmp/contatos-unidades-terra-mundi.json');
const DEFAULT_RELATORIO = path.join(os.homedir(), 'Dropbox/tmp/acordos-299-diagnostico');

function parseArgs(argv) {
  const out = {
    arquivo: null,
    dryRun: true,
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'https://portal.villarealadvocacia.adv.br').replace(
      /\/$/,
      ''
    ),
    contatosJson: DEFAULT_CONTATOS,
    relatorio: DEFAULT_RELATORIO,
  };
  for (const a of argv) {
    if (a === '--aplicar') out.dryRun = false;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--contatos-json=')) out.contatosJson = a.slice(16);
    else if (a.startsWith('--relatorio=')) out.relatorio = a.slice(12);
    else if (!a.startsWith('-') && !out.arquivo) out.arquivo = a;
  }
  return out;
}

function loadContatosMap(abs) {
  const raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
  /** @type {Map<string, { pessoaId: number, nome: string, doc: string, unidade: string }>} */
  const byCompact = new Map();
  for (const row of raw.mapaUnidades ?? []) {
    const key = unidadeContatosCompacta(row.unidadeCompacta ?? row.unidade);
    if (!key) continue;
    byCompact.set(key, {
      pessoaId: Number(row.pessoaId),
      nome: String(row.nome ?? ''),
      doc: String(row.doc ?? ''),
      unidade: String(row.unidade ?? ''),
    });
  }
  return { byCompact, stats: raw.stats ?? {} };
}

function acordoParaChaveContatos(unidadeAcordo) {
  const contatos = acordoUnidadeParaContatos(unidadeAcordo);
  return unidadeContatosCompacta(contatos);
}

function csvEscape(s) {
  const t = String(s ?? '');
  if (/[",\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

async function fetchJson(url, token, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${url} → ${res.status}: ${txt.slice(0, 300)}`);
  return txt ? JSON.parse(txt) : null;
}

async function listarProcessosCliente(baseUrl, token, cod8) {
  /** @type {object[]} */
  const all = [];
  for (let page = 0; page < 50; page += 1) {
    const params = new URLSearchParams({
      codigoCliente: cod8,
      page: String(page),
      size: '100',
    });
    const body = await fetchJson(`${baseUrl}/api/processos?${params}`, token);
    const list = Array.isArray(body) ? body : (body?.content ?? []);
    all.push(...list);
    if (Array.isArray(body) || body?.last === true || list.length < 100) break;
  }
  return all;
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

async function criarProcessoAcordo(
  baseUrl,
  token,
  cod8,
  numeroInterno,
  unidadeDb,
  devedorPessoaId,
  clienteCache
) {
  const resolved = await resolverClienteFromApi(baseUrl, token, cod8, clienteCache);
  if (!resolved) return { ok: false, text: 'cliente não resolvido' };

  /** Titular = condomínio (pessoa do cliente); devedor entra só em processo_parte REU. */
  const body = {
    clienteId: resolved.clientePk,
    numeroInterno: Math.trunc(numeroInterno),
    ativo: true,
    consultaAutomatica: false,
    unidade: unidadeDb,
    descricaoAcao: `Processo importado — acordo ${unidadeDb}`,
  };

  const res = await fetch(`${baseUrl}/api/processos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (res.status !== 201 && res.status !== 200 && !(res.status === 422 && /j[aá]\s*existe/i.test(txt))) {
    return { ok: false, status: res.status, text: txt.slice(0, 300) };
  }

  const proc = await buscarProcesso(baseUrl, token, cod8, numeroInterno, clienteCache);
  if (!proc?.id) return { ok: false, text: 'processo criado mas não encontrado após POST' };

  const partes = await garantirPartesCobrancaCondominio(
    baseUrl,
    token,
    Number(proc.id),
    resolved.pessoaId,
    devedorPessoaId
  );
  if (partes.falhas > 0) {
    return { ok: false, text: 'processo criado mas falha ao cadastrar partes' };
  }
  return { ok: true, duplicate: res.status === 422 };
}

function proximoNumeroInterno(processos, reservados) {
  const usados = new Set(
    [...processos.map((p) => Number(p.numeroInterno)), ...reservados].filter(
      (n) => Number.isFinite(n) && n >= 0
    )
  );
  // Preferir lacunas na faixa «normal» (evita pular para stubs legados tipo 1474).
  for (let ni = 25; ni <= 500; ni += 1) {
    if (!usados.has(ni)) return ni;
  }
  let max = 0;
  for (const ni of usados) {
    if (ni > max) max = ni;
  }
  return max + 1;
}

function normUnidadeDb(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function buildMapsProcessos(processos) {
  /** @type {Map<string, object>} */
  const byUnidade = new Map();
  /** @type {Map<number, object>} */
  const byNi = new Map();
  for (const p of processos) {
    const ni = Number(p.numeroInterno);
    if (Number.isFinite(ni)) byNi.set(ni, p);
    const u = normUnidadeDb(p.unidade);
    if (u) byUnidade.set(u, p);
  }
  return { byUnidade, byNi };
}

function acordoJaConsolidado(rodada, valorAcordo) {
  if (!rodada?.parcelamentoAceito) return false;
  const titulos = rodada.titulos ?? [];
  if (titulos.length !== 1) return false;
  return Math.abs(totalTituloNum(titulos[0]) - (valorAcordo ?? 0)) <= 0.05;
}

/** Rodada existente corresponde a outro acordo (por valor total)? */
function rodadaCorrespondeAcordo(rodada, acordo) {
  if (!rodada || acordo?.valorAcordo == null) return false;
  const titulos = rodada.titulos ?? [];
  if (titulos.length === 1) {
    return Math.abs(totalTituloNum(titulos[0]) - acordo.valorAcordo) <= 0.05;
  }
  return false;
}

/**
 * Se dim alvo já guarda acordo posterior, desloca rodadas existentes +1.
 * @param {object[]} acordosUnidade ordenados por cod
 * @param {number} dimAlvo
 * @param {object} acordoAtual
 * @param {(dim: number) => Promise<object|null>} getRodadaFn
 */
async function realocarDimsSeNecessario(baseUrl, token, cod8, procNi, acordosUnidade, dimAlvo, acordoAtual, getRodadaFn) {
  const rodadaNaDim = await getRodadaFn(dimAlvo);
  if (!rodadaNaDim?.titulos?.length) return { avisos: [] };

  const idxAtual = acordosUnidade.findIndex((a) => a.cod === acordoAtual.cod);
  /** @type {string[]} */
  const avisos = [];

  for (let j = idxAtual + 1; j < acordosUnidade.length; j += 1) {
    const acordoPost = acordosUnidade[j];
    if (!rodadaCorrespondeAcordo(rodadaNaDim, acordoPost)) continue;

    avisos.push(
      `dim ${dimAlvo} contém acordo ${acordoPost.cod} (R$ ${acordoPost.valorAcordo}) — realocar para dim ${dimAlvo + 1}`
    );

    const dimsOcupadas = [];
    for (let d = dimAlvo; d < dimAlvo + 8; d += 1) {
      const r = await getRodadaFn(d);
      if (r?.titulos?.length) dimsOcupadas.push({ dim: d, payload: r });
      else break;
    }
    for (let k = dimsOcupadas.length - 1; k >= 0; k -= 1) {
      const { dim, payload } = dimsOcupadas[k];
      const dest = dim + 1;
      const put = await putRodada(baseUrl, token, cod8, procNi, dest, payload);
      if (!put.ok) {
        avisos.push(`FALHA realocar dim ${dim}→${dest}: ${put.status}`);
      }
    }
    break;
  }
  return { avisos };
}

async function mainAsync() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.arquivo) {
    console.error(
      'Uso: node scripts/import-acordos-terra-mundi.mjs "/caminho/Acordos_Terra_Mundi.xlsx" [--dry-run|--aplicar]'
    );
    process.exit(1);
  }
  if (!fs.existsSync(opts.arquivo)) {
    console.error(`Arquivo não encontrado: ${opts.arquivo}`);
    process.exit(1);
  }
  if (!fs.existsSync(opts.contatosJson)) {
    console.error(`Mapa de contatos não encontrado: ${opts.contatosJson}`);
    process.exit(1);
  }

  const { acordos, composicao, parcelas } = parseAcordosWorkbook(opts.arquivo);
  const contatos = loadContatosMap(opts.contatosJson);

  /** @type {object[]} */
  const listaAcordos = [...acordos.values()].sort((a, b) => a.cod - b.cod);
  console.log(`[acordos-299] ${listaAcordos.length} acordos ativos na planilha`);

  /** @type {Map<string, object[]>} */
  const acordosPorUnidadeDb = new Map();
  for (const ac of listaAcordos) {
    const udb = acordoUnidadeParaProcessoDb(ac.unidade);
    if (!udb) continue;
    if (!acordosPorUnidadeDb.has(udb)) acordosPorUnidadeDb.set(udb, []);
    acordosPorUnidadeDb.get(udb).push(ac);
  }

  let token = null;
  /** @type {object[]} */
  let processos = [];
  /** @type {Map<string, { clientePk: number, pessoaId: number }>} */
  const clienteCache = new Map();

  const precisaApi = !opts.dryRun || Boolean(opts.senha);
  if (precisaApi) {
    if (!opts.senha) {
      console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=');
      process.exit(1);
    }
    token = await loginImportApi(opts.baseUrl, opts.login, opts.senha);
    processos = await listarProcessosCliente(opts.baseUrl, token, COD8);
    console.log(`[acordos-299] API: ${processos.length} processos do cliente ${COD8}`);
  } else {
    console.warn(
      '[acordos-299] dry-run sem senha — números de processo serão estimados (todos como novos).'
    );
  }

  let { byUnidade, byNi } = buildMapsProcessos(processos);
  /** @type {Set<number>} */
  const niReservados = new Set();
  /** @type {object[]} */
  const diagnostico = [];

  const stats = {
    ok: 0,
    skip: 0,
    erro: 0,
    processosCriar: 0,
    rodadasPut: 0,
    saldoDim: 0,
  };

  for (const ac of listaAcordos) {
    const unidadeDb = acordoUnidadeParaProcessoDb(ac.unidade);
    const chaveContatos = acordoParaChaveContatos(ac.unidade);
    const contato = contatos.byCompact.get(chaveContatos);
    const comp = composicao.get(ac.cod) ?? [];
    const parc = parcelas.get(ac.cod) ?? [];

    /** @type {object} */
    const item = {
      cod: ac.cod,
      unidade: ac.unidade,
      unidadeDb,
      condominoPlanilha: ac.condomino,
      pessoaId: contato?.pessoaId ?? null,
      pessoaNome: contato?.nome ?? null,
      doc: contato?.doc ?? null,
      valorAcordo: ac.valorAcordo,
      honorarios: ac.honorarios,
      qtdParcelas: ac.qtdParcelas,
      linhasComposicao: comp.length,
      linhasParcelas: parc.length,
      acao: null,
      proc: null,
      dim: null,
      dimSaldo: null,
      avisos: [],
      erros: [],
    };

    if (!unidadeDb) {
      item.erros.push('unidade inválida');
      stats.erro++;
      diagnostico.push(item);
      continue;
    }
    if (!contato?.pessoaId) {
      item.erros.push(`sem pessoa no mapa de contatos (${chaveContatos})`);
      stats.erro++;
      diagnostico.push(item);
      continue;
    }
    if (!comp.length) {
      item.erros.push('composição vazia');
      stats.erro++;
      diagnostico.push(item);
      continue;
    }
    if (!parc.length) {
      item.erros.push('parcelas vazias');
      stats.erro++;
      diagnostico.push(item);
      continue;
    }

    const somaComp = comp.reduce((s, l) => s + l.valor, 0);
    if (ac.valorAcordo != null && Math.abs(somaComp - ac.valorAcordo) > 0.1) {
      item.avisos.push(`soma composição (${somaComp.toFixed(2)}) ≠ valor acordo (${ac.valorAcordo})`);
    }

    let proc = byUnidade.get(normUnidadeDb(unidadeDb));
    let procNi = proc ? Number(proc.numeroInterno) : null;

    if (!procNi) {
      procNi = proximoNumeroInterno(processos, niReservados);
      while (byNi.has(procNi) || niReservados.has(procNi)) {
        procNi += 1;
      }
      niReservados.add(procNi);
      item.acao = 'criar_processo';
      item.proc = procNi;
      stats.processosCriar++;
    } else {
      item.proc = procNi;
    }

    const acordosMesmaUnidade = acordosPorUnidadeDb.get(unidadeDb) ?? [ac];
    const idxDim = acordosMesmaUnidade.findIndex((x) => x.cod === ac.cod);
    item.dim = idxDim >= 0 ? idxDim : 0;

    const getRodadaProc = (dim) => getRodada(opts.baseUrl, token, COD8, procNi, dim);

    if (opts.dryRun) {
      if (token && procNi) {
        const rodadaExistente = await getRodadaProc(item.dim);
        if (acordoJaConsolidado(rodadaExistente, ac.valorAcordo)) {
          item.acao = 'skip_ja_consolidado';
          stats.skip++;
          diagnostico.push(item);
          continue;
        }
        for (let j = idxDim + 1; j < acordosMesmaUnidade.length; j += 1) {
          if (rodadaCorrespondeAcordo(rodadaExistente, acordosMesmaUnidade[j])) {
            item.avisos.push(
              `dim ${item.dim} contém acordo ${acordosMesmaUnidade[j].cod} — será realocado para dim ${item.dim + 1} antes do PUT`
            );
            break;
          }
        }
        const { parcial, saldoTitulos } = montarPayloadRodadaAcordo(ac, comp, parc, rodadaExistente);
        if (parcial && saldoTitulos.length) {
          item.dimSaldo = item.dim + 1;
          item.avisos.push(`split parcial → ${saldoTitulos.length} título(s) na dim ${item.dimSaldo}`);
          stats.saldoDim++;
        }
        if (proc?.unidade && normUnidadeDb(proc.unidade) !== normUnidadeDb(unidadeDb)) {
          item.avisos.push(`proc ${procNi} unidade DB «${proc.unidade}» ≠ «${unidadeDb}»`);
        }
      }
      item.acao = item.acao ?? (item.dimSaldo != null ? 'put_rodada_split' : 'put_rodada');
      stats.ok++;
      diagnostico.push(item);
      continue;
    }

    const realoc = await realocarDimsSeNecessario(
      opts.baseUrl,
      token,
      COD8,
      procNi,
      acordosMesmaUnidade,
      item.dim,
      ac,
      getRodadaProc
    );
    item.avisos.push(...realoc.avisos);

    if (item.acao === 'criar_processo') {
      const r = await criarProcessoAcordo(
        opts.baseUrl,
        token,
        COD8,
        procNi,
        unidadeDb,
        contato.pessoaId,
        clienteCache
      );
      if (!r.ok) {
        item.erros.push(`POST processo: ${r.text ?? r.status}`);
        stats.erro++;
        diagnostico.push(item);
        continue;
      }
      processos = await listarProcessosCliente(opts.baseUrl, token, COD8);
      ({ byUnidade, byNi } = buildMapsProcessos(processos));
      proc = byNi.get(procNi);
    }

    const rodadaExistente = await getRodadaProc(item.dim);

    if (acordoJaConsolidado(rodadaExistente, ac.valorAcordo)) {
      item.acao = 'skip_ja_consolidado';
      stats.skip++;
      diagnostico.push(item);
      continue;
    }

    const { payload, parcial, saldoTitulos } = montarPayloadRodadaAcordo(
      ac,
      comp,
      parc,
      rodadaExistente
    );

    if (parcial && saldoTitulos.length) {
      item.dimSaldo = item.dim + 1;
      item.avisos.push(`split parcial → ${saldoTitulos.length} título(s) na dim ${item.dimSaldo}`);
    }

    const put = await putRodada(opts.baseUrl, token, COD8, procNi, item.dim, payload);
    if (!put.ok) {
      item.erros.push(`PUT dim ${item.dim}: ${put.status} ${put.text}`);
      stats.erro++;
      diagnostico.push(item);
      continue;
    }
    stats.rodadasPut++;

    if (parcial && saldoTitulos.length) {
      const rodadaSaldo = await getRodadaProc(item.dimSaldo);
      const payloadSaldo = montarPayloadDimSaldo(saldoTitulos, rodadaSaldo);
      const putSaldo = await putRodada(opts.baseUrl, token, COD8, procNi, item.dimSaldo, payloadSaldo);
      if (!putSaldo.ok) {
        item.erros.push(`PUT dim saldo ${item.dimSaldo}: ${putSaldo.status} ${putSaldo.text}`);
        stats.erro++;
      } else {
        stats.saldoDim++;
      }
    }

    item.acao = parcial ? 'put_rodada_split' : 'put_rodada';
    stats.ok++;
    diagnostico.push(item);
  }

  const relBase = opts.relatorio.replace(/\.(json|csv)$/i, '');
  fs.mkdirSync(path.dirname(relBase), { recursive: true });
  const relJson = `${relBase}.json`;
  const relCsv = `${relBase}.csv`;

  const relatorio = {
    geradoEm: new Date().toISOString(),
    dryRun: opts.dryRun,
    baseUrl: opts.baseUrl,
    arquivo: opts.arquivo,
    contatosJson: opts.contatosJson,
    stats,
    itens: diagnostico,
  };
  fs.writeFileSync(relJson, JSON.stringify(relatorio, null, 2));

  const cols = [
    'cod',
    'unidade',
    'proc',
    'dim',
    'dimSaldo',
    'pessoaId',
    'valorAcordo',
    'acao',
    'avisos',
    'erros',
  ];
  const csvLines = [cols.join(',')];
  for (const it of diagnostico) {
    csvLines.push(
      cols
        .map((c) => {
          if (c === 'avisos') return csvEscape((it.avisos ?? []).join('; '));
          if (c === 'erros') return csvEscape((it.erros ?? []).join('; '));
          return csvEscape(it[c]);
        })
        .join(',')
    );
  }
  fs.writeFileSync(relCsv, `${csvLines.join('\n')}\n`);

  console.log(`[acordos-299] ${opts.dryRun ? 'DRY-RUN' : 'APLICADO'} — stats:`, stats);
  console.log(`[acordos-299] relatório: ${relJson}`);
  console.log(`[acordos-299] CSV: ${relCsv}`);

  if (stats.erro > 0) process.exit(2);
}

mainAsync().catch((err) => {
  console.error('[acordos-299] FATAL:', err?.message ?? err);
  process.exit(1);
});
