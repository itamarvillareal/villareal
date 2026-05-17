#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="${1:-/tmp}"
SCRIPT="scripts/corrigir-historico-local-txt.mjs"

run_lote() {
  local min=$1 max=$2 out=$3
  node "$SCRIPT" --cliente-min="$min" --cliente-max="$max" --relatorio="$out" >/dev/null 2>"$out.progress"
}

run_lote 1 250 "$BASE/analise-correcao-lote-1-250.json" &
run_lote 251 500 "$BASE/analise-correcao-lote-251-500.json" &
run_lote 501 750 "$BASE/analise-correcao-lote-501-750.json" &
run_lote 751 999 "$BASE/analise-correcao-lote-751-999.json" &
wait

node --input-type=module -e "
import fs from 'node:fs';
const files = process.argv.slice(1);
const merged = { base: null, dryRun: true, stats: { clientesComHistorico: 0, processosAnalisados: 0, semAlteracao: 0, indiceAtualizar: 0, indiceEliminar: 0, comRenumeracao: 0, ficheirosRenomear: 0, ficheirosApagar: 0 }, processos: [], resumoConsolidado: null };
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  merged.base = merged.base || j.base;
  for (const k of Object.keys(merged.stats)) merged.stats[k] += j.stats[k] ?? 0;
  merged.processos.push(...j.processos);
}
import { gerarResumoConsolidado, imprimirResumoConsolidado, imprimirRelatorioAnaliseCorrecao } from './scripts/lib/historico-local-txt-relatorio.mjs';
merged.resumoConsolidado = gerarResumoConsolidado(merged);
const out = '$BASE/analise-correcao-todos-clientes.json';
fs.writeFileSync(out, JSON.stringify(merged, null, 2));
imprimirResumoConsolidado(merged, { limiteClientes: 50 });
imprimirRelatorioAnaliseCorrecao(merged, { limiteProcessosDetalhe: 80 });
console.log('Relatório JSON completo:', out);
" \
  "$BASE/analise-correcao-lote-1-250.json" \
  "$BASE/analise-correcao-lote-251-500.json" \
  "$BASE/analise-correcao-lote-501-750.json" \
  "$BASE/analise-correcao-lote-751-999.json"
