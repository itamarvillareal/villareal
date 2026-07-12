# Cloud Agent — deploy e SSH pelo celular

Guia para operar o repositório **villareal** via **Cloud Agents** (Cursor no celular), incluindo deploy na VPS sem depender do Mac em cada tarefa.

## Pré-requisitos

| Item | Valor |
|------|-------|
| VPS | `root@161.97.175.73` |
| Repo na VPS | `/opt/villareal/villareal` |
| Chave SSH local (Mac) | `~/.ssh/villareal_vps` |
| Secret no Cursor | `VPS_SSH_PRIVATE_KEY` (Runtime Secret) |

## 1. Chave SSH no Mac (uma vez)

Se ainda não tiver a chave:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/villareal_vps -N "" -C "vilareal-vps-cursor"
```

Instale a chave **pública** na VPS (pede senha root uma vez):

```bash
./scripts/vps-install-ssh-key.sh
```

Teste:

```bash
ssh -i ~/.ssh/villareal_vps -o IdentitiesOnly=yes root@161.97.175.73 'echo OK — $(hostname)'
```

## 2. Secret no Cursor Dashboard

1. Abra [cursor.com/dashboard](https://cursor.com/dashboard) → **Cloud Agents** → **Secrets**
2. Crie um secret do tipo **Runtime Secret** (não Environment Variable):
   - **Nome:** `VPS_SSH_PRIVATE_KEY`
   - **Valor:** conteúdo completo de `~/.ssh/villareal_vps` no Mac:

     ```bash
     cat ~/.ssh/villareal_vps
     ```

3. Salve o secret
4. Inicie um **novo** Cloud Agent — secrets não entram em agentes já abertos

> **Segurança:** nunca commite a chave privada. O Runtime Secret é redigido nos logs do agente.

## 3. O que o repositório faz automaticamente

O arquivo `.cursor/environment.json` na raiz configura o ambiente remoto:

- **`install`:** materializa a chave (`scripts/cloud-agent-setup-ssh.sh`), instala dependências npm e Maven
- **`update`:** reexecuta o setup SSH antes de cada agente (útil se o secret foi adicionado depois)

O script `scripts/cloud-agent-setup-ssh.sh`:

- Lê `VPS_SSH_PRIVATE_KEY`
- Grava `~/.ssh/villareal_vps` com permissão `600`
- Adiciona o host ao `known_hosts`
- Testa SSH em modo batch (sem expor a chave)

## 4. Validar no Cloud Agent

Após configurar o secret e abrir um agente novo:

```bash
ls -la ~/.ssh/villareal_vps
ssh -i ~/.ssh/villareal_vps -o IdentitiesOnly=yes root@161.97.175.73 'echo OK'
./scripts/deploy-vps.sh --backend-only --dry-run
```

Deploy real:

```bash
./scripts/deploy-vps.sh --backend-only --yes --skip-preflight
```

Confirme saúde:

```bash
curl -s https://portal.villarealadvocacia.adv.br/actuator/health
```

## 5. Solução de problemas

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| `Permission denied (publickey)` | Secret ausente ou agente antigo | Cadastre `VPS_SSH_PRIVATE_KEY` e abra agente novo |
| `VPS_SSH_PRIVATE_KEY ausente` no log | Secret não criado no dashboard | Passo 2 acima |
| SSH OK no Mac, falha no Cloud Agent | Chave pública não na VPS | `./scripts/vps-install-ssh-key.sh` no Mac |
| Deploy sobe mas e-mails TRT não importam | Gmail OAuth na VPS | Verifique tokens em `/home/vilareal/gmail-tokens` |

## 6. Variáveis opcionais

| Variável | Padrão | Uso |
|----------|--------|-----|
| `VPS_HOST` | `161.97.175.73` | IP da VPS (só host, sem `root@`) |
| `VPS_SSH_KEY` | `~/.ssh/villareal_vps` | Caminho alternativo da chave |
| `VPS_REPO_DIR` | `/opt/villareal/villareal` | Repo na VPS (`deploy-vps.sh`) |
