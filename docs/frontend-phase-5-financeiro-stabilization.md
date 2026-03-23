# Frontend Fase 5 - Estabilizacao Financeiro

## Escopo desta mini-fase

- **encontrado no frontend**: a API ja era usada para leitura e edicao incremental, mas a exclusao ainda nao tinha gatilho visual consolidado.
- **adaptado**: exclusao visual por linha no consolidado de `Financeiro.jsx`, com `DELETE` na API e fallback local com a flag desligada.
- **adaptado**: migracao assistida opcional via `src/services/financeiroMigrationPhase5.js`, com marcador de execucao unica e deduplicacao.
- **adaptado**: `RelatorioFinanceiroImoveis.jsx` passou para modo API-first parcial por etapas (totais e datas por processo, sem redesenho da tela).
- **mitigado**: dependencia textual de `codCliente/proc` em pontos de integracao, priorizando `clienteId/processoId` quando os ids estao disponiveis.

## A) Pontos ainda dependentes de legado

- **encontrado no frontend**: grade do `Financeiro.jsx` ainda exibe e edita `codCliente` e `proc` como campos visuais.
- **encontrado no frontend**: `RelatorioFinanceiroImoveis.jsx` mantem base legada como fallback de layout e regras de status.
- **encontrado no frontend**: `financeiroData.js` continua sendo fonte de fallback de extratos e catalogos locais.
- **inferido**: enquanto a UI conservar campos textuais para operacao manual, `codCliente/proc` seguem como entrada de compatibilidade.

## B) Pontos convertidos para IDs nativos

- **adaptado**: `financeiroRepository.js` passou a carregar `clienteId` e `processoId` no objeto de UI.
- **adaptado**: `Financeiro.jsx` ja prioriza `_financeiroMeta.clienteId` e `_financeiroMeta.processoId` para enviar `POST/PUT`.
- **adaptado**: vinculo cliente/processo no financeiro resolve ids reais antes da sincronizacao.
- **adaptado**: `Processos.jsx` permanece consumindo resumo financeiro por `processoId` nativo.

## C) Exclusao API habilitada

- **adaptado**: botao de exclusao por linha no consolidado da tela `Financeiro.jsx`.
- **adaptado**: com `VITE_USE_API_FINANCEIRO=true`, usa `removerLancamentoFinanceiroApi(apiId)` e atualiza estado local sem reload.
- **adaptado**: com flag desligada, remove apenas no fallback local e informa sucesso local.
- **mitigado**: quando a linha ainda nao possui `apiId`, a UI mostra erro amigavel em vez de excluir silenciosamente.

## D) Importacao assistida opcional (legado -> API)

- **adaptado**: novo servico `src/services/financeiroMigrationPhase5.js`.
- **adaptado**: execucao unica com marcador `vilareal:migration:phase5-financeiro:done:v1`.
- **adaptado**: ativacao por `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE5_FINANCEIRO=true` + `VITE_USE_API_FINANCEIRO=true`.
- **adaptado**: deduplicacao por chave composta: `data + valor + descricao + conta/letra + clienteId + processoId + numeroLancamento`.
- **mitigado**: quando nao for possivel mapear ids de cliente/processo, a importacao segue com metadado nulo (contabiliza `semVinculo`).

## E) Situacao do RelatorioFinanceiroImoveis

- **adaptado**: leitura API-first parcial por processo (totais de aluguel/repasse e datas do primeiro evento no mes).
- **adaptado**: quando API financeiro esta desligada, mantem caminho atual sem alteracao de UX.
- **mitigado**: calculos de status continuam com base no desenho atual para evitar regressao visual.
- **pendente**: migrar 100% da fonte do relatorio para dataset API soberano (incluindo classificacao e alertas completos no backend).

## F) Ajustes de repository e adapters

- **adaptado**: separacao explicita no `financeiroRepository.js` entre leitura (`listar*`), escrita (`salvarOuAtualizar*`), exclusao (`remover*`) e resumo processual.
- **adaptado**: helper de transicao `listarLancamentosProcessoApiFirst` para consumo de relatorios por `processoId` com fallback de chave natural.
- **adaptado**: adapter API -> UI preserva compatibilidade textual, mas injeta ids nativos para reduzir dependencia legada.

## G) Legado/localStorage remanescente

- **encontrado no frontend**: extratos e configuracoes locais ainda existem como fallback.
- **encontrado no frontend**: chaves de contas extras/inativas e layout da tela financeira seguem locais.
- **mitigado**: nenhuma remocao agressiva nesta etapa; convivencia controlada por flags.

## H) Gaps para fase futura

- **pendente**: substituir campos textuais `codCliente/proc` como referencia primaria de tela.
- **pendente**: API-first completo do relatorio financeiro de imoveis (fonte soberana sem base local).
- **pendente**: importacao assistida com UX operacional dedicada (preview/confirmacao por lote).
- **pendente**: reconciliacao automatica total e OFX server-side completo (fora do escopo desta mini-fase).
