# Matriz de flags — homologação (Subfase 1)

Documento operacional para **homologação controlada** da consolidação. Referência cruzada: `operational-consolidation-plan.md`.

**Rigor:** **(encontrado)** = lido no repositório; **(inferido)** = dedução; **(recomendado)** = proposta para esta rodada.

---

## 0) Como aplicar esta matriz (Subfase 2 — **adaptado**)

| Ação | Detalhe |
|------|---------|
| Arquivo de ambiente | **`e-vilareal-react-web/.env.homolog`** — flags da homologação inicial versionadas no repositório. |
| Comando | **`npm run dev:homolog`** — executa Vite com `--mode homolog` (carrega `.env.homolog`). |
| Guia curto | **`docs/homologation-quick-start.md`** |
| Indicador na UI | Barra inferior âmbar quando `import.meta.env.MODE === 'homolog'` **(encontrado)** `App.jsx`. |

O bloco copiável da **§4** permanece válido; na prática o template em **`.env.homolog`** substitui a cópia manual.

---

## 1) Inventário confiável de variáveis Vite

### 1.1 Centralizadas em `featureFlags.js` **(encontrado)**

| Variável de ambiente | Propriedade JS | Comportamento quando `true` |
|---------------------|----------------|-----------------------------|
| `VITE_USE_API_USUARIOS` | `useApiUsuarios` | CRUD/listagem de usuários via API (`usuariosRepository.js`). |
| `VITE_USE_API_CLIENTES` | `useApiClientes` | Clientes via API (`clientesRepository.js`, `CadastroClientes.jsx`). |
| `VITE_USE_API_AGENDA` | `useApiAgenda` | Agenda via API (`agendaRepository.js`, `Agenda.jsx`). |
| `VITE_USE_API_PESSOAS_COMPLEMENTARES` | `useApiPessoasComplementares` | Dados complementares de pessoa via API. |
| `VITE_USE_API_PERFIS_PERMISSOES` | `useApiPerfisPermissoes` | Perfis/permissões via API (`perfisPermissoesRepository.js`). |
| `VITE_USE_API_PROCESSOS` | `useApiProcessos` | Processos/partes/andamentos/prazos via API (`processosRepository.js`, `Processos.jsx`). |
| `VITE_USE_API_FINANCEIRO` | `useApiFinanceiro` | Lançamentos e resumo via API (`financeiroRepository.js`, `Financeiro.jsx`). |
| `VITE_USE_API_PUBLICACOES` | `useApiPublicacoes` | Publicações via API (`publicacoesRepository.js`, `PublicacoesProcessos.jsx`). |
| `VITE_USE_API_IMOVEIS` | `useApiImoveis` | Imóveis/contratos/repasses/despesas via API (`imoveisRepository.js`, telas Imóveis). |
| `VITE_USE_API_TAREFAS` | `useApiTarefas` | Tarefas operacionais via API (`tarefasOperacionaisRepository.js`, `Board.jsx` em pendências). |
| `VITE_ENABLE_IMOVEIS_MOCK_MIGRATION_PHASE7` | `enableImoveisMockMigrationPhase7` | UI de migração assistida mock imóveis → API. |
| `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE5_FINANCEIRO` | `enableLocalStorageImportPhase5Financeiro` | Import assistido legado → financeiro API. |
| `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE6_PUBLICACOES` | `enableLocalStorageImportPhase6Publicacoes` | Import assistido legado → publicações API. |

**Nota (encontrado):** variáveis **não** listadas em `featureFlags.js` mas usadas diretamente no código:

| Variável | Uso |
|----------|-----|
| `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE23` | `localStorageMigrationPhase23.js` — migração geral fase 23. |
| `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE4_PROCESSOS` | `localStorageMigrationPhase4Processos.js` — migração processos. |
| `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE5_FINANCEIRO_BOOTSTRAP` | `App.jsx` — bootstrap condicional. |
| `VITE_USE_MOCK_CADASTRO_PESSOAS` | `CadastroPessoas.jsx`, `RelatorioPessoas.jsx`, `MonitoringPeoplePage.jsx` — lista mock PDF vs API real. |
| `VITE_API_URL` | `api/config.js` — base URL; vazio = relativo (proxy Vite em dev). |
| `VITE_DATAJUD_BASE`, `VITE_DATAJUD_API_KEY` | `datajudApiClient.js` — monitoramento/DataJud (fora do núcleo homologação 1). |

### 1.2 Defaults em `.env.development` **(encontrado)**

Arquivo: `e-vilareal-react-web/.env.development`

- `VITE_USE_MOCK_CADASTRO_PESSOAS=true`
- **`VITE_USE_API_TAREFAS=false`** — explícito **(adaptado)**; homologação F1–F5 deve usar **`npm run dev:homolog`**, não este arquivo sozinho
- Demais `VITE_USE_API_*` no arquivo = **`false`**
- Todas as `VITE_ENABLE_LOCALSTORAGE_IMPORT_*` no arquivo = **`false`**

**Ausências / notas (encontrado):**

- `VITE_ENABLE_IMOVEIS_MOCK_MIGRATION_PHASE7` não está em `.env.development` → **desligado** por omissão
- `VITE_API_URL` → ausente; em dev o Vite faz **proxy** `/api` → `http://localhost:8080` **(encontrado)** `vite.config.js`

---

## 2) Escopo da homologação — Rodada 1 **(recomendado)**

### 2.1 Incluído (núcleo jurídico-operacional)

| Área | Motivo |
|------|--------|
| **Clientes** | Base para processos, financeiro, publicações, tarefas, imóveis. |
| **Processos** | Eixo central; vínculo com demais módulos. |
| **Financeiro** | Conta corrente processual / lançamentos. |
| **Publicações** | Tratamento e vínculo a processo. |
| **Tarefas** | Board de pendências + criação contextual. |
| **Imóveis** | Contratos, repasses, despesas (API). |

**Flags mínimas para este núcleo:** todas as `VITE_USE_API_*` acima = **`true`** na build de homologação.

### 2.2 Fora do escopo inicial **(recomendado)** — reduzir risco de híbrido

| Área | Motivo |
|------|--------|
| **Usuários** (API) | Fluxos E2E da rodada 1 não exigem governança multiusuário completa; `ModalCriarTarefaContextual` ainda usa `getUsuariosAtivos` legado para opções de responsável **(encontrado)** — homologar tarefa com responsável opcional ou primeiro usuário da lista local. |
| **Agenda** | Não bloqueia os cinco fluxos prioritários. |
| **Perfis e permissões** | Idem. |
| **Pessoas complementares** | Opcional; não é pré-requisito dos fluxos listados. |

### 2.3 Cadastro de pessoas **(recomendado)**

- **Rodada 1 sem pessoas na API:** manter `VITE_USE_MOCK_CADASTRO_PESSOAS=true` e **não** usar telas que exijam persistência real de pessoa para os fluxos acima — desde que **clientes** e demais dados já existam no banco (criados por API/seeds).
- **Rodada 1 com pessoas reais:** `VITE_USE_MOCK_CADASTRO_PESSOAS=false` e backend de cadastro de pessoas disponível; aí incluir criação de pessoa nos pré-requisitos de dados.

**Decisão explícita:** para esta subfase, assumir **mock de pessoas OK** salvo o time decidir homologar cadastro real — documentar na checklist de ambiente.

### 2.4 Migrações assistidas **(recomendado)**

Todas as `VITE_ENABLE_*` de import/migração = **`false`** durante testes E2E normais — evita misturar carga legado com validação de fluxo limpo.

---

## 3) Matriz por ambiente

Legenda: **L** = ligado (`true`), **D** = desligado (`false`), **—** = indiferente ou não usar.

### 3.1 Desenvolvimento local

| Variável | Valor recomendado | Efeito principal | Risco se errada | Observações |
|----------|-------------------|------------------|-----------------|-------------|
| `VITE_API_URL` | vazio ou `http://localhost:8080` | Chamadas à API | CORS/404 se URL errada | Com vazio + `npm run dev`, proxy `/api` → 8080 **(encontrado)** |
| `VITE_USE_API_*` (núcleo) | **L** ao testar integração | API real | Testa legado sem querer | Alinhar com `.env.local` pessoal **(recomendado)** |
| `VITE_USE_API_TAREFAS` | **L** se testar pendências API | Tarefas na API | Fica só legado **(encontrado)** ausente no `.env.development` |
| `VITE_USE_MOCK_CADASTRO_PESSOAS` | conforme necessidade | Mock vs API pessoas | Gravação bloqueada no mock **(encontrado)** | |
| `VITE_ENABLE_*` migração | **D** | Sem import acidental | Dados sujos | |

### 3.2 Homologação **(recomendado)**

| Variável | Valor | Efeito | Risco se errada |
|----------|-------|--------|-----------------|
| `VITE_API_URL` | URL do backend de homolog **ou** proxy equivalente | Frontend fala com API certa | Dados no ambiente errado |
| `VITE_USE_API_CLIENTES` | **true** | Clientes API | Fluxos quebram |
| `VITE_USE_API_PROCESSOS` | **true** | Processos API | Idem |
| `VITE_USE_API_FINANCEIRO` | **true** | Financeiro API | Idem |
| `VITE_USE_API_PUBLICACOES` | **true** | Publicações API | Idem |
| `VITE_USE_API_TAREFAS` | **true** | Tarefas API | Board em legado; modal de tarefa exige flag **(encontrado)** |
| `VITE_USE_API_IMOVEIS` | **true** | Imóveis API | Idem |
| `VITE_USE_API_USUARIOS` | **false** | Escopo 1 | Menos superfície híbrida **(recomendado)** |
| `VITE_USE_API_AGENDA` | **false** | Escopo 1 | — |
| `VITE_USE_API_PERFIS_PERMISSOES` | **false** | Escopo 1 | — |
| `VITE_USE_API_PESSOAS_COMPLEMENTARES` | **false** | Escopo 1 | — |
| `VITE_USE_MOCK_CADASTRO_PESSOAS` | **true** ou **false** | Ver §2.3 | Se `false`, precisa API pessoas |
| Todas `VITE_ENABLE_*` | **false** | Sem migração assistida | Import inesperado |

### 3.3 Produção (futura) **(recomendado)**

- Mesmo núcleo da homologação quando estável: `VITE_USE_API_*` do núcleo = **true**.
- Migrações: **false** após migração de dados concluída.
- `VITE_API_URL` = URL pública do backend (ou mesmo host com path).
- Revisitar usuários/agenda/RBAC antes de go-live multiusuário **(inferido)**.

---

## 4) Bloco copiável — ambiente homologação (exemplo)

Não versionar segredos; usar template no CI ou arquivo `.env.homologation` local ignorado pelo git.

```env
# API
VITE_API_URL=

# Núcleo rodada 1 — todas true
VITE_USE_API_CLIENTES=true
VITE_USE_API_PROCESSOS=true
VITE_USE_API_FINANCEIRO=true
VITE_USE_API_PUBLICACOES=true
VITE_USE_API_TAREFAS=true
VITE_USE_API_IMOVEIS=true

# Fora do escopo inicial
VITE_USE_API_USUARIOS=false
VITE_USE_API_AGENDA=false
VITE_USE_API_PERFIS_PERMISSOES=false
VITE_USE_API_PESSOAS_COMPLEMENTARES=false

# Pessoas: ajustar conforme §2.3
VITE_USE_MOCK_CADASTRO_PESSOAS=true

# Migrações — desligadas na homologação normal
VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE23=false
VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE4_PROCESSOS=false
VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE5_FINANCEIRO=false
VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE5_FINANCEIRO_BOOTSTRAP=false
VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE6_PUBLICACOES=false
VITE_ENABLE_IMOVEIS_MOCK_MIGRATION_PHASE7=false
```

**(recomendado)** Ajustar `VITE_API_URL` se o frontend não for servido atrás do mesmo proxy que `/api`.

---

## 5) Referência rápida — o que cada flag “quebra” se estiver errada

| Se… | Então… **(inferido)** |
|-----|------------------------|
| `…_PROCESSOS` false e resto true | Processo continua legado; IDs não batem com financeiro/publicações/tarefas API. |
| `…_CLIENTES` false | Cliente legado; vínculos API inconsistentes. |
| `…_TAREFAS` false | Pendências em `localStorage`; modal contextual pode bloquear criação na API **(encontrado)**. |
| `…_PUBLICACOES` false | Publicações só no storage local do browser. |
| `…_FINANCEIRO` false | Lançamentos locais; resumo em processo não reflete API. |
| `…_IMOVEIS` false | Mock/legado imóveis. |
| Qualquer `VITE_ENABLE_*` import true durante E2E | Risco de duplicar ou misturar dados legado com API. |

---

*Documento: Subfase 1 — matriz de flags. Atualizar se novas variáveis forem adicionadas a `featureFlags.js`.*
