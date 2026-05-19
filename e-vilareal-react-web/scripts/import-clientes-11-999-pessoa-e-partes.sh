#!/usr/bin/env bash
# Clientes 11–999: Pessoa (151.1.0 → tela Clientes) + partes processo (90/95).
set -euo pipefail
cd "$(dirname "$0")/.."
LOG="${1:-/tmp/import-clientes-11-999-pessoa-e-partes.log}"
: > "$LOG"

echo "=== [1/2] Pessoa cadastro Clientes (151.1.0) — clientes 11..999 ===" | tee -a "$LOG"
node scripts/import-cliente-pessoa-151-txt.mjs --cliente-min=11 --cliente-max=999 --aplicar 2>&1 | tee -a "$LOG"

echo "" | tee -a "$LOG"
echo "=== [2/2] Partes do processo (90/95) — clientes 11..999 ===" | tee -a "$LOG"
ok=0
fail=0
for c in $(seq 11 999); do
  echo "=== cliente $c ===" | tee -a "$LOG"
  if node scripts/import-processo-partes-txt.mjs --cliente="$c" --aplicar >>"$LOG" 2>&1; then
    ok=$((ok + 1))
    echo "[cliente $c] OK" | tee -a "$LOG"
  else
    fail=$((fail + 1))
    echo "[cliente $c] FALHA" | tee -a "$LOG"
  fi
done
echo "" | tee -a "$LOG"
echo "Partes: ok=$ok falha=$fail" | tee -a "$LOG"
echo "Log completo: $LOG"
