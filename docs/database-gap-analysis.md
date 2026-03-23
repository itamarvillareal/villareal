# Gap analysis: backend x frontend (MySQL + Spring atual)

## Critérios

- **Grupo A:** já existe no backend e está razoavelmente modelado.
- **Grupo B:** frontend usa, mas backend ainda não existe corretamente.
- **Grupo C:** existe parcialmente e precisa ajuste estrutural.

## Grupo A — já existe e está razoavelmente modelado

| Módulo/entidade | Status atual | Problema encontrado | Ação recomendada |
|---|---|---|---|
| Pessoas (`cadastro_pessoas`) | CRUD real com validações e auditoria interna | Cobertura parcial dos campos de ficha de pessoa | Manter base atual e evoluir por novas migrations (sem quebrar contratos existentes) |
| Auditoria (`auditoria_atividades`) | API paginada e filtros reais | Tipos de ação ainda string livre | Padronizar catálogo de tipos/enum em etapa posterior |
| Monitoramento CNJ | Módulo completo com pessoas monitoradas, runs, hits e settings | `linked_process_id`/`linked_client_id` ainda sem FK real para tabelas de processos/clientes | Após criar tabelas de processo/cliente, adicionar FKs em migration nova |

## Grupo B — frontend usa, backend ainda não existe corretamente

| Módulo/entidade | Status atual | Problema encontrado | Ação recomendada |
|---|---|---|---|
| Usuários | Dados no `localStorage` (apelido/login/senhaHash/numeroPessoa) | Sem tabela, sem autenticação de servidor, sem gestão de senha segura | Criar `usuarios`, `perfis`, `permissoes` e autenticação backend |
| Permissões por módulo | Mapa local por usuário | Sem governança server-side | Criar RBAC com `usuario_perfil` e `perfil_permissao` |
| Agenda | Eventos e recorrências locais | Sem persistência central/multiusuário | Criar `agenda_eventos` e regras mínimas de recorrência |
| Cadastro de Clientes | Persistido por código de cliente no navegador | Sem tabela de clientes formal no backend | Criar `clientes` (1:1 com pessoa quando aplicável) |
| Processos e partes | Dados e histórico no localStorage | Núcleo jurídico sem persistência oficial | Criar `processos`, `processo_partes`, `andamentos`, `prazos` |
| Financeiro | Extratos/lançamentos e classificação local | Dados financeiros críticos sem transação no servidor | Criar modelo financeiro relacional + endpoints |
| Publicações importadas | Persistência local com dedup/score/vínculo | Sem base central para revisão/colaboração | Criar tabela de publicações e revisão; manter pipeline de parsing |
| Imóveis e contratos | Mock completo no frontend | Sem backend para imóveis/locação/repasse | Criar módulo de imóveis + contratos + repasses |
| Documentos/anexos | Base64 em localStorage | Risco alto de perda/limite de armazenamento | Criar metadados SQL + storage externo para binários |

## Grupo C — parcial, precisa ajuste estrutural

| Módulo/entidade | Status atual | Problema encontrado | Ação recomendada |
|---|---|---|---|
| Pessoa (campos complementares) | Backend tem núcleo; frontend exibe mais campos | Divergência de schema entre ficha frontend e entidade backend | Adicionar colunas/tabelas satélite (`pessoa_dados_civis`, `pessoa_enderecos`, `pessoa_contatos`) |
| Relação pessoa x cliente | Front usa código de cliente e vínculos mock | Não há camada oficial de cliente jurídico/financeiro | Definir `clientes` com identidade própria e vínculo opcional a pessoa |
| Monitoramento hit → processo/cliente | Campos numéricos já existem | Hoje são IDs “soltos”, sem integridade referencial | Criar FKs após módulo processos/clientes |
| Documento de pessoa | Front permite upload e leitura | Sem backend de documentos | Criar `documentos`/`anexos` com versionamento básico |
| Relatórios e presets | Parte em localStorage | Mistura de preferência de UI com dado de negócio em alguns fluxos | Separar: preferência local vs. persistência de negócio no banco |

## Dependências entre módulos (ordem técnica)

1. `usuarios/perfis/permissoes` depende de `cadastro_pessoas` (opcionalmente).
2. `clientes` depende de `cadastro_pessoas` (vínculo recomendado).
3. `processos` depende de `clientes` e `pessoas`.
4. `publicacoes` depende de `processos`/`clientes` para vinculação forte.
5. `financeiro` depende de `clientes` + `processos` (chaves de vínculo).
6. `imoveis/contratos/repasses` depende de `clientes`, `pessoas` e (em muitos casos) `processos`.
7. `documentos/anexos` depende de estratégia de storage externa + vínculo com entidades-alvo.

## Riscos de integração identificados

### Encontrado no código

- Frontend já opera com muitos dados em estado local e chaves variadas de storage.
- Há campos ricos no frontend sem contrapartida no backend.
- Forte acoplamento a códigos textuais de cliente/processo em finance/publicações.

### Recomendado

- Introduzir camadas no backend por fase com contratos REST compatíveis.
- Usar feature-flag por módulo para transição (já existe padrão `VITE_USE_MOCK_CADASTRO_PESSOAS`).
- Evitar “big bang migration”; migrar módulo a módulo com fallback controlado.
