#!/usr/bin/env node
/**
 * Reimporta histórico local (txt → API) para cada cliente cadastrado na API,
 * com parser mm/dd corrigido. Por cliente: --substituir-andamentos (só processos
 * desse cliente) + --nao-limpar-import (não apaga origem global).
 *
 * Uso:
 *   node scripts/reimport-historico-todos-clientes-api.mjs --dry-run
 *   node scripts/reimport-historico-todos-clientes-api.mjs --aplicar
 *   node scripts/reimport-historico-todos-clientes-api.mjs --aplicar --resume-from=500
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { loginImportApi } from './lib/vilareal-import-processo-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMPORT_SCRIPT = path.join(__dirname, 'import-historico-local-txt.mjs');
const LOG_DIR = path.join(__dirname, '..', 'tmp', 'reimport-historico-todos');

function parseArgs(argv) {
  const out = {
    aplicar: false,
    dryRun: false,
    resumeFrom: null,
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
    limite: null,
  };
  for (const a of argv) {
    if (a === '--aplicar') out.aplicar = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--resume-from=')) {
      const n = Number(a.slice(14));
      if (Number.isFinite(n) && n >= 1) out.resumeFrom = Math.trunc(n);
    } else if (a.startsWith('--limite=')) out.limite = Math.max(1, Number(a.slice(9)) || 0);
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
  }
  if (!out.aplicar && !out.dryRun) out.dryRun = true;
  return out;
}

function codNumFromCod8(cod8) {
  const n = Number.parseInt(String(cod8).replace(/\D/g, ''), 10);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

async function listarCodigosClienteNaApi(baseUrl, token) {
  const res = await fetch(`${baseUrl}/api/clientes`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`GET /api/clientes: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  const list = await res.json();
  if (!Array.isArray(list)) return [];
  const nums = new Set();
  for (const c of list) {
    const cod = codNumFromCod8(c.codigoCliente ?? c.codigo);
    if (cod != null) nums.add(cod);
  }
  return [...nums].sort((a, b) => a - b);
}

function importarCliente(opts, cod) {
  const args = [
    IMPORT_SCRIPT,
    `--cliente=${cod}`,
    '--sem-corrigir',
    '--substituir-andamentos',
    '--nao-limpar-import',
    '--sem-criar-processos',
    `--login=${opts.login}`,
    '--origem=IMPORT_TXT_LOCAL',
  ];
  if (opts.senha) args.push(`--senha=${opts.senha}`);
  if (opts.dryRun || !opts.aplicar) args.push('--dry-run');

  const t0 = Date.now();
  const r = spawnSync(process.execPath, args, {
    stdio: 'pipe',
    encoding: 'utf8',
    env: process.env,
    cwd: path.join(__dirname, '..'),
  });
  const seg = Number(((Date.now() - t0) / 1000).toFixed(1));
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const entradas = out.match(/entradas a importar: (\{[^}]+\})/)?.[1] ?? null;
  const criados = out.match(/POST andamentos com sucesso: (\d+)/)?.[1] ?? null;
  return {
    cod,
    exitCode: r.status ?? 1,
    segundos: seg,
    entradas,
    criados: criados != null ? Number(criados) : null,
    tail: out.split('\n').slice(-8).join('\n'),
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.aplicar && !opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA para --aplicar');
    process.exit(1);
  }

  fs.mkdirSync(LOG_DIR, { recursive: true });
  const resumoPath = path.join(LOG_DIR, 'resumo.json');

  console.log(`API: ${opts.baseUrl}`);
  console.log(`Modo: ${opts.aplicar ? 'APLICAR' : 'dry-run'}`);
  if (opts.resumeFrom) console.log(`Retomar a partir do cliente: ${opts.resumeFrom}`);

  const token = await loginImportApi(opts.baseUrl, opts.login, opts.senha || 'x');
  let clientes = await listarCodigosClienteNaApi(opts.baseUrl, token);
  if (opts.resumeFrom) {
    clientes = clientes.filter((c) => c >= opts.resumeFrom);
  }
  if (opts.limite) clientes = clientes.slice(0, opts.limite);

  console.log(`Clientes na API a processar: ${clientes.length}\n`);

  /** @type {object[]} */
  const resultados = [];
  let ok = 0;
  let falha = 0;
  let vazio = 0;

  for (let i = 0; i < clientes.length; i += 1) {
    const cod = clientes[i];
    if ((i + 1) % 10 === 1 || i === clientes.length - 1) {
      console.log(`\n[${i + 1}/${clientes.length}] cliente ${cod}…`);
    }
    const r = importarCliente(opts, cod);
    resultados.push(r);
    if (r.exitCode === 0) {
      if (r.entradas?.includes('"entradasLidas":0')) vazio += 1;
      else ok += 1;
    } else {
      falha += 1;
      console.error(`  FALHA cliente ${cod} (exit ${r.exitCode}, ${r.segundos}s)`);
      if (r.tail) console.error(r.tail);
    }
    if ((i + 1) % 25 === 0) {
      fs.writeFileSync(resumoPath, JSON.stringify({ ok, falha, vazio, resultados }, null, 2));
    }
  }

  const resumo = {
    modo: opts.aplicar ? 'aplicar' : 'dry-run',
    total: clientes.length,
    ok,
    falha,
    semTxt: vazio,
    concluidoEm: new Date().toISOString(),
    resultados,
  };
  fs.writeFileSync(resumoPath, JSON.stringify(resumo, null, 2));

  console.log('\n--- Resumo ---');
  console.log(JSON.stringify({ total: resumo.total, ok, falha, semTxt: vazio }, null, 2));
  console.log(`Detalhe: ${resumoPath}`);

  if (falha > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
