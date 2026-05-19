#!/usr/bin/env node
/**
 * Corrige datas de andamentos (sem data no txt → criação do ficheiro 15)
 * para todos os processos listados em Diagnósticos → Consultas Realizadas na data.
 *
 * Uso:
 *   node scripts/corrigir-andamentos-consultas-realizadas.mjs
 *   node scripts/corrigir-andamentos-consultas-realizadas.mjs --data=18/05/2026 --aplicar
 *   node scripts/corrigir-andamentos-consultas-realizadas.mjs --dry-run
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { DEFAULT_BASE_HISTORICO_LOCAL } from './lib/historico-local-txt-paths.mjs';
import { coletarEntradasHistoricoLocal } from './lib/historico-local-txt-iterar.mjs';
import { resolverAliasHojeEmTexto } from '../src/services/hjDateAliasService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function hojeDdMmYyyy() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function parseArgs(argv) {
  const out = {
    data: hojeDdMmYyyy(),
    aplicar: false,
    base: DEFAULT_BASE_HISTORICO_LOCAL,
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    limite: 0,
  };
  for (const a of argv) {
    if (a === '--aplicar') out.aplicar = true;
    else if (a === '--dry-run') out.aplicar = false;
    else if (a.startsWith('--data=')) out.data = a.slice(7).trim();
    else if (a.startsWith('--base=')) out.base = a.slice(7);
    else if (a.startsWith('--limite=')) out.limite = Number(a.slice(9)) || 0;
  }
  return out;
}

async function login(opts) {
  const r = await fetch(`${opts.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: String(opts.login).trim().toLowerCase(), senha: opts.senha }),
  });
  if (!r.ok) throw new Error(`Login ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const json = await r.json();
  if (!json.accessToken) throw new Error('Sem accessToken');
  return json.accessToken;
}

async function listarConsultasRealizadas(opts, token) {
  const data = resolverAliasHojeEmTexto(opts.data, 'br') ?? opts.data;
  const r = await fetch(
    `${opts.baseUrl}/api/processos/diagnostico/historico-data?data=${encodeURIComponent(data)}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
  );
  if (!r.ok) throw new Error(`historico-data ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const arr = await r.json();
  return { data, rows: Array.isArray(arr) ? arr : [] };
}

function paresUnicosProcessos(rows, dataBr) {
  /** @type {Map<string, { cod: number, proc: number }>} */
  const m = new Map();
  for (const r of rows) {
    if (String(r.data ?? '').trim() !== dataBr) continue;
    const cod = Number(String(r.codigoCliente ?? '').replace(/^0+/, '') || 0);
    const proc = Number(r.numeroInterno);
    if (!Number.isFinite(cod) || cod < 1 || !Number.isFinite(proc) || proc < 1) continue;
    m.set(`${cod}/${proc}`, { cod, proc });
  }
  return [...m.values()].sort((a, b) => a.cod - b.cod || a.proc - b.proc);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA');
    process.exit(1);
  }

  console.log('\n=== corrigir-andamentos-consultas-realizadas ===\n');
  console.log(`Data Consultas Realizadas: ${opts.data}`);
  console.log(`Modo: ${opts.aplicar ? 'aplicar' : 'dry-run'}\n`);

  const token = await login(opts);
  const { data: dataBr, rows } = await listarConsultasRealizadas(opts, token);
  let pares = paresUnicosProcessos(rows, dataBr);
  if (opts.limite > 0) pares = pares.slice(0, opts.limite);

  console.log(`Linhas na consulta: ${rows.length}`);
  console.log(`Processos únicos (data ${dataBr}): ${pares.length}\n`);

  const logPath = path.join(__dirname, '../tmp/corrigir-consultas-realizadas.log');
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const log = (msg) => {
    console.log(msg);
    fs.appendFileSync(logPath, msg + '\n');
  };
  fs.writeFileSync(logPath, `=== ${new Date().toISOString()} data=${dataBr} processos=${pares.length} ===\n`);

  const totais = { puts: 0, posts: 0, iguais: 0, ambiguos: 0, faltantes: 0, falhas: 0, processos: 0 };

  for (let i = 0; i < pares.length; i += 1) {
    const { cod, proc } = pares[i];
    totais.processos += 1;
    log(`\n[${i + 1}/${pares.length}] cliente ${cod} processo ${proc}`);

    let entradas = coletarEntradasHistoricoLocal({
      base: opts.base,
      filtroClienteCod: cod,
      filtroProcesso: proc,
    });
    entradas = entradas.filter((e) => !String(e.dataBruta ?? '').trim());
    if (entradas.length === 0) {
      log('  (sem entradas txt sem data — ignorado)');
      continue;
    }

    const args = [
      path.join(__dirname, 'atualizar-historico-local-txt.mjs'),
      `--cliente=${cod}`,
      `--processo=${proc}`,
      '--somente-sem-data',
    ];
    if (opts.aplicar) args.push('--aplicar');

    const { spawnSync } = await import('node:child_process');
    const r = spawnSync(process.execPath, args, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      env: process.env,
    });
    const out = (r.stdout || '') + (r.stderr || '');
    const mPut = out.match(/puts=(\d+)/);
    const mFal = out.match(/falhas=(\d+)/);
    if (mPut) totais.puts += Number(mPut[1]);
    if (mFal) totais.falhas += Number(mFal[1]);
    log(out.trim().split('\n').slice(-4).join('\n') || `exit ${r.status}`);
    if (r.status !== 0 && r.status !== 2) {
      totais.falhas += 1;
      log(`  ERRO exit ${r.status}`);
    }
  }

  log('\n=== TOTAL ===');
  log(JSON.stringify(totais, null, 2));
  console.log(`\nLog: ${logPath}`);
  process.exit(totais.falhas > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
