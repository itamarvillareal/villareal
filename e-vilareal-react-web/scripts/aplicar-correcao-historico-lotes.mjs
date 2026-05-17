#!/usr/bin/env node
/**
 * Aplica correções de histórico local em lotes equilibrados (728 isolado).
 *
 * Uso:
 *   node scripts/aplicar-correcao-historico-lotes.mjs --planejar
 *   node scripts/aplicar-correcao-historico-lotes.mjs --aplicar
 *   node scripts/aplicar-correcao-historico-lotes.mjs --aplicar --lote=3
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { DEFAULT_BASE_HISTORICO_LOCAL } from './lib/historico-local-txt-paths.mjs';
import { executarCorrecaoHistoricoLocal } from './lib/historico-local-txt-correcao.mjs';
import { montarLotesCorrecaoHistorico } from './lib/historico-local-txt-lotes.mjs';

const DEFAULT_PLANO = '/tmp/plano-lotes-correcao-historico.json';

function parseArgs(argv) {
  const out = {
    base: DEFAULT_BASE_HISTORICO_LOCAL,
    planoPath: DEFAULT_PLANO,
    aplicar: false,
    planejar: false,
    lote: null,
    logDir: '/tmp/correcao-historico-lotes',
  };
  for (const a of argv) {
    if (a === '--aplicar') out.aplicar = true;
    else if (a === '--planejar') out.planejar = true;
    else if (a.startsWith('--base=')) out.base = path.resolve(a.slice(7));
    else if (a.startsWith('--plano=')) out.planoPath = path.resolve(a.slice(8));
    else if (a.startsWith('--log-dir=')) out.logDir = path.resolve(a.slice(10));
    else if (a.startsWith('--lote=')) out.lote = Math.trunc(Number(a.slice(7)));
  }
  if (!out.planejar && !out.aplicar) out.planejar = true;
  return out;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  fs.mkdirSync(opts.logDir, { recursive: true });

  let plano;
  if (fs.existsSync(opts.planoPath) && opts.aplicar && !opts.planejar) {
    plano = JSON.parse(fs.readFileSync(opts.planoPath, 'utf8'));
  } else {
    plano = montarLotesCorrecaoHistorico({ base: opts.base });
    fs.writeFileSync(opts.planoPath, JSON.stringify(plano, null, 2), 'utf8');
  }

  console.log(`Plano de lotes: ${opts.planoPath}`);
  console.log(`Clientes: ${plano.totalClientes}  |  Processos: ${plano.totalProcessos}  |  Lotes: ${plano.lotes.length}\n`);
  for (const l of plano.lotes) {
    const tag = l.isolado ? ' [isolado]' : '';
    console.log(
      `  Lote ${l.id}${tag}: ${l.clientes.length} cliente(s), ~${l.processos} processo(s) — clientes ${l.clientes.slice(0, 12).join(', ')}${l.clientes.length > 12 ? '…' : ''}`
    );
  }
  console.log('');

  if (!opts.aplicar) {
    console.log('Modo planeamento. Para aplicar: node scripts/aplicar-correcao-historico-lotes.mjs --aplicar');
    return;
  }

  const lotesAlvo = opts.lote != null ? plano.lotes.filter((l) => l.id === opts.lote) : plano.lotes;
  if (!lotesAlvo.length) {
    console.error(`Lote ${opts.lote} não encontrado.`);
    process.exit(1);
  }

  /** @type {object[]} */
  const resultados = [];

  for (const lote of lotesAlvo) {
    const t0 = Date.now();
    const logPath = path.join(opts.logDir, `lote-${lote.id}-aplicar.log`);
    console.log(`\n═══ Lote ${lote.id} — ${lote.clientes.length} cliente(s), ~${lote.processos} processos ═══`);

    const resultado = executarCorrecaoHistoricoLocal({
      base: opts.base,
      clientesLista: lote.clientes,
      dryRun: false,
      verbose: true,
      modoRapido: false,
    });

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const linha = {
      lote: lote.id,
      clientes: lote.clientes,
      stats: resultado.stats,
      segundos: Number(elapsed),
    };
    resultados.push(linha);
    fs.writeFileSync(logPath, JSON.stringify({ lote, resultado: linha }, null, 2), 'utf8');
    console.log(`Lote ${lote.id} concluído em ${elapsed}s:`, JSON.stringify(resultado.stats));
  }

  const resumoPath = path.join(opts.logDir, 'resumo-aplicacao.json');
  /** @type {object} */
  let payload = { plano, resultados: [] };
  if (fs.existsSync(resumoPath)) {
    try {
      payload = JSON.parse(fs.readFileSync(resumoPath, 'utf8'));
      if (!Array.isArray(payload.resultados)) payload.resultados = [];
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
  console.log(`\nResumo: ${resumoPath} (${payload.resultados.length} lote(s))`);
}

main();
