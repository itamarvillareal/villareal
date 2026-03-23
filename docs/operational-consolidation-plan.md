# Plano de consolidação operacional e homologação controlada

Documento executável para a fase aprovada: **sem novo domínio de negócio**, **sem automação pesada**, **sem refatoração arquitetural ampla**. Foco em confiabilidade, homologação, redução de dualidade e preparação para uso real.

**Rigor:** trechos marcados como **(encontrado)**, **(inferido)** ou **(recomendado)**.

---

## A) Objetivo da fase

1. **Homologar** os fluxos críticos ponta a ponta com a API como fonte de verdade (por módulo), registrando falhas e priorizando correções pequenas.
2. **Reduzir dualidade** operacional: decisão explícita de flags por ambiente e testes com caminhos “API ligada” como padrão em homologação.
3. **Mapear e tratar** micro-gaps bloqueadores (endpoint, filtro, persistência, UX) antes de investir em paginação/performance em larga escala.
4. **Preparar** backlog de performance (listagens que crescem, ausência de `Pageable` na maioria dos controllers) sem implementar tudo de uma vez.

---

## B) Estado atual dos módulos

Classificação com base em **código** (`featureFlags.js`, repositórios, telas) e **docs** de fase; `database-gap-analysis.md` é **histórico útil**, mas partes descrevem o passado — validar sempre no código.

| Módulo / área | Classificação | Notas |
|---------------|---------------|--------|
| Cadastro de pessoas (API + mock) | **Híbrido / dual** | **(encontrado)** `VITE_USE_MOCK_CADASTRO_PESSOAS` — em `.env.development` está `true`; gravação real exige mock desligado + backend. |
| Clientes (`/api/clientes`) | **Funcional em estabilização** | **(encontrado)** `clientesRepository` + `CadastroClientes.jsx` com ramos API/legado. |
| Processos / partes / andamentos / prazos | **Funcional em estabilização** | **(encontrado)** `processosRepository.js`, `ProcessoController` com filtros em listagem; resolução por chave natural + `GET /api/clientes` completo em alguns fluxos. |
| Financeiro | **Funcional em estabilização** | **(encontrado)** `FinanceiroLancamentoController` lista com filtros; sem paginação no controller. |
| Publicações | **Funcional em estabilização** | **(encontrado)** `PublicacaoController` com vários filtros; lista completa. |
| Imóveis / contratos / repasses / despesas | **Funcional em estabilização** | **(encontrado)** `LocacaoDespesaController` com `GET`/`POST`/`PUT`; `imoveisRepository.salvarDespesaLocacao` usa PUT quando há `id`. Doc `frontend-phase-7-imoveis-stabilization.md` ainda cita despesas sem PUT — **doc desatualizado (encontrado vs. doc)**. |
| Tarefas operacionais | **Funcional em estabilização** | **(encontrado)** Board com filtros de API (`Board.jsx` + `listarTarefasOperacionais`); sem paginação no backend. |
| Usuários / perfis / permissões | **Híbrido / dual** | **(encontrado)** `Usuarios.jsx` + `usuariosRepository` — ramos API; agenda local ainda referenciada em fluxos quando legado. |
| Agenda | **Parcialmente integrado / híbrido** | **(encontrado)** `useApiAgenda` em `agendaRepository.js` e `Agenda.jsx`. |
| Pessoas complementares | **Parcialmente integrado** | **(encontrado)** flag dedicada; retorno `null` desliga caminho API. |
| Migrações assistidas (fases 4/5/6/7/23) | **Opcional / sob demanda** | **(encontrado)** flags `VITE_ENABLE_*` separadas; não são “uso diário”, são importação. |
| Auditoria de atividades | **Consolidado (API)** | **(encontrado)** `AuditoriaAtividadeController` usa `Pageable` (paginação nativa Spring) — exceção em relação à maioria dos módulos de negócio. |

**Resumo (recomendado):** Nenhum módulo grande está “fechado” para produção sem homologação cruzada; os mais próximos de **pronto para homologação** são os que já têm **repositório API-first + tela** e **dependências de flag alinhadas** (processos + clientes + financeiro + publicações + tarefas + imóveis), desde que o ambiente force `VITE_USE_API_*` coerentes.

---

## C) Fluxos E2E prioritários

Cada fluxo deve ser exercitado com **flags de API ligadas** para os módulos envolvidos (ver seção D).

| # | Fluxo | Objetivo | Módulos envolvidos | Pré-requisitos | Riscos | Maturidade atual |
|---|--------|----------|-------------------|----------------|--------|------------------|
| 1 | **Cliente → processo** | Garantir vínculo cliente/processo persistido e reabertura consistente | Clientes, processos, (pessoas se vinculado) | IDs de cliente na API; usuário responsável se usado | Chave natural vs. ID; lista de clientes sem paginação **(inferido)** | **Alta** com API |
| 2 | **Processo → publicações** | Tratamento e vínculo ao processo | Processos, publicações | `processoId` API | Mistura legado `publicacoesPorProcesso` se flag off **(encontrado)** | **Alta** com flags |
| 3 | **Publicação/processos → tarefa** | Criação contextual com refresh do board | Publicações ou processos, tarefas | `useApiTarefas` + `useApiProcessos`/`useApiPublicacoes` | Erro explícito se só tarefas off **(encontrado)** `ModalCriarTarefaContextual` | **Média–alta** |
| 4 | **Processo → financeiro (conta corrente)** | Lançamentos e resumo por processo | Processos, financeiro | `processoId` numérico | Dois mundos se financeiro off **(encontrado)** `Processos.jsx` | **Alta** com flags |
| 5 | **Imóvel → contrato → repasse/despesa** | Linha operacional locação | Imóveis, contratos, repasses, despesas | Contrato vigente na UI | Doc antigo sobre despesas — validar UI vs. API **(recomendado)** | **Média–alta** |
| 6 | **Usuário → pendências (tarefas)** | Colunas por responsável e filtros | Usuários, tarefas | IDs de usuário alinhados ao `responsavelId` | Modo legado `localStorage` se tarefas off **(encontrado)** | **Média** — depende de alinhamento usuário API |
| 7 | **Agenda (se escopo)** | Eventos persistidos vs. local | Agenda, (usuários) | Flag agenda | Recorrência e multiusuário **(inferido)** | **Média** — homologar só se prioridade de negócio |

**Ordem sugerida de roteiro manual (recomendado):** 1 → 4 → 2 → 3 → 5 → 6 → 7 (depende da prioridade do escritório).

---

## D) Matriz de flags por ambiente

Todas as variáveis abaixo são **(encontrado)** em `e-vilareal-react-web/src/config/featureFlags.js` e `.env.development` (onde aplicável).

### Inventário de flags

| Variável | Propósito |
|----------|-----------|
| `VITE_USE_MOCK_CADASTRO_PESSOAS` | Mock PDF vs. API em cadastro de pessoas |
| `VITE_USE_API_USUARIOS` | Usuários via API |
| `VITE_USE_API_CLIENTES` | Clientes via API |
| `VITE_USE_API_AGENDA` | Agenda via API |
| `VITE_USE_API_PESSOAS_COMPLEMENTARES` | Dados complementares pessoa |
| `VITE_USE_API_PERFIS_PERMISSOES` | Perfis/permissões via API |
| `VITE_USE_API_PROCESSOS` | Processos via API |
| `VITE_USE_API_FINANCEIRO` | Financeiro via API |
| `VITE_USE_API_PUBLICACOES` | Publicações via API |
| `VITE_USE_API_IMOVEIS` | Imóveis/contratos/repasses via API |
| `VITE_USE_API_TAREFAS` | Tarefas operacionais via API |
| `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE23` | Migração assistida fase 23 |
| `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE4_PROCESSOS` | Migração processos |
| `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE5_FINANCEIRO` | Import financeiro |
| `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE5_FINANCEIRO_BOOTSTRAP` | Bootstrap import financeiro |
| `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE6_PUBLICACOES` | Import publicações |
| `VITE_ENABLE_IMOVEIS_MOCK_MIGRATION_PHASE7` | Migração mock imóveis |

**Nota (encontrado):** `.env.development` **não define** `VITE_USE_API_TAREFAS`; ausência = `false` no build Vite.

### Recomendação por ambiente

| Flag / grupo | Desenvolvimento local | Homologação | Produção (futura) |
|--------------|----------------------|-------------|---------------------|
| **Mock cadastro pessoas** | `true` **opcional** (dev offline) | **`false`** se homologar pessoa real **(recomendado)** | `false` |
| **`VITE_USE_API_*` (todos os módulos de negócio)** | Mistura conforme máquina **(inferido)** | **`true`** para o núcleo homologado **(recomendado)** | `true` módulo a módulo após validação |
| **Migrações `VITE_ENABLE_*`** | `false` salvo teste de import | **`false`** no dia a dia; `true` só em janela de migração **(recomendado)** | `false` salvo operação pontual |
| **`VITE_USE_API_TAREFAS`** | Conforme necessidade | **`true`** se fluxos 3 e 6 forem escopo **(recomendado)** | `true` após estabilizar |
| **`VITE_USE_API_USUARIOS` + `PERFIS` + `AGENDA`** | Livre | **`true`** se testar multiusuário/permissões/agenda real **(recomendado)** | Gradual |

**Perfil mínimo homologação “núcleo jurídico-financeiro” (recomendado):**  
`CLIENTES`, `PROCESSOS`, `FINANCEIRO`, `PUBLICACOES`, `TAREFAS`, `IMOVEIS` = **ligadas**; migrações = **desligadas**; mock pessoas = **desligado** se a homologação incluir cadastro real.

**Perfil experimental (opcional):** manter um ambiente ou branch de build com o mesmo `.env` que produção futura para detectar regressões de flag.

---

## E) Backlog de micro-gaps (priorizado)

Critérios: **impacto** no dia a dia, **esforço** relativo, **risco** de retrabalho.

| ID | Descrição | Tipo | Impacto | Esforço | Risco | Evidência |
|----|-----------|------|---------|---------|-------|-----------|
| G1 | **Listagens REST sem paginação** — `GET` em processos, publicações, tarefas, lançamentos, imóveis retornam `List` completo | Arquitetura/performance | Alto em escala | Médio | Baixo se feito com contrato estável | **(encontrado)** controllers citados na análise |
| G2 | **`buscarClientePorCodigo` carrega `/api/clientes` inteiro** para achar um código | Performance | Médio–alto | Baixo–médio | Baixo | **(encontrado)** `processosRepository.js` |
| G3 | **Dualidade usuários/agenda** — comportamento misto API + storage local | Confiabilidade | Alto para multiusuário | Médio | Médio | **(encontrado)** `Usuarios.jsx`, `agendaRepository.js` |
| G4 | **Autenticação servidor / sessão** — contexto de “usuário logado” para filtros e auditoria | Segurança operacional | Altíssimo em produção real | Alto | Alto se mal especificado | **(inferido)** + gap analysis legado |
| G5 | **Documentação vs. código** — ex.: despesas locação | Manutenção | Baixo operacional | Baixo | Baixo | **(encontrado)** PUT em `LocacaoDespesaController` + repo; doc fase 7 desatualizado |
| G6 | **Migração legado → API** — dados só no browser | Continuidade | Alto para go-live | Variável | Médio | **(encontrado)** serviços `*MigrationPhase*` |

**Prioridade sugerida (recomendado):** tratar **G3/G4** como decisão de produto (escopo desta fase: *mapear* e *homologar*, não necessariamente implementar auth completa). **G1/G2** entram como backlog técnico pós-homologação ou subfase 3. **G5** correção documental imediata, sem código.

---

## F) Backlog de performance / listagens

| Área | Situação **(encontrado)** | Ação recomendada **(recomendado)** |
|------|---------------------------|-----------------------------------|
| Processos | `GET /api/processos` lista; filtros `clienteId`, `codigoCliente`, `ativo` | Homologar com filtros; planejar `Pageable` + sort ou limite máximo |
| Publicações | Filtros ricos (datas, status, processo, cliente, texto) | Idem; atenção a busca textual em volume |
| Tarefas | Filtros (responsável, status, prioridade, datas, cliente, processo) | Board já monta query — ainda assim resposta pode ser grande sem limite servidor |
| Financeiro | Filtros por cliente, processo, conta, período | Exigir período em homologação **(recomendado)** para evitar full scan |
| Imóveis | Lista por `clienteId` opcional | Monitorar tamanho por cliente |
| Clientes | `GET /api/clientes` sem query — lista completa | Candidato forte a paginação ou busca **(inferido)** |
| Auditoria | Já paginada | Referência de padrão para futuras extensões **(encontrado)** |

---

## G) Ordem ideal de execução (subfases)

### Consolidação 1 — Homologação e matriz de flags
- Fixar `.env` de homologação (arquivo não versionado ou template `env.homologation.example` **opcional**).
- Executar roteiro E2E da seção C com evidências (prints, checklist).
- Registrar desvios em issues rotuladas `consolidacao`.

### Consolidação 2 — Micro-gaps bloqueadores de uso diário
- Corrigir apenas itens que **impedem** concluir fluxo (ex.: erro 400, campo não persistido, filtro obrigatório ausente na UI).
- Atualizar documentação onde estiver objetivamente errada **(G5)**.

### Consolidação 3 — Performance e listagens
- Implementar paginação/limites onde G1/G2 forem confirmados por métrica ou teste de carga leve.
- Alinhar contrato backend/frontend (query params `page`, `size` ou padrão Spring `Pageable`).

**Dependência (recomendado):** a subfase 3 **não** deve começar antes de fechar a lista de bloqueadores da 2 **ou** antes de decidir explicitamente “aceitar risco temporário” com documentação.

---

## H) Critérios de saída da fase

**(recomendado)** — a fase está concluída quando:

1. Matriz de flags de **homologação** está documentada e aplicada em build de homologação.
2. Fluxos E2E prioritários (mínimo: **1, 2, 3, 4** da tabela C) foram executados com sucesso **com APIs ligadas**, com registro de evidência.
3. Lista de micro-gaps **bloqueadores** está vazia **ou** cada item remanescente tem decisão explícita (aceitar, adiar, não escopo).
4. Backlog de performance (seção F) está priorizado e estimado; não precisa estar implementado para “sair” da consolidação 1–2.
5. Nenhuma migração assistida foi deixada **ligada por engano** em ambiente que simula produção.

---

## I) O que só deve ser feito depois desta consolidação

- **Novo domínio** (ex.: documentos com storage, automação pesada entre sistemas).
- **Paginação em massa** sem critério vindo da homologação (evita otimizar caminho errado).
- **Remoção agressiva de fallback legado** sem janela de migração e flags estáveis.
- **Alteração retroativa de migrations Flyway** salvo correção de bug crítico acordada.

---

## Resumo de rigor

- **Encontrado:** arquivos e trechos de código inspecionados (`featureFlags.js`, `.env.development`, controllers, repositórios, componentes citados).
- **Inferido:** prioridade de negócio, escala de dados, necessidade de auth em produção.
- **Recomendado:** ordem das subfases, perfis de flag, critérios de saída, o que adiar.

---

*Documento gerado para execução da fase de consolidação operacional; revisar após primeira rodada de homologação.*
