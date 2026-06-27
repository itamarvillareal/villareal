#!/usr/bin/env bash
# Commita alterações pendentes (se houver), faz push e deploy na VPS.
# Uso:
#   ./scripts/commit-deploy.sh
#   ./scripts/commit-deploy.sh "mensagem customizada"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

nada_para_commitar() {
  git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]
}

gerar_mensagem_commit() {
  if [ -n "${1:-}" ]; then
    printf '%s\n' "$1"
    return
  fi
  local changed added
  changed=$(git diff --name-only 2>/dev/null | head -5 | xargs -I{} basename {} 2>/dev/null | sort -u | tr '\n' ', ' | sed 's/,$//')
  added=$(git ls-files --others --exclude-standard 2>/dev/null | head -3 | xargs -I{} basename {} 2>/dev/null | sort -u | tr '\n' ', ' | sed 's/,$//')
  if [ -n "$changed" ] || [ -n "$added" ]; then
    printf 'update: %s%s\n' "$changed" "${added:+ + $added}"
  else
    printf 'update: alterações locais\n'
  fi
}

echo "=== Repositório: $ROOT ==="
echo ""

if nada_para_commitar; then
  echo "Nenhuma alteração local para commitar."
else
  echo "=== Arquivos alterados ==="
  git status --short
  echo ""

  MSG=$(gerar_mensagem_commit "${1:-}")
  echo "Mensagem: $MSG"
  echo ""

  git add -A
  git commit -m "$MSG"
  echo ""
  echo "Commit criado."
fi

echo ""
echo "=== Push ==="
git push

echo ""
echo "=== Deploy VPS ==="
"$ROOT/scripts/deploy-vps.sh" --yes
