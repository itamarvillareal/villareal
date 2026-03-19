# Especificação de Migração — Motor de Cálculos (Fidelidade ao VBA)

> Objetivo: reconstruir em TypeScript moderno um motor de cálculos **funcionalmente equivalente** ao legado VBA.
> Prioridade absoluta: **fidelidade ao resultado** e à **ordem de execução** do VBA. Modernização apenas estrutural.

## Princípios inegociáveis

- **Não “corrigir”** a matemática conceitualmente; replicar o comportamento do legado.
- **Ordem do cálculo é regra de negócio** e deve ser preservada.
- Núcleo de cálculo em `number`; formatação monetária apenas na apresentação.
- Preservar efeitos do legado que diferenciam **0** de **vazio** (ex.: UI e somatórios).

---

## 1) Fluxo geral (equivalente a `Calculos_INICIAIS`)

### Se `Calculo_Foi_Aceito = "SIM"`
- Ler dados consolidados já gravados (taxas/custas/parcelas).
- Somar custas.
- Somar taxas/débitos.
- Somar parcelamentos.
- Apurar honorários totais conforme regra (seção 8).

### Se **não aceito**
- Calcular linhas de custas.
- Somar custas.
- Calcular linhas de débitos (taxas).
- Somar débitos.
- Calcular valor total a pagar.
- Calcular parcelamento.
- Somar parcelamentos.
- Apurar honorários totais conforme regra (seção 8).

---

## 2) Cálculo por linha de débito (equivalente a `Calculo_Linha_Taxas`)

### Ordem obrigatória
1. Definir datas efetivas para atualização monetária (seção 5).
2. Calcular atualização monetária (seção 3) → retorna **valor atualizado total**.
3. Converter para acréscimo: `atualizacao = valorAtualizadoTotal - principal`.
4. Se `atualizacao < 0`, **forçar 0** (correção negativa não abate débito).
5. Calcular dias de atraso.
6. Calcular juros (seção 4).
7. Calcular multa (seção 6).
8. Calcular honorários (seção 7).

### Regra crítica — atualização negativa
- A função de atualização monetária retorna **valor atualizado total**.
- O valor armazenado na linha é **diferença** (`atualizado - original`).
- Se a diferença ficar negativa: **zerar**.
- Resultado: **não reduzir** o principal com deflação/índice negativo.

---

## 3) Atualização monetária (equivalente a `Atualizacao_Monet`)

### Comportamento obrigatório
- Percorrer competências **mensais** entre data inicial e final.
- Ler índice por competência.
- Aplicar mês a mês de forma acumulada sobre o valor corrente.
- Retornar **o valor atualizado total** (não apenas o acréscimo).

### Detalhe fiel ao trecho colado
- A iteração mensal é feita por um contador linear \(i = a..b\), onde:
  - \(a = (((AnoInicial - 1990) * 12) + 4) + MesInicial\)
  - \(b = (((AnoFinal - 1990) * 12) + 4) + MesFinal\)
- A competência usada no índice é montada como `DateSerial(1990,1,1)` com deslocamento de meses \((i - 5)\), e a chave lida é:
  - `LCase(Replace(Indice & "." & Format(dataCompetencia, "mmm/yyyy"), "/", "."))`
- No `Atualizacao_Monet` do trecho, **não há fallback explícito para índice vazio** (ele faz `s = (dado_lido + 0)`; se `dado_lido` vier vazio, vira 0 por coerção do VBA, mas isso precisa ser reproduzido com cuidado no TS).

### Caso `Indice_Atualizacao_monetaria = "NENHUM"`
- Retornar **0** e sair.
- Observação: isso é “estranho” conceitualmente, mas **é regra do legado** e deve ser mantida.

---

## 4) Juros — duas rotinas separadas

### 4.1) `Calcula_Juros` → `calculateInterestLegacy`
- Percorre meses entre início e fim (regra de contagem do legado).
- Ajuste adicional: se `Dia_Final > Dia_Inicial`, soma **+1 mês**.
- Não substituir por fórmula simplificada.
- Arredondar conforme regra do legado no ponto equivalente.

### Detalhe fiel ao trecho colado
- Antes de calcular juros, o VBA **atualiza o valor mês a mês** usando os mesmos índices (mesma ideia do `Atualizacao_Monet`, mas dentro de `Calcula_Juros`).
- Se um índice mensal vier vazio (`dado_lido = ""`), ele é forçado para `0`.
- A base final para juros é o `Calculo` do último mês (valor após atualização mensal).
- Meses de juros:
  - `Meses_Juros = b - a`
  - se `Dia_Final > Dia_Inicial`, `Meses_Juros = Meses_Juros + 1`
- Juros:
  - `Valor_Juros = (Calculo * Taxa_Juros) * Meses_Juros` onde `Taxa_Juros = (Tx_Juros / 100)`

### 4.2) `Calcula_Juros_BrCond` → `calculateInterestBrCond`
- Atualiza monetariamente primeiro.
- Calcula dias corridos.
- Aplica:

```
fator = (taxa / 30) * dias
juros = (fator * valorAtualizado) / 100
```

- Arredonda no fim.

### ALERTA de fidelidade (trecho colado)
No VBA colado, `Calcula_Juros_BrCond` **IGNORA o parâmetro `Tx_Juros`** e seta `Taxa_Juros = 1` fixo.

Isso significa:
- Mesmo que a função receba `Tx_Juros`, a taxa efetiva usada é sempre **1** (interpretada como “1%” no cálculo, pois divide por 100 no final).
- Na migração, isso precisa ficar explícito: ou reproduzimos exatamente esse comportamento (mais fiel), ou corrigimos — mas **corrigir mudará resultados**.

---

## 15) Arredondamento (na prática: truncamento) — equivalente a `Arredondamento`

O VBA fornecido implementa `Arredondamento` assim:
- Se não houver vírgula no número, faz `Format(Numero, "#,##0.00")`.
- Retorna `Mid(Numero, 1, InStr(Numero, ",") + Decimais)`.

Efeito funcional:
- **NÃO é arredondamento matemático.**
- É **TRUNCAMENTO** para `Decimais` após a vírgula.

Na implementação TS, criar util equivalente:
- `legacyTrunc(value, decimals)` que:
  - formata/normaliza com separador decimal brasileiro (vírgula),
  - **corta** (não arredonda) para N casas,
  - retorna `number` (no núcleo) e opcionalmente string para debug/compare.

---

## 19) Persistência/Leitura (chaves `Nome_do_Txt`) — detalhe do fluxo

O trecho mostra uma camada de storage baseada em `Nome_do_Txt` e `Formulario`:
- Ex.: `Cod_Cliente & "." & Dimensao & ".100.1." & Class_do_Processo & "." & Format(i,"000")`
- Há forte acoplamento com:
  - `avaliacao` (leitura/gravação)
  - coerções `IsNumeric`, `Format`, e strings monetárias `"R$ #,##0.00"`.

Na migração:
- manter repositório/adapter que simule isso para testes (mock) e permita trocar por DB/API depois.
- sempre normalizar:
  - `number` no cálculo
  - parsing/formatting na borda.

### “Commit” quando o cálculo é aceito
No legado, o aceite (`Aceitar_Pagamento`) grava `Calculo_Foi_Aceito = "SIM"` e chama `Salvar_Todas_Informacoes`,
que persiste um **snapshot completo** do cálculo:
- componentes por linha (taxas e custas),
- dados do parcelamento (linhas),
- e totais consolidados (taxas, custas, total a pagar, taxa de parcelamento, índice etc.).

Na migração, isso vira:
- `acceptCalculation(input)`: calcula (se necessário) e persiste snapshot,
- `loadAcceptedCalculation(key)`: lê snapshot sem recalcular.

---

## 5) Datas especiais por linha (atualização e juros)

Existem campos de data especial **separados** para atualização e para juros.

### Atualização monetária
- Só final especial: início = vencimento, fim = final especial
- Só inicial especial: início = inicial especial, fim = data do cálculo
- Ambas: usar ambas
- Nenhuma: vencimento → data do cálculo

### Juros
- Mesma regra, com seus próprios campos.

### Marcação visual (equivalente a `LinhasColorir(Linha) = "SIM"`)
- Se usou qualquer data especial: marcar a linha como “destacada”.

---

## 6) Multa (equivalente ao bloco da multa no VBA)

### Condição de incidência
- Só aplica se `vencimento < dataDoCalculo`.
- Caso contrário: **multa = 0** (não vazio).

### Ordem e base
- Calculada **depois dos juros**.
- Base funcional:

```
multa = (principal + atualizacao + juros) * (percentualMulta/100)
```

- Não inclui honorários.

---

## 7) Honorários (equivalente ao bloco de honorários no VBA)

### Ordem e base
- Calculado **depois da multa**.
- Base funcional:

```
honorarios = (principal + atualizacao + juros + multa) * (percentualHonorarios/100)
```

### Honorários variáveis (tipo = VARIAVEL)
- atraso > 60 dias → 20%
- atraso > 30 dias → 10%
- senão → 0%

### Honorários fixos (tipo = FIXO)
- Usa a taxa fixa carregada.

---

## 8) Honorários totais do advogado (equivalente a `Apurar_Honorarios_Adv_Total`)

- Se cálculo aceito e parcelas <= 1 → honorários totais = soma honorários das linhas de taxas
- Se cálculo aceito e parcelas > 1 → honorários totais = soma honorários das parcelas
- Se cálculo não aceito → honorários totais = soma honorários das linhas de taxas

---

## 9) Linhas sem dados (efeito “vazio”)

Se uma linha não tiver vencimento e valor (ou estiver vazia no sentido do legado):
- Componentes calculados devem ficar “vazios” (não 0) na UI/relatório equivalente:
  - atualização = ""
  - atraso = ""
  - juros = ""
  - multa = ""
  - honorários = ""

Internamente pode usar `null/undefined`, mas deve preservar o efeito final (inclusive em somas/exports).

---

## 10) Custas judiciais (equivalente a `Calculo_Linha_Custas_Judiciais`)

- Atualização monetária = valor atualizado − valor original (com mesma regra de “zerar negativo” se existir no legado específico da rotina; se não houver, manter como no VBA).
- Juros = `Calcula_Juros` (rotina principal).
- **Sem multa e sem honorários** por linha de custas (conforme trecho descrito).

Total custas atualizado:

```
totalCustas = soma(valor) + soma(atualizacao) + soma(juros)
```

---

## 11) Somatórios dos débitos (taxas)

Somar separadamente:
- principal
- atualização monetária
- juros
- multa
- honorários

Total débitos atualizado:

```
totalDebitos = principal + atualizacao + juros + multa + honorarios
```

Também calcular:
- quantidade de títulos
- média de dias de atraso

---

## 12) Valor total a pagar

```
totalAPagar = totalDebitos + totalCustas
```

---

## 13) Taxa especial de juros por linha

Se a linha possuir taxa especial:
- substitui a taxa geral de juros.

---

## 14) Parcelamento (equivalente a `Calculos_Parcelamento`)

- Usa PMT.
- Comportamento deve diferenciar:
  - parcelas > 1
  - parcelas = 1
  - parcelas = 0 (à vista)

Regras adicionais obrigatórias:
- `Valor_total_Pago`:
  - se parcelas > 0 → `parcelas * valorParcela`
  - senão → `valorParcela`
- Parcelamento também calcula:
  - `Valor_Custas_Parcela`
  - `Valor_Final_Custas_Apos_Parcelamento`
- Honorários da parcela podem ser PMT da soma de honorários (conforme legado).

---

## 15) Arredondamento

- Implementar arredondamento numérico seguro.
- Prioridade: equivalência com o legado.
- Se houver divergência por regra de arredondamento do Excel/VBA, registrar e testar.

---

## 16) Mapa VBA → TS (contratos esperados)

> Observação: sem o fonte VBA no repositório, este mapa é **contratual** (baseado na descrição do legado).

- `Atualizacao_Monet` → `applyMonetaryUpdateLegacy(valor, dataIni, dataFim, indice)` → retorna `valorAtualizadoTotal` **ou 0 se índice = NENHUM**
- `Calcula_Juros` → `calculateInterestLegacy(valor, dataIni, dataFim, taxa, indices)` → retorna juros conforme regra mensal + ajuste por dia
- `Calcula_Juros_BrCond` → `calculateInterestBrCond(valor, dataIni, dataFim, taxa, indices)` → retorna juros diário sobre valor atualizado
- `Calculo_Linha_Taxas` → `calculateDebitLineLegacy(line, config, indices)` → retorna componentes na ordem do legado
- `Calculo_Linha_Custas_Judiciais` → `calculateCostLineLegacy(line, config, indices)`
- `Calculos_INICIAIS` → `calculateAllLegacy(input, config, indices, acceptedFlag)`
- `Calculos_Parcelamento` → `generateInstallmentsLegacy(totals, config)` (inclui custas por parcela)
- `Apurar_Honorarios_Adv_Total` → `computeTotalAttorneyFeesLegacy(result, acceptedFlag)`

---

## 17) Saída obrigatória (memória/auditoria)

A função principal deve retornar:
- etapas executadas e ordem aplicada
- datas efetivas usadas por linha (especial vs padrão)
- taxa usada por linha (taxa especial vs geral)
- bases de incidência usadas para multa/honorários
- lista de linhas “destacadas”

---

## 18) Testes obrigatórios (fidelidade)

- atualização monetária acumulada por mês
- atualização negativa sendo zerada
- juros do legado (mensal + ajuste por dia)
- juros BrCond (diário)
- multa (base = principal + atualização + juros; só se vencido)
- honorários fixos
- honorários variáveis (faixas 0/10/20)
- datas especiais (e marcação de destaque)
- taxa especial de juros por linha
- somatórios
- parcelamento com 0, 1 e N parcelas (incluindo custas por parcela)
- fluxo “aceito” vs “não aceito”

