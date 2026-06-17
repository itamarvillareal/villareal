#!/usr/bin/env bash
# Inicia o lote de histórico em sessão screen (sobrevive ao fechar Cursor/terminal).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SESSION="vilareal-historico"
PIDFILE="tmp/import-real-historico-faltante.pid"
LOG="tmp/import-real-historico-faltante.log"
NOHUP="tmp/import-real-historico-faltante.nohup.log"

if screen -ls 2>/dev/null | grep -q "[.]${SESSION}[[:space:]]"; then
  echo "Sessão screen '${SESSION}' já existe."
  screen -ls | grep "$SESSION" || true
  echo "Monitor: screen -r $SESSION   ou   tail -f $LOG"
  exit 0
fi

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

screen -dmS "$SESSION" bash -c \
  "cd '$ROOT' && export RETOMAR=1 VILAREAL_API_BASE='$VILAREAL_API_BASE' && exec bash ./scripts/run-import-real-historico-faltante.sh >> '$NOHUP' 2>&1"

sleep 2
echo "Lote iniciado na sessão screen: $SESSION"
screen -ls | grep "$SESSION" || true
if [[ -f "$PIDFILE" ]]; then
  echo "Worker PID: $(cat "$PIDFILE")"
fi
echo "API: $VILAREAL_API_BASE"
echo ""
echo "Monitorar:"
echo "  tail -f $LOG"
echo "  wc -l tmp/import-real-historico-faltante-summary.jsonl"
echo "  screen -r $SESSION    # entrar na sessão (Ctrl+A D para sair sem parar)"
