#!/usr/bin/env bash
# Reimporta histórico via import-real para clientes com processos sem andamentos na API/MySQL.
# Por cliente: etapa [3/5] histórico em massa + cabeçalho (sem zerar, sem partes/cálculos).
#
# Uso:
#   ./scripts/run-import-real-historico-faltante.sh
#   RETOMAR=1 ./scripts/run-import-real-historico-faltante.sh   # não zera log/resumo; pula clientes já ok
set -uo pipefail
cd "$(dirname "$0")/.."

export VILAREAL_API_BASE="${VILAREAL_API_BASE:-http://localhost:8081}"

PAIRS="${1:-tmp/processos-sem-historico.pairs}"
LOG="${2:-tmp/import-real-historico-faltante.log}"
RESUMO="${3:-tmp/import-real-historico-faltante-summary.jsonl}"
RETOMAR="${RETOMAR:-0}"

if [[ ! -f "$PAIRS" ]]; then
  echo "Lista não encontrada: $PAIRS — rode: node scripts/listar-processos-sem-historico.mjs"
  exit 1
fi

clients=$(awk '{print $1}' "$PAIRS" | sort -nu)
total=$(echo "$clients" | wc -l | tr -d ' ')
n=0
ok=0
fail=0
skip=0

DONE_OK_FILE="${RESUMO}.ok-clients"
if [[ "$RETOMAR" == "1" && -f "$RESUMO" ]]; then
  grep '"status":"ok"' "$RESUMO" | sed -n 's/.*"cliente":\([0-9]*\).*/\1/p' | sort -nu >"$DONE_OK_FILE" 2>/dev/null || true
fi
touch "$DONE_OK_FILE"

if [[ "$RETOMAR" == "1" ]]; then
  echo "Reinício $(date -u +%Y-%m-%dT%H:%M:%SZ) — $total clientes na lista — API=$VILAREAL_API_BASE" | tee -a "$LOG"
else
  : >"$LOG"
  : >"$RESUMO"
  echo "Início $(date -u +%Y-%m-%dT%H:%M:%SZ) — $total clientes — API=$VILAREAL_API_BASE" | tee -a "$LOG"
fi

for c in $clients; do
  if grep -qx "$c" "$DONE_OK_FILE" 2>/dev/null; then
    skip=$((skip + 1))
    echo "[skip] cliente $c já ok no resumo" | tee -a "$LOG"
    continue
  fi
  n=$((n + 1))
  t0=$(date +%s)
  echo "########## [$n/$total] Cliente $c ##########" | tee -a "$LOG"
  rel="tmp/import-real-historico-cliente-${c}.json"
  if node scripts/import-real.mjs \
    --cliente="$c" \
    --aplicar \
    --sem-zerar \
    --sem-calculos \
    --sem-partes \
    --relatorio="$rel" >>"$LOG" 2>&1; then
    ok=$((ok + 1))
    st=ok
    code=0
    echo "[$n/$total] cliente $c OK" | tee -a "$LOG"
  else
    fail=$((fail + 1))
    st=fail
    code=$?
    echo "[$n/$total] cliente $c FALHA (code=$code)" | tee -a "$LOG"
  fi
  dur=$(($(date +%s) - t0))
  printf '%s\n' "{\"cliente\":$c,\"status\":\"$st\",\"code\":$code,\"duracaoS\":$dur,\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >>"$RESUMO"
done

echo "Concluído $(date -u +%Y-%m-%dT%H:%M:%SZ): ok=$ok falha=$fail skip=$skip total=$total" | tee -a "$LOG"
echo "Log: $LOG"
echo "Resumo: $RESUMO"
