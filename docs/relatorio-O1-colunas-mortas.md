# O1 — Auditoria de colunas sem FK e referências fantasma

**Escopo:** código-fonte do monorepo `villareal` (prioridade `e-vilareal-java-backend`; referências em `e-vilareal-react-web` e `docs/` quando relevantes para Q3).  
**Migrations no disco:** último script SQL versionado em `e-vilareal-java-backend/src/main/resources/db/migration/` é **V33** (não existe `V34__*.sql` nem superiores neste repositório).  
**Metodologia:** para cada coluna alvo, respostas às perguntas **Q1** (leitura via JPQL, método derivado de repositório, `@Query` nativa, `EntityManager`, `JdbcTemplate`, Criteria em `Specification`, etc.), **Q2** (escrita via serviço/`save`/SQL em Java), **Q3** (DTOs em `**/api/dto/**`).

---

## 1. Colunas alvo — matriz Q1 / Q2 / Q3

### `financeiro_lancamento.classificacao_financeira_id`

| Pergunta | Resposta |
|----------|----------|
| **Q1** | **Sim (indireto).** Não há filtro dedicado em `LancamentoFinanceiroSpecifications` nem `@Query` que mencione o campo. O valor é carregado sempre que a entidade é lida (`findAll` com spec, `findById`) e exposto em `FinanceiroApplicationService.toLancamentoResponse`. |
| **Q2** | **Sim.** `FinanceiroApplicationService.aplicarLancamento`: na criação ou quando o request envia o campo (`if (criacao \|\| req.getClassificacaoFinanceiraId() != null)`), persiste `e.setClassificacaoFinanceiraId(...)`. |
| **Q3** | **Sim.** `br.com.vilareal.financeiro.api.dto.LancamentoFinanceiroWriteRequest` e `LancamentoFinanceiroResponse`. O front (`e-vilareal-react-web/src/repositories/financeiroRepository.js`, `src/utils/ofx.js`) envia/interpreta `classificacaoFinanceiraId`. |

**Conclusão:** coluna **não está morta** no sentido de código; não há tabela `classificacao_financeira` no schema (continua a ser um BIGINT opaco, sem integridade referencial no MySQL).

---

### `financeiro_lancamento.elo_financeiro_id`

| Pergunta | Resposta |
|----------|----------|
| **Q1** | **Sim.** JPQL em `LancamentoFinanceiroRepository`: `findDistinctEloFinanceiroIdsByBancoNormalizado`, `findDistinctEloFinanceiroIdsByNumeroBanco`; `findByEloFinanceiroIdIn`; uso em `FinanceiroApplicationService.limparExtratoBancoEElosRelacionados`. |
| **Q2** | **Sim.** `aplicarLancamento` define o elo; `limparExtratoBancoEElosRelacionados` zera `eloFinanceiroId` (e outros campos) em lançamentos relacionados antes de apagar o extrato. |
| **Q3** | **Sim.** `LancamentoFinanceiroWriteRequest` / `LancamentoFinanceiroResponse`; documentação em `LimparExtratoResult` e `FinanceiroController` (OpenAPI). |

**Conclusão:** coluna **ativa**; sem FK de propósito (elo lógico entre linhas de extrato).

---

### `financeiro_lancamento.banco_nome` e `financeiro_lancamento.numero_banco`

| Pergunta | `banco_nome` | `numero_banco` |
|----------|----------------|-----------------|
| **Q1** | **Sim.** JPQL com `l.bancoNome` em `LancamentoFinanceiroRepository` (normalização UPPER/TRIM); critério em `pertenceAoExtratoLimpo` no serviço de limpeza. | **Sim.** `findDistinctEloFinanceiroIdsByNumeroBanco`, `findAllByNumeroBanco`; critério em `pertenceAoExtratoLimpo`. |
| **Q2** | **Sim.** `aplicarLancamento` → `e.setBancoNome(...)`. | **Sim.** `e.setNumeroBanco(req.getNumeroBanco())`. |
| **Q3** | **Sim.** DTOs write/response; `LimparExtratoRequest` expõe `numeroBanco`; testes `ApiIntegrationTest`. | Idem. |

**Conclusão:** par **usado em conjunto** na limpeza de extrato e no cadastro de lançamentos; não são colunas mortas.

---

### `financeiro_lancamento.parcela_ref`

| Pergunta | Resposta |
|----------|----------|
| **Q1** | **Sim (carga da entidade + resposta).** Não há `WHERE` por `parcelaRef` em specs/repositório; o valor segue o ciclo listagem → `toLancamentoResponse`. |
| **Q2** | **Sim.** `aplicarLancamento` atribui a partir de `LancamentoFinanceiroWriteRequest.getParcelaRef()` (trim / null se vazio). |
| **Q3** | **Sim.** `LancamentoFinanceiroWriteRequest` / `LancamentoFinanceiroResponse`. |

**Conclusão:** coluna **em uso**; sem FK (referência operacional livre, ex. parcela de boleto/OFX).

---

### `financeiro_lancamento.eq_referencia`

| Pergunta | Resposta |
|----------|----------|
| **Q1** | **Sim (idem `parcela_ref`).** Sem filtro dedicado; retornado no DTO de listagem/detalhe. |
| **Q2** | **Sim.** `aplicarLancamento` define; `limparExtratoBancoEElosRelacionados` **limpa** `eqReferencia` em lançamentos desvinculados do elo (`l.setEqReferencia(null)`). |
| **Q3** | **Sim.** DTOs write/response; comentário em `LimparExtratoResult`. |

**Conclusão:** coluna **ativa** (vínculo de “equivalência” / compensação entre lançamentos, coerente com comentários do módulo financeiro).

---

### `locacao_despesa.lancamento_financeiro_id`

| Pergunta | Resposta |
|----------|----------|
| **Q1** | **Sim.** Mapeado em `LocacaoDespesaEntity`; respostas de API incluem o id via `ImovelApplicationService` (mapeamento para `LocacaoDespesaResponse`). |
| **Q2** | **Sim.** `ImovelApplicationService` propaga `setLancamentoFinanceiroId` a partir de `LocacaoDespesaWriteRequest` ao criar/atualizar despesa. |
| **Q3** | **Sim.** `LocacaoDespesaWriteRequest` / `LocacaoDespesaResponse`; front `e-vilareal-react-web/src/repositories/imoveisRepository.js`. |

**Conclusão:** vínculo **opcional intencional** sem FK no DDL (reconciliação com `financeiro_lancamento`); não “deveria ter FK” no estado atual do projeto salvo decisão futura de schema.

---

### `locacao_repasse.lancamento_financeiro_vinculo_id`

| Pergunta | Resposta |
|----------|----------|
| **Q1** | **Sim.** Entidade + DTOs + serviço de imóveis (mapeamento em `ImovelApplicationService`). |
| **Q2** | **Sim.** `ImovelApplicationService` define a partir de `LocacaoRepasseWriteRequest`. |
| **Q3** | **Sim.** `LocacaoRepasseWriteRequest` / `LocacaoRepasseResponse`; front `imoveisRepository.js`. |

**Conclusão:** idem despesa — **referência fraca documentada** em `docs/data-dictionary-phase-7-imoveis.md`; não é coluna morta.

---

### `tarefa_operacional.cliente_id`

| Pergunta | Resposta |
|----------|----------|
| **Q1** | **Sim.** `TarefaOperacionalSpecifications.comFiltros` usa `cb.equal(root.get("clienteId"), clienteId)` quando o filtro é informado. |
| **Q2** | **Sim.** `TarefaOperacionalApplicationService.aplicarCampos`: na criação copia do request; na atualização só altera se `req.getClienteId() != null` (**não permite anular** o vínculo com PUT omitindo o campo). |
| **Q3** | **Sim.** `TarefaOperacionalWriteRequest` / `TarefaOperacionalResponse`. |

**Conclusão:** coluna **em uso**; ausência de FK é intencional (id de pessoa “cliente” sem validação no BD).

---

### `tarefa_operacional.processo_id`

| Pergunta | Resposta |
|----------|----------|
| **Q1** | **Sim.** Mesma `Specification` com `root.get("processoId")`. |
| **Q2** | **Sim.** `aplicarCampos` (criação e atualização condicional, mesma ressalva de **não limpar** com null omitido). |
| **Q3** | **Sim.** DTOs write/response. |

**Conclusão:** **ativa**.

---

### `tarefa_operacional.publicacao_id`

| Pergunta | Resposta |
|----------|----------|
| **Q1** | **Sim (carga + listagem).** **Não** entra nos predicados de `TarefaOperacionalSpecifications` (não há filtro por publicação). |
| **Q2** | **Sim.** `aplicarCampos` na criação; na atualização se `req.getPublicacaoId() != null` (mesma limitação para zerar). |
| **Q3** | **Sim.** DTOs; UI `ModalCriarTarefaContextual.jsx`, `tarefasContextualPayload.js`. |

**Conclusão:** coluna **usada**, sobretudo para tarefas contextuais a partir de publicações; filtros de listagem não usam este campo.

---

### `tarefa_operacional.processo_prazo_id`

| Pergunta | Resposta |
|----------|----------|
| **Q1** | **Sim (carga + resposta).** **Não** há filtro em `TarefaOperacionalSpecifications`. |
| **Q2** | **Sim**, com a mesma lógica condicional que `publicacao_id`. |
| **Q3** | **Sim** nos DTOs; comentários no front indicam reserva até a UI expor prazos (`tarefasContextualPayload.js`). |

**Conclusão:** coluna **pouco preenchida na prática** possivelmente, mas **não morta** no código (persistência e contrato JSON existem).

---

### `publicacoes.cliente_ref_id`

| Pergunta | Resposta |
|----------|----------|
| **Q1** | **Sim.** `PublicacaoSpecifications.comFiltros` adiciona predicado `cb.equal(root.get("clienteRefId"), clienteId)` quando o filtro de cliente é usado. |
| **Q2** | **Sim** apenas em `PublicacaoApplicationService.patchVinculoProcesso` (`e.setClienteRefId(p.getPessoa().getId())`). **`criar` não define** `clienteRefId` (fica null até vínculo). |
| **Q3** | **Parcial.** O DTO de saída expõe como `clienteId` em `PublicacaoResponse` (valor lido de `clienteRefId`); **não** há campo homónimo `clienteRefId` no `PublicacaoWriteRequest`. |

**Conclusão:** coluna **ativa** para listagem por cliente e para publicações já vinculadas a processo; não é “fantasma”, mas o create API não popula diretamente.

---

### `agenda_evento.processo_ref`

| Pergunta | Resposta |
|----------|----------|
| **Q1** | **Sim (via entidade).** Repositório `AgendaEventoRepository` não projeta a coluna em `WHERE`, mas o `SELECT e` carrega `processoRef` com o resto da entidade. |
| **Q2** | **Sim.** `AgendaApplicationService.aplicarCampos` → `e.setProcessoRef(trimToNull(req.getProcessoRef()))`. |
| **Q3** | **Sim.** `AgendaEventoWriteRequest`, `AgendaEventoResponse`, `AgendaEventoLinhaDto`. |

**Conclusão:** texto livre **intencional** (vínculo lógico com processo/cliente no front, ver `agendaRepository.js` / `agendaProcessoRef.js`).

---

### `imovel.campos_extras_json`

| Pergunta | Resposta |
|----------|----------|
| **Q1** | **Sim.** Retornado em `ImovelApplicationService` ao montar `ImovelResponse`. |
| **Q2** | **Sim.** `ImovelApplicationService` → `e.setCamposExtrasJson(trimToNull(req.getCamposExtrasJson()))` ao aplicar write. |
| **Q3** | **Sim.** `ImovelWriteRequest` / `ImovelResponse`; front serializa em `imoveisRepository.js`. |

**Conclusão:** coluna **em uso** (snapshot JSON de campos extras da UI).

---

### `contrato_locacao.dados_bancarios_repasse_json`

| Pergunta | Resposta |
|----------|----------|
| **Q1** | **Sim.** Mapeado para `ContratoLocacaoResponse` no serviço de imóveis. |
| **Q2** | **Sim.** `ImovelApplicationService` → `c.setDadosBancariosRepasseJson(trimToNull(req.getDadosBancariosRepasseJson()))`. |
| **Q3** | **Sim.** `ContratoLocacaoWriteRequest` / `ContratoLocacaoResponse`; front `imoveisRepository.js`. |

**Conclusão:** coluna **ativa**.

---

## 2. Referências a migrations inexistentes (número > V33 no disco)

Ficheiros Flyway SQL presentes no repositório: até **`V33__publicacoes.sql`**. Não existem **`V34__*.sql`**, **V35** nem **V36** como migrações versionadas neste monorepo.

**Auditoria O1 (histórico):** comentários Java citavam incorretamente **V34** / **V36** para a tabela `cliente` e `CHAR(8)` de `codigo_cliente` — o DDL correto está em **`V10__cliente.sql`**.

**Correção O4:** os comentários em `ClienteEntity`, `ProcessoApplicationService` e `PessoaApplicationService` foram atualizados para referir **V10** (ou descrição sem número de migração inexistente). Não havia menções a **V35** no código-fonte além deste relatório.

---

## 3. Verificação cruzada entidade JPA ↔ DDL (migrations V1–V33)

**Entidades analisadas (26 ficheiros `*Entity.java` em `e-vilareal-java-backend/.../infrastructure/persistence/entity/`):**  
`AgendaEventoEntity`, `AuditoriaAtividadeEntity`, `CalculoClienteConfigEntity`, `CalculoRodadaEntity`, `ClienteEntity`, `ContratoLocacaoEntity`, `ContaContabilEntity`, `LancamentoFinanceiroEntity`, `ImovelEntity`, `LocacaoDespesaEntity`, `LocacaoRepasseEntity`, `PerfilEntity`, `PessoaEntity`, `PessoaComplementarEntity`, `PessoaContatoEntity`, `PessoaEnderecoEntity`, `PlanilhaPasta1ClienteEntity`, `ProcessoEntity`, `ProcessoAndamentoEntity`, `ProcessoParteEntity`, `ProcessoParteAdvogadoEntity`, `ProcessoPrazoEntity`, `PublicacaoEntity`, `TarefaOperacionalEntity`, `TopicoHierarquiaEntity`, `UsuarioEntity`.

**Metodologia:** confronto das anotações `@Table`, `@Column`, `@JoinColumn`, `@MapsId` e tipos implícitos de FK com o estado consolidado do DDL nas migrations SQL **V1–V33** (e dados-only em migrations Java, sem novas colunas).

### 3.1. Resultado global

| Tipo de discrepância | Encontrado? |
|----------------------|-------------|
| Campo na entidade **sem** coluna correspondente no DDL (risco **`ddl-auto=validate`** em prod) | **Não** identificado nesta auditoria. |
| Coluna no DDL **sem** mapeamento JPA nas entidades listadas (possível coluna “extra” no BD, baixo risco para validate) | **Não** para as tabelas cobertas pelas 26 entidades (tabelas só de infraestrutura como `flyway_schema_history` não têm entidade — esperado). |

### 3.2. Observações (sem quebra de validate)

- **`ContaContabilEntity`:** tabela `financeiro_conta_contabil` não tem `created_at`/`updated_at` no DDL; a entidade também **não** declara esses campos — alinhado.
- **`PlanilhaPasta1ClienteEntity`:** mapeia `pessoa_id` como `Long` em vez de `@ManyToOne`; a coluna e a FK existem no DDL — apenas estilo de mapeamento.
- **`TopicoHierarquiaEntity`:** `@Id` sem `@GeneratedValue` (IDs fixos esperados pela aplicação) — coerente com DDL `INT NOT NULL PRIMARY KEY` sem `AUTO_INCREMENT`.

---

## 4. Resumo executivo

- **Nenhuma das colunas listadas no pedido O1 está “morta”** no sentido de ausência total de leitura/escrita ou de exposição por API/DTO no backend; várias são **referências fracas intencionais** (sem FK).
- **`classificacao_financeira_id`** não tem tabela alvo no schema, mas o pipeline **Java + React** persiste e devolve o valor (metadado opaco).
- **Comentários Javadoc** que citavam V34/V36 foram **alinhados a V10** na tarefa O4 (este relatório O1 descrevia o problema antes da correção).
- **Cruzamento entidade ↔ DDL:** sem discrepâncias que impeçam **`ddl-auto=validate`** para o conjunto das 26 entidades mapeadas face ao DDL V1–V33.

---

*Relatório gerado na auditoria O1; nenhum outro ficheiro de código foi alterado para a sua elaboração.*
