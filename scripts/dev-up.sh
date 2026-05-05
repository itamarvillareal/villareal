#!/usr/bin/env bash
# Sobe túnel SSH (3308→MySQL na VPS), docker compose (backend+frontend) e mostra logs do backend ~30s.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_ENV="${COMPOSE_ENV_FILE:-$REPO_ROOT/.env.docker}"

TUNNEL_LOCAL_PORT="${TUNNEL_LOCAL_PORT:-3308}"
REMOTE_MYSQL="${REMOTE_MYSQL:-127.0.0.1:3306}"
SSH_TARGET="${SSH_TARGET:-root@161.97.175.73}"

if lsof -nP -iTCP:"$TUNNEL_LOCAL_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Túnel já ativo na porta $TUNNEL_LOCAL_PORT."
else
  echo "Abrindo túnel SSH: localhost:$TUNNEL_LOCAL_PORT -> $REMOTE_MYSQL na VPS..."
  ssh -f -N -L "${TUNNEL_LOCAL_PORT}:127.0.0.1:3306" "$SSH_TARGET"
  sleep 1
fi

if [[ ! -f "$COMPOSE_ENV" ]]; then
  echo "[erro] Falta $COMPOSE_ENV (credenciais para o backend em Docker)." >&2
  echo "       Copie .env.docker.example para .env.docker e defina VILLAREAL_COMPOSE_JDBC_PASSWORD." >&2
  exit 1
fi

echo "Subindo containers (backend → MySQL VPS via túnel na porta $TUNNEL_LOCAL_PORT)..."
docker compose --env-file "$COMPOSE_ENV" up -d

echo ""
echo "Logs do backend (30s)..."
docker logs -f vilareal-backend 2>&1 &
LOG_PID=$!
sleep 30
kill "$LOG_PID" 2>/dev/null || true
wait "$LOG_PID" 2>/dev/null || true

echo ""
echo "Containers:"
docker compose ps
