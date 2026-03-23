# Dicionário de dados - Fase 6 (Publicações completas)

Base obrigatória revisada: inventários, gap analysis, entidades propostas, fases anteriores e código real de `PublicacoesProcessos.jsx`, parser/pipeline DataJud, `publicacoesStorage.js` e módulo de monitoramento backend.

## Legenda de rigor

- **encontrado no código**: evidência direta no frontend/backend atual.
- **inferido**: necessário para fechar fluxo operacional sem automação pesada.
- **recomendado**: decisão pragmática para evolução segura.
- **implementado**: entregue em `V12`/`V13` e backend desta fase.
- **pendente**: fica para fase futura.

---

## Tabela `publicacoes` (V12) - **implementado**

Finalidade: persistência central de publicação importada (dado bruto + enriquecimento + estado operacional), com vínculo opcional a processo/cliente/usuário/hit de monitoramento e deduplicação técnica.

| Campo | Tipo SQL | Null | Default | Unique | FK | Índice | Origem da decisão | Regra de negócio |
|---|---|---|---|---|---|---|---|---|
| `id` | BIGINT | não | auto_increment | PK | — | — | recomendado | chave técnica |
| `numero_processo_encontrado` | VARCHAR(32) | não | — | não | — | sim | encontrado no código | CNJ/identificador extraído da publicação |
| `processo_id` | BIGINT | sim | — | não | `processos(id)` | sim | encontrado + recomendado | vínculo forte quando processo interno for conhecido |
| `cliente_id` | BIGINT | sim | — | não | `clientes(id)` | sim | encontrado + recomendado | pode ser derivado de `processo_id` no service |
| `usuario_responsavel_id` | BIGINT | sim | — | não | `usuarios(id)` | sim | inferido | responsável operacional atual |
| `monitoring_hit_id` | BIGINT | sim | — | não | `monitoring_hits(id)` | sim | encontrado + recomendado | rastreia origem por monitoramento sem acoplamento rígido |
| `data_disponibilizacao` | DATE | sim | — | não | — | — | encontrado no código | data de disponibilização do diário |
| `data_publicacao` | DATE | sim | — | não | — | sim | encontrado no código | data oficial de publicação |
| `fonte` | VARCHAR(120) | sim | — | não | — | — | inferido | fonte geral de ingestão |
| `diario` | VARCHAR(200) | sim | — | não | — | — | encontrado no código | nome textual do diário |
| `edicao` | VARCHAR(80) | sim | — | não | — | — | inferido | metadado opcional de diário |
| `caderno` | VARCHAR(120) | sim | — | não | — | — | inferido | metadado opcional de diário |
| `pagina` | VARCHAR(40) | sim | — | não | — | — | inferido | metadado opcional de diário |
| `titulo` | VARCHAR(255) | sim | — | não | — | — | inferido | resumo curto para listagem |
| `tipo_publicacao` | VARCHAR(80) | sim | — | não | — | — | encontrado no código | classificação heurística atual (intimação/sentença/etc.) |
| `resumo` | TEXT | sim | — | não | — | — | encontrado no código | resumo operacional |
| `teor` | LONGTEXT | não | — | não | — | — | encontrado no código | teor bruto principal (não substituir por DataJud) |
| `status_validacao_cnj` | VARCHAR(40) | sim | — | não | — | — | encontrado no código | confirma/diverge/indisponível na camada CNJ |
| `score_confianca` | VARCHAR(16) | sim | — | não | — | — | encontrado no código | alto/médio/baixo (heurístico) |
| `hash_teor` | VARCHAR(128) | não | — | não | — | — | encontrado no código | hash do teor normalizado |
| `hash_conteudo` | VARCHAR(128) | não | — | sim | — | implícito | recomendado + implementado | chave técnica de deduplicação única |
| `origem_importacao` | VARCHAR(40) | não | `MANUAL` | não | — | sim | recomendado | enum operacional (MANUAL/PDF/DATAJUD/MONITORAMENTO) |
| `arquivo_origem_nome` | VARCHAR(255) | sim | — | não | — | — | encontrado no código | nome do arquivo de origem |
| `arquivo_origem_hash` | VARCHAR(128) | sim | — | não | — | — | encontrado no código | hash do arquivo de origem |
| `json_referencia` | LONGTEXT | sim | — | não | — | — | encontrado + recomendado | payload técnico (DataJud/log) |
| `status_tratamento` | VARCHAR(30) | não | `PENDENTE` | não | — | sim | recomendado + implementado | enum: `PENDENTE`, `VINCULADA`, `TRATADA`, `IGNORADA` |
| `lida` | BOOLEAN | não | FALSE | não | — | — | inferido | marcação operacional de leitura |
| `lida_em` | TIMESTAMP | sim | — | não | — | — | inferido | timestamp de leitura |
| `tratada_em` | TIMESTAMP | sim | — | não | — | — | inferido | timestamp de tratamento efetivo |
| `ignorada_em` | TIMESTAMP | sim | — | não | — | — | inferido | timestamp de descarte operacional |
| `observacao` | TEXT | sim | — | não | — | — | encontrado + inferido | observação manual |
| `created_at` | TIMESTAMP | não | now | não | — | — | recomendado | trilha temporal |
| `updated_at` | TIMESTAMP | não | now on update | não | — | — | recomendado | trilha temporal |

### Regras de negócio implementadas

- Se `processo_id` e `cliente_id` vierem juntos, o backend valida coerência (processo deve pertencer ao cliente).
- Se vier `processo_id` sem `cliente_id`, o backend deriva o cliente automaticamente.
- `hash_conteudo` é único para deduplicação de persistência.
- Status de tratamento atualiza timestamps de apoio (`tratada_em`, `ignorada_em`, etc.) quando aplicável.

---

## Tabela `publicacoes_tratamentos` (V13) - **implementado**

Finalidade: histórico técnico de tratamento para rastrear mudanças de status/vínculo e preparar geração futura de andamento/prazo/tarefa sem automação completa nesta fase.

| Campo | Tipo SQL | Null | Default | Unique | FK | Índice | Origem da decisão | Regra de negócio |
|---|---|---|---|---|---|---|---|---|
| `id` | BIGINT | não | auto_increment | PK | — | — | recomendado | chave técnica |
| `publicacao_id` | BIGINT | não | — | não | `publicacoes(id)` | sim | recomendado + implementado | histórico pertence a uma publicação |
| `status_anterior` | VARCHAR(30) | sim | — | não | — | — | recomendado | permite trilha de transição |
| `status_novo` | VARCHAR(30) | não | — | não | — | sim | recomendado | estado resultante |
| `acao` | VARCHAR(40) | não | — | não | — | sim | recomendado | tipo de ação (`STATUS`, `VINCULO_PROCESSO`, etc.) |
| `descricao` | VARCHAR(500) | sim | — | não | — | — | inferido | contexto da alteração |
| `processo_id` | BIGINT | sim | — | não | `processos(id)` | — | recomendado | snapshot de vínculo processual |
| `cliente_id` | BIGINT | sim | — | não | `clientes(id)` | — | recomendado | snapshot de vínculo cliente |
| `usuario_id` | BIGINT | sim | — | não | `usuarios(id)` | sim | recomendado | autoria da ação |
| `andamento_gerado` | BOOLEAN | não | FALSE | não | — | — | recomendado | pronto para automação futura |
| `prazo_gerado` | BOOLEAN | não | FALSE | não | — | — | recomendado | pronto para automação futura |
| `tarefa_gerada` | BOOLEAN | não | FALSE | não | — | — | recomendado | pronto para automação futura |
| `metadados_json` | JSON | sim | — | não | — | — | inferido | anotações técnicas por ação |
| `created_at` | TIMESTAMP | não | now | não | — | sim composto com publicação | recomendado | trilha temporal de histórico |

### Regras de negócio implementadas

- Cada mudança relevante de status/vínculo gera registro de histórico.
- Histórico não substitui a tabela principal; complementa rastreabilidade.

---

## Relação entre publicação, processo, cliente e monitoramento

- **implementado**: `publicacoes.processo_id` opcional (vínculo forte).
- **implementado**: `publicacoes.cliente_id` opcional, podendo ser derivado do processo.
- **implementado**: `publicacoes.monitoring_hit_id` opcional para rastreio de origem técnica.
- **recomendado**: manter `numero_processo_encontrado` sempre preenchido mesmo sem vínculo interno, para suportar fluxo progressivo (importação -> triagem -> vínculo).

---

## Decisão de status/tratamento operacional

- **implementado**: enum simples na publicação (`PENDENTE`, `VINCULADA`, `TRATADA`, `IGNORADA`) + histórico técnico em `publicacoes_tratamentos`.
- **recomendado**: essa combinação entrega operação diária sem exagero de tabelas catálogo.
- **pendente**: catálogo parametrizável de status/motivos (apenas se volume justificar).

---

## Preparação para automação futura (sem implementar automação total agora)

- **implementado**: estrutura de histórico com flags de geração (`andamento_gerado`, `prazo_gerado`, `tarefa_gerada`).
- **implementado**: patch de vínculo e patch de status no backend para orquestração futura.
- **pendente**: criação automática de `processo_andamentos`/`processo_prazos`/tarefas a partir de regras.
