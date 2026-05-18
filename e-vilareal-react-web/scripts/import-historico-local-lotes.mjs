#!/usr/bin/env node
/**
 * Importa histórico local (txt → API) em lotes equilibrados (cliente 728 isolado).
 *
 * Pré-requisito: txt já corrigidos; recomenda-se zerar `processo_andamento` antes
 * (`zerar-historico-andamentos-mysql.mjs`).
 *
 * Uso:
 *   VILAREAL_IMPORT_SENHA='…' node scripts/import-historico-local-lotes.mjs --login=itamar --planejar
 *   VILAREAL_IMPORT_SENHA='…' node scripts/import-historico-local-lotes.mjs --login=itamar --importar
 *   VILAREAL_IMPORT_SENHA='…' node scripts/import-historico-local-lotes.mjs --login=itamar --importar --lote=1
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { montarLotesCorrecaoHistorico } from './lib/historico-local-txt-lotes.mjs';
import { DEFAULT_BASE_HISTORICO_LOCAL } from './lib/historico-local-txt-paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMPORT_SCRIPT = path.join(__dirname, 'import-historico-local-txt.mjs');
const DEFAULT_PLANO = '/tmp/plano-lotes-import-historico-local.json';
const LOG_DIR = '/tmp/import-historico-local-lotes';

function parseArgs(argv) {
  const out = {
    base: DEFAULT_BASE_HISTORICO_LOCAL,
    planoPath: DEFAULT_PLANO,
    importar: false,
    planejar: false,
    lote: null,
    login: null,
    dryRun: false,
    extraArgs: [],
  };
  for (const a of argv) {
    if (a === '--importar') out.importar = true;
    else if (a === '--planejar') out.planejar = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--base=')) out.base = path.resolve(a.slice(7));
    else if (a.startsWith('--plano=')) out.planoPath = path.resolve(a.slice(8));
    else if (a.startsWith('--lote=')) out.lote = Math.trunc(Number(a.slice(7)));
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else out.extraArgs.push(a);
  }
  if (!out.planejar && !out.importar) out.planejar = true;
  return out;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  fs.mkdirSync(LOG_DIR, { recursive: true });

  let plano;
  if (fs.existsSync(opts.planoPath) && opts.importar && !opts.planejar) {
    plano = JSON.parse(fs.readFileSync(opts.planoPath, 'utf8'));
  } else {
    plano = montarLotesCorrecaoHistorico({ base: opts.base });
    fs.writeFileSync(opts.planoPath, JSON.stringify(plano, null, 2), 'utf8');
  }

  console.log(`Plano: ${opts.planoPath} (${plano.lotes.length} lotes, ${plano.totalClientes} clientes)\n`);

  if (!opts.importar) {
    for (const l of plano.lotes) {
      const tag = l.isolado ? ' [728 isolado]' : '';
      console.log(`  Lote ${l.id}${tag}: ${l.clientes.length} clientes, ~${l.processos} processos`);
    }
    console.log('\nImportar:');
    console.log('  VILAREAL_IMPORT_SENHA=… node scripts/import-historico-local-lotes.mjs --importar --login=itamar');
    return;
  }

  if (!opts.login) {
    console.error('Use --login= utilizador da API');
    process.exit(1);
  }

  const lotes = opts.lote != null ? plano.lotes.filter((l) => l.id === opts.lote) : plano.lotes;
  /** @type {object[]} */
  const resultados = [];

  for (const lote of lotes) {
    const t0 = Date.now();
    const clientesFile = path.join(LOG_DIR, `lote-${lote.id}-clientes.txt`);
    fs.writeFileSync(clientesFile, lote.clientes.join('\n'), 'utf8');

    console.log(`\n═══ Import lote ${lote.id} — ${lote.clientes.length} cliente(s), ~${lote.processos} processos ═══`);

    const args = [
      IMPORT_SCRIPT,
      '--sem-corrigir',
      '--nao-limpar-import',
      `--clientes-file=${clientesFile}`,
      `--login=${opts.login}`,
      '--origem=IMPORT_TXT_LOCAL',
      ...opts.extraArgs,
    ];
    if (opts.dryRun) args.push('--dry-run');

    const r = spawnSync(process.execPath, args, {
      stdio: 'inherit',
      env: process.env,
      cwd: path.join(__dirname, '..'),
    });

    const linha = {
      lote: lote.id,
      clientes: lote.clientes,
      exitCode: r.status ?? 1,
      segundos: Number(((Date.now() - t0) / 1000).toFixed(1)),
    };
    resultados.push(linha);
    fs.writeFileSync(path.join(LOG_DIR, `lote-${lote.id}.json`), JSON.stringify(linha, null, 2), 'utf8');

    if (r.status !== 0) {
      console.error(`Lote ${lote.id} falhou com exit ${r.status}`);
      process.exit(r.status ?? 1);
    }
  }

  const resumoPath = path.join(LOG_DIR, 'resumo-importacao.json');
  let payload = { plano, resultados: [] };
  if (fs.existsSync(resumoPath)) {
    try {
      payload = JSON.parse(fs.readFileSync(resumoPath, 'utf8'));
    } catch {
      payload = { plano, resultados: [] };
    }
  }
  payload.plano = plano;
  for (const r of resultados) {
    const i = payload.resultados.findIndex((x) => x.lote === r.lote);
    if (i >= 0) payload.resultados[i] = r;
    else payload.resultados.push(r);
  }
  payload.resultados.sort((a, b) => a.lote - b.lote);
  fs.writeFileSync(resumoPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`\nResumo: ${resumoPath}`);
}

main();
