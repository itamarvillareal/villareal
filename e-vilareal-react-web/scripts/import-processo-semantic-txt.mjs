#!/usr/bin/env node
/**
 * Importa papel do cliente e audiência a partir dos txt semânticos (legado VB).
 *
 * Uso:
 *   node scripts/import-processo-semantic-txt.mjs --dry-run
 *   VILAREAL_IMPORT_SENHA='…' node scripts/import-processo-semantic-txt.mjs --aplicar --login=itamar
 *
 * Opções: --cliente=N --apenas-diferentes --relatorio=JSON
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import process from 'node:process';
import { levantarCamposSemanticosProcesso } from './lib/proc-processo-semantic-txt.mjs';
import { buscarProcesso, loginImportApi } from './lib/vilareal-import-processo-api.mjs';
import { corpoPutProcesso, atualizarProcessoApi } from './lib/import-processo-put-body.mjs';

function parseArgs(argv) {
  const out = {
    dryRun: true,
    aplicar: false,
    login: 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    clienteFiltro: null,
    apenasDiferentes: false,
    relatorio: null,
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8081').replace(/\/$/, ''),
    concurrency: Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY) || 5),
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--aplicar') {
      out.aplicar = true;
      out.dryRun = false;
    } else if (a === '--apenas-diferentes') out.apenasDiferentes = true;
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--relatorio=')) out.relatorio = a.slice(12);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
    else if (a.startsWith('--cliente=')) {
      const n = Number(a.slice(10));
      if (Number.isFinite(n) && n >= 1) out.clienteFiltro = Math.trunc(n);
    } else if (a.startsWith('--concurrency=')) {
      out.concurrency = Math.max(1, Number(a.slice(14)) || 5);
    }
  }
  return out;
}

function precisaAtualizar(proc, campos, opts) {
  const patch = { ...campos };
  if (!opts.apenasDiferentes) return { aplicar: true, patch };
  let diff = false;
  for (const [k, v] of Object.entries(patch)) {
    const atual = proc[k] ?? null;
    const a = atual == null || atual === '' ? null : String(atual);
    const b = v == null || v === '' ? null : String(v);
    if (a !== b) diff = true;
  }
  return { aplicar: diff, patch };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.aplicar && !opts.senha) {
    console.error('Defina VILAREAL_IMPORT_SENHA ou --senha=');
    process.exit(1);
  }

  const mapa = levantarCamposSemanticosProcesso({ clienteFiltro: opts.clienteFiltro });
  const registos = [...mapa.values()];
  console.log(`\n=== Import campos semânticos (audiência / papel) — ${registos.length} processo(s) ===\n`);

  let token = null;
  const clientePorCod8 = new Map();
  if (opts.aplicar) token = await loginImportApi(opts.baseUrl, opts.login, opts.senha);

  const stats = {
    total: registos.length,
    atualizados: 0,
    pulados_iguais: 0,
    orfaos: 0,
    erros: 0,
  };

  for (const reg of registos) {
    const campos = reg.campos;
    if (!Object.keys(campos).length) continue;

    if (opts.dryRun) {
      console.log(
        `[dry-run] ${reg.cod8} proc ${reg.numeroInterno} → ${JSON.stringify(campos)}`
      );
      continue;
    }

    try {
      const proc = await buscarProcesso(
        opts.baseUrl,
        token,
        reg.cod8,
        reg.numeroInterno,
        clientePorCod8
      );
      if (!proc?.id) {
        stats.orfaos += 1;
        continue;
      }
      const { aplicar, patch } = precisaAtualizar(proc, campos, opts);
      if (!aplicar) {
        stats.pulados_iguais += 1;
        continue;
      }
      await atualizarProcessoApi(opts.baseUrl, token, proc, patch);
      stats.atualizados += 1;
    } catch (e) {
      stats.erros += 1;
      console.warn(`[erro] ${reg.cod8}/${reg.numeroInterno}:`, e?.message || e);
    }
  }

  console.log('\nResumo:', JSON.stringify(stats, null, 2));
  if (opts.relatorio) {
    fs.writeFileSync(opts.relatorio, JSON.stringify({ opts, stats, registos }, null, 2), 'utf8');
    console.log(`Relatório: ${opts.relatorio}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
