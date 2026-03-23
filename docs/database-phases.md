# Plano de implantação por fases (com migração de mocks)

## Premissas

- Banco principal mantido: **MySQL 8.x**
- Backend mantido: **Java 21 + Spring Boot + JPA + Flyway**
- Regra Flyway: **não alterar migrations antigas (V1..V5)**.
- Estratégia: migração incremental por módulo, sem quebra de frontend.

## Estratégia de transição frontend (recomendada)

1. Introduzir endpoint backend por domínio.
2. Criar “adapter” no frontend para alternar fonte (mock/localStorage vs API) por feature flag.
3. Migrar dados legados de localStorage para backend com scripts/rotinas de importação.
4. Após estabilização, manter no localStorage apenas preferências de UI.

## FASE 1 — Consolidar base já existente

- Objetivo:
  - estabilizar módulos já reais: Pessoas, Auditoria, Monitoramento.
- Entidades envolvidas:
  - `cadastro_pessoas`, `auditoria_atividades`, `monitored_*`.
- Dependências:
  - nenhuma nova obrigatória.
- Risco:
  - baixo.
- Benefício prático:
  - base de produção já confiável para próximos módulos.
- Entregas:
  - validação de contratos API atuais;
  - seeds/mineração inicial para testes integrados.

## FASE 2 — Usuários, perfis e permissões (RBAC)

- Objetivo:
  - tirar identidade/autorização do `localStorage`.
- Entidades:
  - `usuarios`, `perfis`, `permissoes`, `usuario_perfil`, `perfil_permissao`.
- Dependências:
  - `cadastro_pessoas` (opcional para vínculo do usuário à pessoa).
- Risco:
  - médio (impacta navegação por permissões no frontend).
- Benefício:
  - controle de acesso real e multiusuário.
- Migração dos mocks:
  - origem: `agendaPersistenciaData.js`, `usuarioPermissoesStorage.js`, `usuarioSenhaHash.js`
  - endpoints novos: `GET/POST/PATCH /api/usuarios`, `GET/PUT /api/permissoes`
  - transição: fallback local enquanto usuário não migrado.

## FASE 3 — Pessoas complementares, clientes e agenda

- Objetivo:
  - estruturar cadastro operacional completo.
- Entidades:
  - `pessoa_enderecos`, `pessoa_contatos`, `pessoa_dados_civis`, `clientes`, `agenda_eventos`.
- Dependências:
  - Fase 2 para autoria e usuário executor.
- Risco:
  - médio.
- Benefício:
  - remove armazenamento local de dados cadastrais e agenda.
- Migração dos mocks:
  - origem: `cadastroClientesStorage.js`, `agendaPersistenciaData.js`, `ModalEnderecos/ModalContatos`
  - endpoints novos:
    - `/api/clientes`
    - `/api/pessoas/{id}/enderecos`
    - `/api/pessoas/{id}/contatos`
    - `/api/agenda/eventos`

## FASE 4 — Processos, partes, andamentos e prazos

- Objetivo:
  - criar núcleo jurídico central.
- Entidades:
  - `processos`, `processo_partes`, `processo_andamentos`, `processo_prazos`.
- Dependências:
  - clientes e pessoas já modelados.
- Risco:
  - alto (muito acoplamento com telas de Processos/Diagnósticos/Relatórios).
- Benefício:
  - base única para consultas, prazos e histórico.
- Migração dos mocks:
  - origem: `processosHistoricoData.js`, `processosMock.js`, `processosDadosRelatorio.js`
  - endpoints novos:
    - `/api/processos`
    - `/api/processos/{id}/partes`
    - `/api/processos/{id}/andamentos`
    - `/api/processos/{id}/prazos`
  - transição:
    - leitura híbrida inicial (backend + fallback local para não migrados)
    - rotina de import por chave `codCliente:proc`.

## FASE 5 — Financeiro transacional

- Objetivo:
  - migrar extratos/lançamentos/vínculos para banco.
- Entidades:
  - `contas_bancarias`, `contas_contabeis`, `lancamentos_financeiros`, `lancamento_anexos`.
- Dependências:
  - processos e clientes já estáveis.
- Risco:
  - alto (dados críticos de conciliação e relatórios).
- Benefício:
  - integridade transacional e rastreabilidade financeira.
- Migração dos mocks:
  - origem: `financeiroData.js`, `consultasVinculoHistoricoStorage.js`
  - endpoints novos:
    - `/api/financeiro/contas-bancarias`
    - `/api/financeiro/contas-contabeis`
    - `/api/financeiro/lancamentos`
    - `/api/financeiro/consolidado`
  - transição:
    - migrador por lote de chaves v20;
    - manter import OFX no frontend inicialmente, salvando no backend.

## FASE 6 — Publicações e documentos/anexos

- Objetivo:
  - persistência oficial de publicações e arquivos.
- Entidades:
  - `publicacoes`, `publicacao_divergencias`, `anexos`.
- Dependências:
  - processos/clientes e usuários prontos.
- Risco:
  - médio-alto (pipeline de importação e vínculo).
- Benefício:
  - revisão colaborativa, histórico e evidência persistente.
- Migração dos mocks:
  - origem: `publicacoesStorage.js`, `pessoaDocumentoService.js`
  - endpoints novos:
    - `/api/publicacoes`
    - `/api/publicacoes/{id}/vinculo`
    - `/api/anexos` (upload assinado + metadados)
  - estratégia de arquivo:
    - arquivo em storage externo;
    - SQL apenas metadados e relacionamento.

## FASE 7 — Imóveis, contratos e repasses

- Objetivo:
  - consolidar administração de imóveis em backend real.
- Entidades:
  - `imoveis`, `contratos_locacao`, `repasses_locacao`, `despesas_administrativas_imovel`.
- Dependências:
  - financeiro e processos.
- Risco:
  - médio.
- Benefício:
  - relatórios e cálculo de repasse confiáveis no servidor.
- Migração dos mocks:
  - origem: `imoveisMockData.js`, `imoveisAdministracaoFinanceiro.js`
  - endpoints novos:
    - `/api/imoveis`
    - `/api/imoveis/{id}/contratos`
    - `/api/imoveis/{id}/repasses`

---

## Ordem ideal de construção de tabelas

1. Segurança/acesso (`usuarios`, `perfis`, `permissoes`)
2. Pessoa complementar + `clientes`
3. `processos` e subentidades
4. Financeiro
5. Publicações + anexos
6. Imóveis + contratos/repasses

## Tabelas prioritárias imediatas

- `usuarios`
- `perfis`
- `permissoes`
- `clientes`
- `processos`
- `processo_partes`
- `processo_andamentos`
- `processo_prazos`

## Principais riscos de modelagem por fase

- Duplicidade de chaves legadas (`codCliente`/`proc` em texto) durante migração.
- Divergência entre campos ricos do frontend e schema mínimo do backend.
- Migração de dados binários em base64.
- Compatibilidade de UX durante coexistência mock/API.

## Próximo passo técnico recomendado

- Congelar dicionário de dados mínimo da **Fase 2 e Fase 3** e implementar as migrations `V6` e `V7` primeiro, com endpoints de leitura/escrita e feature flags de migração no frontend.
