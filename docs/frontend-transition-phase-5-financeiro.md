# Transicao do frontend - Fase 5 (Financeiro)

## Escopo desta fase

- Migrar o nucleo financeiro para API real de forma controlada.
- Manter fallback local/mock durante a transicao.
- Nao entrar em publicacoes completas, anexos pesados e modulo completo de imoveis/repasses.

## Mapeamento do frontend financeiro (evidencia)

### Telas e componentes (encontrado no codigo)

- `src/components/Financeiro.jsx` (`/financeiro`)
  - painel extrato por instituicao;
  - painel consolidado por conta contabil;
  - filtros por periodo;
  - classificacao de lancamentos;
  - vinculo de `codCliente/proc`;
  - compensacao por elo (`Conta Compensacao`, `ref N/R`, `eq`).
- `src/components/ModalVinculoClienteProcFinanceiro.jsx`
  - busca e gravacao de cliente/processo em lancamentos.
- `src/components/Processos.jsx`
  - consome conta corrente por cliente/processo (hoje via utilitario local de financeiro).
- `src/components/RelatorioFinanceiroImoveis.jsx`
  - deriva aluguel/repasse a partir de transacoes financeiras por cliente/processo.

### Dados persistidos localmente (encontrado no codigo)

- Extratos e migracoes legadas:
  - `vilareal.financeiro.extratos.v20` (e chaves antigas v1..v19).
- Contas/instituicoes extras:
  - `vilareal.financeiro.contasExtras.v1`.
- Instituicoes inativas:
  - `vilareal.financeiro.extratos.inativos.v1`.
- Contas contabeis extras/inativas:
  - `vilareal.financeiro.contasContabeis.extras.v1`
  - `vilareal.financeiro.contasContabeis.inativas.v1`.
- Log de consulta automatica de vinculo:
  - `vilareal.financeiro.consultasVinculo.log.v1`.

### Campos efetivamente usados no lancamento (encontrado)

- `numero`, `data`, `descricao`, `valor`, `letra/conta`, `categoria/descricaoDetalhada`, `codCliente`, `proc`, `ref`, `eq/dimensao`, `parcela`, `nomeBanco/numeroBanco`.

## Endpoints de Fase 5 e mapeamento inicial

### Contas contabeis

- `GET /api/financeiro/contas`
- `POST /api/financeiro/contas`
- `PUT /api/financeiro/contas/{id}`

### Lancamentos financeiros

- `GET /api/financeiro/lancamentos?clienteId=&processoId=&contaContabilId=&dataInicio=&dataFim=`
- `GET /api/financeiro/lancamentos/{id}`
- `POST /api/financeiro/lancamentos`
- `PUT /api/financeiro/lancamentos/{id}`
- `DELETE /api/financeiro/lancamentos/{id}`
- `GET /api/financeiro/lancamentos/resumo-processo/{processoId}` (resumo simples de conta corrente processual)

## Adapters necessarios no frontend

- **Repositorio financeiro API-first** (novo):
  - listar contas contabeis;
  - listar/criar/editar/excluir lancamentos;
  - mapear shape UI (`letra`, `numero`, `codCliente/proc`) para DTO backend (`contaContabilId`, `numeroLancamento`, `clienteId/processoId`).
- **Resolucao de conta contabil**:
  - manter mapeamento temporario `letra -> contaContabil` para compatibilidade com extratos legados.
- **Resolucao de cliente/processo**:
  - preferir `clienteId/processoId` no estado;
  - manter entrada por `codCliente/proc` enquanto houver fluxo legado.

## Feature flag da fase

- **recomendado e pendente de uso efetivo no frontend**:
  - `VITE_USE_API_FINANCEIRO`
  - controle central em `featureFlags.useApiFinanceiro`, evitando `if` espalhado.

## Ordem ideal de adaptacao (progressiva e reversivel)

1. criar repositorio financeiro API-first com fallback;
2. migrar catalogo de contas contabeis da UI para `GET /api/financeiro/contas`;
3. migrar leitura de lancamentos (somente leitura) com filtros;
4. migrar criacao/edicao/exclusao de lancamentos;
5. migrar conta corrente em `Processos` para endpoint de resumo + listagem filtrada;
6. reduzir dependencia de `localStorage` para extratos historicos.

## Gaps que ficam pendentes apos esta fase

- importacao OFX server-side completa (nesta fase permanece no frontend).
- reconciliacao/compensacao automatica integral no backend.
- integracao completa com modulo de imoveis/repasses.
- historico de auditoria fina por alteracao de lancamento financeiro.
