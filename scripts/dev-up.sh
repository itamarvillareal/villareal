#!/usr/bin/env bash
# Sobe backend (8080) + frontend (5173) para desenvolvimento local.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for port in 8080 5173; do
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "Liberando porta $port..."
    kill -9 $pids 2>/dev/null || true
  fi
done
sleep 1

echo "Iniciando backend (import jobs desativados)..."
(cd "$ROOT/e-vilareal-java-backend" && bash scripts/run-dev.sh) &
BACK_PID=$!

echo "Aguardando http://localhost:8080/actuator/health ..."
for i in $(seq 1 90); do
  if curl -sf -m 2 http://127.0.0.1:8080/actuator/health >/dev/null 2>&1; then
    echo "Backend OK."
    break
  fi
  if ! kill -0 "$BACK_PID" 2>/dev/null; then
    echo "Backend encerrou antes de ficar pronto. Verifique logs (import VILAREAL_IMPORT_* no ambiente)."
    exit 1
  fi
  sleep 1
  if [[ "$i" -eq 90 ]]; then
    echo "Timeout aguardando backend."
    exit 1
  fi
done

echo "Iniciando frontend..."
(cd "$ROOT/e-vilareal-react-web" && npm run dev) &

echo "Iniciando agente local (Finder)..."
(node "$ROOT/e-vilareal-local-helper/server.mjs") &
sleep 2
for i in $(seq 1 30); do
  if curl -sf -m 2 http://127.0.0.1:5173/ >/dev/null 2>&1; then
    echo ""
    echo "Pronto:"
    echo "  Frontend: http://127.0.0.1:5173/login"
    echo "  Backend:  http://127.0.0.1:8080"
    echo "  Local helper (Finder): http://127.0.0.1:9876/health"
    echo "  Login:    itamar / 123456"
    open "http://127.0.0.1:5173/login" 2>/dev/null || true
    wait
    exit 0
  fi
  sleep 1
done
echo "Frontend não respondeu em 127.0.0.1:5173"
exit 1
