#!/usr/bin/env bash
# Import-real em lote: ficheiro com linhas "CLIENTE PROC"
set -euo pipefail
cd "$(dirname "$0")/.."
PAIRS="${1:?pairs file}"
LOG="${2:-tmp/import-real-lote.log}"
FAIL="${3:-tmp/import-real-lote-falhas.txt}"
: > "$LOG"
: > "$FAIL"
total=$(wc -l < "$PAIRS" | tr -d ' ')
n=0 ok=0 fail=0
while read -r c p; do
  [[ -z "$c" || -z "$p" ]] && continue
  n=$((n + 1))
  echo "[$n/$total] cliente $c proc $p" | tee -a "$LOG"
  if node scripts/import-real.mjs --cliente="$c" --processo="$p" --aplicar >>"$LOG" 2>&1; then
    ok=$((ok + 1))
    echo "  OK"
  else
    fail=$((fail + 1))
    echo "$c $p" >> "$FAIL"
    echo "  FALHA"
  fi
done < "$PAIRS"
echo "Passagem 1: ok=$ok falha=$fail — log: $LOG"
if [[ "$fail" -gt 0 ]]; then
  echo "A garantir processos em falta e repetir…"
  by_client=$(cut -d' ' -f1 "$FAIL" | sort -u)
  for c in $by_client; do
    procs=$(awk -v c="$c" '$1==c {print $2}' "$FAIL" | paste -sd, -)
    node scripts/garantir-processos-import-real.mjs --cliente="$c" --processos="$procs" >>"$LOG" 2>&1 || true
  done
  ok2=0 fail2=0 still=""
  while read -r c p; do
    [[ -z "$c" || -z "$p" ]] && continue
    echo "[retry] cliente $c proc $p" | tee -a "$LOG"
    if node scripts/import-real.mjs --cliente="$c" --processo="$p" --aplicar >>"$LOG" 2>&1; then
      ok2=$((ok2 + 1))
    else
      fail2=$((fail2 + 1))
      still="${still}${c} ${p}\n"
    fi
  done < "$FAIL"
  echo "Retry: ok=$ok2 falha=$fail2"
  if [[ "$fail2" -gt 0 ]]; then
    printf '%b' "$still" > "${FAIL%.txt}-ainda.txt"
    echo "Ainda em falha: ${FAIL%.txt}-ainda.txt"
    exit 1
  fi
fi
