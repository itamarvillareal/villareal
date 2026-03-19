## Revisão do fluxo VBA colado — ajustes/pegadinhas de fidelidade

Este documento complementa `docs/legacy-calculo-vba-spec.md` com observações diretas do trecho VBA enviado.

### 1) `Arredondamento` não arredonda (trunca)
- Implementação: `Mid(..., InStr(Numero, ",") + Decimais)`.
- Consequência: `1,239` com 2 decimais vira `1,23` (não `1,24`).
- Se migrar para `Math.round`, **vai divergir**.

### 2) `Calcula_Juros_BrCond` ignora taxa de entrada
- Mesmo recebendo `Tx_Juros`, o código faz `Taxa_Juros = 1`.
- Ou seja: taxa efetiva fixa (1) sempre.
- Se “corrigir” isso na migração, **mudará o resultado**.

### 3) Índice mensal vazio vira 0 (em `Calcula_Juros`)
- Em `Calcula_Juros`, se `dado_lido = ""` então `dado_lido = 0`.
- No `Atualizacao_Monet`, o código faz `s = (dado_lido + 0)` (coerção), então vazio tende a virar 0 também, mas é uma sutileza de VBA.

### 4) Atualização monetária: retorna valor atualizado total
- `Atualizacao_Monet` retorna `f = Arredondamento(Calculo, 2)`.
- A linha grava acréscimo como `a - ValorOriginal` e zera se negativo.

### 5) Datas especiais (atualização e juros) são chaves diferentes
- Atualização: `.141` (inicial) e `.145` (final)
- Juros: `.142` (inicial) e `.146` (final)
- Taxa especial de juros: `.143`
- Se qualquer especial usada: `LinhasColorir(Linha) = "SIM"`.

### 6) Multa e honorários: bases e ordem confirmadas
- Multa só se vencimento < data do cálculo, senão 0.
- Multa base: principal + atualização + juros.
- Honorários base: principal + atualização + juros + multa.
- Honorários variáveis: 0/10/20 por faixas de atraso.

### 7) Parcelamento: casos 0 / 1 / >1 são diferentes
- >1: `Valor_Final_da_Parcela = PMT(...)` e `ParcelaHonorarios = PMT(Soma_Honorarios_Variant)`
- =1: honorários parcela usa fórmula proporcional específica (não PMT)
- =0: à vista, parcela valor = total a pagar e honorários = soma honorários

### 8) “Loops sentinela” (parar por 10 vazios)
Nos carregamentos (`CarregarTaxas...`, `CarregarCustas...`, `CarregarParcelamentos...`) existe:
- `b` incrementa quando um conjunto de campos anteriores está vazio
- termina quando `b` chega a 10 (o `Do While b - 10` vira 0)
Isso deve virar uma regra explícita no loader/adapter, ou um limite determinístico.

### 9) “Aceito vs não aceito” está explícito no trecho
- Aceito: `Ler_Todas_Informacoes_Gerais` + somatórios.
- Não aceito: recalcula linhas + soma + calcula parcelamento + soma.

### 10) Persistência real do legado: banco = arquivos `.txt` por chave
No módulo 2, a função `avaliacao`:
- chama `Definir_File_Path`, que mapeia `Formulario` + `Nome_do_Txt` para um caminho de arquivo
- em modo leitura (`leitura = "Sim"`): abre o arquivo e lê **uma linha**
- em modo gravação: escreve/atualiza a linha, ou apaga o arquivo se o valor for vazio

Isso explica a “base” do sistema:
- não é planilha apenas: é um **repositório** por arquivo, com chaves compostas.

Na migração, isso precisa virar um adapter claro:
- `LegacyStore.get(key)` / `LegacyStore.set(key, value)` / `LegacyStore.delete(key)`
- e testes com fixtures para garantir equivalência.

### 11) `Salvar_Todas_Informacoes` é o “commit” do cálculo aceito
No módulo 1, `Aceitar_Pagamento`:
- grava `Calculo_Foi_Aceito = "SIM"` em `.105.1.Proc`
- chama `Salvar_Todas_Informacoes`

E `Salvar_Todas_Informacoes` salva:
- linhas de taxas: `.104` (atual), `.105` (dias atraso), `.106` (juros), `.107` (multa), `.108` (honorários)
- linhas de custas: `.112` (atual), `.113` (juros)
- parcelamento: `.123` (venc), `.139` (pag), `.140` (obs), `.124` (valor), `.125` (honorários)
- além de totais: `.111` (data cálculo), `.114` (valor parcela), `.115` (total pago), `.116` (honorários parcela), `.117` (custas parcela), `.118` (custas após parc), `.119` (total taxas), `.120` (total custas), `.121` (total a pagar), `.122` (taxa parc), `.128` (índice)

Isso precisa ser modelado como um **snapshot persistido** quando o cálculo é aceito.

