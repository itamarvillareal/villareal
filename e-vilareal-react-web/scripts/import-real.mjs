#!/usr/bin/env node
/**
 * Importação real completa de um cliente a partir dos txt locais (Dropbox «Banco de Dados»).
 *
 * Consolida, num único comando, tudo o que antes exigia vários scripts:
 *   - Pessoa do cadastro Clientes (`Gerais/…/151.1.0` → API clientes — independente de processo)
 *   - Cabeçalho do processo (Proc/Gerais, semânticos, fase, status, prazo)
 *   - Histórico HC (`import-historico-local-txt.mjs`, em massa por cliente)
 *   - Vínculo imóvel `0.89.1` (por processo)
 *   - Partes do processo (`Proc/…/90` e `95` por proc) — `import-processo-partes-txt.mjs` (por defeito; `--sem-partes` omite)
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
 *   --importar-partes        (legado; partes já correm por defeito)
 *   --substituir-historico   Apaga andamentos IMPORT_TXT_LOCAL antes (só com um cliente)
 *   --aplicar-correcao-historico  Corrige txt (índice 14) antes do histórico (lento; por defeito não)
 *   --base=PATH              Raiz «Banco de Dados»
 *   --relatorio=JSON         Relatório final da execução
 *   --amostra-processos=N    Em --dry-run, quantos processos pré-visualizar (defeito: 3; 0 = nenhum)
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import {
  centenaPastaClienteHistorico,
  formatCod8,
  pastaNumeroClienteHistorico,
  SEGMENTO_MIL,
} from './lib/historico-local-txt-paths.mjs';
import { listarProcessosHistoricoCliente } from './lib/historico-local-txt-correcao.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SCRIPT_PROCESSO = path.join(__dirname, 'import-processo-txt.mjs');
const SCRIPT_HISTORICO = path.join(__dirname, 'import-historico-local-txt.mjs');
const SCRIPT_PARTES = path.join(__dirname, 'import-processo-partes-txt.mjs');

function parseArgs(argv) {
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
    substituirHistorico: false,
    aplicarCorrecaoHistorico: false,
    base: resolverBaseBancoDados(),
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    relatorio: null,
    amostraProcessosDryRun: 3,
  };

  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--aplicar') {
      out.aplicar = true;
      out.dryRun = false;
    } else if (a === '--sem-historico') out.semHistorico = true;
    else if (a === '--sem-imovel') out.semImovel = true;
    else if (a === '--sem-partes') out.semPartes = true;
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
    }
  }

  return out;
}

/**
 * Processos com ficheiro de protocolo `3.1` na pasta Proc do cliente.
 * @param {string} baseBanco
 * @param {number} codNum
 * @returns {number[]}
 */
export function listarProcessosComCabecalhoTxt(baseBanco, codNum) {
  const cent = centenaPastaClienteHistorico(codNum);
  const pastaCli = pastaNumeroClienteHistorico(codNum);
  const cod8 = formatCod8(codNum);
  const dir = path.join(baseBanco, 'Proc', SEGMENTO_MIL, String(cent), pastaCli);
  if (!fs.existsSync(dir)) return [];

  const re = new RegExp(`^${cod8}\\.3\\.1\\.(\\d+)\\.txt$`, 'i');
  /** @type {number[]} */
  const procs = [];
  for (const f of fs.readdirSync(dir)) {
    const m = re.exec(f);
    if (m) procs.push(Number.parseInt(m[1], 10));
  }
  return [...new Set(procs)].sort((a, b) => a - b);
}

/**
 * Processos com ficheiro de índice `152.1` na pasta mil (HC / Inativos).
 * Alguns clientes legados não têm `3.1` em Proc mas têm histórico completo em 152.1.
 */
export function listarProcessosIndice152Cliente(baseBanco, codNum) {
  const cent = centenaPastaClienteHistorico(codNum);
  const pastaCli = pastaNumeroClienteHistorico(codNum);
  const cod8 = formatCod8(codNum);
  const re = new RegExp(`^${cod8.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.152\\.1\\.(\\d+)\\.txt$`, 'i');
  /** @type {number[]} */
  const procs = [];
  for (const pre of ['HC', 'Historico de Consultas Inativos']) {
    const dir = path.join(baseBanco, pre, SEGMENTO_MIL, String(cent), pastaCli);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      const m = re.exec(f);
      if (m) procs.push(Number.parseInt(m[1], 10));
    }
  }
  return [...new Set(procs)].sort((a, b) => a - b);
}

function filtrarProcessos(procs, opts) {
  return procs.filter((p) => {
    if (opts.processo != null && p !== opts.processo) return false;
    if (opts.processoMin != null && p < opts.processoMin) return false;
    if (opts.processoMax != null && p > opts.processoMax) return false;
    return true;
  });
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
  ];
  if (opts.senha) args.push(`--senha=${opts.senha}`);
  if (opts.dryRun) args.push('--dry-run');
  else args.push('--aplicar');
  if (opts.semImovel) args.push('--sem-imovel');
  return [...args, ...extras];
}

function argsPartesCliente(opts) {
  const args = [`--cliente=${opts.cliente}`, `--base=${opts.base}`, `--login=${opts.login}`];
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

function executarImportProcesso(opts, processo, extras = []) {
  return executarScript(SCRIPT_PROCESSO, argsComunsProcesso(opts, processo, extras));
}

function executarImportHistoricoCliente(opts) {
  const args = [
    `--cliente=${opts.cliente}`,
    `--base=${opts.base}`,
    `--login=${opts.login}`,
    '--sem-corrigir',
  ];
  if (opts.processo != null) args.push(`--processo=${opts.processo}`);
  if (opts.aplicarCorrecaoHistorico) {
    args.length = 0;
    args.push(
      `--cliente=${opts.cliente}`,
      `--base=${opts.base}`,
      `--login=${opts.login}`,
      '--aplicar-correcao'
    );
  }
  if (opts.substituirHistorico) {
    args.push('--substituir-andamentos');
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
  console.log(`Pasta Proc: Proc/${SEGMENTO_MIL}/${cent}/${pasta}/`);
  console.log(`Modo: ${opts.dryRun ? 'dry-run' : 'aplicar'}`);
  console.log(`Processos (${fonteProcs}): ${procs.length}`);
  if (procs.length) {
    console.log(`  intervalo: ${procs[0]} … ${procs[procs.length - 1]}`);
  }
  console.log(
    'Etapas:',
    [
      'pessoa cliente (151.1.0)',
      opts.semHistorico ? null : 'histórico (massa)',
      'cabeçalho/fase/semânticos por processo',
      opts.semImovel ? null : 'imóvel 0.89.1',
      opts.semPartes ? null : 'partes processo 90/95',
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

  let todosProcs = listarProcessosComCabecalhoTxt(opts.base, opts.cliente);
  let fonteProcs = 'cabecalho 3.1';
  if (todosProcs.length === 0) {
    todosProcs = listarProcessosHistoricoCliente(opts.base, opts.cliente);
    fonteProcs = 'historico HC (14 / 15–17)';
  }
  if (todosProcs.length === 0) {
    todosProcs = listarProcessosIndice152Cliente(opts.base, opts.cliente);
    fonteProcs = 'historico HC (152.1)';
  }
  const procs = filtrarProcessos(todosProcs, opts);

  /** @type {object} */
  const relatorio = {
    cliente: opts.cliente,
    modo: opts.dryRun ? 'dry-run' : 'aplicar',
    fonteProcessos: fonteProcs,
    processosCom31: listarProcessosComCabecalhoTxt(opts.base, opts.cliente).length,
    processosAlvo: procs.length,
    etapas: {},
    falhas: [],
  };

  imprimirResumoCliente(opts, procs, fonteProcs);

  if (opts.processo != null && procs.length === 0) {
    console.warn(
      `[aviso] Processo ${opts.processo} sem ficheiro 3.1 — tentando importação mesmo assim (outros txt podem existir).`
    );
    procs.push(opts.processo);
  }

  if (procs.length === 0 && opts.processo == null) {
    console.error(
      'Nenhum processo encontrado (sem cabecalho 3.1 nem ficheiros de historico HC para este cliente).'
    );
    process.exit(2);
  }

  if (fonteProcs.startsWith('historico')) {
    console.log(
      `[aviso] Cliente sem ficheiros 3.1 em Proc — lista de processos vem do historico (${procs.length} processo(s)).\n`
    );
  }

  // Um único processo: delega ao import-processo-txt (histórico por processo, fluxo completo).
  if (opts.processo != null) {
    console.log(`\n[import-real] Processo único ${opts.processo} — fluxo completo.\n`);
    const extras = ['--sem-cliente-pessoa'];
    if (opts.semHistorico) extras.push('--sem-historico');
    if (opts.substituirHistorico) extras.push('--substituir-historico');
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

    if (opts.relatorio) {
      relatorio.duracaoMs = Date.now() - inicio;
      fs.writeFileSync(opts.relatorio, JSON.stringify(relatorio, null, 2), 'utf8');
    }
    console.log(`\n=== import-real concluído (${((Date.now() - inicio) / 1000).toFixed(1)}s) ===\n`);
    return;
  }

  // —— Cliente inteiro ——
  const primeiro = procs[0];

  console.log('\n[1/4] Pessoa do cliente (151.1.0)…\n');
  const codePessoa = executarImportProcesso(opts, primeiro, [
    '--sem-historico',
    '--sem-corrigir-historico',
  ]);
  relatorio.etapas.pessoaCliente = codePessoa === 0 ? 'ok' : 'falhou';
  if (codePessoa !== 0) {
    relatorio.falhas.push({ etapa: 'pessoaCliente', processo: primeiro, code: codePessoa });
    console.error('[import-real] Falha ao sincronizar pessoa do cliente — abortando.');
    process.exit(codePessoa);
  }

  if (!opts.semHistorico) {
    if (opts.dryRun) {
      relatorio.etapas.historico = 'dry-run_omitido';
      console.log(
        '\n[2/4] Histórico: omitido em dry-run (com --aplicar corre em massa via import-historico-local-txt).\n'
      );
    } else if (opts.processoMin != null || opts.processoMax != null) {
      console.log(`\n[2/4] Histórico (${procs.length} processo(s) no intervalo)…\n`);
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
        console.error(
          `[import-real] Histórico: ${histFail} falha(s) em ${procs.length} processo(s) — abortando.`
        );
        process.exit(1);
      }
    } else {
      console.log('\n[2/4] Histórico (todos os processos do cliente)…\n');
      const codeHist = executarImportHistoricoCliente(opts);
      relatorio.etapas.historico = codeHist === 0 ? 'ok' : 'falhou';
      if (codeHist !== 0) {
        relatorio.falhas.push({ etapa: 'historico', code: codeHist });
        console.error('[import-real] Falha na importação de histórico — abortando.');
        process.exit(codeHist);
      }
    }
  } else {
    relatorio.etapas.historico = 'ignorado';
    console.log('\n[2/4] Histórico ignorado (--sem-historico).\n');
  }

  const temCabecalho31 = relatorio.processosCom31 > 0;
  const procsCabecalho =
    opts.dryRun && opts.amostraProcessosDryRun >= 0
      ? procs.slice(0, opts.amostraProcessosDryRun === 0 ? 0 : opts.amostraProcessosDryRun)
      : procs;

  let ok = 0;
  let fail = 0;
  /** @type {number[]} */
  const falhasProc = [];

  if (!temCabecalho31) {
    relatorio.etapas.processos = 'omitido_sem_cabecalho_31';
    console.log(
      `\n[3/4] Cabeçalho/fase/imóvel por processo: omitido — cliente sem ficheiros 3.1 em Proc (${procs.length} processo(s) só no historico).\n`
    );
  } else if (opts.dryRun && procsCabecalho.length < procs.length) {
    console.log(
      `\n[3/4] Dry-run: pré-visualização de ${procsCabecalho.length} processo(s) (de ${procs.length}; use --amostra-processos=N ou --aplicar para todos).\n`
    );
  } else {
    console.log(
      `\n[3/4] Processos (${procs.length}): cabeçalho, fase, semânticos${opts.semImovel ? '' : ', imóvel'}…\n`
    );
  }

  for (let i = 0; temCabecalho31 && i < procsCabecalho.length; i++) {
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

  if (temCabecalho31) {
    relatorio.etapas.processos = {
      ok,
      fail,
      total: procs.length,
      executados: procsCabecalho.length,
      falhas: falhasProc,
    };
  }

  if (!opts.semPartes) {
    console.log('\n[4/4] Partes do processo (90/95 — não confundir com 151.1.0)…\n');
    const codePartes = executarImportPartes(opts);
    relatorio.etapas.partes = codePartes === 0 ? 'ok' : 'falhou';
    if (codePartes !== 0) {
      relatorio.falhas.push({ etapa: 'partes', code: codePartes });
      relatorio.duracaoMs = Date.now() - inicio;
      if (opts.relatorio) {
        fs.writeFileSync(opts.relatorio, JSON.stringify(relatorio, null, 2), 'utf8');
      }
      console.error('[import-real] Falha na importação de partes — abortando.');
      process.exit(codePartes);
    }
  } else {
    relatorio.etapas.partes = 'ignorado';
    console.log('\n[4/4] Partes ignoradas (--sem-partes).\n');
  }

  relatorio.duracaoMs = Date.now() - inicio;

  if (opts.relatorio) {
    fs.writeFileSync(opts.relatorio, JSON.stringify(relatorio, null, 2), 'utf8');
    console.log(`Relatório: ${opts.relatorio}`);
  }

  console.log(`\n=== import-real concluído (${(relatorio.duracaoMs / 1000).toFixed(1)}s) ===`);
  if (temCabecalho31) {
    console.log(`Processos: ${ok} ok, ${fail} falha(s)\n`);
    if (fail > 0) process.exit(1);
  } else {
    console.log('');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
