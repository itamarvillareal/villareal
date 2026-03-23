# Monitoramento de Pessoas (DataJud / CNJ)

## Visão geral

O módulo consulta a **API pública DataJud** por processo (estratégia principal) e, opcionalmente, tenta buscas amplas por documento, registrando **limitações** quando o índice do tribunal não suporta a consulta. O **teor** das publicações não é substituído por este módulo.

## Banco (Flyway V4)

- `cadastro_pessoas.marcado_monitoramento` — marcado por outro fluxo (UI/API de cadastro).
- `monitored_people` — configuração e agendamento por pessoa.
- `monitored_people_search_keys` — chaves (`numero_processo`, `cpf`, `nome`, etc.).
- `monitoring_runs` — auditoria de execuções.
- `monitoring_hits` — achados com `review_status` (revisão humana obrigatória antes do vínculo definitivo).
- `monitoring_settings` — scheduler, lote, timeouts (id fixo `1`).

## Configuração backend

```properties
vilareal.datajud.base-url=https://api-publica.datajud.cnj.jus.br
vilareal.datajud.api-key=${DATAJUD_API_KEY:}
vilareal.monitoring.scheduler.fixed-delay-ms=60000
```

Defina a variável de ambiente `DATAJUD_API_KEY` com a chave da API pública do CNJ.

## API REST (`/api/monitoring`)

| Método | Caminho | Descrição |
|--------|---------|-----------|
| GET | `/people` | Lista monitorados com totais |
| GET | `/people/candidates` | Cadastros marcados sem `monitored_people` |
| POST | `/people` | Corpo `{ "personId": 1, ... }` — cria/atualiza |
| GET | `/people/{id}` | Detalhe + chaves + últimas runs |
| PATCH | `/people/{id}` | Frequência, flags, pausa |
| POST | `/people/{id}/run` | Execução manual (409 se concorrente) |
| POST | `/people/{id}/search-keys` | Nova chave |
| GET | `/people/{id}/runs` | Histórico |
| GET | `/people/{id}/hits` | Achados (`?reviewStatus=PENDING`) |
| PATCH | `/hits/{hitId}/review` | Revisão |
| GET/PUT | `/settings` | Agendador global |
| GET | `/tribunals` | Índices suportados no resolver local |

## Frontend

Rota: **`/processos/monitoramento`**. Consome a API via `src/api/monitoringService.js`.

## Estratégias implementadas

1. **A — Processos conhecidos**: chaves `numero_processo` + consulta por `numeroProcesso` no índice do tribunal do CNJ.
2. **B — Documento (experimental)**: até 2 tribunais da lista configurada; falhas viram nota em `limitation_note` da run.
3. **Nome**: não executada automaticamente (alto risco de falso positivo); mensagem na run.

## Testes

`MonitoringFrequencyCalculatorTest`, `MonitoringDedupServiceTest`, `MonitoringMatchScoringServiceTest`, `CnjFormatUtilTest`, `DatajudTribunalResolverTest`.
