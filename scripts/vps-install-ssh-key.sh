#!/usr/bin/env bash
# Instala ~/.ssh/villareal_vps.pub na VPS (uma vez, com senha root).
set -euo pipefail

KEY="${HOME}/.ssh/villareal_vps.pub"
HOST="${VPS_HOST:-root@161.97.175.73}"

if [[ ! -f "$KEY" ]]; then
  echo "Chave não encontrada. Rode primeiro:" >&2
  echo "  ssh-keygen -t ed25519 -f ~/.ssh/villareal_vps -N \"\" -C vilareal-vps-cursor" >&2
  exit 1
fi

echo "Chave pública:"
cat "$KEY"
echo
echo "Instalando em $HOST (vai pedir senha root uma vez)…"
ssh-copy-id -i "$KEY" -o IdentitiesOnly=yes "$HOST"
echo
echo "Teste:"
ssh -i "${HOME}/.ssh/villareal_vps" -o IdentitiesOnly=yes "$HOST" 'echo OK — $(hostname)'
