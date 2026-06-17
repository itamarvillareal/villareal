#!/usr/bin/env bash
# import-real por par CLIENTE PROC (com --sem-zerar).
set -uo pipefail
cd "$(dirname "$0")/.."

export VILAREAL_API_BASE="${VILAREAL_API_BASE:-http://localhost:8081}"

PAIRS="${1:?pairs file}"
LOG="${2:-tmp/import-real-consultados.log}"
FAIL="${3:-tmp/import-real-consultados-falhas.txt}"
RESUMO="${4:-tmp/import-real-consultados-summary.jsonl}"

: >"$LOG"
: >"$FAIL"
: >"$RESUMO"

total=$(grep -cve '^\s*$' "$PAIRS" || true)
n=0 ok=0 fail=0

echo "Início $(date -u +%Y-%m-%dT%H:%M:%SZ) — $total pares — API=$VILAREAL_API_BASE" | tee -a "$LOG"

while read -r c p; do
  [[ -z "$c" || -z "$p" ]] && continue
  n=$((n + 1))
  t0=$(date +%s)
  echo "[$n/$total] cliente $c proc $p" | tee -a "$LOG"
  rel="tmp/import-real-consultados-${c}-${p}.json"
  if node scripts/import-real.mjs \
    --cliente="$c" \
    --processo="$p" \
    --aplicar \
    --sem-zerar \
    --sem-verificacao \
    --relatorio="$rel" >>"$LOG" 2>&1; then
    ok=$((ok + 1))
    st=ok code=0
    echo "  OK" | tee -a "$LOG"
  else
    fail=$((fail + 1))
    st=fail code=$?
    echo "$c $p" >>"$FAIL"
    echo "  FALHA (code=$code)" | tee -a "$LOG"
  fi
  dur=$(($(date +%s) - t0))
  printf '%s\n' "{\"cliente\":$c,\"processo\":$p,\"status\":\"$st\",\"code\":$code,\"duracaoS\":$dur,\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >>"$RESUMO"
done <"$PAIRS"

echo "Concluído $(date -u +%Y-%m-%dT%H:%M:%SZ): ok=$ok falha=$fail total=$total" | tee -a "$LOG"
