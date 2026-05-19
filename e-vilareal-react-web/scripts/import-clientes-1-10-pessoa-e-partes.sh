#!/usr/bin/env bash
# Clientes 1–10: Pessoa (151.1.0 → tela Clientes) + partes processo (90/95).
set -euo pipefail
cd "$(dirname "$0")/.."
LOG="${1:-/tmp/import-clientes-1-10-pessoa-e-partes.log}"
: > "$LOG"

echo "=== [1/2] Pessoa cadastro Clientes (151.1.0) ===" | tee -a "$LOG"
node scripts/import-cliente-pessoa-151-txt.mjs --cliente-min=1 --cliente-max=10 --aplicar 2>&1 | tee -a "$LOG"

echo "" | tee -a "$LOG"
echo "=== [2/2] Partes do processo (90/95) ===" | tee -a "$LOG"
bash scripts/import-partes-clientes-1-10.sh "$LOG.partes" 2>&1 | tee -a "$LOG"

echo "" | tee -a "$LOG"
echo "Log completo: $LOG"
