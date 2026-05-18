#!/usr/bin/env bash
# Remove todas as pastas vazias (recursivo, de baixo para cima) em Dropbox/Banco de Dados.
#
# Uso:
#   ./scripts/remover-pastas-vazias-dropbox-banco-dados.sh              # simula (só totais)
#   ./scripts/remover-pastas-vazias-dropbox-banco-dados.sh --verbose     # lista cada pasta
#   ./scripts/remover-pastas-vazias-dropbox-banco-dados.sh --aplicar     # remove de verdade
#   ./scripts/remover-pastas-vazias-dropbox-banco-dados.sh --aplicar --incluir-somente-ds-store
#
# Pasta padrão: ~/Dropbox/Banco de Dados  (ou RAIZ=/caminho)

set -euo pipefail

RAIZ="${RAIZ:-$HOME/Dropbox/Banco de Dados}"
APLICAR=false
VERBOSE=false
INCLUIR_SOMENTE_DS_STORE=false

for arg in "$@"; do
  case "$arg" in
    --aplicar) APLICAR=true ;;
    --verbose) VERBOSE=true ;;
    --incluir-somente-ds-store) INCLUIR_SOMENTE_DS_STORE=true ;;
    -h|--help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
    *)
      echo "Opção desconhecida: $arg" >&2
      exit 1
      ;;
  esac
done

if [[ ! -d "$RAIZ" ]]; then
  echo "Pasta não encontrada: $RAIZ" >&2
  exit 1
fi

echo "Raiz: $RAIZ"
echo "Modo: $([[ "$APLICAR" == true ]] && echo APLICAR || echo SIMULAÇÃO)"
echo ""

total=0

log_dir() {
  if [[ "$VERBOSE" == true ]]; then
    echo "$1"
  fi
}

remover_somente_ds_store() {
  local dir count only n=0
  while IFS= read -r -d '' dir; do
    [[ "$dir" == "$RAIZ" ]] && continue
    count=$(find "$dir" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l | tr -d ' ')
    [[ "$count" -eq 1 ]] || continue
    only=$(find "$dir" -mindepth 1 -maxdepth 1 -name '.DS_Store' 2>/dev/null | wc -l | tr -d ' ')
    [[ "$only" -eq 1 ]] || continue
    if [[ "$APLICAR" == true ]]; then
      rm -f "$dir/.DS_Store"
      if rmdir "$dir" 2>/dev/null; then
        log_dir "removida (só .DS_Store): $dir"
        n=$((n + 1))
      fi
    else
      log_dir "removeria (só .DS_Store): $dir"
      n=$((n + 1))
    fi
  done < <(find "$RAIZ" -depth -type d -print0)
  total=$((total + n))
}

passo_vazias() {
  local n=0 dir
  while IFS= read -r -d '' dir; do
    [[ "$dir" == "$RAIZ" ]] && continue
    if [[ "$APLICAR" == true ]]; then
      if rmdir "$dir" 2>/dev/null; then
        log_dir "removida: $dir"
        n=$((n + 1))
      fi
    else
      log_dir "removeria: $dir"
      n=$((n + 1))
    fi
  done < <(find "$RAIZ" -depth -type d -empty -print0)
  echo "$n"
}

if [[ "$INCLUIR_SOMENTE_DS_STORE" == true ]]; then
  echo "Passo: pastas só com .DS_Store…"
  remover_somente_ds_store
fi

echo "Varrendo pastas vazias (várias passadas até estabilizar)…"
pass=0
while true; do
  pass=$((pass + 1))
  n=$(passo_vazias)
  total=$((total + n))
  [[ "$VERBOSE" == true ]] && echo "  passagem $pass: $n pasta(s)"
  [[ "$n" -eq 0 ]] && break
done

echo ""
if [[ "$APLICAR" == true ]]; then
  echo "Concluído. Pastas removidas: $total (em $pass passagem(ns))"
else
  echo "Simulação. Pastas vazias que seriam removidas: $total"
  echo "Execute com --aplicar para remover. Use --verbose para listar cada uma."
fi
