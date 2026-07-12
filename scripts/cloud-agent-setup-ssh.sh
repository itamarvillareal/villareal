#!/usr/bin/env bash
# Materializa a chave SSH da VPS a partir do Runtime Secret VPS_SSH_PRIVATE_KEY
# (Cursor Dashboard → Cloud Agents → Secrets). Usado no boot dos Cloud Agents
# para habilitar deploy e scripts SSH pelo celular.
#
# Não imprime a chave privada. Se o secret não estiver configurado, avisa e sai 0
# (não quebra o install do ambiente).
set -euo pipefail

VPS_HOST="${VPS_HOST:-161.97.175.73}"
SSH_DIR="${HOME}/.ssh"
KEY_PATH="${VPS_SSH_KEY:-${SSH_DIR}/villareal_vps}"

if [[ -z "${VPS_SSH_PRIVATE_KEY:-}" ]]; then
  echo "[cloud-agent-setup-ssh] VPS_SSH_PRIVATE_KEY ausente — configure em cursor.com/dashboard → Cloud Agents → Secrets (Runtime Secret)."
  echo "[cloud-agent-setup-ssh] Deploy via SSH ficará indisponível até o secret ser cadastrado e um novo agente iniciado."
  exit 0
fi

mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

umask 077
printf '%s\n' "$VPS_SSH_PRIVATE_KEY" > "$KEY_PATH"
chmod 600 "$KEY_PATH"

if ! grep -qF "$VPS_HOST" "$SSH_DIR/known_hosts" 2>/dev/null; then
  ssh-keyscan -H "$VPS_HOST" >> "$SSH_DIR/known_hosts" 2>/dev/null || true
fi

echo "[cloud-agent-setup-ssh] Chave gravada em $KEY_PATH (modo 600)."

if ssh -i "$KEY_PATH" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=10 \
    "root@${VPS_HOST}" 'echo cloud-agent-ssh-ok' >/dev/null 2>&1; then
  echo "[cloud-agent-setup-ssh] Teste SSH na VPS: OK"
else
  echo "[cloud-agent-setup-ssh] Teste SSH na VPS: falhou (chave ausente na VPS ou secret incorreto)."
  echo "[cloud-agent-setup-ssh] No Mac: ./scripts/vps-install-ssh-key.sh  (instala a chave pública em authorized_keys)"
fi
