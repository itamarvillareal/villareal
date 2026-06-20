#!/usr/bin/env bash
# Importa extrato de UM cartão (ou todos) da planilha Extratos Bancos → API local.
#
# Cartões: Mastercard | Visa | Mastercard Sicoob | Mastercard Black | BTG Cartão
#
# Uso:
#   export VILAREAL_IMPORT_SENHA='…'
#   ./scripts/import-cartao-extrato-planilha.sh --cartao "Visa" --dry-run
#   ./scripts/import-cartao-extrato-planilha.sh --cartao "Mastercard Black" --substituir
#   ./scripts/import-cartao-extrato-planilha.sh --todos-cartoes --substituir
#
# Depois de importar localmente, sincronize para a VPS:
#   export DB_PASS='root'
#   ./scripts/sync-cartao-lancamentos-to-vps.sh --cartao "Visa" --yes
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/e-vilareal-react-web"

exec node "$WEB/scripts/import-extrato-cartoes-planilha.mjs" "$@"
