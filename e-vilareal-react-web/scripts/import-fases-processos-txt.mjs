#!/usr/bin/env node
/**
 * Importa fase e observação da fase a partir dos txt no Dropbox.
 *
 * Fase: `fase/1000/<centena>/<cliente>/*.21.1.<proc>.*.txt` (e pastas legadas `fase/01`…)
 * Observação: `Gerais/1000/<centena>/<cliente>/*.146.1.<proc>.txt`
 * Status (VBA): `Gerais/1000/<centena>/<cliente>/<cod8>.Status.Processo<proc>.Processos.txt`
 *   — conteúdo `INATIVO`: PATCH inativar + limpar `observacao_fase` (não importa fase dos outros txt)
 *
 * Actualiza `processo.fase` e `processo.observacao_fase` via PUT /api/processos/{id}
 *
 * Uso:
 *   node scripts/import-fases-processos-txt.mjs --dry-run
 *   node scripts/import-fases-processos-txt.mjs --validar-amostra=50
 *   VILAREAL_IMPORT_SENHA='…' node scripts/import-fases-processos-txt.mjs --aplicar --login=itamar
 *
 * Opções:
 *   --base-fase=PATH       Raiz `fase` (defeito: ~/Dropbox/Banco de Dados/fase)
 *   --base-gerais=PATH     Raiz `Gerais/1000` (defeito: …/Gerais/1000)
 *   --dry-run | --aplicar
 *   --validar-amostra=N    Mostra N exemplos aleatórios (com API se disponível)
 *   --cliente=N
 *   --apenas-diferentes
 *   --apenas-inativar     Só processos com txt Status INATIVO (sem atualizar fases)
 *   --criar-orfaos-inativos  Cria processo na API quando txt INATIVO não existe (defeito com --apenas-inativar --aplicar)
 *   --sem-criar-orfaos       Não criar processos em falta
 *   --relatorio=JSON
 *   --seed=N               Semente da amostra aleatória
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  amostraAleatoria,
  defaultBaseGeraisObservacaoMil,
  levantarFasesProcessos,
  resolverBaseBancoDados,
} from './lib/gerais-fase-processo-txt.mjs';
import {
  buscarProcesso,
  loginImportApi,
  criarProcessoInativoMinimo,
} from './lib/vilareal-import-processo-api.mjs';
import { atualizarProcessoApi } from './lib/import-processo-put-body.mjs';

function parseArgs(argv) {
  const baseBanco = resolverBaseBancoDados();
  const out = {
    baseFase: path.join(baseBanco, 'fase'),
    baseGeraisMil: defaultBaseGeraisObservacaoMil(),
    dryRun: true,
    aplicar: false,
    validarAmostra: null,
    login: 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    clienteFiltro: null,
    apenasDiferentes: false,
    apenasInativar: false,
    criarOrfaosInativos: false,
    relatorio: null,
    seed: Number(process.env.VILAREAL_VALIDAR_SEED) || 42,
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    concurrency: Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY) || 5),
    compararApi: true,
  };

  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--aplicar') {
      out.aplicar = true;
      out.dryRun = false;
    } else if (a === '--apenas-diferentes') out.apenasDiferentes = true;
    else if (a === '--apenas-inativar') {
      out.apenasInativar = true;
      out.criarOrfaosInativos = true;
    } else if (a === '--criar-orfaos-inativos') out.criarOrfaosInativos = true;
    else if (a === '--sem-criar-orfaos') out.criarOrfaosInativos = false;
    else if (a === '--sem-api') out.compararApi = false;
    else if (a.startsWith('--base-fase=')) out.baseFase = a.slice(12);
    else if (a.startsWith('--base-gerais=')) out.baseGeraisMil = a.slice(14);
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--relatorio=')) out.relatorio = a.slice(12);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--seed=')) out.seed = Number(a.slice(7)) || 42;
    else if (a.startsWith('--validar-amostra=')) {
      const n = Number(a.slice(18));
      if (Number.isFinite(n) && n > 0) out.validarAmostra = Math.trunc(n);
    } else if (a.startsWith('--cliente=')) {
      const n = Number(a.slice(10));
      if (Number.isFinite(n) && n >= 1) out.clienteFiltro = Math.trunc(n);
    } else if (a.startsWith('--concurrency=')) {
      out.concurrency = Math.max(1, Number(a.slice(14)) || 5);
    }
  }

  if (!out.baseGeraisMil) out.baseGeraisMil = defaultBaseGeraisObservacaoMil();
  return out;
}

async function login(opts) {
  const res = await fetch(`${opts.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      login: String(opts.login).trim().toLowerCase(),
      senha: opts.senha,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Login falhou ${res.status}: ${t.slice(0, 400)}`);
  }
  const json = await res.json();
  if (!json.accessToken) throw new Error('Login sem accessToken');
  return json.accessToken;
}

async function patchAtivoProcesso(baseUrl, token, processoId, ativo) {
  const res = await fetch(
    `${baseUrl}/api/processos/${processoId}/ativo?${new URLSearchParams({ value: String(ativo) })}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PATCH ativo ${processoId}: ${res.status} ${t.slice(0, 200)}`);
  }
}

/**
 * Marca processo inativo e remove observação de fase (andamento de fase no cadastro).
 * @param {object} reg
 */
function precisaInativar(reg, proc) {
  if (!reg.statusInativo) return { aplicar: false, motivo: 'nao_inativo_txt' };
  const jaInativo = proc.ativo === false;
  const obsLimpa = normalizarStr(proc.observacaoFase) === '';
  if (jaInativo && obsLimpa) return { aplicar: false, motivo: 'pulado_ja_inativo' };
  return { aplicar: true, motivo: jaInativo ? 'limpar_obs_fase' : 'inativar' };
}

function normalizarStr(val) {
  if (val == null) return '';
  return String(val).trim();
}

function precisaAtualizar(reg, proc, opts) {
  const patch = {};
  if (reg.faseCanonica) patch.fase = reg.faseCanonica;
  if (reg.observacaoFase != null) patch.observacaoFase = reg.observacaoFase;

  if (!patch.fase && patch.observacaoFase === undefined) {
    return { aplicar: false, motivo: 'sem_dados_validos', patch };
  }

  if (!opts.apenasDiferentes) return { aplicar: true, motivo: 'aplicar', patch };

  let diff = false;
  if (patch.fase && normalizarStr(proc.fase) !== normalizarStr(patch.fase)) diff = true;
  if (
    patch.observacaoFase !== undefined &&
    normalizarStr(proc.observacaoFase) !== normalizarStr(patch.observacaoFase)
  ) {
    diff = true;
  }
  return { aplicar: diff, motivo: diff ? 'diferente' : 'pulado_igual', patch };
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

function compararFase(txtCanon, apiFase) {
  const a = normalizarStr(txtCanon);
  const b = normalizarStr(apiFase);
  if (!a && !b) return 'ambos_vazios';
  if (a === b) return 'igual';
  if (!a || !b) return 'um_vazio';
  return 'diferente';
}

function compararObs(txt, apiObs) {
  const a = normalizarStr(txt);
  const b = normalizarStr(apiObs);
  if (!a && !b) return 'ambos_vazios';
  if (a === b) return 'igual';
  if (!a || !b) return 'um_vazio';
  if (a.includes(b) || b.includes(a)) return 'semelhante';
  return 'diferente';
}

/**
 * @param {object[]} registos
 * @param {ReturnType<typeof parseArgs>} opts
 * @param {{ totalLevantamento?: object }} [ctx]
 */
async function validarAmostraComRelatorio(registos, opts, ctx = {}) {
  const amostra = amostraAleatoria(registos, opts.validarAmostra, opts.seed);
  const contagem = {
    fase: { igual: 0, semelhante: 0, diferente: 0, um_vazio: 0, ambos_vazios: 0, sem_processo: 0, inativo_api: 0 },
    obs: { igual: 0, semelhante: 0, diferente: 0, um_vazio: 0, ambos_vazios: 0 },
    acao: {
      inativar_txt: 0,
      inativar_aplicar: 0,
      inativar_pulado: 0,
      fase_atualizar: 0,
      fase_pulado: 0,
      sem_processo: 0,
      erro_api: 0,
      sem_api: 0,
    },
  };

  let token = null;
  let apiErroLogin = null;
  if (opts.compararApi && opts.senha) {
    try {
      token = await loginImportApi(opts.baseUrl, opts.login, opts.senha);
      console.log('[api] Login OK — a comparar amostra com a base\n');
    } catch (e) {
      apiErroLogin = String(e.message);
      console.warn(`[api] Sem comparação: ${e.message}\n`);
    }
  } else if (opts.compararApi && !opts.senha) {
    console.warn('[api] Defina VILAREAL_IMPORT_SENHA para comparar com a API\n');
  }

  console.log(`=== Validação — ${amostra.length} exemplos (seed=${opts.seed}) ===\n`);

  /** @type {object[]} */
  const casos = [];
  /** @type {Map<string, number>} */
  const clientePorCod8 = new Map();
  let i = 0;

  for (const reg of amostra) {
    i += 1;
    /** @type {object} */
    const caso = {
      n: i,
      cod8: reg.cod8,
      numeroInterno: reg.numeroInterno,
      statusBruto: reg.statusBruto ?? null,
      statusInativo: Boolean(reg.statusInativo),
      arquivoStatus: reg.arquivoStatus ?? null,
      faseBruta: reg.faseBruta ?? null,
      faseCanonica: reg.faseCanonica ?? null,
      avisoFase: reg.avisoFase ?? null,
      observacaoBruta: reg.observacaoBruta ?? null,
      observacaoFase: reg.observacaoFase ?? null,
      arquivoFase: reg.arquivoFase ?? null,
      arquivoObservacao: reg.arquivoObservacao ?? null,
      acaoPrevista: reg.statusInativo ? 'INATIVAR' : reg.faseCanonica || reg.observacaoFase ? 'ATUALIZAR_FASE' : 'NADA',
      api: null,
    };

    console.log(`--- #${i} cliente ${reg.cod8} proc ${reg.numeroInterno} ---`);
    console.log(`  Status txt:   ${JSON.stringify(reg.statusBruto ?? '(ausente)')}${reg.statusInativo ? ' → INATIVO' : ''}`);
    if (reg.arquivoStatus) console.log(`  Arquivo status:${reg.arquivoStatus}`);
    console.log(`  Fase txt:     ${JSON.stringify(reg.faseBruta ?? '(ausente)')}`);
    console.log(`  Fase canónica:${JSON.stringify(reg.faseCanonica ?? null)}${reg.avisoFase ? ` [${reg.avisoFase}]` : ''}`);
    console.log(
      `  Obs txt:      ${JSON.stringify((reg.observacaoBruta ?? '(ausente)').slice(0, 120))}${(reg.observacaoBruta?.length ?? 0) > 120 ? '…' : ''}`
    );
    if (reg.arquivoFase) console.log(`  Arquivo fase: ${reg.arquivoFase}`);
    if (reg.arquivoObservacao) console.log(`  Arquivo obs:  ${reg.arquivoObservacao}`);

    if (reg.statusInativo) contagem.acao.inativar_txt += 1;

    if (token) {
      try {
        const proc = await buscarProcesso(opts.baseUrl, token, reg.cod8, reg.numeroInterno, clientePorCod8);
        if (!proc?.id) {
          console.log('  API:          (processo não encontrado)');
          contagem.fase.sem_processo += 1;
          contagem.acao.sem_processo += 1;
          caso.api = { encontrado: false };
          caso.acaoPrevista = 'SEM_PROCESSO_API';
        } else if (reg.statusInativo) {
          const { aplicar, motivo } = precisaInativar(reg, proc);
          caso.api = {
            encontrado: true,
            processoId: proc.id,
            ativo: proc.ativo,
            fase: proc.fase ?? null,
            observacaoFase: proc.observacaoFase ?? null,
          };
          caso.acaoPrevista = aplicar ? 'INATIVAR' : motivo;
          if (aplicar) {
            contagem.acao.inativar_aplicar += 1;
            console.log(`  API:          ativo=${proc.ativo} — INATIVAR + limpar obs. fase`);
          } else {
            contagem.acao.inativar_pulado += 1;
            console.log(`  API:          já inativo/sem obs — ${motivo}`);
          }
        } else if (proc.ativo === false) {
          console.log('  API:          processo INATIVO na API (txt não marca inativo)');
          contagem.fase.inativo_api += 1;
          caso.api = { encontrado: true, processoId: proc.id, ativo: false, fase: proc.fase, observacaoFase: proc.observacaoFase };
          caso.acaoPrevista = 'PULADO_INATIVO_API';
        } else {
          console.log(`  API fase:     ${JSON.stringify(proc.fase ?? null)}`);
          console.log(
            `  API obs:      ${JSON.stringify((proc.observacaoFase ?? '').slice(0, 120))}${(proc.observacaoFase?.length ?? 0) > 120 ? '…' : ''}`
          );
          const cmpFase = compararFase(reg.faseCanonica, proc.fase);
          const cmpObs = compararObs(reg.observacaoFase, proc.observacaoFase);
          contagem.fase[cmpFase] = (contagem.fase[cmpFase] ?? 0) + 1;
          contagem.obs[cmpObs] = (contagem.obs[cmpObs] ?? 0) + 1;
          console.log(`  vs banco fase:${cmpFase}  obs:${cmpObs}`);
          const { aplicar, motivo, patch } = precisaAtualizar(reg, proc, opts);
          caso.api = {
            encontrado: true,
            processoId: proc.id,
            ativo: proc.ativo,
            fase: proc.fase ?? null,
            observacaoFase: proc.observacaoFase ?? null,
            cmpFase,
            cmpObs,
          };
          caso.acaoPrevista = aplicar ? 'ATUALIZAR_FASE' : motivo;
          if (aplicar) {
            contagem.acao.fase_atualizar += 1;
            console.log(`  Acção:        ATUALIZAR`);
            if (patch.fase) console.log(`    → fase: ${patch.fase}`);
            if (patch.observacaoFase !== undefined) {
              console.log(`    → obs:  ${String(patch.observacaoFase).slice(0, 80)}`);
            }
            caso.patch = patch;
          } else {
            contagem.acao.fase_pulado += 1;
            console.log(`  Acção:        ${motivo}`);
          }
        }
      } catch (e) {
        contagem.acao.erro_api += 1;
        caso.api = { erro: String(e.message).slice(0, 300) };
        console.log(`  API erro:     ${String(e.message).slice(0, 120)}`);
      }
    } else {
      contagem.acao.sem_api += 1;
    }

    casos.push(caso);
    console.log('');
  }

  const comparadosFase =
    amostra.length - contagem.fase.sem_processo - contagem.fase.inativo_api - contagem.acao.inativar_txt;
  const faseOk = contagem.fase.igual + contagem.fase.ambos_vazios;
  const obsOk = contagem.obs.igual + contagem.obs.semelhante + contagem.obs.ambos_vazios;

  if (token) {
    console.log('=== Resumo comparação com banco (amostra) ===');
    console.log(
      `  Status INATIVO (txt): ${contagem.acao.inativar_txt}  → inativar na API: ${contagem.acao.inativar_aplicar}  já ok: ${contagem.acao.inativar_pulado}`
    );
    console.log(
      `  Fase:  igual=${contagem.fase.igual}  diferente=${contagem.fase.diferente}  um_vazio=${contagem.fase.um_vazio}  ambos_vazios=${contagem.fase.ambos_vazios}  inativo_api=${contagem.fase.inativo_api}  sem_proc=${contagem.fase.sem_processo}`
    );
    console.log(
      `  Obs:   igual=${contagem.obs.igual}  semelhante=${contagem.obs.semelhante}  diferente=${contagem.obs.diferente}  um_vazio=${contagem.obs.um_vazio}  ambos_vazios=${contagem.obs.ambos_vazios}`
    );
    console.log(
      `  Acções previstas (--aplicar): inativar=${contagem.acao.inativar_aplicar}  atualizar fase=${contagem.acao.fase_atualizar}  pulados=${contagem.acao.fase_pulado + contagem.acao.inativar_pulado}`
    );
    if (comparadosFase > 0) {
      console.log(
        `  Semelhança (só fase activa): fase ${((100 * faseOk) / comparadosFase).toFixed(0)}%  |  obs ${((100 * obsOk) / comparadosFase).toFixed(0)}%`
      );
    }
    console.log('');
  } else {
    console.log('=== Resumo (só txt — API indisponível ou sem senha) ===');
    console.log(`  Status INATIVO (txt): ${contagem.acao.inativar_txt}`);
    console.log(`  Com fase canónica:    ${amostra.filter((r) => r.faseCanonica).length}`);
    console.log(`  Com observação:       ${amostra.filter((r) => r.observacaoFase).length}`);
    console.log('');
  }

  const relatorio = {
    geradoEm: new Date().toISOString(),
    modo: 'validar_amostra',
    seed: opts.seed,
    tamanhoAmostra: amostra.length,
    baseFase: opts.baseFase,
    baseGeraisMil: opts.baseGeraisMil,
    baseUrl: opts.baseUrl,
    apiComparada: Boolean(token),
    apiErroLogin,
    levantamentoTotal: ctx.totalLevantamento ?? null,
    contagem,
    casos,
    recomendacao: token
      ? {
          seguroParaAplicarGeral:
            contagem.acao.erro_api === 0 &&
            contagem.acao.sem_processo <= Math.ceil(amostra.length * 0.05),
          inativarEstimado: contagem.acao.inativar_aplicar,
          atualizarFaseEstimado: contagem.acao.fase_atualizar,
        }
      : { aviso: 'Execute novamente com API online e VILAREAL_IMPORT_SENHA para comparar com o MySQL.' },
  };

  return relatorio;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const baseGeraisMil = opts.baseGeraisMil;

  console.log('\n=== Fases de processos — txt Dropbox ===');
  console.log(`Raiz fase:   ${opts.baseFase}`);
  console.log(`Gerais/1000: ${baseGeraisMil}`);
  const modoLabel = opts.validarAmostra
    ? `validar amostra (${opts.validarAmostra})`
    : opts.dryRun
      ? 'dry-run'
      : opts.apenasInativar
        ? 'aplicar — só inativar (Status INATIVO)'
        : 'aplicar na API';
  console.log(`Modo: ${modoLabel}`);
  console.log('');

  if (!fs.existsSync(opts.baseFase) && !fs.existsSync(baseGeraisMil)) {
    console.error('Pastas não encontradas. Defina --base-fase= ou VILAREAL_BANCO_DADOS_BASE=');
    process.exit(1);
  }

  const registos = levantarFasesProcessos(opts.baseFase, baseGeraisMil, {
    clienteFiltro: opts.clienteFiltro,
  });

  const comFase = registos.filter((r) => r.faseCanonica);
  const comObs = registos.filter((r) => r.observacaoFase);
  const comAmbos = registos.filter((r) => r.faseCanonica && r.observacaoFase);
  const faseInvalida = registos.filter((r) => r.faseBruta && !r.faseCanonica);
  const soObs = registos.filter((r) => !r.faseCanonica && r.observacaoFase);
  const statusInativos = registos.filter((r) => r.statusInativo);
  const comArquivoStatus = registos.filter((r) => r.arquivoStatus);

  console.log('--- Levantamento ---');
  console.log(`  Pares cliente+proc:     ${registos.length}`);
  console.log(`  Com txt Status.Processo:${comArquivoStatus.length}`);
  console.log(`  Status INATIVO:         ${statusInativos.length}`);
  console.log(`  Com fase reconhecida:   ${comFase.length}`);
  console.log(`  Com observação 146.1:   ${comObs.length}`);
  console.log(`  Com fase + observação:  ${comAmbos.length}`);
  console.log(`  Só observação:          ${soObs.length}`);
  console.log(`  Fase txt não reconhecida:${faseInvalida.length}`);
  console.log('');

  if (opts.validarAmostra) {
    const relatorioAmostra = await validarAmostraComRelatorio(registos, opts, {
      totalLevantamento: {
        pares: registos.length,
        statusInativos: statusInativos.length,
        comArquivoStatus: comArquivoStatus.length,
        comFase: comFase.length,
        comObs: comObs.length,
        faseInvalida: faseInvalida.length,
      },
    });
    const destino =
      opts.relatorio ||
      path.join(process.cwd(), 'tmp', `relatorio-validacao-fases-amostra-${opts.validarAmostra}.json`);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, JSON.stringify(relatorioAmostra, null, 2), 'utf8');
    console.log(`Relatório JSON: ${destino}`);
    process.exit(0);
  }

  const stats = {
    ok: 0,
    pulados: 0,
    semProcesso: 0,
    semDados: 0,
    falhas: 0,
    inativados: 0,
    inativarPulados: 0,
    inativarFalhas: 0,
    processosCriadosInativos: 0,
    semCliente: 0,
    criarOrfaoFalhas: 0,
  };
  const detalhes = [];
  /** @type {Map<string, number>} */
  const clientePorCod8 = new Map();

  let token = null;
  if (!opts.dryRun) {
    if (!opts.senha) {
      console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=');
      process.exit(1);
    }
    token = await loginImportApi(opts.baseUrl, opts.login, opts.senha);
    console.log('[api] Login OK\n');
  }

  const candidatosInativar = registos.filter((r) => r.statusInativo);
  const candidatosFase = registos.filter(
    (r) =>
      !r.statusInativo &&
      (r.faseCanonica || r.observacaoFase) &&
      r.avisoFase !== 'inativo_ignorado'
  );

  await runPool(candidatosInativar, opts.dryRun ? 1 : opts.concurrency, async (reg) => {
    const linha = {
      cod8: reg.cod8,
      numeroInterno: reg.numeroInterno,
      status: reg.statusBruto,
    };

    if (opts.dryRun) {
      stats.inativados += 1;
      if (detalhes.length < 5000) detalhes.push({ ...linha, acao: 'dry-run-inativar' });
      return;
    }

    try {
      let proc = await buscarProcesso(opts.baseUrl, token, reg.cod8, reg.numeroInterno, clientePorCod8);

      if (!proc?.id && opts.criarOrfaosInativos) {
        const criado = await criarProcessoInativoMinimo(
          opts.baseUrl,
          token,
          reg.cod8,
          reg.numeroInterno,
          clientePorCod8
        );
        if (!criado.ok && !criado.duplicate && criado.text?.includes('cliente não resolvido')) {
          stats.semCliente += 1;
          detalhes.push({ ...linha, acao: 'sem_cliente_api' });
          return;
        }
        if (criado.ok && criado.id != null) {
          stats.processosCriadosInativos += 1;
          stats.inativados += 1;
          detalhes.push({
            ...linha,
            acao: 'criado_inativo',
            processoId: criado.id,
            clientePk: clientePorCod8.get(reg.cod8)?.clientePk,
          });
          return;
        }
        if (criado.duplicate) {
          proc = await buscarProcesso(opts.baseUrl, token, reg.cod8, reg.numeroInterno, clientePorCod8);
        } else {
          stats.criarOrfaoFalhas += 1;
          detalhes.push({
            ...linha,
            acao: 'falha_criar_orfao',
            erro: criado.text ?? `HTTP ${criado.status}`,
          });
          return;
        }
      }

      if (!proc?.id) {
        stats.semProcesso += 1;
        detalhes.push({ ...linha, acao: 'sem_processo_inativar' });
        return;
      }

      const { aplicar, motivo } = precisaInativar(reg, proc);
      if (!aplicar) {
        stats.inativarPulados += 1;
        detalhes.push({ ...linha, acao: motivo, processoId: proc.id });
        return;
      }

      if (proc.ativo !== false) {
        await patchAtivoProcesso(opts.baseUrl, token, proc.id, false);
      }
      if (normalizarStr(proc.observacaoFase) !== '') {
        await atualizarProcessoApi(opts.baseUrl, token, proc, { observacaoFase: null });
      }

      stats.inativados += 1;
      detalhes.push({ ...linha, acao: 'inativado', processoId: proc.id, motivo });
    } catch (e) {
      stats.inativarFalhas += 1;
      detalhes.push({ ...linha, acao: 'falha_inativar', erro: String(e?.message ?? e).slice(0, 300) });
    }
  });

  if (opts.apenasInativar) {
    console.log('\n[info] --apenas-inativar: fase/observação não serão atualizados.');
    if (opts.criarOrfaosInativos) {
      console.log('[info] --criar-orfaos-inativos: processos em falta serão criados já inativos.\n');
    } else {
      console.log('');
    }
  }

  if (!opts.apenasInativar) await runPool(candidatosFase, opts.dryRun ? 1 : opts.concurrency, async (reg) => {
    const linha = {
      cod8: reg.cod8,
      numeroInterno: reg.numeroInterno,
      fase: reg.faseCanonica,
      observacaoFase: reg.observacaoFase ?? null,
    };

    if (opts.dryRun) {
      stats.ok += 1;
      if (detalhes.length < 3000) detalhes.push({ ...linha, acao: 'dry-run' });
      return;
    }

    try {
      const proc = await buscarProcesso(opts.baseUrl, token, reg.cod8, reg.numeroInterno, clientePorCod8);
      if (!proc?.id) {
        stats.semProcesso += 1;
        detalhes.push({ ...linha, acao: 'sem_processo' });
        return;
      }

      if (proc.ativo === false) {
        stats.pulados += 1;
        detalhes.push({ ...linha, acao: 'pulado_inativo_api' });
        return;
      }

      const { aplicar, motivo, patch } = precisaAtualizar(reg, proc, opts);
      if (!aplicar) {
        if (motivo === 'sem_dados_validos') stats.semDados += 1;
        else stats.pulados += 1;
        detalhes.push({ ...linha, acao: motivo });
        return;
      }

      await atualizarProcessoApi(opts.baseUrl, token, proc, patch);
      stats.ok += 1;
      detalhes.push({ ...linha, acao: 'atualizado', processoId: proc.id, patch });
    } catch (e) {
      stats.falhas += 1;
      detalhes.push({ ...linha, acao: 'falha', erro: String(e?.message ?? e).slice(0, 300) });
    }
  });

  console.log('\n--- Resumo ---');
  console.log(
    `  ${opts.dryRun ? 'Inativar (dry-run)' : 'Inativados (Status INATIVO)'}: ${stats.inativados}`
  );
  if (!opts.dryRun) {
    console.log(`  Processos criados (inativos): ${stats.processosCriadosInativos}`);
    console.log(`  Sem cliente na API: ${stats.semCliente}`);
    console.log(`  Falha ao criar órfão: ${stats.criarOrfaoFalhas}`);
    console.log(`  Inativar pulados: ${stats.inativarPulados}`);
    console.log(`  Sem processo (sem criar): ${stats.semProcesso}`);
    console.log(`  Inativar falhas: ${stats.inativarFalhas}`);
  }
  console.log(`  ${opts.dryRun ? 'Fases (dry-run)' : 'Fases atualizadas'}: ${stats.ok}`);
  if (!opts.dryRun) {
    console.log(`  Pulados (iguais / sem alteração): ${stats.pulados}`);
    console.log(`  Sem processo na API: ${stats.semProcesso}`);
    console.log(`  Sem dados válidos: ${stats.semDados}`);
    console.log(`  Falhas fase: ${stats.falhas}`);
  }

  if (opts.relatorio) {
    fs.writeFileSync(
      opts.relatorio,
      JSON.stringify(
        {
          geradoEm: new Date().toISOString(),
          baseFase: opts.baseFase,
          baseGeraisMil,
          stats: {
            total: registos.length,
            comFase: comFase.length,
            comObs: comObs.length,
            faseInvalida: faseInvalida.length,
            statusInativos: statusInativos.length,
            comArquivoStatus: comArquivoStatus.length,
            ...stats,
          },
          detalhes: detalhes.slice(0, 5000),
        },
        null,
        2
      ),
      'utf8'
    );
    console.log(`\nRelatório: ${opts.relatorio}`);
  }

  console.log('');
  if (!opts.dryRun && (stats.falhas > 0 || stats.inativarFalhas > 0 || stats.criarOrfaoFalhas > 0)) {
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
