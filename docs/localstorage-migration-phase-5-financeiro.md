# Migracao localStorage - Fase 5 (Financeiro)

## Objetivo

Documentar as chaves legadas do financeiro e a estrategia de transicao para API real sem corte abrupto.

## Chaves identificadas (encontrado no frontend)

- `vilareal.financeiro.extratos.v20`
- legadas: `vilareal.financeiro.extratos.v1 ... v19`
- `vilareal.financeiro.extratos.inativos.v1`
- `vilareal.financeiro.contasExtras.v1`
- `vilareal.financeiro.contasContabeis.extras.v1`
- `vilareal.financeiro.contasContabeis.inativas.v1`
- `vilareal.financeiro.consultasVinculo.log.v1`
- `vilareal.usuario.master` (controle de exclusao do log)
- preferencias de layout financeiro:
  - `vilareal:financeiro:layout-relatorios:v1`
  - `vilareal:financeiro:exibicao-relatorios:v2`

## Estrategia de migracao aplicada

- **adaptado**:
  - persistencia de extratos passou a obedecer a regra de fallback centralizada:
    - com `VITE_USE_API_FINANCEIRO=true`: nao grava extratos na chave principal como fonte soberana;
    - com flag desligada: mantem gravação local normal.
- **adaptado**:
  - sincronizacao por item de lancamento para API ao editar dados chave no `Financeiro.jsx`.

## Estrategia de importacao inicial

- **adaptado**:
  - migracao assistida opcional implementada em `src/services/financeiroMigrationPhase5.js`.
  - execucao unica por marcador `vilareal:migration:phase5-financeiro:done:v1`.
  - ativacao por flag dedicada `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE5_FINANCEIRO=true`.
  - migracao roda no bootstrap (`App.jsx`) sem bloquear abertura do app.

## Deduplicacao

- **adaptado**:
  - importacao usa chave composta tecnica para evitar duplicidade:
    - `dataLancamento/data`
    - `valor`
    - `descricao`
    - `contaContabilNome/conta/letra`
    - `clienteId`
    - `processoId`
    - `numeroLancamento/numero`
- **mitigado**:
  - antes de importar, carrega lancamentos ja existentes na API e monta set de dedupe em memoria.
  - quando o vinculo textual nao resolve ids nativos, ainda tenta importar com ids nulos (registrando `semVinculo` no retorno).

## O que permanece em localStorage (temporariamente)

- extratos legados e configuracoes de exibicao;
- catalogos extras/inativos locais de contas (ate transicao completa da UI para catalogo backend);
- log de consultas de vinculo.

## Chaves lidas para importacao assistida

- **adaptado**:
  - principal: `vilareal.financeiro.extratos.v20`
  - compatibilidade imediata: `vilareal.financeiro.extratos.v19`
- **inferido**:
  - versoes mais antigas continuam tratadas pela propria rotina de carga/migracao de `financeiroData.js` para v20 antes da importacao.

## Candidatos a remocao futura

- `vilareal.financeiro.extratos.v20` como fonte primaria de negocio;
- contas contabeis extras/inativas locais quando catalogo backend for soberano no frontend;
- chaves de versoes antigas de extrato apos migrador dedicado e homologado.

## Riscos e mitigacoes

- **risco**: divergencia entre extrato local e API em transicao.
  - **mitigacao**: flag reversivel + sincronizacao incremental de itens editados.
- **risco**: duplicidade em importacao retroativa.
  - **mitigacao**: adiar importador em massa para etapa dedicada com dedupe validado.
- **risco**: UX confusa por coexistencia local/API.
  - **mitigacao**: mensagens de status na tela e documentacao de homologacao por flag.
