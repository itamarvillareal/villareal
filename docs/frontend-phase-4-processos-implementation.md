# Frontend Fase 4 Processos - Implementacao

## A) Telas e componentes afetados
- `src/components/Processos.jsx`: integracao progressiva API para cabecalho, partes, andamentos e prazo fatal.
- `src/components/CadastroClientes.jsx`: grade de processos passa a sincronizar campos-chave do cabecalho quando `useApiProcessos=true`.
- `src/App.jsx`: execucao opcional de migracao assistida fase 4 no bootstrap.

## B) Endpoints usados
- `GET /api/processos?codigoCliente=...`
- `POST /api/processos`
- `PUT /api/processos/{id}`
- `PATCH /api/processos/{id}/ativo`
- `GET /api/processos/{id}/partes`
- `POST /api/processos/{id}/partes`
- `DELETE /api/processos/{id}/partes/{parteId}`
- `GET /api/processos/{id}/andamentos`
- `POST /api/processos/{id}/andamentos`
- `DELETE /api/processos/{id}/andamentos/{andamentoId}`
- `GET /api/processos/{id}/prazos`
- `POST /api/processos/{id}/prazos`
- `PUT /api/processos/{id}/prazos/{prazoId}`

## C) Adapters / repositories criados
- `src/repositories/processosRepository.js`
  - selecao central API x legado por `featureFlags.useApiProcessos`
  - adapter `mapApiProcessoToUiShape`
  - adapter de chave natural (`codigoCliente + numeroInterno`)
  - sincronizacao de partes, andamentos e prazo fatal
- `src/services/localStorageMigrationPhase4Processos.js`
  - importacao opcional de legado para API com deduplicacao e marcador

## D) Encontrado no frontend
- Persistencia principal de processo em `vilareal:processos-historico:v1` (`processosHistoricoData.js`).
- Tela `Processos.jsx` salva grande volume de campos em snapshot local.
- `CadastroClientes.jsx` usa grade local para `processoVelho`, `processoNovo`, `parteOposta`, `descricao`.

## E) Inferido
- Como a tela usa chave natural (`codigoCliente` + `proc`), e necessario resolver `processo.id` em runtime para operacoes de partes/andamentos/prazos.
- Para manter UX atual sem refactor grande, sincronizacao de partes/andamentos foi implementada como substituicao do conjunto atual (delete + insert).

## F) Adaptado
- Com flag ligada:
  - `Processos.jsx` carrega dados de API e exibe loading/erro/salvando.
  - Autosave principal sincroniza cabecalho com API.
  - Vínculo de partes e historico alimentam `processo_partes` e `processo_andamentos`.
  - Prazo fatal da tela gera/atualiza prazo fatal em `processo_prazos`.
- Com flag desligada:
  - fluxo legado `localStorage/mock` permanece intacto.

## G) Pendente
- UI de prazos individuais (alem de `prazo_fatal`) ainda nao existe na tela atual.
- `processosDadosRelatorio.js` ainda depende majoritariamente de fonte mock/local.
- Sincronizacao incremental de andamentos (upsert por linha) ainda nao foi refinada; atual usa reposicao total.

## H) Pronto para homologacao com flag ligada
- Carregamento e gravacao de cabecalho.
- Sincronizacao de partes por vinculo de pessoas.
- Sincronizacao de andamentos da aba Historico.
- Persistencia de prazo fatal no backend.
