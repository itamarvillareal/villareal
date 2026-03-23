# Dicionário de dados — Fase 2 e Fase 3

## Escopo

- **Fase 2:** usuários, perfis, permissões.
- **Fase 3:** clientes, complementos de pessoa e agenda mínima.
- Banco-alvo: **MySQL 8.x**
- Backend-alvo: **Spring Boot + JPA + Flyway**

## Decisão de integração com `cadastro_pessoas`

- **Encontrado no código:** `cadastro_pessoas` já é entidade central e está em produção do backend.
- **Recomendado:** manter `cadastro_pessoas` como tabela principal de pessoa, sem quebra de contrato dos endpoints atuais.
- **Recomendado:** complementar dados em tabelas auxiliares (`pessoa_dados_complementares`) para evitar alteração disruptiva no CRUD existente.
- **Recomendado:** `clientes.pessoa_id` como FK opcional para `cadastro_pessoas.id` (cliente pode ser vinculado a pessoa existente).
- **Inferido:** usuários do sistema podem ou não estar vinculados a uma pessoa; por isso `usuarios.pessoa_id` opcional.

---

## Tabela: `usuarios`

- Finalidade: identidade persistida dos operadores do sistema.
- Origem da decisão:
  - **Encontrado:** módulo de usuários hoje em localStorage (`agendaPersistenciaData`, `Usuarios.jsx`).
  - **Inferido:** necessidade de login/ativo/perfil para evoluir segurança.
  - **Recomendado:** persistir no backend para substituir armazenamento local.

| Campo | Tipo SQL | Null | Default | Unique | Regra |
|---|---|---|---|---|---|
| `id` | `BIGINT` | não | auto_increment | PK | identificador técnico |
| `pessoa_id` | `BIGINT` | sim | - | não | FK para `cadastro_pessoas.id` |
| `nome` | `VARCHAR(255)` | não | - | não | nome operacional |
| `apelido` | `VARCHAR(120)` | sim | - | não | nome de exibição curto |
| `login` | `VARCHAR(120)` | não | - | sim | login único |
| `senha_hash` | `VARCHAR(255)` | não | - | não | hash de senha (não plaintext) |
| `ativo` | `BOOLEAN` | não | `TRUE` | não | ativação/inativação |
| `ultimo_login_em` | `DATETIME` | sim | - | não | uso futuro |
| `created_at` | `TIMESTAMP` | não | `CURRENT_TIMESTAMP` | não | auditoria técnica |
| `updated_at` | `TIMESTAMP` | não | `CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` | não | auditoria técnica |

Índices:
- `uk_usuarios_login (login)`
- `idx_usuarios_pessoa_id (pessoa_id)`
- `idx_usuarios_ativo (ativo)`

FKs:
- `fk_usuarios_pessoa` → `cadastro_pessoas(id)` (`ON DELETE SET NULL`)

---

## Tabela: `perfis`

- Finalidade: agrupamento funcional de permissões.
- Origem:
  - **Encontrado:** permissões por módulo no frontend (`usuarioPermissoesStorage`).
  - **Recomendado:** implementar RBAC básico.

| Campo | Tipo SQL | Null | Default | Unique |
|---|---|---|---|---|
| `id` | `BIGINT` | não | auto_increment | PK |
| `codigo` | `VARCHAR(80)` | não | - | sim |
| `nome` | `VARCHAR(120)` | não | - | não |
| `descricao` | `VARCHAR(500)` | sim | - | não |
| `ativo` | `BOOLEAN` | não | `TRUE` | não |
| `created_at` | `TIMESTAMP` | não | current_timestamp | não |
| `updated_at` | `TIMESTAMP` | não | current_timestamp on update | não |

Índices:
- `uk_perfis_codigo`
- `idx_perfis_ativo`

---

## Tabela: `permissoes`

- Finalidade: catálogo de ações/módulos autorizáveis.
- Origem:
  - **Encontrado:** `MODULOS_PERMISSAO` e checagens por módulo no frontend.
  - **Recomendado:** catálogo relacional para perfil.

| Campo | Tipo SQL | Null | Default | Unique |
|---|---|---|---|---|
| `id` | `BIGINT` | não | auto_increment | PK |
| `codigo` | `VARCHAR(120)` | não | - | sim |
| `modulo` | `VARCHAR(120)` | não | - | não |
| `descricao` | `VARCHAR(500)` | sim | - | não |
| `created_at` | `TIMESTAMP` | não | current_timestamp | não |
| `updated_at` | `TIMESTAMP` | não | current_timestamp on update | não |

Índices:
- `uk_permissoes_codigo`
- `idx_permissoes_modulo`

---

## Tabela: `usuario_perfil` (ligação N:N)

- Finalidade: associar usuário a perfil.
- Origem:
  - **Recomendado** por desenho RBAC.

| Campo | Tipo SQL | Null | Default | Unique |
|---|---|---|---|---|
| `usuario_id` | `BIGINT` | não | - | PK composta |
| `perfil_id` | `BIGINT` | não | - | PK composta |
| `created_at` | `TIMESTAMP` | não | current_timestamp | não |

FKs:
- `fk_usuario_perfil_usuario` → `usuarios(id)` (`ON DELETE CASCADE`)
- `fk_usuario_perfil_perfil` → `perfis(id)` (`ON DELETE CASCADE`)

Índices:
- `idx_usuario_perfil_perfil`

---

## Tabela: `perfil_permissao` (ligação N:N)

- Finalidade: associar perfil a permissões.

| Campo | Tipo SQL | Null | Default | Unique |
|---|---|---|---|---|
| `perfil_id` | `BIGINT` | não | - | PK composta |
| `permissao_id` | `BIGINT` | não | - | PK composta |
| `created_at` | `TIMESTAMP` | não | current_timestamp | não |

FKs:
- `fk_perfil_permissao_perfil` → `perfis(id)` (`ON DELETE CASCADE`)
- `fk_perfil_permissao_permissao` → `permissoes(id)` (`ON DELETE CASCADE`)

Índices:
- `idx_perfil_permissao_permissao`

---

## Tabela: `clientes`

- Finalidade: cadastro formal de cliente para módulos jurídicos/financeiros.
- Origem:
  - **Encontrado:** `CadastroClientes.jsx` + `cadastroClientesStorage.js` usam código de cliente e dados essenciais.
  - **Recomendado:** consolidar no backend para substituir persistência local.

| Campo | Tipo SQL | Null | Default | Unique | Regra |
|---|---|---|---|---|---|
| `id` | `BIGINT` | não | auto_increment | PK | identificador técnico |
| `codigo_cliente` | `VARCHAR(8)` | não | - | sim | código externo de cliente |
| `pessoa_id` | `BIGINT` | sim | - | não | vínculo opcional com pessoa |
| `nome_referencia` | `VARCHAR(255)` | não | - | não | nome comercial/exibição |
| `documento_referencia` | `VARCHAR(20)` | sim | - | não | CPF/CNPJ de referência |
| `observacao` | `TEXT` | sim | - | não | anotação |
| `inativo` | `BOOLEAN` | não | `FALSE` | não | status |
| `created_at` | `TIMESTAMP` | não | current_timestamp | não | técnico |
| `updated_at` | `TIMESTAMP` | não | current_timestamp on update | não | técnico |

FKs:
- `fk_clientes_pessoa` → `cadastro_pessoas(id)` (`ON DELETE SET NULL`)

Índices:
- `uk_clientes_codigo_cliente`
- `idx_clientes_pessoa_id`
- `idx_clientes_inativo`
- `idx_clientes_nome_referencia`

---

## Tabela: `pessoa_dados_complementares`

- Finalidade: complementar `cadastro_pessoas` sem quebrar API atual.
- Origem:
  - **Encontrado:** campos adicionais em `CadastroPessoas.jsx` (rg, órgão, profissão, nacionalidade, estado civil, gênero).
  - **Recomendado:** tabela 1:1 com pessoa.

| Campo | Tipo SQL | Null | Default | Unique |
|---|---|---|---|---|
| `pessoa_id` | `BIGINT` | não | - | PK/FK |
| `rg` | `VARCHAR(30)` | sim | - | não |
| `orgao_expedidor` | `VARCHAR(40)` | sim | - | não |
| `profissao` | `VARCHAR(120)` | sim | - | não |
| `nacionalidade` | `VARCHAR(120)` | sim | - | não |
| `estado_civil` | `VARCHAR(40)` | sim | - | não |
| `genero` | `VARCHAR(20)` | sim | - | não |
| `created_at` | `TIMESTAMP` | não | current_timestamp | não |
| `updated_at` | `TIMESTAMP` | não | current_timestamp on update | não |

FK:
- `fk_pessoa_dados_complementares` → `cadastro_pessoas(id)` (`ON DELETE CASCADE`)

---

## Tabela: `agenda_eventos` (agenda mínima)

- Finalidade: substituir persistência local crítica de compromissos.
- Origem:
  - **Encontrado:** uso real de agenda no frontend (`Agenda.jsx`, `agendaPersistenciaData.js`).
  - **Inferido:** recorrência complexa pode ficar para fase posterior.
  - **Recomendado:** agenda mínima com evento simples por data/hora/usuário.

| Campo | Tipo SQL | Null | Default | Unique | Regra |
|---|---|---|---|---|---|
| `id` | `BIGINT` | não | auto_increment | PK | identificador |
| `usuario_id` | `BIGINT` | não | - | não | dono do evento |
| `data_evento` | `DATE` | não | - | não | data agenda |
| `hora_evento` | `TIME` | sim | - | não | opcional |
| `descricao` | `TEXT` | não | - | não | compromisso |
| `status_curto` | `VARCHAR(10)` | sim | - | não | `OK` ou vazio |
| `processo_ref` | `VARCHAR(80)` | sim | - | não | referência textual temporária |
| `origem` | `VARCHAR(40)` | sim | `'MANUAL'` | não | origem da criação |
| `created_at` | `TIMESTAMP` | não | current_timestamp | não | técnico |
| `updated_at` | `TIMESTAMP` | não | current_timestamp on update | não | técnico |

FK:
- `fk_agenda_eventos_usuario` → `usuarios(id)` (`ON DELETE CASCADE`)

Índices:
- `idx_agenda_usuario_data (usuario_id, data_evento)`
- `idx_agenda_data (data_evento)`
- `idx_agenda_status_curto (status_curto)`

---

## Regras de negócio relevantes destas fases

1. `usuarios.login` deve ser único.
2. Usuário pode estar sem vínculo com pessoa (`pessoa_id` null) no início da migração.
3. Perfil e permissão são catálogos; as regras efetivas vêm das tabelas de ligação.
4. Cliente pode existir sem pessoa vinculada, mas deve aceitar vínculo posterior.
5. Dados complementares de pessoa são opcionais, 1:1 por `pessoa_id`.
6. Agenda mínima não implementa recorrência avançada nesta fase.

---

## Observações finais (rigor)

- **Encontrado no código:** necessidade real de usuários/permissões/clientes/agenda e de campos extras de pessoa.
- **Inferido:** parte de autenticação robusta (JWT/OAuth) pode vir depois; não é requisito desta fase.
- **Recomendado:** entregar V6 e V7 com essas tabelas e endpoints administrativos mínimos antes de avançar para processos/financeiro.
