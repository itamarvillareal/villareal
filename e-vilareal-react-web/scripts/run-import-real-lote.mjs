#!/usr/bin/env node
/**
 * Executa import-real.mjs para uma lista de clientes (JSON gerado por diagnóstico).
 * Uso: node scripts/run-import-real-lote.mjs --lista=tmp/import-real-700-900-vazios-lista.json --aplicar
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(__dirname, 'import-real.mjs');

function parseArgs(argv) {
  const out = { lista: null, aplicar: false, resumo: 'tmp/import-real-lote-summary.jsonl', inicio: 0 };
  for (const a of argv) {
    if (a === '--aplicar') out.aplicar = true;
    else if (a.startsWith('--lista=')) out.lista = path.resolve(a.slice(8));
    else if (a.startsWith('--resumo=')) out.resumo = path.resolve(a.slice(9));
    else if (a.startsWith('--inicio=')) out.inicio = Number(a.slice(9)) || 0;
  }
  return out;
}

function runImport(args) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    stdio: 'inherit',
    cwd: ROOT,
    env: process.env,
  });
  return r.status ?? 1;
}

function appendResumo(file, obj) {
  fs.appendFileSync(file, `${JSON.stringify(obj)}\n`, 'utf8');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.lista || !fs.existsSync(opts.lista)) {
    console.error('Uso: node scripts/run-import-real-lote.mjs --lista=JSON [--aplicar] [--resumo=path]');
    process.exit(1);
  }
  if (opts.aplicar && !process.env.VILAREAL_IMPORT_SENHA) {
    console.error('Defina VILAREAL_IMPORT_SENHA para --aplicar');
    process.exit(1);
  }

  /** @type {{ cod: number, procs31: number, procs: number[], semCliente?: boolean }[]} */
  const lista = JSON.parse(fs.readFileSync(opts.lista, 'utf8'));
  const slice = lista.slice(opts.inicio);
  const modo = opts.aplicar ? '--aplicar' : '--dry-run';

  console.log(`\n=== Lote import-real: ${slice.length} cliente(s) (início=${opts.inicio}) ===\n`);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < slice.length; i++) {
    const item = slice[i];
    const c = item.cod;
    const rel = `tmp/import-real-cliente-${c}.json`;
    const t0 = Date.now();
    console.log(`\n########## [${i + 1}/${slice.length}] Cliente ${c} ##########\n`);

    let code = 0;

    if (item.procs31 > 0) {
      const args = [`--cliente=${c}`, modo, `--relatorio=${rel}`];
      code = runImport(args);
    } else if (item.procs?.length) {
      let falhas = 0;
      for (const p of item.procs) {
        if (p < 1) continue;
        console.log(`\n--- processo ${p} (sem 3.1) ---\n`);
        const pc = runImport([`--cliente=${c}`, `--processo=${p}`, modo, `--relatorio=${rel}`]);
        if (pc !== 0) falhas += 1;
      }
      code = falhas > 0 ? 1 : 0;
    } else {
      console.warn(`[aviso] Cliente ${c} sem processos detectados — ignorado`);
      code = 2;
    }

    const dur = Math.round((Date.now() - t0) / 1000);
    const st = code === 0 ? 'ok' : 'fail';
    if (code === 0) ok += 1;
    else fail += 1;

    appendResumo(opts.resumo, {
      cliente: c,
      status: st,
      code,
      duracaoS: dur,
      procs31: item.procs31,
      relatorio: rel,
      ts: new Date().toISOString(),
    });
    console.log(`\n[lote] cliente ${c} → ${st} (${dur}s)\n`);
  }

  console.log(`\n=== Lote concluído: ok=${ok} fail=${fail} ===\n`);
  console.log(`Resumo: ${opts.resumo}\n`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
