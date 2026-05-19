#!/usr/bin/env bash
# Importa partes (90/95) dos clientes 351 a 450.
set -euo pipefail
cd "$(dirname "$0")/.."
LOG="${1:-/tmp/import-partes-clientes-351-450.log}"
: > "$LOG"
ok=0
fail=0
for c in $(seq 351 450); do
  echo "=== cliente $c ===" | tee -a "$LOG"
  if node scripts/import-processo-partes-txt.mjs --cliente="$c" --aplicar >>"$LOG" 2>&1; then
    ok=$((ok + 1))
    echo "[cliente $c] OK" | tee -a "$LOG"
  else
    fail=$((fail + 1))
    echo "[cliente $c] FALHA (ver $LOG)" | tee -a "$LOG"
  fi
done
echo "Concluído: ok=$ok falha=$fail — log: $LOG"
