#!/usr/bin/env bash
# Inicia o lote de histórico em background estável (caffeinate + nohup + PID file).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PIDFILE="tmp/import-real-historico-faltante.pid"
LOG="tmp/import-real-historico-faltante.log"
NOHUP="tmp/import-real-historico-faltante.nohup.log"

if [[ -f "$PIDFILE" ]]; then
  old_pid=$(cat "$PIDFILE" 2>/dev/null || true)
  if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
    echo "Já rodando (PID $old_pid). Monitor: tail -f $LOG"
    exit 0
  fi
  rm -f "$PIDFILE"
fi

echo "Atualizando lista de processos sem histórico…"
node scripts/listar-processos-sem-historico.mjs

export RETOMAR=1
export VILAREAL_API_BASE="${VILAREAL_API_BASE:-http://localhost:8081}"

# Desacopla do terminal do Cursor: subshell + nohup + caffeinate (evita sleep do macOS).
nohup caffeinate -imsu bash "$ROOT/scripts/run-import-real-historico-faltante.sh" \
  >>"$NOHUP" 2>&1 </dev/null &
launcher_pid=$!

sleep 2
if [[ -f "$PIDFILE" ]]; then
  worker_pid=$(cat "$PIDFILE")
  echo "Lote iniciado — worker PID $worker_pid (launcher $launcher_pid)"
  echo "API: $VILAREAL_API_BASE"
  echo "Log: $LOG"
  echo "Resumo: tmp/import-real-historico-faltante-summary.jsonl"
  echo "Monitor: tail -f $LOG"
else
  echo "Aviso: PID file não criado em 2s — ver $NOHUP"
  tail -5 "$NOHUP" 2>/dev/null || true
fi
