#!/usr/bin/env bash
# Deploy portal.villarealadvocacia.adv.br a partir do Mac (SSH como root na VPS).
# Uso: ./scripts/deploy-vps.sh [--all|--frontend-only|--backend-only] [--no-pull] [--dry-run]
set -euo pipefail

readonly VPS_HOST="${VPS_HOST:-161.97.175.73}"
readonly VPS_USER="${VPS_USER:-root}"
readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_ok() { echo -e "${GREEN}[ok]${NC} $*"; }
log_err() { echo -e "${RED}[erro]${NC} $*" >&2; }
log_step() { echo -e "${YELLOW}[passo]${NC} $*"; }
log_info() { echo -e "${BLUE}[info]${NC} $*"; }

usage() {
  cat <<'USAGE'
Uso:
  scripts/deploy-vps.sh [opções]

Opções:
  --all              Frontend + backend (padrão)
  --frontend-only    Só npm ci/build e cópia para /opt/vilareal/web/
  --backend-only     Só Maven, JAR, restart do systemd e health
  --no-pull          Não executa git fetch/checkout/reset na VPS
  --dry-run          Mostra o que seria feito (não executa SSH)
  -h, --help         Esta ajuda

Variáveis opcionais:
  VPS_HOST   (padrão: 161.97.175.73)
  VPS_USER   (padrão: root)

Documentação: scripts/README-deploy.md
USAGE
}

DEPLOY_MODE="all"
NO_PULL="0"
DRY_RUN="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all) DEPLOY_MODE="all" ;;
    --frontend-only) DEPLOY_MODE="frontend" ;;
    --backend-only) DEPLOY_MODE="backend" ;;
    --no-pull) NO_PULL="1" ;;
    --dry-run) DRY_RUN="1" ;;
    -h|--help) usage; exit 0 ;;
    *)
      log_err "Opção desconhecida: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

START_TS="$(date +%s)"

confirm_all() {
  if [[ "$DEPLOY_MODE" != "all" || "$DRY_RUN" == "1" ]]; then
    return 0
  fi
  echo
  read -r -p "Continuar deploy completo (backend + frontend) na VPS? [y/N] " ans
  ans_lc="$(printf '%s' "$ans" | tr '[:upper:]' '[:lower:]')"
  case "$ans_lc" in
    y|yes|s|sim) return 0 ;;
    *) log_info "Abortado pelo utilizador."; exit 0 ;;
  esac
}

show_local_main_tip() {
  log_step "Commit em main (local) que referencia o deploy"
  cd "$REPO_ROOT"
  if ! git rev-parse --git-dir >/dev/null 2>&1; then
    log_err "Não é um repositório git: $REPO_ROOT"
    exit 1
  fi
  git fetch origin main --quiet 2>/dev/null || true
  if git show-ref --verify --quiet refs/heads/main; then
    git log -1 --oneline main
  elif git show-ref --verify --quiet refs/remotes/origin/main; then
    log_info "Branch local main ausente; a mostrar origin/main:"
    git log -1 --oneline origin/main
  else
    log_err "Não foi encontrada a branch main."
    exit 1
  fi
}

run_remote_script() {
  ssh -o "ConnectTimeout=15" "${VPS_USER}@${VPS_HOST}" bash -s "$DEPLOY_MODE" "$NO_PULL" <<'REMOTE_SCRIPT'
set -euo pipefail
DEPLOY_MODE="$1"
NO_PULL="$2"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
ok() { echo -e "${GREEN}[ok]${NC} $*"; }
er() { echo -e "${RED}[erro]${NC} $*" >&2; }
st() { echo -e "${YELLOW}[passo]${NC} $*"; }
inf() { echo -e "${BLUE}[info]${NC} $*"; }

st "cd /opt/vilareal"
cd /opt/vilareal

if [[ "${NO_PULL}" != "1" ]]; then
  st "git fetch / checkout main / reset --hard origin/main (como vilareal)"
  sudo -u vilareal git fetch origin
  sudo -u vilareal git checkout main
  sudo -u vilareal git reset --hard origin/main
  sudo -u vilareal git log -1 --oneline
else
  inf "A saltar git pull (--no-pull)"
  sudo -u vilareal git log -1 --oneline 2>/dev/null || true
fi

deploy_backend() {
  st "Maven: clean package (sem testes)"
  cd /opt/vilareal/e-vilareal-java-backend
  sudo -u vilareal ./mvnw clean package -DskipTests -q
  JAR=""
  for f in target/*.jar; do
    [[ -f "$f" ]] || continue
    [[ "$f" == *.jar.original ]] && continue
    JAR="$f"
    break
  done
  if [[ -z "$JAR" || ! -f "$JAR" ]]; then
    er "JAR não encontrado em target/"
    exit 1
  fi
  st "Copiar JAR para /opt/vilareal/api/api.jar ($JAR)"
  cp "$JAR" /opt/vilareal/api/api.jar
  chown vilareal:vilareal /opt/vilareal/api/api.jar
  st "systemctl restart vilareal-backend"
  systemctl restart vilareal-backend
  st "Aguardar 30s pelo arranque do Spring Boot..."
  sleep 30
  st "Verificar GET http://127.0.0.1:8080/actuator/health"
  HEALTH_OK=0
  for i in $(seq 1 12); do
    if curl -sf --max-time 10 "http://127.0.0.1:8080/actuator/health" | grep -q 'UP'; then
      HEALTH_OK=1
      break
    fi
    inf "Tentativa ${i}/12: health ainda não OK; a aguardar 5s..."
    sleep 5
  done
  if [[ "${HEALTH_OK}" -ne 1 ]]; then
    er "Health check falhou após espera."
    curl -sv --max-time 5 "http://127.0.0.1:8080/actuator/health" 2>&1 | tail -n 20 || true
    exit 1
  fi
  ok "Backend responde em /actuator/health"
}

deploy_frontend() {
  st "Frontend: npm ci && npm run build (como vilareal)"
  cd /opt/vilareal/e-vilareal-react-web
  sudo -u vilareal npm ci
  sudo -u vilareal npm run build
  st "Publicar dist/ em /opt/vilareal/web/"
  rm -rf /opt/vilareal/web/*
  cp -r dist/. /opt/vilareal/web/
  chown -R vilareal:vilareal /opt/vilareal/web
  st "systemctl reload nginx"
  systemctl reload nginx
  st "HEAD https://portal.villarealadvocacia.adv.br/"
  curl -sI --max-time 20 "https://portal.villarealadvocacia.adv.br/" | head -n 1
  ok "Pedido HTTPS ao portal concluído"
}

case "${DEPLOY_MODE}" in
  all)
    deploy_backend
    deploy_frontend
    ;;
  backend)
    deploy_backend
    ;;
  frontend)
    deploy_frontend
    ;;
  *)
    er "Modo remoto inválido: ${DEPLOY_MODE}"
    exit 1
    ;;
esac
ok "Deploy remoto concluído."
REMOTE_SCRIPT
}

dry_run_preview() {
  log_step "Dry-run: resumo do que seria executado na VPS"
  log_info "SSH: ${VPS_USER}@${VPS_HOST}"
  log_info "Modo: $DEPLOY_MODE | NO_PULL=$NO_PULL"
  echo
  if [[ "$NO_PULL" != "1" ]]; then
    echo "  - cd /opt/vilareal && sudo -u vilareal git fetch && checkout main && reset --hard origin/main"
  else
    echo "  - (sem git pull)"
  fi
  case "$DEPLOY_MODE" in
    all|backend)
      echo "  - ./mvnw clean package -DskipTests (e-vilareal-java-backend)"
      echo "  - cp JAR -> /opt/vilareal/api/api.jar; chown; systemctl restart vilareal-backend"
      echo "  - sleep 30; curl 127.0.0.1:8080/actuator/health (até 12×5s)"
      ;;
  esac
  case "$DEPLOY_MODE" in
    all|frontend)
      echo "  - npm ci && npm run build (e-vilareal-react-web)"
      echo "  - rm -rf /opt/vilareal/web/*; cp -r dist/. ...; chown; systemctl reload nginx"
      echo "  - curl -I https://portal.villarealadvocacia.adv.br/"
      ;;
  esac
}

# --- fluxo principal (Mac) ---
log_info "Repositório local: $REPO_ROOT"
show_local_main_tip
confirm_all

if [[ "$DRY_RUN" == "1" ]]; then
  dry_run_preview
  END_TS="$(date +%s)"
  log_ok "Dry-run terminado em $((END_TS - START_TS))s"
  exit 0
fi

log_step "SSH ${VPS_USER}@${VPS_HOST} (remoto)…"
run_remote_script

END_TS="$(date +%s)"
log_ok "Deploy total (incl. SSH) em $((END_TS - START_TS))s"
