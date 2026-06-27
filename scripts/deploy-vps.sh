#!/usr/bin/env bash
# Deploy do stack VilaReal na VPS (Docker Compose).
# Uso:
#   ./scripts/deploy-vps.sh --dry-run
#   ./scripts/deploy-vps.sh --backend-only --yes
#   ./scripts/deploy-vps.sh --frontend-only --yes
#   ./scripts/deploy-vps.sh --yes
#   ./scripts/deploy-vps.sh --skip-preflight --yes   # pula npm/mvn local antes do SSH
#
# Pré-requisitos na VPS:
#   - clone do repositório (VPS_REPO_DIR)
#   - .env.docker com SPRING_PROFILES_ACTIVE=prod, GOOGLE_DRIVE_IMPERSONATE_USER, PROJUDI_CRED_KEY, etc.
#   - google-drive-credentials.json e credentials.json no backend antes do build
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${VPS_HOST:-root@161.97.175.73}"
VPS_REPO_DIR="${VPS_REPO_DIR:-/opt/villareal/villareal}"

DRY_RUN=0
YES=0
BACKEND_ONLY=0
FRONTEND_ONLY=0
SKIP_PREFLIGHT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --yes) YES=1 ;;
    --backend-only) BACKEND_ONLY=1 ;;
    --frontend-only) FRONTEND_ONLY=1 ;;
    --skip-preflight) SKIP_PREFLIGHT=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *) echo "Opção desconhecida: $1" >&2; exit 2 ;;
  esac
  shift
done

if [[ "$BACKEND_ONLY" -eq 1 && "$FRONTEND_ONLY" -eq 1 ]]; then
  echo "Use apenas um de --backend-only ou --frontend-only." >&2
  exit 2
fi

SERVICES="backend frontend"
if [[ "$BACKEND_ONLY" -eq 1 ]]; then SERVICES="backend"; fi
if [[ "$FRONTEND_ONLY" -eq 1 ]]; then SERVICES="frontend"; fi

SSH_OPTS=()
VPS_SSH_KEY="${VPS_SSH_KEY:-$HOME/.ssh/villareal_vps}"
if [[ -f "$VPS_SSH_KEY" ]]; then
  SSH_OPTS=(-i "$VPS_SSH_KEY" -o IdentitiesOnly=yes)
fi

REMOTE_CMD="cd '$VPS_REPO_DIR' && git pull && docker compose --env-file .env.docker build $SERVICES && docker compose --env-file .env.docker up -d $SERVICES"

echo "VPS: $VPS_HOST"
echo "Repo: $VPS_REPO_DIR"
echo "Serviços: $SERVICES"
echo
echo "Comandos remotos:"
echo "  $REMOTE_CMD"
echo
echo "Confirme que .env.docker na VPS contém (valores reais, não commitados):"
echo "  SPRING_PROFILES_ACTIVE=prod"
echo "  GOOGLE_DRIVE_SHARED_DRIVE_ID=0ANU_zUd2tFQ7Uk9PVA"
echo "  PROJUDI_CRED_KEY=<chave estável>"
echo

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] Nada executado."
  exit 0
fi

if [[ "$SKIP_PREFLIGHT" -ne 1 ]]; then
  if [[ "$SERVICES" == *frontend* ]]; then
    echo "=== Preflight: build frontend (local) ==="
    (cd "$ROOT/e-vilareal-react-web" && npm run build)
    echo ""
  fi
  if [[ "$SERVICES" == *backend* ]]; then
    echo "=== Preflight: package backend (local) ==="
    (cd "$ROOT/e-vilareal-java-backend" && ./mvnw -q -DskipTests package)
    echo ""
  fi
else
  echo "[preflight] Ignorado (--skip-preflight)."
  echo ""
fi

if [[ "$YES" -ne 1 ]]; then
  read -r -p "Executar deploy na VPS? [y/N] " resp
  case "$resp" in
    y|Y|yes|YES) ;;
    *) echo "Cancelado."; exit 0 ;;
  esac
fi

ssh "${SSH_OPTS[@]}" "$VPS_HOST" "$REMOTE_CMD"
echo "Deploy concluído. Verifique: curl -s https://portal.villarealadvocacia.adv.br/actuator/health"
