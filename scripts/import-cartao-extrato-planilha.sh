#!/usr/bin/env bash
# Importa extrato de UM cartão (ou todos) da planilha Extratos Bancos → API local.
#
# Cartões: Mastercard | Visa | Mastercard Sicoob | Mastercard Black | BTG Cartão
#
# Uso (senha em e-vilareal-react-web/.env.import.local — não precisa export manual):
#   ./scripts/import-cartao-extrato-planilha.sh --cartao "Visa" --dry-run
#   ./scripts/import-cartao-extrato-planilha.sh --cartao "Visa" --substituir
#   ./scripts/import-cartao-extrato-planilha.sh --todos-cartoes --substituir
#
# Senha alternativa: export VILAREAL_IMPORT_SENHA='sua-senha-real'
# Depois de importar localmente, sincronize para a VPS:
#   export DB_PASS='root'
#   ./scripts/sync-cartao-lancamentos-to-vps.sh --cartao "Visa" --yes
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/e-vilareal-react-web"

cd "$WEB"
exec node scripts/import-extrato-cartoes-planilha.mjs "$@"
