#!/usr/bin/env bash
# Dump seletivo de correções de responsável em processo_andamento (VPS).
#
# Pré-requisito: diagnóstico
#   cd e-vilareal-react-web
#   node scripts/diagnosticar-historico-usuario-txt-vs-db.mjs
#   node scripts/diagnosticar-historico-usuario-txt-vs-db.mjs --gravar-vps   # opcional: staging na VPS
#
# Uso:
#   ./scripts/vps-historico-usuario-reimport-dump-seletivo.sh --dry-run
#   ./scripts/vps-historico-usuario-reimport-dump-seletivo.sh --yes
#   ./scripts/vps-historico-usuario-reimport-dump-seletivo.sh --yes --from-vps
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/e-vilareal-react-web"

SAIDA="${SAIDA:-$HOME/Downloads/historico-usuario-reimport-vps-$(date +%Y%m%d_%H%M%S).sql}"
RELATORIO="${RELATORIO:-}"
FROM_VPS=0
DRY_RUN=0
YES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --yes) YES=1 ;;
    --from-vps) FROM_VPS=1 ;;
    --saida=*) SAIDA="${1#*=}" ;;
    --relatorio=*) RELATORIO="${1#*=}" ;;
    -h|--help)
      sed -n '2,18p' "$0"
      exit 0
      ;;
    *) echo "Opção desconhecida: $1" >&2; exit 2 ;;
  esac
  shift
done

ARGS=(--saida="$SAIDA")
if [[ -n "$RELATORIO" ]]; then
  ARGS+=(--relatorio="$RELATORIO")
fi
if [[ "$FROM_VPS" -eq 1 ]]; then
  ARGS+=(--from-vps)
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] node scripts/gerar-sql-historico-usuario-reimport.mjs ${ARGS[*]}"
  exit 0
fi

if [[ "$YES" -ne 1 ]]; then
  echo "Use --yes para gerar o dump."
  exit 2
fi

cd "$WEB"
node scripts/gerar-sql-historico-usuario-reimport.mjs "${ARGS[@]}"
