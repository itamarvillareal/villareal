#!/usr/bin/env node
/**
 * Atualiza andamentos já existentes na API a partir dos txt locais (Dropbox).
 *
 * Diferente de `import-historico-local-txt.mjs --apenas-novos` (só POST se não existir):
 * aqui faz **PUT** quando a chave data+título já existe mas título/detalhe/data divergem do txt.
 *
 * Uso:
 *   node scripts/atualizar-historico-local-txt.mjs --cliente=257 --processo=37 --aplicar
 *   node scripts/atualizar-historico-local-txt.mjs --cliente=728 --processo-min=40 --processo-max=50 --dry-run
 *   node scripts/atualizar-historico-local-txt.mjs --cliente=257 --processo=37 --criar-faltantes --aplicar
 *
 * Opções:
 *   --cliente=N              Obrigatório (salvo --cliente-min/max com lista explícita)
 *   --processo=N             Só um nº interno
 *   --processo-min= --processo-max=
 *   --indice=N               Só entrada de histórico com índice N (debug)
 *   --aplicar                Executa PUT/POST (sem isto: dry-run)
 *   --dry-run                Só relatório (defeito se --aplicar omitido)
 *   --criar-faltantes        POST para entradas txt sem correspondência na API
 *   --base=PATH              Raiz «Banco de Dados»
 *   --login= --senha=
 *
 * Envs: VILAREAL_API_BASE, VILAREAL_IMPORT_SENHA (ver load-vilareal-import-env.mjs)
 */

import './lib/load-vilareal-import-env.mjs';

import process from 'node:process';
import { DEFAULT_BASE_HISTORICO_LOCAL } from './lib/historico-local-txt-paths.mjs';
import { coletarEntradasHistoricoLocal } from './lib/historico-local-txt-iterar.mjs';
import { movimentoEmFromHistoricoLocal } from './lib/historico-movimento-em.mjs';
import { normalizarResponsavelHistorico, resetAvisosResponsavel } from './lib/historico-responsavel-import.mjs';
import { normalizarTextoPlanilha } from './lib/normalizar-texto-planilha.mjs';
import {
  chaveAndamentoEstrita,
  chaveDetalheParaDedupe,
  chaveMovimentoEmParaDedupe,
  chaveTituloParaDedupe,
} from './lib/chaves-dedupe-andamento.mjs';
import { buscarProcesso } from './lib/vilareal-import-processo-api.mjs';

const ORIGEM_PADRAO = 'IMPORT_TXT_LOCAL';

function parseArgs(argv) {
  const out = {
    base: DEFAULT_BASE_HISTORICO_LOCAL,
    cliente: null,
    processo: null,
    processoMin: null,
    processoMax: null,
    indice: null,
    aplicar: false,
    criarFaltantes: false,
    somenteSemData: false,
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    origem: (process.env.VILAREAL_IMPORT_ORIGEM || '').trim() || ORIGEM_PADRAO,
  };
  for (const a of argv) {
    if (a === '--aplicar') out.aplicar = true;
    else if (a === '--dry-run') out.aplicar = false;
    else if (a === '--criar-faltantes') out.criarFaltantes = true;
    else if (a === '--somente-sem-data') out.somenteSemData = true;
    else if (a.startsWith('--base=')) out.base = a.slice(7);
    else if (a.startsWith('--cliente=')) {
      const n = Number(a.slice(10));
      if (Number.isFinite(n) && n >= 1) out.cliente = Math.trunc(n);
    } else if (a.startsWith('--processo=')) {
      const n = Number(a.slice(11));
      if (Number.isFinite(n) && n >= 1) out.processo = Math.trunc(n);
    } else if (a.startsWith('--processo-min=')) {
      const n = Number(a.slice(15));
      if (Number.isFinite(n) && n >= 1) out.processoMin = Math.trunc(n);
    } else if (a.startsWith('--processo-max=')) {
      const n = Number(a.slice(15));
      if (Number.isFinite(n) && n >= 1) out.processoMax = Math.trunc(n);
    } else if (a.startsWith('--indice=')) {
      const n = Number(a.slice(9));
      if (Number.isFinite(n) && n >= 1) out.indice = Math.trunc(n);
    } else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--origem=')) out.origem = a.slice(9).trim() || ORIGEM_PADRAO;
  }
  return out;
}

function cod8(n) {
  return String(Math.trunc(n)).padStart(8, '0');
}

async function login(opts) {
  const loginNorm = String(opts.login).trim().toLowerCase();
  const r = await fetch(`${opts.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: loginNorm, senha: opts.senha }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Falha no login ${r.status}: ${t.slice(0, 400)}`);
  }
  const json = await r.json();
  if (!json.accessToken) throw new Error('Resposta de login sem accessToken');
  return json.accessToken;
}

/** @param {import('./lib/historico-local-txt-iterar.mjs').EntradaHistoricoLocal} e */
function payloadFromEntrada(e) {
  let titulo = normalizarTextoPlanilha(e.informacao);
  if (!titulo.trim()) titulo = 'Andamento';
  const titulo500 = titulo.length > 500 ? titulo.slice(0, 500) : titulo;
  const movimentoEm = movimentoEmFromHistoricoLocal(
    e.dataBruta,
    e.yyyyPasta,
    e.mmPasta,
    e.infoArquivoAbs
  );
  const ref = `${e.codigoCliente8}/proc${e.numeroInterno}/idx${e.indice}`;
  const detalhe = normalizarResponsavelHistorico(e.usuarioBruto, ref);
  return {
    indice: e.indice,
    numeroInterno: e.numeroInterno,
    codigoCliente8: e.codigoCliente8,
    movimentoEm,
    titulo: titulo500,
    detalhe,
    semDataTxt: !String(e.dataBruta ?? '').trim(),
    infoArquivoAbs: e.infoArquivoAbs ?? null,
  };
}

/** Título na API pode estar truncado (500) — aceita prefixo normalizado. */
function titulosHistoricoCompativeis(apiTitulo, txtTitulo) {
  const a = chaveTituloParaDedupe(apiTitulo);
  const t = chaveTituloParaDedupe(txtTitulo);
  if (!a || !t) return false;
  if (a === t) return true;
  const min = Math.min(a.length, t.length);
  if (min < 40) return a === t;
  return a.startsWith(t.slice(0, min)) || t.startsWith(a.slice(0, min));
}

/** @param {Map<string, object[]>} porChave @param {object[]} apiList @param {ReturnType<typeof payloadFromEntrada>} txt */
function buscarCandidatosApi(porChave, apiList, txt) {
  const chave = chaveAndamentoEstrita(txt.movimentoEm, txt.titulo);
  const porChaveHit = porChave.get(chave) ?? [];
  if (porChaveHit.length) return porChaveHit;

  if (!txt.semDataTxt || !txt.movimentoEm) return [];

  const movCorreto = chaveMovimentoEmParaDedupe(txt.movimentoEm);

  return apiList.filter((a) => {
    if (!titulosHistoricoCompativeis(a.titulo, txt.titulo)) return false;
    return chaveMovimentoEmParaDedupe(a.movimentoEm) !== movCorreto;
  });
}

/** @param {unknown} detalhe */
function detalheChave(detalhe) {
  if (detalhe == null || String(detalhe).trim() === '') return '';
  return chaveDetalheParaDedupe(detalhe);
}

/** @param {object} api @param {ReturnType<typeof payloadFromEntrada>} txt */
function precisaAtualizar(api, txt) {
  if (chaveTituloParaDedupe(api.titulo) !== chaveTituloParaDedupe(txt.titulo)) return true;
  if (chaveMovimentoEmParaDedupe(api.movimentoEm) !== chaveMovimentoEmParaDedupe(txt.movimentoEm)) {
    return true;
  }
  if (detalheChave(api.detalhe) !== detalheChave(txt.detalhe)) return true;
  return false;
}

/**
 * Vários POSTs com a mesma chave data+título: escolhe o registo que ainda difere do txt.
 * Se vários estiverem desatualizados, actualiza o de menor id (mais antigo).
 * @param {object[]} candidatos
 * @param {ReturnType<typeof payloadFromEntrada>} txt
 */
function escolherCandidato(candidatos, txt) {
  if (candidatos.length === 0) return null;
  if (candidatos.length === 1) return candidatos[0];
  const desatualizados = candidatos.filter((api) => precisaAtualizar(api, txt));
  if (desatualizados.length >= 1) {
    return desatualizados.sort((a, b) => Number(a.id) - Number(b.id))[0];
  }
  return candidatos[0];
}

/**
 * @param {object[]} list
 * @returns {Map<string, object[]>}
 */
function indexarPorChave(list) {
  /** @type {Map<string, object[]>} */
  const m = new Map();
  for (const x of list) {
    const tit = String(x?.titulo ?? '').trim() || 'Andamento';
    const chave = chaveAndamentoEstrita(x?.movimentoEm, tit);
    if (!m.has(chave)) m.set(chave, []);
    m.get(chave).push(x);
  }
  return m;
}

async function listarAndamentos(baseUrl, token, processoId) {
  const r = await fetch(`${baseUrl}/api/processos/${processoId}/andamentos`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`GET andamentos proc ${processoId}: ${r.status} ${t.slice(0, 300)}`);
  }
  const list = await r.json();
  return Array.isArray(list) ? list : [];
}

/** @param {object} api @param {ReturnType<typeof payloadFromEntrada>} txt @param {string} origemPadrao */
function buildWriteBody(api, txt, origemPadrao) {
  return {
    movimentoEm: txt.movimentoEm,
    titulo: txt.titulo,
    detalhe: txt.detalhe,
    origem: api.origem ?? origemPadrao,
    origemAutomatica: api.origemAutomatica ?? false,
    usuarioId: api.usuarioId ?? null,
  };
}

async function putAndamento(baseUrl, token, processoId, andamentoId, body) {
  const url = `${baseUrl}/api/processos/${processoId}/andamentos/${andamentoId}`;
  const r = await fetch(url, {
    method: 'PUT',
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

async function postAndamento(baseUrl, token, processoId, body, origem) {
  const payload = { ...body, origem, origemAutomatica: false, usuarioId: null };
  const r = await fetch(`${baseUrl}/api/processos/${processoId}/andamentos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const t = await r.text();
    return { ok: false, status: r.status, text: t };
  }
  return { ok: true };
}

/**
 * @param {ReturnType<typeof parseArgs>} opts
 * @param {string} token
 * @param {string} cod
 * @param {number} numeroInterno
 * @param {ReturnType<typeof payloadFromEntrada>[]} entradasProc
 */
async function sincronizarProcesso(opts, token, cod, numeroInterno, entradasProc) {
  const proc = await buscarProcesso(opts.baseUrl, token, cod, numeroInterno);
  if (!proc?.id) {
    console.warn(`[orfao] ${cod} processo ${numeroInterno} não encontrado na API`);
    return { puts: 0, posts: 0, iguais: 0, ambiguos: 0, faltantes: entradasProc.length, falhas: 0 };
  }
  const procId = Number(proc.id);
  const apiList = await listarAndamentos(opts.baseUrl, token, procId);
  const porChave = indexarPorChave(apiList);

  const stats = { puts: 0, posts: 0, iguais: 0, ambiguos: 0, faltantes: 0, falhas: 0 };

  for (const txt of entradasProc) {
    const chave = chaveAndamentoEstrita(txt.movimentoEm, txt.titulo);
    const candidatos = buscarCandidatosApi(porChave, apiList, txt);

    if (candidatos.length === 0) {
      stats.faltantes += 1;
      if (!opts.criarFaltantes) {
        console.log(
          `[faltante] proc ${numeroInterno} idx ${txt.indice} — sem andamento na API (chave ${chave.slice(0, 40)}…)`
        );
        continue;
      }
      if (!opts.aplicar) {
        console.log(`[dry-run] POST faltante proc ${numeroInterno} idx ${txt.indice}`);
        stats.posts += 1;
        continue;
      }
      const body = buildWriteBody({}, txt, opts.origem);
      const r = await postAndamento(opts.baseUrl, token, procId, body, opts.origem);
      if (r.ok) {
        stats.posts += 1;
        console.log(`[criado] proc ${numeroInterno} idx ${txt.indice}`);
      } else {
        stats.falhas += 1;
        console.warn(`[falha POST] proc ${numeroInterno} idx ${txt.indice}: ${r.status} ${(r.text || '').slice(0, 150)}`);
      }
      continue;
    }

    const api = escolherCandidato(candidatos, txt);
    if (!api) {
      stats.ambiguos += 1;
      console.warn(`[ambiguo] proc ${numeroInterno} idx ${txt.indice} — sem candidato`);
      continue;
    }
    if (candidatos.length > 1 && !precisaAtualizar(api, txt)) {
      stats.iguais += 1;
      continue;
    }
    if (candidatos.length > 1 && precisaAtualizar(api, txt)) {
      console.log(
        `[dup-api] proc ${numeroInterno} idx ${txt.indice} — ${candidatos.length} com mesma chave; actualiza id=${api.id}`
      );
    }
    if (!precisaAtualizar(api, txt)) {
      stats.iguais += 1;
      continue;
    }

    const body = buildWriteBody(api, txt, opts.origem);
    if (!opts.aplicar) {
      console.log(
        `[dry-run] PUT proc ${numeroInterno} idx ${txt.indice} andamentoId=${api.id}\n` +
          `  API movimentoEm: ${String(api.movimentoEm ?? '(null)').slice(0, 28)}\n` +
          `  txt movimentoEm: ${String(txt.movimentoEm ?? '(null)').slice(0, 28)}${txt.semDataTxt ? ' (sem data no txt → ficheiro)' : ''}\n` +
          `  ficheiro info: ${txt.infoArquivoAbs ?? '—'}\n` +
          `  API titulo: ${String(api.titulo ?? '').slice(0, 80)}\n` +
          `  txt titulo: ${String(txt.titulo ?? '').slice(0, 80)}\n` +
          `  API detalhe: ${String(api.detalhe ?? '(null)').slice(0, 80)}\n` +
          `  txt detalhe: ${String(txt.detalhe ?? '(null)').slice(0, 80)}`
      );
      stats.puts += 1;
      continue;
    }

    const r = await putAndamento(opts.baseUrl, token, procId, api.id, body);
    if (r.ok) {
      stats.puts += 1;
      console.log(`[atualizado] proc ${numeroInterno} idx ${txt.indice} andamentoId=${api.id}`);
    } else {
      stats.falhas += 1;
      console.warn(
        `[falha PUT] proc ${numeroInterno} idx ${txt.indice} id=${api.id}: ${r.status} ${(r.text || '').slice(0, 150)}`
      );
    }
  }

  return stats;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  resetAvisosResponsavel();

  if (opts.cliente == null) {
    console.error('Uso: node scripts/atualizar-historico-local-txt.mjs --cliente=N [--processo=N] [--aplicar]');
    process.exit(1);
  }
  if (!opts.senha && opts.aplicar) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=...');
    process.exit(1);
  }

  const cod = cod8(opts.cliente);
  console.log('\n=== atualizar-historico-local-txt ===\n');
  console.log(`Cliente: ${opts.cliente} (${cod})`);
  console.log(`Base: ${opts.base}`);
  console.log(`Modo: ${opts.aplicar ? 'aplicar' : 'dry-run'}`);
  if (opts.processo != null) console.log(`Processo: ${opts.processo}`);
  if (opts.processoMin != null || opts.processoMax != null) {
    console.log(`Intervalo processos: ${opts.processoMin ?? '…'} – ${opts.processoMax ?? '…'}`);
  }
  if (opts.indice != null) console.log(`Índice histórico: ${opts.indice}`);
  console.log(`Criar faltantes: ${opts.criarFaltantes ? 'sim' : 'não'}`);
  if (opts.somenteSemData) console.log('Filtro: só entradas txt sem data (correção data de criação do ficheiro)\n');
  else console.log('');

  let entradas = coletarEntradasHistoricoLocal({
    base: opts.base,
    clienteMin: opts.cliente,
    clienteMax: opts.cliente,
    filtroClienteCod: opts.cliente,
    filtroProcesso: opts.processo,
  });

  if (opts.processoMin != null) {
    entradas = entradas.filter((e) => e.numeroInterno >= opts.processoMin);
  }
  if (opts.processoMax != null) {
    entradas = entradas.filter((e) => e.numeroInterno <= opts.processoMax);
  }
  if (opts.indice != null) {
    entradas = entradas.filter((e) => e.indice === opts.indice);
  }
  if (opts.somenteSemData) {
    const antes = entradas.length;
    entradas = entradas.filter((e) => !String(e.dataBruta ?? '').trim());
    console.log(`Entradas sem data no txt: ${entradas.length} (de ${antes})`);
  }

  console.log(`Entradas txt válidas: ${entradas.length}`);
  if (entradas.length === 0) {
    console.warn('Nenhuma entrada — verifique cliente/processo/índice ou sincronização Dropbox.');
    process.exit(0);
  }

  /** @type {Map<number, ReturnType<typeof payloadFromEntrada>[]>} */
  const porProcesso = new Map();
  for (const e of entradas) {
    const p = payloadFromEntrada(e);
    if (!porProcesso.has(p.numeroInterno)) porProcesso.set(p.numeroInterno, []);
    porProcesso.get(p.numeroInterno).push(p);
  }

  let token = null;
  if (opts.aplicar || entradas.length > 0) {
    if (!opts.senha) {
      console.log('[dry-run] Sem senha: apenas listagem de entradas (sem chamadas GET à API).\n');
    } else {
      token = await login(opts);
    }
  }

  const totais = { puts: 0, posts: 0, iguais: 0, ambiguos: 0, faltantes: 0, falhas: 0 };
  const procs = [...porProcesso.keys()].sort((a, b) => a - b);

  for (const ni of procs) {
    const lista = porProcesso.get(ni) ?? [];
    console.log(`\n——— processo ${ni} (${lista.length} entrada(s) txt) ———`);
    if (!token) {
      for (const txt of lista) {
        console.log(
          `  idx ${txt.indice} | ${txt.movimentoEm?.slice(0, 10) ?? '?'} | ${String(txt.titulo).slice(0, 60)}`
        );
      }
      continue;
    }
    const s = await sincronizarProcesso(opts, token, cod, ni, lista);
    for (const k of Object.keys(totais)) totais[k] += s[k];
    console.log(
      `  resumo proc ${ni}: puts=${s.puts} posts=${s.posts} iguais=${s.iguais} ambiguos=${s.ambiguos} faltantes=${s.faltantes} falhas=${s.falhas}`
    );
  }

  console.log('\n=== concluído ===');
  console.log(
    `Processos: ${procs.length} | PUT: ${totais.puts} | POST: ${totais.posts} | iguais: ${totais.iguais} | ambíguos: ${totais.ambiguos} | faltantes: ${totais.faltantes} | falhas: ${totais.falhas}\n`
  );
  process.exit(totais.falhas > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
