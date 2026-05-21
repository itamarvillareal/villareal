#!/usr/bin/env node
/**
 * Garante registos mínimos em /api/processos antes do import-real (ex.: após limpar a tabela).
 */
import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import { formatCod8 } from './lib/historico-local-txt-paths.mjs';
import { garantirProcessoNaApi, loginImportApi } from './lib/vilareal-import-processo-api.mjs';
import { listarProcessosDropboxCliente } from './lib/processos-dropbox-cliente.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = {
    cliente: null,
    processo: null,
    /** @type {number[]} */
    processos: [],
    lista: null,
    base: resolverBaseBancoDados(),
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8081').replace(/\/$/, ''),
    dryRun: false,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--cliente=')) {
      const n = Number(a.slice(10));
      if (Number.isFinite(n) && n >= 1) out.cliente = Math.trunc(n);
    } else if (a.startsWith('--processo=')) {
      const n = Number(a.slice(11));
      if (Number.isFinite(n) && n >= 1) out.processo = Math.trunc(n);
    } else if (a.startsWith('--processos=')) {
      out.processos = a
        .slice(12)
        .split(/[,\s;]+/)
        .map((x) => Math.trunc(Number(x)))
        .filter((n) => Number.isFinite(n) && n >= 1);
    } else if (a.startsWith('--lista=')) out.lista = path.resolve(a.slice(8));
    else if (a.startsWith('--base=')) out.base = path.resolve(a.slice(7));
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
  }
  return out;
}

function mergeProcessosAlvo(baseProcs, opts) {
  /** @type {Set<number>} */
  const set = new Set(baseProcs);
  if (opts.processo != null) set.add(opts.processo);
  for (const p of opts.processos) set.add(p);
  return [...set].sort((a, b) => a - b);
}

async function garantirCliente(opts, codNum) {
  const cod8 = formatCod8(codNum);
  const procs = mergeProcessosAlvo(listarProcessosDropboxCliente(opts.base, codNum), opts);
  if (procs.length === 0) {
    console.log(`[garantir] cliente ${codNum}: sem processos nos txt — nada a fazer`);
    return { criados: 0, existentes: 0, falhas: 0, procs: 0 };
  }

  let criados = 0;
  let existentes = 0;
  let falhas = 0;

  if (opts.dryRun) {
    console.log(`[garantir] dry-run cliente ${codNum}: ${procs.length} processo(s) ${procs.join(',')}`);
    return { criados: 0, existentes: procs.length, falhas: 0, procs: procs.length };
  }

  const token = await loginImportApi(opts.baseUrl, opts.login, opts.senha);
  const pessoaCache = new Map();

  for (const ni of procs) {
    const r = await garantirProcessoNaApi(opts.baseUrl, token, cod8, ni, pessoaCache);
    if (r.ok && !r.criado) {
      existentes += 1;
    } else if (r.ok && r.criado) {
      criados += 1;
      console.log(`[garantir] cliente ${codNum} proc ${ni}: criado`);
    } else {
      falhas += 1;
      console.warn(`[garantir] cliente ${codNum} proc ${ni}: ${r.erro ?? 'falha'}`);
    }
  }

  return { criados, existentes, falhas, procs: procs.length };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.senha && !opts.dryRun) {
    console.error('Defina VILAREAL_IMPORT_SENHA para aplicar');
    process.exit(1);
  }

  /** @type {number[]} */
  let clientes = [];
  if (opts.cliente != null) clientes = [opts.cliente];
  else if (opts.lista && fs.existsSync(opts.lista)) {
    clientes = fs
      .readFileSync(opts.lista, 'utf8')
      .split(/[\s,;]+/)
      .map((x) => Math.trunc(Number(x.replace(/\D/g, ''))))
      .filter((n) => Number.isFinite(n) && n >= 1);
    clientes = [...new Set(clientes)].sort((a, b) => a - b);
  }

  if (clientes.length === 0) {
    console.error(
      'Uso: node scripts/garantir-processos-import-real.mjs --cliente=N [--processo=N | --processos=1,2] | --lista=path'
    );
    process.exit(1);
  }

  let totalCriados = 0;
  let totalFalhas = 0;

  for (let i = 0; i < clientes.length; i++) {
    const c = clientes[i];
    console.log(`\n[garantir] ${i + 1}/${clientes.length} cliente ${c}`);
    const st = await garantirCliente(opts, c);
    totalCriados += st.criados;
    totalFalhas += st.falhas;
  }

  console.log(`\n[garantir] concluído: criados=${totalCriados} falhas=${totalFalhas}\n`);
  if (totalFalhas > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
