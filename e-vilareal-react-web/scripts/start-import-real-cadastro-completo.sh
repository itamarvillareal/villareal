#!/usr/bin/env bash
# Atualização do cadastro completo via import-real (screen).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SESSION="vilareal-import-real"
PIDFILE="tmp/import-real-cadastro.pid"
LOG="tmp/import-real-cadastro.log"
NOHUP="tmp/import-real-cadastro.nohup.log"
PROGRESSO="tmp/import-real-cadastro-progress.jsonl"

if [[ -f .env.import.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.import.local
  set +a
fi

export VILAREAL_API_BASE="${VILAREAL_API_BASE:-http://localhost:8080}"

# Parar lotes antigos
for old_pidfile in tmp/import-real-historico-faltante.pid tmp/import-historico-cadastro.pid; do
  if [[ -f "$old_pidfile" ]]; then
    old=$(cat "$old_pidfile" 2>/dev/null || true)
    if [[ -n "$old" ]] && kill -0 "$old" 2>/dev/null; then
      echo "Parando processo antigo (PID $old)…"
      kill "$old" 2>/dev/null || true
    fi
    rm -f "$old_pidfile"
  fi
done

if screen -ls 2>/dev/null | grep -qE "[.]vilareal-(historico|historico-cadastro)[[:space:]]"; then
  echo "Encerrando sessões screen antigas de histórico…"
  screen -ls | awk '/vilareal-historico/ {print $1}' | cut -d. -f2 | while read -r s; do
    screen -S "$s" -X quit 2>/dev/null || true
  done
fi

if [[ "${RESTART:-0}" == "1" ]] && screen -ls 2>/dev/null | grep -q "[.]${SESSION}[[:space:]]"; then
  echo "RESTART=1 — encerrando sessão screen '${SESSION}'…"
  screen -S "$SESSION" -X quit 2>/dev/null || true
  sleep 1
fi

if screen -ls 2>/dev/null | grep -q "[.]${SESSION}[[:space:]]"; then
  echo "Sessão screen '${SESSION}' já existe."
  screen -ls | grep "$SESSION" || true
  echo "Monitor: tail -f $LOG"
  echo "Para reiniciar: RESTART=1 RETOMAR=1 bash scripts/start-import-real-cadastro-completo.sh"
  exit 0
fi

RETOMAR="${RETOMAR:-0}"
PULAR_CLIENTES="${PULAR_CLIENTES:-}"
ARGS=(--aplicar)
if [[ "$RETOMAR" == "1" ]]; then
  ARGS+=(--retomar)
elif [[ -n "$PULAR_CLIENTES" ]]; then
  ARGS+=(--retomar)
fi
if [[ -n "$PULAR_CLIENTES" ]]; then
  ARGS+=(--pular-clientes="$PULAR_CLIENTES")
fi
if [[ "${FRESH:-0}" == "1" ]]; then
  rm -f "$PROGRESSO"
  : >"$LOG"
  echo "FRESH=1 — progresso zerado."
fi

screen -dmS "$SESSION" bash -c \
  "cd '$ROOT' && node scripts/import-real-cadastro-completo.mjs ${ARGS[*]} 2>&1 | tee -a '$LOG'"

sleep 2
echo "import-real cadastro completo iniciado (screen: $SESSION)"
screen -ls | grep "$SESSION" || true
echo "API: $VILAREAL_API_BASE"
echo ""
echo "Monitorar:"
echo "  tail -f $LOG"
echo "  wc -l $PROGRESSO"
echo "  screen -r $SESSION"
