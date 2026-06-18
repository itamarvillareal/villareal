#!/usr/bin/env node
/**
 * Executa reimportação de histórico (texto completo) cliente a cliente.
 *
 * Uso:
 *   node scripts/executar-reimport-historico-texto.mjs
 *   node scripts/executar-reimport-historico-texto.mjs --continuar
 *   node scripts/executar-reimport-historico-texto.mjs --cliente=426
 *   node scripts/executar-reimport-historico-texto.mjs --pesados-por-ultimo
 *
 * Requer `.env.import.local` com VILAREAL_IMPORT_SENHA (e opcional VILAREAL_IMPORT_LOGIN).
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMPORT_SCRIPT = path.join(__dirname, 'import-historico-local-txt.mjs');
const DEFAULT_LISTA = path.join(__dirname, '../tmp/reimport-historico-processos.txt');
const DEFAULT_CHECKPOINT = path.join(__dirname, '../tmp/reimport-historico-checkpoint.json');
const DEFAULT_LOG = path.join(__dirname, '../tmp/reimport-historico-exec.log');

/** Clientes com histórico muito grande — processados no fim se --pesados-por-ultimo. */
const CLIENTES_PESADOS = new Set([728, 752, 578, 600, 800, 54, 149, 473, 491, 928]);

function parseArgs(argv) {
  const out = {
    lista: DEFAULT_LISTA,
    checkpoint: DEFAULT_CHECKPOINT,
    log: DEFAULT_LOG,
    continuar: false,
    clienteFiltro: null,
    pesadosPorUltimo: true,
    dryRun: false,
    excluir: /** @type {Set<number>} */ (new Set()),
  };
  for (const a of argv) {
    if (a === '--continuar') out.continuar = true;
    else if (a === '--pesados-por-ultimo') out.pesadosPorUltimo = true;
    else if (a === '--sem-pesados-por-ultimo') out.pesadosPorUltimo = false;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--lista=')) out.lista = path.resolve(a.slice(8));
    else if (a.startsWith('--checkpoint=')) out.checkpoint = path.resolve(a.slice(13));
    else if (a.startsWith('--log=')) out.log = path.resolve(a.slice(6));
    else if (a.startsWith('--cliente=')) {
      const n = Number(a.slice(10));
      if (Number.isFinite(n) && n >= 1) out.clienteFiltro = Math.trunc(n);
    } else if (a.startsWith('--excluir=')) {
      for (const part of a.slice(9).split(/[,;\s]+/)) {
        const n = Math.trunc(Number(part));
        if (Number.isFinite(n) && n >= 1) out.excluir.add(n);
      }
    }
  }
  return out;
}

function logLine(logPath, msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logPath, line, 'utf8');
  console.log(msg);
}

/** @returns {number[]} */
function clientesDaLista(listaPath) {
  const raw = fs.readFileSync(listaPath, 'utf8');
  const set = new Set();
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const cod = Math.trunc(Number(t.split(',')[0]));
    if (Number.isFinite(cod) && cod >= 1) set.add(cod);
  }
  return [...set].sort((a, b) => a - b);
}

function ordenarClientes(codigos, pesadosPorUltimo) {
  if (!pesadosPorUltimo) return codigos;
  const leves = codigos.filter((c) => !CLIENTES_PESADOS.has(c));
  const pesados = codigos.filter((c) => CLIENTES_PESADOS.has(c));
  return [...leves, ...pesados];
}

function carregarCheckpoint(p) {
  if (!fs.existsSync(p)) return { concluidos: [], falhas: [] };
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return { concluidos: [], falhas: [] };
  }
}

function gravarCheckpoint(p, data) {
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const login = (process.env.VILAREAL_IMPORT_LOGIN || 'itamar').trim();
  const senha = (process.env.VILAREAL_IMPORT_SENHA || '').trim();

  if (!senha && !opts.dryRun) {
    console.error('Defina VILAREAL_IMPORT_SENHA em .env.import.local');
    process.exit(1);
  }
  if (!fs.existsSync(opts.lista)) {
    console.error(`Lista não encontrada: ${opts.lista}`);
    process.exit(1);
  }

  let clientes = clientesDaLista(opts.lista);
  if (opts.clienteFiltro != null) clientes = clientes.filter((c) => c === opts.clienteFiltro);
  if (opts.excluir.size) {
    clientes = clientes.filter((c) => !opts.excluir.has(c));
  }
  clientes = ordenarClientes(clientes, opts.pesadosPorUltimo);

  const cp = carregarCheckpoint(opts.checkpoint);
  const concluidos = new Set(cp.concluidos ?? []);
  if (opts.continuar) {
    clientes = clientes.filter((c) => !concluidos.has(c));
  }

  fs.mkdirSync(path.dirname(opts.log), { recursive: true });
  logLine(opts.log, `=== Início reimport histórico texto (${clientes.length} cliente(s) pendente(s)) ===`);
  logLine(opts.log, `login=${login} dryRun=${opts.dryRun}`);

  const t0 = Date.now();
  let ok = 0;
  let falha = 0;

  for (let i = 0; i < clientes.length; i += 1) {
    const cod = clientes[i];
    const tag = `[${i + 1}/${clientes.length}] cliente ${cod}`;
    logLine(opts.log, `${tag} — a iniciar…`);

    const args = [
      IMPORT_SCRIPT,
      `--cliente=${cod}`,
      '--sem-corrigir',
      `--login=${login}`,
      '--substituir-andamentos',
      '--nao-limpar-import',
    ];
    if (opts.dryRun) args.push('--dry-run');

    const t1 = Date.now();
    const r = spawnSync(process.execPath, args, {
      cwd: path.join(__dirname, '..'),
      env: process.env,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    const elapsed = ((Date.now() - t1) / 1000).toFixed(1);

    if (r.status === 0) {
      ok += 1;
      concluidos.add(cod);
      cp.concluidos = [...concluidos].sort((a, b) => a - b);
      gravarCheckpoint(opts.checkpoint, cp);
      logLine(opts.log, `${tag} — OK (${elapsed}s)`);
    } else {
      falha += 1;
      cp.falhas = cp.falhas ?? [];
      cp.falhas.push({ cliente: cod, em: new Date().toISOString(), status: r.status, stderr: (r.stderr || '').slice(0, 500) });
      gravarCheckpoint(opts.checkpoint, cp);
      logLine(opts.log, `${tag} — FALHA status=${r.status} (${elapsed}s)`);
      if (r.stderr) logLine(opts.log, r.stderr.slice(0, 800));
    }
  }

  const total = ((Date.now() - t0) / 1000 / 60).toFixed(1);
  logLine(opts.log, `=== Fim: ok=${ok} falhas=${falha} tempo=${total} min ===`);
  process.exit(falha > 0 ? 1 : 0);
}

main();
