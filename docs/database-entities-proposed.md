# Entidades propostas (modelagem relacional definitiva em MySQL 8)

## Regras de modelagem aplicadas

- Padrão `snake_case`
- PK `bigint` autoincrement
- FKs explícitas com integridade referencial
- Tabelas N:N para vínculos
- `json` somente quando necessário (flags/config dinâmica)
- Separação entre:
  - entidades principais
  - catálogos/auxiliares
  - ligações
  - auditoria/eventos

## Legenda de rigor

- **Encontrado:** já existe no código atual.
- **Inferido:** necessário por comportamento do frontend.
- **Recomendado:** decisão de modelagem para implantação segura.

---

## 1) Núcleo de identidade e acesso

## `usuarios` (recomendado)

- Finalidade: autenticação e identidade operacional.
- Campos sugeridos:
  - `id bigint pk`
  - `pessoa_id bigint null fk -> cadastro_pessoas.id`
  - `login varchar(120) not null unique`
  - `senha_hash varchar(255) not null`
  - `apelido varchar(120) null`
  - `ativo boolean not null default true`
  - `ultimo_login_em datetime null`
  - `created_at`, `updated_at`
- Índices: `uk_usuarios_login`, `idx_usuarios_pessoa_id`, `idx_usuarios_ativo`
- Observação: migrar `senhaHash` local para hash forte no servidor (bcrypt/argon2).

## `perfis` (recomendado)

- Campos: `id`, `codigo unique`, `nome`, `descricao`, `ativo`, timestamps

## `permissoes` (recomendado)

- Campos: `id`, `codigo unique`, `modulo`, `descricao`

## `usuario_perfil` (recomendado)

- N:N usuários x perfis
- PK composta (`usuario_id`, `perfil_id`)

## `perfil_permissao` (recomendado)

- N:N perfis x permissões
- PK composta (`perfil_id`, `permissao_id`)

---

## 2) Pessoas e dados complementares

## `cadastro_pessoas` (encontrado + recomendado evoluir)

- Já existe no backend.
- Evoluções recomendadas (novas migrations):
  - manter colunas atuais
  - adicionar `tipo_pessoa` (`FISICA`/`JURIDICA`) para eliminar heurística por tamanho de CPF/CNPJ
  - avaliar separar documento principal em `documento_principal`

## `pessoa_enderecos` (inferido + recomendado)

- Finalidade: múltiplos endereços por pessoa.
- Campos:
  - `id`, `pessoa_id fk`, `tipo_endereco` (`RESIDENCIAL`, `COMERCIAL`, etc.)
  - `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`, `pais`
  - `principal boolean`
  - timestamps
- Índices: `idx_pessoa_enderecos_pessoa`, `idx_pessoa_enderecos_principal`

## `pessoa_contatos` (inferido + recomendado)

- Campos:
  - `id`, `pessoa_id fk`, `tipo_contato` (`TELEFONE`, `EMAIL`, `WHATSAPP`, etc.)
  - `valor`, `observacao`, `principal`, timestamps
- Índices: `idx_pessoa_contatos_pessoa`, `idx_pessoa_contatos_tipo`

## `pessoa_dados_civis` (inferido + recomendado)

- Finalidade: campos hoje só no frontend (rg, órgão expedidor, estado civil, profissão, nacionalidade, gênero).
- Campos:
  - `pessoa_id pk/fk`
  - `rg`, `orgao_expedidor`, `estado_civil`, `profissao`, `nacionalidade`, `genero`
  - timestamps

---

## 3) Clientes

## `clientes` (inferido + recomendado)

- Finalidade: identidade jurídico-financeira por código de cliente.
- Campos:
  - `id`, `codigo_cliente varchar(8) unique not null`
  - `pessoa_id fk null` (quando cliente representa pessoa já cadastrada)
  - `nome_referencia varchar(255) not null`
  - `documento_referencia varchar(20) null`
  - `observacao text null`
  - `inativo boolean not null default false`
  - timestamps
- Índices: `uk_clientes_codigo_cliente`, `idx_clientes_pessoa_id`, `idx_clientes_inativo`

---

## 4) Processos e jurídico

## `processos` (inferido + recomendado)

- Finalidade: núcleo processual.
- Campos:
  - `id`
  - `cliente_id fk not null`
  - `numero_interno int not null` (proc do cliente)
  - `numero_cnj varchar(32) null`
  - `numero_processo_antigo varchar(64) null`
  - `natureza_acao varchar(255) null`
  - `valor_causa decimal(15,2) null`
  - `uf char(2) null`, `cidade varchar(120) null`, `comarca varchar(160) null`
  - `orgao_julgador varchar(255) null`
  - `status_processo varchar(50) null`
  - `consulta_automatica boolean default false`
  - `prazo_fatal date null`
  - timestamps
- Unicidade:
  - `uk_processo_cliente_numero_interno (cliente_id, numero_interno)`
  - `uk_processo_numero_cnj` (quando preenchido, índice único parcial via regra de aplicação)
- Índices:
  - `idx_processo_cliente`, `idx_processo_cnj`, `idx_processo_prazo_fatal`, `idx_processo_status`

## `processo_partes` (inferido + recomendado)

- Finalidade: N:N processo x pessoas + papel na relação processual.
- Campos:
  - `id`, `processo_id fk`, `pessoa_id fk`
  - `papel enum('PARTE_CLIENTE','PARTE_OPOSTA','OUTRA')`
  - `ordem int default 0`
  - timestamps
- Índices: `idx_proc_partes_processo`, `idx_proc_partes_pessoa`, `uk_proc_parte_unica (processo_id,pessoa_id,papel)`

## `processo_andamentos` (inferido + recomendado)

- Campos:
  - `id`, `processo_id fk`, `data_andamento date`, `descricao text`, `usuario_id fk null`, `tipo_andamento`
  - `numero_referencia varchar(40) null`
  - timestamps
- Índices: `idx_andamentos_processo_data`, `idx_andamentos_usuario`

## `processo_prazos` (inferido + recomendado)

- Campos:
  - `id`, `processo_id fk`, `tipo_prazo`, `data_prazo`, `status_prazo`, `observacao`
  - `concluido_em datetime null`, `concluido_por_usuario_id fk null`
  - timestamps
- Índices: `idx_prazos_data_status`, `idx_prazos_processo`

---

## 5) Publicações

## `publicacoes` (inferido + recomendado)

- Finalidade: persistir importação de diários/publicações.
- Campos:
  - `id`
  - `processo_id fk null`
  - `cliente_id fk null`
  - `numero_processo_cnj varchar(32) not null`
  - `data_publicacao date null`, `data_disponibilizacao date null`
  - `tribunal_pdf varchar(64) null`, `tribunal_cnj varchar(64) null`
  - `tipo_publicacao varchar(80) null`
  - `teor_integral longtext not null`
  - `resumo_publicacao text null`
  - `status_vinculo varchar(40) null`
  - `status_validacao_cnj varchar(40) null`
  - `score_confianca varchar(16) null`
  - `hash_teor varchar(128) not null`
  - `hash_dedup varchar(128) not null unique`
  - `json_cnj_bruto longtext null`
  - `arquivo_origem_nome varchar(255) null`
  - `arquivo_origem_hash varchar(128) null`
  - `importado_por_usuario_id fk null`
  - `importacao_confirmada_em datetime null`
  - timestamps
- Índices: `idx_pub_cnj`, `idx_pub_data`, `idx_pub_status_vinculo`, `idx_pub_processo`, `idx_pub_cliente`

## `publicacao_divergencias` (recomendado)

- Campos: `id`, `publicacao_id fk`, `tipo`, `descricao`, `valor_pdf`, `valor_cnj`
- Índice: `idx_pub_div_publicacao`

---

## 6) Documentos e anexos

## Estratégia (recomendada)

- **No banco (SQL):** metadados, vínculo, versão, hash, tipo MIME, tamanho, autoria.
- **Fora do banco:** binário do arquivo (object storage).
- **Não recomendado:** base64 de arquivo no `localStorage` ou em coluna principal do banco.

## `anexos` (recomendado)

- Campos:
  - `id`
  - `entidade_tipo varchar(40) not null` (ex.: `PESSOA`, `PROCESSO`, `IMOVEL`, `PUBLICACAO`)
  - `entidade_id bigint not null`
  - `nome_original varchar(255) not null`
  - `mime_type varchar(120) not null`
  - `tamanho_bytes bigint not null`
  - `hash_sha256 varchar(64) not null`
  - `storage_provider varchar(40) not null`
  - `storage_key varchar(512) not null`
  - `versao int not null default 1`
  - `ativo boolean not null default true`
  - `uploaded_by_usuario_id bigint null fk -> usuarios.id`
  - timestamps
- Índices: `idx_anexos_entidade`, `idx_anexos_hash`, `idx_anexos_uploaded_by`

---

## 7) Financeiro

## `contas_bancarias` (inferido + recomendado)

- Campos:
  - `id`, `nome`, `numero_banco`, `agencia`, `conta`, `titular`, `ativo`, `ordem_exibicao`
- Índices: `uk_conta_nome`, `idx_conta_ativa`

## `contas_contabeis` (inferido + recomendado)

- Campos:
  - `id`, `codigo_letra char(1) unique`, `nome unique`, `ativo`, `is_sistema boolean`

## `lancamentos_financeiros` (inferido + recomendado)

- Campos:
  - `id`
  - `conta_bancaria_id fk not null`
  - `conta_contabil_id fk not null`
  - `cliente_id fk null`
  - `processo_id fk null`
  - `data_lancamento date not null`
  - `numero_lancamento varchar(40) null`
  - `descricao varchar(500) not null`
  - `descricao_detalhada text null`
  - `valor decimal(15,2) not null`
  - `saldo decimal(15,2) null`
  - `categoria varchar(100) null`
  - `ref_tipo enum('N','R') default 'N'`
  - `elo_referencia varchar(100) null`
  - `origem enum('IMPORTACAO','MANUAL','AJUSTE')`
  - `inativo boolean default false`
  - timestamps
- Índices:
  - `idx_lanc_data`, `idx_lanc_cliente_processo`, `idx_lanc_conta_bancaria`, `idx_lanc_ref_elo`

## `lancamento_anexos` (recomendado)

- N:N entre lançamento e anexo.

---

## 8) Imóveis e locação

## `imoveis` (inferido + recomendado)

- Campos:
  - `id`, `codigo_referencia`, `processo_id fk null`, `cliente_id fk null`
  - `ocupado boolean`, `endereco`, `condominio`, `unidade`, `garagens`
  - `inscricao_imobiliaria`, `dia_repasse`, `observacoes`
  - timestamps
- Índices: `idx_imovel_cliente`, `idx_imovel_processo`, `idx_imovel_condominio`

## `contratos_locacao` (inferido + recomendado)

- Campos:
  - `id`, `imovel_id fk`, `proprietario_pessoa_id fk`, `inquilino_pessoa_id fk`
  - `data_inicio`, `data_fim`, `valor_locacao`, `garantia_tipo`, `valor_garantia`
  - flags de assinatura/arquivamento
  - `status_contrato`
  - timestamps
- Índices: `idx_contrato_imovel`, `idx_contrato_periodo`

## `repasses_locacao` (inferido + recomendado)

- Campos:
  - `id`, `contrato_locacao_id fk`, `competencia` (YYYY-MM), `valor_recebido`, `valor_despesas_repassar`, `valor_repasse_locador`, `valor_remuneracao_escritorio`
  - `data_repasse`, `status_repasse`
  - timestamps
- Índices: `uk_repasse_competencia (contrato_locacao_id, competencia)`, `idx_repasse_status`

## `despesas_administrativas_imovel` (inferido + recomendado)

- Campos:
  - `id`, `imovel_id fk`, `lancamento_financeiro_id fk null`
  - `competencia`, `tipo_despesa`, `valor`, `repassavel boolean`, `observacao`

---

## 9) Agenda

## `agenda_eventos` (inferido + recomendado)

- Campos:
  - `id`, `usuario_id fk`, `data_evento date`, `hora_evento time null`
  - `descricao text not null`
  - `status_curto varchar(10) null` (`OK`/vazio)
  - `origem varchar(40) null` (manual/sistema)
  - `processo_id fk null`
  - timestamps
- Índices: `idx_agenda_usuario_data`, `idx_agenda_processo`

## 10) Auditoria (já existente)

- Manter `auditoria_atividades`.
- Recomendação futura:
  - catálogo de `tipo_acao`
  - índice adicional composto para relatório frequente (`ocorrido_em`, `usuario_id`, `modulo`), se necessário por volume.

---

## Migrations novas necessárias (sem alterar as antigas)

## Observação obrigatória Flyway

- **Não alterar V1..V5**.
- Criar novas migrations incrementais.

## Sequência sugerida de novas migrations

- `V6__usuarios_perfis_permissoes.sql`
- `V7__pessoa_complementos_enderecos_contatos.sql`
- `V8__clientes.sql`
- `V9__processos_partes_andamentos_prazos.sql`
- `V10__publicacoes.sql`
- `V11__anexos_documentos.sql`
- `V12__financeiro_core.sql`
- `V13__imoveis_contratos_repasses.sql`
- `V14__agenda_eventos.sql`
- `V15__ajustes_fk_monitoring_hits_processo_cliente.sql`

---

## Observações finais de modelagem

- **Encontrado no código:** sistema altamente relacional com cruzamentos entre pessoa/cliente/processo/financeiro/publicação/imóvel.
- **Recomendado:** começar por tabelas com menor risco de acoplamento (identidade e clientes), depois núcleo processual e financeiro.
- **Recomendado:** manter `json` apenas em settings dinâmicas (como já ocorre em monitoramento).
