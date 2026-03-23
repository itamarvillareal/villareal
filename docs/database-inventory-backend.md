# Inventário do backend atual (`e-vilareal-java-backend`)

## Escopo e método

- **Encontrado no código:** entidades JPA, repositórios, serviços, controllers, DTOs, validações, enums, migrations Flyway e endpoints REST.
- **Inferido:** comportamento arquitetural quando não explícito em comentário.
- **Não incluído:** proposta de SQL novo (fica nos outros documentos).

## 1) Stack backend encontrada

### Encontrado no código

- Linguagem: **Java 21**
- Framework: **Spring Boot 4.0.3**
- Persistência: **Spring Data JPA (Hibernate)**
- Banco configurado: **MySQL** (`jdbc:mysql://...`)
- Migrations: **Flyway** + `flyway-mysql`
- API docs: **springdoc-openapi**
- Config principal: `src/main/resources/application.properties`

## 2) Entidades JPA existentes

### Encontrado no código

1. `cadastro_pessoas` (`CadastroPessoa`)
   - Campos: `id`, `nome`, `email`, `cpf`, `telefone`, `data_nascimento`, `ativo`, `marcado_monitoramento`, `data_criacao`, `data_atualizacao`, `responsavel_id`
   - Relacionamento: auto-FK `responsavel_id -> cadastro_pessoas.id`
   - Índices declarados em JPA: `email`, `cpf`, `ativo`, `responsavel_id`

2. `auditoria_atividades` (`AuditoriaAtividade`)
   - Campos: `id`, `usuario_id`, `usuario_nome`, `ocorrido_em`, `modulo`, `tela`, `tipo_acao`, `descricao`, `registro_afetado_id`, `registro_afetado_nome`, `ip_origem`, `observacoes_tecnicas`
   - Índices: `ocorrido_em`, `usuario_id`, `modulo`, `tipo_acao`

3. `monitored_people` (`MonitoredPerson`)
   - Campos centrais: `person_id` (1:1 com pessoa), `enabled`, `monitor_mode`, `global_frequency_type`, `global_frequency_value`, `preferred_tribunals_json`, flags de estratégia, agendamento e estado de execução
   - Índice: `(enabled, next_run_at)`

4. `monitored_people_search_keys` (`MonitoredPersonSearchKey`)
   - Campos: `monitored_person_id`, `key_type`, `key_value`, `normalized_value`, `enabled`, `priority`, `notes`

5. `monitoring_runs` (`MonitoringRun`)
   - Campos: `monitored_person_id`, `started_at`, `finished_at`, `status`, `trigger_type`, `tribunal_alias`, `query_strategy`, payload/resumo, métricas e erro

6. `monitoring_hits` (`MonitoringHit`)
   - Campos: vínculo com monitorado e run, dados do hit, score, dedup, revisão, vínculos sugeridos (`linked_process_id`, `linked_client_id`)
   - Índices: `(monitored_person_id, review_status)`, `dedup_hash`

7. `monitoring_settings` (`MonitoringSettings`)
   - Config global: scheduler, frequência padrão, batch, retry, timeout, cache, flags JSON
   - Registro singleton (`id=1`)

## 3) Repositories existentes

### Encontrado no código

- `CadastroPessoasRepository`
  - Busca com `@EntityGraph(responsavel)`; `findByAtivoTrue`; `findByMarcadoMonitoramentoTrue`; validações de unicidade.
- `AuditoriaAtividadeRepository`
  - `JpaSpecificationExecutor` para filtros dinâmicos.
- `MonitoredPersonRepository`
  - `findAllWithPerson`, `findByIdWithPerson`, `findByPerson_Id`, `findDueForRun(now)`.
- `MonitoredPersonSearchKeyRepository`
  - Lista de chaves habilitadas por prioridade.
- `MonitoringRunRepository`
  - Runs por pessoa monitorada ordenadas por início.
- `MonitoringHitRepository`
  - Contagens por status, listagem por revisão, dedup hash.
- `MonitoringSettingsRepository`
  - CRUD padrão.

## 4) Services existentes

### Encontrado no código

- `CadastroPessoasServiceImpl`
  - CRUD de pessoas, valida unicidade email/cpf, valida cadeia de responsável (anti-ciclo), sincroniza monitoramento, audita criação/edição/exclusão.
- `AuditoriaAtividadeServiceImpl`
  - Registro de auditoria (externo e interno) e consulta paginada por filtros.
- `MonitoringPeopleService`
  - Cadastro/patch de monitoramento, chaves de busca, execução manual, listagem runs/hits, revisão de hits, leitura/edição de settings, sincronização com `cadastro_pessoas`.
- Outros serviços de monitoramento (execução e regras): `MonitoringRunExecutor`, `MonitoringSchedulerService`, `MonitoringFrequencyCalculator`, `MonitoringDedupService`, `MonitoringMatchScoringService`.

## 5) Controllers e endpoints REST implementados

### Encontrado no código

1. `CadastroPessoasController` (`/api/cadastro-pessoas`)
   - `POST /`
   - `PUT /{id}`
   - `GET /{id}`
   - `GET /?apenasAtivos=...`
   - `DELETE /{id}`

2. `AuditoriaAtividadeController` (`/api/auditoria/atividades`)
   - `POST /`
   - `GET /` com filtros (`dataInicio`, `dataFim`, `usuarioId`, `modulo`, `tipoAcao`, `registroAfetadoId`, `q`, paginação/sort)

3. `MonitoringController` (`/api/monitoring`)
   - `GET /people`
   - `GET /people/candidates`
   - `POST /people`
   - `GET /people/{id}`
   - `PATCH /people/{id}`
   - `POST /people/{id}/run`
   - `POST /people/{id}/search-keys`
   - `GET /people/{id}/runs`
   - `GET /people/{id}/hits?reviewStatus=...`
   - `PATCH /hits/{hitId}/review`
   - `GET /settings`
   - `PUT /settings`
   - `GET /tribunals`

## 6) DTOs e validações

### Encontrado no código

- Pessoas:
  - `CadastroPessoasRequest` com validações `@NotBlank`, `@Email`, `@Size`.
  - `CadastroPessoasResponse` + `CadastroPessoaResponsavelResumo`.
- Auditoria:
  - `AuditoriaAtividadeRequest` com validações de tamanho e obrigatoriedade.
  - `AuditoriaAtividadeResponse`, `AuditoriaAtividadePaginaResponse`.
- Monitoramento:
  - Requests/DTOs para upsert/patch/pesquisa/revisão de hits/settings/summaries/detail.
  - Validações: `@NotNull` e `@NotBlank` em campos críticos.

## 7) Enums existentes

### Encontrado no código

- `MonitorMode`: `HYBRID`, `KNOWN_PROCESSES_ONLY`, `CONSERVATIVE`
- `MonitoringFrequencyType`: `MINUTES_15`, `MINUTES_30`, `HOURS_1`, `HOURS_6`, `HOURS_12`, `DAILY`, `BUSINESS_HOURS`
- `MonitoringRunStatus`: `RUNNING`, `SUCCESS`, `PARTIAL`, `FAILED`, `NO_PUBLIC_SUPPORT`, `SKIPPED`
- `HitReviewStatus`: `PENDING`, `APPROVED`, `REJECTED`, `FALSE_POSITIVE`, `ARCHIVED`

## 8) Migrations Flyway existentes

### Encontrado no código

- `V1__criar_tabela_cadastro_pessoas.sql`
- `V2__cadastro_pessoas_responsavel.sql`
- `V3__auditoria_atividades.sql`
- `V4__monitoring_module.sql`
- `V5__monitoring_enum_sanitize.sql`

### Tabelas já previstas nas migrations

- `cadastro_pessoas`
- `auditoria_atividades`
- `monitored_people`
- `monitored_people_search_keys`
- `monitoring_runs`
- `monitoring_hits`
- `monitoring_settings`

## 9) Constraints e índices já existentes (nível banco)

### Encontrado no código

- `cadastro_pessoas`
  - `UNIQUE(email)`, `UNIQUE(cpf)`, FK `responsavel_id` auto-referência (`ON DELETE SET NULL`, `ON UPDATE CASCADE`)
- `monitored_people`
  - `UNIQUE(person_id)`, FK para pessoa
- `monitored_people_search_keys`
  - FK com `ON DELETE CASCADE`
- `monitoring_runs`
  - FK com `ON DELETE CASCADE`
- `monitoring_hits`
  - FKs para monitorado e run, índices de revisão e deduplicação
- `auditoria_atividades`
  - Índices para relatório/filtro

## 10) Situação atual do backend (resumo)

- **Encontrado no código:** backend já cobre de forma real os domínios **Pessoas**, **Auditoria** e **Monitoramento**.
- **Inferido (alta confiança):** os demais módulos de negócio (clientes formais, processos jurídicos, financeiro principal, imóveis, documentos e anexos) ainda não estão modelados no backend.
