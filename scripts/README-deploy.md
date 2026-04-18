# Deploy na VPS (portal.villarealadvocacia.adv.br)

Script pensado para correr **no Mac** (ou outra máquina com `ssh` e `git`). Liga por SSH à VPS como **root** e executa build/pull na cópia do repositório em `/opt/vilareal`.

## Ambiente na VPS

| Item | Caminho / serviço |
|------|-------------------|
| Repositório | `/opt/vilareal` (owner `vilareal:vilareal`) |
| Backend JAR | `/opt/vilareal/api/api.jar` |
| systemd (API) | `vilareal-backend` |
| Ficheiros estáticos (Nginx) | `/opt/vilareal/web/` |
| Branch de produção | `main` |
| Host SSH (padrão) | `161.97.175.73` |

## Pré-requisitos

- Chave SSH configurada para `root@161.97.175.73` (sem prompt de password, idealmente).
- Estares na raiz do clone local do mesmo repositório (o script resolve o caminho a partir de `scripts/deploy-vps.sh`).

## Uso

```bash
# Deploy completo (git na VPS + backend + frontend) — pede confirmação [y/N]
./scripts/deploy-vps.sh

# Equivalente explícito
./scripts/deploy-vps.sh --all

# Só frontend (útil no dia a dia)
./scripts/deploy-vps.sh --frontend-only

# Só backend (Maven, JAR, restart, health)
./scripts/deploy-vps.sh --backend-only

# Sem atualizar o repositório na VPS (debug)
./scripts/deploy-vps.sh --frontend-only --no-pull

# Mostrar passos sem executar SSH
./scripts/deploy-vps.sh --all --dry-run

./scripts/deploy-vps.sh --help
```

### Variáveis de ambiente opcionais

```bash
VPS_HOST=161.97.175.73 VPS_USER=root ./scripts/deploy-vps.sh --frontend-only
```

## O que o script faz

1. **Local:** mostra `git log -1 --oneline` da branch `main` (ou `origin/main` se não existir `main` local).
2. **Só modo `--all`:** pergunta **Continuar? [y/N]** antes de SSH.
3. **Na VPS (via SSH):**
   - Salvo `--no-pull`: `sudo -u vilareal` em `git fetch`, `checkout main`, `reset --hard origin/main`, `git log -1 --oneline`.
   - **Backend** (`--all` ou `--backend-only`): `./mvnw clean package -DskipTests` em `e-vilareal-java-backend`, copia o JAR para `/opt/vilareal/api/api.jar`, `chown`, `systemctl restart vilareal-backend`, espera 30s e valida `/actuator/health` em `127.0.0.1:8080` (com re tentativas).
   - **Frontend** (`--all` ou `--frontend-only`): `npm ci` e `npm run build` em `e-vilareal-react-web`, copia `dist/` para `/opt/vilareal/web/`, `chown`, `systemctl reload nginx`, `curl -I` ao portal público.
4. **Local:** imprime duração total em segundos.

Saída na VPS usa cores (passo / ok / erro). Qualquer comando falha com `set -e` e interrompe o deploy.

## Notas

- O primeiro deploy ou alterações em `package-lock.json` exigem rede na VPS para `npm ci`.
- Se o health check falhar, rever logs: `journalctl -u vilareal-backend -n 100 --no-pager` na VPS.
