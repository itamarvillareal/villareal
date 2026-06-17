#!/usr/bin/env node
/**
 * Importação real completa de um cliente a partir dos txt locais (Dropbox «Banco de Dados»).
 *
 * Consolida, num único comando, tudo o que antes exigia vários scripts:
 *   - Pessoa do cadastro Clientes (`Gerais/…/151.1.0` → API clientes — independente de processo)
 *   - Cabeçalho do processo (Proc/Gerais, semânticos, fase, prazo, tramitação 147.1)
 *   - Status ativo/inativo (`Gerais/…/Status.Processo<proc>.Processos.txt` — INATIVO → inativo; resto → ativo)
 *   - Histórico HC (`import-historico-local-txt.mjs`, em massa por cliente)
 *   - Vínculo imóvel `0.89.1` (por processo, via import-processo-txt: garantir imóvel por cliente+planilha + POST /api/imoveis/{id}/processos)
 *   - Partes do processo (`Proc/…/90` e `95` por proc) — `import-processo-partes-txt.mjs`
 *     (90/95 = lado cliente/oposta no VBA; com `REQUERIDO` o polo jurídico é invertido na API)
 *   - Cálculos / débitos (`Calculos/…` → API rodadas) — `import-calculos-txt.mjs` (por defeito; `--sem-calculos` omite)
 *   - Processos em falta na API são criados automaticamente (stub) após pessoa/cliente existir na API
 *
 * Uso:
 *   node scripts/import-real.mjs --cliente=728 --dry-run
 *   node scripts/import-real.mjs --cliente=728 --aplicar
 *   node scripts/import-real.mjs --cliente=728 --processo=239 --aplicar
 *
 * Credenciais: `.env.import.local` (VILAREAL_IMPORT_LOGIN, VILAREAL_IMPORT_SENHA, VILAREAL_API_BASE)
 *
 * Opções:
 *   --cliente=N              Obrigatório (código 1..999)
 *   --dry-run | --aplicar
 *   --processo=N             Só um processo (importação completa via import-processo-txt)
 *   --processo-min= --processo-max=   Filtra intervalo na importação em lote
 *   --sem-historico          Não importa andamentos
 *   --sem-imovel             Não vincula imóvel 0.89.1
 *   --sem-partes             Não importa partes do processo (90/95)
 *   --sem-calculos           Não importa rodadas de cálculo (Calculos/ txt)
 *   --importar-partes        (legado; partes já correm por defeito)
 *   --substituir-historico   Apaga andamentos dos processos importados e reimporta do txt
 *   --apenas-novos-historico Só acrescenta andamentos novos (defeito com --aplicar)
 *   --zerar                  Apaga dados do cliente na base antes do import (cuidado: remove histórico existente)
 *   --sem-zerar              (legado) Igual ao defeito — mantido por compatibilidade
 *   --aplicar-correcao-historico  Corrige txt (índice 14) antes do histórico (lento; por defeito não)
 *   --base=PATH              Raiz «Banco de Dados»
 *   --relatorio=JSON         Relatório final da execução
 *   --amostra-processos=N    Em --dry-run, quantos processos pré-visualizar (defeito: 3; 0 = nenhum)
 *   --sem-verificacao        Não executa verificação txt↔API/MySQL após --aplicar (não recomendado)
 *   --continuar-apesar-falhas  Não aborta em falhas de status/partes/cálculos/verificação (lotes)
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import { sincronizarStatusProcessoImportReal } from './lib/sincronizar-status-processo-import-real.mjs';
import {
  centenaPastaClienteHistorico,
  formatCod8,
  pastaNumeroClienteHistorico,
  SEGMENTO_MIL,
} from './lib/historico-local-txt-paths.mjs';
import {
  dirCalculosCliente,
  listarProcessosComCalculosTxt,
} from './lib/calculos-dropbox-txt.mjs';
import { listarProcessosComPartesTxt } from './lib/proc-processo-partes-txt.mjs';
import {
  resolverBaseUrlImport,
  verificarApiImportDisponivel,
} from './lib/vilareal-import-api-base.mjs';
import {
  imprimirVerificacaoImportReal,
  verificarImportRealPosAplicar,
} from './lib/verificar-import-real-pos-aplicar.mjs';
import {
  listarProcessosComCabecalhoTxt,
  listarProcessosComDadosCabecalhoTxt,
  listarProcessosDropboxCliente,
  listarProcessosIndice152Cliente,
} from './lib/processos-dropbox-cliente.mjs';
import {
  imprimirResumoZerarCliente,
  zerarDadosClienteImportReal,
} from './lib/zerar-dados-cliente-import-real.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SCRIPT_PROCESSO = path.join(__dirname, 'import-processo-txt.mjs');
const SCRIPT_HISTORICO = path.join(__dirname, 'import-historico-local-txt.mjs');
const SCRIPT_PARTES = path.join(__dirname, 'import-processo-partes-txt.mjs');
const SCRIPT_GARANTIR_PROCESSOS = path.join(__dirname, 'garantir-processos-import-real.mjs');
const SCRIPT_CLIENTE_PESSOA = path.join(__dirname, 'import-cliente-pessoa-151-txt.mjs');
const SCRIPT_CALCULOS = path.join(__dirname, 'import-calculos-txt.mjs');

export function parseArgs(argv) {
  const out = {
    cliente: null,
    processo: null,
    processoMin: null,
    processoMax: null,
    dryRun: true,
    aplicar: false,
    semHistorico: false,
    semImovel: false,
    semPartes: false,
    semCalculos: false,
    substituirHistorico: false,
    semZerar: true,
    aplicarCorrecaoHistorico: false,
    base: resolverBaseBancoDados(),
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    relatorio: null,
    amostraProcessosDryRun: 3,
    baseUrl: resolverBaseUrlImport(),
    semVerificacao: false,
    continuarApesarFalhas: false,
  };

  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--aplicar') {
      out.aplicar = true;
      out.dryRun = false;
    } else if (a === '--apenas-novos-historico') out.substituirHistorico = false;
    else if (a === '--zerar') out.semZerar = false;
    else if (a === '--sem-zerar') out.semZerar = true;
    else if (a === '--sem-historico') out.semHistorico = true;
    else if (a === '--sem-imovel') out.semImovel = true;
    else if (a === '--sem-partes') out.semPartes = true;
    else if (a === '--sem-calculos') out.semCalculos = true;
    else if (a === '--importar-partes') {
      /* legado: partes passam a correr por defeito */
    }
    else if (a === '--substituir-historico') out.substituirHistorico = true;
    else if (a === '--aplicar-correcao-historico') out.aplicarCorrecaoHistorico = true;
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
    } else if (a.startsWith('--base=')) out.base = path.resolve(a.slice(7));
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--relatorio=')) out.relatorio = path.resolve(a.slice(12));
    else if (a.startsWith('--amostra-processos=')) {
      const n = Number(a.slice(20));
      if (Number.isFinite(n) && n >= 0) out.amostraProcessosDryRun = Math.trunc(n);
    } else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a === '--sem-verificacao') out.semVerificacao = true;
    else if (a === '--continuar-apesar-falhas') out.continuarApesarFalhas = true;
  }

  return out;
}

export {
  listarProcessosComCabecalhoTxt,
  listarProcessosComDadosCabecalhoTxt,
  listarProcessosIndice152Cliente,
  listarProcessosDropboxCliente,
};

/** @deprecated Use `listarProcessosDropboxCliente` */
export function listarTodosProcessosCliente(baseBanco, codNum) {
  return listarProcessosDropboxCliente(baseBanco, codNum);
}

function filtrarProcessos(procs, opts) {
  return procs.filter((p) => {
    if (opts.processo != null && p !== opts.processo) return false;
    if (opts.processoMin != null && p < opts.processoMin) return false;
    if (opts.processoMax != null && p > opts.processoMax) return false;
    return true;
  });
}

/** União Dropbox + partes 90/95 + Calculos — stubs antes de partes/cálculos. */
export function unirProcessosGarantirImportReal(base, cliente, procsDropbox, opts) {
  /** @type {Set<number>} */
  const set = new Set(procsDropbox);
  if (!opts.semPartes) {
    for (const p of filtrarProcessos(listarProcessosComPartesTxt(base, cliente), opts)) set.add(p);
  }
  if (!opts.semCalculos) {
    for (const p of filtrarProcessos(listarProcessosComCalculosTxt(base, cliente), opts)) set.add(p);
  }
  return [...set].sort((a, b) => a - b);
}

function argsBaseUrl(opts) {
  return [`--base-url=${opts.baseUrl}`];
}

/**
 * @param {string} script
 * @param {string[]} args
 * @returns {number}
 */
function executarScript(script, args) {
  const r = spawnSync(process.execPath, [script, ...args], {
    stdio: 'inherit',
    env: process.env,
    cwd: ROOT,
  });
  return r.status ?? 1;
}

function argsComunsProcesso(opts, processo, extras = []) {
  const args = [
    `--cliente=${opts.cliente}`,
    `--processo=${processo}`,
    `--base=${opts.base}`,
    `--login=${opts.login}`,
    ...argsBaseUrl(opts),
  ];
  if (opts.senha) args.push(`--senha=${opts.senha}`);
  if (opts.dryRun) args.push('--dry-run');
  else args.push('--aplicar');
  if (opts.semImovel) args.push('--sem-imovel');
  return [...args, ...extras];
}

function argsPartesCliente(opts) {
  const args = [
    `--cliente=${opts.cliente}`,
    `--base=${opts.base}`,
    `--login=${opts.login}`,
    ...argsBaseUrl(opts),
  ];
  if (opts.senha) args.push(`--senha=${opts.senha}`);
  if (opts.dryRun) args.push('--dry-run');
  else args.push('--aplicar');
  if (opts.processo != null) args.push(`--processo=${opts.processo}`);
  if (opts.processoMin != null) args.push(`--processo-min=${opts.processoMin}`);
  if (opts.processoMax != null) args.push(`--processo-max=${opts.processoMax}`);
  return args;
}

function executarImportPartes(opts) {
  return executarScript(SCRIPT_PARTES, argsPartesCliente(opts));
}

/** Gerais/…/{cod8}.151.1.0.txt → POST /api/clientes (antes de stubs de processo). */
function executarImportClientePessoa151(opts) {
  const args = [
    `--cliente=${opts.cliente}`,
    `--base=${opts.base}`,
    `--login=${opts.login}`,
    ...argsBaseUrl(opts),
  ];
  if (opts.senha) args.push(`--senha=${opts.senha}`);
  if (opts.dryRun) args.push('--dry-run');
  else args.push('--aplicar');
  if (!opts.semZerar && opts.aplicar) args.push('--substituir');
  return executarScript(SCRIPT_CLIENTE_PESSOA, args);
}

function argsCalculosCliente(opts) {
  const args = [
    `--cliente=${opts.cliente}`,
    `--base=${opts.base}`,
    `--login=${opts.login}`,
    ...argsBaseUrl(opts),
  ];
  if (opts.senha) args.push(`--senha=${opts.senha}`);
  if (opts.dryRun) args.push('--dry-run');
  else args.push('--aplicar');
  if (opts.processo != null) args.push(`--processo=${opts.processo}`);
  if (opts.processoMin != null) args.push(`--processo-min=${opts.processoMin}`);
  if (opts.processoMax != null) args.push(`--processo-max=${opts.processoMax}`);
  return args;
}

/**
 * @returns {{ code: number, status: string }}
 */
function executarImportCalculos(opts) {
  const dir = dirCalculosCliente(opts.cliente, opts.base);
  if (!fs.existsSync(dir)) {
    console.log('\n[6/6] Cálculos: pasta Calculos do cliente ausente — etapa ignorada.\n');
    return { code: 0, status: 'ignorado_sem_pasta' };
  }
  console.log('\n[6/6] Cálculos (import-calculos-txt — Dropbox Calculos → API)…\n');
  const code = executarScript(SCRIPT_CALCULOS, argsCalculosCliente(opts));
  return { code, status: code === 0 ? 'ok' : 'falhou' };
}

/**
 * @param {ReturnType<typeof parseArgs>} opts
 * @param {object} relatorio
 */
async function executarSincronizarStatusProcesso(opts, relatorio) {
  console.log('\n[status] txt `Status.Processo*.Processos` — INATIVO → inativo; demais → ativo…\n');
  try {
    const st = await sincronizarStatusProcessoImportReal(opts, { baseUrl: opts.baseUrl });
    relatorio.etapas.statusProcesso = st;
    console.log(
      `\n[status] concluído: txt=${st.txtStatus} inativos=${st.inativos} ativos=${st.ativos} aplicados=${st.aplicados} pulados=${st.pulados_igual} sem_api=${st.sem_processo_api} falhas=${st.falhas}\n`
    );
    return st.falhas > 0 ? 1 : 0;
  } catch (e) {
    relatorio.etapas.statusProcesso = { erro: e?.message || String(e) };
    console.error('[status] falha:', e?.message || e);
    return 1;
  }
}

function executarImportProcesso(opts, processo, extras = []) {
  return executarScript(SCRIPT_PROCESSO, argsComunsProcesso(opts, processo, extras));
}

/**
 * @param {ReturnType<typeof parseArgs>} opts
 * @param {number[]} [processosAlvo] Processos do lote atual (garantidos mesmo sem 3.1)
 */
function executarGarantirProcessos(opts, processosAlvo = []) {
  const args = [
    `--cliente=${opts.cliente}`,
    `--base=${opts.base}`,
    `--login=${opts.login}`,
    ...argsBaseUrl(opts),
  ];
  if (opts.senha) args.push(`--senha=${opts.senha}`);
  if (opts.dryRun) args.push('--dry-run');
  if (opts.processo != null) {
    args.push(`--processo=${opts.processo}`);
  } else if (processosAlvo.length > 0) {
    args.push(`--processos=${processosAlvo.join(',')}`);
  }
  return executarScript(SCRIPT_GARANTIR_PROCESSOS, args);
}

function executarImportHistoricoCliente(opts) {
  const args = [
    `--cliente=${opts.cliente}`,
    `--base=${opts.base}`,
    `--login=${opts.login}`,
    '--sem-corrigir',
    ...argsBaseUrl(opts),
  ];
  if (opts.processo != null) args.push(`--processo=${opts.processo}`);
  if (opts.aplicarCorrecaoHistorico) {
    args.length = 0;
    args.push(
      `--cliente=${opts.cliente}`,
      `--base=${opts.base}`,
      `--login=${opts.login}`,
      '--aplicar-correcao',
      ...argsBaseUrl(opts),
    );
  }
  if (opts.substituirHistorico) {
    // Só apaga andamentos do(s) processo(s) do cliente (--substituir-andamentos), não toda a origem IMPORT_TXT_LOCAL.
    args.push('--substituir-andamentos', '--nao-limpar-import');
  } else {
    args.push('--nao-limpar-import', '--apenas-novos');
  }
  if (opts.senha) args.push(`--senha=${opts.senha}`);
  if (opts.dryRun) args.push('--dry-run');
  return executarScript(SCRIPT_HISTORICO, args);
}

function imprimirResumoCliente(opts, procs, fonteProcs = '3.1') {
  const cent = centenaPastaClienteHistorico(opts.cliente);
  const pasta = pastaNumeroClienteHistorico(opts.cliente);
  console.log('\n=== import-real ===\n');
  console.log(`Cliente: ${opts.cliente} (${formatCod8(opts.cliente)})`);
  console.log(`Base: ${opts.base}`);
  console.log(`API: ${opts.baseUrl}`);
  console.log(`Pasta Proc: Proc/${SEGMENTO_MIL}/${cent}/${pasta}/`);
  console.log(`Modo: ${opts.dryRun ? 'dry-run' : 'aplicar'}`);
  console.log(
    `Zerar base antes: ${opts.semZerar ? 'não (defeito; use --zerar para alinhar do zero)' : opts.dryRun ? 'simulação (contagens)' : 'sim (--zerar)'}`,
  );
  if (!opts.semHistorico) {
    console.log(
      `Histórico: ${opts.substituirHistorico ? 'substituir andamentos existentes (txt prevalece)' : 'apenas novos (não apaga andamentos na API)'}`
    );
  }
  console.log(`Processos (${fonteProcs}): ${procs.length}`);
  if (procs.length) {
    console.log(`  intervalo: ${procs[0]} … ${procs[procs.length - 1]}`);
  }
  console.log(
    'Etapas:',
    [
      'pessoa cliente (151.1.0)',
      opts.semHistorico ? null : 'histórico (massa)',
      'status Processo (ativo/inativo)',
      'cabeçalho/fase/semânticos por processo',
      opts.semImovel ? null : 'imóvel 0.89.1',
      opts.semPartes ? null : 'partes processo 90/95',
      opts.semCalculos ? null : 'cálculos (Calculos/ txt)',
    ]
      .filter(Boolean)
      .join(' → ')
  );
  console.log('');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const inicio = Date.now();

  if (opts.cliente == null) {
    console.error(
      'Uso: node scripts/import-real.mjs --cliente=N [--dry-run|--aplicar] [--processo=N] [--importar-partes]'
    );
    process.exit(1);
  }

  if (opts.aplicar && !opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA em .env.import.local ou use --senha= para --aplicar');
    process.exit(1);
  }

  if (opts.aplicar) {
    try {
      await verificarApiImportDisponivel(opts.baseUrl);
    } catch (e) {
      console.error(`[import-real] ${e?.message || e}`);
      process.exit(2);
    }
  }

  const procs31 = listarProcessosComCabecalhoTxt(opts.base, opts.cliente);
  const procsCabecalhoTxt = listarProcessosComDadosCabecalhoTxt(opts.base, opts.cliente);
  const procsDropbox = listarProcessosDropboxCliente(opts.base, opts.cliente);
  let fonteProcs = 'dropbox (3.1 + historico HC + 152.1)';
  const procs = filtrarProcessos(procsDropbox, opts);
  const procsCabecalho31 = filtrarProcessos(procsCabecalhoTxt, opts).filter((p) => p >= 1);

  /** @type {object} */
  const relatorio = {
    cliente: opts.cliente,
    modo: opts.dryRun ? 'dry-run' : 'aplicar',
    substituirHistorico: opts.substituirHistorico,
    fonteProcessos: fonteProcs,
    processosCom31: listarProcessosComCabecalhoTxt(opts.base, opts.cliente).length,
    processosComCabecalhoTxt: procsCabecalho31.length,
    processosDropbox: procsDropbox.length,
    processosAlvo: procs.length,
    etapas: {},
    falhas: [],
  };

  imprimirResumoCliente(opts, procs, fonteProcs);

  if (!opts.semZerar) {
    console.log(
      '\n[0] Zerar + alinhar MySQL aos txt Dropbox (histórico, cabeçalho, partes, cálculos, pessoa 151.1.0)…\n'
    );
    const z = await zerarDadosClienteImportReal({
      cliente: opts.cliente,
      processo: opts.processo,
      dryRun: opts.dryRun,
      baseBanco: opts.base,
      processosDropbox: procsDropbox,
    });
    relatorio.etapas.zerarCliente = z;
    imprimirResumoZerarCliente(z);
    if (z.erro) {
      console.error(`[import-real] Zerar cliente: ${z.erro}`);
      process.exit(2);
    }
  } else {
    relatorio.etapas.zerarCliente = 'ignorado';
  }

  if (opts.processo != null && procs.length === 0) {
    console.warn(
      `[aviso] Processo ${opts.processo} sem ficheiro 3.1 — tentando importação mesmo assim (outros txt podem existir).`
    );
    procs.push(opts.processo);
  }

  const procsGarantir = unirProcessosGarantirImportReal(opts.base, opts.cliente, procs, opts);
  if (opts.processo != null && !procsGarantir.includes(opts.processo)) {
    procsGarantir.push(opts.processo);
    procsGarantir.sort((a, b) => a - b);
  }

  if (procsGarantir.length > procs.length) {
    console.log(
      `[garantir] ${procsGarantir.length} processo(s) a garantir na API (Dropbox ${procs.length} + partes/cálculos)\n`
    );
  }

  relatorio.processosGarantir = procsGarantir.length;
  relatorio.baseUrl = opts.baseUrl;

  if (procs.length === 0 && opts.processo == null) {
    console.log('\n[1/1] Pessoa do cliente (151.1.0)…\n');
    const codePessoa = executarImportClientePessoa151(opts);
    relatorio.etapas.pessoaCliente = codePessoa === 0 ? 'ok' : 'falhou';
    if (codePessoa !== 0) {
      relatorio.falhas.push({ etapa: 'pessoaCliente', code: codePessoa });
      console.error('[import-real] Falha ao sincronizar pessoa do cliente — abortando.');
      process.exit(codePessoa);
    }
    if (opts.semZerar) {
      console.error(
        'Nenhum processo no Dropbox (3.1 + histórico HC + 152.1) e --sem-zerar: MySQL não foi alinhado.'
      );
      process.exit(2);
    }
    const z = relatorio.etapas.zerarCliente;
    const mysqlDepois = z?.alinhamentoDropbox?.processosMysql;
    relatorio.etapas.importEtapas = 'omitido_sem_processos_dropbox';
    relatorio.duracaoMs = Date.now() - inicio;
    if (opts.dryRun) {
      console.log(
        `\nDropbox: 0 processo(s). Simulação — alinharia MySQL a 0 (hoje ${z?.processosMysql ?? '?'} na pessoa).\n`
      );
    } else {
      console.log(
        `\nDropbox: 0 processo(s). MySQL alinhado — ${mysqlDepois ?? 0} processo(s) na base.\n`
      );
    }
    if (opts.relatorio) {
      fs.writeFileSync(opts.relatorio, JSON.stringify(relatorio, null, 2), 'utf8');
      console.log(`Relatório: ${opts.relatorio}`);
    }
    console.log(`\n=== import-real concluído (${(relatorio.duracaoMs / 1000).toFixed(1)}s) ===\n`);
    return;
  }

  if (procsCabecalho31.length === 0) {
    console.log(
      `[aviso] Cliente sem txt de cabeçalho (1.1, 3.1, 5.1, 6.1, 7.1, …) — cabeçalho/fase/imóvel omitidos; ${procs.length} processo(s) via historico/152.1.\n`
    );
  } else if (procsCabecalho31.length < procs.length) {
    console.log(
      `[aviso] ${procsCabecalho31.length} processo(s) com txt de cabeçalho (${procs31.length} só com 3.1); ${procs.length} no total.\n`
    );
  }

  // Um único processo: pessoa 151 → garantir stub → import-processo-txt (sem repetir pessoa).
  if (opts.processo != null) {
    console.log('\n[1/5] Pessoa do cliente (151.1.0)…\n');
    const codePessoa = executarImportClientePessoa151(opts);
    relatorio.etapas.pessoaCliente = codePessoa === 0 ? 'ok' : 'falhou';
    if (codePessoa !== 0) {
      relatorio.falhas.push({ etapa: 'pessoaCliente', code: codePessoa });
      console.error('[import-real] Falha ao sincronizar pessoa do cliente — abortando.');
      process.exit(codePessoa);
    }
    if (!opts.dryRun) {
      console.log('\n[2/5] Garantir processos na API (stubs em falta)…\n');
      const codeGarantir = executarGarantirProcessos(opts, procsGarantir);
      relatorio.etapas.garantirProcessos = codeGarantir === 0 ? 'ok' : 'falhou';
      if (codeGarantir !== 0) process.exit(codeGarantir);
    } else {
      relatorio.etapas.garantirProcessos = 'dry-run_omitido';
    }
    console.log(`\n[import-real] Processo único ${opts.processo} — fluxo completo.\n`);
    const extras = ['--sem-cliente-pessoa'];
    if (opts.semHistorico) extras.push('--sem-historico');
    else if (opts.substituirHistorico) extras.push('--substituir-historico');
    if (!opts.aplicarCorrecaoHistorico) extras.push('--sem-corrigir-historico');
    else extras.push('--aplicar-correcao-historico');

    const code = executarImportProcesso(opts, opts.processo, extras);
    relatorio.etapas.processoUnico = code === 0 ? 'ok' : 'falhou';
    if (code !== 0) process.exit(code);

    if (!opts.semPartes) {
      console.log('\n[partes processo 90/95] Processo único — import-processo-partes-txt…\n');
      const codePartes = executarImportPartes(opts);
      relatorio.etapas.partes = codePartes === 0 ? 'ok' : 'falhou';
      if (codePartes !== 0) process.exit(codePartes);
    } else {
      relatorio.etapas.partes = 'ignorado';
    }

    if (!opts.semCalculos) {
      const { code: codeCalculos, status: stCalculos } = executarImportCalculos(opts);
      relatorio.etapas.calculos = stCalculos;
      if (codeCalculos !== 0) {
        relatorio.falhas.push({ etapa: 'calculos', code: codeCalculos });
        process.exit(codeCalculos);
      }
    } else {
      relatorio.etapas.calculos = 'ignorado';
    }

    if (opts.relatorio) {
      relatorio.duracaoMs = Date.now() - inicio;
      fs.writeFileSync(opts.relatorio, JSON.stringify(relatorio, null, 2), 'utf8');
    }
    if (opts.aplicar && !opts.semVerificacao) {
      console.log('\n[verificação] Conferindo API e MySQL após import…\n');
      const ver = await verificarImportRealPosAplicar({ ...opts, procsGarantir });
      relatorio.verificacaoPosImport = ver;
      imprimirVerificacaoImportReal(ver);
      if (!ver.ok) {
        relatorio.falhas.push({ etapa: 'verificacaoPosImport', issues: ver.issues.length });
        if (opts.relatorio) {
          fs.writeFileSync(opts.relatorio, JSON.stringify(relatorio, null, 2), 'utf8');
        }
        console.error('[import-real] Verificação pós-import falhou — abortando.');
        process.exit(ver.exitCode ?? 3);
      }
    }
    console.log(`\n=== import-real concluído (${((Date.now() - inicio) / 1000).toFixed(1)}s) ===\n`);
    return;
  }

  // —— Cliente inteiro ——
  console.log('\n[1/5] Pessoa do cliente (151.1.0)…\n');
  const codePessoa = executarImportClientePessoa151(opts);
  relatorio.etapas.pessoaCliente = codePessoa === 0 ? 'ok' : 'falhou';
  if (codePessoa !== 0) {
    relatorio.falhas.push({ etapa: 'pessoaCliente', code: codePessoa });
    console.error('[import-real] Falha ao sincronizar pessoa do cliente — abortando.');
    process.exit(codePessoa);
  }

  if (!opts.dryRun && procsGarantir.length > 0) {
    console.log('\n[2/5] Garantir processos na API (stubs em falta)…\n');
    const codeGarantir = executarGarantirProcessos(opts, procsGarantir);
    relatorio.etapas.garantirProcessos = codeGarantir === 0 ? 'ok' : 'falhou';
    if (codeGarantir !== 0) {
      relatorio.falhas.push({ etapa: 'garantirProcessos', code: codeGarantir });
      console.error('[import-real] Falha ao garantir processos na API — abortando.');
      process.exit(codeGarantir);
    }
  } else if (opts.dryRun && procsGarantir.length > 0) {
    relatorio.etapas.garantirProcessos = 'dry-run_omitido';
  }

  if (!opts.semHistorico) {
    if (opts.dryRun) {
      relatorio.etapas.historico = 'dry-run_omitido';
      console.log(
        '\n[3/5] Histórico: omitido em dry-run (com --aplicar corre em massa via import-historico-local-txt).\n'
      );
    } else if (opts.processoMin != null || opts.processoMax != null) {
      console.log(`\n[3/5] Histórico (${procs.length} processo(s) no intervalo)…\n`);
      let histOk = 0;
      let histFail = 0;
      /** @type {number[]} */
      const histFalhas = [];
      for (let i = 0; i < procs.length; i++) {
        const p = procs[i];
        if ((i + 1) % 25 === 1 || i === procs.length - 1) {
          console.log(`[histórico] ${i + 1}/${procs.length} — processo ${p}`);
        }
        const codeHist = executarImportHistoricoCliente({ ...opts, processo: p });
        if (codeHist === 0) histOk += 1;
        else {
          histFail += 1;
          histFalhas.push(p);
          relatorio.falhas.push({ etapa: 'historico', processo: p, code: codeHist });
        }
      }
      relatorio.etapas.historico = {
        ok: histOk,
        fail: histFail,
        total: procs.length,
        falhas: histFalhas,
      };
      if (histFail > 0) {
        if (opts.continuarApesarFalhas) {
          console.warn(
            `[import-real] Histórico: ${histFail} falha(s) — continuando (--continuar-apesar-falhas).`
          );
        } else {
          console.error(
            `[import-real] Histórico: ${histFail} falha(s) em ${procs.length} processo(s) — abortando.`
          );
          process.exit(1);
        }
      }
    } else {
      console.log('\n[3/5] Histórico (todos os processos do cliente)…\n');
      const codeHist = executarImportHistoricoCliente(opts);
      relatorio.etapas.historico = codeHist === 0 ? 'ok' : 'falhou';
      if (codeHist !== 0) {
        relatorio.falhas.push({ etapa: 'historico', code: codeHist });
        if (opts.continuarApesarFalhas) {
          console.warn('[import-real] Falha na importação de histórico — continuando (--continuar-apesar-falhas).');
        } else {
          console.error('[import-real] Falha na importação de histórico — abortando.');
          process.exit(codeHist);
        }
      }
    }
  } else {
    relatorio.etapas.historico = 'ignorado';
    console.log('\n[3/5] Histórico ignorado (--sem-historico).\n');
  }

  const codeStatus = await executarSincronizarStatusProcesso(opts, relatorio);
  if (codeStatus !== 0) {
    relatorio.falhas.push({ etapa: 'statusProcesso', code: codeStatus });
    if (!opts.dryRun && !opts.continuarApesarFalhas) {
      console.error('[import-real] Falha na sincronização de status Processo — abortando.');
      process.exit(codeStatus);
    }
    if (!opts.dryRun && opts.continuarApesarFalhas) {
      console.warn('[import-real] Falha na sincronização de status — continuando (--continuar-apesar-falhas).');
    }
  }

  const temCabecalhoTxt = procsCabecalho31.length > 0;
  const procsCabecalhoBase = procsCabecalho31;
  const procsCabecalho =
    opts.dryRun && opts.amostraProcessosDryRun >= 0
      ? procsCabecalhoBase.slice(
          0,
          opts.amostraProcessosDryRun === 0 ? 0 : opts.amostraProcessosDryRun
        )
      : procsCabecalhoBase;

  let ok = 0;
  let fail = 0;
  /** @type {number[]} */
  const falhasProc = [];

  if (!temCabecalhoTxt) {
    relatorio.etapas.processos = 'omitido_sem_cabecalho_txt';
    console.log(
      `\n[4/5] Cabeçalho/fase/imóvel por processo: omitido — sem txt de cabeçalho (${procs.length} processo(s) só no historico).\n`
    );
  } else if (opts.dryRun && procsCabecalho.length < procsCabecalhoBase.length) {
    console.log(
      `\n[4/5] Dry-run: pré-visualização de ${procsCabecalho.length} processo(s) com cabeçalho txt (de ${procsCabecalhoBase.length}; total cliente ${procs.length}).\n`
    );
  } else {
    console.log(
      `\n[4/5] Processos com cabeçalho txt (${procsCabecalhoBase.length} de ${procs.length} no cliente): cabeçalho, fase, semânticos${opts.semImovel ? '' : ', imóvel'}…\n`
    );
  }

  for (let i = 0; temCabecalhoTxt && i < procsCabecalho.length; i++) {
    const p = procsCabecalho[i];
    const extras = ['--sem-historico', '--sem-corrigir-historico', '--sem-cliente-pessoa'];

    console.log(`\n——— processo ${p} (${i + 1}/${procsCabecalho.length}) ———`);
    const code = executarImportProcesso(opts, p, extras);
    if (code === 0) ok += 1;
    else {
      fail += 1;
      falhasProc.push(p);
      relatorio.falhas.push({ etapa: 'processo', processo: p, code });
    }

    if ((i + 1) % 25 === 0 || i === procsCabecalho.length - 1) {
      console.log(`\n[progresso] ${i + 1}/${procsCabecalho.length} — ok=${ok} falha=${fail}\n`);
    }
  }

  if (temCabecalhoTxt) {
    relatorio.etapas.processos = {
      ok,
      fail,
      totalCliente: procs.length,
      totalComCabecalhoTxt: procsCabecalhoBase.length,
      totalCom31: procs31.length,
      executados: procsCabecalho.length,
      falhas: falhasProc,
    };
  }

  if (!opts.semPartes) {
    console.log('\n[5/6] Partes do processo (90/95 — slot VBA cliente/oposta; REQUERIDO inverte polo jurídico)…\n');
    const codePartes = executarImportPartes(opts);
    relatorio.etapas.partes = codePartes === 0 ? 'ok' : 'falhou';
    if (codePartes !== 0) {
      relatorio.falhas.push({ etapa: 'partes', code: codePartes });
      if (opts.continuarApesarFalhas) {
        console.warn('[import-real] Falha na importação de partes — continuando (--continuar-apesar-falhas).');
      } else {
        relatorio.duracaoMs = Date.now() - inicio;
        if (opts.relatorio) {
          fs.writeFileSync(opts.relatorio, JSON.stringify(relatorio, null, 2), 'utf8');
        }
        console.error('[import-real] Falha na importação de partes — abortando.');
        process.exit(codePartes);
      }
    }
  } else {
    relatorio.etapas.partes = 'ignorado';
    console.log('\n[5/6] Partes ignoradas (--sem-partes).\n');
  }

  if (!opts.semCalculos) {
    const { code: codeCalculos, status: stCalculos } = executarImportCalculos(opts);
    relatorio.etapas.calculos = stCalculos;
    if (codeCalculos !== 0) {
      relatorio.falhas.push({ etapa: 'calculos', code: codeCalculos });
      if (opts.continuarApesarFalhas) {
        console.warn('[import-real] Falha na importação de cálculos — continuando (--continuar-apesar-falhas).');
      } else {
        relatorio.duracaoMs = Date.now() - inicio;
        if (opts.relatorio) {
          fs.writeFileSync(opts.relatorio, JSON.stringify(relatorio, null, 2), 'utf8');
        }
        console.error('[import-real] Falha na importação de cálculos — abortando.');
        process.exit(codeCalculos);
      }
    }
  } else {
    relatorio.etapas.calculos = 'ignorado';
    console.log('\n[6/6] Cálculos ignorados (--sem-calculos).\n');
  }

  relatorio.duracaoMs = Date.now() - inicio;

  if (opts.aplicar && !opts.semVerificacao) {
    console.log('\n[verificação] Conferindo API e MySQL após import…\n');
    const ver = await verificarImportRealPosAplicar({ ...opts, procsGarantir });
    relatorio.verificacaoPosImport = ver;
    imprimirVerificacaoImportReal(ver);
    if (!ver.ok) {
      relatorio.falhas.push({ etapa: 'verificacaoPosImport', issues: ver.issues.length });
      if (opts.relatorio) {
        fs.writeFileSync(opts.relatorio, JSON.stringify(relatorio, null, 2), 'utf8');
      }
      if (opts.continuarApesarFalhas) {
        console.warn('[import-real] Verificação pós-import com pendências — continuando (--continuar-apesar-falhas).');
      } else {
        console.error('[import-real] Verificação pós-import falhou — abortando.');
        process.exit(ver.exitCode ?? 3);
      }
    }
  }

  if (opts.relatorio) {
    fs.writeFileSync(opts.relatorio, JSON.stringify(relatorio, null, 2), 'utf8');
    console.log(`Relatório: ${opts.relatorio}`);
  }

  console.log(`\n=== import-real concluído (${(relatorio.duracaoMs / 1000).toFixed(1)}s) ===`);
  if (temCabecalhoTxt) {
    console.log(`Processos: ${ok} ok, ${fail} falha(s)\n`);
    if (fail > 0 && !opts.continuarApesarFalhas) process.exit(1);
  } else {
    console.log('');
  }
  if (relatorio.falhas.length > 0 && opts.continuarApesarFalhas) {
    process.exit(1);
  }
}

const isMain =
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
