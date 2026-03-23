# Frontend Fase 5 - Integracao controlada do modulo Financeiro

## Escopo executado

- **encontrado no frontend**: `Financeiro.jsx` concentra leitura/edicao de lancamentos com base em `financeiroData.js` e `localStorage`.
- **adaptado**: camada API-first (`financeiroRepository.js`) com fallback preservado por `featureFlags.useApiFinanceiro`.
- **adaptado**: tela `Financeiro.jsx` passa a carregar dados da API quando a flag estiver ativa e sincroniza edicoes de lancamento.
- **adaptado**: `Processos.jsx` usa resumo real de conta corrente por `processoId` quando API financeiro esta ativa.
- **pendente**: migracao total de relatorios derivados e fluxo OFX server-side.

## A) Telas e componentes afetados

- `src/components/Financeiro.jsx`
- `src/components/Processos.jsx` (modal de conta corrente)
- `src/components/ModalVinculoClienteProcFinanceiro.jsx` (mantido, com resolucao de ids feita no caller)
- `src/components/RelatorioFinanceiroImoveis.jsx` (mapeado; sem reescrita estrutural nesta etapa)

## B) Endpoints usados

- `GET /api/financeiro/contas`
- `GET /api/financeiro/lancamentos`
- `POST /api/financeiro/lancamentos`
- `PUT /api/financeiro/lancamentos/{id}`
- `DELETE /api/financeiro/lancamentos/{id}` (suporte no repository)
- `GET /api/financeiro/lancamentos/resumo-processo/{processoId}`

## C) Repositories/adapters criados

- **novo** `src/repositories/financeiroRepository.js`
  - `carregarExtratosFinanceiroApiFirst`
  - `listarContasFinanceiro`
  - `listarLancamentosFinanceiro`
  - `salvarOuAtualizarLancamentoFinanceiroApi`
  - `removerLancamentoFinanceiroApi`
  - `carregarResumoContaCorrenteProcesso`
  - `persistirFallbackExtratos`
- Adapters no repository:
  - API -> UI (shape de lancamento usado na grade financeira)
  - UI -> API (DTO do backend com conta, natureza, ref, eq, vinculos)

## D) Estrategia aplicada de transicao

- **feature flag**:
  - `VITE_USE_API_FINANCEIRO`
  - `featureFlags.useApiFinanceiro`
- **com flag ligada**:
  - `Financeiro.jsx` carrega extratos a partir da API (com mapeamento para o modelo atual da tela).
  - Edicoes de lancamento (alteracao de letra/campos e vinculo cliente/processo) sincronizam com API.
  - `Processos.jsx` consulta resumo de conta corrente por `processoId`.
- **com flag desligada**:
  - comportamento legado permanece via `financeiroData.js` + `localStorage`.

## E) Contratos e compatibilidade

- **adaptado**:
  - transacao de UI ganhou metadados internos (`_financeiroMeta`) para transportar `clienteId/processoId/contaContabilId`.
  - resolucao de cliente/processo no vinculo financeiro usa repositories ja existentes (`buscarClientePorCodigo`, `buscarProcessoPorChaveNatural`) antes de sincronizar.
- **pendente**:
  - substituir completamente os campos visuais `codCliente/proc` por ids nativos no componente financeiro.

## F) UX minima nesta etapa

- loading e erro de carregamento API no topo da tela financeira;
- mensagem de erro para falha de sincronizacao de lancamento;
- atualizacao local imediata permanece (otimistica) com sync API em segundo plano;
- fallback automatico mantido quando flag desligada.

## G) Gaps remanescentes

- importacao OFX completa no backend (fora do escopo atual);
- reconciliacao/pareamento automatico total no backend;
- migracao API-first completa do `RelatorioFinanceiroImoveis`;
- estrategia formal de migracao em lote de extratos legados para API.

## H) Pronto para homologacao com flag ligada

- leitura API-first de contas/lancamentos no modulo Financeiro;
- sincronizacao de edicao principal de lancamentos com API;
- resumo de conta corrente processual por `processoId` em `Processos.jsx`;
- fallback legado preservado e reversivel por flag.
