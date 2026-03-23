# Migracao localStorage Fase 4 Processos

## Chaves identificadas (processos)
- `vilareal:processos-historico:v1`
- `vilareal:processos-historico:demo-seed-version`
- `vilareal:processos:edicao-desabilitada-ao-sair:v1`

## Formato legado (resumo)
- Objeto por chave `codCliente:proc`.
- Cada registro contem cabecalho, partes em listas de ids (`parteClienteIds`, `parteOpostaIds`), historico (`historico[]`) e `prazoFatal`.

## Estrategia implementada
- Arquivo: `src/services/localStorageMigrationPhase4Processos.js`
- Controle por flag:
  - `VITE_USE_API_PROCESSOS=true`
  - `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE4_PROCESSOS=true`
- Execucao unica por marcador:
  - `vilareal:migration:phase4-processos:done:v1`

## Regras de importacao
- Resolve cliente por `codigo_cliente`.
- Upsert do cabecalho por chave natural (`codigoCliente + numeroInterno`).
- Partes: importa somente ids vinculados quando existentes.
- Andamentos: importa historico atual da chave.
- Prazo: importa `prazoFatal` como prazo fatal tecnico.

## Deduplicacao
- Cabecalho: deduplicacao por chave natural.
- Partes/andamentos: reposicao do conjunto no momento da importacao.
- Prazo fatal: upsert do prazo marcado como fatal.

## Limites e riscos (explicitos)
- Importacao de andamentos e partes por reposicao pode sobrescrever ajustes manuais feitos no backend antes da migracao.
- Campos fora do contrato da Fase 4 continuam no legado e nao sao migrados integralmente.
- Recomendado rodar a importacao apenas uma vez em homologacao e revisar antes de producao.

## Desligamento futuro do legado
- Apos validacao em homologacao:
  1. manter `VITE_USE_API_PROCESSOS=true`
  2. setar `VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE4_PROCESSOS=false`
  3. manter fallback somente para contingencia ate estabilizacao final
