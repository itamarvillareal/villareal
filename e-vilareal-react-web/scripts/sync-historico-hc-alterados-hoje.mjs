#!/usr/bin/env node
/**
 * Sincroniza histórico na API a partir de ficheiros txt alterados hoje (ou num dia indicado)
 * na pasta HC do «Banco de Dados» (Dropbox).
 *
 * Fluxo:
 *   1. Varre `HC/` (incl. `Ano/aaaa/mm`) por `.txt` criados/modificados no dia
 *   2. Separa ficheiros tipo **14.1** (contador N) dos tipos **15/16/17** (linhas de histórico)
 *   3. Agrupa por par código cliente + processo; lê N no tipo 14
 *   4. Compara com chaves únicas (data+título) já na API (todas as origens)
 *   5. Lê índices alterados hoje (15/16/17) e, se o contador 14 mudou, 1..N
 *   6. POST só se a chave não existir; PUT se existir mas texto/data/responsável divergirem
 *
 * Uso:
 *   node scripts/sync-historico-hc-alterados-hoje.mjs
 *   node scripts/sync-historico-hc-alterados-hoje.mjs --data=2026-05-18
 *   node scripts/sync-historico-hc-alterados-hoje.mjs --aplicar
 *   node scripts/sync-historico-hc-alterados-hoje.mjs --dry-run --verbose
 *
 * Opções:
 *   --aplicar              Executa POST na API (sem isto: só relatório)
 *   --dry-run              Igual a omitir --aplicar
 *   --data=YYYY-MM-DD      Dia a considerar (defeito: hoje, fuso local)
 *   --base=PATH            Raiz «Banco de Dados»
 *   --origem=              Origem dos andamentos (defeito: IMPORT_TXT_LOCAL)
 *   --login= --senha=
 *   --verbose
 *
 * Envs: VILAREAL_API_BASE, VILAREAL_IMPORT_SENHA (ver load-vilareal-import-env.mjs)
 */

import './lib/load-vilareal-import-env.mjs';

import process from 'node:process';

import {
  chaveAndamentoEstrita,
  chaveDetalheParaDedupe,
  chaveMovimentoEmParaDedupe,
  chaveTituloParaDedupe,
} from './lib/chaves-dedupe-andamento.mjs';
import {
  DEFAULT_BASE_HISTORICO_LOCAL,
  lerMaxIndiceHistorico,
} from './lib/historico-local-txt-paths.mjs';
import { coletarEntradasHistoricoLocal } from './lib/historico-local-txt-iterar.mjs';
import {
  inicioDiaLocal,
  parseDiaArg,
  scanHistoricoHcAlteradosNoDia,
} from './lib/historico-hc-scan-alterados.mjs';
import { movimentoEmFromHistoricoLocal } from './lib/historico-movimento-em.mjs';
import { normalizarResponsavelHistorico, resetAvisosResponsavel } from './lib/historico-responsavel-import.mjs';
import { normalizarTextoPlanilha } from './lib/normalizar-texto-planilha.mjs';
import { buscarProcesso } from './lib/vilareal-import-processo-api.mjs';

const ORIGEM_PADRAO = 'IMPORT_TXT_LOCAL';

function parseArgs(argv) {
  const out = {
    base: DEFAULT_BASE_HISTORICO_LOCAL,
    aplicar: false,
    verbose: false,
    dia: inicioDiaLocal(),
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    origem: (process.env.VILAREAL_IMPORT_ORIGEM || '').trim() || ORIGEM_PADRAO,
  };
  for (const a of argv) {
    if (a === '--aplicar') out.aplicar = true;
    else if (a === '--dry-run') out.aplicar = false;
    else if (a === '--verbose' || a === '-v') out.verbose = true;
    else if (a.startsWith('--base=')) out.base = a.slice(7);
    else if (a.startsWith('--data=')) out.dia = parseDiaArg(a.slice(7));
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--origem=')) out.origem = a.slice(9).trim() || ORIGEM_PADRAO;
  }
  return out;
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
 * Correspondência frouxa: mesma data e um título é prefixo do outro (txt expandido no disco).
 * @param {ReturnType<typeof payloadFromEntrada>} txt
 * @param {object[]} apiList
 */
function candidatosPorDataEPrefixoTitulo(txt, apiList) {
  const movTxt = chaveMovimentoEmParaDedupe(txt.movimentoEm);
  const titTxt = chaveTituloParaDedupe(txt.titulo);
  if (movTxt === '_null_' || movTxt === '_invalid_') return [];
  return apiList.filter((api) => {
    if (chaveMovimentoEmParaDedupe(api.movimentoEm) !== movTxt) return false;
    const titApi = chaveTituloParaDedupe(api.titulo);
    if (!titApi || !titTxt) return false;
    return titTxt.startsWith(titApi) || titApi.startsWith(titTxt);
  });
}

/**
 * @param {ReturnType<typeof payloadFromEntrada>} txt
 * @param {Map<string, object[]>} porChave
 * @param {object[]} apiList
 */
function resolverCandidatos(txt, porChave, apiList) {
  const strict = porChave.get(txt.chave) ?? [];
  if (strict.length > 0) return strict;
  return candidatosPorDataEPrefixoTitulo(txt, apiList);
}

/**
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

/** @param {object} api @param {ReturnType<typeof payloadFromEntrada>} txt @param {string} origemPadrao */
function buildWriteBody(api, txt, origemPadrao) {
  return {
    movimentoEm: txt.movimentoEm,
    titulo: txt.titulo,
    detalhe: txt.detalhe,
    origem: api?.origem ?? origemPadrao,
    origemAutomatica: api?.origemAutomatica ?? false,
    usuarioId: api?.usuarioId ?? null,
  };
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
  const chave = chaveAndamentoEstrita(movimentoEm, titulo500);
  return {
    indice: e.indice,
    movimentoEm,
    titulo: titulo500,
    detalhe,
    chave,
  };
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

async function putAndamento(baseUrl, token, processoId, andamentoId, body) {
  const r = await fetch(`${baseUrl}/api/processos/${processoId}/andamentos/${andamentoId}`, {
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

/**
 * Intervalo de índices txt a ler: linhas 15/16/17 alteradas hoje; se 14.1 mudou, todo 1..N.
 * @param {import('./lib/historico-hc-scan-alterados.mjs').ArquivoHistoricoAlterado[]} arquivos14
 * @param {import('./lib/historico-hc-scan-alterados.mjs').ArquivoHistoricoAlterado[]} arquivosLinha
 * @param {number} nTxt
 */
function intervaloIndicesLeitura(arquivos14, arquivosLinha, nTxt) {
  if (arquivos14.length > 0) return { indiceMin: 1, indiceMax: nTxt };
  const indices = arquivosLinha.map((f) => f.indice).filter((n) => n != null && n >= 1);
  if (indices.length === 0) return { indiceMin: 1, indiceMax: nTxt };
  return { indiceMin: Math.min(...indices), indiceMax: Math.max(...indices) };
}

/**
 * @param {ReturnType<typeof parseArgs>} opts
 * @param {string | null} token
 * @param {{ cod8: string, codNum: number, procStr: string, procNum: number }} procInfo
 * @param {import('./lib/historico-hc-scan-alterados.mjs').ScanHistoricoHcAlterados} scan
 */
async function processarPar(opts, token, procInfo, scan) {
  const { cod8, codNum, procStr, procNum } = procInfo;
  const nTxt = lerMaxIndiceHistorico(opts.base, cod8, codNum, procStr);

  const arquivos14 = scan.tipo14.filter((f) => f.cod8 === cod8 && f.procNum === procNum);
  const arquivosLinha = scan.tipo15_16_17.filter((f) => f.cod8 === cod8 && f.procNum === procNum);

  const resultado = {
    cod8,
    procNum,
    nTxt,
    nChavesApi: null,
    nLinhasApi: null,
    indicesNovos: /** @type {number[]} */ ([]),
    indicesAtualizar: /** @type {number[]} */ ([]),
    posts: 0,
    puts: 0,
    jaExistiam: 0,
    falhas: 0,
    orfao: false,
    aviso: null,
  };

  if (nTxt == null || nTxt < 1) {
    resultado.aviso = 'sem índice 14 / histórico vazio no disco';
    return resultado;
  }

  if (!token) {
    const estimativaMin = Math.max(1, nTxt);
    resultado.indicesNovos = [];
    for (let i = estimativaMin; i <= nTxt; i += 1) resultado.indicesNovos.push(i);
    return resultado;
  }

  const proc = await buscarProcesso(opts.baseUrl, token, cod8, procNum);
  if (!proc?.id) {
    resultado.orfao = true;
    resultado.aviso = 'processo não encontrado na API';
    return resultado;
  }

  const apiList = await listarAndamentos(opts.baseUrl, token, proc.id);
  const porChave = indexarPorChave(apiList);
  const linhasOrigem = apiList.filter((a) => String(a?.origem ?? '') === opts.origem);

  resultado.nChavesApi = porChave.size;
  resultado.nLinhasApi = apiList.length;

  if (apiList.length > porChave.size) {
    console.warn(
      `  [dup-api] ${cod8} proc ${procNum}: ${apiList.length} linha(s) na API mas ${porChave.size} chave(s) única(s) — use deduplicar-andamentos-processo.mjs`
    );
  }

  const { indiceMin, indiceMax } = intervaloIndicesLeitura(arquivos14, arquivosLinha, nTxt);
  const entradasCompletas = coletarEntradasHistoricoLocal({
    base: opts.base,
    clienteMin: codNum,
    clienteMax: codNum,
    filtroClienteCod: codNum,
    filtroProcesso: procNum,
    indiceMin,
    indiceMax,
  });

  /** @type {ReturnType<typeof payloadFromEntrada>[]} */
  const aInserir = [];
  /** @type {{ p: ReturnType<typeof payloadFromEntrada>, api: object }[]} */
  const aAtualizar = [];

  for (const e of entradasCompletas) {
    const p = payloadFromEntrada(e);
    const candidatos = resolverCandidatos(p, porChave, apiList);

    if (candidatos.length === 0) {
      aInserir.push(p);
      resultado.indicesNovos.push(e.indice);
      continue;
    }

    const api = escolherCandidato(candidatos, p);
    if (!api) {
      aInserir.push(p);
      resultado.indicesNovos.push(e.indice);
      continue;
    }

    if (!precisaAtualizar(api, p)) {
      resultado.jaExistiam += 1;
      continue;
    }

    aAtualizar.push({ p, api });
    resultado.indicesAtualizar.push(e.indice);
  }

  if (opts.verbose || aInserir.length > 0 || aAtualizar.length > 0) {
    console.log(
      `\n── ${cod8} proc ${procNum} ──\n` +
        `  N txt (tipo 14): ${nTxt}\n` +
        `  API: ${apiList.length} linha(s) total, ${resultado.nChavesApi} chave(s) única(s) (${linhasOrigem.length} ${opts.origem})\n` +
        `  Alterados hoje: 14→${arquivos14.length}  15/16/17→${arquivosLinha.length}  índices lidos: ${indiceMin}..${indiceMax}\n` +
        `  A inserir: ${aInserir.length} [${resultado.indicesNovos.join(', ') || '—'}]  A atualizar: ${aAtualizar.length} [${resultado.indicesAtualizar.join(', ') || '—'}]`
    );
  }

  for (const { p, api } of aAtualizar) {
    const body = buildWriteBody(api, p, opts.origem);
    if (!opts.aplicar) {
      console.log(
        `  [dry-run] PUT idx ${p.indice} id=${api.id} | ${p.movimentoEm?.slice(0, 10) ?? '?'} | ${p.titulo.slice(0, 70)}`
      );
      resultado.puts += 1;
      continue;
    }
    const r = await putAndamento(opts.baseUrl, token, proc.id, api.id, body);
    if (r.ok) {
      resultado.puts += 1;
      console.log(`  [atualizado] idx ${p.indice} id=${api.id} | ${p.titulo.slice(0, 60)}`);
    } else {
      resultado.falhas += 1;
      console.warn(`  [falha PUT] idx ${p.indice}: ${r.status} ${(r.text || '').slice(0, 120)}`);
    }
  }

  for (const p of aInserir) {
    if (!opts.aplicar) {
      console.log(
        `  [dry-run] POST idx ${p.indice} | ${p.movimentoEm?.slice(0, 10) ?? '?'} | ${p.titulo.slice(0, 70)}`
      );
      resultado.posts += 1;
      continue;
    }
    const r = await postAndamento(
      opts.baseUrl,
      token,
      proc.id,
      { movimentoEm: p.movimentoEm, titulo: p.titulo, detalhe: p.detalhe },
      opts.origem
    );
    if (r.ok) {
      resultado.posts += 1;
      if (!porChave.has(p.chave)) porChave.set(p.chave, []);
      porChave.get(p.chave).push({ id: -1, ...p });
      console.log(`  [criado] idx ${p.indice} | ${p.titulo.slice(0, 60)}`);
    } else {
      resultado.falhas += 1;
      console.warn(`  [falha POST] idx ${p.indice}: ${r.status} ${(r.text || '').slice(0, 120)}`);
    }
  }

  if (nTxt < resultado.nChavesApi) {
    resultado.aviso = `N txt (${nTxt}) < chaves API (${resultado.nChavesApi}) — possível renumeração ou duplicados`;
  }

  return resultado;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  resetAvisosResponsavel();

  const fimDia = new Date(opts.dia);
  fimDia.setDate(fimDia.getDate() + 1);

  const diaLabel = `${opts.dia.getFullYear()}-${String(opts.dia.getMonth() + 1).padStart(2, '0')}-${String(opts.dia.getDate()).padStart(2, '0')}`;

  console.log('\n=== sync-historico-hc-alterados-hoje ===\n');
  console.log(`Base:   ${opts.base}`);
  console.log(`Dia:    ${diaLabel} (fuso local)`);
  console.log(`Modo:   ${opts.aplicar ? 'aplicar (POST/PUT)' : 'dry-run'}`);
  console.log(`Origem: ${opts.origem}\n`);

  const scan = scanHistoricoHcAlteradosNoDia(opts.base, opts.dia, fimDia);

  console.log(`Ficheiros txt alterados em HC: ${scan.todos.length}`);
  console.log(`  tipo 14.1 (contador):     ${scan.tipo14.length}`);
  console.log(`  tipo 15/16/17 (linhas):   ${scan.tipo15_16_17.length}`);
  console.log(`  outros .txt:              ${scan.outros.length}`);
  console.log(`  processos distintos:      ${scan.processos.size}\n`);

  if (scan.tipo14.length > 0 && opts.verbose) {
    console.log('── Tipo 14.1 alterados hoje ──');
    for (const f of scan.tipo14.sort((a, b) => a.relAposHc.localeCompare(b.relAposHc))) {
      console.log(`  ${f.relAposHc}`);
    }
    console.log('');
  }

  if (scan.processos.size === 0) {
    console.log('Nenhum processo com histórico alterado neste dia — nada a sincronizar.');
    process.exit(0);
  }

  let token = null;
  if (opts.aplicar) {
    if (!opts.senha) {
      console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=... para --aplicar');
      process.exit(1);
    }
    token = await login(opts);
  } else if (opts.senha) {
    token = await login(opts);
  }

  const totais = {
    processos: 0,
    posts: 0,
    puts: 0,
    jaExistiam: 0,
    falhas: 0,
    orfaos: 0,
    semAcao: 0,
  };

  const pares = [...scan.processos.values()].sort(
    (a, b) => a.codNum - b.codNum || a.procNum - b.procNum
  );

  for (const procInfo of pares) {
    totais.processos += 1;
    const r = await processarPar(opts, token, procInfo, scan);
    totais.posts += r.posts;
    totais.puts += r.puts;
    totais.jaExistiam += r.jaExistiam;
    totais.falhas += r.falhas;
    if (r.orfao) totais.orfaos += 1;
    if (r.posts === 0 && r.puts === 0 && !r.orfao && r.indicesNovos.length === 0 && r.indicesAtualizar.length === 0) {
      totais.semAcao += 1;
    }
    if (r.aviso && opts.verbose) console.log(`  [aviso] ${r.aviso}`);
  }

  console.log('\n=== concluído ===');
  console.log(
    `Processos analisados: ${totais.processos} | POST: ${totais.posts} | PUT: ${totais.puts} | já na API: ${totais.jaExistiam} | falhas: ${totais.falhas} | órfãos: ${totais.orfaos} | sem novidades: ${totais.semAcao}\n`
  );

  process.exit(totais.falhas > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
