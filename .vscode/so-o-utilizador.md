# Só você precisa fazer (o Cursor não substitui)

**Dados reais:** o “oficial” é o **MySQL na VPS** (portal). Localmente, só abres o **túnel** e apontas o backend para aí — não um segundo banco de produção no Mac.

O resto pode ser feito **dentro do Cursor**: pedir ao agente, ou **Command Palette** → `Tasks: Run Task` → tarefas `Villareal: …`.

Para **importações** gravarem na VPS, define `VILAREAL_API_BASE` com o URL **HTTPS do portal** antes de correr os scripts `import-*.mjs`.

## 1. Conta, máquina e rede

- **Instalar** o que não vem no projeto: Docker Desktop, Node (se fores correr scripts fora do Docker), JDK 21 (se quiseres `./mvnw` local sem depender do CI/agente).
- **Rede/VPN/firewall** que impeçam SSH à VPS ou MySQL — o Cursor não muda regras da tua rede.
- **Confirmar fingerprint** do SSH na primeira ligação a um host novo (`known_hosts`).

## 2. Segredos e ficheiros locais (nunca versionados)

- **Criar/editar** `.env.docker` (password real do MySQL remoto, etc.) a partir de `.env.docker.example`.
- **Guardar** passwords só onde fizer sentido para ti (gestor de passwords); o agente não deve colar segredos em chats públicos.

## 3. Consentimento e decisões de risco

- **Aprovar** operações destrutivas em produção (apagar dados, `deploy`, SQL em massa) — isso é decisão tua.
- **Clicar** em browsers externos (login OAuth, bancos, gov.br) se algum fluxo exigir.

## 4. Limites técnicos do agente no Cursor

- **Aprovar permissões** quando o Cursor pedir rede ou acesso extra ao sandbox.
- Se o agente **não tiver** SSH keys ou sessão válida para a tua VPS, **tu** configuras a chave ou corres o primeiro `ssh` interativo.

## 5. O que *não* precisas de fazer à mão se usares as tarefas

- Abrir o Terminal para digitar `docker compose`, `dev-up.sh`, imports com `node`, ou o fix de mojibake — usa as tarefas `Villareal:` em **Run Task**.

---

*Atualize este ficheiro se aparecer um bloqueio novo que seja claramente “só humano”.*
