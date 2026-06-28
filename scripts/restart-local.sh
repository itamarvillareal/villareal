#!/usr/bin/env bash
# Reinicia o ambiente LOCAL de desenvolvimento no seu Mac:
#   - MySQL  : container Docker vilareal-db (localhost:3307)
#   - Backend: Spring Boot via Maven (perfil dev) em http://localhost:8080
#   - Frontend: Vite em http://localhost:5173  (proxy /api -> 8080)
#
# Backend e frontend rodam em BACKGROUND; logs em tmp/local-logs/.
#
# Uso:
#   ./scripts/restart-local.sh                 # reinicia backend + frontend (+ garante db)
#   ./scripts/restart-local.sh --backend-only
#   ./scripts/restart-local.sh --frontend-only
#   ./scripts/restart-local.sh --stop          # para backend + frontend
#   ./scripts/restart-local.sh --logs          # mostra os caminhos/últimas linhas dos logs
#   ./scripts/restart-local.sh --no-health     # não espera o health do backend
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOG_DIR="$ROOT/tmp/local-logs"
PID_DIR="$ROOT/tmp/local-logs"
mkdir -p "$LOG_DIR"

BACKEND_PORT=8080
FRONTEND_PORT=5173

BACKEND_ONLY=0
FRONTEND_ONLY=0
CHECK_HEALTH=1
DO_STOP=0
SHOW_LOGS=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend-only) BACKEND_ONLY=1 ;;
    --frontend-only) FRONTEND_ONLY=1 ;;
    --stop) DO_STOP=1 ;;
    --logs) SHOW_LOGS=1 ;;
    --no-health) CHECK_HEALTH=0 ;;
    -h|--help) sed -n '2,21p' "$0"; exit 0 ;;
    *) echo "Opção desconhecida: $1" >&2; exit 2 ;;
  esac
  shift
done

if [[ "$BACKEND_ONLY" -eq 1 && "$FRONTEND_ONLY" -eq 1 ]]; then
  echo "Use apenas um de --backend-only ou --frontend-only." >&2
  exit 2
fi

WANT_BACKEND=1; WANT_FRONTEND=1
[[ "$FRONTEND_ONLY" -eq 1 ]] && WANT_BACKEND=0
[[ "$BACKEND_ONLY" -eq 1 ]] && WANT_FRONTEND=0

if [[ "$SHOW_LOGS" -eq 1 ]]; then
  echo "Logs em: $LOG_DIR"
  for f in backend frontend; do
    if [[ -f "$LOG_DIR/$f.log" ]]; then
      echo "===== $f.log (últimas 15 linhas) ====="
      tail -n 15 "$LOG_DIR/$f.log"
    fi
  done
  exit 0
fi

# Inicia um comando totalmente desacoplado do terminal (nova sessão), com saída em arquivo.
# Usa setsid do Perl (sempre presente no macOS) para sobreviver ao fechamento do shell.
# Uso: start_detached <logfile> <comando...>
start_detached() {
  perl -e 'use POSIX qw(setsid);
           open(STDIN,  "<", "/dev/null");
           open(STDOUT, ">", $ARGV[0]) or die "log: $!";
           open(STDERR, ">&", STDOUT);
           setsid();
           shift @ARGV;
           exec { $ARGV[0] } @ARGV or die "exec: $!";' "$@" &
}

# Mata o que estiver ouvindo numa porta (processo + filhos).
kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti "tcp:$port" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    kill $pids 2>/dev/null || true
    sleep 2
    pids="$(lsof -ti "tcp:$port" 2>/dev/null || true)"
    [[ -n "$pids" ]] && kill -9 $pids 2>/dev/null || true
  fi
}

stop_backend() { echo "Parando backend (porta $BACKEND_PORT)..."; kill_port "$BACKEND_PORT"; }
stop_frontend() { echo "Parando frontend (porta $FRONTEND_PORT)..."; kill_port "$FRONTEND_PORT"; }

if [[ "$DO_STOP" -eq 1 ]]; then
  [[ "$WANT_BACKEND" -eq 1 ]] && stop_backend
  [[ "$WANT_FRONTEND" -eq 1 ]] && stop_frontend
  echo "Parado."
  exit 0
fi

# --- MySQL local (Docker) ---
if ! docker ps --format '{{.Names}}' | grep -q '^vilareal-db$'; then
  echo "Subindo MySQL local (vilareal-db)..."
  docker compose -f docker-compose.local-db.yml up -d db
  echo "Aguardando MySQL ficar healthy..."
  for i in $(seq 1 30); do
    st="$(docker inspect -f '{{.State.Health.Status}}' vilareal-db 2>/dev/null || echo starting)"
    [[ "$st" == "healthy" ]] && break
    sleep 2
  done
else
  echo "MySQL local já está rodando (vilareal-db)."
fi

# --- Backend (Spring Boot, perfil dev, Java 21) ---
if [[ "$WANT_BACKEND" -eq 1 ]]; then
  stop_backend
  JAVA21="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
  if [[ -z "$JAVA21" ]]; then
    echo "Java 21 não encontrado. Instale: brew install openjdk@21" >&2
    exit 1
  fi
  echo "Iniciando backend (Java 21, perfil dev) -> http://localhost:$BACKEND_PORT"
  (
    cd "$ROOT/e-vilareal-java-backend"
    export JAVA_HOME="$JAVA21" SPRING_PROFILES_ACTIVE=dev
    start_detached "$LOG_DIR/backend.log" ./mvnw -q spring-boot:run
    echo $! > "$PID_DIR/backend.pid"
  )
fi

# --- Frontend (Vite) ---
if [[ "$WANT_FRONTEND" -eq 1 ]]; then
  stop_frontend
  if [[ ! -d "$ROOT/e-vilareal-react-web/node_modules" ]]; then
    echo "Instalando dependências do frontend (npm ci)..."
    (cd "$ROOT/e-vilareal-react-web" && npm ci)
  fi
  echo "Iniciando frontend (Vite) -> http://localhost:$FRONTEND_PORT"
  (
    cd "$ROOT/e-vilareal-react-web"
    start_detached "$LOG_DIR/frontend.log" npm run dev
    echo $! > "$PID_DIR/frontend.pid"
  )
fi

# --- Health checks ---
if [[ "$CHECK_HEALTH" -eq 1 && "$WANT_BACKEND" -eq 1 ]]; then
  echo "Aguardando backend ficar UP (pode levar ~1min na 1ª vez por causa do Flyway)..."
  ok=0
  for i in $(seq 1 36); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$BACKEND_PORT/actuator/health" || true)"
    echo "  backend try $i: $code"
    [[ "$code" == "200" ]] && { ok=1; break; }
    sleep 5
  done
  if [[ "$ok" -ne 1 ]]; then
    echo "Backend NÃO respondeu 200. Veja: tail -f $LOG_DIR/backend.log" >&2
    exit 1
  fi
  echo "Backend UP."
fi

if [[ "$CHECK_HEALTH" -eq 1 && "$WANT_FRONTEND" -eq 1 ]]; then
  echo "Aguardando frontend (Vite)..."
  for i in $(seq 1 20); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$FRONTEND_PORT/" || true)"
    [[ "$code" == "200" ]] && break
    sleep 2
  done
fi

echo ""
echo "Pronto. Acesse:  http://localhost:$FRONTEND_PORT"
echo "Logs:            tail -f $LOG_DIR/backend.log   |   tail -f $LOG_DIR/frontend.log"
echo "Parar tudo:      ./scripts/restart-local.sh --stop"
