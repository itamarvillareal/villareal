#!/usr/bin/env bash
# aplicar-limpeza-vps.sh — Backup obrigatório + aplica scripts/limpar-dados-negocio.sql no MySQL do VPS.
#
# NÃO executa nada se não confirmar (modo interativo) ou passar --yes / -y
# (ou ASSUME_YES=1), tal como deploy-vps.sh.
#
# Pré-requisitos:
#   export VILAREAL_VPS_MYSQL_PWD='senha-root-mysql-no-vps'
#   SSH sem senha (vilareal-vps ou VPS_HOST).
#
# Uso:
#   ./scripts/aplicar-limpeza-vps.sh          # pede confirmação [y/N]
#   ./scripts/aplicar-limpeza-vps.sh --yes  # sem prompt (CI / operador ciente)
#
set -euo pipefail

readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly VPS="${VPS_HOST:-vilareal-vps}"
readonly SQL_LOCAL="${REPO_ROOT}/scripts/limpar-dados-negocio.sql"
readonly SQL_REMOTE="/opt/vilareal/limpar-dados-negocio.sql"
readonly LOG_DIR_REMOTE="/opt/vilareal/logs"
readonly MYSQL_USER="${VILAREAL_VPS_MYSQL_USER:-root}"
readonly DB_NAME="${VILAREAL_VPS_MYSQL_DB:-vilareal}"

ASSUME_YES="${ASSUME_YES:-0}"

usage() {
  cat <<'USAGE'
Uso:
  export VILAREAL_VPS_MYSQL_PWD='***'
  ./scripts/aplicar-limpeza-vps.sh [--yes|-y]

  --yes, -y     Sem confirmação interativa (perigoso em produção)
  ASSUME_YES=1  Equivalente a --yes

Variáveis opcionais: VPS_HOST, VILAREAL_VPS_MYSQL_USER, VILAREAL_VPS_MYSQL_DB
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y) ASSUME_YES="1" ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Opção desconhecida: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

if [[ -z "${VILAREAL_VPS_MYSQL_PWD:-}" ]]; then
  echo "[erro] Defina VILAREAL_VPS_MYSQL_PWD." >&2
  exit 1
fi
if [[ ! -f "${SQL_LOCAL}" ]]; then
  echo "[erro] Não encontrado: ${SQL_LOCAL}" >&2
  exit 1
fi

confirm() {
  if [[ "${ASSUME_YES}" == "1" ]]; then
    return 0
  fi
  echo
  read -r -p ">>> VAI APAGAR DADOS DE NEGÓCIO DA PRODUÇÃO (VPS). Continuar? [y/N] " ans
  case "$(printf '%s' "$ans" | tr '[:upper:]' '[:lower:]')" in
    y|yes|s|sim) return 0 ;;
    *) echo "[info] Abortado."; exit 0 ;;
  esac
}

snapshot() {
  local pwd_q
  pwd_q="$(printf '%q' "${VILAREAL_VPS_MYSQL_PWD}")"
  ssh -o ConnectTimeout=25 "${VPS}" "bash -s" <<EOF
set -euo pipefail
export MYSQL_PWD=${pwd_q}
mysql -u"${MYSQL_USER}" "${DB_NAME}" -e "SELECT 'SNAPSHOT' AS k, 'pessoa' AS tbl, COUNT(*) AS n FROM pessoa UNION ALL SELECT 'SNAPSHOT','usuarios', COUNT(*) FROM usuarios UNION ALL SELECT 'SNAPSHOT','cliente', COUNT(*) FROM cliente UNION ALL SELECT 'SNAPSHOT','processo', COUNT(*) FROM processo UNION ALL SELECT 'SNAPSHOT','financeiro_lancamento', COUNT(*) FROM financeiro_lancamento UNION ALL SELECT 'SNAPSHOT','financeiro_conta_contabil', COUNT(*) FROM financeiro_conta_contabil UNION ALL SELECT 'SNAPSHOT','pessoa_complementar', COUNT(*) FROM pessoa_complementar UNION ALL SELECT 'SNAPSHOT','agenda_evento', COUNT(*) FROM agenda_evento;"
EOF
}

echo "[passo] Confirmação"
confirm

echo "[passo] Snapshot ANTES (VPS)"
snapshot

echo "[passo] Backup mysqldump (obrigatório)"
"${REPO_ROOT}/scripts/backup-vps-db.sh" --label pre-limpeza

echo "[passo] Enviar SQL para ${VPS}:${SQL_REMOTE}"
scp -o ConnectTimeout=25 "${SQL_LOCAL}" "${VPS}:${SQL_REMOTE}"

LOG_NAME="limpeza-$(date +%Y%m%d-%H%M%S).log"
LOG_REMOTE="${LOG_DIR_REMOTE}/${LOG_NAME}"
LOCAL_LOG_DIR="${REPO_ROOT}/backups"
mkdir -p "${LOCAL_LOG_DIR}"
LOCAL_LOG="${LOCAL_LOG_DIR}/${LOG_NAME}"

echo "[passo] Executar limpeza no MySQL (log remoto: ${LOG_REMOTE})"
pwd_q="$(printf '%q' "${VILAREAL_VPS_MYSQL_PWD}")"
ssh -o ConnectTimeout=25 "${VPS}" "bash -s" <<EOF
set -euo pipefail
export MYSQL_PWD=${pwd_q}
mkdir -p "${LOG_DIR_REMOTE}"
mysql -u"${MYSQL_USER}" "${DB_NAME}" < "${SQL_REMOTE}" 2>&1 | tee "${LOG_REMOTE}"
EOF

echo "[passo] Copiar log para local"
scp -o ConnectTimeout=25 "${VPS}:${LOG_REMOTE}" "${LOCAL_LOG}"

echo "[passo] Snapshot DEPOIS (VPS)"
snapshot

echo "[ok] Concluído. Log local: ${LOCAL_LOG}"
