# Frontend Fase 4 - Estabilizacao do Modulo de Processos

## Escopo da mini-fase

- **Encontrado no frontend**: a integracao inicial da Fase 4 funcionava, mas com dependencia recorrente de chave natural (`codigoCliente` + `proc/numeroInterno`) e sincronizacao em bloco para partes/andamentos.
- **Adaptado**: fluxo principal da tela de processos e repositório para priorizar `processoId` quando `useApiProcessos=true`.
- **Mitigado**: risco de sobrescrita acidental por "replace-all" em partes/andamentos.
- **Pendente**: consolidacao total de `processoId` em toda a navegação e relatorios 100% API sem base mock.

## A) Pontos onde a UI ainda usava chave natural

- **Estrutural (encontrado)**:
  - Entrada/navegacao para `Processos` ainda nasce com `codCliente` + `proc`.
  - Relatorio abre a tela de processos por `state: { codCliente, proc }`.
- **Legado (encontrado)**:
  - Persistencia local de processos em `localStorage` usa chave composta cliente/processo.
  - Utilitarios de relatorio usam funcoes sincrono-mock orientadas a `codCliente + proc`.
- **Substituivel por `processoId` (inferido e adaptado parcialmente)**:
  - Operacoes subsequentes de cabecalho/partes/andamentos/prazos apos resolver o processo na API.

## B) Pontos convertidos para `processoId`

- **Adaptado**:
  - `Processos.jsx` agora resolve `processoId` e passa a reutiliza-lo nas chamadas seguintes.
  - Carregamento usa `resolverProcessoId(...)` + `buscarProcessoPorId(...)` antes de cair para busca por chave natural.
  - Persistencia de cabecalho envia `processoId` para `salvarCabecalhoProcesso`, evitando nova busca natural quando o id ja foi resolvido.
  - Operacoes de partes, andamentos e prazo fatal passam a usar `processoId` resolvido.

## C) Ajustes no repository/adapters

- **Adaptado (API-first)**:
  - Novas funcoes:
    - `buscarProcessoPorId`
    - `resolverProcessoId`
    - `obterCamposProcessoApiFirst`
    - `mapApiAndamentoToHistoricoItem`
  - `salvarCabecalhoProcesso` prioriza `processoId`; busca por chave natural vira fallback.
  - `listarPartesProcesso`, `listarAndamentosProcesso`, `listarPrazosProcesso`, `upsertPrazoFatalProcesso` validam/resolvem id.
- **Adaptado (transicao segura)**:
  - `sincronizarPartesIncremental` substitui estrategia de apagar tudo e recriar.
  - `sincronizarAndamentosIncremental` idem, com reconciliacao por id e assinatura de conteudo/data.

## D) Estrategia aplicada para partes

- **Encontrado**: fluxo antigo fazia reposicao total (`DELETE` de todas + `POST` de todas).
- **Adaptado**:
  - Reconciliacao incremental:
    - remove somente o que nao existe mais no estado desejado;
    - atualiza (`PUT`) itens equivalentes;
    - cria (`POST`) somente novos.
  - Sincronizacao de partes foi separada do autosave geral e agora roda apenas no evento de vinculo/edicao de partes.
- **Mitigado**: menor probabilidade de apagar partes validas em edicoes parciais.
- **Pendente**: incluir metadado de versao/concurrency control no backend para disputa concorrente forte (fora desta mini-fase).

## E) Estrategia aplicada para andamentos

- **Encontrado**: fluxo antigo sobrescrevia historico completo.
- **Adaptado**:
  - Reconciliacao incremental por `id` (quando existe) e assinatura (`movimentoEm + titulo`) como fallback.
  - Sincronizacao de andamentos foi desacoplada do autosave de cabecalho e acionada nos pontos de alteracao do historico.
- **Mitigado**: reducao de escrita destrutiva em lote.
- **Pendente**: UI com operacoes explicitas por item (editar/excluir com acao dedicada) para controle ainda mais fino.

## F) Tratamento de prazo fatal vs prazos individuais

- **Encontrado**:
  - O campo da tela "Prazo Fatal" e um campo de cabecalho exibido no processo.
  - No backend, prazos ficam em `processo_prazos` e o prazo fatal e representado por `prazoFatal=true`.
- **Adaptado**:
  - Mantida a regra atual de transicao: o campo da tela atualiza o prazo individual marcado como fatal via `upsertPrazoFatalProcesso`.
  - Nomenclatura/documentacao deixam explicito que:
    - "prazo fatal da tela" = atalho para registro em `processo_prazos` com `prazoFatal=true`;
    - "prazos individuais" = demais registros de prazo, ainda sem UI dedicada nesta fase.
- **Pendente**: tela dedicada para gerenciamento completo de prazos individuais.

## G) Situacao dos relatorios/utilitarios

- **Encontrado**: `processosDadosRelatorio.js` e enriquecimento eram majoritariamente mock/local.
- **Adaptado (API-first de leitura, com compatibilidade)**:
  - Criado pre-aquecimento assincrono (`preaquecerCamposRelatorioApiFirst`) para carregar dados de processo/partes/andamentos da API.
  - Cache em memoria por `cliente|proc` sobrepoe os campos mock quando disponivel.
  - `Relatorio.jsx` passa a chamar o pre-aquecimento antes de montar as linhas.
- **Mitigado**: fonte de dados dos relatorios fica mais aderente ao backend real sem quebrar o fluxo atual.
- **Pendente**: remover dependencia da base mock como fonte primaria de estrutura de linhas.

## H) Legado/localStorage remanescente

- **Permanece (fallback/compatibilidade)**:
  - `vilareal:processos-historico:v1` (fonte local da tela Processos quando API desligada).
  - `vilareal:processos:edicao-desabilitada-ao-sair:v1`.
  - `vilareal:processos-historico:demo-seed-version`.
- **Permanece (controle de migracao)**:
  - `vilareal:migration:phase4-processos:done:v1`.
- **Adaptado**:
  - Migracao assistida da Fase 4 passou a usar sincronizacao incremental para partes/andamentos.
- **Candidata a remocao futura (pendente)**:
  - armazenamento local de historico/processo como fonte primaria, quando API estiver estabilizada em 100% dos fluxos.

## I) Gaps para fase futura

- Consolidar navegacao e estado global em `processoId` na origem (inclusive grid/rotas), nao apenas apos resolucao.
- Criar UI dedicada de prazos individuais (`processo_prazos`) com CRUD e marcacao de cumprimento.
- Refinar relatorio para dataset primario API (em vez de base mock enriquecida).
- Adicionar estrategia robusta para concorrencia (versao/ETag) se necessario.
