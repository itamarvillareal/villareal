# Quick start — homologação F1–F5

Guia mínimo para o operador executar a **homologação inicial** sem misturar flags de desenvolvimento.

**Rigor:** **(encontrado)** = repositório atual; **(adaptado)** = fluxo operacional.

---

## 1) Qual comando e qual `.env`

| Situação | Comando | Arquivo de variáveis |
|----------|---------|----------------------|
| **Homologação F1–F5 (recomendado)** | `npm run dev:homolog` na pasta `e-vilareal-react-web` | **`.env.homolog`** **(encontrado)** — carregado pelo Vite com `--mode homolog` |
| Desenvolvimento local genérico | `npm run dev` | `.env.development` + `.env.local` (opcional) |

Sobrescritas opcionais: crie **`.env.homolog.local`** (ignorado pelo git via `*.local`) para `VITE_API_URL` ou ajustes pessoais sem alterar o template.

---

## 2) Flags que devem estar **ligadas** (homologação núcleo)

Com `npm run dev:homolog`, o template **`.env.homolog`** já define:

- `VITE_USE_API_CLIENTES=true`
- `VITE_USE_API_PROCESSOS=true`
- `VITE_USE_API_FINANCEIRO=true`
- `VITE_USE_API_PUBLICACOES=true`
- `VITE_USE_API_TAREFAS=true` **(adaptado)** — explícito no arquivo; elimina ambiguidade do `.env.development` antigo
- `VITE_USE_API_IMOVEIS=true`

---

## 3) Flags que devem estar **desligadas** (fora do escopo rodada 1)

No template **`.env.homolog`**:

- `VITE_USE_API_USUARIOS=false`
- `VITE_USE_API_AGENDA=false`
- `VITE_USE_API_PERFIS_PERMISSOES=false`
- `VITE_USE_API_PESSOAS_COMPLEMENTARES=false`

Todas as **`VITE_ENABLE_*`** de migração = **`false`**.

---

## 4) Backend e proxy

1. Subir o backend Java (porta **8080** no dev padrão).
2. Com **`VITE_API_URL` vazio** no `.env.homolog`, o Vite em dev encaminha **`/api`** → `http://localhost:8080` **(encontrado)** `vite.config.js`.
3. Se o frontend rodar em outro host/porta sem proxy, defina **`VITE_API_URL`** com a URL base do backend (sem barra final desnecessária; ver `src/api/config.js`).

---

## 5) Indicador visual

Com **`npm run dev:homolog`**, a barra inferior âmbar indica **modo homologação** e aponta para este documento **(adaptado)**.

---

## 6) O que **não** testar nesta rodada

- Migrações assistidas (import legado).
- Usuários/agenda/perfis como critério de sucesso.
- Escopo além de F1–F5 (ver `e2e-homologation-checklist.md`).

---

## 7) Ordem dos fluxos

1. **F1** — Cliente → processo  
2. **F2** — Processo → financeiro  
3. **F3** — Processo → publicações  
4. **F4** — Processo/publicação → tarefa  
5. **F5** — Imóvel → contrato → repasse/despesa  

Detalhes dos passos: **`e2e-homologation-checklist.md`**.

---

## 8) Tarefas sem API de usuários

Com **`VITE_USE_API_USUARIOS=false`**, o modal de nova tarefa mostra aviso: responsável opcional; lista local pode não coincidir com IDs do servidor — para F1–F5, prefira **(opcional)** **(mitigado na UI)**.

---

## 9) Referências

- Matriz completa: `homologation-flags-matrix.md`
- Checklist E2E: `e2e-homologation-checklist.md`
- Registro de execução + critérios de aprovação: `e2e-homologation-execution-log.md`
- Triagem pós-homologação: `post-homologation-triage-template.md`
- Plano geral: `operational-consolidation-plan.md`
