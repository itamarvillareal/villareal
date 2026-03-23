# Fase 7 — Frontend (Imóveis) API-first com fallback

Documento da integração controlada do módulo de imóveis/locações com a API real da Fase 7.

## Legenda de rigor

- **encontrado no frontend**: evidência direta em componentes/utilitários atuais.
- **inferido**: necessidade técnica para fechar o fluxo com endpoints existentes.
- **adaptado**: alteração implementada nesta etapa.
- **pendente**: fica para fase posterior.

---

## A) Telas e componentes afetados

- `e-vilareal-react-web/src/components/Imoveis.jsx`
- `e-vilareal-react-web/src/components/ImoveisAdministracaoFinanceiro.jsx`
- `e-vilareal-react-web/src/repositories/imoveisRepository.js` (novo)
- `e-vilareal-react-web/src/config/featureFlags.js` (`useApiImoveis`, já existente)

---

## B) Endpoints usados

### Imóveis / contratos

- `GET /api/imoveis/{id}` (carregar cadastro)
- `POST /api/imoveis` e `PUT /api/imoveis/{id}` (salvar cadastro)
- `GET /api/locacoes/contratos?imovelId=...` (ler contrato corrente)
- `POST /api/locacoes/contratos` e `PUT /api/locacoes/contratos/{id}` (salvar contrato mínimo)

### Operação administrativa

- `GET /api/locacoes/repasses?contratoId=...`
- `POST /api/locacoes/repasses`
- `GET /api/locacoes/despesas?contratoId=...`
- `POST /api/locacoes/despesas`

### Resolução de IDs (compatibilidade com Cod.+Proc.)

- `GET /api/clientes` para resolver `clienteId` por código do cliente.
- `GET /api/processos?codigoCliente=...` para resolver `processoId` por número interno.

---

## C) Repositories/adapters criados

Arquivo novo: `src/repositories/imoveisRepository.js`.

### Adaptado

- **API↔UI (imóvel):** `mapApiToUi()` e `montarPayloadImovelFromUi()`.
- **API↔UI (contrato):** `montarPayloadContratoFromUi()`.
- **Fallback mock:** `mapMockToUi()` + `carregarImovelCadastro()`.
- **Orquestração principal:** `salvarImovelCadastro()`.
- **Administração:** `carregarPainelAdministracaoImovel()`, `salvarRepasseLocacao()`, `salvarDespesaLocacao()`.
- **Helpers de resolução:** `resolverClienteIdPorCodigo()` e `resolverProcessoIdPorChave()`.

### Encontrado no frontend e preservado

- Leitura de conferência do financeiro via `montarPainelAdministracaoImovel` (não reimplementada).

---

## D) Partes já ligadas à API

### `Imoveis.jsx`

- **adaptado:** carregamento de cadastro por `imovelId` via repository.
- **adaptado:** salvar imóvel + contrato mínimo via API com botão `Salvar`.
- **adaptado:** feedback de loading/erro/sucesso.
- **adaptado:** quando cria novo imóvel na API, a tela sincroniza o `imovelId` retornado.

### `ImoveisAdministracaoFinanceiro.jsx`

- **adaptado:** carga de imóvel/painel/repasses/despesas via repository único.
- **adaptado:** formulários mínimos para criar repasse e despesa (quando flag ativa).
- **adaptado:** listagem básica de repasses/despesas da API.
- **preservado:** extrato/consolidação mensal continua vindo do financeiro (conferência).

---

## E) Partes ainda mantidas no legado/mock

- **encontrado no frontend:** `imoveisMockData.js` permanece fallback quando `useApiImoveis=false`.
- **adaptado:** em fallback, tela mantém experiência atual e não tenta persistência real.
- **pendente:** migração assistida de mocks de imóveis para API (não implementada nesta etapa).

---

## F) Dependências remanescentes de Cod.+Proc.

- **adaptado:** com API ativa, Cod.+Proc. são usados como entrada de compatibilidade para resolver `clienteId`/`processoId`.
- **pendente:** UI ainda exibe/edita Cod.+Proc. como referência operacional primária em vários trechos.
- **inferido:** redução total de chave natural depende de evoluir UI para ids nativos em campos e navegação.

---

## G) Gaps remanescentes

- `PUT` de repasses existente no backend ainda não exposto com ação explícita de edição na UI.
- despesas de locação com edição/remoção não implementadas.
- estratégia de contrato “ativo atual” ainda simples (pega primeiro da lista por `imovelId`).
- campos de contrato do modal (assinaturas/arquivamento) seguem no JSON de extras, sem estrutura dedicada.

---

## H) Pronto para homologação com a flag ligada

- Cadastro de imóvel com leitura/escrita API-first.
- Contrato mínimo vinculado ao imóvel com leitura/escrita.
- Operação mínima de repasses/despesas por contrato.
- Administração financeira mantida como conferência do módulo financeiro.
- Fallback legado preservado por `featureFlags.useApiImoveis`.
