#!/bin/bash
set -e
cd ~/Documents/villareal

if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  echo "Nada para commitar."
  exit 0
fi

echo "=== Arquivos alterados ==="
git status --short
echo ""

if [ -n "$1" ]; then
  MSG="$1"
else
  CHANGED=$(git diff --name-only | head -5 | xargs -I{} basename {} | sort -u | tr '\n' ', ' | sed 's/,$//')
  ADDED=$(git ls-files --others --exclude-standard | head -3 | xargs -I{} basename {} | sort -u | tr '\n' ', ' | sed 's/,$//')
  MSG="update: ${CHANGED}${ADDED:+ + $ADDED}"
fi

echo "Mensagem: $MSG"
echo ""

git add -A
git commit -m "$MSG"
git push
./scripts/deploy-vps.sh --yes
