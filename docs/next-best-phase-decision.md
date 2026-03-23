# Parecer: melhor próxima fase de desenvolvimento

Documento de apoio à decisão estratégica. **Método:** cruzamento de `docs/` (fases, inventários, gaps), `featureFlags.js`, controllers do backend e padrões de integração no frontend (`repositories/`, componentes grandes).

---

## A) Resumo executivo

**Encontrado:** o repositório já concentra domínio jurídico-operacional no backend (Spring + Flyway) com controllers para processos, partes, andamentos, prazos, publicações, financeiro, imóveis/contratos/repasses/despesas, tarefas, clientes, usuários, agenda, perfis/permissões, etc. O frontend adota **API-first por módulo** com **feature flags** e **fallback** (localStorage/mocks) documentado por fase.

**Inferido:** o maior risco agora não é “falta de backend”, e sim **dualidade prolongada** (mesma tela com dois mundos), **volume de dados sem paginação** em algumas listas, e **dívidas estruturais** antigas (ex.: documentos em Base64 no browser, autenticação/governança de usuário ainda híbrida).

**Recomendado (conclusão):** priorizar uma **fase de consolidação operacional** (homologação cruzada com flags, performance/listas, fechamento de gaps pequenos já mapeados) **antes** de abrir módulo novo grande. Como **segunda frente**, preparar **documentos/anexos leves com metadados** — **após** decisão explícita de armazenamento de binários (não é só “mais um CRUD”).

---

## B) Estado atual dos módulos

Classificação com base em **código + docs de fase** (não substitui homologação em produção).

| Área | Classificação | Evidência principal |
|------|----------------|----------------------|
| Cadastro de pessoas (API) | **Consolidado funcional** | CRUD + auditoria; docs Fase 2–3 |
| Monitoramento / DataJud | **Consolidado funcional** | Serviços + hits; FKs ainda “soltas” em parte (docs gap) |
| Clientes (API) + Cadastro Clientes UI | **Funcional, estabilização contínua** | `useApiClientes`; cadastro ainda híbrido |
| Processos / partes / andamentos | **Funcional com flag; transição** | `Processos.jsx` + `processosRepository.js` |
| Prazos processuais (API) | **Parcialmente integrado na UI** | `ProcessoPrazoController` **encontrado**; vínculo fino em tarefas contextuais ainda **pendente** (Fase 8 docs) |
| Financeiro | **Funcional com flag; migração assistida** | Fase 5 docs + import UI |
| Publicações | **Funcional com flag; migração assistida** | Fase 6 + estabilização |
| Imóveis / contratos / repasses | **Funcional com flag; estabilização** | Fase 7 docs; despesas sem PUT **encontrado** |
| Tarefas operacionais | **Funcional recente; estabilização** | Board API + contextual actions + evento refresh |
| Usuários / perfis / permissões | **Parcialmente integrado** | `Usuarios.jsx` usa API **e** `agendaPersistenciaData` |
| Agenda | **Parcialmente integrado** | Repositório + storage local |
| Documentos de pessoa (anexo) | **Parcial / dívida** | Base64 em `localStorage` (inventário frontend) |
| Relatórios / diagnósticos / calculadora | **Misto** | Dependência de dados locais em parte |

**Inferido:** inventários antigos (`database-inventory-frontend.md`) descrevem o passado; várias telas **já evoluíram** — usar sempre o código como fonte da verdade e tratar docs longos como complementares.

---

## C) Principais pendências reais do sistema

**Encontrado:**

- Múltiplos `VITE_USE_API_*` — ambiente pode operar “meio API / meio legado” por módulo.
- Migrações assistidas (financeiro, publicações, imóveis) com flags dedicadas — **trabalho de dados** ainda possível.
- `database-gap-analysis.md`: documentos em storage local; monitoramento com IDs soltos até FKs completas.
- Fase 7: despesas de locação sem `PUT` no backend — UI documentada como limitada.

**Inferido:**

- **Paginação / limites** em listas que crescem (tarefas, publicações, processos) — risco de performance e UX.
- **Autenticação e sessão no servidor** — se o alvo for multiusuário real, o modelo híbrido de usuários/permissões é gargalo estrutural (gap analysis já apontava).

**Recomendado:** tratar “pendência” como **lista curta**: (1) dualidade por flag, (2) volume de dados nas listas, (3) documentos, (4) governança de usuário para produção multiusuário.

---

## D) Opções de próxima fase avaliadas

| Candidata | Valor operacional | Risco técnico | Dependências prontas | Dependências faltantes | Impacto no dia a dia | Risco de retrabalho | Compatibilidade arquitetura |
|-----------|-------------------|---------------|------------------------|-------------------------|----------------------|----------------------|----------------------------|
| **Consolidação / homologação / listas** | Alto — desbloqueia uso confiável end-to-end | Baixo–médio | APIs, flags, repositórios | Ambiente, dados reais, critérios de aceite | Alto | Baixo | Total |
| **Migrações assistidas restantes** | Alto para quem tem legado | Médio | Scripts/UI já existentes | Dados limpos, tempo operacional | Médio–alto | Médio | Total |
| **Performance / filtros / paginação** | Alto em escala | Baixo–médio | GETs com query em vários controllers | Padronizar contratos no front | Alto | Baixo | Total |
| **Documentos / anexos leves + metadados** | Muito alto (risco legal/operacional) | **Alto** sem storage | Entidades alvo já existem | **Política de armazenamento de binários** | Alto | Alto se errar storage | Boa após decisão |
| **Automação leve (tarefas/pub/proc)** | Médio–alto | Médio–alto | Tarefas + APIs | Regras de negócio, idempotência | Médio | **Alto** se domínio ainda dual | Parcial |
| **Relatórios estruturados** | Médio | Médio | Export libs no front | Modelo de dados consolidado | Médio | Médio | Ok |
| **RBAC / usuário 100% servidor** | Altíssimo para produção | Alto | Endpoints base | Auth, sessão, migração de legado | Altíssimo | Médio | Requer desenho |

---

## E) Melhor próxima fase recomendada

**Fase de consolidação operacional e redução de incerteza** — combinar, num único eixo priorizado:

1. **Homologação cruzada** com as flags relevantes ligadas (processos ↔ clientes ↔ tarefas ↔ publicações ↔ financeiro conforme uso real).
2. **Padronização de listagens**: paginação ou “load more”, limites e feedback de vazio/erro onde ainda não existem (alinhado ao que já foi feito no Board/tarefas).
3. **Fechar micro-gaps já conhecidos** (ex.: endpoints que faltam para uma UX completa — referência: despesas sem PUT) **ou** documentar explicitamente “fora de escopo até backend disponível”.
4. **Plano de dados** para migrações assistidas pendentes (sem big bang).

**Justificativa (projeto real):** o código mostra **muitas frentes já implementadas**; o próximo ganho marginal maior costuma ser **confiança no fluxo completo** e **escalabilidade de leitura**, não mais um domínio isolado.

---

## F) Segunda melhor alternativa

**Iniciar desenho + MVP de documentos/anexos com metadados no backend e metadados + link de storage no front** — **somente depois** de fixar **onde** o binário vive (objeto S3-compatível, disco servido, etc.).  
Valor alto (substitui Base64 no browser — **encontrado** no inventário), risco alto se pular a decisão de storage.

---

## G) O que adiar por enquanto

- **Automação pesada** entre publicações/processos/tarefas (regras, retries, e-mails) — alto retrabalho enquanto dualidade e listas sem paginação geram estados difíceis de reproduzir.
- **Relatórios grandes novos** antes de consolidar fonte de verdade por módulo.
- **Módulo “documentos completo”** sem política de armazenamento — risco de refatorar duas vezes.

---

## H) Riscos de escolher a fase errada agora

| Se escolher… | Risco |
|--------------|--------|
| Novo módulo grande (docs/automação) sem consolidar | Integra em cima de dados duplicados/inconsistentes entre legado e API |
| Só migração de dados sem estabilizar telas | Usuário migra mas não confia na UI |
| Só performance sem homologação | Otimiza caminho que ainda pode estar conceitualmente errado |
| Ignorar auth/RBAC se meta for produção multiusuário | Permissões erradas em dados sensíveis |

---

## I) Próximos passos sugeridos se a consolidação for aprovada

1. Definir **matriz ambiente × flags** (quais módulos ligados em homologação/produção).
2. Roteiro de teste **E2E manual** (ou automatizado mínimo) nos fluxos: cliente → processo → tarefa contextual → publicação → financeiro (conforme uso).
3. Auditar **GETs que retornam lista completa** e priorizar paginação nos mais usados (**inferido** a partir do padrão REST existente).
4. Registrar em issue/backlog os **gaps backend** que bloqueiam UX (ex.: PUT despesas) com dono backend.
5. Reavaliar **documentos** e **auth** em gate separado com stakeholders.

---

### Legenda de rigor

- **Encontrado:** arquivos, controllers, docs citados.
- **Inferido:** dedução sobre escala, produção, prioridade de negócio.
- **Recomendado:** decisão sugerida com base nos dois anteriores.

---

*Última atualização: análise de repositório local (frontend + docs + lista de controllers).*
