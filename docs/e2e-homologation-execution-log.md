# Registro de execução — homologação F1–F5

Documento para **evidência organizada** da homologação (Subfase 3). Preencher durante ou logo após cada sessão.  
Roteiro de passos: `e2e-homologation-checklist.md` · setup: `homologation-quick-start.md`.

**Rigor:** **(encontrado)** = documentação/código de referência; **(inferido)**; **(recomendado)**.

---

## 1) Como usar este arquivo

1. Duplicar a **§3** (sessão) para cada dia/sessão de testes ou copiar o bloco para um arquivo por sprint (ex.: `execution-log-2025-03-24.md`).
2. Para cada fluxo **F1–F5**, marcar **resultado** e anexar **evidências** (print, id de registro, trecho de rede HAR — o que for política do time).
3. Itens que não forem bug mas limitação documentada → **aprovado com ressalva** + campo **tipo de achado**.
4. Ao final da rodada, copiar apenas linhas **falhou** / **ressalva** relevantes para `post-homologation-triage-template.md`.

---

## 2) Critérios de aprovação por fluxo

Legenda de resultado:

| Valor | Significado **(recomendado)** |
|-------|--------------------------------|
| **Aprovado** | Critérios mínimos atendidos; persistência e releitura OK; sem erro de API bloqueando o fluxo. |
| **Aprovado com ressalva** | Fluxo concluído, mas UX lenta, mensagem confusa, limitação conhecida, ou dependência fora do escopo (ex.: performance sem paginação **(inferido)**). |
| **Falhou** | Impossível concluir o fluxo com API ligada, dado inconsistente após reload, ou erro HTTP/recurso inaceitável. |
| **Fora do escopo** | Comportamento relacionado a módulo/flag excluído da rodada 1 (ex.: usuários API **(encontrado)** em `homologation-quick-start.md`). |

---

### F1 — Cliente → processo

| Resultado | Critérios |
|-----------|-----------|
| **Aprovado** | Cliente criado ou selecionado com persistência na API; processo salvo com vínculo ao `clienteId`; após **reload** da página, cabeçalho do processo ainda correto; rede sem 4xx/5xx nas operações principais. |
| **Aprovado com ressalva** | Fluxo OK, mas lentidão ao listar clientes, aviso de UI aceitável, ou necessidade de refresh manual para refletir lista. |
| **Falhou** | Não salva processo; vínculo cliente perdido; erro de API ao criar/atualizar. |
| **Fora do escopo** | Cadastro de **pessoa** física na API com mock ligado; problemas em rotas não usadas neste fluxo. |

---

### F2 — Processo → financeiro

| Resultado | Critérios |
|-----------|-----------|
| **Aprovado** | Lançamento criado vinculado ao **processoId** API; resumo/conta corrente na tela do processo coerente; após reload, lançamento ainda visível via API. |
| **Aprovado com ressalva** | Dados corretos mas totais confusos na UI, precisa filtrar manualmente na tela global, ou latência alta. |
| **Falhou** | Lançamento não persiste; erro ao salvar; resumo com erro explícito na UI; valores incoerentes após reload. |
| **Fora do escopo** | Integração automática imóvel→financeiro; relatórios exportados; importação assistida. |

---

### F3 — Processo → publicações

| Resultado | Critérios |
|-----------|-----------|
| **Aprovado** | Publicação criada ou vinculada ao processo com **processoId** correto; alteração de status persistida; após reload, lista/reflete API. |
| **Aprovado com ressalva** | Funciona, mas fluxo de vínculo exige passos extras; texto de tratamento limitado; duplicidade só evitada com cuidado do operador. |
| **Falhou** | Não grava; publicação “some” após reload; PATCH/POST com erro; vínculo processo incorreto. |
| **Fora do escopo** | Import legado (`VITE_ENABLE_*` publicações); parsing de diário externo; DataJud. |

---

### F4 — Processo ou publicação → tarefa

| Resultado | Critérios |
|-----------|-----------|
| **Aprovado** | `POST /api/tarefas` bem-sucedido; vínculos (processo/publicação) coerentes no payload; tarefa aparece no **Board** pendências após atualizar/listar; título obrigatório satisfeito. |
| **Aprovado com ressalva** | Tarefa criada mas lista do board exige refresh manual; responsável vazio usado (esperado na rodada 1 **(encontrado)** modal); confusão leve já mitigada por aviso de UI. |
| **Falhou** | Modal bloqueia com erro de flag; API retorna erro; tarefa não listada após operações normais de refresh. |
| **Fora do escopo** | **Responsável** com ID da lista local que não existe no backend (problema de dados de teste, não escopo API usuários); migração `pendencias` legado → API. |

---

### F5 — Imóvel → contrato → repasse / despesa

| Resultado | Critérios |
|-----------|-----------|
| **Aprovado** | Imóvel e contrato vigente reconhecidos pela UI; repasse e despesa persistidos; após reload, listas coerentes com `GET` de repasses/despesas por contrato. |
| **Aprovado com ressalva** | Fluxo longo mas OK; edição só em parte dos campos; mensagens técnicas visíveis. |
| **Falhou** | Não grava repasse/despesa; contrato não reconhecido; erro 4xx/5xx nas APIs de locação. |
| **Fora do escopo** | Migração mock imóveis (fase 7); sincronização repasse→lançamento financeiro global; relatórios imobiliários avançados. |

---

## 3) Modelo de sessão (copiar por execução)

```markdown
### Sessão — [AAAA-MM-DD] [HH:MM]

| Campo | Valor |
|-------|-------|
| Ambiente | ex.: dev local / servidor homolog XYZ |
| Backend | ex.: commit ou tag / URL |
| Frontend | ex.: `npm run dev:homolog` · branch |
| Operador | nome |
| Flags | colar trecho relevante de `.env.homolog` ou “conforme repo” |

#### Pré-condições desta sessão

- [ ] Checklist B de `e2e-homologation-checklist.md` OK
- [ ] Cliente / processo de teste: [ids ou “criar no F1”]

#### F1 — Cliente → processo

| Campo | Preencher |
|-------|-----------|
| Resultado | Aprovado / Aprovado com ressalva / Falhou / Fora do escopo |
| Evidências | prints / ids / “rede: POST … 201” |
| Observações | |
| Issue sugerida | # ou “não” |

#### F2 — Processo → financeiro

| Campo | Preencher |
|-------|-----------|
| Resultado | |
| Evidências | |
| Observações | |
| Issue sugerida | |

#### F3 — Processo → publicações

| Campo | Preencher |
|-------|-----------|
| Resultado | |
| Evidências | |
| Observações | |
| Issue sugerida | |

#### F4 — Processo/publicação → tarefa

| Campo | Preencher |
|-------|-----------|
| Resultado | |
| Evidências | |
| Observações | |
| Issue sugerida | |

#### F5 — Imóvel → contrato → repasse/despesa

| Campo | Preencher |
|-------|-----------|
| Resultado | |
| Evidências | |
| Observações | |
| Issue sugerida | |
```

---

## 4) Resumo rápido (uma linha por fluxo — após a sessão)

| Fluxo | Resultado | Severidade do pior achado (se houver) |
|-------|-----------|--------------------------------------|
| F1 | | |
| F2 | | |
| F3 | | |
| F4 | | |
| F5 | | |

**Severidade:** usar a mesma escala que `post-homologation-triage-template.md` §2.

---

*Preenchimento manual; não substitui issues no GitHub — apenas evidência e insumo para triagem.*
