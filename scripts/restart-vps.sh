#!/usr/bin/env bash
# Reinicia os containers do stack VilaReal na VPS (sem rebuild / sem git pull).
# Para PUBLICAR código novo use ./scripts/deploy-vps.sh (faz git pull + build).
#
# Na VPS o frontend é nginx (build estático) na porta 5173 — não há `vite dev`.
# O backend Spring Boot leva ~2 min para ficar UP após restart; até lá a API retorna 502.
#
# Uso:
#   ./scripts/restart-vps.sh                 # reinicia backend + frontend
#   ./scripts/restart-vps.sh --backend-only
#   ./scripts/restart-vps.sh --frontend-only
#   ./scripts/restart-vps.sh --no-health     # não espera o health do backend
set -euo pipefail

VPS_HOST="${VPS_HOST:-root@161.97.175.73}"
VPS_REPO_DIR="${VPS_REPO_DIR:-/opt/villareal/villareal}"
HEALTH_URL="${HEALTH_URL:-http://localhost:8081/actuator/health}"
HEALTH_TRIES="${HEALTH_TRIES:-36}"   # 36 × 5s ≈ 3 min (backend costuma levar ~2 min)
HEALTH_SLEEP="${HEALTH_SLEEP:-5}"

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
echo "Nota: backend demora ~2 min para subir; não interrompa com Ctrl+C durante a espera."

ssh ${SSH_OPTS[@]+"${SSH_OPTS[@]}"} "$VPS_HOST" \
  "cd '$VPS_REPO_DIR' && $DC restart $SERVICES && $DC ps"

if [[ "$CHECK_HEALTH" -eq 1 && "$SERVICES" == *backend* ]]; then
  echo "Aguardando backend ficar UP ($HEALTH_URL, até ~$((HEALTH_TRIES * HEALTH_SLEEP))s)..."
  ssh ${SSH_OPTS[@]+"${SSH_OPTS[@]}"} "$VPS_HOST" "
    for i in \$(seq 1 $HEALTH_TRIES); do
      code=\$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 3 --max-time 10 '$HEALTH_URL' || echo 000)
      echo \"  try \$i/$HEALTH_TRIES: \$code\"
      [ \"\$code\" = '200' ] && echo 'Backend UP.' && exit 0
      sleep $HEALTH_SLEEP
    done
    echo 'Backend NAO respondeu 200 a tempo (~$((HEALTH_TRIES * HEALTH_SLEEP))s). Verifique:' >&2
    echo '  ssh $VPS_HOST \"cd $VPS_REPO_DIR && $DC logs --tail=80 backend\"' >&2
    exit 1
  "
fi

if [[ "$SERVICES" == *frontend* ]]; then
  echo "Frontend (nginx :5173) reiniciado — páginas estáticas voltam rápido; APIs dependem do backend."
fi

echo "Concluído."
