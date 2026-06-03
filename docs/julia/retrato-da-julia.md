# Retrato da Júlia

Assistente-IA de triagem processual — design e plano faseado de implementação.

**Status:** documento vivo · **Atualizado:** 2026-06-03

---

**O que é este documento.** A consolidação de tudo que foi decidido sobre a Júlia como
assistente de IA que faz a triagem das movimentações processuais no sistema Villa Real. Reúne os
princípios, as faixas de autonomia, o motor de triagem, o monitoramento de acordos parcelados, a
camada de diálogo, a caixa de entrada e o acesso a documentos — mais um plano faseado de
implementação. Cada fase vira um prompt próprio pro Cursor, validado antes da próxima. Não é pra
ser construído de uma vez.

---

## 0. O princípio que governa tudo

A Júlia é **autônoma na análise e na organização interna; humana no comando do que sai pro mundo.**
O critério que separa o que ela faz sozinha do que ela apenas prepara é um só: **reversibilidade +
efeito externo.** O que é interno e reversível, ela faz e registra. O que sai pro mundo (tribunal,
cliente) ou é irreversível, ela prepara e você aciona.

Dois corolários que valem em toda a especificação:

- **Humildade epistêmica.** Quando a Júlia não tem como saber algo (por exemplo, se uma parcela foi
  paga direto na conta do cliente, fora do sistema), ela **pergunta** — não presume. A suspeita é
  hipótese, não fato.
- **Tudo auditável.** Toda autoria da Júlia carrega o selo "IA" e fica rastreável na tela Atividade.

---

## 1. Identidade (já implementado — Fase 1)

- Júlia é uma **usuária do tipo `ASSISTENTE_IA`** (id 100006, login `julia.assistente`,
  `permite_login = false`, perfil ASSISTENTE).
- Ela **participa na autoria** (cria históricos, andamentos, registros — tudo com selo IA), mas
  **nunca é dona, responsável, destinatária nem ocupa assento humano** (agenda, processo, tarefa,
  pagamento). Guarda no backend devolve erro se alguém tentar atribuí-la como destinatária.
- Identidade de serviço via `JuliaAssistenteContextService` — sem login de navegador.

---

## 2. As três faixas de autonomia

### Faz sozinha (interno, reversível, auditável)
- Ler e classificar movimentações.
- Ler documentos da pasta do processo no Drive.
- Resumir e avaliar impacto.
- Escrever no histórico do processo (selo IA).
- Cadastrar o **prazo processual** com a folga de 3 dias úteis (ver regra em §3).
- Cadastrar o **monitoramento** das datas de vencimento de parcelas de acordo.

### Prepara e espera 1 toque (rascunho-pra-aprovar)
- Mensagem ao cliente.
- Minuta / petição.
- **Proposta de cálculo** de inadimplência: montada na próxima dimensão livre do par
  (código + processo), gravada com `parcelamentoAceito = false` — ou seja, como **proposta**. Você
  revisa os números e aceita.

### Só sinaliza, não age (você decide e executa)
- Iniciar o **cumprimento de sentença** (peticionar é ato com efeito externo).
- Qualquer ação irreversível ou que saia pro mundo.
- **Qualquer caso de baixa confiança, versão divergente ou ambiguidade** — ela para e abre uma
  pergunta (ver §5), em vez de chutar.

---

## 3. Motor de triagem

### Gatilho
A triagem dispara quando uma **nova movimentação é ingerida** para um processo (a jusante do
monitoramento PROJUDI / orquestrador que já baixa as movimentações). Uma triagem por movimentação
nova. *(Decisão a confirmar — ver §10.)*

### Passos do raciocínio
1. **Reunir contexto.** Ler a movimentação. Quando o teor importa, ler o documento — preferindo a
   versão limpa fora da Movimentações ao OCR do scan (ver §7). Ler o histórico que a própria Júlia
   já escreveu no processo, para ter continuidade entre movimentações.
2. **Classificar** a movimentação.
3. **Avaliar impacto** para o cliente: FAVORAVEL / DESFAVORAVEL / NEUTRO / INDEFINIDO, com a base do
   julgamento.
4. **Determinar prazo**, distinguindo prazo **ativo** de prazo **condicional** (ver regra abaixo).
5. **Determinar a providência** ao cliente.
6. **Definir prioridade.**
7. **Decidir a ação** conforme a faixa de autonomia (§2).
8. **Confiança** na própria análise.

### Schema de saída da triagem
```json
{
  "classificacao": "string",
  "resumo": "string",
  "impactoCliente": "FAVORAVEL | DESFAVORAVEL | NEUTRO | INDEFINIDO",
  "baseImpacto": "string",
  "prazo": {
    "existe": true,
    "natureza": "ATIVO | CONDICIONAL",
    "tipo": "string",
    "gatilho": "string (o que faz o prazo correr / a condição que o dispara)",
    "diasUteis": 0,
    "dataReal": "yyyy-mm-dd",
    "dataTrabalho": "yyyy-mm-dd"
  },
  "providenciaCliente": "string",
  "prioridade": "ALTA | MEDIA | BAIXA",
  "acaoSugerida": "string",
  "confianca": 0.0
}
```

### Regra de prazo
- A `dataTrabalho` é agendada **3 dias úteis ANTES** da `dataReal`.
- O cálculo de dias úteis usa calendário **sem feriados** (só retira sábado e domingo). Resultado:
  a data calculada é sempre **≤ a real** — erra para o lado seguro.
- O prazo é cadastrado **sem aprovação humana** (faixa "faz sozinha"). A folga de 3 dias úteis é a
  própria salvaguarda; pedir aprovação aqui só defeitaria a automação.
- **Só `natureza = ATIVO` cadastra prazo fatal.** Quando um prazo só corre *se* algo acontecer
  (ex.: "15 dias para pagar *em caso de descumprimento*"), ele é `CONDICIONAL`: a Júlia registra a
  condição no `gatilho`, mas **não crava fatal** e não agenda `dataTrabalho`. Sentença favorável
  transitada em julgado não tem prazo processual ativo.

### Persistência da triagem
Cada triagem é **persistida** (entidade `julia_triagem`, migration `V84`, uma por movimentação),
guardando o JSON de
saída + o vínculo com a movimentação e o processo. É o que dá três coisas de uma vez:
- **memória/continuidade** — na movimentação seguinte, a Júlia relê a triagem anterior do processo;
- **fonte dos cards** da caixa de entrada (§6);
- **auditabilidade** — o raciocínio fica inspecionável, além do andamento que ela escreve.

---

## 4. Acordo e monitoramento de parcelas

A homologação de um acordo **não é ponto final — é uma bifurcação.** A Júlia lê a mov. do acordo
(preferindo a versão limpa, §7) e responde: **à vista ou parcelado?**

- **À vista, quitado** → encerra; monitoramento mínimo.
- **Parcelado** → abre obrigação contínua de fiscalização:
  1. Extrai da versão limpa o **cronograma de parcelas** (datas e valores) e as **cominações** do
     acordo (multa por atraso, vencimento antecipado, juros, índice).
  2. Cadastra o **monitoramento de cada vencimento** (faixa "faz sozinha").
  3. A cada vencimento, **verifica o adimplemento**.
  4. **Suspeita de inadimplência → NÃO monta o débito direto.** Abre uma pergunta na caixa de
     entrada (§5), porque ela não tem como saber se o pagamento caiu fora do sistema.
  5. **Confirmado o atraso →** monta o cálculo (parcelas em aberto + juros/correção + cominações do
     acordo + multa de 10% e penhora do art. 523 §1º CPC que a sentença comina) como **proposta**
     (`parcelamentoAceito = false`) na **próxima dimensão livre** do par (código + processo), e
     **sinaliza** o início do cumprimento de sentença (quem peticiona é o humano).

---

## 5. Camada de diálogo (o primitivo de pergunta)

Sempre que a Júlia está em dúvida — suspeita de atraso, versão de documento divergente, movimentação
ambígua, triagem de baixa confiança — ela **abre uma pergunta** na caixa de entrada, em vez de agir.

Fluxo:
1. Júlia detecta a dúvida e formula a pergunta (ex.: *"A parcela de [data] venceu e não tenho
   confirmação de pagamento. O atraso é real? Quer que eu monte o débito atualizado na próxima
   dimensão?"*).
2. Você responde em **linguagem livre**.
3. A resposta volta pela IA (`ClaudeApiService`), que **interpreta a intenção** e ramifica:
   - "sim, pode montar" → monta o cálculo como proposta (§4).
   - "não, ela pagou direto" → encerra a dúvida, marca como pago, sem cálculo.
   - "me lembre em uma semana" → **reagenda** a verificação (trilhos da agenda).
   - "ainda vou confirmar com o cliente" → a Júlia **propõe** um reagendamento.

**Guarda — eco de confirmação só nos ramos que doem.** Ramos benignos (adiar/reagendar) agem direto,
sem fricção. Ramos que custam (montar o débito; encerrar uma dúvida de atraso) devolvem o que a IA
entendeu antes de executar — *"entendi que você confirmou o atraso e quer o débito montado,
certo?"*. Um erro de interpretação aqui ou monta débito errado, ou encerra um atraso real (e o
cliente perde a cobrança). O eco é um **estado** do diálogo (a pergunta entra em "aguardando
confirmação" antes de executar), modelado no backend — não um detalhe de tela.

Este é um **primitivo reutilizável** — a forma padrão da Júlia consultar o humano em qualquer
incerteza, não só no atraso.

---

## 6. Caixa de entrada da Júlia

Uma **caixa de entrada única** da Júlia, com os cards classificados por dentro. Dois eixos:

- **Status (eixo estável):** *aguardando você* (perguntas + rascunhos pra aprovar), *postergado* (o
  que você adiou, com a data de volta), *concluído*. É a espinha da caixa; quase não muda.
- **Categoria (eixo solto, que cresce):** rótulo **livre/editável** (ex.: "pergunta de atraso",
  "rascunho de mensagem", "proposta de cálculo", "documento divergente") — **não** uma estrutura
  rígida no banco. Novos padrões viram novos rótulos, sem migração. Aprende-se a taxonomia com o uso.

Itens *postergado* voltam sozinhos para *aguardando você* na data marcada (trilhos da agenda — o
"me lembre em uma semana" é literalmente isso).

**Fronteiras (para não duplicar):**
- A **caixa da Júlia** = onde você **age** (precisa de você / em curso / adiado).
- A tela **Atividade** = o **registro auditável** de tudo que a Júlia fez (onde você fiscaliza).
- A **tabela de classificação de documentos** (§7) = interna e invisível.

A caixa é o **destino** do que a Júlia produz nas faixas "prepara" e "sinaliza". Nasce junto com a
fiação das ações, a jusante do motor de triagem.

---

## 7. Acesso e classificação de documentos

### Regra de localização
A pasta do processo é resolvida como **"Proc. {numeroInterno}"**. **Tudo que está sob ela**, em
qualquer subpasta, **pertence ao processo.** Estrutura: `[código cliente 8 díg.] / Proc. NN /
[nome do réu] / [outras pastas]`. A subpasta "Movimentações" guarda as versões juntadas/assinadas
(escaneadas).

### Preferir a versão limpa
Antes de imprimir para assinatura, o acordo (e outros documentos) foi redigido em **PDF pesquisável
ou Word**, que ficam **fora** da Movimentações. A Júlia lê essa versão limpa (texto nativo) em vez
de OCRar o scan — crucial para **números** (cronograma de parcelas), onde o OCR mais erra. Se não
existir versão limpa, ela cai graciosamente para a versão OCRada da Movimentações.

### Reconciliação de versões
A versão limpa (rascunho) **não é** automaticamente igual à versão juntada/assinada. A Júlia
confronta as duas e classifica:
- **Iguais** (a menos de espaços/acentos) → usa a limpa com confiança.
- **Divergências explicáveis como ruído de OCR** → mesma versão, usa a limpa.
- **Diferença substantiva** que o OCR não explica → **versão diferente** → sinaliza ao humano; a
  **juntada governa**.

### Tabela de classificação `julia_documento` (cache de documentos) — FINALIZADA na Fase 0
Para não gastar token de IA relendo a pasta toda hora: uma vez lido e classificado, um documento só
é relido se a referência mudar. O caso concreto (Proc. 100) ditou três decisões:

- **Procedência não é binária.** Um arquivo tem **três eixos independentes**: *localização*
  (`em_movimentacoes`), *legibilidade* (`fonte`: nativo vs scan) e *tipo*. "Original limpo" é
  derivado desses três, não um rótulo fixo — porque o mesmo arquivo pode ser o scan digitalizado
  para protocolo, presente tanto na pasta quanto repetido na Movimentações.
- **A fonte limpa pode ser composta.** Nem sempre há rascunho born-digital do acordo; às vezes os
  termos vêm da juntada OCRada e os números vêm de outro arquivo nativo (no Proc. 100, os boletos
  vieram `pdf-nativo` e limpos). A Júlia monta o quadro das peças legíveis disponíveis.
- **Invalidação por `md5Checksum`** (não nome+data); **classificação barata primeiro** (nome,
  caminho, localização), IA só nos ambíguos; `tipo_documento` é **string solta**, não enum rígido,
  para crescer com o uso.

Schema (migration `V86` — a `V85` ficou com o backfill de agenda; `V84` = `julia_triagem`):

```sql
CREATE TABLE julia_documento (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    processo_id BIGINT NULL,
    drive_file_id VARCHAR(120) NOT NULL,
    nome VARCHAR(500) NOT NULL,
    caminho_relativo VARCHAR(1000) NOT NULL,
    mime_type VARCHAR(120) NULL,
    md5_checksum VARCHAR(64) NULL,
    modified_time TIMESTAMP NULL,
    tamanho BIGINT NULL,
    em_movimentacoes BOOLEAN NOT NULL DEFAULT FALSE,
    fonte VARCHAR(20) NULL,
    tipo_documento VARCHAR(40) NULL,
    classificado_por VARCHAR(12) NULL,
    confianca DECIMAL(4,3) NULL,
    vinculo_file_id VARCHAR(120) NULL,
    status_reconciliacao VARCHAR(20) NULL,
    classificado_em TIMESTAMP NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_julia_documento_file (drive_file_id),
    KEY idx_julia_documento_processo (processo_id),
    KEY idx_julia_documento_md5 (md5_checksum)
);
```

**Oculta da UI** por padrão, mas **inspecionável/auditável** (uma classificação errada guia uma
decisão errada — tem que dar para ver o porquê).

---

## 8. Trilhos do sistema a reusar

| Necessidade | Peça existente |
|---|---|
| Raciocínio de IA + interpretar resposta livre | `ClaudeApiService` (`claude-sonnet-4-6`) |
| Agendar / reagendar (snooze, monitoramento) | `AgendaEventoEntity` / agenda |
| Prazo processual | `ProcessoPrazoEntity` + `ProcessoEntity.prazoFatal` |
| Histórico com selo IA | `ProcessoAndamentoEntity` |
| Cálculo de débito | `calculo_rodada`, `PUT /api/calculos/rodadas/{cod}/{proc}/{dim}`; parcelas e `panelConfig` no `payload_json`; flag `parcelamentoAceito` |
| Mensagem ao cliente (rascunho/agendada) | `WhatsAppAIService`, `ScheduledWhatsAppMessageEntity`, templates Meta |
| Ler arquivos da pasta + extrair texto | endpoints da sonda (`processo-arquivos`, `processo-arquivo-texto`) |

**Próxima dimensão livre** = o próximo inteiro de `dimensao` ainda sem dados para aquele par
(`codigoCliente`, `numeroProcesso`). Dimensão começa em 0 e vai ao infinito.

---

## 9. Plano de implementação faseado

Cada fase é um prompt próprio pro Cursor, validada no caso real (Proc. 100 / CNJ
`5252435-24.2026.8.09.0007`) antes da próxima.

- **Fase 0 — Sonda concreta (gate) — CONCLUÍDA.** Sonda rodada no Proc. 100; confirmado acordo
  **parcelado** (8× R$ 816,77, 05/06/2026→05/01/2027; descumprimento → vencimento antecipado +
  multa 30% + juros 1%/mês + honorários 20%). Schema `julia_documento` finalizado (§7) → migration
  `V86` (a `V85` ficou com o backfill de agenda).
- **Fase A — Núcleo da triagem — CONCLUÍDA (validada no caso real).**
  - **A1 — Raciocínio (✅).** Ingestão → `ClaudeApiService` → schema de triagem (§3) → resultado em
    memória, com recálculo de `dataTrabalho` no backend (nunca confiar na data do modelo). Validada
    na mov.24 (homologação): FAVORÁVEL, prazo CONDICIONAL, confiança 0.93.
  - **A2 — Enactment (✅).** O resultado vira ação: andamento (selo IA, autor Júlia) sempre; e — só
    quando `natureza=ATIVO` — prazo fatal (gravado em `dataFim`) + lembrete de agenda no responsável
    humano em `dataTrabalho` (folga de 3 dias úteis), com rolagem de fim de semana e guarda do
    cabeçalho `prazoFatal` (só atualiza se vazio/mais cedo). Idempotência por `publicacao_id`.
    Validado: prazo em 22/06 → trabalho 17/06; e a Júlia releu o andamento anterior e sinalizou
    incoerência (a memória funcionando).
  - **A2b parte 1 — Hook na ingestão (✅).** `PublicacaoVinculadaEvent` publicado em
    `patchVinculoProcesso` — ponto único onde email, orquestrador e vínculo manual convergem →
    listener `@TransactionalEventListener(AFTER_COMMIT)` + `@Async` → `triarPublicacaoSeElegivel`
    (flag `julia.triagem.auto.enabled`, default OFF; porta "tem processo?" + idempotência por
    `publicacao_id`). Validado de ponta a ponta numa decisão TRT real (pub 1846 / proc 8562),
    idempotente no re-disparo.
  - **A2b parte 2 — Dedup cross-pipeline (✅ núcleo).** Fingerprint semântico (`JuliaTriagemDedupUtil`,
    janela 72h) evita segunda triagem do mesmo fato (email + web PROJUDI). Prazo fatal: não duplica no
    mesmo `(processo, dataFim)`. Andamento: omitido se título equivalente recente (168h, origem
    `JULIA_TRIAGEM`). Classificações genéricas do PROJUDI não viram título de andamento — usa o
    resumo jurídico quando a classificação é rotulo de aviso.
  - **A3 — Audiência (✅).** Campo `audiencia` no JSON da triagem; enactment em
    `audiencia_data/hora/tipo` do processo + réplica na agenda dos colaboradores humanos (confiança
    mínima configurável: `julia.triagem.audiencia.confianca-minima`).
- **Fase B — Documentos na triagem (parcial ✅).** `JuliaTriagemContextoDriveService` lê PDFs da pasta
  Movimentações (últimas 3 + match por termos do e-mail, até 12 arquivos / limites de chars) e injeta
  o bloco `=== DOCUMENTOS MOVIMENTAÇÕES ===` no prompt. Prompt proíbe classificação superficial
  copiada do aviso PROJUDI. Pendente: versão limpa fora de Movimentações, reconciliação OCR vs limpo,
  re-triagem automática quando o PDF chega após o vínculo.
- **Fase C — Caixa de entrada.** Entidade + tela (§6): eixo status estável + categoria solta.
  Destino das saídas.
- **Fase D — Camada de diálogo.** Pergunta → resposta livre interpretada pela IA → ramos, com o eco
  de confirmação nos ramos que doem e o snooze pela agenda (§5).
- **Fase E — Parcelas e cálculo.** Monitoramento dos vencimentos + proposta de cálculo na próxima
  dimensão livre (`parcelamentoAceito = false`) no atraso confirmado + sinalização do cumprimento
  de sentença (§4).

---

## 10. Decisões em aberto

- **Gatilho exato da Júlia — RESOLVIDO (A2b parte 1).** Hook único em `patchVinculoProcesso` (onde
  email, orquestrador e vínculo manual convergem): publica `PublicacaoVinculadaEvent`, tratado por
  listener `@TransactionalEventListener(AFTER_COMMIT)` + `@Async`. Só publicações que ganham processo
  são triadas (sem processo, sem contexto).
- **Memória / continuidade.** Resolvido pela entidade `julia_triagem` (§3): a Júlia relê a triagem
  anterior do processo + os próprios andamentos. Sem entidade nova além dessa.
- **Tom das mensagens ao cliente.** É a sua voz/marca — calibrar com exemplos reais antes de a Júlia
  redigir.
- **Schema da tabela de documentos.** Gated na Fase 0 (caso concreto).

---

## 11. Dívidas de pré-produção (acumuladas)

- Remover endpoints TEMP e o `permitAll` de `/api/projudi/admin/**` (backfill-submenu,
  drive-pdf-texto, ocr-backfill, processo-arquivos, processo-arquivo-texto, orquestrador/run).
- Trocar a senha PROJUDI (foi exposta) e regenerar `PROJUDI_CRED_KEY`.
- Setar `GOOGLE_DRIVE_IMPERSONATE_USER` no servidor.
- OCR na VPS: dependências instaladas (feito) — falta smoke test de OCR no deploy + limpeza
  pré-produção.
- Revisar a senha de seed da Júlia (inerte com `permite_login = false`).
- `perfil_id = 3` hardcoded.
- `processo-arquivo-texto` aceita `fileId` puro sem validar o CNJ.
- **Flag `julia.triagem.auto.enabled`:** manter `false` no `application.properties` base; o `true`
  só no perfil `dev` (`application-dev.properties`) até a dedup (A2b parte 2) entrar — senão a
  triagem automática liga em produção sem proteção contra prazo duplicado do PROJUDI.
- Limpar `julia_triagem` sintéticas remanescentes (linhas com `publicacao_id` NULL dos testes
  manuais) antes de produção.
- Corrigir o teste `AgendaEventoConteudoKeyUtilTest` (quebrado).
- Bug conhecido da sonda: `ehMovimentacoes` só olha o 1º segmento do caminho (marcar se QUALQUER
  segmento for "Movimentações").
