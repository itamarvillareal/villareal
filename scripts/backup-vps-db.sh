#!/usr/bin/env bash
# backup-vps-db.sh — mysqldump do banco vilareal no VPS (MySQL nativo systemd) + cópia local.
#
# Pré-requisitos:
#   - SSH sem senha para o VPS (ex.: Host vilareal-vps ou root@161.97.175.73 no ~/.ssh/config).
#   - Variável VILAREAL_VPS_MYSQL_PWD: senha do utilizador MySQL usado no mysqldump (típico: root no VPS).
#
# Uso:
#   export VILAREAL_VPS_MYSQL_PWD='***'
#   ./scripts/backup-vps-db.sh
#   ./scripts/backup-vps-db.sh --label pre-limpeza
#   VPS_HOST=161.97.175.73 ./scripts/backup-vps-db.sh --label teste
#
# Saída no VPS:  /opt/vilareal/backups/vilareal-YYYYMMDD-HHMMSS-<label>.sql.gz
# Cópia local:   <raiz-do-repo>/backups/ (mesmo nome de ficheiro)
#
# Não armazene a password em ficheiros versionados.
set -euo pipefail

readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly VPS="${VPS_HOST:-vilareal-vps}"
readonly REMOTE_DIR="/opt/vilareal/backups"
readonly MYSQL_USER="${VILAREAL_VPS_MYSQL_USER:-root}"
readonly DB_NAME="${VILAREAL_VPS_MYSQL_DB:-vilareal}"

LABEL="$(date +%Y%m%d-%H%M%S)-backup"

usage() {
  cat <<'USAGE'
Uso:
  export VILAREAL_VPS_MYSQL_PWD='senha-mysql-no-vps'
  ./scripts/backup-vps-db.sh [--label NOME]

Opções:
  --label <nome>   Sufixo do ficheiro (default: timestamp-backup)
  -h, --help       Esta ajuda

Variáveis opcionais:
  VPS_HOST                    (default: vilareal-vps)
  VILAREAL_VPS_MYSQL_USER     (default: root)
  VILAREAL_VPS_MYSQL_DB       (default: vilareal)
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --label)
      LABEL="$(date +%Y%m%d-%H%M%S)-$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Opção desconhecida: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${VILAREAL_VPS_MYSQL_PWD:-}" ]]; then
  echo "[erro] Defina VILAREAL_VPS_MYSQL_PWD (senha MySQL no VPS para ${MYSQL_USER})." >&2
  exit 1
fi

REMOTE_FILE="${REMOTE_DIR}/vilareal-${LABEL}.sql.gz"
LOCAL_DIR="${REPO_ROOT}/backups"
LOCAL_FILE="${LOCAL_DIR}/$(basename "${REMOTE_FILE}")"
MYSQL_PWD_Q="$(printf '%q' "${VILAREAL_VPS_MYSQL_PWD}")"

echo "[info] VPS=${VPS} remoto=${REMOTE_FILE}"

ssh -o ConnectTimeout=20 "${VPS}" "bash -s" <<REMOTE
set -euo pipefail
export MYSQL_PWD=${MYSQL_PWD_Q}
mkdir -p "${REMOTE_DIR}"
mysqldump -u"${MYSQL_USER}" --single-transaction --routines --triggers "${DB_NAME}" \\
  | gzip -c > "${REMOTE_FILE}"
ls -lh "${REMOTE_FILE}"
REMOTE

mkdir -p "${LOCAL_DIR}"
scp -o ConnectTimeout=20 "${VPS}:${REMOTE_FILE}" "${LOCAL_FILE}"
echo "[ok] Local: ${LOCAL_FILE}"
ls -lh "${LOCAL_FILE}"
