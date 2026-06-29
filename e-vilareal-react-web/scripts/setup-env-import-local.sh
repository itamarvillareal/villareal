#!/usr/bin/env bash
# Cria e-vilareal-react-web/.env.import.local (não commitar).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env.import.local"

if [[ -f "$ENV_FILE" ]]; then
  echo "Já existe: $ENV_FILE"
  read -rp "Substituir? [s/N] " ok
  [[ "${ok,,}" == "s" || "${ok,,}" == "sim" ]] || exit 0
fi

LOGIN="${VILAREAL_IMPORT_LOGIN:-itamar}"
API_BASE="${VILAREAL_API_BASE:-https://portal.villarealadvocacia.adv.br}"

if [[ -t 0 ]]; then
  read -rp "Login API [${LOGIN}]: " in_login
  [[ -n "${in_login}" ]] && LOGIN="${in_login}"
  read -rsp "Senha API (não aparece na tela): " SENHA
  echo
else
  echo "Terminal não interativo — defina VILAREAL_IMPORT_SENHA no ambiente." >&2
  exit 1
fi

if [[ -z "${SENHA}" ]]; then
  echo "Senha vazia — abortado." >&2
  exit 1
fi

umask 077
cat > "$ENV_FILE" <<ENV
# Credenciais para scripts de importação (import-real, etc.) — não commitar
VILAREAL_IMPORT_LOGIN=${LOGIN}
VILAREAL_IMPORT_SENHA=${SENHA}
VILAREAL_API_BASE=${API_BASE}
ENV
chmod 600 "$ENV_FILE"
unset SENHA

echo "OK: ${ENV_FILE} (perm 600)"
grep -E '^VILAREAL_' "$ENV_FILE" | sed 's/=.*/=***/'
