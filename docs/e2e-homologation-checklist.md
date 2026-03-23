# Roteiro E2E e checklist de homologação — Rodada 1

Uso: operador segue **na ordem** dos pré-requisitos, depois dos fluxos **F1→F5**. Documentos irmãos: `homologation-flags-matrix.md`, **`homologation-quick-start.md`** (comando `npm run dev:homolog`), **`e2e-homologation-execution-log.md`** (critérios de aprovação + registro de sessão), **`post-homologation-triage-template.md`** (triagem após testes).

**Rigor:** **(encontrado)** = código/projeto; **(inferido)**; **(recomendado)**.

---

## A) Escopo explícito

| Incluído na rodada 1 | Excluído (não testar como critério de sucesso) |
|----------------------|-----------------------------------------------|
| Clientes, processos, financeiro, publicações, tarefas, imóveis (API) | Usuários API, agenda API, perfis/permissões API como requisito |
| Fluxos F1–F5 abaixo | Migrações assistidas (`VITE_ENABLE_*` = false) |
| Cadastro de pessoas apenas se equipe definiu `VITE_USE_MOCK_CADASTRO_PESSOAS=false` + API pessoas | Monitoramento DataJud (opcional, outro checklist) |

---

## B) Checklist de pré-requisitos de ambiente

Marque antes de iniciar qualquer fluxo.

### B.1 Infraestrutura

| # | Item | OK? | Notas **(encontrado)** |
|---|------|-----|-------------------------|
| 1 | Backend Java sobe sem erro (ex.: porta **8080**) | ☐ | Proxy Vite em dev: `/api` → `localhost:8080` (`vite.config.js`) |
| 2 | Migrations Flyway aplicadas no banco usado pelo backend | ☐ | Validar com time backend |
| 3 | Frontend com **`npm run dev:homolog`** (pasta `e-vilareal-react-web`) carregando **`.env.homolog`** | ☐ | **`npm run dev`** usa `.env.development` (APIs núcleo **false**) — **insuficiente** para E2E API **(adaptado)** |
| 4 | `VITE_API_URL` definido **ou** vazio com proxy apontando para o backend correto | ☐ | `api/config.js`: vazio = base relativa |
| 5 | Barra inferior **âmbar** “Modo homologação” visível | ☐ | Confirma `--mode homolog` **(encontrado)** `App.jsx` |
| 6 | Núcleo de flags conforme `.env.homolog` / `homologation-flags-matrix.md` §3.2 | ☐ | **`VITE_USE_API_TAREFAS=true`** está no **`.env.homolog`** **(adaptado)** |

### B.2 Flags que devem ficar **desligadas** durante homologação normal

| Flag | Valor |
|------|-------|
| `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE23` | false |
| `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE4_PROCESSOS` | false |
| `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE5_FINANCEIRO` | false |
| `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE5_FINANCEIRO_BOOTSTRAP` | false |
| `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE6_PUBLICACOES` | false |
| `VITE_ENABLE_IMOVEIS_MOCK_MIGRATION_PHASE7` | false |

### B.3 Dados mínimos no backend **(recomendado)**

| Dado | Motivo |
|------|--------|
| Pelo menos **1 cliente** com `codigoCliente` conhecido (ou criar no fluxo F1) | Processos e vínculos usam cliente |
| **Rodada 1:** criar tarefa **sem responsável** ou conferir ID no banco se escolher um da lista local **(mitigado)** | Modal exibe aviso quando API de usuários está desligada **(encontrado)** |

### B.4 O que **não** exercitar nesta rodada

- Telas de importação/migração assistida.
- Configuração de permissões por perfil (se flags false).
- Agenda como fonte de verdade.

---

## C) Blockers imediatos (curto prazo)

Status após **Subfase 2** (**adaptado**):

| ID | Blocker | Status |
|----|---------|--------|
| B1 | `VITE_USE_API_TAREFAS` implícito / ausente no fluxo de homologação | **Mitigado** — `.env.homolog` com `true` + `npm run dev:homolog`; `.env.development` com `VITE_USE_API_TAREFAS=false` explícito |
| B2 | Operador usar `npm run dev` sem flags de homologação | **Mitigado** — comando dedicado + barra âmbar + `homologation-quick-start.md` |
| B3 | Responsável em tarefa com lista legado | **Mitigado** — aviso no modal quando `useApiTarefas && !useApiUsuarios` **(encontrado)** `ModalCriarTarefaContextual.jsx` |
| B4 | `GET /api/clientes` completo | **Pendente** (performance) — não bloqueia execução; registrar como ressalva na homologação se observável **(recomendado)** |

Itens **não** tratados aqui: paginação, otimização de listas, auth servidor.

---

## D) Ordem dos fluxos E2E

**Ordem recomendada:** **F1 → F2 → F3 → F4 → F5** (dependências de dados: cliente e processo antes de financeiro/publicações/tarefas; imóveis costuma ser independente se houver cliente).

**Flags necessárias (todas):**  
`VITE_USE_API_CLIENTES`, `VITE_USE_API_PROCESSOS`, `VITE_USE_API_FINANCEIRO`, `VITE_USE_API_PUBLICACOES`, `VITE_USE_API_TAREFAS`, `VITE_USE_API_IMOVEIS` = **true** (ver matriz).

---

### F1 — Cliente → processo

| Campo | Conteúdo |
|-------|----------|
| **Objetivo** | Cliente persistido na API e processo criado/atualizado vinculado a esse cliente. |
| **Telas** **(inferido)** | Cadastro de Clientes / lista; tela Processos (navegação conforme `App.jsx` rotas do projeto). |
| **Pré-requisitos** | Flags clientes + processos; backend up. |
| **Passos** | 1) Criar ou selecionar **cliente** com código conhecido (API). 2) Abrir fluxo de **novo processo** vinculando esse cliente. 3) Preencher campos mínimos (número interno, etc.) e **salvar**. 4) Reabrir o processo pela lista ou busca. |
| **Resultado esperado** | Processo com `clienteId` / vínculo consistente; após reload, dados vindos da API. |
| **Evidência** | ID de processo na URL ou estado; registro visível na listagem; sem erro de API no console de rede. |
| **Falhas conhecidas** | Flag processos off → legado/localStorage **(encontrado)**. Chave natural vs ID — anotar número interno usado. |

---

### F2 — Processo → financeiro

| Campo | Conteúdo |
|-------|----------|
| **Objetivo** | Lançamento vinculado ao processo e resumo/conta corrente coerente na UI. |
| **Pré-requisitos** | F1 ok; `VITE_USE_API_FINANCEIRO=true`; processo com **ID numérico API** (`processoApiId` na UI **(inferido)**). |
| **Passos** | 1) Na tela do processo (`Processos.jsx`), localizar área **financeiro / conta corrente** (quando flag financeiro ligada). 2) Incluir **lançamento** (valor, tipo, datas conforme UI). 3) Conferir **resumo** ou lista de lançamentos do processo. 4) Opcional: abrir tela **Financeiro** global e filtrar por processo/cliente se disponível. |
| **Resultado esperado** | Lançamento persistido; totais coerentes; após reload, dados da API. |
| **Evidência** | Lançamento listado; resumo sem erro (`apiFinanceiroErro` vazio **(inferido)**). |
| **Falhas conhecidas** | `useApiFinanceiro` false → caminho local **(encontrado)** `Financeiro.jsx`. |

---

### F3 — Processo → publicações

| Campo | Conteúdo |
|-------|----------|
| **Objetivo** | Publicação associada ao processo (criação ou vínculo) tratada via API. |
| **Pré-requisitos** | Processo com ID API; `VITE_USE_API_PUBLICACOES=true`. |
| **Passos** | 1) A partir do processo ou da tela **Publicações** (`PublicacoesProcessos.jsx`), criar/registrar publicação ou vincular ao processo. 2) Alterar **status de tratamento** se aplicável. 3) Recarregar e verificar persistência. |
| **Resultado esperado** | Publicação com `processoId` correto na API; lista consistente. |
| **Evidência** | Registro na UI; resposta 200 nas chamadas PATCH/POST relevantes. |
| **Falhas conhecidas** | Flag off → só `localStorage` **(encontrado)** comentários em `ModalRelatorioPublicacoesProcesso`. Import exige flags extras — **não** usar na rodada 1. |

---

### F4 — Processo ou publicação → tarefa

| Campo | Conteúdo |
|-------|----------|
| **Objetivo** | Tarefa operacional criada na API com vínculos a processo (e opcionalmente publicação). |
| **Pré-requisitos** | `VITE_USE_API_TAREFAS=true`, `VITE_USE_API_PROCESSOS=true` (e publicações se fluxo pela publicação); processo/publicação com IDs API. |
| **Passos** | 1) Na tela de **Processos** ou **Publicações**, acionar **criar tarefa** (modal contextual). 2) Preencher título; responsável opcional. 3) Salvar. 4) Abrir **Pendências** / `Board` rota pendências; acionar **atualizar** se houver; verificar card/tarefa. |
| **Resultado esperado** | Tarefa aparece na listagem API (board com `useApiTarefas` **(encontrado)** `Board.jsx`). |
| **Evidência** | Tarefa listada em `GET /api/tarefas` (rede); ou colunas do board preenchidas. |
| **Falhas conhecidas** | Sem `VITE_USE_API_TAREFAS` → mensagem **"Ative VITE_USE_API_TAREFAS"** **(encontrado)** `ModalCriarTarefaContextual.jsx`. Evento `vilareal:tarefas-criada` para refresh **(encontrado)** `Board.jsx`. |

---

### F5 — Imóvel → contrato → repasse / despesa

| Campo | Conteúdo |
|-------|----------|
| **Objetivo** | Imóvel com contrato vigente; repasse e despesa coerentes com API. |
| **Pré-requisitos** | `VITE_USE_API_IMOVEIS=true`; cliente existente (mesmo do F1 ou outro). |
| **Passos** | 1) Em **Imóveis** / administração financeira (`Imoveis.jsx`, `ImoveisAdministracaoFinanceiro.jsx`), criar ou abrir **imóvel** para o cliente. 2) Garantir **contrato vigente** na UI. 3) Registrar **repasse** (criar/editar conforme tela). 4) Registrar **despesa** (POST ou PUT se edição). 5) Recarregar e conferir. |
| **Resultado esperado** | Dados persistidos via endpoints `/api/imoveis`, `/api/locacoes/...` **(inferido)**. |
| **Evidência** | Listas de repasses/despesas carregadas após reload; sem erro de API. |
| **Falhas conhecidas** | Flag off → ramos mock **(encontrado)** `ImoveisAdministracaoFinanceiro.jsx`. Migração mock fase 7 **desligada** na rodada 1. |

---

## E) Registro de execução e resultados

**Não preencher apenas a tabela abaixo** — usar o documento **`e2e-homologation-execution-log.md`**, que contém:

- critérios **Aprovado / Aprovado com ressalva / Falhou / Fora do escopo** por fluxo (**§2**);
- modelo de **sessão** com evidências e campo **issue sugerida** (**§3**).

Resumo opcional (após copiar do log):

| Fluxo | Resultado | Evidência (ref. no log) |
|-------|-----------|-------------------------|
| F1 | | |
| F2 | | |
| F3 | | |
| F4 | | |
| F5 | | |

Triagem de achados confirmados: **`post-homologation-triage-template.md`**.

---

## F) Critérios de aprovação — resumo

Definição completa por fluxo: **`e2e-homologation-execution-log.md` §2** **(recomendado)**.

| Fluxo | Aprovado (em uma frase) |
|-------|-------------------------|
| F1 | Cliente + processo persistem na API e releitura após reload está correta. |
| F2 | Lançamento vinculado ao processo e visível após reload. |
| F3 | Publicação vinculada ao processo; status persiste. |
| F4 | Tarefa criada na API e aparece no board de pendências após atualizar. |
| F5 | Repasse e despesa coerentes com API após reload. |

---

## G) Conclusão da execução assistida (Subfase 3)

- Checklist **B** completo para a sessão.
- Fluxos **F1–F5** registrados no **execution log** com resultado e evidências.
- Achados relevantes transferidos ao **template de triagem** (só o confirmado).

**Próximo passo:** corrigir apenas itens priorizados na triagem (sem ampliar escopo); performance/paginação conforme plano operacional, após decisão.

---

*Checklist alinhado a `operational-consolidation-plan.md` e ao código em `e-vilareal-react-web`.*
