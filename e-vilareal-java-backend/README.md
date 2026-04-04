# VilaReal API (greenfield)

Backend **Java 21** + **Spring Boot 3.4** com **Pessoa**, **Usuário**, **JWT**, **Flyway** e contratos alinhados ao React (`e-vilareal-react-web`).

## Arquitetura (por domínio)

```
br.com.vilareal
├── common/exception     — tratamento global de erros
├── config               — Security, JWT props, CORS
├── security             — JwtService, filtro, UserDetailsService
├── pessoa/              — cadastro-pessoas, complementares, endereços, contatos, GET /api/clientes
├── processo/            — processos judiciais (paridade Processos.jsx)
├── usuario/             — CRUD usuário, perfis
└── auth/                — login, /me
```

## Stack

- Spring Web, Data JPA, Validation, Security, Actuator  
- Flyway + MySQL 8  
- jjwt  
- springdoc-openapi (habilitado só em **dev** por padrão)  
- Testcontainers (integração; **desabilita automaticamente** se Docker não estiver disponível)  
- Lombok (entidades/DTOs pontuais)

## Como rodar localmente

1. **MySQL** (ou use Docker):

   ```bash
   docker compose up -d
   ```

2. Variáveis opcionais: `DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `SPRING_PROFILES_ACTIVE` (padrão `dev`).

3. Executar:

   ```bash
   ./mvnw spring-boot:run
   ```

4. **Swagger UI** (profile `dev`): http://localhost:8080/swagger-ui.html  
   - Clique em **Authorize** (cadeado), escolha **bearer-jwt** e cole o valor de `accessToken` retornado por `POST /api/auth/login` (só o token, sem a palavra `Bearer`).  
   - `POST /api/auth/login` continua público; os demais endpoints usam o JWT.

5. **Actuator health**: http://localhost:8080/actuator/health  

## Migrations

Scripts em `src/main/resources/db/migration/` (apenas **parametrização** em SQL: `perfil` e `financeiro_conta_contabil`). Não há seed de pessoa/usuário em produção.

| Versão | Conteúdo |
|--------|----------|
| V1 | Núcleo cadastro + inserts em `perfil` (ADMIN / USUARIO) |
| V2–V4 | `agenda_evento`, processos, `auditoria_atividade` |
| V5 | `topico_hierarquia` (tabela vazia; linha id=1 mínima é criada na subida da API) |
| V6 | `tarefa_operacional` |
| V7 | `financeiro_conta_contabil` (inserts padrão) + `financeiro_lancamento` |
| V8 | Cálculos |
| V9–V10 | `planilha_pasta1_cliente`, `cliente` (somente DDL) |
| V11 | Java — correção mojibake UTF-8 |
| V12 | Carga de `pessoa` / complementar / endereço (dados reais) + utilizadores administrativos; login **itamar** / **123456** (entre outros) |

**Testes** (`src/test/resources/db/test-migration/`): **V100** é no-op (`SELECT 1`) para manter o número de versão no histórico Flyway; o utilizador **itamar** para testes vem do **V12** quando este está no classpath.

No **React**, para apagar persistências de demonstração no navegador (sem remover o tema escuro), use no console de desenvolvimento:  
`import('/src/utils/clearLocalMockData.js').then((m) => m.clearLocalMockData({ clearAuth: true }))` — `clearAuth` remove também o JWT da aba.

### Primeiro utilizador (ambiente local)

Após Flyway **sem** V12, crie a primeira pessoa e utilizador pela API (cadastro + `POST /api/usuarios`) ou insira manualmente no MySQL. Com **V12** aplicada, já existem pessoas e utilizadores (incluindo **itamar** / **123456**). Nos testes de integração, o login **itamar** assume dados do **V12**; **V100** não insere mais linhas.

**Checksum Flyway:** se o histórico da base não bater com os ficheiros atuais, use `repair` na ferramenta que utiliza.

## Autenticação JWT

```http
POST /api/auth/login
Content-Type: application/json

{"login":"itamar","senha":"123456"}
```

Resposta inclui `accessToken`. Envie nas demais requisições:

```http
Authorization: Bearer <token>
```

```http
GET /api/auth/me
Authorization: Bearer <token>
```

## Endpoints principais (paridade React)

### Pessoa — núcleo (`clientesService.js`)

| Método | Caminho | Descrição |
|--------|---------|-----------|
| GET | `/api/cadastro-pessoas` | Lista; query: `apenasAtivos`, `nome`, `cpf`, `codigo` (id) |
| GET | `/api/cadastro-pessoas/paginada` | Paginação Spring (`page`, `size`, …) |
| GET | `/api/cadastro-pessoas/proximo-id` | `{ "proximoId": n }` |
| GET | `/api/cadastro-pessoas/{id}` | Detalhe |
| POST | `/api/cadastro-pessoas` | Criar |
| PUT | `/api/cadastro-pessoas/{id}` | Atualizar |
| PATCH | `/api/cadastro-pessoas/{id}/ativo?value=true\|false` | Ativar/inativar |
| DELETE | `/api/cadastro-pessoas/{id}` | Excluir (bloqueado se houver usuário vinculado) |

**JSON:** `nome`, `cpf` (dígitos), `email`, `telefone` (campo “contato” no front), `dataNascimento`, `ativo`, `marcadoMonitoramento`, `responsavelId`.

### Pessoa — complementares / endereços / contatos

| Método | Caminho |
|--------|---------|
| GET/PUT | `/api/pessoas/{id}/complementares` |
| GET/PUT | `/api/pessoas/{id}/enderecos` (body: array) |
| GET/PUT | `/api/pessoas/{id}/contatos` (body: array) |

**Complementares:** `rg`, `orgaoExpedidor`, `profissao`, `nacionalidade`, `estadoCivil`, `genero`.

**Endereço:** `numero`, `rua`, `bairro`, `estado`, `cidade`, `cep`, `autoPreenchido`.

**Contato:** `tipo` (`email`|`telefone`|`website`), `valor`, `dataLancamento`, `dataAlteracao`, `usuario`.

### Clientes — alias Processos (`GET /api/clientes`)

Lista todas as pessoas com `id`, `nome` e **`codigoCliente`** (id formatado em 8 dígitos), usada por `processosRepository.buscarClientePorCodigo`.

### Processos (`processosRepository.js` / `Processos.jsx`)

| Método | Caminho | Descrição |
|--------|---------|-----------|
| GET | `/api/processos?codigoCliente=` | Lista processos do cliente (código 8 dígitos) |
| GET | `/api/processos/{id}` | Detalhe (inclui `codigoCliente`, `clienteId`) |
| POST | `/api/processos` | Criar |
| PUT | `/api/processos/{id}` | Atualizar cabeçalho |
| PATCH | `/api/processos/{id}/ativo?value=true\|false` | Ativar/inativar |
| GET/POST | `/api/processos/{id}/partes` | Partes; POST cria (Location com id) |
| PUT/DELETE | `/api/processos/{id}/partes/{parteId}` | Atualizar / excluir parte |
| GET/POST | `/api/processos/{id}/andamentos` | Andamentos (histórico); ordem: mais recente primeiro |
| PUT/DELETE | `/api/processos/{id}/andamentos/{andamentoId}` | Atualizar / excluir |
| GET/POST | `/api/processos/{id}/prazos` | Prazos |
| PUT | `/api/processos/{id}/prazos/{prazoId}` | Atualizar prazo |

**Corpo do processo (resumo):** `clienteId`, `numeroInterno`, `numeroCnj`, `numeroProcessoAntigo`, `naturezaAcao`, `descricaoAcao`, `competencia`, `fase`, `status`, `tramitacao`, datas (`dataProtocolo`, `prazoFatal`, `proximaConsulta`), `observacao`, `valorCausa`, `uf`, `cidade`, `consultaAutomatica`, `ativo`, `consultor`, `usuarioResponsavelId`.

**Parte:** `pessoaId`, `nomeLivre`, `polo`, `qualificacao`, `ordem`. Resposta inclui `nomeExibicao` (nome da pessoa ou texto livre).

**Andamento:** `movimentoEm` (ISO-8601), `titulo`, `detalhe`, `origem`, `origemAutomatica`, `usuarioId`.

**Prazo:** `andamentoId`, `descricao`, `dataInicio`, `dataFim`, `prazoFatal`, `status`, `observacao`.

### Usuário (`usuariosRepository.js`)

| Método | Caminho |
|--------|---------|
| GET | `/api/usuarios` |
| GET | `/api/usuarios/{id}` |
| POST | `/api/usuarios` |
| PUT | `/api/usuarios/{id}` |
| PATCH | `/api/usuarios/{id}/ativo?value=true\|false` |
| PUT | `/api/usuarios/{id}/perfis` — body JSON **array** de IDs, ex. `[1,2]` |

**Regras:** `pessoaId` obrigatório na criação; `login` único; uma pessoa → no máximo um usuário; senha **nunca** na resposta.  
**Senha:** preferir campo `senha` (texto, mín. 4 caracteres). Campo legado `senhaHash` aceito se for BCrypt (`$2a$`/`$2b$`) ou placeholder `sem-hash-definido` (gera hash aleatório interno).

## Testes

```bash
./mvnw test
```

- **PasswordEncoderSanityTest** — sempre roda (hash do seed).  
- **Testes de integração** (`AbstractIntegrationTest`) — rodam com **Testcontainers** quando Docker está disponível; caso contrário são **ignorados** (`disabledWithoutDocker = true`).

## Decisões rápidas

- **OAuth2-ready:** stateless JWT + `AuthenticationManager`; troca futura para resource server sem reescrever domínio.  
- **Exclusão de pessoa:** impedida se existir `usuarios.pessoa_id` (FK `ON DELETE RESTRICT`).  
- **Perfis:** seed `ADMIN` (1) e `USUARIO` (2).

## Perfis Spring

| Profile | Uso |
|---------|-----|
| `dev` (padrão) | Swagger habilitado |
| `prod` | Swagger desligado (`application-prod.properties`) |
| `test` | Integração + JWT curto |
