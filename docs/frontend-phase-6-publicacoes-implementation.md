# Frontend Fase 6 - Implementação da integração API (Publicações)

## A) Telas e componentes afetados

- **adaptado**: `e-vilareal-react-web/src/components/PublicacoesProcessos.jsx`
  - leitura/listagem API-first;
  - filtros de API;
  - ações operacionais de status;
  - vínculo com processo via endpoint.
- **adaptado**: `e-vilareal-react-web/src/repositories/publicacoesRepository.js` (novo).
- **adaptado**: `e-vilareal-react-web/src/config/featureFlags.js` (`useApiPublicacoes`).
- **encontrado no frontend** (não alterado nesta etapa): `ModalRelatorioPublicacoesProcesso.jsx` e `publicacoesPorProcesso.js` ainda leem apenas armazenamento local.

## B) Endpoints usados

- **implementado no frontend**:
  - `GET /api/publicacoes` (listagem + filtros)
  - `POST /api/publicacoes` (persistência das confirmações de importação)
  - `PATCH /api/publicacoes/{id}/status` (status operacional)
  - `PATCH /api/publicacoes/{id}/vinculo-processo` (vínculo processo)
- **encontrado no backend e pendente no frontend nesta etapa**:
  - `GET /api/publicacoes/{id}`
  - `PUT /api/publicacoes/{id}`
  - `DELETE /api/publicacoes/{id}`

## C) Repositories/adapters criados

- **adaptado**: `src/repositories/publicacoesRepository.js`
  - `listarPublicacoesModulo(...)`
  - `importarPublicacoesDaPrevia(...)`
  - `alterarStatusPublicacao(...)`
  - `vincularPublicacaoProcessoPorChaveNatural(...)`
  - `mapApiPublicacaoToUi(...)`
- **adaptado**: centralização da decisão API x legado no repository (sem `fetch` espalhado na tela).

## D) Filtros ligados à API

- **adaptado** no `GET /api/publicacoes`:
  - período (`dataInicio`, `dataFim`)
  - status de tratamento
  - processo (`processoId`)
  - cliente (`clienteId`)
  - texto (`texto`)
  - origem (`origemImportacao`)
- **adaptado**: filtro de vínculo “não vinculados” mantém pós-filtro no frontend para compatibilidade visual da tela.

## E) Ações de status e vínculo conectadas

- **adaptado**:
  - ação de status operacional (botões “Tratar” e “Ignorar”) conectada em `PATCH /status`.
  - vínculo manual e reaplicação automática conectados em `PATCH /vinculo-processo`, resolvendo `processoId` por `codCliente + procInterno` via repository de processos.
- **mitigado**:
  - quando processo não é resolvido, a tela mostra erro amigável (sem quebrar fluxo).

## F) Legado/localStorage remanescente

- **encontrado no frontend**:
  - `vilareal.processos.publicacoes.v2` (`publicacoesStorage.js`) permanece como fallback quando a flag está desligada.
  - `vilareal.processos.publicacoes.v1` (migração para v2 já existente).
  - cache de DataJud em `vilareal.datajud.cache.*`.
- **adaptado**:
  - com flag ligada, a tela principal deixa de depender primariamente do storage local para listagem/ações.

## G) Gaps remanescentes

- **pendente**: `ModalRelatorioPublicacoesProcesso.jsx` ainda sem leitura API-first.
- **pendente**: adaptação de possíveis pontos em `Processos.jsx`/relatórios para consumir API de publicações.
- **pendente**: conectar `PUT`/`DELETE` (a UI atual não usa edição completa/exclusão operacional explícita).
- **pendente**: migração assistida formal de `publicacoes.v2` legado para API (lote dedicado com dedup auditável).

## H) Pronto para homologação com flag ligada

- **adaptado e pronto**:
  - módulo `PublicacoesProcessos.jsx` em leitura API-first;
  - filtros principais conectados ao backend;
  - confirmação de importação persistindo publicações na API;
  - ações operacionais de status e vínculo ativas na API;
  - fallback legado preservado por `VITE_USE_API_PUBLICACOES=false`.
