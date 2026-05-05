#!/usr/bin/env bash
# push-local-docker-db-to-remote-tunnel.sh
#
# Envia uma cópia lógica completa da base `vilareal` do Docker local para o MySQL na VPS,
# usando um túnel SSH (por ex. 3308 -> localhost:3306 na VPS).
#
# PRÉ-REQUISITOS IMPORTANTES:
#   1) Na VPS o backend já correu Flyway até a mesma (ou inferior) revisão que o dump local —
#      ou seja, o esquema remoto deve ser compatível com o mysqldump (ideal: deploy backend
#      na VPS antes, com este repositório, para aplicar até V40+).
#   2) O utilizador MySQL remoto (--remote-user, default villareal_remote) precisa de
#      privilégios para DROP/CREATE/ALTER nas tabelas do schema `vilareal` (mysqldump padrão
#      usa DROP TABLE IF EXISTS antes de cada CREATE).
#   3) Túnel ativo na máquina local, exemplo:
#        ssh -N -L 3308:127.0.0.1:3306 root@SEU_HOST_VPS
#   4) Isto SUBSTITUI o conteúdo das tabelas do schema remotos pelos dados do Docker local —
#      incluídos `usuarios` / `flyway_schema_history`. Só usar se isso é intencional.
#
# Não armazene passwords em ficheiros versionados. Use apenas variáveis de ambiente.
#
# Uso:
#   export VILLAREAL_VPS_MYSQL_TUNNEL_PWD='***'
#   ./scripts/push-local-docker-db-to-remote-tunnel.sh              # pede confirmação [y/N]
#   ASSUME_YES=1 ./scripts/push-local-docker-db-to-remote-tunnel.sh
#
# Opcional:
#   REMOTE_TUNNEL_PORT=3308 \
#   VILLAREAL_VPS_MYSQL_TUNNEL_USER=villareal_remote \
#   ./scripts/push-local-docker-db-to-remote-tunnel.sh --dry-run
#
set -euo pipefail

readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly LOCAL_BACKUP_DIR="${REPO_ROOT}/backups"
readonly TS="$(date +%Y%m%d-%H%M%S)"

REMOTE_HOST="${REMOTE_TUNNEL_HOST:-127.0.0.1}"
REMOTE_PORT="${REMOTE_TUNNEL_PORT:-3308}"
REMOTE_USER="${VILLAREAL_VPS_MYSQL_TUNNEL_USER:-villareal_remote}"
DB_NAME="${VILAREAL_MYSQL_DB:-vilareal}"

DOCKER_CONTAINER="${VILAREAL_DOCKER_DB_CONTAINER:-vilareal-db}"
LOCAL_TCP_HOST="${LOCAL_MYSQL_HOST:-127.0.0.1}"
LOCAL_TCP_PORT="${LOCAL_MYSQL_PORT:-3307}"
LOCAL_USER="${LOCAL_MYSQL_USER:-root}"
LOCAL_PASSWORD="${LOCAL_MYSQL_PASSWORD:-root}"

DRY_RUN="0"
BACKUP_REMOTE_BEFORE="1"
SKIP_FLYWAY_CHECK="0"
ASSUME_YES="${ASSUME_YES:-0}"

usage() {
  cat <<'USAGE'
Uso:
  export VILLAREAL_VPS_MYSQL_TUNNEL_PWD='senha-do-utilizador-remoto'
  ./scripts/push-local-docker-db-to-remote-tunnel.sh [opções]

Opções:
  --dry-run                 Mostra comandos / ficheiros, não escreve no remoto (faz dump local)
  --no-backup-remote        Não faz mysqldump de segurança no remoto antes do push
  --skip-flyway-check       Não compara última entrada flyway_schema_history local vs remoto
  --yes, -y                 Sem confirmação interativa
  ASSUME_YES=1              Equivalente a --yes
  -h, --help                Esta ajuda

Variáveis úteis:
  REMOTE_TUNNEL_HOST       (default 127.0.0.1)
  REMOTE_TUNNEL_PORT       (default 3308)
  VILLAREAL_VPS_MYSQL_TUNNEL_USER   (default villareal_remote)
  VILAREAL_MYSQL_DB        (default vilareal)
  VILAREAL_DOCKER_DB_CONTAINER      (default vilareal-db)
  LOCAL_MYSQL_HOST / LOCAL_MYSQL_PORT / LOCAL_MYSQL_USER / LOCAL_MYSQL_PASSWORD
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN="1" ;;
    --no-backup-remote) BACKUP_REMOTE_BEFORE="0" ;;
    --skip-flyway-check) SKIP_FLYWAY_CHECK="1" ;;
    --yes|-y) ASSUME_YES="1" ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "[erro] Opção desconhecida: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

log() { echo "[push] $*"; }
die() { echo "[erro] $*" >&2; exit 1; }

if [[ -z "${VILLAREAL_VPS_MYSQL_TUNNEL_PWD:-}" ]]; then
  die "Defina VILLAREAL_VPS_MYSQL_TUNNEL_PWD (password do utilizador MySQL remoto via túnel)."
fi

docker_ok() {
  docker info >/dev/null 2>&1 && docker inspect -f '{{.State.Running}}' "${DOCKER_CONTAINER}" 2>/dev/null | grep -qx true
}

preflight_mysql() {
  MYSQL_PWD="${VILLAREAL_VPS_MYSQL_TUNNEL_PWD}" mysql --protocol=TCP -h"${REMOTE_HOST}" -P"${REMOTE_PORT}" \
    -u"${REMOTE_USER}" "${DB_NAME}" -e "SELECT 1 AS remote_ok;" >/dev/null 2>&1 \
    || die "Falhou ligação MySQL ao túnel ${REMOTE_HOST}:${REMOTE_PORT} com utilizador '${REMOTE_USER}'."
}

flyway_last_line() {
  # Saída: installed_rank	version	description	success
  docker exec "${DOCKER_CONTAINER}" mysql -u"${LOCAL_USER}" -p"${LOCAL_PASSWORD}" -N -B "${DB_NAME}" \
    -e "SELECT installed_rank, version, description, success FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1;" 2>/dev/null \
    || MYSQL_PWD="${LOCAL_PASSWORD}" mysql --protocol=TCP -h"${LOCAL_TCP_HOST}" -P"${LOCAL_TCP_PORT}" \
      -u"${LOCAL_USER}" -N -B "${DB_NAME}" \
      -e "SELECT installed_rank, version, description, success FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1;"
}

flyway_remote_last_line() {
  MYSQL_PWD="${VILLAREAL_VPS_MYSQL_TUNNEL_PWD}" mysql --protocol=TCP -h"${REMOTE_HOST}" -P"${REMOTE_PORT}" \
    -u"${REMOTE_USER}" -N -B "${DB_NAME}" \
    -e "SELECT installed_rank, version, description, success FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1;"
}

confirm() {
  if [[ "${ASSUME_YES}" == "1" || "${DRY_RUN}" == "1" ]]; then
    return 0
  fi
  echo
  read -r -p ">>> Isto substitui o schema '${DB_NAME}' no MySQL remoto (via túnel). Continuar? [y/N] " ans
  case "$(printf '%s' "$ans" | tr '[:upper:]' '[:lower:]')" in
    y|yes|s|sim) return 0 ;;
    *) log "Abortado."; exit 0 ;;
  esac
}

mkdir -p "${LOCAL_BACKUP_DIR}"

if docker_ok; then
  DUMP_SOURCE="docker:${DOCKER_CONTAINER}"
  log "Origem mysqldump: container ${DOCKER_CONTAINER}"
else
  DUMP_SOURCE="tcp:${LOCAL_TCP_HOST}:${LOCAL_TCP_PORT}"
  log "Container ${DOCKER_CONTAINER} indisponível; origem mysqldump: TCP ${LOCAL_TCP_HOST}:${LOCAL_TCP_PORT}"
  MYSQL_PWD="${LOCAL_PASSWORD}" mysql --protocol=TCP -h"${LOCAL_TCP_HOST}" -P"${LOCAL_TCP_PORT}" \
    -u"${LOCAL_USER}" "${DB_NAME}" -e "SELECT 1;" >/dev/null 2>&1 \
    || die "MySQL local inacessível em ${LOCAL_TCP_HOST}:${LOCAL_TCP_PORT} (subir docker compose?)."
fi

preflight_mysql

if [[ "${SKIP_FLYWAY_CHECK}" != "1" ]]; then
  log "Comparar última entrada flyway_schema_history (local vs remoto)…"
  L_FLY="$(flyway_last_line)"
  R_FLY="$(flyway_remote_last_line)"
  log "Local:   ${L_FLY}"
  log "Remoto:  ${R_FLY}"
  if [[ "$(echo "${L_FLY}" | awk '{print $1}')" != "$(echo "${R_FLY}" | awk '{print $1}')" ]]; then
    echo "[aviso] installed_rank diferente entre local e remoto — revise migrações antes de importar." >&2
    if [[ "${ASSUME_YES}" != "1" && "${DRY_RUN}" != "1" ]]; then
      read -r -p "Continuar mesmo assim? [y/N] " ans2
      case "$(printf '%s' "$ans2" | tr '[:upper:]' '[:lower:]')" in
        y|yes|s|sim) ;;
        *) log "Abortado."; exit 0 ;;
      esac
    fi
  fi
fi

LOCAL_DUMP_GZ="${LOCAL_BACKUP_DIR}/vilareal-from-local-${TS}.sql.gz"
REMOTE_PRE_PUSH_GZ="${LOCAL_BACKUP_DIR}/vilareal-remote-before-push-${TS}.sql.gz"

confirm

if [[ "${BACKUP_REMOTE_BEFORE}" == "1" ]]; then
  log "Backup de segurança do remoto antes do push -> ${REMOTE_PRE_PUSH_GZ}"
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "  MYSQL_PWD=*** mysqldump -h${REMOTE_HOST} -P${REMOTE_PORT} -u${REMOTE_USER} ${DB_NAME} | gzip > ${REMOTE_PRE_PUSH_GZ}"
  else
    MYSQL_PWD="${VILLAREAL_VPS_MYSQL_TUNNEL_PWD}" mysqldump --protocol=TCP -h"${REMOTE_HOST}" -P"${REMOTE_PORT}" \
      -u"${REMOTE_USER}" --no-tablespaces --single-transaction --routines --triggers \
      --default-character-set=utf8mb4 "${DB_NAME}" | gzip > "${REMOTE_PRE_PUSH_GZ}"
    ls -lh "${REMOTE_PRE_PUSH_GZ}"
  fi
fi

log "Gerar mysqldump local -> ${LOCAL_DUMP_GZ}"
if [[ "${DRY_RUN}" == "1" ]]; then
  echo "  (docker|mysqldump) ... | gzip > ${LOCAL_DUMP_GZ}"
else
  if docker_ok; then
    docker exec "${DOCKER_CONTAINER}" mysqldump -u"${LOCAL_USER}" -p"${LOCAL_PASSWORD}" \
      --no-tablespaces --single-transaction --routines --triggers \
      --default-character-set=utf8mb4 "${DB_NAME}" | gzip > "${LOCAL_DUMP_GZ}"
  else
    MYSQL_PWD="${LOCAL_PASSWORD}" mysqldump --protocol=TCP -h"${LOCAL_TCP_HOST}" -P"${LOCAL_TCP_PORT}" \
      -u"${LOCAL_USER}" --no-tablespaces --single-transaction --routines --triggers \
      --default-character-set=utf8mb4 "${DB_NAME}" | gzip > "${LOCAL_DUMP_GZ}"
  fi
  ls -lh "${LOCAL_DUMP_GZ}"
fi

if [[ "${DRY_RUN}" == "1" ]]; then
  log "Dry-run: importação ignorada."
  log "Para importar: gunzip -c ${LOCAL_DUMP_GZ} | MYSQL_PWD=*** mysql -h${REMOTE_HOST} -P${REMOTE_PORT} -u${REMOTE_USER} ${DB_NAME}"
  exit 0
fi

log "Importar no remoto (pode demorar)…"
gunzip -c "${LOCAL_DUMP_GZ}" | MYSQL_PWD="${VILLAREAL_VPS_MYSQL_TUNNEL_PWD}" mysql --protocol=TCP \
  -h"${REMOTE_HOST}" -P"${REMOTE_PORT}" -u"${REMOTE_USER}" "${DB_NAME}"

log "Auditoria pós-push (remoto)"
MYSQL_PWD="${VILLAREAL_VPS_MYSQL_TUNNEL_PWD}" mysql --protocol=TCP -h"${REMOTE_HOST}" -P"${REMOTE_PORT}" \
  -u"${REMOTE_USER}" "${DB_NAME}" -e "
SELECT 'pessoa' AS tbl, COUNT(*) AS n FROM pessoa
UNION ALL SELECT 'cliente', COUNT(*) FROM cliente
UNION ALL SELECT 'processo', COUNT(*) FROM processo
UNION ALL SELECT 'usuarios', COUNT(*) FROM usuarios
UNION ALL SELECT 'flyway_schema_history', COUNT(*) FROM flyway_schema_history;
"

log "Concluído. Dump local usado: ${LOCAL_DUMP_GZ}"
