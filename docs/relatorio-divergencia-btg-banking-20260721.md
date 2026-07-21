# Relatório de divergência — Extrato conta corrente BTG Pactual

**Data do relatório:** 21 de julho de 2026  
**Elaborado por:** Itamar Alexandre Felix Villa Real Junior  
**Destinatário:** BTG Pactual — SAC / Ouvidoria  

---

## 1. Identificação da conta

| Campo | Informação |
|-------|------------|
| Titular | Itamar Alexandre Felix Villa Real Junior |
| CPF | 007.332.351-90 |
| Agência | 20 |
| Conta corrente | 454069-1 |
| Instituição | BTG Pactual S.A. — CNPJ 30.306.294/0002-26 |
| Período analisado | 21/07/2020 a 21/07/2026 |
| Data de emissão do extrato (PDF) | 21/07/2026 |

**Documentos utilizados como base:**

1. `Extrato_2020-07-21_a_2026-07-21_00733235190.pdf` (extrato completo)  
2. `Extrato_2026-04-22_a_2026-07-21_00733235190.pdf` (extrato parcial — conferência cruzada)

---

## 2. Objeto da solicitação

Solicito a **análise e esclarecimento formal** de divergência de **R$ 0,53 (cinquenta e três centavos)** entre:

- o **Saldo Diário** declarado no rodapé do extrato em **21/07/2026**; e  
- a **soma aritmética de todos os lançamentos** constantes no mesmo extrato, linha a linha.

Trata-se de diferença persistente no **saldo final**, não de lançamentos ausentes ou duplicados na listagem de movimentos.

---

## 3. Resumo executivo

| Indicador | Valor |
|-----------|-------|
| Total de movimentos no extrato (linhas de transação) | **1.514** |
| Soma algébrica dos movimentos (conforme valores exibidos no PDF) | **-R$ 38.839,92** |
| Saldo Diário em 21/07/2026 (rodapé do extrato) | **-R$ 38.839,39** |
| Cabeçalho “Lançamentos:” no PDF | **-R$ 38.839,39** |
| **Divergência (Soma dos movimentos − Saldo Diário)** | **-R$ 0,53** |

**Conclusão preliminar:** os valores individuais de cada lançamento, quando somados na ordem do extrato, **não reproduzem** o Saldo Diário informado pelo banco na mesma data. A divergência acumula-se ao longo do histórico e estabiliza-se em **R$ 0,53** a partir de **17/07/2026**.

---

## 4. Metodologia de conferência

A análise foi realizada da seguinte forma:

1. **Extração textual** dos PDFs oficiais emitidos pelo BTG (formato app: *Data e hora | Categoria | Transação | Descrição | Valor*).  
2. **Parsing automatizado** de cada linha de movimento, desconsiderando:
   - linhas “Saldo Diário”;
   - cabeçalhos de página (“Lançamentos:”, metadados de emissão);
   - totais e rodapés institucionais.  
3. **Conferência linha a linha** de data e valor (1.514 registros × 1.514 movimentos no PDF).  
4. **Comparação cumulativa** entre:
   - saldo reconstruído pela soma dos movimentos; e  
   - Saldo Diário declarado ao fim de cada dia com fechamento no extrato.  
5. **Validação cruzada** com extrato parcial (abr–jul/2026): 297 movimentos, valores idênticos ao extrato completo no mesmo intervalo.

Nenhum ajuste manual de valores foi aplicado. A conferência limitou-se aos dados explicitamente constantes no extrato.

---

## 5. Achados detalhados

### 5.1. Divergência no saldo final (21/07/2026)

Movimentos do dia **21/07/2026** conforme extrato:

| Horário | Descrição (resumo) | Valor exibido |
|---------|-------------------|---------------|
| 09h49 | Investimentos — Transferência enviada | -R$ 55.000,01 |
| 10h40 | Investimentos — Transferência recebida | +R$ 1.907,71 |
| 10h44 | Pix recebido | +R$ 14.252,90 |
| **Saldo Diário 23h59** | | **-R$ 38.839,39** |

**Saldo imediatamente anterior (20/07/2026, Saldo Diário):** R$ 0,01  

**Soma dos movimentos de 21/07/2026:** -R$ 38.839,40  
**Saldo esperado (0,01 − 38.839,40):** -R$ 38.839,39 ✓ (fecha com Saldo Diário **se** o saldo anterior for R$ 0,01)

Porém, a **soma cumulativa de todos os 1.514 movimentos** desde o início do extrato (21/07/2023) resulta em **-R$ 38.839,92**, e não **-R$ 38.839,39**.

---

### 5.2. Estabilização da divergência em R$ 0,53 (jul/2026)

| Data | Saldo Diário (PDF) | Soma cumulativa dos movimentos | Diferença |
|------|-------------------|--------------------------------|-----------|
| 14/07/2026 | R$ 0,00 | -R$ 0,46 | -R$ 0,46 |
| 15/07/2026 | R$ 47.308,32 | R$ 47.307,86 | -R$ 0,46 |
| **17/07/2026** | **R$ 0,00** | **-R$ 0,53** | **-R$ 0,53** |
| 20/07/2026 | R$ 0,01 | -R$ 0,52 | -R$ 0,53 |
| 21/07/2026 | -R$ 38.839,39 | -R$ 38.839,92 | **-R$ 0,53** |

A partir de **17/07/2026**, a diferença entre a soma dos movimentos e o Saldo Diário permanece constante em **R$ 0,53**.

---

### 5.3. Lançamento em 17/07/2026 — valor exibido × efeito no saldo

| Campo | Valor |
|-------|-------|
| Saldo Diário em 15/07/2026 | R$ 47.308,32 |
| Movimento em 17/07/2026 (13h42) — Transferência enviada | **-R$ 47.308,39** (valor exibido na linha) |
| Saldo Diário em 17/07/2026 | **R$ 0,00** |

**Cálculo:**

- Se aplicado o valor exibido: 47.308,32 − 47.308,39 = **-R$ 0,07**  
- Saldo Diário declarado: **R$ 0,00**  

Há indício de que o **efeito contábil** da transferência (-R$ 47.308,32) difere do **valor exibido** na linha (-R$ 47.308,39), com diferença de **R$ 0,07**.

---

### 5.4. Lançamento em 09/04/2026 — mesma natureza

| Campo | Valor |
|-------|-------|
| Saldo Diário em 08/04/2026 | R$ 151.947,14 |
| Movimento em 09/04/2026 (09h50) — Transferência enviada | **-R$ 151.947,21** |
| Saldo Diário em 09/04/2026 | **R$ 0,00** |

**Cálculo:**

- Se aplicado o valor exibido: 151.947,14 − 151.947,21 = **-R$ 0,07**  
- Saldo Diário declarado: **R$ 0,00**  

Novamente, o saldo fecha em zero apenas se o débito efetivo for **-R$ 151.947,14** (e não **-R$ 151.947,21**).

---

### 5.5. Residual histórico — 09/11/2023

| Campo | Valor |
|-------|-------|
| Saldo Diário em 08/11/2023 | R$ 32.163,54 |
| Movimento em 09/11/2023 (08h18) — Pix enviado | **-R$ 32.163,54** |
| Saldo Diário em 09/11/2023 | **R$ 0,04** (e não R$ 0,00) |

Após um pagamento que, pelos valores exibidos, deveria zerar o saldo, o **Saldo Diário registra R$ 0,04** sem linha de movimento correspondente nessa data.

---

### 5.6. Par de movimentos com divergência de 1 centavo — 14/07/2026

No mesmo minuto (20h54):

| Tipo | Valor exibido |
|------|---------------|
| Pix enviado | -R$ 86.079,**11** |
| Transferência recebida (Investimentos) | +R$ 86.079,**12** |

Diferença de **R$ 0,01** entre débito e crédito aparentemente relacionados, sem linha explicativa no extrato.

---

### 5.7. Observação sobre cabeçalho “Lançamentos:”

O extrato completo repete, em cada página (~60 vezes), o cabeçalho:

> **Lançamentos: -R$ 38.839,39**

Esse valor **coincide com o Saldo Diário final**, mas **não coincide** com a soma algébrica das linhas de movimento (-R$ 38.839,92). Sugere-se esclarecer se o campo “Lançamentos” representa saldo, soma de movimentos ou outro indicador.

---

## 6. O que **não** foi identificado

Para registro, a análise **não** encontrou:

- lançamentos presentes no extrato e ausentes na contabilidade interna do titular;  
- lançamentos duplicados por reimportação;  
- divergência de valores em movimentos individuais entre os dois PDFs fornecidos;  
- diferença no período recente (22/04–21/07/2026): **297 movimentos**, soma idêntica nos dois documentos.

---

## 7. Solicitações ao BTG Pactual

Solicito, por favor:

1. **Esclarecimento formal** da origem dos **R$ 0,53** de diferença entre a soma dos movimentos exibidos e o Saldo Diário de **21/07/2026**.  
2. **Confirmação** se houve arredondamento, saldo remunerado, tarifa ou outro componente **não listado como movimento** que explique:
   - o residual de **R$ 0,04** em **09/11/2023**;  
   - a diferença de **R$ 0,07** nos débitos de **09/04/2026** e **17/07/2026**;  
   - a diferença de **R$ 0,01** no par de movimentos de **14/07/2026**.  
3. **Indicação** de qual valor deve ser considerado oficial para fins de conciliação contábil:
   - o **Saldo Diário** do rodapé; ou  
   - a **soma dos lançamentos** linha a linha.  
4. **Retificação do extrato** ou emissão de **extrato retificado**, caso se confirme inconsistência interna no documento.  
5. **Orientação** sobre como tratar, em extratos futuros, diferenças entre valor exibido na linha e efeito no Saldo Diário.

---

## 8. Documentação anexa sugerida

Anexar ao protocolo junto ao banco:

- [ ] Extrato completo PDF (`Extrato_2020-07-21_a_2026-07-21_00733235190.pdf`)  
- [ ] Extrato parcial PDF (`Extrato_2026-04-22_a_2026-07-21_00733235190.pdf`)  
- [ ] Planilha/planilhamento com os 1.514 movimentos e saldo cumulativo (se solicitado pelo banco)  
- [ ] Este relatório  

---

## 9. Canais de contato BTG (conforme extrato)

| Canal | Contato |
|-------|---------|
| Ouvidoria | 0800-722-0048 |
| E-mail | ouvidoria@btgpactual.com |
| SAC | sac@btgpactual.com (conforme rodapé institucional) |

---

## 10. Declaração

Declaro que os valores e datas citados neste relatório foram obtidos **exclusivamente** dos extratos oficiais emitidos pelo BTG Pactual em **21/07/2026**, sem alteração manual de quaisquer lançamentos. A presente comunicação visa exclusivamente a regularização e o esclarecimento da divergência apontada.

&nbsp;

_______________________________  
**Itamar Alexandre Felix Villa Real Junior**  
CPF 007.332.351-90  
Conta 454069-1 — Agência 20  
Goiânia, 21 de julho de 2026
