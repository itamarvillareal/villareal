# Relatório de divergências — Agenda (v2)

**Gerado:** comparação completa com regra de negócio actualizada  
- Compromisso pode ter **só descrição** (hora em branco = tarefa do dia sem horário fixo)  
- **Status** em branco = pendente; `OK` = cumprido (não impede equivalência na validação)

**Fonte:** `*.Hora|Compromisso|Status.Agenda.txt` vs `dd.mm.yyyy.txt` na pasta Dropbox `Banco de Dados/Agenda`

| Ficheiro | Conteúdo |
|----------|----------|
| `tmp/relatorio-agenda-divergencias.json` | Lista completa (20 diferentes + 1011 ambíguos) |
| Regenerar | `npm run relatorio:agenda-divergencias` |

---

## Resumo numérico

| Categoria | Quantidade | % do total (43 978) |
|-----------|------------|---------------------|
| **Igual** | 35 900 | 81,6% |
| **Dia sem `dd.mm.yyyy.txt`** | 7 047 | 16,0% — só `.Agenda`; **importável** |
| **Ambíguo** | 1 011 | 2,3% |
| **Diferente** | 20 | 0,05% |

**Com ficheiro de referência no dia:** **97,21%** iguais (35 900 / 36 931).

**Aproveitável para importação:** os **43 978** eventos estruturados (divergência = descompasso entre formatos na pasta, não invalidez do dado).

---

## 1. Diferente (20) — revisão pontual

| Utilizador | Casos |
|------------|-------|
| Dr. Itamar | 11 |
| KARLA | 9 |

### Tipologia

| Tipo | Qtd | Importável? |
|------|-----|-------------|
| Texto no estruturado **não** aparece no CSV do dia | 14 | Sim — confiar no `.Agenda.txt` |
| Só **hora** ou **status** sem descrição (marcador de slot) | 6 | Parcial — slot incompleto no estruturado |
| Texto diferente no mesmo dia (ex. Cheque Helder vs Cheque Veredas) | incluído acima | Sim, com revisão manual |

### Lista completa (20)

| Data | Utilizador | Slot | Descrição (estruturado) | Observação |
|------|------------|------|-------------------------|------------|
| 2016-02-23 | Dr. Itamar | L10 | Escrever um texto "Porque trabalhei de graça" | Ausente no CSV |
| 2016-11-16 | Dr. Itamar | L3 | *(vazio)* | Só ficheiro `.Hora` 08:00 |
| 2018-07-12 | Dr. Itamar | L2 | *(vazio)* | Só `.Status` OK |
| 2018-09-13 | Dr. Itamar | L3 | *(vazio)* | Só `.Status` OK |
| 2018-09-13 | Dr. Itamar | L4 | *(vazio)* | Só `.Hora` 15:00 + OK |
| 2020-07-03 | Dr. Itamar | L1 | "GORDO" DA BORRACHARIA… | Ausente no CSV |
| 2020-07-08 | Dr. Itamar | L5 | Cheque Helder | CSV: Cheque Veredas |
| 2021-06-01 | Dr. Itamar | L6 | Avenida Parque 11:00 | Outros compromissos no CSV às 11:00 |
| 2021-06-01 | Dr. Itamar | L7 | Diligencia Leilão Ar… | Idem |
| 2021-06-01 | Dr. Itamar | L8 | Daniela - Luis carlos… | Idem |
| 2025-11-11 | Dr. Itamar | L5 | fazer recibo honorários Veredas… | Sem par no CSV |
| 2016-09-14 | KARLA | L577 | *(vazio)* OK | Só status |
| 2017-10-12 | KARLA | L4 | fazer inicial do Hamilton… | Sem par no CSV |
| 2018-07-12 | KARLA | L1 | *(vazio)* OK | Só status |
| 2019-09-09 | KARLA | L13 | responder proposta Magno… | Parcial no CSV |
| 2019-09-09 | KARLA | L14 | Aldriano | Sem par claro |
| 2020-07-03 | KARLA | L1 | "GORDO" DA BORRACHARIA… | Ausente no CSV |
| 2021-08-26 | KARLA | L1 | CONCILIAÇÃO METALSERVI… | CSV: INSTRUÇÃO (tipo audiência diferente) |
| 2021-09-08 | KARLA | L5 | CONCILIAÇÃO JULIO CEZAR… | CSV: INSTRUÇÃO (mesma hora) |
| 2025-11-11 | KARLA | L6 | Inicial Luciano OK | Sem par no CSV |

Detalhe com caminhos dos ficheiros: `divergencias.diferente[]` no JSON.

---

## 2. Ambíguo (1 011)

Várias linhas no `dd.mm.yyyy.txt` casam com o mesmo compromisso (descrição repetida, vazia ou hora flexível).

| Utilizador | Casos |
|------------|-------|
| Dr. Itamar | 654 |
| KARLA | 353 |
| Ana Luisa | 4 |

### Descrições mais frequentes

| Início da descrição | Ocorrências |
|---------------------|-------------|
| *(vazio)* | 205 |
| CUMPRIDA | 124 |
| CONSULTAR / consultar ITAMAR JUNIOR x KELLY SILVA… | ~44 |
| CONCILIAÇÃO (M&M / M&S ANÁPOLIS…) | ~26 |
| Outras conciliações repetidas no mesmo dia | restante |

**Importação:** usar sempre o ficheiro estruturado do slot; ambiguidade não bloqueia.

---

## 3. Dia sem referência (7 047)

Existem `.Agenda.txt` mas não há `dd.mm.yyyy.txt` na data (comum em 2013–2016).

**Importável** — não é divergência de conteúdo.

---

## Evolução vs relatório anterior

| Métrica | Antes | Agora (v2) |
|---------|-------|------------|
| Igual | 36 351 (98,43%) | 35 900 (97,21%) |
| Diferente | 59 | **20** |
| Ambíguo | 521 | 1 011 |

A queda em **diferente** reflecte a regra: mesma descrição com hora/status flexíveis (pendente vs OK) conta como igual. O aumento em **ambíguo** vem do mesmo critério (mais pares possíveis no CSV).

---

## Conclusão

- **Importação:** todos os eventos estruturados com descrição (com ou sem hora/status) são apropriados.  
- **Revisão manual sugerida:** 20 casos «diferente» (14 textos só no estruturado ou divergentes; 6 slots só hora/status).  
- **API local:** ainda vazia; comparação foi só pasta vs pasta.
