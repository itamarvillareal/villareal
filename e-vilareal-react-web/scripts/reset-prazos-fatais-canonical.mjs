#!/usr/bin/env node
/**
 * Substitui prazos fatais na base: apaga todos e grava só os do txt canónico VB
 * (`Gerais/{Milhar}/{Centena}/{Unidade}/*.145.1.*.txt`).
 *
 * Uso:
 *   node scripts/reset-prazos-fatais-canonical.mjs
 *   node scripts/reset-prazos-fatais-canonical.mjs --aplicar
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  DEFAULT_BASE_GERAIS,
  resolverBaseGeraisPrazoFatal,
} from './lib/gerais-145-1-prazo-fatal-mil.mjs';
import { levantarPrazosFataisGeraisMil } from './lib/levantar-prazos-fatais-gerais-mil.mjs';
import {
  aplicarPrazosFataisCanonicalMysql,
  contarPrazosFataisMysql,
  limparTodosPrazosFataisMysql,
} from './lib/prazo-fatal-mysql-reset.mjs';
import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';

function parseArgs(argv) {
  const out = {
    base: DEFAULT_BASE_GERAIS,
    dryRun: true,
    aplicar: false,
    relatorio: path.join(
      'tmp',
      `reset-prazos-fatais-canonical-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`
    ),
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--aplicar') {
      out.aplicar = true;
      out.dryRun = false;
    } else if (a.startsWith('--base=')) out.base = resolverBaseGeraisPrazoFatal(a.slice(7));
    else if (a.startsWith('--relatorio=')) out.relatorio = path.resolve(a.slice(12));
  }
  out.base = resolverBaseGeraisPrazoFatal(out.base);
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(opts.base)) {
    throw new Error(`Pasta Gerais não encontrada: ${opts.base}`);
  }

  const { registos, stats: levantamento } = levantarPrazosFataisGeraisMil(opts.base);

  const conn = await conectarMysqlVilareal();
  let antes;
  let limpeza = null;
  let gravacao = null;
  let depois;
  try {
    antes = await contarPrazosFataisMysql(conn);
    if (!opts.dryRun) {
      limpeza = await limparTodosPrazosFataisMysql(conn);
      gravacao = await aplicarPrazosFataisCanonicalMysql(conn, registos);
      depois = await contarPrazosFataisMysql(conn);
    }
  } finally {
    await conn.end();
  }

  console.log('\n=== Reset prazos fatais (canónico VB) ===\n');
  console.log(`Modo: ${opts.dryRun ? 'dry-run' : 'aplicar'}`);
  console.log(`Gerais: ${opts.base}`);
  console.log(`Txt canónico: ${levantamento.registosUnicos} processo(s) com data válida`);
  console.log('\nAntes (MySQL):');
  console.log(JSON.stringify(antes, null, 2));

  if (opts.dryRun) {
    console.log('\nDry-run: limparia todos os prazos fatais e gravaria só os do txt canónico.');
  } else {
    console.log('\nDepois da limpeza (MySQL):');
    console.log(JSON.stringify(limpeza, null, 2));
    console.log('\nGravação canónica:');
    console.log(JSON.stringify(gravacao, null, 2));
    console.log('\nDepois (MySQL):');
    console.log(JSON.stringify(depois, null, 2));
  }

  const payload = {
    geradoEm: new Date().toISOString(),
    modo: opts.dryRun ? 'dry-run' : 'aplicar',
    baseGerais: opts.base,
    txtCanonical: levantamento,
    mysqlAntes: antes,
    mysqlLimpeza: limpeza,
    mysqlGravacao: gravacao,
    mysqlDepois: depois ?? null,
  };
  fs.mkdirSync(path.dirname(opts.relatorio), { recursive: true });
  fs.writeFileSync(opts.relatorio, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`\nRelatório: ${opts.relatorio}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
