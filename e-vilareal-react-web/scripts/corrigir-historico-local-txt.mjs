#!/usr/bin/env node
/**
 * Correção dos ficheiros txt de histórico local.
 *
 * Por defeito: **só análise** — relatório em tela do que seria alterado (sem mexer em ficheiros).
 * Com `--aplicar`: executa as alterações após a sua aprovação.
 *
 * Uso:
 *   node scripts/corrigir-historico-local-txt.mjs --cliente=728 --processo=143
 *   node scripts/corrigir-historico-local-txt.mjs --cliente-min=500 --cliente-max=600
 *   node scripts/corrigir-historico-local-txt.mjs --aplicar --cliente=728 --processo=143
 *   node scripts/corrigir-historico-local-txt.mjs --relatorio=/tmp/analise-correcao.json
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { DEFAULT_BASE_HISTORICO_LOCAL } from './lib/historico-local-txt-paths.mjs';
import {
  executarAnaliseHistoricoLocal,
  executarCorrecaoHistoricoLocal,
} from './lib/historico-local-txt-correcao.mjs';
import {
  imprimirRelatorioAnaliseCorrecao,
  imprimirResumoConsolidado,
} from './lib/historico-local-txt-relatorio.mjs';

function parseArgs(argv) {
  const out = {
    base: DEFAULT_BASE_HISTORICO_LOCAL,
    clienteMin: 1,
    clienteMax: 999,
    clienteFiltro: null,
    processoFiltro: null,
    contagensPath: null,
    aplicar: false,
    relatorio: null,
    verbose: false,
  };
  for (const a of argv) {
    if (a === '--aplicar') out.aplicar = true;
    else if (a === '--verbose' || a === '-v') out.verbose = true;
    else if (a === '--dry-run' || a === '-n') out.aplicar = false;
    else if (a.startsWith('--base=')) out.base = path.resolve(a.slice(7));
    else if (a.startsWith('--cliente-min=')) out.clienteMin = Math.max(1, Number(a.slice(14)) || 1);
    else if (a.startsWith('--cliente-max='))
      out.clienteMax = Math.min(999, Number(a.slice('--cliente-max='.length)) || 999);
    else if (a.startsWith('--cliente=')) {
      const n = Number(a.slice(10));
      if (Number.isFinite(n) && n >= 1) out.clienteFiltro = Math.trunc(n);
    } else if (a.startsWith('--processo=')) {
      const n = Number(a.slice(11));
      if (Number.isFinite(n) && n >= 1) out.processoFiltro = Math.trunc(n);
    } else if (a.startsWith('--contagens=')) out.contagensPath = path.resolve(a.slice(12));
    else if (a.startsWith('--relatorio=')) out.relatorio = path.resolve(a.slice(12));
  }
  if (out.clienteFiltro != null) {
    out.clienteMin = out.clienteFiltro;
    out.clienteMax = out.clienteFiltro;
  }
  return out;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  const analiseOpts = {
    base: opts.base,
    clienteMin: opts.clienteMin,
    clienteMax: opts.clienteMax,
    filtroClienteCod: opts.clienteFiltro,
    filtroProcesso: opts.processoFiltro,
    contagensPath: opts.contagensPath,
    dryRun: true,
    verbose: opts.verbose,
  };

  const analise = executarAnaliseHistoricoLocal(analiseOpts);
  const resumo = imprimirResumoConsolidado(analise);
  imprimirRelatorioAnaliseCorrecao(analise, { limiteProcessosDetalhe: 100 });

  if (opts.relatorio) {
    const payload = { ...analise, resumoConsolidado: resumo };
    fs.writeFileSync(opts.relatorio, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`Relatório JSON completo: ${opts.relatorio}\n`);
  }

  if (!opts.aplicar) {
    process.exit(0);
  }

  console.log('\n>>> A aplicar alterações aprovadas…\n');
  const resultado = executarCorrecaoHistoricoLocal({ ...analiseOpts, dryRun: false });
  console.log('Concluído:', JSON.stringify(resultado.stats, null, 2));
}

main();
