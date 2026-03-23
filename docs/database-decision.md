# Parecer técnico: escolha do banco de dados principal — VILA real

**Data do parecer:** 23/03/2026  
**Escopo:** repositório `villareal` (frontend `e-vilareal-react-web` + backend `e-vilareal-java-backend`).

---

## A) Resumo executivo

O sistema é **claramente relacional** (pessoas, clientes, processos, vínculos, financeiro, permissões, auditoria) e o **backend já está implementado em Spring Boot com JPA, Flyway e MySQL**. Não há indício no código de que o núcleo transacional deva ser NoSQL.

A decisão mais **aderente à execução imediata** é adotar **MySQL 8.x** (ou MariaDB compatível, com validação de recursos) como **banco principal em produção**, alinhado ao que já existe em dependências, configuração e migrações SQL.

**PostgreSQL** permanece como **segunda melhor opção** do ponto de vista de ecossistema e recursos avançados, mas exigiria **migração deliberada** do backend (driver Flyway, dialect Hibernate e scripts), o que não se justifica apenas por “preferência de banco” sem requisitos não atendidos pelo MySQL.

**Evitar** como **fonte única dos dados de negócio** soluções como **Firebase Firestore** ou **MongoDB** para o núcleo jurídico-financeiro: o próprio frontend e o backend já modelam entidades com **integridade referencial**, **relatórios tabulares** e **auditoria** — padrão natural de **SQL transacional**.

---

## B) Stack encontrada no projeto

### O que foi encontrado no código (fatos)

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | React 19, Vite 7, React Router 7, Tailwind CSS 4, Lucide; arquivos em **JavaScript** (`.jsx`/`.js`) — `@types/react` existe só como suporte de tipagem no editor, não há TypeScript obrigatório no código-fonte. |
| **Backend** | **Java 21**, **Spring Boot 4.0.3** (`e-vilareal-java-backend`), `spring-boot-starter-web`, `spring-boot-starter-data-jpa`, `spring-boot-starter-validation`, **Flyway**, **SpringDoc OpenAPI**. |
| **Banco (backend)** | **MySQL** via `com.mysql:mysql-connector-j`, `org.flywaydb:flyway-mysql`, `spring.datasource.url=jdbc:mysql://localhost:3306/...`, `hibernate.dialect=MySQLDialect` (`application.properties`). |
| **Migrações** | Scripts em `src/main/resources/db/migration/` (ex.: `V1__criar_tabela_cadastro_pessoas.sql` com `AUTO_INCREMENT`, `ON UPDATE CURRENT_TIMESTAMP`, tipos `JSON`, `LONGTEXT` — sintaxe **MySQL**). |
| **API REST** | Frontend chama `fetch` para `/api/...` com `API_BASE_URL` vazio em dev (proxy Vite para `localhost:8080`). Contratos compatíveis com estilo **Spring** (paginação em auditoria com `page`, `size`, `sort`). |
| **Armazenamento no browser** | Uso extensivo de **`localStorage`** para módulos ainda não persistidos no servidor (ex.: publicações importadas, financeiro em parte, documentos de pessoa em Base64, permissões, tema, cache DataJud). |
| **Mocks** | Arquivos grandes em `src/data/` (ex.: `cadastroPessoasMock.js` gerado por script), flag `VITE_USE_MOCK_CADASTRO_PESSOAS=true` em `.env.development` para cadastro de pessoas sem backend. |
| **Integrações externas** | API pública **DataJud** (CNJ); proxy no Vite (`/datajud-proxy`); backend também referencia DataJud em `application.properties`. |

### O que não foi encontrado (ausências verificáveis)

- **Docker**, **docker-compose**, `vercel.json` ou manifest de deploy no repositório analisado.
- **Firebase / Supabase** como dependência ou SDK no `package.json`.
- **MongoDB** driver no backend.
- **SQLite** no backend de produção.

### Inferências (com nível de confiança)

| Inferência | Confiança |
|------------|-----------|
| O deploy pretendido é **SPA estática** (build Vite) + **API Java** em processo separado, com banco MySQL acessível pela rede. | **Alta** (padrão Spring + proxy dev). |
| **Vercel** ou outro host estático pode servir o frontend; o **banco não roda no edge** — continua sendo servidor gerenciado ou VM. | **Média** (não há arquivo de plataforma; é arquitetura comum). |
| O README raiz menciona “backend Java (Spring)”; o backend real está em `e-vilareal-java-backend`. | **Alta**. |

---

## C) Necessidades do sistema (a partir de telas, mocks e serviços)

### Evidências no código

- **Relacionamentos e integridade:** FKs em migrações (`monitored_people` → `cadastro_pessoas`, cascata em chaves de busca, etc.); vínculos cliente–processo–financeiro modelados em dados e relatórios (`financeiroData.js`, `processosMock.js`, buscas combinadas).
- **Filtros e relatórios:** relatórios de processos, pessoas, imóveis, cálculos; presets (`relatorioPresets.js`); colunas dinâmicas; grids — comportamento típico de **SQL com WHERE/JOIN/ORDER BY** e agregações.
- **Auditoria:** entidade e API `/api/auditoria/atividades` com filtros por data, usuário, módulo, texto (`q`); registro no cliente via `registrarAuditoria` — necessidade de **append-only** ou tabela de eventos com índices.
- **Histórico:** `processosHistoricoData.js`, seeds de demonstração, armazenamento de histórico em `localStorage` — a evolução natural é tabelas de histórico/versionamento no servidor.
- **Documentos e PDFs:** parsing/OCR no cliente (`pdfjs`, `tesseract`); documentos hoje em **localStorage** (Base64) — em produção, **metadados no SQL** e **arquivo em object storage** (S3, GCS, Azure Blob, ou bucket Supabase) é o padrão recomendado (solução **híbrida**, não “tudo no mesmo banco”).
- **Financeiro:** extratos multi-banco, lançamentos com dimensões, vínculo a cliente/processo, regras de compensação — **consistência transacional** e **integridade** são críticas; modelo relacional é o adequado.
- **Multiusuário e permissões:** `usuarioPermissoesStorage.js` (local); conceito de módulos e perfis — no servidor exige **usuários, papéis e ACL** em tabelas relacionais.
- **Publicações / importação:** pipeline de PDF, deduplicação, score — dados estruturados + texto longo; MySQL/PostgreSQL suportam `JSON`/`JSONB` e texto longo (`LONGTEXT` já usado no MySQL).

### Inferências sobre requisitos futuros

| Necessidade | Confiança |
|-------------|-----------|
| **Busca textual full-text** em larga escala pode exigir **extensão** (ex.: `pg_trgm` no PostgreSQL) ou **índice full-text** no MySQL 8, ou motor auxiliar (OpenSearch) **se** o volume crescer muito. | Média — ainda não há volume real; começar no SQL é razoável. |

---

## D) Comparação entre bancos

Legenda: **aderência** = fit para o domínio jurídico-financeiro + stack atual.

| Opção | Aderência ao sistema | Integração com a stack | Custo | Manutenção | Escalabilidade | Relacionamentos / filtros / relatórios | Integridade / migrações | Produção | Riscos de adoção |
|-------|----------------------|-------------------------|-------|------------|----------------|----------------------------------------|---------------------------|----------|-------------------|
| **MySQL 8** | **Alta** — relacional, ACID, já no `pom.xml` e Flyway | **Ótima** — zero mudança de motor | Licenciamento OSS; custo infra (VM, RDS, Cloud SQL) | Equipe Java costuma conhecer bem | Boa com réplicas e tuning | **Boa** para JOINs e índices; JSON nativo já usado | **Flyway + FK** já em uso | Muito comum em produção | Baixo — **caminho já trilhado no repo** |
| **PostgreSQL** | **Alta** — referência em apps complexos | **Boa** após trocar driver, dialect, `flyway-database-postgresql`, revisar SQL | OSS; managed (RDS, AlloyDB, etc.) | Rica (extensões, DDL avançado) | Excelente | **Muito boa** (CTEs, window functions, JSONB) | Forte; migrações a reescrever | Excelente | **Alto** — **migração completa** do que já está em MySQL |
| **SQLite** | Média para lógica, **baixa** para multiusuário servidor | Possível em dev embutido | Muito baixo | Simples | Limitado (escrita única forte) | OK para protótipo | OK | **Não** como DB central multiusuário | Alto para produção do escritório |
| **SQL Server** | Alta (relacional) | Possível com mudança de stack JDBC/driver | Licenciamento ou Azure | Comum em corporações | Boa | Muito boa | Forte | Sólido | **Médio** — sem traço no repo; custo/licenciamento |
| **MongoDB** | **Baixa** para núcleo financeiro com vínculos fortes | Nova stack (driver, padrão de repo) | Atlas ou self-hosted | Diferente do JPA relacional típico | Escala horizontal boa para certos casos | Agregações possíveis; **integridade referencial** menos natural | Fraca para o modelo atual | Usado em nichos | **Alto** — **desalinhado** ao modelo relacional já desenhado |
| **Firestore** | **Baixa** como BD único transacional | SDK diferente; regras de segurança; não é JPA clássico | Pay-as-you-go | Modelo mental diferente | Escala, mas com limitações de query | Limitações para relatórios complexos e joins | Sem FKs clássicos | Bom para apps mobile sync | **Muito alto** para este domínio |
| **Supabase** | **Alta** *se* aceitar **PostgreSQL** como motor | Frontend não muda; backend Java falaria com Postgres (não com API Supabase obrigatoriamente) | Plano free/pro; armazenamento de arquivos à parte | Menor se usar Auth/Storage geridos | Boa (Postgres) | Muito boa | Forte (Postgres) | Produção madura | **Médio** — implica **PostgreSQL**, não MySQL atual |

---

## E) Banco recomendado

**Principal:** **MySQL 8.x** (servidor dedicado ou gerenciado: AWS RDS, Google Cloud SQL, Azure Database for MySQL, ou VM própria).

**Motivo decisivo encontrado no projeto:** o backend **já** define datasource MySQL, Hibernate `MySQLDialect`, dependências `mysql-connector-j` e `flyway-mysql`, e as migrações usam sintaxe específica de MySQL.

---

## F) Motivos técnicos da escolha

1. **Continuidade:** evita retrabalho de migrações Flyway, testes de regressão e troca de conectividade em ambiente já funcional.
2. **Modelo de dados:** o domínio (cadastros, processos, auditoria, monitoramento CNJ) mapeia naturalmente para **tabelas com FKs e índices** — MySQL entrega isso com maturidade.
3. **Consistência:** financeiro e vínculos exigem transações; InnoDB (padrão MySQL 8) atende.
4. **Caminho de evolução:** se no futuro surgir necessidade de recursos típicos de PostgreSQL (determinadas extensões ou JSONB pesado), a migração pode ser **planejada** com base em métricas reais, não antecipada sem necessidade.

---

## G) Riscos e limitações

| Risco / limitação | Mitigação |
|-------------------|-----------|
| **Vendor / sintaxe** presa a MySQL em scripts Flyway | Manter SQL portável onde possível; documentar funções específicas. |
| **Full-text e buscas muito pesadas** | Índices FT no MySQL 8 ou motor de busca dedicado **depois** de medir volume. |
| **Arquivos grandes** no banco | Não armazenar PDFs como BLOB principal; usar **object storage** + metadados na base. |
| **Credenciais** em `application.properties` de exemplo | Externalizar por variáveis de ambiente em produção (já há padrão com `DATAJUD_API_KEY`). |

---

## H) Estratégia de implantação

1. **Ambientes:** `dev` (MySQL local ou container **só do MySQL**), `staging`, `prod` com mesma versão major (MySQL 8).
2. **Flyway:** manter **uma linha de migrações**; nunca editar migrações já aplicadas em ambientes compartilhados.
3. **Backup:** dump lógico + binlog (se política de PITR for exigida pelo negócio jurídico).
4. **Frontend:** build estático em CDN ou servidor nginx; API em JVM com TLS terminando no load balancer ou no próprio app.
5. **Híbrido recomendado:** **MySQL** = verdade relacional; **armazenamento de objetos** = PDFs e anexos; opcionalmente **fila** (futuro) para importações pesadas — não concentrar tudo no mesmo repositório de arquivos do banco.

---

## I) Próximos passos para modelagem

1. **Inventário de entidades** a partir de `src/data/` e componentes: pessoa, cliente (código), processo (CNJ), lançamento financeiro, publicação, tarefa/agenda, usuário/perfil, imóvel.
2. **Prioridade de tabelas (ordem sugerida):**  
   - Núcleo já no backend: estender **`cadastro_pessoas`** e módulos **auditoria** / **monitoring** conforme novos campos.  
   - Em seguida: **usuários e permissões** (substituir gradualmente `localStorage`).  
   - **Processos e vínculos** (cliente, pessoa, processo).  
   - **Financeiro** (conta, extrato, lançamento, vínculo cliente/processo).  
   - **Publicações** importadas (metadados + referência a arquivo).  
   - **Imóveis** e relatórios derivados.
3. **Migração dos mocks:** por módulo, endpoints REST espelhando o que o frontend já faz em memória; feature flags (`VITE_USE_MOCK_*`) por domínio até estabilizar API.

---

## Conclusão obrigatória (formato solicitado)

- **Banco principal recomendado:** **MySQL 8.x**
- **Justificativa principal:** o backend **já** implementa **Spring Boot + JPA + Flyway** com **MySQL** (dependências, `application.properties` e migrações SQL específicas); o domínio é **fortemente relacional** e exige **integridade, auditoria e relatórios** — tudo compatível com InnoDB/MySQL 8 sem reescrever a stack.
- **Segunda melhor opção:** **PostgreSQL** (incluindo uso futuro via **Supabase** apenas como *hospedagem* do mesmo motor, se desejarem managed Postgres + Storage — implica **migrar** o backend de MySQL para PostgreSQL).
- **Opção que eu não recomendo:** **Firebase Firestore** (ou qualquer NoSQL documental) como **única base** dos dados jurídico-financeiros com vínculos e relatórios como os modelados no projeto.
- **Grau de confiança da análise:** **Alta** quanto à stack e ao motor já escolhido no código; **Média** quanto a detalhes de deploy em nuvem específica (não há manifesto no repositório).
- **Pré-requisitos para iniciar a modelagem:** MySQL 8 acessível; backend Java compilando; política de **não** alterar migrações Flyway já aplicadas; definição de **onde** ficarão arquivos (fora do banco ou coluna só metadados); lista priorizada de módulos a sair do `localStorage`.

---

## Apêndice: diferenciação explícita

| Tipo | Conteúdo |
|------|----------|
| **Encontrado no projeto** | React+Vite frontend; Spring Boot backend; MySQL+JPA+Flyway; REST `/api`; mocks e `localStorage`; DataJud. |
| **Inferência** | Deploy SPA + API; necessidade futura de busca avançada ou fila. |
| **Recomendação** | **MySQL 8** como principal; storage externo para binários; PostgreSQL como alternativa estratégica se houver migração planejada; evitar NoSQL como núcleo transacional. |
