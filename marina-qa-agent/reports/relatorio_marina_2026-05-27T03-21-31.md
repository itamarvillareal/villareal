# 🔍 Relatório de Auditoria UX — Marina QA Agent

**Data:** 27/05/2026, 00:21:31
**Portal:** http://localhost:5173
**Usuária:** Marina Teste (IA)

---

## 📊 Resumo Executivo

**Nota média geral: 3.5/10**

| Tela | Nota | Resumo |
|------|------|--------|
| Dashboard / Tela Inicial | -/10 | - |
| Administração de Imóveis | -/10 | - |
| Pessoas | 4/10 | A tela tem uma estrutura visual com potencial, mas está comprometida por um problema grave de navegação (clicou em Pessoas, abriu Imóveis), texto explicativo inacessível para usuários não técnicos, nomes truncados, valor suspeito sem alerta e botões com nomes abreviados — no conjunto, é uma tela que confundiria e insegurizaria qualquer secretária nova no primeiro dia. |
| Clientes | 4/10 | A tela tem boas intenções mas execução confusa: abre com dados de outro cliente sem avisar, tem dois controles de edição duplicados, botões com cores sem critério e falta o botão mais básico de todos — 'Novo Cliente' e 'Salvar' — o que tornaria meu trabalho diário frustrante desde o primeiro dia. |
| Processos | -/10 | - |
| Calcular | -/10 | - |
| Agenda | 4/10 | A tela tem uma ideia interessante de mostrar dois dias lado a lado, mas está completamente comprometida pela duplicação desnecessária dos painéis laterais, pelos cards escuros que parecem erro crítico, pelo botão 'Pendente' sem sentido e pela ausência de marcações visuais no calendário — para uma secretária iniciante, essa tela gera mais dúvidas do que resolve. |
| Atividades em Lote | 2/10 | Tela completamente inacessível para uma usuária não-técnica: a presença de código Python, comandos MySQL e endpoints de API expostos diretamente na interface é um erro grave de design que intimida e confunde; a única funcionalidade útil (importar PDF) está mal sinalizada e sem botão visível, tornando a tela praticamente inutilizável sem treinamento técnico especializado. |
| Financeiro | 2/10 | Uma tela técnica demais para o público errado, que ainda aparece no lugar errado: cheia de jargões de desenvolvedor, sem ações claras, sem histórico e sem feedback — praticamente inutilizável para uma secretária no dia a dia. |
| Pagamentos | -/10 | - |
| Pendências | 3/10 | A tela de Pendências chega com erro técnico exposto, colunas vazias e sem orientação ao usuário — para uma secretária nova, é desorientador e inutilizável no estado atual. |
| Tópicos | 2/10 | Tela quebrada na largada — o erro técnico exposto logo no topo, colunas vazias sem explicação e ausência de qualquer orientação ao usuário transformam esta tela em uma experiência de frustração e insegurança para uma secretária iniciante, que não tem como saber se o problema é dela ou do sistema. |
| Diagnósticos | 4/10 | A tela mistura duas funcionalidades distintas, usa linguagem técnica inacessível, tem nome de menu completamente inadequado ('Diagnósticos') e não dá nenhum contexto sobre o que cada opção faz — uma secretária sem treinamento ficaria perdida e com medo de clicar na coisa errada. |
| WhatsApp | 6/10 | Dashboard visualmente limpo e com boas intenções, mas falha onde mais importa: não diz se a integração com o WhatsApp está funcionando, deixando a secretária sem saber se os zeros significam 'tudo bem' ou 'algo está quebrado'. |
| Integrações (lab) | 2/10 | Uma tela criada por e para desenvolvedores que foi colocada no sistema sem nenhuma adaptação para usuários comuns — é tecnicamente funcional, mas completamente inutilizável por uma secretária sem formação técnica, expondo código bruto e jargões de programação onde deveria haver uma interface simples de busca de processos. |
| Usuários | 5/10 | Tela funcional mas claramente feita para administradores técnicos, não para secretárias: linguagem técnica no cabeçalho, botão destrutivo 'Inativar' sem proteção visual, jargões como 'API' e 'espelho em segundo plano' espalhados pela interface — precisa de uma revisão séria de linguagem e segurança de ações para ser usada com confiança no dia a dia. |

---

## 🚨 Problemas Críticos e de Alta Severidade

### 1. [CRITICA] Pessoas
- **Problema:** Eu cliquei em 'Pessoas' no menu e fui parar numa tela de Imóveis. A navegação não levou para onde eu esperava — o sistema ignorou meu clique ou me redirecionou de forma inexplicável.
- **Impacto:** Gera desconfiança no sistema desde o primeiro uso. Eu ficaria sem saber se cliquei errado ou se o sistema tem um bug. Poderia perder tempo tentando entender o que aconteceu.
- **Sugestão:** Garantir que cada item do menu leva para a seção correspondente. Se 'Pessoas' foi clicado, a tela de listagem de pessoas deve abrir. Revisar o comportamento de navegação de todos os itens do menu.

### 2. [ALTA] Pessoas
- **Problema:** O bloco de texto explicativo no topo é longo, técnico e cheio de jargões ('API ativa', 'planilha de importação', 'coluna A', 'consolidação mensal'). Para uma secretária nova, isso é incompreensível e intimida.
- **Impacto:** Eu leria esse texto e não entenderia nada. Poderia me sentir incapaz de usar o sistema, o que gera insegurança no trabalho.
- **Sugestão:** Substituir o texto técnico por uma instrução simples e objetiva, como 'Gerencie os imóveis administrados pelo escritório. Cadastre locação, proprietário e inquilino.' Detalhes técnicos sobre API podem ir em uma tela de ajuda separada, acessível por um ícone de '?'.

### 3. [ALTA] Pessoas
- **Problema:** Os nomes no card de Proprietário ('ITAMAR ALEXANDRE FELIX VILLA REAL...') e Inquilino ('ADELAIDE MARIA JERONIMO PEREIRA...') estão cortados com reticências. Não consigo ver o nome completo sem clicar.
- **Impacto:** Em um escritório de advocacia, o nome completo é essencial para identificar a pessoa certa. Um nome cortado pode causar confusão, especialmente se houver pessoas com nomes parecidos.
- **Sugestão:** Aumentar a largura dos cards ou reduzir o tamanho da fonte para exibir o nome completo. Alternativamente, ao passar o mouse sobre o nome truncado, mostrar o nome completo em um tooltip.

### 4. [ALTA] Pessoas
- **Problema:** O valor do aluguel é R$ 26,00 — um valor extremamente baixo para um imóvel, o que parece um dado incorreto ou de teste. O sistema não emite nenhum alerta ou indicação visual de que pode ser um valor inconsistente.
- **Impacto:** Se for um erro de cadastro, ele passa despercebido. Valores errados podem gerar cobranças incorretas aos clientes, causando problemas jurídicos e financeiros ao escritório.
- **Sugestão:** Implementar validação com alerta visual (ícone de atenção) quando o valor de aluguel for muito baixo ou incomum para o contexto. Pode ser uma faixa configurável pelo administrador.

### 5. [CRITICA] Clientes
- **Problema:** A tela abre já com um cliente carregado (Alexandra, cód. 00000001) sem que eu tenha pesquisado nada. Não fica claro se é um exemplo, o último cliente acessado ou algo que não devia estar aqui.
- **Impacto:** Posso confundir os dados dessa cliente com o que estou tentando fazer, ou pior: editar sem querer o cadastro dela achando que estou criando um novo.
- **Sugestão:** A tela deveria abrir limpa, só com a barra de busca ativa, e só mostrar o formulário após uma pesquisa ou clique em 'Novo Cliente'.

### 6. [CRITICA] Clientes
- **Problema:** O campo 'Pessoa: 64' não faz sentido algum para mim. O que significa esse número 64? É uma ID interna? Por que está separado do nome?
- **Impacto:** Não vou entender o que preencher aqui se precisar criar um cliente novo. Posso deixar errado sem saber.
- **Sugestão:** Substituir ou complementar com um rótulo mais descritivo como 'ID Pessoa (interno)' ou integrar esse campo com o de Nome/Razão Social, tornando-o invisível para o usuário final.

### 7. [CRITICA] Clientes
- **Problema:** Há dois controles de edição separados e confusos: o badge 'Edição bloqueada' no card roxo E o checkbox 'Edição Desabilitada' marcado no formulário. São a mesma coisa? Por que aparecem duas vezes em lugares diferentes?
- **Impacto:** Não sei se preciso desmarcar os dois para editar, ou se um controla o outro. Posso tentar editar e não conseguir sem entender o motivo.
- **Sugestão:** Unificar em um único controle de edição, com botão claro: 'Habilitar Edição' ou um cadeado clicável, e remover a duplicidade.

### 8. [ALTA] Clientes
- **Problema:** Os 5 botões de ação ('Cadastro de Pessoas', 'Conta Corrente', 'Qualificação', 'Documentos', 'Configurações de cálculo') têm cores diferentes sem critério aparente — verde, roxo, amarelo, azul-escuro. Não entendo por que cada um tem uma cor.
- **Impacto:** Não sei qual botão é mais importante ou qual devo usar primeiro. As cores parecem aleatórias e não criam uma hierarquia de ações.
- **Sugestão:** Adotar um padrão de cores com significado: ação principal em destaque (ex: azul), ações secundárias em cinza, ações destrutivas em vermelho. Ou agrupar os botões por categoria.

### 9. [ALTA] Clientes
- **Problema:** Não há botão visível de 'Novo Cliente' ou 'Cadastrar'. Para uma secretária nova, como eu, a principal dúvida é: como adiciono um cliente do zero?
- **Impacto:** Vou perder tempo procurando como cadastrar um cliente novo. Posso até ir no menu lateral em 'Nova pessoa' sem saber que devia usar esta tela.
- **Sugestão:** Adicionar um botão 'Novo Cliente' bem visível, preferencialmente no cabeçalho ou próximo à barra de busca.

### 10. [ALTA] Clientes
- **Problema:** A seção 'PROCESSOS DO CLIENTE' aparece só como um banner azul com instrução, sem mostrar nenhum dado. Se o cliente tem processos, eles deveriam ser visíveis sem precisar rolar ou interagir.
- **Impacto:** Não sei quantos processos essa cliente tem. Preciso rolar a tela para baixo para ver alguma informação útil, o que quebra o fluxo de trabalho.
- **Sugestão:** Mostrar um resumo dos processos diretamente (número, status, data), com a grade carregada automaticamente ao selecionar o cliente.

### 11. [CRITICA] Agenda
- **Problema:** A tela está completamente duplicada — existe uma coluna esquerda E uma coluna direita idênticas (calendário + data + usuários + botão 'Usuários'), diferindo apenas pela data selecionada (27 vs 28). Isso consome metade da largura da tela com redundância total.
- **Impacto:** Causa confusão imediata: a usuária não sabe se são seções diferentes, se é um bug ou se tem alguma funcionalidade oculta. Desperdiça espaço que poderia mostrar mais compromissos ou uma agenda semanal.
- **Sugestão:** Ter UM único painel lateral com o calendário e a seleção de data/usuário. Os dois dias (hoje e próximo) no centro já cumprem o papel de mostrar datas diferentes. Eliminar a coluna direita ou transformá-la em algo útil (ex: lista de pendências da semana).

### 12. [CRITICA] Agenda
- **Problema:** Os cards de 'Sem eventos' têm fundo vinho/marrom escuro muito carregado, parecendo um estado de erro grave ou alerta crítico. Uma agenda vazia não é um problema — é uma situação normal.
- **Impacto:** A secretária pode achar que algo deu errado no sistema ao ver esses cards tão sombrios. Visualmente pesado e desmotivador para usar no dia a dia.
- **Sugestão:** Substituir o fundo escuro por um card branco ou cinza claro com ícone neutro e mensagem amigável como 'Nenhum compromisso agendado para este dia. Que tal adicionar um?' com a cor de fundo em tom suave.

### 13. [ALTA] Agenda
- **Problema:** O formulário 'NOVO COMPROMISSO' está sempre visível mesmo quando a agenda está vazia, misturado ao card de 'sem eventos'. Não há botão explícito como '+ Adicionar compromisso' — o formulário simplesmente aparece colado abaixo do card escuro.
- **Impacto:** A usuária pode não perceber que ali é possível cadastrar um compromisso. O campo de hora já vem preenchido com '14:30' sem explicação, o que confunde: 'esse horário é fixo? Posso mudar?'
- **Sugestão:** Adicionar um botão visível '+ Novo Compromisso' que, ao clicar, expande o formulário. O horário padrão '14:30' deve estar claramente editável ou ter um placeholder como 'HH:MM'.

### 14. [ALTA] Agenda
- **Problema:** O botão 'Pendente' ao lado do formulário de novo compromisso não está claro. Pendente do quê? É o status do compromisso? É um botão para salvar? Para marcar como pendente?
- **Impacto:** A secretária não vai saber o que esse botão faz antes de clicar. Se for o botão de salvar, o nome está completamente errado. Isso pode levar a compromissos salvos com status errado.
- **Sugestão:** Renomear para 'Salvar' ou 'Agendar' se for o botão de confirmar. Se for uma opção de status, transformar em um select/dropdown com opções: Confirmado, Pendente, Cancelado.

### 15. [ALTA] Agenda
- **Problema:** Não há como ver os compromissos de outros dias sem navegar pelo calendário. A tela mostra só hoje e amanhã. Se eu precisar ver o que tem na próxima semana, não é intuitivo como fazer isso.
- **Impacto:** Para uma secretária que precisa planejar semanas, isso exige muitos cliques para navegar dia a dia.
- **Sugestão:** Adicionar uma visualização de semana ou pelo menos uma lista dos próximos 5 dias com indicador de quantidade de compromissos por dia.

### 16. [CRITICA] Atividades em Lote
- **Problema:** A caixa de 'Histórico de processos' está repleta de comandos técnicos de programação: script Python, comandos MySQL, paths de sistema e endpoints de API (DELETE /api/condominio...). Isso não faz o menor sentido para uma secretária.
- **Impacto:** Causa confusão imediata, medo de usar a tela e sensação de que o sistema foi feito para técnicos de TI, não para o usuário final. Eu simplesmente ignoraria esse bloco sem saber que ele pode ser importante.
- **Sugestão:** Esse conteúdo técnico deveria estar em uma área restrita a administradores ou desenvolvedores, completamente oculta para perfis como o meu (secretária). Se precisar aparecer, deveria estar em uma aba 'Avançado' ou 'Administração' com aviso de que é para uso técnico.

### 17. [CRITICA] Atividades em Lote
- **Problema:** O card 'Importar inadimplência condominial (PDF)' não tem nenhum botão visível — parece um texto informativo, não uma ação clicável. Não dá pra saber se clico no card inteiro, se tem um botão escondido ou se precisa fazer outra coisa.
- **Impacto:** A tarefa principal da tela fica inacessível porque não consigo identificar como iniciá-la. Ficaria clicando aleatoriamente tentando descobrir.
- **Sugestão:** Adicionar um botão explícito e destacado dentro do card, como 'Iniciar Importação' ou 'Selecionar PDF', com cor chamativa (verde ou azul). O card precisa ter aparência claramente interativa (hover, sombra, cursor pointer).

### 18. [ALTA] Atividades em Lote
- **Problema:** A tela tem apenas UMA funcionalidade disponível para usuário comum (importar inadimplência PDF), mas está mal apresentada dentro de um layout que parece esconder mais coisas. A tela fica muito vazia e desorientadora.
- **Impacto:** Sensação de que a tela está quebrada ou incompleta. Fico sem saber se errei o caminho no menu.
- **Sugestão:** Se há apenas uma ação disponível para o meu perfil, ela deveria estar centralizada e destacada, com instrução passo a passo clara: '1. Selecione o PDF', '2. Confirme os dados', '3. Importe'.

### 19. [ALTA] Atividades em Lote
- **Problema:** O termo 'inadimplência condominial' no contexto de um escritório de advocacia não é autoexplicativo para uma secretária recém-contratada. Não sei se isso se aplica ao meu trabalho diário ou é algo especializado.
- **Impacto:** Incerteza sobre quando e por que usar essa funcionalidade. Risco de usar na hora errada ou nunca usar quando deveria.
- **Sugestão:** Adicionar um texto de ajuda contextual simples: 'Use esta opção quando receber um PDF de inadimplência de condomínio para cadastrar automaticamente os processos no sistema.' Com talvez um ícone de '?' com tooltip explicativo.

### 20. [CRITICA] Financeiro
- **Problema:** A tela aberta não corresponde ao clique realizado: cliquei em 'Financeiro' mas a tela que abriu foi 'Atividades em Lote'. Isso é desorientador e quebra a confiança no sistema.
- **Impacto:** Usuária perde tempo tentando entender se clicou no lugar errado, se o sistema bugou ou se essa tela realmente pertence ao Financeiro. No dia a dia, isso gera insegurança constante.
- **Sugestão:** O clique em 'Financeiro' deveria expandir o submenu ou abrir a tela correspondente ao módulo financeiro. 'Atividades em Lote' precisa ter seu próprio item de menu claramente separado e identificado, sem ambiguidade.

### 21. [CRITICA] Financeiro
- **Problema:** Linguagem completamente inadequada para o público-alvo: termos como 'script Python', '~/Downloads/migrar_historico_processos.py', 'UUID da sessão', 'DELETE /api/condominio/inadimplencia/reverter/{importacaoId}' e 'endpoint' são jargões técnicos de desenvolvedor, não de secretária de advocacia.
- **Impacto:** A usuária simplesmente não vai entender o que fazer. Pode ignorar a instrução, executar algo errado por tentativa e erro, ou precisar chamar alguém toda vez que precisar usar essa função.
- **Sugestão:** Substituir o bloco técnico por uma linguagem simples: 'Para importar um histórico grande de processos via Excel, entre em contato com o administrador do sistema.' Ou criar um botão de upload com instruções em português claro, escondendo toda a parte técnica.

### 22. [CRITICA] Financeiro
- **Problema:** O card 'Importar inadimplência condominial (PDF)' não tem nenhum botão, link ou ação visível. É um bloco de texto que parece clicável mas não dá indicação clara de como iniciar o processo.
- **Impacto:** A usuária não sabe se deve clicar no card inteiro, se falta um botão, se precisa fazer algo antes. Pode ficar parada sem conseguir executar a tarefa.
- **Sugestão:** Adicionar um botão explícito e destacado dentro do card, como 'Selecionar arquivo PDF' ou 'Iniciar importação', com ícone de upload para reforçar a ação esperada.

### 23. [ALTA] Financeiro
- **Problema:** A tela está praticamente vazia — apenas um bloco técnico e um card. Se esta é uma área de 'Atividades em Lote', parece incompleta ou em construção, sem histórico de operações anteriores, status de importações, etc.
- **Impacto:** Usuária não tem como saber se uma importação anterior funcionou, se há operações pendentes ou se o sistema processou algo. Falta contexto operacional.
- **Sugestão:** Adicionar uma seção de histórico de atividades em lote realizadas, com data, tipo de operação, responsável, status (sucesso/erro) e opção de reverter. Isso daria segurança para a usuária.

### 24. [ALTA] Financeiro
- **Problema:** Não há nenhuma indicação de que esta tela é restrita ou requer atenção especial. Operações em lote podem causar danos graves aos dados se usadas incorretamente, mas não há aviso, confirmação prévia ou explicação de risco.
- **Impacto:** Uma usuária iniciante pode executar uma importação em lote sem entender as consequências, sobrescrevendo dados existentes ou criando duplicatas em massa.
- **Sugestão:** Adicionar um aviso destacado em amarelo ou laranja: 'Atenção: estas operações afetam múltiplos registros de uma vez. Em caso de dúvida, consulte o administrador antes de prosseguir.'

### 25. [CRITICA] Pendências
- **Problema:** Mensagem de erro técnica exposta ao usuário: 'clienteId é obrigatório. — /api/tarefas'
- **Impacto:** Como secretária, não faço ideia do que é 'clienteId' ou '/api/tarefas'. Isso me causa pânico — achei que fiz algo errado ou que o sistema quebrou. Uma mensagem assim não deveria aparecer para um usuário comum, especialmente sem explicar o que fazer.
- **Sugestão:** Substituir por uma mensagem amigável como 'Selecione um cliente para ver as pendências' ou, se for erro do sistema, exibir 'Não foi possível carregar as pendências. Tente novamente.' com um botão de recarregar.

### 26. [CRITICA] Pendências
- **Problema:** Todas as colunas estão completamente vazias — não há nenhuma pendência exibida
- **Impacto:** Não consigo usar a tela para nada. Se há pendências no sistema, elas não estão aparecendo. Posso achar que não existe nada pendente quando na verdade o sistema só está com erro de carregamento.
- **Sugestão:** Exibir um estado vazio informativo como 'Nenhuma pendência encontrada' apenas quando realmente não houver dados, e separar claramente do caso em que houve erro de carregamento.

### 27. [ALTA] Pendências
- **Problema:** Os nomes dos responsáveis nas colunas estão em formatos inconsistentes e informais: 'itamar' (minúsculo), 'karla.pedroza' (com ponto, minúsculo), 'ana.luisa' (com ponto), 'MARINA' (maiúsculo)
- **Impacto:** Parece que o sistema está usando logins/usernames internos em vez de nomes reais. Para uma secretária nova, não fica claro se 'karla.pedroza' é a mesma Karla que eu conheço no escritório.
- **Sugestão:** Exibir o nome completo e formatado do responsável no cabeçalho da coluna, ex: 'Karla Pedroza', 'Ana Luísa', 'Marina'.

### 28. [ALTA] Pendências
- **Problema:** As setas de navegação (< >) nos cabeçalhos das colunas não têm função aparente e não há tooltip explicando para que servem
- **Impacto:** Fiquei sem saber se as setas mudam de página dentro da coluna, expandem a coluna, ou navegam entre datas. Sem entender isso, não saberia usar esse recurso.
- **Sugestão:** Adicionar tooltip ao passar o mouse ('Ver tarefas anteriores / próximas') ou, se for paginação dentro da coluna, mostrar um contador como '1/5 tarefas'.

### 29. [ALTA] Pendências
- **Problema:** Não há botão explícito de 'Adicionar Pendência' ou 'Nova Pendência' — a única indicação é o placeholder 'Nova tarefa...' dentro de um campo cinza discreto
- **Impacto:** Uma secretária iniciante pode não perceber que aquele campo cinza é clicável e que serve para criar uma tarefa. A ação principal da tela está camuflada.
- **Sugestão:** Adicionar um botão verde ou azul '+  Nova Pendência' no topo da tela ou no cabeçalho de cada coluna, com rótulo legível.

### 30. [CRITICA] Tópicos
- **Problema:** Mensagem de erro técnica exposta diretamente ao usuário: 'clienteId é obrigatório. — /api/tarefas'
- **Impacto:** Como secretária, eu não faço ideia do que é 'clienteId' ou '/api/tarefas'. Isso parece um erro de programação que vazou para a tela. Fico sem saber se o sistema está quebrado, se perdi dados, ou se fiz algo errado. Causa ansiedade e insegurança no uso diário.
- **Sugestão:** Substituir a mensagem técnica por uma linguagem humana como: 'Não foi possível carregar as tarefas. Selecione um cliente para visualizar.' ou simplesmente ocultar esse erro e tratar internamente. Erros de API nunca devem aparecer para o usuário final.

### 31. [CRITICA] Tópicos
- **Problema:** Todas as colunas estão completamente vazias e não há explicação do motivo
- **Impacto:** Não sei se está vazio porque não há tarefas cadastradas, porque o erro impediu o carregamento, ou porque preciso selecionar algo nos filtros primeiro. A tela não me orienta. Posso achar que o sistema não funciona e chamar o TI desnecessariamente.
- **Sugestão:** Adicionar um estado vazio informativo dentro de cada coluna, como: 'Nenhuma tarefa encontrada' ou 'Selecione um cliente para carregar as tarefas.' Com um ícone ilustrativo e instrução de próximo passo.

### 32. [ALTA] Tópicos
- **Problema:** Nomes de usuários exibidos em formato de login (karla.pedroza, ana.luisa) misturado com nomes em maiúsculas (MARINA, itamar) — inconsistência de apresentação
- **Impacto:** Parece descuidado e dificulta identificar rapidamente quem é quem, especialmente para quem é nova no escritório. 'karla.pedroza' parece um e-mail ou login, não o nome de uma colega.
- **Sugestão:** Padronizar todos os cabeçalhos com o nome completo ou nome social da pessoa, ex: 'Karla Pedroza', 'Ana Luísa', 'Marina', 'Itamar'. Evitar exibir usernames de sistema para o usuário.

### 33. [ALTA] Tópicos
- **Problema:** Não está claro o que são 'Tópicos' no contexto de um escritório de advocacia
- **Impacto:** O menu diz 'Tópicos' mas a tela parece ser um quadro de tarefas (Kanban). Para mim, 'tópico' pode significar assunto de reunião, pauta, categoria — não necessariamente tarefa. Isso cria confusão desde o nome do menu.
- **Sugestão:** Renomear para 'Tarefas' ou 'Quadro de Tarefas' se for esse o propósito. Ou adicionar um subtítulo explicativo abaixo do título da tela.

### 34. [ALTA] Tópicos
- **Problema:** As setas de navegação (< >) nos cabeçalhos das colunas não têm tooltip ou explicação de função
- **Impacto:** Não sei para que servem essas setas. Mudar de página dentro da coluna? Navegar entre datas? Reordenar? Clicaria sem saber o que vai acontecer, o que é arriscado em um sistema de trabalho.
- **Sugestão:** Adicionar tooltip ao passar o mouse (ex: 'Ver tarefas anteriores' / 'Ver próximas tarefas') ou substituir por ícone mais claro como paginação numerada.

### 35. [CRITICA] Diagnósticos
- **Problema:** O nome do menu 'Diagnósticos' não comunica absolutamente nada sobre o que há dentro. Uma secretária associa 'diagnóstico' a doença ou problema técnico, jamais a relatórios de processos.
- **Impacto:** Nunca clicaria nesse menu no dia a dia por não saber o que tem ali. Perderia funcionalidades importantes por medo de mexer em algo errado.
- **Sugestão:** Renomear o menu para 'Relatórios' ou 'Relatórios e Consultas'. É simples, direto e comunica o conteúdo.

### 36. [ALTA] Diagnósticos
- **Problema:** O bloco de texto na parte inferior ('Sincronizar audiências da agenda com o formulário de processos') é extremamente técnico e confuso para quem não é de TI. Termos como 'segundo plano', 'API', 'backend', 'CNJ', 'processoRef', 'histórico local' não fazem sentido para uma secretária.
- **Impacto:** Gera insegurança: não sei se devo clicar em 'Só este mês/ano' ou 'Toda a agenda' sem saber o que vai acontecer. Risco de fazer algo errado com dados reais.
- **Sugestão:** Reescrever o texto em linguagem simples, por exemplo: 'Atualizar automaticamente as audiências do sistema com base na agenda. Escolha se quer atualizar apenas o mês atual ou toda a agenda.' Esconder os detalhes técnicos em um link 'Saiba mais'.

### 37. [ALTA] Diagnósticos
- **Problema:** Mistura de duas funcionalidades completamente distintas em uma mesma tela: seleção de relatório (parte de cima) e sincronização de audiências (parte de baixo). São coisas diferentes que não têm relação visual ou lógica entre si.
- **Impacto:** Confunde o usuário sobre o propósito da tela. Ao entrar querendo um relatório, me deparo com botões de 'Toda a agenda' que não sei se têm a ver com o relatório que escolhi.
- **Sugestão:** Separar em duas seções claramente delimitadas com títulos distintos, ou mover a sincronização de audiências para uma outra área do sistema (ex: dentro de 'Agenda').

### 38. [ALTA] Diagnósticos
- **Problema:** Abreviação 'Proc. Administrativo' é ambígua — pode ser 'Processo Administrativo' ou 'Procedimento Administrativo'. Sem contexto, não sei o que vou gerar.
- **Impacto:** Posso gerar o relatório errado e entregar informação incorreta para o advogado.
- **Sugestão:** Escrever o nome completo: 'Processo Administrativo'. Espaço não é tão escasso assim no botão.

### 39. [ALTA] WhatsApp
- **Problema:** Todos os indicadores mostram zero e não há nenhum aviso explicando o motivo — o sistema está recém-configurado? A integração com WhatsApp está ativa? Houve alguma falha de conexão?
- **Impacto:** Como secretária nova, não sei distinguir se o zero significa 'tudo certo, hoje não houve movimento' ou 'o sistema não está funcionando'. Posso achar que está tudo bem e perder mensagens de clientes importantes.
- **Sugestão:** Adicionar um indicador de status da conexão com o WhatsApp Business API — algo como um ícone verde 'Conectado' ou vermelho 'Desconectado' bem visível no topo da tela. Também seria útil mostrar a data/hora da última sincronização.

### 40. [ALTA] WhatsApp
- **Problema:** A nota no rodapé sobre perfil ('Apenas o usuário master (Itamar) pode trocar de perfil neste menu...') está escondida no canto inferior esquerdo, com fonte pequena e sem destaque
- **Impacto:** Uma secretária nova pode não perceber essa limitação e tentar configurar algo que não tem permissão, ficando confusa com erros ou bloqueios sem entender o porquê.
- **Sugestão:** Essa informação de permissão deveria aparecer como um banner ou tooltip quando a usuária tentar acessar configurações restritas, não ficar enterrada no rodapé do menu.

### 41. [CRITICA] Integrações (lab)
- **Problema:** A tela inteira é voltada para desenvolvedores/técnicos, não para usuários finais como secretárias. Termos como 'Query DSL', 'POST /datajud-proxy/{índice}/_search', 'api_publica_tjgo', 'track_total_hits', 'bool', 'query' em JSON são completamente inacessíveis para quem não é da área de TI.
- **Impacto:** Eu simplesmente não saberia o que fazer aqui. Ficaria paralisada com medo de estragar algo. Não consigo usar essa ferramenta para pesquisar processos sem treinamento técnico especializado.
- **Sugestão:** Criar uma interface simplificada 'modo secretária' com apenas um campo de busca 'Digite o número do processo' e um botão 'Buscar', escondendo toda a parte técnica/código para um modo avançado acessível só para administradores ou desenvolvedores.

### 42. [CRITICA] Integrações (lab)
- **Problema:** O código JSON aparece diretamente na tela como resultado (visible no rodapé: '{', '"query": {', '"bool": {', '"erro": "20 dígitos obrigatórios"'). Isso não é um resultado utilizável por uma secretária — não mostra nome da parte, data, status do processo, nada legível.
- **Impacto:** Mesmo que eu conseguisse executar uma busca, o resultado seria um bloco de código que não sei ler. A informação que preciso (dados do processo) está lá, mas inacessível para mim.
- **Sugestão:** Transformar o retorno da API em uma tabela ou card legível com campos como: Número do processo, Partes envolvidas, Situação, Data de distribuição, Vara/Juízo — da mesma forma que um extrato bancário traduz dados técnicos em informação visível.

### 43. [ALTA] Integrações (lab)
- **Problema:** Não há nenhuma explicação do que essa tela faz em linguagem simples. O aviso verde diz 'a secção principal desta página é o laboratório DSL' — mas isso não me diz absolutamente nada sobre para que serve ou como usar no contexto do escritório.
- **Impacto:** Uma secretária nova (como eu) não tem como entender a finalidade desta tela sem perguntar para alguém ou receber treinamento técnico, gerando dependência e perda de tempo.
- **Sugestão:** Adicionar um parágrafo introdutório simples como: 'Use esta ferramenta para consultar processos diretamente no sistema do CNJ/TJGO. Basta digitar o número do processo no campo abaixo e clicar em Buscar.' Linguagem humana, não técnica.

### 44. [ALTA] Integrações (lab)
- **Problema:** O campo 'size' com valor '20' e o checkbox 'track_total_hits' aparecem expostos sem nenhuma explicação. Eu não sei o que são, não sei se devo alterar e fico com medo de mudar algo que quebre a busca.
- **Impacto:** Usuária evita usar a funcionalidade ou altera valores sem entender as consequências, podendo causar resultados incorretos ou incompletos.
- **Sugestão:** Esconder esses controles técnicos em um painel 'Configurações avançadas' colapsado por padrão, acessível apenas quando necessário.

### 45. [ALTA] Integrações (lab)
- **Problema:** O menu mostra 'Integrações (lab)' com a subopção 'DataJud — lab de buscas'. A palavra 'lab' não é autoexplicativa para um usuário comum — não fica claro que é experimental/em desenvolvimento e que pode não funcionar perfeitamente.
- **Impacto:** Eu posso usar isso como ferramenta confiável do dia a dia, obter resultados errados ou incompletos e não entender que é algo ainda em teste.
- **Sugestão:** Adicionar um aviso proeminente no topo: 'ATENÇÃO: Esta é uma ferramenta experimental. Os resultados podem estar incompletos. Para consultas oficiais, acesse o portal do TJGO diretamente.' Com isso, pelo menos sei que não é para uso definitivo.

### 46. [ALTA] Usuários
- **Problema:** O texto explicativo no topo é longo demais e técnico demais para uma secretária. Termos como 'paginação', 'espelho completo de usuários ativos carregado em segundo plano', 'apelido é o único nome de usuário mostrado no sistema' são jargões de sistema que não dizem nada pra mim.
- **Impacto:** Eu simplesmente ignoraria esse texto no dia a dia e poderia usar a tela de forma errada sem entender o conceito de 'apelido' x 'nome civil', gerando cadastros duplicados ou com dados errados.
- **Sugestão:** Substituir o texto por uma frase simples e objetiva: 'Gerencie quem tem acesso ao sistema. Cada usuário precisa estar vinculado a uma pessoa cadastrada.' O restante poderia ficar em um ícone de ajuda '?' para quem quiser saber mais.

### 47. [ALTA] Usuários
- **Problema:** Os três botões de ação por linha ('Dados', 'Permissões', 'Inativar') não têm distinção visual entre si — dois têm ícone e borda, um não tem. O botão 'Inativar' é destrutivo (desativa o acesso de alguém) e não tem nenhuma cor de alerta, fica igual aos outros visualmente.
- **Impacto:** Posso clicar em 'Inativar' sem querer achando que é para editar, e desativar o acesso de um colega de trabalho sem perceber. Isso é crítico num escritório pequeno.
- **Sugestão:** Colorir o botão 'Inativar' em vermelho ou laranja com ícone de alerta, e adicionar um modal de confirmação: 'Tem certeza que deseja inativar o usuário X? Ele perderá o acesso ao sistema.'

### 48. [ALTA] Usuários
- **Problema:** O ID do usuário 'Marina Teste (QA Automatizado)' é 100005, enquanto os outros são 1, 2 e 3. Isso é visualmente estranho e confuso — parece um erro ou dado de teste que ficou na tela de produção.
- **Impacto:** Gera desconfiança no sistema. Uma usuária como eu pensaria: 'Isso está certo? Tem algo errado aqui?' Pode causar insegurança sobre a integridade dos dados.
- **Sugestão:** Dados de teste (QA) não deveriam aparecer em ambiente de produção. Se for necessário manter, ao menos sinalizar com uma badge 'TESTE' para diferenciar.

---

## 📋 Análise Detalhada por Tela

### ❌ Dashboard / Tela Inicial — ?/10

---

### ❌ Administração de Imóveis — ?/10

---

### ❌ Pessoas — 4/10

> _"Espera um pouco... eu cliquei em 'Pessoas' mas apareceu uma tela de imóveis? Isso não faz sentido nenhum. Fiquei confusa na hora — será que cliquei errado? A tela em si parece ter bastante informação, com cartõezinhos coloridos e tudo, mas eu precisaria de um tempo para entender o que está acontecendo aqui porque o contexto não bate com o que eu esperava."_ — Marina

**Descrição:** A tela exibe um cadastro de imóvel específico (Imóvel #43, ocupado, aluguel de R$ 26,00). No topo há um texto explicativo longo sobre como funciona a API e a planilha de importação. Abaixo aparecem 4 cards coloridos: Aluguel (verde), Contrato (azul), Proprietário (amarelo) e Inquilino (rosa/vermelho). Os cards mostram dados resumidos. Há botões de ação: Salvar, Abrir Proc., Conta Corrente, Gerenciar IPTU, Relatório e um X para fechar. No menu lateral esquerdo, 'Administração de Imóveis' está expandido com subitens: Imóveis, Pagamentos, Conciliação bancária, Acerto com Cliente, Relatório Pagamentos, Sugestões de vínculo, IPTU, Relatório Financeiro Imóveis e Relatório Imóveis. Abaixo no menu aparecem: Pessoas, Clientes, Processos, Calcular, Agenda, Atividades em Lote, Financeiro e Pagamentos. Na parte inferior esquerda está o perfil 'MARINA' com um aviso sobre configurações. A seção 'Identificação' começa a aparecer na parte de baixo.

**Pontos positivos:**
- ✅ Os 4 cards coloridos (Aluguel, Contrato, Proprietário, Inquilino) organizam bem as informações principais do imóvel em um relance
- ✅ O badge 'OCUPADO' em verde destaca claramente o status do imóvel
- ✅ Os botões de ação estão agrupados na mesma linha, facilitando o acesso às funções do imóvel
- ✅ O menu lateral está bem organizado e eu sei que estou logada como Marina
- ✅ As cores dos cards são diferentes entre si, o que ajuda a distinguir cada bloco de informação

**Problemas encontrados:**
- 🔴 **[critica]** Eu cliquei em 'Pessoas' no menu e fui parar numa tela de Imóveis. A navegação não levou para onde eu esperava — o sistema ignorou meu clique ou me redirecionou de forma inexplicável.
  → _Sugestão: Garantir que cada item do menu leva para a seção correspondente. Se 'Pessoas' foi clicado, a tela de listagem de pessoas deve abrir. Revisar o comportamento de navegação de todos os itens do menu._
- 🟠 **[alta]** O bloco de texto explicativo no topo é longo, técnico e cheio de jargões ('API ativa', 'planilha de importação', 'coluna A', 'consolidação mensal'). Para uma secretária nova, isso é incompreensível e intimida.
  → _Sugestão: Substituir o texto técnico por uma instrução simples e objetiva, como 'Gerencie os imóveis administrados pelo escritório. Cadastre locação, proprietário e inquilino.' Detalhes técnicos sobre API podem ir em uma tela de ajuda separada, acessível por um ícone de '?'._
- 🟠 **[alta]** Os nomes no card de Proprietário ('ITAMAR ALEXANDRE FELIX VILLA REAL...') e Inquilino ('ADELAIDE MARIA JERONIMO PEREIRA...') estão cortados com reticências. Não consigo ver o nome completo sem clicar.
  → _Sugestão: Aumentar a largura dos cards ou reduzir o tamanho da fonte para exibir o nome completo. Alternativamente, ao passar o mouse sobre o nome truncado, mostrar o nome completo em um tooltip._
- 🟠 **[alta]** O valor do aluguel é R$ 26,00 — um valor extremamente baixo para um imóvel, o que parece um dado incorreto ou de teste. O sistema não emite nenhum alerta ou indicação visual de que pode ser um valor inconsistente.
  → _Sugestão: Implementar validação com alerta visual (ícone de atenção) quando o valor de aluguel for muito baixo ou incomum para o contexto. Pode ser uma faixa configurável pelo administrador._
- 🟡 **[media]** O botão 'Abrir Proc.' tem um nome abreviado que não é imediatamente claro. 'Proc.' pode significar 'Processo', 'Procedimento' ou outra coisa.
  → _Sugestão: Escrever o nome completo: 'Abrir Processo'. Botões com ações importantes não devem ter nomes abreviados._
- 🟡 **[media]** Há dois itens chamados 'Pagamentos' no menu lateral — um dentro de 'Administração de Imóveis' e outro como item separado no final do menu. Não fica claro qual é qual.
  → _Sugestão: Diferenciar claramente os nomes: por exemplo, 'Pagamentos de Imóveis' e 'Pagamentos (Financeiro)' ou reorganizar o menu para evitar itens com nomes duplicados._
- 🟡 **[media]** O aviso na parte inferior esquerda diz 'Apenas o usuário master (Itamar) pode trocar de perfil neste menu. Ajuste em Configurações se esta máquina for de outra pessoa.' Esse aviso está em texto pequeno, cinza escuro, em local de pouca visibilidade.
  → _Sugestão: Se essa informação é relevante para o usuário atual, exibi-la como um aviso destacado no topo da tela ou como notificação no login. Não enterrar informações importantes no rodapé do menu._
- 🟢 **[baixa]** Existem dois botões de fechar (X) na tela: um no canto superior direito do texto explicativo e outro na linha dos botões de ação do imóvel. Não fica claro o que cada um fecha.
  → _Sugestão: Usar ícones com tooltip explicativo ao passar o mouse ('Fechar aviso' e 'Fechar imóvel') ou substituir um dos X por um botão com rótulo textual mais claro._

**Sugestões de melhoria:**
- 💡 Adicionar uma barra de busca para encontrar imóveis rapidamente por número, nome do inquilino ou proprietário — hoje parece que só dá para navegar pelo número
- 💡 Mostrar um histórico rápido das últimas ações feitas no imóvel (ex: 'Última alteração: 10/05/2025 por Marina'), o que ajuda a rastrear mudanças
- 💡 Incluir um indicador visual de 'alterações não salvas' quando algum campo for modificado, para eu não esquecer de clicar em Salvar
- 💡 Criar uma área de 'acesso rápido' para as tarefas mais comuns (cadastrar novo imóvel, ver imóveis vencendo, imóveis em atraso), que seria muito útil no dia a dia
- 💡 Considerar um modo de visualização em lista/tabela de todos os imóveis, para ter uma visão geral antes de entrar no detalhe de um específico

**Fluxo do usuário:** Ao chegar nessa tela (vindo do clique em 'Pessoas', o que já foi confuso), eu primeiro tentaria entender o que estou vendo. Leria o cabeçalho 'Imóveis em Administração' e perceberia que estou na tela errada. Voltaria ao menu e procuraria novamente por 'Pessoas'. Caso estivesse aqui propositalmente para gerenciar este imóvel, eu olharia os 4 cards coloridos para entender o status, veria as informações de aluguel, contrato, proprietário e inquilino. Se precisasse alterar algo, rolaria a tela para baixo para encontrar os campos de 'Identificação' e editaria. Ao terminar, clicaria em 'Salvar'. Ficaria insegura sobre se salvou corretamente, pois não vejo indicação de sucesso na tela.

---

### ❌ Clientes — 4/10

> _"Meu Deus, que tela cheia de coisa! Abri o menu 'Clientes' e já apareceu um cadastro aberto de uma pessoa — eu nem pedi isso. Fiquei confusa: isso é o cadastro da Alexandra ou é uma tela em branco? Por que já tem alguém aqui? Tem botões coloridos de cores diferentes (verde, roxo, amarelo, azul) e não entendo direito o que cada um faz só de olhar. Parece que tem muita informação ao mesmo tempo."_ — Marina

**Descrição:** A tela é dividida em seções: (1) Cabeçalho com título 'Cadastro de Clientes' e subtítulo 'Pessoas, vínculos e processos em um só lugar'; (2) Barra de busca verde-escura com campo de pesquisa por nome ou código; (3) Card roxo/escuro com o cliente selecionado 'ALEXANDRA GONTIJO DE SOUZA', exibindo código 00000001, badge 'ATIVO' e badge 'Edição bloqueada'; (4) Formulário com campos: Código do Cliente (com setas de navegação), Pessoa (campo numérico '64' com lupa), Nome/Razão Social e CNPJ/CPF; (5) Cinco botões de ação: 'Cadastro de Pessoas', 'Conta Corrente (Proc. 0)', 'Qualificação', 'Documentos' e 'Configurações de cálculo'; (6) Checkbox 'Cliente Inativo' e checkbox marcado 'Edição Desabilitada'; (7) Campo de texto livre 'Observação' vazio; (8) Seção inferior azul 'PROCESSOS DO CLIENTE' com instrução de duplo clique. No menu lateral esquerdo há toda a navegação do sistema. No rodapé aparece o perfil 'MARINA' com aviso sobre troca de perfil.

**Pontos positivos:**
- ✅ A barra de busca é bem visível e tem instrução clara de como usar (8 dígitos ou parcial, com exemplo)
- ✅ O card do cliente selecionado em destaque roxo deixa claro qual cliente está sendo visualizado
- ✅ Os badges 'ATIVO' e 'Edição bloqueada' comunicam o status de forma rápida
- ✅ O código do cliente com setas de navegação (< >) é uma boa ideia para navegar entre registros
- ✅ O campo CNPJ/CPF já está formatado com máscara (001.298.131-17), o que evita erros
- ✅ A instrução 'duplo clique na linha para abrir' na seção de processos é um bom exemplo de dica contextual
- ✅ O subtítulo 'Pessoas, vínculos e processos em um só lugar' comunica bem o propósito da tela

**Problemas encontrados:**
- 🔴 **[critica]** A tela abre já com um cliente carregado (Alexandra, cód. 00000001) sem que eu tenha pesquisado nada. Não fica claro se é um exemplo, o último cliente acessado ou algo que não devia estar aqui.
  → _Sugestão: A tela deveria abrir limpa, só com a barra de busca ativa, e só mostrar o formulário após uma pesquisa ou clique em 'Novo Cliente'._
- 🔴 **[critica]** O campo 'Pessoa: 64' não faz sentido algum para mim. O que significa esse número 64? É uma ID interna? Por que está separado do nome?
  → _Sugestão: Substituir ou complementar com um rótulo mais descritivo como 'ID Pessoa (interno)' ou integrar esse campo com o de Nome/Razão Social, tornando-o invisível para o usuário final._
- 🔴 **[critica]** Há dois controles de edição separados e confusos: o badge 'Edição bloqueada' no card roxo E o checkbox 'Edição Desabilitada' marcado no formulário. São a mesma coisa? Por que aparecem duas vezes em lugares diferentes?
  → _Sugestão: Unificar em um único controle de edição, com botão claro: 'Habilitar Edição' ou um cadeado clicável, e remover a duplicidade._
- 🟠 **[alta]** Os 5 botões de ação ('Cadastro de Pessoas', 'Conta Corrente', 'Qualificação', 'Documentos', 'Configurações de cálculo') têm cores diferentes sem critério aparente — verde, roxo, amarelo, azul-escuro. Não entendo por que cada um tem uma cor.
  → _Sugestão: Adotar um padrão de cores com significado: ação principal em destaque (ex: azul), ações secundárias em cinza, ações destrutivas em vermelho. Ou agrupar os botões por categoria._
- 🟠 **[alta]** Não há botão visível de 'Novo Cliente' ou 'Cadastrar'. Para uma secretária nova, como eu, a principal dúvida é: como adiciono um cliente do zero?
  → _Sugestão: Adicionar um botão 'Novo Cliente' bem visível, preferencialmente no cabeçalho ou próximo à barra de busca._
- 🟠 **[alta]** A seção 'PROCESSOS DO CLIENTE' aparece só como um banner azul com instrução, sem mostrar nenhum dado. Se o cliente tem processos, eles deveriam ser visíveis sem precisar rolar ou interagir.
  → _Sugestão: Mostrar um resumo dos processos diretamente (número, status, data), com a grade carregada automaticamente ao selecionar o cliente._
- 🟡 **[media]** O aviso no rodapé sobre perfil ('Apenas o usuário master pode trocar o perfil neste menu...') aparece bem na área de rodapé da tela, misturado com o meu nome 'MARINA'. É um texto técnico, pequeno e confuso para alguém novo.
  → _Sugestão: Mover esse aviso para uma seção de configurações ou exibi-lo apenas quando o usuário tentar trocar o perfil. Não deve estar visível o tempo todo._
- 🟡 **[media]** O campo 'Observação' está completamente vazio e ocupa muito espaço na tela. Não há indicação do que deveria ser escrito ali.
  → _Sugestão: Reduzir o tamanho do campo de observação ou adicionar um placeholder com exemplo: 'Ex.: Cliente indicado por Dr. João. Prefere contato por WhatsApp.'_
- 🟢 **[baixa]** O botão de fechar (X) no canto superior direito não tem rótulo. Fechar o quê? Fechar esse cadastro específico? Sair da tela de clientes?
  → _Sugestão: Adicionar tooltip ou rótulo 'Fechar' e mostrar confirmação se houver dados não salvos._

**Sugestões de melhoria:**
- 💡 Adicionar um histórico rápido dos últimos clientes acessados para facilitar o retorno a registros recentes
- 💡 Incluir um indicador de 'Cliente com processos em andamento' diretamente no card de identificação, para chamar atenção antes de qualquer ação
- 💡 Criar um modo 'Visualização rápida' e um modo 'Edição' com visual claramente diferente (ex: bordas dos campos ficam azuis no modo edição)
- 💡 Adicionar contadores resumidos no card do cliente: quantos processos, quantos documentos, saldo em conta corrente — sem precisar clicar em cada aba
- 💡 Incluir atalhos de teclado documentados (ex: F2 para editar, ESC para cancelar) para usuários que vão usar o sistema o dia todo

**Fluxo do usuário:** Entro no menu 'Clientes' e me deparo com uma tela já com alguém carregado. Fico confusa mas vou até a barra de busca e digito o nome do cliente que preciso. Clico no resultado (se aparecer). O card roxo atualiza com o nome do cliente. Aí preciso habilitar a edição — mas não sei como, porque tem dois indicadores de bloqueio. Tento clicar em 'Edição Desabilitada' (checkbox), desmarcando-o, e aí vejo se os campos ficam editáveis. Preencho os dados que preciso. Procuro um botão 'Salvar' — e aqui provavelmente terei um problema porque não vi nenhum botão de salvar na tela.

---

### ❌ Processos — ?/10

---

### ❌ Calcular — ?/10

---

### ❌ Agenda — 4/10

> _"Meu Deus, que tela confusa! Abriu duplicado — tem dois calendários iguais nas laterais e a mesma lista de usuários aparece duas vezes. Fiquei olhando por uns segundos tentando entender se eram coisas diferentes ou se o sistema bugou. No centro tem a agenda em si, mas os cards escuros de 'Sem eventos' são pesados e assustadores visualmente. Parece que tem muita coisa na tela ao mesmo tempo sem um motivo claro."_ — Marina

**Descrição:** A tela é dividida em três colunas: COLUNA ESQUERDA — um calendário do mês de Maio/2026 com o dia 27 destacado em roxo, um campo 'DATA COMPLETA' mostrando 27/05/2026, uma lista de 'Usuários' com 4 pessoas (itamar, karla.pedroza, ana.luisa, MARINA) cada uma com um ponto colorido, e um botão roxo 'Usuários' no rodapé. COLUNA CENTRAL — painel 'Agenda' com subtítulo explicativo 'Compromissos por dia — duplo clique abre o processo na base', um botão 'Agenda mensal' no canto superior direito, dois cards lado a lado: um para 'Hoje 27/05/2026 (qua)' e outro para 'Próximo dia 28/05/2026 (qui)'. Ambos os cards têm fundo vinho escuro com ícone de calendário riscado e a mensagem 'Sem eventos para MARINA'. Abaixo de cada card há um formulário 'NOVO COMPROMISSO' com campos de Hora (14:30), Descrição (textarea) e um botão 'Pendente'. COLUNA DIREITA — idêntica à coluna esquerda, com calendário de Maio/2026, porém com o dia 28 também destacado, campo DATA COMPLETA mostrando 28/05/2026, mesma lista de usuários e mesmo botão 'Usuários'.

**Pontos positivos:**
- ✅ O subtítulo 'Compromissos por dia — duplo clique abre o processo na base' é uma dica útil para o usuário entender como interagir
- ✅ Mostrar hoje e o próximo dia lado a lado é uma ideia interessante para antecipar compromissos
- ✅ Os usuários têm bolinhas coloridas que ajudam a identificar rapidamente quem é quem
- ✅ O campo DATA COMPLETA exibindo a data por extenso é um reforço visual positivo
- ✅ A indicação 'Hoje: 27/05/2026' abaixo do calendário é um marcador contextual útil
- ✅ O botão 'Agenda mensal' dá acesso a uma visão mais ampla sem esconder essa visão diária

**Problemas encontrados:**
- 🔴 **[critica]** A tela está completamente duplicada — existe uma coluna esquerda E uma coluna direita idênticas (calendário + data + usuários + botão 'Usuários'), diferindo apenas pela data selecionada (27 vs 28). Isso consome metade da largura da tela com redundância total.
  → _Sugestão: Ter UM único painel lateral com o calendário e a seleção de data/usuário. Os dois dias (hoje e próximo) no centro já cumprem o papel de mostrar datas diferentes. Eliminar a coluna direita ou transformá-la em algo útil (ex: lista de pendências da semana)._
- 🔴 **[critica]** Os cards de 'Sem eventos' têm fundo vinho/marrom escuro muito carregado, parecendo um estado de erro grave ou alerta crítico. Uma agenda vazia não é um problema — é uma situação normal.
  → _Sugestão: Substituir o fundo escuro por um card branco ou cinza claro com ícone neutro e mensagem amigável como 'Nenhum compromisso agendado para este dia. Que tal adicionar um?' com a cor de fundo em tom suave._
- 🟠 **[alta]** O formulário 'NOVO COMPROMISSO' está sempre visível mesmo quando a agenda está vazia, misturado ao card de 'sem eventos'. Não há botão explícito como '+ Adicionar compromisso' — o formulário simplesmente aparece colado abaixo do card escuro.
  → _Sugestão: Adicionar um botão visível '+ Novo Compromisso' que, ao clicar, expande o formulário. O horário padrão '14:30' deve estar claramente editável ou ter um placeholder como 'HH:MM'._
- 🟠 **[alta]** O botão 'Pendente' ao lado do formulário de novo compromisso não está claro. Pendente do quê? É o status do compromisso? É um botão para salvar? Para marcar como pendente?
  → _Sugestão: Renomear para 'Salvar' ou 'Agendar' se for o botão de confirmar. Se for uma opção de status, transformar em um select/dropdown com opções: Confirmado, Pendente, Cancelado._
- 🟠 **[alta]** Não há como ver os compromissos de outros dias sem navegar pelo calendário. A tela mostra só hoje e amanhã. Se eu precisar ver o que tem na próxima semana, não é intuitivo como fazer isso.
  → _Sugestão: Adicionar uma visualização de semana ou pelo menos uma lista dos próximos 5 dias com indicador de quantidade de compromissos por dia._
- 🟡 **[media]** A lista de usuários aparece duas vezes (coluna esquerda e coluna direita) e também tem um botão 'Usuários' em roxo no rodapé de cada coluna. Não está claro o que esse botão 'Usuários' faz — abre uma lista? Permite adicionar usuário? Filtra a agenda?
  → _Sugestão: Renomear o botão para algo claro como 'Gerenciar Usuários' ou 'Ver todos os usuários'. Se serve para filtrar a agenda por usuário, chamar de 'Filtrar por usuário'._
- 🟡 **[media]** Não há como visualizar rapidamente TODOS os compromissos do mês em forma de lista. O botão 'Agenda mensal' existe, mas está no canto superior direito do painel central, pequeno, sem destaque.
  → _Sugestão: Destacar mais o botão 'Agenda mensal' ou adicionar um indicador visual no calendário lateral mostrando os dias que têm compromissos (pontinhos coloridos nos números dos dias)._
- 🟢 **[baixa]** O campo 'Descrição' do novo compromisso é um textarea pequeno com placeholder 'Descreva o compromisso...' que fica espremido entre Hora e o botão Pendente.
  → _Sugestão: Ampliar o textarea ou usar um modal/painel de detalhes ao clicar em '+ Novo Compromisso', com campos mais ricos: tipo de compromisso, processo vinculado, cliente, local, observações._

**Sugestões de melhoria:**
- 💡 Adicionar indicadores visuais no calendário (bolinhas ou marcações) nos dias que já possuem compromissos cadastrados — assim eu já sei de longe quais dias estão ocupados
- 💡 Mostrar o nome completo do processo ou cliente vinculado ao compromisso quando houver eventos, não só no duplo clique
- 💡 Incluir um campo de busca na agenda para encontrar compromissos por nome de cliente ou tipo
- 💡 Permitir arrastar compromissos entre dias (drag and drop) para reagendamentos rápidos
- 💡 Adicionar notificação ou destaque visual quando um compromisso está prestes a vencer (ex: nas próximas 2 horas)
- 💡 Mostrar feriados nacionais e locais (Goiás/Anápolis) destacados no calendário, o que é essencial num escritório de advocacia para controle de prazos

**Fluxo do usuário:** Ao abrir a tela, eu olharia primeiro para o centro esperando ver minha agenda do dia. Veria os dois cards escuros de 'Sem eventos' e ficaria confusa achando que algo deu errado. Depois notaria o formulário 'NOVO COMPROMISSO' abaixo e tentaria preencher. Colocaria a hora (mudando o 14:30), escreveria a descrição e aí travaria no botão 'Pendente' — não saberia se devo clicar nele para salvar ou se é outra coisa. Provavelmente clicaria mesmo sem saber o que ia acontecer. Depois tentaria ver outros dias clicando no calendário da esquerda e ficaria sem entender por que tem outro calendário igual do lado direito. Eventualmente clicaria em 'Agenda mensal' para ter uma visão geral.

---

### ❌ Atividades em Lote — 2/10

> _"Entrei nessa tela e fiquei perdida. Tem um bloco cinza cheio de código de computador que parece coisa de programador, não de secretária. Fiquei com medo de clicar em qualquer coisa errada e estragar tudo no sistema. Honestamente, não entendo o que devo fazer aqui."_ — Marina

**Descrição:** A tela exibe o título 'Atividades em Lote' com o subtítulo 'Operações em massa com confirmação antes de gravar no servidor'. Há dois elementos principais: 1) Uma caixa destacada com borda cinza intitulada 'Histórico de processos (Excel, grandes volumes)' que contém texto técnico com comandos Python, caminhos de arquivo (~/Downloads/migrar_historico_processos.py), comandos MySQL e um endpoint de API (DELETE /api/condominio/inadimplencia/reverter/{importacaoId}). 2) Um card branco com borda sutil intitulado 'Importar inadimplência condominial (PDF)' com uma descrição funcional sobre análise de PDF, gravação de processos e débitos. O menu lateral está visível com todas as seções do sistema.

**Pontos positivos:**
- ✅ O subtítulo 'Operações em massa com confirmação antes de gravar no servidor' dá uma ideia geral do propósito da tela
- ✅ O card 'Importar inadimplência condominial (PDF)' tem uma descrição mais humanizada e parece clicável
- ✅ O título da tela é claro e direto

**Problemas encontrados:**
- 🔴 **[critica]** A caixa de 'Histórico de processos' está repleta de comandos técnicos de programação: script Python, comandos MySQL, paths de sistema e endpoints de API (DELETE /api/condominio...). Isso não faz o menor sentido para uma secretária.
  → _Sugestão: Esse conteúdo técnico deveria estar em uma área restrita a administradores ou desenvolvedores, completamente oculta para perfis como o meu (secretária). Se precisar aparecer, deveria estar em uma aba 'Avançado' ou 'Administração' com aviso de que é para uso técnico._
- 🔴 **[critica]** O card 'Importar inadimplência condominial (PDF)' não tem nenhum botão visível — parece um texto informativo, não uma ação clicável. Não dá pra saber se clico no card inteiro, se tem um botão escondido ou se precisa fazer outra coisa.
  → _Sugestão: Adicionar um botão explícito e destacado dentro do card, como 'Iniciar Importação' ou 'Selecionar PDF', com cor chamativa (verde ou azul). O card precisa ter aparência claramente interativa (hover, sombra, cursor pointer)._
- 🟠 **[alta]** A tela tem apenas UMA funcionalidade disponível para usuário comum (importar inadimplência PDF), mas está mal apresentada dentro de um layout que parece esconder mais coisas. A tela fica muito vazia e desorientadora.
  → _Sugestão: Se há apenas uma ação disponível para o meu perfil, ela deveria estar centralizada e destacada, com instrução passo a passo clara: '1. Selecione o PDF', '2. Confirme os dados', '3. Importe'._
- 🟠 **[alta]** O termo 'inadimplência condominial' no contexto de um escritório de advocacia não é autoexplicativo para uma secretária recém-contratada. Não sei se isso se aplica ao meu trabalho diário ou é algo especializado.
  → _Sugestão: Adicionar um texto de ajuda contextual simples: 'Use esta opção quando receber um PDF de inadimplência de condomínio para cadastrar automaticamente os processos no sistema.' Com talvez um ícone de '?' com tooltip explicativo._
- 🟡 **[media]** O subtítulo 'Operações em massa com confirmação antes de gravar no servidor' usa linguagem técnica ('gravar no servidor') que não é natural para um usuário comum.
  → _Sugestão: Substituir por linguagem mais acessível: 'Importe vários registros de uma vez. Você poderá revisar tudo antes de salvar.'_
- 🟡 **[media]** Não há nenhuma indicação de histórico de importações anteriores — se eu já fiz uma importação antes, como verifico o resultado? Como sei se deu certo?
  → _Sugestão: Adicionar uma seção 'Importações Recentes' com status (Concluído, Erro, Em andamento), data e número de registros importados._
- 🟢 **[baixa]** A nota de rodapé do perfil diz 'Apenas o usuário master (Itamar) pode trocar de perfil neste menu' — essa mensagem aparece em todas as telas do sistema e ocupa espaço na barra lateral de forma pouco elegante.
  → _Sugestão: Exibir essa informação apenas quando o usuário tentar clicar em trocar de perfil, não permanentemente._

**Sugestões de melhoria:**
- 💡 Criar perfis de acesso que filtrem o conteúdo exibido: secretária não deveria ver instruções de script Python e comandos de banco de dados
- 💡 Adicionar ícones visuais representativos para cada tipo de atividade em lote (ícone de PDF para importação, ícone de Excel para planilha)
- 💡 Incluir um mini-tutorial ou vídeo de 1 minuto explicando o que são 'atividades em lote' e quando usar
- 💡 Mostrar um contador de 'X processos importados este mês' para dar senso de uso e confiança na funcionalidade
- 💡 Considerar renomear o menu de 'Atividades em Lote' para algo mais descritivo como 'Importações em Massa' ou 'Importar Dados'

**Fluxo do usuário:** Eu clicaria no menu 'Atividades em Lote', veria a tela e imediatamente ficaria travada na caixa cinza com código. Tentaria ler, não entenderia nada sobre Python e MySQL, ficaria com medo de ter entrado na tela errada. Depois perceberia o card branco 'Importar inadimplência condominial (PDF)' e tentaria clicar nele sem saber se é um botão ou apenas uma descrição. Se o card não tiver feedback visual de clique, provavelmente chamaria o Itamar ou um colega para perguntar o que fazer — ou simplesmente fecharia a tela e nunca mais voltaria nela.

---

### ❌ Financeiro — 2/10

> _"Espera, eu cliquei em 'Financeiro' e fui parar numa tela de 'Atividades em Lote'? Isso não faz sentido. Fiquei confusa na hora — achei que tinha clicado errado. E quando comecei a ler o conteúdo, parece que essa tela não é pra mim: tem código de programação, script Python, comandos DELETE, endpoint de API... Eu não sei o que é nada disso. Sinto que abri uma tela que deveria ser só para o pessoal de TI."_ — Marina

**Descrição:** A tela exibe o título 'Atividades em Lote' com o subtítulo 'Operações em massa com confirmação antes de gravar no servidor.' Há dois blocos de conteúdo: 1) Uma caixa de texto cinza com instruções técnicas sobre 'Histórico de processos (Excel, grandes volumes)' contendo referências a script Python, comandos MySQL, UUID de sessão e endpoints de API REST com DELETE. 2) Um card branco intitulado 'Importar inadimplência condominial (PDF)' com descrição sobre análise de PDF, gravação de processos e débitos, importação via planilha XLS. No menu lateral esquerdo, 'Atividades em Lote' aparece destacado em azul, estando dentro da seção de navegação principal — porém o clique foi feito em 'Financeiro', que aparece logo abaixo como item separado com seta de expansão.

**Pontos positivos:**
- ✅ O subtítulo 'Operações em massa com confirmação antes de gravar no servidor' ao menos tenta explicar o propósito da tela
- ✅ O card de 'Importar inadimplência condominial (PDF)' tem uma descrição razoavelmente clara sobre o que faz
- ✅ O menu lateral destaca visualmente o item ativo em azul, ajudando a saber onde estou

**Problemas encontrados:**
- 🔴 **[critica]** A tela aberta não corresponde ao clique realizado: cliquei em 'Financeiro' mas a tela que abriu foi 'Atividades em Lote'. Isso é desorientador e quebra a confiança no sistema.
  → _Sugestão: O clique em 'Financeiro' deveria expandir o submenu ou abrir a tela correspondente ao módulo financeiro. 'Atividades em Lote' precisa ter seu próprio item de menu claramente separado e identificado, sem ambiguidade._
- 🔴 **[critica]** Linguagem completamente inadequada para o público-alvo: termos como 'script Python', '~/Downloads/migrar_historico_processos.py', 'UUID da sessão', 'DELETE /api/condominio/inadimplencia/reverter/{importacaoId}' e 'endpoint' são jargões técnicos de desenvolvedor, não de secretária de advocacia.
  → _Sugestão: Substituir o bloco técnico por uma linguagem simples: 'Para importar um histórico grande de processos via Excel, entre em contato com o administrador do sistema.' Ou criar um botão de upload com instruções em português claro, escondendo toda a parte técnica._
- 🔴 **[critica]** O card 'Importar inadimplência condominial (PDF)' não tem nenhum botão, link ou ação visível. É um bloco de texto que parece clicável mas não dá indicação clara de como iniciar o processo.
  → _Sugestão: Adicionar um botão explícito e destacado dentro do card, como 'Selecionar arquivo PDF' ou 'Iniciar importação', com ícone de upload para reforçar a ação esperada._
- 🟠 **[alta]** A tela está praticamente vazia — apenas um bloco técnico e um card. Se esta é uma área de 'Atividades em Lote', parece incompleta ou em construção, sem histórico de operações anteriores, status de importações, etc.
  → _Sugestão: Adicionar uma seção de histórico de atividades em lote realizadas, com data, tipo de operação, responsável, status (sucesso/erro) e opção de reverter. Isso daria segurança para a usuária._
- 🟠 **[alta]** Não há nenhuma indicação de que esta tela é restrita ou requer atenção especial. Operações em lote podem causar danos graves aos dados se usadas incorretamente, mas não há aviso, confirmação prévia ou explicação de risco.
  → _Sugestão: Adicionar um aviso destacado em amarelo ou laranja: 'Atenção: estas operações afetam múltiplos registros de uma vez. Em caso de dúvida, consulte o administrador antes de prosseguir.'_
- 🟡 **[media]** O bloco cinza com instruções técnicas usa fonte monoespaçada para os comandos de código, mas o texto mistura linguagem de documentação técnica com instrução operacional sem separação visual clara.
  → _Sugestão: Se esse bloco precisa existir, separá-lo em: 1) O que isso faz (em português simples) e 2) Instruções técnicas colapsáveis, visíveis apenas para quem precisar._
- 🟢 **[baixa]** O aviso no rodapé do menu lateral — 'Apenas o usuário master (Itamar) pode trocar de perfil neste menu' — aparece em texto pequeno e cinza, mas é uma informação relevante de permissão que poderia confundir.
  → _Sugestão: Mover esse aviso de permissão para as Configurações do perfil, ou exibi-lo como tooltip ao passar o mouse sobre a área de perfil._

**Sugestões de melhoria:**
- 💡 Criar uma tela de 'Financeiro' dedicada, que seja o destino real do clique nesse menu, com resumo de extratos, pagamentos pendentes e atalhos para as funções mais usadas
- 💡 Renomear 'Atividades em Lote' para algo mais descritivo como 'Importação de Dados em Massa' para deixar claro o propósito antes mesmo de abrir
- 💡 Adicionar ícone visual representativo (ex: ícone de arquivo com seta para cima) para reforçar que é uma área de importação
- 💡 Incluir um tutorial rápido ou vídeo de 1 minuto explicando quando e como usar cada função de lote
- 💡 Exibir um contador ou badge indicando se há operações em andamento ou com erro

**Fluxo do usuário:** Eu clicaria em 'Financeiro' esperando ver extratos ou pagamentos. Ao cair nessa tela, ficaria confusa por alguns segundos. Tentaria ler o primeiro bloco cinza e desistiria rapidamente por não entender nada. Veria o card de 'Importar inadimplência condominial (PDF)' e clicaria nele esperando algo acontecer — mas como não há botão claro, provavelmente clicaria no card inteiro sem saber se funcionou. Sem feedback, ficaria sem saber o que fazer e chamaria um colega ou o administrador para ajudar.

---

### ❌ Pagamentos — ?/10

---

### ❌ Pendências — 3/10

> _"Meu Deus, o que é essa mensagem em rosa? Deu erro? Fiz alguma coisa errada? E por que as colunas estão todas vazias? Isso deveria me mostrar as pendências do escritório mas não tem nada aqui. Fiquei confusa e com medo de ter quebrado alguma coisa."_ — Marina

**Descrição:** A tela apresenta um layout estilo Kanban com 5 colunas horizontais, cada uma representando um responsável: 'itamar', 'karla.pedroza', 'ana.luisa', 'MARINA' e 'Sem responsável'. Todas as colunas têm cabeçalho roxo/roxo escuro com setas de navegação (< >) e um campo cinza claro escrito 'Nova tarefa...' no corpo. No topo há três filtros: Responsável (Todos), Status (Todos) e Prioridade (Todas). Logo abaixo dos filtros aparece uma faixa de erro em rosa com o texto 'clienteId é obrigatório. — /api/tarefas' e um botão 'Fechar' à direita. O menu lateral esquerdo exibe todas as seções do sistema, com 'Pendências' destacado em azul. No rodapé esquerdo está o perfil logado como 'MARINA' com um aviso sobre usuário master.

**Pontos positivos:**
- ✅ A organização em colunas por responsável é uma boa ideia — visualmente entendo que cada pessoa tem sua fila de tarefas
- ✅ Os filtros no topo (Responsável, Status, Prioridade) são campos comuns e reconhecíveis
- ✅ O campo 'Nova tarefa...' sugere que posso clicar ali para adicionar algo, o que é relativamente intuitivo
- ✅ Ver meu nome 'MARINA' como uma das colunas me ajuda a identificar o que é meu
- ✅ O botão 'Fechar' na mensagem de erro é claro e acessível

**Problemas encontrados:**
- 🔴 **[critica]** Mensagem de erro técnica exposta ao usuário: 'clienteId é obrigatório. — /api/tarefas'
  → _Sugestão: Substituir por uma mensagem amigável como 'Selecione um cliente para ver as pendências' ou, se for erro do sistema, exibir 'Não foi possível carregar as pendências. Tente novamente.' com um botão de recarregar._
- 🔴 **[critica]** Todas as colunas estão completamente vazias — não há nenhuma pendência exibida
  → _Sugestão: Exibir um estado vazio informativo como 'Nenhuma pendência encontrada' apenas quando realmente não houver dados, e separar claramente do caso em que houve erro de carregamento._
- 🟠 **[alta]** Os nomes dos responsáveis nas colunas estão em formatos inconsistentes e informais: 'itamar' (minúsculo), 'karla.pedroza' (com ponto, minúsculo), 'ana.luisa' (com ponto), 'MARINA' (maiúsculo)
  → _Sugestão: Exibir o nome completo e formatado do responsável no cabeçalho da coluna, ex: 'Karla Pedroza', 'Ana Luísa', 'Marina'._
- 🟠 **[alta]** As setas de navegação (< >) nos cabeçalhos das colunas não têm função aparente e não há tooltip explicando para que servem
  → _Sugestão: Adicionar tooltip ao passar o mouse ('Ver tarefas anteriores / próximas') ou, se for paginação dentro da coluna, mostrar um contador como '1/5 tarefas'._
- 🟠 **[alta]** Não há botão explícito de 'Adicionar Pendência' ou 'Nova Pendência' — a única indicação é o placeholder 'Nova tarefa...' dentro de um campo cinza discreto
  → _Sugestão: Adicionar um botão verde ou azul '+  Nova Pendência' no topo da tela ou no cabeçalho de cada coluna, com rótulo legível._
- 🟡 **[media]** Não há indicação de quantidade de pendências em cada coluna
  → _Sugestão: Exibir um contador no cabeçalho de cada coluna, ex: 'MARINA (3)' ou 'itamar (7)'._
- 🟡 **[media]** O aviso no rodapé esquerdo 'Apenas o usuário master (Itamar) pode trocar de perfil neste menu' aparece em texto pequeno e comprimido, misturado com informações do perfil
  → _Sugestão: Exibir esse aviso como um ícone de informação (ℹ️) com tooltip ao lado do nome do perfil, ou remover o aviso e simplesmente desabilitar o campo._
- 🟢 **[baixa]** A coluna 'Sem responsável' fica cortada na borda direita da tela — não sei se tem mais colunas além dela
  → _Sugestão: Adicionar uma barra de rolagem horizontal visível ou uma seta indicando que há mais colunas à direita._

**Sugestões de melhoria:**
- 💡 Adicionar a possibilidade de visualizar pendências em modo lista, além do Kanban — para secretárias, uma lista com prazo e prioridade pode ser mais prática no dia a dia
- 💡 Incluir indicadores de prazo nas tarefas (ex: tag vermelha para tarefas vencidas, amarela para vencer hoje)
- 💡 Permitir filtrar por data de vencimento, não apenas por status e prioridade
- 💡 Destacar visualmente a coluna 'MARINA' (minha coluna) para eu encontrar minhas tarefas mais rápido ao abrir a tela
- 💡 Adicionar um resumo no topo: 'Total de pendências: X | Vencidas: Y | Hoje: Z'

**Fluxo do usuário:** Cliquei em 'Pendências' esperando ver uma lista de coisas para fazer. Apareceu o erro em rosa — fiquei assustada e cliquei em 'Fechar' para tentar sumir com ele. As colunas continuaram vazias. Tentei clicar no campo 'Nova tarefa...' da minha coluna (MARINA) para ver o que acontece. Ficaria perdida sem saber se os dados sumiram, se devo recarregar a página ou chamar o Itamar para ajudar.

---

### ❌ Tópicos — 2/10

> _"Que susto! Assim que a tela abriu, apareceu uma mensagem de erro em vermelho logo de cara — 'clienteId é obrigatório. — /api/tarefas'. Eu nem entendo o que isso significa. Parece que algo quebrou. Além disso, as colunas estão todas vazias, então não sei se é porque o sistema está com problema ou se realmente não há tarefas. Fiquei com medo de ter feito algo errado só de clicar no menu."_ — Marina

**Descrição:** A tela apresenta um layout Kanban (colunas por responsável) com 5 colunas: itamar, karla.pedroza, ana.luisa, MARINA e 'Sem responsável'. Cada coluna tem um cabeçalho roxo/lilás com setas de navegação (< >) e um campo interno com placeholder 'Nova tarefa...'. No topo da área de conteúdo há três filtros dropdown: Responsável (Todos), Status (Todos) e Prioridade (Todas). Logo abaixo dos filtros há um banner de erro em fundo rosa/vermelho claro com o texto 'clienteId é obrigatório. — /api/tarefas' e um botão 'Fechar' no canto direito. O menu lateral esquerdo está visível com diversas seções. Na parte inferior do menu aparece o perfil 'MARINA' com uma nota explicando que só o usuário master pode trocar de perfil.

**Pontos positivos:**
- ✅ A divisão por responsável em colunas é visualmente organizada — dá para entender que cada coluna pertence a uma pessoa
- ✅ Existe um botão 'Fechar' para dispensar a mensagem de erro, o que é melhor do que não ter nenhuma opção
- ✅ Os filtros de Responsável, Status e Prioridade estão no topo, acessíveis imediatamente sem rolagem
- ✅ O placeholder 'Nova tarefa...' sugere que posso adicionar tarefas diretamente na coluna, o que parece prático
- ✅ Meu nome (MARINA) aparece como uma das colunas, o que indica que o sistema reconhece meu usuário

**Problemas encontrados:**
- 🔴 **[critica]** Mensagem de erro técnica exposta diretamente ao usuário: 'clienteId é obrigatório. — /api/tarefas'
  → _Sugestão: Substituir a mensagem técnica por uma linguagem humana como: 'Não foi possível carregar as tarefas. Selecione um cliente para visualizar.' ou simplesmente ocultar esse erro e tratar internamente. Erros de API nunca devem aparecer para o usuário final._
- 🔴 **[critica]** Todas as colunas estão completamente vazias e não há explicação do motivo
  → _Sugestão: Adicionar um estado vazio informativo dentro de cada coluna, como: 'Nenhuma tarefa encontrada' ou 'Selecione um cliente para carregar as tarefas.' Com um ícone ilustrativo e instrução de próximo passo._
- 🟠 **[alta]** Nomes de usuários exibidos em formato de login (karla.pedroza, ana.luisa) misturado com nomes em maiúsculas (MARINA, itamar) — inconsistência de apresentação
  → _Sugestão: Padronizar todos os cabeçalhos com o nome completo ou nome social da pessoa, ex: 'Karla Pedroza', 'Ana Luísa', 'Marina', 'Itamar'. Evitar exibir usernames de sistema para o usuário._
- 🟠 **[alta]** Não está claro o que são 'Tópicos' no contexto de um escritório de advocacia
  → _Sugestão: Renomear para 'Tarefas' ou 'Quadro de Tarefas' se for esse o propósito. Ou adicionar um subtítulo explicativo abaixo do título da tela._
- 🟠 **[alta]** As setas de navegação (< >) nos cabeçalhos das colunas não têm tooltip ou explicação de função
  → _Sugestão: Adicionar tooltip ao passar o mouse (ex: 'Ver tarefas anteriores' / 'Ver próximas tarefas') ou substituir por ícone mais claro como paginação numerada._
- 🟡 **[media]** Não há botão explícito de 'Adicionar Tarefa' ou 'Nova Tarefa' — só um campo de texto com placeholder
  → _Sugestão: Adicionar um botão '+' ou '+ Nova tarefa' com destaque visual claro (cor de ação, como verde ou azul) no rodapé de cada coluna, deixando óbvio que é ali que se cria uma tarefa._
- 🟡 **[media]** A nota no rodapé do menu esquerdo ('Apenas o usuário master pode trocar de perfil...') está em texto muito pequeno e fora do contexto da tela principal
  → _Sugestão: Mover essa informação para as Configurações ou exibi-la apenas uma vez como tutorial, não permanentemente no menu._
- 🟢 **[baixa]** Não há título da tela visível — não sei se estou em 'Tópicos', 'Tarefas', 'Atividades' ou outro módulo
  → _Sugestão: Adicionar um título visível no topo da área de conteúdo, como 'Quadro de Tarefas' com breadcrumb: Tópicos > Tarefas._

**Sugestões de melhoria:**
- 💡 Adicionar contador de tarefas em cada coluna no cabeçalho, ex: 'MARINA (3)' — assim vejo de relance a carga de trabalho de cada pessoa
- 💡 Permitir indicação de cor ou prioridade visível diretamente no card dentro das colunas quando as tarefas forem carregadas
- 💡 Adicionar um botão de 'Atualizar' ou 'Recarregar' para quando eu suspeitar que a tela não carregou corretamente
- 💡 Exibir data de vencimento ou prazo nas tarefas do kanban quando disponível — essencial para um escritório com prazos judiciais
- 💡 Considerar um filtro por cliente, já que o erro sugere que o sistema precisa de um cliente selecionado para funcionar — esse filtro deveria ser óbvio e provavelmente obrigatório na interface

**Fluxo do usuário:** Eu clicaria em 'Tópicos' no menu esperando ver alguma lista de assuntos ou tarefas. Ao ver a tela, minha primeira reação seria de pânico com o erro vermelho — clicaria em 'Fechar' para sumir com ele. Depois olharia para as colunas vazias e ficaria confusa. Tentaria mexer nos filtros de Responsável, Status e Prioridade para ver se aparece algo. Ao não obter resultado, clicaria no campo 'Nova tarefa...' de uma coluna para tentar entender o que acontece. Provavelmente chamaria alguém para ajuda antes de continuar, por não ter clareza do que a tela exige de mim.

---

### ❌ Diagnósticos — 4/10

> _"Que tela é essa? 'Diagnósticos' pra mim soa como algo técnico, de computador com defeito. Quando abriu esse popup com vários botões, fiquei confusa — não entendi de imediato que isso é uma central de relatórios. Os botões são muitos, alguns nomes não me dizem nada (tipo 'Proc. Administrativo' ou 'Baixar Protocolos'), e lá embaixo tem um textão sobre 'sincronizar audiências' que parece coisa de técnico de TI, não de secretária."_ — Marina

**Descrição:** Um modal (janela popup) com cabeçalho roxo/violeta escrito 'Informe o relatório que deseja fazer' e ícone de robô/assistente. Dentro do modal há 13 botões dispostos em duas colunas: coluna esquerda (Consultas Realizadas — destacado com borda roxa, Consultas à Realizar, Audiências pendentes, Prazo Fatal, Consultas Atrasadas, Publicações, Busca pessoa, Busca por número, Réus por cliente (Excel)) e coluna direita (Aguardando Documentos, Aguardando Peticionar, Aguardando Verificação, Aguardando Protocolo, Aguardando Providência, Proc. Administrativo, Baixar Protocolos). Na parte inferior há uma seção cinza com texto denso explicando sincronização de audiências, campos 'Mês 4' e 'Ano 2026', e dois botões: 'Só este mês/ano' e 'Toda a agenda'. Ao fundo, à esquerda, aparece o menu lateral do sistema com o item 'Diagnósticos' selecionado.

**Pontos positivos:**
- ✅ O cabeçalho roxo com título 'Informe o relatório que deseja fazer' deixa claro que é uma escolha a ser feita
- ✅ O botão 'Consultas Realizadas' já aparece pré-selecionado (borda roxa destacada), sugerindo uma opção padrão ou mais usada
- ✅ Os botões são grandes o suficiente para clicar sem dificuldade, inclusive no celular
- ✅ O X no canto superior direito para fechar é um padrão conhecido — saberia fechar sem pensar
- ✅ A disposição em duas colunas aproveita bem o espaço horizontal do modal

**Problemas encontrados:**
- 🔴 **[critica]** O nome do menu 'Diagnósticos' não comunica absolutamente nada sobre o que há dentro. Uma secretária associa 'diagnóstico' a doença ou problema técnico, jamais a relatórios de processos.
  → _Sugestão: Renomear o menu para 'Relatórios' ou 'Relatórios e Consultas'. É simples, direto e comunica o conteúdo._
- 🟠 **[alta]** O bloco de texto na parte inferior ('Sincronizar audiências da agenda com o formulário de processos') é extremamente técnico e confuso para quem não é de TI. Termos como 'segundo plano', 'API', 'backend', 'CNJ', 'processoRef', 'histórico local' não fazem sentido para uma secretária.
  → _Sugestão: Reescrever o texto em linguagem simples, por exemplo: 'Atualizar automaticamente as audiências do sistema com base na agenda. Escolha se quer atualizar apenas o mês atual ou toda a agenda.' Esconder os detalhes técnicos em um link 'Saiba mais'._
- 🟠 **[alta]** Mistura de duas funcionalidades completamente distintas em uma mesma tela: seleção de relatório (parte de cima) e sincronização de audiências (parte de baixo). São coisas diferentes que não têm relação visual ou lógica entre si.
  → _Sugestão: Separar em duas seções claramente delimitadas com títulos distintos, ou mover a sincronização de audiências para uma outra área do sistema (ex: dentro de 'Agenda')._
- 🟠 **[alta]** Abreviação 'Proc. Administrativo' é ambígua — pode ser 'Processo Administrativo' ou 'Procedimento Administrativo'. Sem contexto, não sei o que vou gerar.
  → _Sugestão: Escrever o nome completo: 'Processo Administrativo'. Espaço não é tão escasso assim no botão._
- 🟡 **[media]** Não há nenhuma descrição do que cada relatório contém. São só nomes nos botões, sem tooltip, sem subtítulo, sem pré-visualização.
  → _Sugestão: Adicionar uma linha de descrição curta abaixo de cada botão, ou ao menos um tooltip ao passar o mouse explicando o que o relatório mostra._
- 🟡 **[media]** Não há agrupamento visual entre os botões da coluna direita (todos começam com 'Aguardando...') e os da coluna esquerda. São listas diferentes mas parecem iguais.
  → _Sugestão: Criar categorias visuais com cabeçalhos, por exemplo: 'Consultas e Buscas' (coluna esquerda) e 'Situação de Processos' (coluna direita), com uma linha separadora ou cor de fundo diferente._
- 🟡 **[media]** O botão 'Consultas à Realizar' tem erro de português — deveria ser 'Consultas a Realizar' (sem acento). Pequeno mas passa impressão de descuido.
  → _Sugestão: Corrigir para 'Consultas a Realizar'._
- 🟢 **[baixa]** O ícone no cabeçalho do modal parece um robô ou assistente virtual, mas a tela não é um chatbot — é uma seleção de relatório. O ícone induz ao erro.
  → _Sugestão: Trocar para um ícone de relatório/gráfico ou lista, que comunique melhor a função._

**Sugestões de melhoria:**
- 💡 Adicionar uma barra de busca dentro do modal para quem lembra o nome do relatório mas não quer procurar entre os 13 botões
- 💡 Mostrar os relatórios mais usados no topo com uma marcação visual (ex: estrela ou 'Mais usado')
- 💡 Após selecionar um relatório, dar um feedback claro de que ele está sendo gerado (ex: spinner com 'Gerando relatório...')
- 💡 Considerar salvar a última opção escolhida para que da próxima vez já apareça pré-selecionada corretamente
- 💡 Adicionar data de geração e nome do usuário automaticamente nos relatórios exportados

**Fluxo do usuário:** Clico em 'Diagnósticos' no menu lateral sem saber bem o que vou encontrar. O modal abre. Leio o título e entendo que preciso escolher um relatório. Fico olhando os 13 botões tentando entender a diferença entre eles. Escolho 'Consultas Realizadas' porque já aparece destacado e parece o mais básico. Aí vejo o bloco de texto lá embaixo sobre 'sincronizar audiências' e fico em dúvida: tenho que clicar em 'Toda a agenda' também? Ou isso é outra coisa? Decido ignorar e espero ver o que acontece ao clicar em 'Consultas Realizadas'. Torço para o sistema me mostrar algum resultado.

---

### ⚠️ WhatsApp — 6/10

> _"Ah, o escritório usa WhatsApp integrado no sistema! Isso é bem útil porque a gente já usa WhatsApp pra tudo mesmo. A tela parece bem organizada à primeira vista — não é poluída, dá pra entender que está mostrando um resumo do dia. Mas está tudo zerado, então fico sem saber se isso é porque o sistema ainda não foi configurado ou se realmente não teve nenhuma mensagem hoje. Fiquei um pouco insegura sobre se está funcionando corretamente."_ — Marina

**Descrição:** A tela exibe o módulo WhatsApp com aba 'Dashboard' ativa. No topo há uma barra de navegação com 4 abas: Dashboard, Conversas, Enviar mensagem e Agendamentos. Um botão verde 'Enviar mensagem' aparece também no canto superior direito da área de conteúdo. Abaixo há 4 cards de métricas: 'Enviadas hoje' (0), 'Recebidas hoje' (0), 'Agendamentos pendentes' (0) e 'Falhas hoje' (0, em vermelho). Na parte inferior há uma seção 'Próximos agendamentos pendentes' com link 'Ver todos' e a mensagem 'Nenhum agendamento pendente.' No menu lateral esquerdo, o item WhatsApp está expandido mostrando Dashboard e Conversas. No rodapé do menu aparece o perfil da usuária MARINA com uma nota sobre permissões e o botão 'Sair (sessão API)'.

**Pontos positivos:**
- ✅ Layout limpo e sem poluição visual — fácil de ler
- ✅ Os 4 cards de métricas são visualmente distintos e auto-explicativos, qualquer pessoa entende o que significa 'Enviadas hoje'
- ✅ O card 'Falhas hoje' usar o número em vermelho é excelente — chama atenção imediata para algo que precisa de ação
- ✅ Botão 'Enviar mensagem' está bem destacado em verde e posicionado em local de fácil acesso
- ✅ A duplicação do acesso 'Enviar mensagem' (aba no topo + botão verde) facilita o fluxo principal
- ✅ As abas no topo são claras: Dashboard, Conversas, Enviar mensagem, Agendamentos — nomes que qualquer pessoa entende
- ✅ A seção de agendamentos pendentes é relevante para uma secretária de advocacia

**Problemas encontrados:**
- 🟠 **[alta]** Todos os indicadores mostram zero e não há nenhum aviso explicando o motivo — o sistema está recém-configurado? A integração com WhatsApp está ativa? Houve alguma falha de conexão?
  → _Sugestão: Adicionar um indicador de status da conexão com o WhatsApp Business API — algo como um ícone verde 'Conectado' ou vermelho 'Desconectado' bem visível no topo da tela. Também seria útil mostrar a data/hora da última sincronização._
- 🟠 **[alta]** A nota no rodapé sobre perfil ('Apenas o usuário master (Itamar) pode trocar de perfil neste menu...') está escondida no canto inferior esquerdo, com fonte pequena e sem destaque
  → _Sugestão: Essa informação de permissão deveria aparecer como um banner ou tooltip quando a usuária tentar acessar configurações restritas, não ficar enterrada no rodapé do menu._
- 🟡 **[media]** O dashboard não mostra histórico nem comparativo — só o dia de hoje. Não sei se 0 enviadas hoje é normal ou se é pouco comparado a ontem.
  → _Sugestão: Adicionar uma linha de contexto nos cards, como 'Ontem: 12' ou uma pequeníssima barra/seta mostrando tendência (subiu/desceu em relação ao dia anterior)._
- 🟡 **[media]** A seção 'Próximos agendamentos pendentes' ocupa boa parte da tela mas está completamente vazia, mostrando apenas uma linha de texto. Deixa a tela com muito espaço vazio desperdiçado.
  → _Sugestão: Quando não houver agendamentos, mostrar uma mensagem mais amigável com uma ilustração pequena e um botão de ação: 'Nenhum agendamento ainda. Que tal agendar uma mensagem agora?' com link direto para a tela de agendamento._
- 🟡 **[media]** O botão 'Enviar mensagem' aparece duas vezes na mesma tela — como aba no topo E como botão verde no canto direito. Isso gera uma leve confusão: são a mesma coisa? Um faz algo diferente do outro?
  → _Sugestão: Manter apenas o botão verde como ação principal na área de conteúdo. Ou, se a duplicação for intencional, diferenciar visualmente (ex: a aba ser 'Nova mensagem' e o botão ser 'Envio rápido')._
- 🟢 **[baixa]** O texto 'Sair (sessão API)' no botão de logout é técnico demais para uma usuária comum
  → _Sugestão: Simplificar para 'Sair do sistema' ou apenas 'Sair'._

**Sugestões de melhoria:**
- 💡 Adicionar um card ou área mostrando as últimas conversas recentes diretamente no dashboard, sem precisar ir para a aba Conversas — isso agilizaria o trabalho da secretária
- 💡 Incluir atalhos rápidos para as ações mais comuns do dia a dia: 'Enviar para cliente' com busca por nome do cliente diretamente do dashboard
- 💡 Mostrar quais conversas estão sem resposta há mais de X horas — essencial para escritório de advocacia onde cliente espera retorno rápido
- 💡 Considerar adicionar um mini-gráfico semanal nos cards de métricas para visualizar o volume de mensagens ao longo da semana
- 💡 A logo e nome 'Villa Real e Advogados Associados' no menu lateral está muito pequena — considerar tornar isso mais presente para reforçar identidade do escritório

**Fluxo do usuário:** Ao chegar de manhã, eu abriria o WhatsApp no menu lateral, cairia nessa tela de Dashboard e olharia rapidamente os 4 cards pra ver se tem alguma mensagem recebida ou falha. Se 'Recebidas hoje' fosse maior que zero, clicaria em 'Conversas' para ver o que chegou. Se 'Falhas hoje' fosse maior que zero, também iria ver o que deu errado. Se precisasse mandar uma mensagem para um cliente, clicaria no botão verde 'Enviar mensagem'. O problema é que com tudo zerado, fico travada sem saber se devo fazer alguma coisa ou se está tudo funcionando normalmente.

---

### ❌ Integrações (lab) — 2/10

> _"Entrei na tela errada. Isso parece coisa de programador, não de secretária. Tem código aparecendo na tela, termos que nunca vi na vida como 'DSL', 'API pública', 'track_total_hits', 'Query DSL', 'índice activo'... Fiquei com medo de clicar em qualquer coisa. Não sei o que isso faz nem pra que serve no meu trabalho do dia a dia."_ — Marina

**Descrição:** A tela contém: um título 'DataJud (CNJ) — API pública'; links de navegação no topo (Glossário, Parametrização/painel, Pedidos em dev); um aviso em verde sobre 'laboratório DSL'; um aviso em amarelo sobre LGPD; um campo chamado 'Índice' com dropdown selecionando o TJGO; campo numérico 'size' com valor 20; checkbox 'track_total_hits'; um expansível com '28 tipos de pesquisa'; dois cards visíveis — 'Número do processo (CNJ formatado ou 20 dígitos)' e 'Match tutorial — só 20 dígitos', ambos com campos de texto e botão 'Executar'; abaixo dos cards aparecem blocos de código JSON bruto na tela. No menu lateral esquerdo, a opção 'DataJud — lab de buscas' aparece destacada dentro de 'Integrações (lab)'.

**Pontos positivos:**
- ✅ O aviso amarelo sobre LGPD é importante e está visível — pelo menos alguém pensou na proteção de dados
- ✅ O dropdown do tribunal já vem pré-selecionado com TJGO, que é o tribunal de Goiás — faz sentido para o escritório em Anápolis-GO
- ✅ Os cards de busca têm títulos descritivos como 'Número do processo (CNJ formatado ou 20 dígitos)', o que ajuda um pouco a entender o que digitar
- ✅ O botão 'Executar' tem cor verde destacada, fácil de localizar visualmente
- ✅ A seção está categorizada como '(lab)' no menu, sugerindo que é experimental — mas isso não está explicado para mim em lugar algum

**Problemas encontrados:**
- 🔴 **[critica]** A tela inteira é voltada para desenvolvedores/técnicos, não para usuários finais como secretárias. Termos como 'Query DSL', 'POST /datajud-proxy/{índice}/_search', 'api_publica_tjgo', 'track_total_hits', 'bool', 'query' em JSON são completamente inacessíveis para quem não é da área de TI.
  → _Sugestão: Criar uma interface simplificada 'modo secretária' com apenas um campo de busca 'Digite o número do processo' e um botão 'Buscar', escondendo toda a parte técnica/código para um modo avançado acessível só para administradores ou desenvolvedores._
- 🔴 **[critica]** O código JSON aparece diretamente na tela como resultado (visible no rodapé: '{', '"query": {', '"bool": {', '"erro": "20 dígitos obrigatórios"'). Isso não é um resultado utilizável por uma secretária — não mostra nome da parte, data, status do processo, nada legível.
  → _Sugestão: Transformar o retorno da API em uma tabela ou card legível com campos como: Número do processo, Partes envolvidas, Situação, Data de distribuição, Vara/Juízo — da mesma forma que um extrato bancário traduz dados técnicos em informação visível._
- 🟠 **[alta]** Não há nenhuma explicação do que essa tela faz em linguagem simples. O aviso verde diz 'a secção principal desta página é o laboratório DSL' — mas isso não me diz absolutamente nada sobre para que serve ou como usar no contexto do escritório.
  → _Sugestão: Adicionar um parágrafo introdutório simples como: 'Use esta ferramenta para consultar processos diretamente no sistema do CNJ/TJGO. Basta digitar o número do processo no campo abaixo e clicar em Buscar.' Linguagem humana, não técnica._
- 🟠 **[alta]** O campo 'size' com valor '20' e o checkbox 'track_total_hits' aparecem expostos sem nenhuma explicação. Eu não sei o que são, não sei se devo alterar e fico com medo de mudar algo que quebre a busca.
  → _Sugestão: Esconder esses controles técnicos em um painel 'Configurações avançadas' colapsado por padrão, acessível apenas quando necessário._
- 🟠 **[alta]** O menu mostra 'Integrações (lab)' com a subopção 'DataJud — lab de buscas'. A palavra 'lab' não é autoexplicativa para um usuário comum — não fica claro que é experimental/em desenvolvimento e que pode não funcionar perfeitamente.
  → _Sugestão: Adicionar um aviso proeminente no topo: 'ATENÇÃO: Esta é uma ferramenta experimental. Os resultados podem estar incompletos. Para consultas oficiais, acesse o portal do TJGO diretamente.' Com isso, pelo menos sei que não é para uso definitivo._
- 🟡 **[media]** Há dois cards de busca visíveis ('Número do processo CNJ formatado' e 'Match tutorial — só 20 dígitos') e mais 28 tipos de pesquisa escondidos em um expansível. Não sei a diferença entre eles nem qual devo usar.
  → _Sugestão: Ter apenas UM campo de busca principal destacado, com o sistema detectando automaticamente o formato digitado (com ou sem pontuação), e mover as variações técnicas para modo avançado._
- 🟡 **[media]** Os links no topo 'Pedidos em dev: /datajud-proxy' e 'api_publica_tjgo' são completamente sem sentido para um usuário não técnico e poluem visualmente o cabeçalho.
  → _Sugestão: Remover esses links técnicos da interface para usuários comuns, deixando apenas para perfis de administrador/desenvolvedor._
- 🟢 **[baixa]** O texto 'Índice activo: api_publica_tjgo' usa a palavra 'activo' com ortografia portuguesa de Portugal (não brasileira). O correto no Brasil seria 'ativo'.
  → _Sugestão: Corrigir para 'Índice ativo: api_publica_tjgo'._

**Sugestões de melhoria:**
- 💡 Criar dois modos de visualização: 'Modo Simples' (para secretárias e advogados) com interface amigável de busca, e 'Modo Desenvolvedor' (para técnicos) com a interface atual
- 💡 Adicionar um tutorial em vídeo ou passo a passo visual de como usar a ferramenta para consultar um processo real
- 💡 Integrar os resultados da busca DataJud diretamente com os processos já cadastrados no sistema do escritório, mostrando se o processo já está na base ou é novo
- 💡 Adicionar um histórico de buscas recentes para não precisar redigitar números de processo toda vez
- 💡 Incluir um botão 'Importar processo para o sistema' junto ao resultado, para que a secretária possa já cadastrar o processo encontrado com um clique

**Fluxo do usuário:** Eu olharia para a tela sem entender nada. Tentaria ignorar os textos técnicos e focaria nos campos com caixinhas para digitar. Digitaria o número do processo no card '1. Número do processo'. Clicaria em 'Executar'. Veria aparecer um bloco de código JSON e ficaria sem saber o que fazer com aquilo. Provavelmente chamaria minha supervisora ou o suporte técnico perguntando 'isso deu certo?' porque não teria como saber pelo resultado. Desistiria de usar essa tela e buscaria o processo diretamente no site do TJGO que, ironicamente, é mais fácil de usar do que esta tela.

---

### ⚠️ Usuários — 5/10

> _"Estranhei um pouco — eu esperava encontrar aqui os clientes do escritório, mas parece que é uma tela de controle de quem acessa o sistema. Vi meu próprio nome lá (Marina Teste), o que foi meio assustador. A tela não parece ser para mim usar no dia a dia, parece coisa de administrador de TI."_ — Marina

**Descrição:** A tela exibe uma listagem de usuários cadastrados no sistema com cabeçalho explicativo em texto corrido, dois botões de atalho no canto superior direito ('Cadastro de Pessoas' e 'Abrir Agenda'), uma barra de filtro com dropdown 'Apelido ou nome de cadastro (API)', campo de busca, checkbox 'Apenas ativos' e botão roxo 'Novo usuário'. A tabela lista 4 registros com colunas: ID, Nome (Pessoas), Apelido, Login, Pessoa Nº, Ativo e Ações. Cada linha tem 3 botões de ação: 'Dados', 'Permissões' e 'Inativar'. Na parte inferior há paginação com controle de itens por página. O menu lateral esquerdo está visível com diversas seções. Na parte inferior esquerda há informações do perfil logado 'MARINA' com aviso sobre permissões.

**Pontos positivos:**
- ✅ A tabela é limpa e organizada, fácil de ler cada linha
- ✅ O botão 'Novo usuário' está bem destacado em roxo e posicionado no canto superior direito, onde os olhos naturalmente buscam ações principais
- ✅ O checkbox 'Apenas ativos' é um filtro prático que evita poluição visual com usuários inativos
- ✅ O aviso no rodapé esquerdo sobre permissões do perfil é útil, mesmo que pequeno
- ✅ Os botões de atalho 'Cadastro de Pessoas' e 'Abrir Agenda' no topo direito são convenientes para navegação rápida
- ✅ A contagem '4 registro(s)' logo acima da tabela é imediata e clara

**Problemas encontrados:**
- 🟠 **[alta]** O texto explicativo no topo é longo demais e técnico demais para uma secretária. Termos como 'paginação', 'espelho completo de usuários ativos carregado em segundo plano', 'apelido é o único nome de usuário mostrado no sistema' são jargões de sistema que não dizem nada pra mim.
  → _Sugestão: Substituir o texto por uma frase simples e objetiva: 'Gerencie quem tem acesso ao sistema. Cada usuário precisa estar vinculado a uma pessoa cadastrada.' O restante poderia ficar em um ícone de ajuda '?' para quem quiser saber mais._
- 🟠 **[alta]** Os três botões de ação por linha ('Dados', 'Permissões', 'Inativar') não têm distinção visual entre si — dois têm ícone e borda, um não tem. O botão 'Inativar' é destrutivo (desativa o acesso de alguém) e não tem nenhuma cor de alerta, fica igual aos outros visualmente.
  → _Sugestão: Colorir o botão 'Inativar' em vermelho ou laranja com ícone de alerta, e adicionar um modal de confirmação: 'Tem certeza que deseja inativar o usuário X? Ele perderá o acesso ao sistema.'_
- 🟠 **[alta]** O ID do usuário 'Marina Teste (QA Automatizado)' é 100005, enquanto os outros são 1, 2 e 3. Isso é visualmente estranho e confuso — parece um erro ou dado de teste que ficou na tela de produção.
  → _Sugestão: Dados de teste (QA) não deveriam aparecer em ambiente de produção. Se for necessário manter, ao menos sinalizar com uma badge 'TESTE' para diferenciar._
- 🟡 **[media]** O dropdown de filtro diz 'Apelido ou nome de cadastro (API)'. O trecho '(API)' não significa nada para mim. Parece um erro de digitação ou coisa técnica que ficou exposta.
  → _Sugestão: Remover o '(API)' do label ou substituir por algo como 'Apelido ou nome completo'._
- 🟡 **[media]** A faixa roxa com o texto sobre paginação ('mesma paginação do relatório de pessoas... espelho completo... segundo plano') é muito técnica e desnecessária para o usuário final. Ela ocupa espaço visual e não agrega nada para quem usa a tela.
  → _Sugestão: Remover esse aviso da interface principal ou movê-lo para um tooltip de informação técnica acessível apenas por administradores._
- 🟡 **[media]** Não há indicação visual de qual usuário está logado atualmente na tabela. Meu registro (Marina) aparece sem nenhum destaque especial.
  → _Sugestão: Destacar com uma badge 'Você' ou ícone especial na linha do usuário logado atualmente._
- 🟢 **[baixa]** A coluna 'PESSOA Nº' não é autoexplicativa. Os números 868, 1085, 6899, 7179 não dizem nada para mim sem contexto.
  → _Sugestão: Renomear para 'Cód. Cadastro' e adicionar um tooltip explicando que é o número do cadastro de pessoas vinculado._

**Sugestões de melhoria:**
- 💡 Adicionar uma coluna 'Último acesso' na tabela seria muito útil para o administrador identificar usuários inativos de fato (mesmo que marcados como ativos)
- 💡 O botão 'Novo usuário' poderia ter um fluxo guiado (wizard) para secretárias iniciantes, explicando passo a passo: 1º vincule a uma pessoa, 2º defina o apelido, 3º configure permissões
- 💡 Adicionar ícones de cargo/função ao lado do nome (ex: ícone de advogado, secretária, sócio) ajudaria a identificar visualmente o perfil de cada usuário
- 💡 Seria útil poder ordenar as colunas clicando no cabeçalho — não ficou claro se isso é possível
- 💡 Um indicador de 'força da senha' ou 'senha nunca alterada' na tabela ajudaria na segurança do escritório

**Fluxo do usuário:** Ao chegar nessa tela, primeiro ficaria tentando entender o que é essa lista — são clientes? funcionários? Depois de ler o cabeçalho (confuso), perceberia que são as pessoas com acesso ao sistema. Se precisasse cadastrar alguém novo, clicaria em 'Novo usuário' (bem visível). Se precisasse editar alguém, procuraria o nome na lista e clicaria em 'Dados' — mas ficaria com dúvida se 'Permissões' também serve pra editar dados básicos. Evitaria clicar em 'Inativar' por medo de fazer algo errado sem querer.

---

### ❌ Agenda mensal
Não foi possível acessar: Menu não encontrado ou erro ao clicar

### ❌ Usuários (botão roxo)
Não foi possível acessar: Menu não encontrado ou erro ao clicar

## 🎯 Backlog de Melhorias (priorizado)

1. **[Pessoas]** Substituir o texto técnico por uma instrução simples e objetiva, como 'Gerencie os imóveis administrados pelo escritório. Cadastre locação, proprietário e inquilino.' Detalhes técnicos sobre API podem ir em uma tela de ajuda separada, acessível por um ícone de '?'. _(correção — alta)_
2. **[Pessoas]** Aumentar a largura dos cards ou reduzir o tamanho da fonte para exibir o nome completo. Alternativamente, ao passar o mouse sobre o nome truncado, mostrar o nome completo em um tooltip. _(correção — alta)_
3. **[Pessoas]** Implementar validação com alerta visual (ícone de atenção) quando o valor de aluguel for muito baixo ou incomum para o contexto. Pode ser uma faixa configurável pelo administrador. _(correção — alta)_
4. **[Clientes]** Adotar um padrão de cores com significado: ação principal em destaque (ex: azul), ações secundárias em cinza, ações destrutivas em vermelho. Ou agrupar os botões por categoria. _(correção — alta)_
5. **[Clientes]** Adicionar um botão 'Novo Cliente' bem visível, preferencialmente no cabeçalho ou próximo à barra de busca. _(correção — alta)_
6. **[Clientes]** Mostrar um resumo dos processos diretamente (número, status, data), com a grade carregada automaticamente ao selecionar o cliente. _(correção — alta)_
7. **[Agenda]** Adicionar um botão visível '+ Novo Compromisso' que, ao clicar, expande o formulário. O horário padrão '14:30' deve estar claramente editável ou ter um placeholder como 'HH:MM'. _(correção — alta)_
8. **[Agenda]** Renomear para 'Salvar' ou 'Agendar' se for o botão de confirmar. Se for uma opção de status, transformar em um select/dropdown com opções: Confirmado, Pendente, Cancelado. _(correção — alta)_
9. **[Agenda]** Adicionar uma visualização de semana ou pelo menos uma lista dos próximos 5 dias com indicador de quantidade de compromissos por dia. _(correção — alta)_
10. **[Atividades em Lote]** Se há apenas uma ação disponível para o meu perfil, ela deveria estar centralizada e destacada, com instrução passo a passo clara: '1. Selecione o PDF', '2. Confirme os dados', '3. Importe'. _(correção — alta)_
11. **[Atividades em Lote]** Adicionar um texto de ajuda contextual simples: 'Use esta opção quando receber um PDF de inadimplência de condomínio para cadastrar automaticamente os processos no sistema.' Com talvez um ícone de '?' com tooltip explicativo. _(correção — alta)_
12. **[Financeiro]** Adicionar uma seção de histórico de atividades em lote realizadas, com data, tipo de operação, responsável, status (sucesso/erro) e opção de reverter. Isso daria segurança para a usuária. _(correção — alta)_
13. **[Financeiro]** Adicionar um aviso destacado em amarelo ou laranja: 'Atenção: estas operações afetam múltiplos registros de uma vez. Em caso de dúvida, consulte o administrador antes de prosseguir.' _(correção — alta)_
14. **[Pendências]** Exibir o nome completo e formatado do responsável no cabeçalho da coluna, ex: 'Karla Pedroza', 'Ana Luísa', 'Marina'. _(correção — alta)_
15. **[Pendências]** Adicionar tooltip ao passar o mouse ('Ver tarefas anteriores / próximas') ou, se for paginação dentro da coluna, mostrar um contador como '1/5 tarefas'. _(correção — alta)_
16. **[Pendências]** Adicionar um botão verde ou azul '+  Nova Pendência' no topo da tela ou no cabeçalho de cada coluna, com rótulo legível. _(correção — alta)_
17. **[Tópicos]** Padronizar todos os cabeçalhos com o nome completo ou nome social da pessoa, ex: 'Karla Pedroza', 'Ana Luísa', 'Marina', 'Itamar'. Evitar exibir usernames de sistema para o usuário. _(correção — alta)_
18. **[Tópicos]** Renomear para 'Tarefas' ou 'Quadro de Tarefas' se for esse o propósito. Ou adicionar um subtítulo explicativo abaixo do título da tela. _(correção — alta)_
19. **[Tópicos]** Adicionar tooltip ao passar o mouse (ex: 'Ver tarefas anteriores' / 'Ver próximas tarefas') ou substituir por ícone mais claro como paginação numerada. _(correção — alta)_
20. **[Diagnósticos]** Reescrever o texto em linguagem simples, por exemplo: 'Atualizar automaticamente as audiências do sistema com base na agenda. Escolha se quer atualizar apenas o mês atual ou toda a agenda.' Esconder os detalhes técnicos em um link 'Saiba mais'. _(correção — alta)_
21. **[Diagnósticos]** Separar em duas seções claramente delimitadas com títulos distintos, ou mover a sincronização de audiências para uma outra área do sistema (ex: dentro de 'Agenda'). _(correção — alta)_
22. **[Diagnósticos]** Escrever o nome completo: 'Processo Administrativo'. Espaço não é tão escasso assim no botão. _(correção — alta)_
23. **[WhatsApp]** Adicionar um indicador de status da conexão com o WhatsApp Business API — algo como um ícone verde 'Conectado' ou vermelho 'Desconectado' bem visível no topo da tela. Também seria útil mostrar a data/hora da última sincronização. _(correção — alta)_
24. **[WhatsApp]** Essa informação de permissão deveria aparecer como um banner ou tooltip quando a usuária tentar acessar configurações restritas, não ficar enterrada no rodapé do menu. _(correção — alta)_
25. **[Integrações (lab)]** Adicionar um parágrafo introdutório simples como: 'Use esta ferramenta para consultar processos diretamente no sistema do CNJ/TJGO. Basta digitar o número do processo no campo abaixo e clicar em Buscar.' Linguagem humana, não técnica. _(correção — alta)_
26. **[Integrações (lab)]** Esconder esses controles técnicos em um painel 'Configurações avançadas' colapsado por padrão, acessível apenas quando necessário. _(correção — alta)_
27. **[Integrações (lab)]** Adicionar um aviso proeminente no topo: 'ATENÇÃO: Esta é uma ferramenta experimental. Os resultados podem estar incompletos. Para consultas oficiais, acesse o portal do TJGO diretamente.' Com isso, pelo menos sei que não é para uso definitivo. _(correção — alta)_
28. **[Usuários]** Substituir o texto por uma frase simples e objetiva: 'Gerencie quem tem acesso ao sistema. Cada usuário precisa estar vinculado a uma pessoa cadastrada.' O restante poderia ficar em um ícone de ajuda '?' para quem quiser saber mais. _(correção — alta)_
29. **[Usuários]** Colorir o botão 'Inativar' em vermelho ou laranja com ícone de alerta, e adicionar um modal de confirmação: 'Tem certeza que deseja inativar o usuário X? Ele perderá o acesso ao sistema.' _(correção — alta)_
30. **[Usuários]** Dados de teste (QA) não deveriam aparecer em ambiente de produção. Se for necessário manter, ao menos sinalizar com uma badge 'TESTE' para diferenciar. _(correção — alta)_
31. **[Pessoas]** Escrever o nome completo: 'Abrir Processo'. Botões com ações importantes não devem ter nomes abreviados. _(correção — media)_
32. **[Pessoas]** Diferenciar claramente os nomes: por exemplo, 'Pagamentos de Imóveis' e 'Pagamentos (Financeiro)' ou reorganizar o menu para evitar itens com nomes duplicados. _(correção — media)_
33. **[Pessoas]** Se essa informação é relevante para o usuário atual, exibi-la como um aviso destacado no topo da tela ou como notificação no login. Não enterrar informações importantes no rodapé do menu. _(correção — media)_
34. **[Clientes]** Mover esse aviso para uma seção de configurações ou exibi-lo apenas quando o usuário tentar trocar o perfil. Não deve estar visível o tempo todo. _(correção — media)_
35. **[Clientes]** Reduzir o tamanho do campo de observação ou adicionar um placeholder com exemplo: 'Ex.: Cliente indicado por Dr. João. Prefere contato por WhatsApp.' _(correção — media)_
36. **[Agenda]** Renomear o botão para algo claro como 'Gerenciar Usuários' ou 'Ver todos os usuários'. Se serve para filtrar a agenda por usuário, chamar de 'Filtrar por usuário'. _(correção — media)_
37. **[Agenda]** Destacar mais o botão 'Agenda mensal' ou adicionar um indicador visual no calendário lateral mostrando os dias que têm compromissos (pontinhos coloridos nos números dos dias). _(correção — media)_
38. **[Atividades em Lote]** Substituir por linguagem mais acessível: 'Importe vários registros de uma vez. Você poderá revisar tudo antes de salvar.' _(correção — media)_
39. **[Atividades em Lote]** Adicionar uma seção 'Importações Recentes' com status (Concluído, Erro, Em andamento), data e número de registros importados. _(correção — media)_
40. **[Financeiro]** Se esse bloco precisa existir, separá-lo em: 1) O que isso faz (em português simples) e 2) Instruções técnicas colapsáveis, visíveis apenas para quem precisar. _(correção — media)_
41. **[Pendências]** Exibir um contador no cabeçalho de cada coluna, ex: 'MARINA (3)' ou 'itamar (7)'. _(correção — media)_
42. **[Pendências]** Exibir esse aviso como um ícone de informação (ℹ️) com tooltip ao lado do nome do perfil, ou remover o aviso e simplesmente desabilitar o campo. _(correção — media)_
43. **[Tópicos]** Adicionar um botão '+' ou '+ Nova tarefa' com destaque visual claro (cor de ação, como verde ou azul) no rodapé de cada coluna, deixando óbvio que é ali que se cria uma tarefa. _(correção — media)_
44. **[Tópicos]** Mover essa informação para as Configurações ou exibi-la apenas uma vez como tutorial, não permanentemente no menu. _(correção — media)_
45. **[Diagnósticos]** Adicionar uma linha de descrição curta abaixo de cada botão, ou ao menos um tooltip ao passar o mouse explicando o que o relatório mostra. _(correção — media)_
46. **[Diagnósticos]** Criar categorias visuais com cabeçalhos, por exemplo: 'Consultas e Buscas' (coluna esquerda) e 'Situação de Processos' (coluna direita), com uma linha separadora ou cor de fundo diferente. _(correção — media)_
47. **[Diagnósticos]** Corrigir para 'Consultas a Realizar'. _(correção — media)_
48. **[WhatsApp]** Adicionar uma linha de contexto nos cards, como 'Ontem: 12' ou uma pequeníssima barra/seta mostrando tendência (subiu/desceu em relação ao dia anterior). _(correção — media)_
49. **[WhatsApp]** Quando não houver agendamentos, mostrar uma mensagem mais amigável com uma ilustração pequena e um botão de ação: 'Nenhum agendamento ainda. Que tal agendar uma mensagem agora?' com link direto para a tela de agendamento. _(correção — media)_
50. **[WhatsApp]** Manter apenas o botão verde como ação principal na área de conteúdo. Ou, se a duplicação for intencional, diferenciar visualmente (ex: a aba ser 'Nova mensagem' e o botão ser 'Envio rápido'). _(correção — media)_
51. **[Integrações (lab)]** Ter apenas UM campo de busca principal destacado, com o sistema detectando automaticamente o formato digitado (com ou sem pontuação), e mover as variações técnicas para modo avançado. _(correção — media)_
52. **[Integrações (lab)]** Remover esses links técnicos da interface para usuários comuns, deixando apenas para perfis de administrador/desenvolvedor. _(correção — media)_
53. **[Usuários]** Remover o '(API)' do label ou substituir por algo como 'Apelido ou nome completo'. _(correção — media)_
54. **[Usuários]** Remover esse aviso da interface principal ou movê-lo para um tooltip de informação técnica acessível apenas por administradores. _(correção — media)_
55. **[Usuários]** Destacar com uma badge 'Você' ou ícone especial na linha do usuário logado atualmente. _(correção — media)_
56. **[Pessoas]** Garantir que cada item do menu leva para a seção correspondente. Se 'Pessoas' foi clicado, a tela de listagem de pessoas deve abrir. Revisar o comportamento de navegação de todos os itens do menu. _(correção — critica)_
57. **[Pessoas]** Usar ícones com tooltip explicativo ao passar o mouse ('Fechar aviso' e 'Fechar imóvel') ou substituir um dos X por um botão com rótulo textual mais claro. _(correção — baixa)_
58. **[Pessoas]** Adicionar uma barra de busca para encontrar imóveis rapidamente por número, nome do inquilino ou proprietário — hoje parece que só dá para navegar pelo número _(melhoria — baixa)_
59. **[Pessoas]** Mostrar um histórico rápido das últimas ações feitas no imóvel (ex: 'Última alteração: 10/05/2025 por Marina'), o que ajuda a rastrear mudanças _(melhoria — baixa)_
60. **[Pessoas]** Incluir um indicador visual de 'alterações não salvas' quando algum campo for modificado, para eu não esquecer de clicar em Salvar _(melhoria — baixa)_
61. **[Pessoas]** Criar uma área de 'acesso rápido' para as tarefas mais comuns (cadastrar novo imóvel, ver imóveis vencendo, imóveis em atraso), que seria muito útil no dia a dia _(melhoria — baixa)_
62. **[Pessoas]** Considerar um modo de visualização em lista/tabela de todos os imóveis, para ter uma visão geral antes de entrar no detalhe de um específico _(melhoria — baixa)_
63. **[Clientes]** A tela deveria abrir limpa, só com a barra de busca ativa, e só mostrar o formulário após uma pesquisa ou clique em 'Novo Cliente'. _(correção — critica)_
64. **[Clientes]** Substituir ou complementar com um rótulo mais descritivo como 'ID Pessoa (interno)' ou integrar esse campo com o de Nome/Razão Social, tornando-o invisível para o usuário final. _(correção — critica)_
65. **[Clientes]** Unificar em um único controle de edição, com botão claro: 'Habilitar Edição' ou um cadeado clicável, e remover a duplicidade. _(correção — critica)_
66. **[Clientes]** Adicionar tooltip ou rótulo 'Fechar' e mostrar confirmação se houver dados não salvos. _(correção — baixa)_
67. **[Clientes]** Adicionar um histórico rápido dos últimos clientes acessados para facilitar o retorno a registros recentes _(melhoria — baixa)_
68. **[Clientes]** Incluir um indicador de 'Cliente com processos em andamento' diretamente no card de identificação, para chamar atenção antes de qualquer ação _(melhoria — baixa)_
69. **[Clientes]** Criar um modo 'Visualização rápida' e um modo 'Edição' com visual claramente diferente (ex: bordas dos campos ficam azuis no modo edição) _(melhoria — baixa)_
70. **[Clientes]** Adicionar contadores resumidos no card do cliente: quantos processos, quantos documentos, saldo em conta corrente — sem precisar clicar em cada aba _(melhoria — baixa)_
71. **[Clientes]** Incluir atalhos de teclado documentados (ex: F2 para editar, ESC para cancelar) para usuários que vão usar o sistema o dia todo _(melhoria — baixa)_
72. **[Agenda]** Ter UM único painel lateral com o calendário e a seleção de data/usuário. Os dois dias (hoje e próximo) no centro já cumprem o papel de mostrar datas diferentes. Eliminar a coluna direita ou transformá-la em algo útil (ex: lista de pendências da semana). _(correção — critica)_
73. **[Agenda]** Substituir o fundo escuro por um card branco ou cinza claro com ícone neutro e mensagem amigável como 'Nenhum compromisso agendado para este dia. Que tal adicionar um?' com a cor de fundo em tom suave. _(correção — critica)_
74. **[Agenda]** Ampliar o textarea ou usar um modal/painel de detalhes ao clicar em '+ Novo Compromisso', com campos mais ricos: tipo de compromisso, processo vinculado, cliente, local, observações. _(correção — baixa)_
75. **[Agenda]** Adicionar indicadores visuais no calendário (bolinhas ou marcações) nos dias que já possuem compromissos cadastrados — assim eu já sei de longe quais dias estão ocupados _(melhoria — baixa)_
76. **[Agenda]** Mostrar o nome completo do processo ou cliente vinculado ao compromisso quando houver eventos, não só no duplo clique _(melhoria — baixa)_
77. **[Agenda]** Incluir um campo de busca na agenda para encontrar compromissos por nome de cliente ou tipo _(melhoria — baixa)_
78. **[Agenda]** Permitir arrastar compromissos entre dias (drag and drop) para reagendamentos rápidos _(melhoria — baixa)_
79. **[Agenda]** Adicionar notificação ou destaque visual quando um compromisso está prestes a vencer (ex: nas próximas 2 horas) _(melhoria — baixa)_
80. **[Agenda]** Mostrar feriados nacionais e locais (Goiás/Anápolis) destacados no calendário, o que é essencial num escritório de advocacia para controle de prazos _(melhoria — baixa)_
81. **[Atividades em Lote]** Esse conteúdo técnico deveria estar em uma área restrita a administradores ou desenvolvedores, completamente oculta para perfis como o meu (secretária). Se precisar aparecer, deveria estar em uma aba 'Avançado' ou 'Administração' com aviso de que é para uso técnico. _(correção — critica)_
82. **[Atividades em Lote]** Adicionar um botão explícito e destacado dentro do card, como 'Iniciar Importação' ou 'Selecionar PDF', com cor chamativa (verde ou azul). O card precisa ter aparência claramente interativa (hover, sombra, cursor pointer). _(correção — critica)_
83. **[Atividades em Lote]** Exibir essa informação apenas quando o usuário tentar clicar em trocar de perfil, não permanentemente. _(correção — baixa)_
84. **[Atividades em Lote]** Criar perfis de acesso que filtrem o conteúdo exibido: secretária não deveria ver instruções de script Python e comandos de banco de dados _(melhoria — baixa)_
85. **[Atividades em Lote]** Adicionar ícones visuais representativos para cada tipo de atividade em lote (ícone de PDF para importação, ícone de Excel para planilha) _(melhoria — baixa)_
86. **[Atividades em Lote]** Incluir um mini-tutorial ou vídeo de 1 minuto explicando o que são 'atividades em lote' e quando usar _(melhoria — baixa)_
87. **[Atividades em Lote]** Mostrar um contador de 'X processos importados este mês' para dar senso de uso e confiança na funcionalidade _(melhoria — baixa)_
88. **[Atividades em Lote]** Considerar renomear o menu de 'Atividades em Lote' para algo mais descritivo como 'Importações em Massa' ou 'Importar Dados' _(melhoria — baixa)_
89. **[Financeiro]** O clique em 'Financeiro' deveria expandir o submenu ou abrir a tela correspondente ao módulo financeiro. 'Atividades em Lote' precisa ter seu próprio item de menu claramente separado e identificado, sem ambiguidade. _(correção — critica)_
90. **[Financeiro]** Substituir o bloco técnico por uma linguagem simples: 'Para importar um histórico grande de processos via Excel, entre em contato com o administrador do sistema.' Ou criar um botão de upload com instruções em português claro, escondendo toda a parte técnica. _(correção — critica)_
91. **[Financeiro]** Adicionar um botão explícito e destacado dentro do card, como 'Selecionar arquivo PDF' ou 'Iniciar importação', com ícone de upload para reforçar a ação esperada. _(correção — critica)_
92. **[Financeiro]** Mover esse aviso de permissão para as Configurações do perfil, ou exibi-lo como tooltip ao passar o mouse sobre a área de perfil. _(correção — baixa)_
93. **[Financeiro]** Criar uma tela de 'Financeiro' dedicada, que seja o destino real do clique nesse menu, com resumo de extratos, pagamentos pendentes e atalhos para as funções mais usadas _(melhoria — baixa)_
94. **[Financeiro]** Renomear 'Atividades em Lote' para algo mais descritivo como 'Importação de Dados em Massa' para deixar claro o propósito antes mesmo de abrir _(melhoria — baixa)_
95. **[Financeiro]** Adicionar ícone visual representativo (ex: ícone de arquivo com seta para cima) para reforçar que é uma área de importação _(melhoria — baixa)_
96. **[Financeiro]** Incluir um tutorial rápido ou vídeo de 1 minuto explicando quando e como usar cada função de lote _(melhoria — baixa)_
97. **[Financeiro]** Exibir um contador ou badge indicando se há operações em andamento ou com erro _(melhoria — baixa)_
98. **[Pendências]** Substituir por uma mensagem amigável como 'Selecione um cliente para ver as pendências' ou, se for erro do sistema, exibir 'Não foi possível carregar as pendências. Tente novamente.' com um botão de recarregar. _(correção — critica)_
99. **[Pendências]** Exibir um estado vazio informativo como 'Nenhuma pendência encontrada' apenas quando realmente não houver dados, e separar claramente do caso em que houve erro de carregamento. _(correção — critica)_
100. **[Pendências]** Adicionar uma barra de rolagem horizontal visível ou uma seta indicando que há mais colunas à direita. _(correção — baixa)_
101. **[Pendências]** Adicionar a possibilidade de visualizar pendências em modo lista, além do Kanban — para secretárias, uma lista com prazo e prioridade pode ser mais prática no dia a dia _(melhoria — baixa)_
102. **[Pendências]** Incluir indicadores de prazo nas tarefas (ex: tag vermelha para tarefas vencidas, amarela para vencer hoje) _(melhoria — baixa)_
103. **[Pendências]** Permitir filtrar por data de vencimento, não apenas por status e prioridade _(melhoria — baixa)_
104. **[Pendências]** Destacar visualmente a coluna 'MARINA' (minha coluna) para eu encontrar minhas tarefas mais rápido ao abrir a tela _(melhoria — baixa)_
105. **[Pendências]** Adicionar um resumo no topo: 'Total de pendências: X | Vencidas: Y | Hoje: Z' _(melhoria — baixa)_
106. **[Tópicos]** Substituir a mensagem técnica por uma linguagem humana como: 'Não foi possível carregar as tarefas. Selecione um cliente para visualizar.' ou simplesmente ocultar esse erro e tratar internamente. Erros de API nunca devem aparecer para o usuário final. _(correção — critica)_
107. **[Tópicos]** Adicionar um estado vazio informativo dentro de cada coluna, como: 'Nenhuma tarefa encontrada' ou 'Selecione um cliente para carregar as tarefas.' Com um ícone ilustrativo e instrução de próximo passo. _(correção — critica)_
108. **[Tópicos]** Adicionar um título visível no topo da área de conteúdo, como 'Quadro de Tarefas' com breadcrumb: Tópicos > Tarefas. _(correção — baixa)_
109. **[Tópicos]** Adicionar contador de tarefas em cada coluna no cabeçalho, ex: 'MARINA (3)' — assim vejo de relance a carga de trabalho de cada pessoa _(melhoria — baixa)_
110. **[Tópicos]** Permitir indicação de cor ou prioridade visível diretamente no card dentro das colunas quando as tarefas forem carregadas _(melhoria — baixa)_
111. **[Tópicos]** Adicionar um botão de 'Atualizar' ou 'Recarregar' para quando eu suspeitar que a tela não carregou corretamente _(melhoria — baixa)_
112. **[Tópicos]** Exibir data de vencimento ou prazo nas tarefas do kanban quando disponível — essencial para um escritório com prazos judiciais _(melhoria — baixa)_
113. **[Tópicos]** Considerar um filtro por cliente, já que o erro sugere que o sistema precisa de um cliente selecionado para funcionar — esse filtro deveria ser óbvio e provavelmente obrigatório na interface _(melhoria — baixa)_
114. **[Diagnósticos]** Renomear o menu para 'Relatórios' ou 'Relatórios e Consultas'. É simples, direto e comunica o conteúdo. _(correção — critica)_
115. **[Diagnósticos]** Trocar para um ícone de relatório/gráfico ou lista, que comunique melhor a função. _(correção — baixa)_
116. **[Diagnósticos]** Adicionar uma barra de busca dentro do modal para quem lembra o nome do relatório mas não quer procurar entre os 13 botões _(melhoria — baixa)_
117. **[Diagnósticos]** Mostrar os relatórios mais usados no topo com uma marcação visual (ex: estrela ou 'Mais usado') _(melhoria — baixa)_
118. **[Diagnósticos]** Após selecionar um relatório, dar um feedback claro de que ele está sendo gerado (ex: spinner com 'Gerando relatório...') _(melhoria — baixa)_
119. **[Diagnósticos]** Considerar salvar a última opção escolhida para que da próxima vez já apareça pré-selecionada corretamente _(melhoria — baixa)_
120. **[Diagnósticos]** Adicionar data de geração e nome do usuário automaticamente nos relatórios exportados _(melhoria — baixa)_
121. **[WhatsApp]** Simplificar para 'Sair do sistema' ou apenas 'Sair'. _(correção — baixa)_
122. **[WhatsApp]** Adicionar um card ou área mostrando as últimas conversas recentes diretamente no dashboard, sem precisar ir para a aba Conversas — isso agilizaria o trabalho da secretária _(melhoria — baixa)_
123. **[WhatsApp]** Incluir atalhos rápidos para as ações mais comuns do dia a dia: 'Enviar para cliente' com busca por nome do cliente diretamente do dashboard _(melhoria — baixa)_
124. **[WhatsApp]** Mostrar quais conversas estão sem resposta há mais de X horas — essencial para escritório de advocacia onde cliente espera retorno rápido _(melhoria — baixa)_
125. **[WhatsApp]** Considerar adicionar um mini-gráfico semanal nos cards de métricas para visualizar o volume de mensagens ao longo da semana _(melhoria — baixa)_
126. **[WhatsApp]** A logo e nome 'Villa Real e Advogados Associados' no menu lateral está muito pequena — considerar tornar isso mais presente para reforçar identidade do escritório _(melhoria — baixa)_
127. **[Integrações (lab)]** Criar uma interface simplificada 'modo secretária' com apenas um campo de busca 'Digite o número do processo' e um botão 'Buscar', escondendo toda a parte técnica/código para um modo avançado acessível só para administradores ou desenvolvedores. _(correção — critica)_
128. **[Integrações (lab)]** Transformar o retorno da API em uma tabela ou card legível com campos como: Número do processo, Partes envolvidas, Situação, Data de distribuição, Vara/Juízo — da mesma forma que um extrato bancário traduz dados técnicos em informação visível. _(correção — critica)_
129. **[Integrações (lab)]** Corrigir para 'Índice ativo: api_publica_tjgo'. _(correção — baixa)_
130. **[Integrações (lab)]** Criar dois modos de visualização: 'Modo Simples' (para secretárias e advogados) com interface amigável de busca, e 'Modo Desenvolvedor' (para técnicos) com a interface atual _(melhoria — baixa)_
131. **[Integrações (lab)]** Adicionar um tutorial em vídeo ou passo a passo visual de como usar a ferramenta para consultar um processo real _(melhoria — baixa)_
132. **[Integrações (lab)]** Integrar os resultados da busca DataJud diretamente com os processos já cadastrados no sistema do escritório, mostrando se o processo já está na base ou é novo _(melhoria — baixa)_
133. **[Integrações (lab)]** Adicionar um histórico de buscas recentes para não precisar redigitar números de processo toda vez _(melhoria — baixa)_
134. **[Integrações (lab)]** Incluir um botão 'Importar processo para o sistema' junto ao resultado, para que a secretária possa já cadastrar o processo encontrado com um clique _(melhoria — baixa)_
135. **[Usuários]** Renomear para 'Cód. Cadastro' e adicionar um tooltip explicando que é o número do cadastro de pessoas vinculado. _(correção — baixa)_
136. **[Usuários]** Adicionar uma coluna 'Último acesso' na tabela seria muito útil para o administrador identificar usuários inativos de fato (mesmo que marcados como ativos) _(melhoria — baixa)_
137. **[Usuários]** O botão 'Novo usuário' poderia ter um fluxo guiado (wizard) para secretárias iniciantes, explicando passo a passo: 1º vincule a uma pessoa, 2º defina o apelido, 3º configure permissões _(melhoria — baixa)_
138. **[Usuários]** Adicionar ícones de cargo/função ao lado do nome (ex: ícone de advogado, secretária, sócio) ajudaria a identificar visualmente o perfil de cada usuário _(melhoria — baixa)_
139. **[Usuários]** Seria útil poder ordenar as colunas clicando no cabeçalho — não ficou claro se isso é possível _(melhoria — baixa)_
140. **[Usuários]** Um indicador de 'força da senha' ou 'senha nunca alterada' na tabela ajudaria na segurança do escritório _(melhoria — baixa)_
