#!/usr/bin/env node
/**
 * Renumera processo de um cliente (ex.: 299 proc 1474 → 75).
 *
 * Uso:
 *   node scripts/renumerar-proc-cliente.mjs --cod=299 --de=1474 --para=75 --dry-run
 *   node scripts/renumerar-proc-cliente.mjs --cod=299 --de=1474 --para=75 --aplicar
 */

import './lib/load-vilareal-import-env.mjs';

import process from 'node:process';

import { conectarMysqlVilareal } from './lib/mysql-vilareal.mjs';
import { renumerarProcClienteMysql } from './lib/renumerar-proc-cliente.mjs';

function parseArgs(argv) {
  const out = { cod: '299', de: 1474, para: 75, dryRun: true };
  for (const a of argv) {
    if (a === '--aplicar') out.dryRun = false;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--cod=')) out.cod = a.slice(6);
    else if (a.startsWith('--de=')) out.de = Number(a.slice(5));
    else if (a.startsWith('--para=')) out.para = Number(a.slice(7));
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const conn = await conectarMysqlVilareal();
  try {
    const res = await renumerarProcClienteMysql(conn, {
      cod8: opts.cod,
      de: opts.de,
      para: opts.para,
      dryRun: opts.dryRun,
    });
    console.log(JSON.stringify(res, null, 2));
    if (opts.dryRun) {
      console.log('\n(dry-run — use --aplicar para gravar)');
    }
  } finally {
    await conn.end?.();
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
