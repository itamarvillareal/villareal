# Triagem pós-homologação — template de backlog

Saída da **Subfase 3**: lista **curta** de problemas **confirmados** na execução F1–F5.  
Não preencher com especulação — apenas o que foi observado na homologação (evidência em `e2e-homologation-execution-log.md`).

**Rigor:** **(recomendado)** = uso operacional; alinhar com política de issue do time.

---

## 1) Classificação por severidade (impacto)

| Nível | Quando usar **(recomendado)** |
|-------|-------------------------------|
| **Bloqueador** | Impede concluir fluxo da rodada 1 com flags corretas ou corrompe dado após persistência. |
| **Alto** | Fluxo concluível com workaround pesado; risco operacional claro; erro frequente. |
| **Médio** | Incômodo recorrente; dados corretos mas UX ou consistência frágil. |
| **Baixo** | Melhoria pontual; texto; ordem de campos. |
| **Ajuste cosmético** | Apenas visual sem impacto funcional. |
| **Fora do escopo** | Módulo/flag excluído da rodada 1; não abrir issue como bug desta homologação — registrar como **necessidade futura** se relevante. |

---

## 2) Natureza do achado

| Tipo | Quando usar **(recomendado)** |
|------|-------------------------------|
| **Bug confirmado** | Reproduzível; comportamento contrário ao esperado pelos critérios de `e2e-homologation-execution-log.md` §2. |
| **Limitação conhecida** | Já documentada (ex.: sem paginação **(inferido)** plano operacional); aceita temporariamente. |
| **Comportamento esperado** | Conforme desenho atual (ex.: responsável vazio na rodada 1 **(encontrado)** doc). |
| **Necessidade futura** | Melhoria válida, mas não bloqueia rodada 1 — candidata a backlog de produto. |

---

## 3) Backlog de saída (copiar e preencher)

Instruções:

1. Uma linha por achado **confirmado**.
2. `ID` temporário: `HOM-001`, `HOM-002`, … até promover para issue.
3. Copiar **Evidência** resumida; detalhes ficam no log de execução.

```markdown
| ID | Fluxo | Resumo (1 linha) | Severidade | Natureza | Módulo / área | Evidência (ref.) | Sugestão inicial |
|----|-------|-------------------|------------|----------|---------------|------------------|------------------|
| HOM-001 | F2 | | | | | log sessão DD/MM seção F2 | |
| HOM-002 | | | | | | | |
```

---

## 4) Promover para issue (checklist)

Para cada linha com severidade ≥ **Médio** ou **Bug confirmado**:

- [ ] Título: `[Homolog F1–F5]` + resumo curto
- [ ] Corpo: passos, esperado, atual, ambiente, link para evidência no **execution log**
- [ ] Labels sugeridas: `homologacao`, módulo (`frontend`/`backend`), `bug` ou `melhoria`

Itens **Fora do escopo** não viram issue desta rodada salvo decisão explícita do time.

---

## 5) Estatística opcional (fim da triagem)

| Métrica | Valor |
|---------|-------|
| Total de achados registrados | |
| Bugs confirmados | |
| Limitações conhecidas aceitas | |
| Fora do escopo (arquivados) | |

---

*Documento vazio até primeira homologação registrada; evita backlog genérico pré-preenchido.*
