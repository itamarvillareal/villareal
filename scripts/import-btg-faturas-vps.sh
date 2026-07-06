#!/usr/bin/env bash
# Importa faturas BTG (.xlsx) na API de PRODUÇÃO (portal).
# Usa o script Node local (parser + limpeza de ciclo + AUTO-FAT).
#
# Pré-requisitos:
#   1. e-vilareal-react-web/.env.import.local com:
#        VILAREAL_IMPORT_LOGIN=itamar
#        VILAREAL_IMPORT_SENHA=...
#        VILAREAL_FATURA_EXCEL_SENHA=...   # CPF BTG, 11 dígitos
#   2. Arquivos .xlsx em DOWNLOADS ou paths passados como argumentos
#
# Uso:
#   ./scripts/import-btg-faturas-vps.sh --dry-run
#   ./scripts/import-btg-faturas-vps.sh --yes
#   ./scripts/import-btg-faturas-vps.sh --yes ~/Downloads/2025-07-01_*_BTG.xlsx
#
# ATENÇÃO: altera dados financeiros em PRODUÇÃO (cartão BTG Cartão).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/e-vilareal-react-web"
ENV_FILE="$WEB/.env.import.local"
PROD_URL="${VILAREAL_API_BASE:-https://portal.villarealadvocacia.adv.br}"
CARTAO="${VILAREAL_IMPORT_CARTAO:-BTG Cartão}"
DOWNLOADS="${HOME}/Downloads"

DRY=1
YES=0
EXTRA_FILES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY=1; shift ;;
    --yes) YES=1; DRY=0; shift ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *) EXTRA_FILES+=("$1"); shift ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Crie $ENV_FILE (./e-vilareal-react-web/scripts/setup-env-import-local.sh)" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

if [[ -z "${VILAREAL_IMPORT_SENHA:-}" ]]; then
  echo "Defina VILAREAL_IMPORT_SENHA em $ENV_FILE" >&2
  exit 1
fi
if [[ -z "${VILAREAL_FATURA_EXCEL_SENHA:-}" ]]; then
  echo "Defina VILAREAL_FATURA_EXCEL_SENHA (CPF BTG) em $ENV_FILE" >&2
  exit 1
fi

mapfile -t FILES < <(
  if [[ ${#EXTRA_FILES[@]} -gt 0 ]]; then
    printf '%s\n' "${EXTRA_FILES[@]}"
  else
    find "$DOWNLOADS" -maxdepth 1 -name '*_BTG.xlsx' ! -name '~$*' 2>/dev/null | sort
  fi
)

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "Nenhum .xlsx BTG encontrado." >&2
  exit 1
fi

echo "API: $PROD_URL"
echo "Cartão: $CARTAO"
echo "Arquivos (${#FILES[@]}):"
for f in "${FILES[@]}"; do echo "  - $f"; done

HEALTH="$(curl -s -o /dev/null -w '%{http_code}' "${PROD_URL%/}/actuator/health" || true)"
echo "Health: $HEALTH"
if [[ "$HEALTH" != "200" ]]; then
  echo "API indisponível — abortado." >&2
  exit 1
fi

NODE_ARGS=(scripts/import-fatura-cartao.mjs)
for f in "${FILES[@]}"; do NODE_ARGS+=("$f"); done
NODE_ARGS+=(
  "--cartao=${CARTAO}"
  "--base-url=${PROD_URL}"
  "--login=${VILAREAL_IMPORT_LOGIN:-itamar}"
  "--senha=${VILAREAL_IMPORT_SENHA}"
  "--senha-excel=${VILAREAL_FATURA_EXCEL_SENHA}"
)

if [[ "$DRY" -eq 1 ]]; then
  NODE_ARGS+=(--dry-run)
  echo ""
  echo "[dry-run] Conferência apenas — nada será gravado."
else
  echo ""
  echo ">>> GRAVANDO EM PRODUÇÃO <<<"
  if [[ "$YES" -ne 1 ]]; then
    read -r -p "Continuar? [y/N] " resp
    [[ "${resp,,}" == "y" || "${resp,,}" == "sim" ]] || exit 0
  fi
fi

cd "$WEB"
exec node "${NODE_ARGS[@]}"
