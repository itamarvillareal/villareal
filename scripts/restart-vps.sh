#!/usr/bin/env bash
# Reinicia os containers do stack VilaReal na VPS (sem rebuild / sem git pull).
# Para PUBLICAR código novo use ./scripts/deploy-vps.sh (faz git pull + build).
#
# Uso:
#   ./scripts/restart-vps.sh                 # reinicia backend + frontend
#   ./scripts/restart-vps.sh --backend-only
#   ./scripts/restart-vps.sh --frontend-only
#   ./scripts/restart-vps.sh --no-health     # não espera o health do backend
set -euo pipefail

VPS_HOST="${VPS_HOST:-villareal-vps}"
VPS_REPO_DIR="${VPS_REPO_DIR:-/opt/villareal/villareal}"
HEALTH_URL="${HEALTH_URL:-http://localhost:8081/actuator/health}"

BACKEND_ONLY=0
FRONTEND_ONLY=0
CHECK_HEALTH=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend-only) BACKEND_ONLY=1 ;;
    --frontend-only) FRONTEND_ONLY=1 ;;
    --no-health) CHECK_HEALTH=0 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "Opção desconhecida: $1" >&2; exit 2 ;;
  esac
  shift
done

if [[ "$BACKEND_ONLY" -eq 1 && "$FRONTEND_ONLY" -eq 1 ]]; then
  echo "Use apenas um de --backend-only ou --frontend-only." >&2
  exit 2
fi

SERVICES="backend frontend"
[[ "$BACKEND_ONLY" -eq 1 ]] && SERVICES="backend"
[[ "$FRONTEND_ONLY" -eq 1 ]] && SERVICES="frontend"

# Permite usar a chave dedicada mesmo sem alias no ~/.ssh/config.
SSH_OPTS=()
VPS_SSH_KEY="${VPS_SSH_KEY:-$HOME/.ssh/villareal_vps}"
if [[ "$VPS_HOST" != *"@"* && -f "$HOME/.ssh/config" ]] && grep -q "Host[[:space:]]\+$VPS_HOST" "$HOME/.ssh/config" 2>/dev/null; then
  : # alias resolvido pelo ~/.ssh/config
elif [[ -f "$VPS_SSH_KEY" ]]; then
  SSH_OPTS=(-i "$VPS_SSH_KEY" -o IdentitiesOnly=yes)
fi

DC="docker compose --env-file .env.docker"
echo "VPS: $VPS_HOST | Serviços: $SERVICES"

ssh ${SSH_OPTS[@]+"${SSH_OPTS[@]}"} "$VPS_HOST" \
  "cd '$VPS_REPO_DIR' && $DC restart $SERVICES && $DC ps"

if [[ "$CHECK_HEALTH" -eq 1 && "$SERVICES" == *backend* ]]; then
  echo "Aguardando backend ficar UP ($HEALTH_URL)..."
  ssh ${SSH_OPTS[@]+"${SSH_OPTS[@]}"} "$VPS_HOST" "
    for i in \$(seq 1 18); do
      code=\$(curl -s -o /dev/null -w '%{http_code}' '$HEALTH_URL')
      echo \"  try \$i: \$code\"
      [ \"\$code\" = '200' ] && echo 'Backend UP.' && exit 0
      sleep 5
    done
    echo 'Backend NAO respondeu 200 a tempo. Verifique: $DC logs --tail=60 backend' >&2
    exit 1
  "
fi

echo "Concluído."
