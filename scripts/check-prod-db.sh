#!/usr/bin/env bash
# Verifica flyway_schema_history e amostra de encoding em pessoa na VPS (MySQL no servidor).
#
# Credenciais: export VILAREAL_VPS_MYSQL_PWD='***' antes de executar (não commits).
# Opcional: VILAREAL_VPS_MYSQL_USER (default vilareal), VPS_SSH_HOST, VILAREAL_MYSQL_DB
#
# Uso: ./scripts/check-prod-db.sh

set -euo pipefail

SSH_HOST="${VPS_SSH_HOST:-root@161.97.175.73}"
MYSQL_USER="${VILAREAL_VPS_MYSQL_USER:-vilareal}"
DB_NAME="${VILAREAL_MYSQL_DB:-vilareal}"

if [[ -z "${VILAREAL_VPS_MYSQL_PWD:-}" ]]; then
  echo "[erro] Defina VILAREAL_VPS_MYSQL_PWD com a senha do utilizador MySQL na VPS (${MYSQL_USER})." >&2
  exit 1
fi

echo "=== (a) Resumo flyway_schema_history ==="
pwd_q="$(printf '%q' "${VILAREAL_VPS_MYSQL_PWD}")"
ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 "${SSH_HOST}" "bash -s" <<EOF
set -euo pipefail
export MYSQL_PWD=${pwd_q}
mysql -u"${MYSQL_USER}" "${DB_NAME}" -e "
SELECT COUNT(*) AS total, SUM(success) AS sucessos, MAX(installed_on) AS ultimo
FROM flyway_schema_history;
"
EOF

echo ""
echo "=== (b) Últimas 8 entradas Flyway ==="
ssh -o ConnectTimeout=20 "${SSH_HOST}" "bash -s" <<EOF
set -euo pipefail
export MYSQL_PWD=${pwd_q}
mysql -u"${MYSQL_USER}" "${DB_NAME}" -e "
SELECT installed_rank, version, description, type, success, installed_on
FROM flyway_schema_history
ORDER BY installed_rank DESC
LIMIT 8;
"
EOF

echo ""
echo "=== (c) Amostra pessoa (possível mojibake em nome) ==="
ssh -o ConnectTimeout=20 "${SSH_HOST}" "bash -s" <<EOF
set -euo pipefail
export MYSQL_PWD=${pwd_q}
mysql -u"${MYSQL_USER}" "${DB_NAME}" -e "
SELECT id, nome FROM pessoa WHERE nome RLIKE '[ÃÂçÉ]' LIMIT 5;
"
EOF

echo ""
echo "Concluído."
