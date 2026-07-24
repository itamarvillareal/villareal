#!/usr/bin/env bash
# Deploy do stack VilaReal na VPS (Docker Compose).
#
# Imagens compartilhadas (vilareal-backend / vilareal-frontend): um build serve
# portal e portal1. Por padrão atualiza as DUAS instâncias.
#
# Uso:
#   ./scripts/deploy-vps.sh --dry-run
#   ./scripts/deploy-vps.sh --yes
#   ./scripts/deploy-vps.sh --backend-only --yes
#   ./scripts/deploy-vps.sh --frontend-only --yes
#   ./scripts/deploy-vps.sh --skip-preflight --yes
#   ./scripts/deploy-vps.sh --instance portal --yes    # só portal (exceção)
#   ./scripts/deploy-vps.sh --instance portal1 --yes   # só portal1 (exceção)
#
# Pré-requisitos na VPS:
#   - clone do repositório (VPS_REPO_DIR)
#   - portal:  .env.docker
#   - portal1: .env.portal1 (ver deploy/env.portal1.example)
#   - google-drive-credentials.json no backend antes do build
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${VPS_HOST:-root@161.97.175.73}"
VPS_REPO_DIR="${VPS_REPO_DIR:-/opt/villareal/villareal}"

DRY_RUN=0
YES=0
BACKEND_ONLY=0
FRONTEND_ONLY=0
SKIP_PREFLIGHT=0
# Padrão: as duas instâncias sempre recebem a mesma imagem.
INSTANCE="all"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --yes) YES=1 ;;
    --backend-only) BACKEND_ONLY=1 ;;
    --frontend-only) FRONTEND_ONLY=1 ;;
    --skip-preflight) SKIP_PREFLIGHT=1 ;;
    --instance)
      INSTANCE="$2"
      shift
      ;;
    -h|--help)
      sed -n '2,18p' "$0"
      exit 0
      ;;
    *) echo "Opção desconhecida: $1" >&2; exit 2 ;;
  esac
  shift
done

case "$INSTANCE" in
  portal|portal1|all) ;;
  *) echo "--instance deve ser portal, portal1 ou all." >&2; exit 2 ;;
esac

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

DRIVE_CREDS='e-vilareal-java-backend/src/main/resources/google-drive-credentials.json'

instances=()
if [[ "$INSTANCE" == "all" ]]; then
  instances=(portal portal1)
else
  instances=("$INSTANCE")
fi

# Build uma vez (imagens compartilhadas vilareal-*:latest), depois up em cada instância.
# Usa .env.docker só para interpolar o build; tags de imagem são fixas no compose.
REMOTE_CMD="cd '$VPS_REPO_DIR' && git checkout main && git pull origin main"
REMOTE_CMD="$REMOTE_CMD && test -f .env.docker"
REMOTE_CMD="$REMOTE_CMD && test -f '$DRIVE_CREDS'"
# Project name do portal em produção continua "villareal" (legado do diretório).
REMOTE_CMD="$REMOTE_CMD && docker compose -p villareal --env-file .env.docker build $SERVICES"

for inst in "${instances[@]}"; do
  if [[ "$inst" == "portal1" ]]; then
    REMOTE_CMD="$REMOTE_CMD && test -f .env.portal1"
    REMOTE_CMD="$REMOTE_CMD && docker compose -p portal1 --env-file .env.portal1 up -d --force-recreate $SERVICES"
  else
    REMOTE_CMD="$REMOTE_CMD && docker compose -p villareal --env-file .env.docker up -d --force-recreate $SERVICES"
  fi
done

echo "VPS: $VPS_HOST"
echo "Repo: $VPS_REPO_DIR"
echo "Instância(s): $INSTANCE  (imagens compartilhadas vilareal-backend / vilareal-frontend)"
echo "Serviços: $SERVICES"
echo
echo "Comandos remotos:"
echo "  $REMOTE_CMD"
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

echo "Deploy concluído (mesma imagem nas instâncias pedidas)."
for inst in "${instances[@]}"; do
  if [[ "$inst" == "portal1" ]]; then
    echo "  Verifique: curl -s https://portal1.villarealadvocacia.adv.br/actuator/health"
  else
    echo "  Verifique: curl -s https://portal.villarealadvocacia.adv.br/actuator/health"
  fi
done
