#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
LOG=/tmp/correcao-historico-lotes/execucao-geral.log
mkdir -p /tmp/correcao-historico-lotes
echo "Início: $(date -Iseconds)" | tee -a "$LOG"
for i in 1 2 3 4 5 6 7 8 9 10; do
  echo "" | tee -a "$LOG"
  echo "========== LOTE $i $(date -Iseconds) ==========" | tee -a "$LOG"
  node scripts/aplicar-correcao-historico-lotes.mjs --aplicar --lote="$i" 2>&1 | tee -a "/tmp/correcao-historico-lotes/lote-${i}-stdout.log"
done
echo "Fim: $(date -Iseconds)" | tee -a "$LOG"
