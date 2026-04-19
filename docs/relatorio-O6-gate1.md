# O6 — Gate 1: revalidação de mortalidade (código Java backend)

**Escopo:** `e-vilareal-java-backend/src/main/java` e `e-vilareal-java-backend/src/test`.  
**Critério “escrita com valor não-null”:** apenas atribuições onde o valor **não-null** é **garantido pelo próprio código** (literal, constante com default não-null, cálculo que não admite null, cópia de campo já provado não-null). **Não** contamos `setX(null)`, nem `setX(request.getX())` / `setX(payload.getX())` / dados de planilha sem prova estática de não-null, nem ramos `trim()` que só produzem string não-null se o input externo tiver texto.

**Índices dedicados (Flyway):** em `V7__financeiro.sql` não há `idx_*` apenas sobre `classificacao_financeira_id`, `elo_financeiro_id`, `parcela_ref` ou `eq_referencia`. Em `V3__processo.sql` e `V1__init.sql` não há índice só sobre `processo.status` ou `pessoa_complementar.descricao_acao`.

---

## financeiro_lancamento.classificacao_financeira_id

- **Leituras no código:**
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:329` (condição `req.getClassificacaoFinanceiraId() != null`)
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:374` (`e.getClassificacaoFinanceiraId()` → DTO de resposta)
- **Escritas no código:**
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:329-330` (`e.setClassificacaoFinanceiraId(req.getClassificacaoFinanceiraId())` quando criação ou request traz o campo não-null)
- **Escritas com valor não-null (critério rigoroso acima):** *(vazia — só passa valor vindo do request; em criação pode ser `null`)*
- **Testes que mencionam:** nenhum em `src/test/` (nem `classificacaoFinanceiraId` nem `classificacao_financeira`).
- **DTOs que expõem:**
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/api/dto/LancamentoFinanceiroWriteRequest.java:65`
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/api/dto/LancamentoFinanceiroResponse.java:38`
  - Mapeamento JPA: `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/infrastructure/persistence/entity/LancamentoFinanceiroEntity.java:83-84`

**Veredicto:** **PODE DROPAR** (no código não há atribuição não-null garantida; uso real em produção com 0 preenchimentos está alinhado).

---

## financeiro_lancamento.elo_financeiro_id

- **Leituras no código:**
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/infrastructure/persistence/repository/LancamentoFinanceiroRepository.java:21-24` (JPQL `l.eloFinanceiroId` com `IS NOT NULL`)
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/infrastructure/persistence/repository/LancamentoFinanceiroRepository.java:40-42` (idem por `numeroBanco`)
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:161-169,176` (consumo dos IDs retornados pelas queries acima)
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:332` (condição), `375` (`e.getEloFinanceiroId()` → resposta)
- **Escritas no código:**
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:178` (`l.setEloFinanceiroId(null)` ao limpar extrato)
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:332-333` (`e.setEloFinanceiroId(req.getEloFinanceiroId())` quando criação ou request traz o campo não-null)
- **Escritas com valor não-null (critério rigoroso):** *(vazia)*
- **Testes que mencionam:** nenhum com `eloFinanceiroId` / `elo_financeiro` em `src/test/`. `FinanceiroApplicationServiceLimparExtratoTest` usa `LancamentoFinanceiroEntity` mas não define elo.
- **DTOs que expõem:**
  - `LancamentoFinanceiroWriteRequest.java:66`
  - `LancamentoFinanceiroResponse.java:39`
  - `LancamentoFinanceiroEntity.java:86-87`
  - Comentários: `FinanceiroApplicationService.java:147`, `LimparExtratoResult.java:14`, `FinanceiroController.java:114`

**Veredicto:** **PODE DROPAR**

---

## financeiro_lancamento.parcela_ref

- **Leituras no código:**
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:317-319` (condição sobre `req.getParcelaRef()` antes de persistir)
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:371` (`e.getParcelaRef()` → resposta)
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/db/migration/MojibakeUtf8DadosRepair.java:80` (coluna na lista de reparo UTF-8; leitura via `ResultSet`)
- **Escritas no código:**
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:317-320` (`setParcelaRef` só string não vazia após `trim`, senão `null`)
  - `MojibakeUtf8DadosRepair` pode **atualizar** a coluna se o texto corrigido diferir do original (continua dependente do valor já gravado no banco).
- **Escritas com valor não-null (critério rigoroso):** *(vazia — não há literal nem default fixo; só input ou correção de valor já existente)*
- **Testes que mencionam:** nenhum (`parcelaRef` / `parcela_ref`).
- **DTOs que expõem:**
  - `LancamentoFinanceiroWriteRequest.java:57`
  - `LancamentoFinanceiroResponse.java:35`
  - `LancamentoFinanceiroEntity.java:74-75`
  - `LimparExtratoResult.java:15` (mencão em comentário)

**Veredicto:** **PODE DROPAR**

---

## financeiro_lancamento.eq_referencia

- **Leituras no código:**
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:313-315` (condição sobre `req.getEqReferencia()`)
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:370` (`e.getEqReferencia()` → resposta)
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/db/migration/MojibakeUtf8DadosRepair.java:79` (coluna na lista de reparo)
- **Escritas no código:**
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:182` (`l.setEqReferencia(null)` no fluxo de limpar extrato)
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/financeiro/application/FinanceiroApplicationService.java:313-316` (`setEqReferencia` só se request com texto; senão `null`)
  - `MojibakeUtf8DadosRepair` (mesma observação que `parcela_ref`).
- **Escritas com valor não-null (critério rigoroso):** *(vazia)*
- **Testes que mencionam:** nenhum (`eqReferencia` / `eq_referencia`).
- **DTOs que expõem:**
  - `LancamentoFinanceiroWriteRequest.java:54`
  - `LancamentoFinanceiroResponse.java:34`
  - `LancamentoFinanceiroEntity.java:71-72`

**Veredicto:** **PODE DROPAR**

---

## processo.status

**Nota:** distinto de `processo_prazo.status` (outra tabela/campo; também aparece em DTOs de prazo).

- **Leituras no código:**
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/processo/application/ProcessoApplicationService.java:744` (`e.getStatus()` → `ProcessoResponse`)
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/db/migration/MojibakeUtf8DadosRepair.java:30` (coluna `status` da tabela `processo` no reparo UTF-8)
  - Entidade: `e-vilareal-java-backend/src/main/java/br/com/vilareal/processo/infrastructure/persistence/entity/ProcessoEntity.java:59-60` (campo `status`; getters/setters Lombok)
- **Escritas no código:**
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/processo/application/ProcessoApplicationService.java:615` (`e.setStatus(trimToNull(req.getStatus()))` em `aplicarCabecalho`)
- **Escritas com valor não-null (critério rigoroso):** *(vazia — `trimToNull` só devolve não-null se o request tiver texto não branco; não há literal nem default fixo para a coluna `processo.status`)*
- **Testes que mencionam:** nenhum assert sobre coluna/Java `ProcessoEntity`/DTO `ProcessoResponse` com nome `status` para cabeçalho de processo. `ApiIntegrationTest` usa `"status"` em **tarefas** e **prazos** (`processo_prazo`), não no POST/GET de cabeçalho de processo. `ProcessosInativarPlanilhaServiceTest` usa `getStatus()` em detalhe de importação (enum), não `processo.status`.
- **DTOs que expõem:**
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/processo/api/dto/ProcessoWriteRequest.java:125-129`
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/processo/api/dto/ProcessoResponse.java:137-142`
  - `README.md` (documentação de API) menciona `status` no corpo do processo — fora de `src/main/java`, listado apenas como contexto.

**Veredicto:** **PODE DROPAR**

---

## pessoa_complementar.descricao_acao

**Nota:** `processo.descricao_acao` e DTOs de processo também usam o nome `descricaoAcao`; aqui só entra a coluna em **`pessoa_complementar`**.

- **Leituras no código:**
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/pessoa/application/PessoaApplicationService.java:318` (`e.getDescricaoAcao()` em `toComplementarPayload`)
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/db/migration/MojibakeUtf8DadosRepair.java:51` (tabela `pessoa_complementar`, coluna `descricao_acao`)
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/pessoa/infrastructure/persistence/entity/PessoaComplementarEntity.java:40-41`
- **Escritas no código:**
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/pessoa/application/PessoaApplicationService.java:164` (`e.setDescricaoAcao(payload.getDescricaoAcao())` — valor vem do payload da API)
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/importacao/InformacoesProcessosImportRowApplier.java:129` (`e.setDescricaoAcao(emptyToNull(descricaoBruta))` em `PessoaComplementarEntity`)
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/pessoa/importacao/CadastroPessoasPlanilhaImporter.java:221-231` (`INSERT ... descricao_acao` com bind `descricaoAcao.isBlank() ? null : descricaoAcao`)
- **Escritas com valor não-null (critério rigoroso):** *(vazia — não há literal atribuído; só dados de API/planilha/import)*
- **Testes que mencionam:** `e-vilareal-java-backend/src/test/java/br/com/vilareal/importacao/InformacoesProcessosImportServiceParseTest.java:67` — `descricaoAcaoOuNull()` no **modelo de parse** da importação (`DadosImportacaoLinha`), não assert contra `pessoa_complementar` no banco. Nenhum `pessoa_complementar` / `PessoaComplementar` em `src/test/`.
- **DTOs que expõem:**
  - `e-vilareal-java-backend/src/main/java/br/com/vilareal/pessoa/api/dto/PessoaComplementarPayload.java:17-18, 75-80` (inclui `blankToNull` no setter)

**Veredicto:** **PODE DROPAR**

---

## Resumo executivo

| Coluna | Escrita não-null garantida em código | Testes `src/test/` ligados ao campo de BD |
|--------|--------------------------------------|-------------------------------------------|
| `financeiro_lancamento.classificacao_financeira_id` | Não | Não |
| `financeiro_lancamento.elo_financeiro_id` | Não | Não |
| `financeiro_lancamento.parcela_ref` | Não | Não |
| `financeiro_lancamento.eq_referencia` | Não | Não |
| `processo.status` | Não | Não |
| `pessoa_complementar.descricao_acao` | Não | Apenas parse de import (`descricaoAcaoOuNull`), não persistência |

**Conclusão Gate 1:** Nenhuma das seis colunas apresenta, no backend Java, **escrita obrigatoriamente não-null** pelo critério acordado. O Gate 2 (remoção em código + migration `V34`) fica **pendente da sua autorização explícita** após revisão deste relatório.
