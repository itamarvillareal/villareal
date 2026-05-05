#!/usr/bin/env bash
# Obtém a planilha "Cadastro Pessoas" do Mac via SCP, importa para MySQL (runner Java)
# e remove a cópia local de staging no fim (sucesso ou falha no SCP/import).
#
# Pré-requisitos neste servidor:
#   - ssh/scp ao Mac (chave SSH recomendada; teste: ssh USER@HOST echo ok)
#   - Variáveis MAC_SSH_USER, MAC_SSH_HOST (ou ficheiro import-from-mac.local.env)
#
# Uso:
#   cp scripts/import-from-mac.local.env.example scripts/import-from-mac.local.env  # uma vez
#   ./scripts/import-cadastro-pessoas-from-mac.sh
#   MAC_SSH_USER=itamar MAC_SSH_HOST=10.0.0.5 ./scripts/import-cadastro-pessoas-from-mac.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_VILLAREAL="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND="$REPO_VILLAREAL/e-vilareal-java-backend"
RUN_IMPORT="$BACKEND/scripts/run-import-pessoas.sh"

ENV_LOCAL="$SCRIPT_DIR/import-from-mac.local.env"
if [[ -f "$ENV_LOCAL" ]]; then
  # shellcheck disable=SC1090
  set +u
  set -a
  source "$ENV_LOCAL"
  set +a
  set -u
fi

MAC_SSH_USER="${MAC_SSH_USER:-}"
MAC_SSH_HOST="${MAC_SSH_HOST:-}"
MAC_XLS_REMOTE="${MAC_XLS_REMOTE:-/Users/itamar/Dropbox/sistema/Cadastro Pessoas - Itamar.xls}"

STAGING="$SCRIPT_DIR/.cadastro_mac_staging.xls"

cleanup() {
  rm -f "$STAGING"
}
trap cleanup EXIT

if [[ -z "$MAC_SSH_HOST" || -z "$MAC_SSH_USER" ]]; then
  echo "Erro: defina MAC_SSH_USER e MAC_SSH_HOST (Mac acessível por SSH desde este servidor)." >&2
  echo "  Opção A: crie $ENV_LOCAL (veja import-from-mac.local.env.example)" >&2
  echo "  Opção B: MAC_SSH_USER=... MAC_SSH_HOST=... $0" >&2
  exit 1
fi

# Mesmo ficheiro que o systemd usa na VPS (credenciais DB / JWT)
if [[ -r /etc/villareal/backend.env ]]; then
  # shellcheck disable=SC1090
  set +u
  set -a
  source /etc/villareal/backend.env
  set +a
  set -u
fi

# JAR em produção costuma estar aqui ou em /opt/villareal/api/api.jar
if [[ -z "${VILAREAL_IMPORT_PESSOAS_API_JAR:-}" ]]; then
  if [[ -f /opt/villareal/app/api.jar ]]; then
    export VILAREAL_IMPORT_PESSOAS_API_JAR="/opt/villareal/app/api.jar"
  fi
fi

REMOTE_SPEC="${MAC_SSH_USER}@${MAC_SSH_HOST}:${MAC_XLS_REMOTE}"

echo "[1/3] SCP: ${REMOTE_SPEC} -> $STAGING"
scp -q "$REMOTE_SPEC" "$STAGING"

if [[ ! -f "$STAGING" ]]; then
  echo "Erro: SCP não criou $STAGING" >&2
  exit 1
fi

echo "[2/3] Importação (Java: cópia interna temporária + INSERT na BD; DRY_RUN=false, todas as linhas)"
cd "$BACKEND"
export DRY_RUN=false
export LIMIT=0
# Subprocesso: quando o run-import termina, este script continua e o trap remove o staging.
bash "$RUN_IMPORT" "$STAGING"

echo "[3/3] Removendo cópia local de staging."
trap - EXIT
cleanup

echo "Concluído."
