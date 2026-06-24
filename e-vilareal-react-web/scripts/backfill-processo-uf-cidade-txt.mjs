#!/usr/bin/env node
/**
 * Backfill uf + cidade em todos os processos com txt 11.1 / 12.1 (Proc ou Gerais).
 *
 * Uso:
 *   node scripts/backfill-processo-uf-cidade-txt.mjs --dry-run
 *   node scripts/backfill-processo-uf-cidade-txt.mjs --aplicar --vps
 *   node scripts/backfill-processo-uf-cidade-txt.mjs --aplicar --vps --dump=tmp/processo-pos-uf-cidade.sql
 *
 * Opções:
 *   --cliente-min= --cliente-max=   (defeito 1..999)
 *   --cliente=N                   Só um cliente
 *   --processo=N                  Só um processo (requer --cliente)
 *   --vps                         API produção
 *   --dump=PATH                   mysqldump tabela processo na VPS ao final (--aplicar)
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { resolverBaseBancoDados } from './lib/gerais-fase-processo-txt.mjs';
import { formatCod8, SEGMENTO_MIL } from './lib/historico-local-txt-paths.mjs';
import { lerCabecalhoProcessoTxt } from './lib/proc-processo-cabecalho-txt.mjs';
import { listarProcessosComDadosCabecalhoTxt } from './lib/processos-dropbox-cliente.mjs';
import { atualizarProcessoApi } from './lib/import-processo-put-body.mjs';
import {
  buscarProcesso,
  loginImportApi,
  resolverClienteFromApi,
} from './lib/vilareal-import-processo-api.mjs';
import {
  resolverBaseUrlImport,
  verificarApiImportDisponivel,
} from './lib/vilareal-import-api-base.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DUMP_SCRIPT = path.join(ROOT, '..', 'scripts', 'vps-dump-processo-tabela.sh');

function parseArgs(argv) {
  const out = {
    base: resolverBaseBancoDados(),
    baseUrl: resolverBaseUrlImport(),
    vps: false,
    dryRun: true,
    aplicar: false,
    cliente: null,
    processo: null,
    clienteMin: 1,
    clienteMax: 999,
    dump: null,
    login: process.env.VILAREAL_IMPORT_LOGIN || 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--aplicar') {
      out.aplicar = true;
      out.dryRun = false;
    } else if (a === '--vps') {
      out.vps = true;
      out.baseUrl = resolverBaseUrlImport(process.env, { vps: true });
    } else if (a.startsWith('--base=')) out.base = path.resolve(a.slice(7));
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--cliente=')) out.cliente = Number(a.slice(10));
    else if (a.startsWith('--processo=')) out.processo = Number(a.slice(11));
    else if (a.startsWith('--cliente-min=')) out.clienteMin = Math.max(1, Number(a.slice(14)) || 1);
    else if (a.startsWith('--cliente-max=')) out.clienteMax = Math.min(999, Number(a.slice(14)) || 999);
    else if (a.startsWith('--dump=')) out.dump = path.resolve(a.slice(7));
    else if (a.startsWith('--login=')) out.login = a.slice(8);
  }
  if (out.clienteMin > out.clienteMax) {
    const t = out.clienteMin;
    out.clienteMin = out.clienteMax;
    out.clienteMax = t;
  }
  return out;
}

/** @returns {number[]} */
function listarClientesComTxt(base) {
  /** @type {Set<number>} */
  const set = new Set();
  for (const sub of ['Proc', 'Gerais']) {
    const dirMil = path.join(base, sub, SEGMENTO_MIL);
    if (!fs.existsSync(dirMil)) continue;
    for (const cent of fs.readdirSync(dirMil, { withFileTypes: true })) {
      if (!cent.isDirectory()) continue;
      const dirCent = path.join(dirMil, cent.name);
      for (const cli of fs.readdirSync(dirCent, { withFileTypes: true })) {
        if (!cli.isDirectory()) continue;
        const n = Number(cli.name);
        if (Number.isFinite(n) && n >= 1 && n <= 999) set.add(Math.trunc(n));
      }
    }
  }
  return [...set].sort((a, b) => a - b);
}

/** @returns {{ uf?: string, cidade?: string }} */
function ufCidadeFromTxt(base, cliente, proc) {
  const cab = lerCabecalhoProcessoTxt(cliente, proc, { baseBanco: base });
  const patch = {};
  if (cab.campos.uf) patch.uf = String(cab.campos.uf);
  if (cab.campos.cidade) patch.cidade = String(cab.campos.cidade);
  return patch;
}

function precisaAtualizar(procApi, patch) {
  const ufApi = String(procApi.uf ?? '').trim();
  const cidApi = String(procApi.cidade ?? '').trim();
  const ufTxt = String(patch.uf ?? '').trim();
  const cidTxt = String(patch.cidade ?? '').trim();
  if (ufTxt && ufApi !== ufTxt) return true;
  if (cidTxt && cidApi !== cidTxt) return true;
  return false;
}

function gerarDumpProcessoVps(saida) {
  const r = spawnSync('bash', [DUMP_SCRIPT, '--yes', `--saida=${saida}`], {
    stdio: 'inherit',
    cwd: path.join(ROOT, '..'),
  });
  if ((r.status ?? 1) !== 0) {
    throw new Error(`Falha ao gerar dump: ${saida}`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.senha && opts.aplicar) {
    console.error('Defina VILAREAL_IMPORT_SENHA em .env.import.local');
    process.exit(2);
  }

  /** @type {number[]} */
  let clientes;
  if (opts.cliente != null && Number.isFinite(opts.cliente)) {
    clientes = [Math.trunc(opts.cliente)];
  } else {
    clientes = listarClientesComTxt(opts.base).filter(
      (c) => c >= opts.clienteMin && c <= opts.clienteMax
    );
  }

  /** @type {{ cliente: number, proc: number, uf?: string, cidade?: string }[]} */
  const pares = [];
  for (const cliente of clientes) {
    let procs = listarProcessosComDadosCabecalhoTxt(opts.base, cliente);
    if (opts.processo != null && Number.isFinite(opts.processo)) {
      procs = procs.filter((p) => p === Math.trunc(opts.processo));
    }
    for (const proc of procs) {
      const patch = ufCidadeFromTxt(opts.base, cliente, proc);
      if (!patch.uf && !patch.cidade) continue;
      pares.push({ cliente, proc, ...patch });
    }
  }

  console.log(`\n=== backfill-processo-uf-cidade-txt ===`);
  console.log(`Base txt: ${opts.base}`);
  console.log(`API: ${opts.baseUrl}`);
  console.log(`Modo: ${opts.aplicar ? 'APLICAR' : 'dry-run'}`);
  console.log(`Pares com uf/cidade no txt: ${pares.length}\n`);

  if (!pares.length) {
    console.log('Nada a fazer.');
    return;
  }

  if (opts.dryRun) {
    for (const p of pares.slice(0, 30)) {
      console.log(
        `${formatCod8(p.cliente)}/${p.proc} → uf=${p.uf ?? '—'} cidade=${p.cidade ?? '—'}`
      );
    }
    if (pares.length > 30) console.log(`… +${pares.length - 30} pares`);
    return;
  }

  await verificarApiImportDisponivel(opts.baseUrl);
  const token = await loginImportApi(opts.baseUrl, opts.login, opts.senha);
  /** @type {Map<string, { clientePk: number, pessoaId: number }>} */
  const clientePorCod8 = new Map();

  let ok = 0;
  let skipSemApi = 0;
  let skipIgual = 0;
  let falhas = 0;

  for (const p of pares) {
    const cod8 = formatCod8(p.cliente);
      const patch = {};
      if (p.uf) patch.uf = p.uf;
      if (p.cidade) patch.cidade = p.cidade;
    try {
      const procApi = await buscarProcesso(opts.baseUrl, token, cod8, p.proc, clientePorCod8);
      if (!procApi?.id) {
        skipSemApi += 1;
        continue;
      }
      if (!precisaAtualizar(procApi, patch)) {
        skipIgual += 1;
        continue;
      }
      await resolverClienteFromApi(opts.baseUrl, token, cod8, clientePorCod8);
      await atualizarProcessoApi(opts.baseUrl, token, procApi, patch);
      ok += 1;
      if (ok <= 20 || ok % 100 === 0) {
        console.log(`[ok] ${cod8}/${p.proc} uf=${patch.uf ?? '—'} cidade=${patch.cidade ?? '—'}`);
      }
    } catch (e) {
      falhas += 1;
      console.warn(`[FALHA] ${cod8}/${p.proc}: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log('\n--- resumo ---');
  console.log(`Atualizados: ${ok}`);
  console.log(`Já iguais: ${skipIgual}`);
  console.log(`Sem processo na API: ${skipSemApi}`);
  console.log(`Falhas: ${falhas}`);

  const dumpPath =
    opts.dump ??
    path.join(process.cwd(), `tmp/processo-pos-uf-cidade-${new Date().toISOString().slice(0, 10)}.sql`);
  if (opts.vps) {
    console.log(`\nGerando dump tabela processo → ${dumpPath}`);
    fs.mkdirSync(path.dirname(dumpPath), { recursive: true });
    gerarDumpProcessoVps(dumpPath);
    console.log(`Dump concluído: ${dumpPath}`);
  } else if (opts.dump) {
    console.warn('\n--dump requer --vps (dump na base MySQL da VPS).');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
