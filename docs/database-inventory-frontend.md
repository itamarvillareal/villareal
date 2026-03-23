# Inventário do frontend atual (`e-vilareal-react-web`)

## Escopo e método

- **Encontrado no código:** rotas, componentes, uso de API real, mocks e `localStorage`.
- **Inferido:** tipos implícitos e necessidades de persistência por comportamento de tela.
- **Objetivo:** mapear o que o frontend realmente precisa persistir no banco.

## 1) Stack frontend encontrada

### Encontrado no código

- React 19 + Vite 7 + React Router 7 + Tailwind 4
- Código em JavaScript/JSX (sem TypeScript estrito no app)
- Bibliotecas relevantes:
  - `pdfjs-dist`, `tesseract.js` (documentos/OCR)
  - `jspdf`, `jspdf-autotable`, `docx` (relatórios/exportação)
- Flag de mock explícita:
  - `VITE_USE_MOCK_CADASTRO_PESSOAS=true` em `.env.development`

## 2) Páginas/rotas mapeadas

### Encontrado no código (`App.jsx`)

- `/` quadro inicial
- `/clientes/lista`, `/clientes/relatorio`, `/clientes/nova`, `/clientes/editar/:id`
- `/pessoas` (cadastro de clientes)
- `/agenda`
- `/atividade` (auditoria)
- `/processos`
- `/processos/publicacoes`
- `/processos/monitoramento`
- `/imoveis`, `/imoveis/financeiro`, `/imoveis/relatorio-financeiro`
- `/relatorio`, `/relatorio-calculos`, `/calculos`, `/diagnosticos`, `/financeiro`, `/usuarios`, `/configuracoes`

## 3) Módulos que já consomem backend real

### Encontrado no código (imports de `src/api`)

1. **Cadastro de Pessoas**
   - Consome `clientesService.js` (`/api/cadastro-pessoas`)
   - Páginas: `CadastroPessoas`, `RelatorioPessoas`, parte de `MonitoringPeoplePage`

2. **Atividade/Auditoria**
   - Consome `auditoriaService.js` (`/api/auditoria/atividades`)
   - Página: `Atividade`
   - Também há envio fire-and-forget de eventos em `services/auditoriaCliente.js`

3. **Monitoramento de Pessoas**
   - Consome `monitoringService.js` (`/api/monitoring/...`)
   - Página: `MonitoringPeoplePage`

## 4) Módulos ainda baseados em mock/localStorage

### Encontrado no código

1. **Usuários e permissões**
   - `agendaPersistenciaData.js` + `usuarioPermissoesStorage.js`
   - Guarda usuários ativos, login/senha hash local, perfil ativo, permissões por módulo, operador da estação.

2. **Agenda**
   - Eventos e compromissos por data em `vilareal:agenda-eventos:v1`
   - Regras de recorrência e status curto (`OK`/vazio)

3. **Cadastro de Clientes (módulo separado de Pessoas)**
   - `cadastroClientesStorage.js` persiste por código de cliente:
     - pessoa, nome/razão, documento, observação, inativação, lista de processos vinculados.

4. **Processos e histórico**
   - `processosHistoricoData.js` persiste histórico por `codCliente:proc`
   - Campos de fase, datas de consulta, prazo fatal, vínculos de partes e status.

5. **Financeiro**
   - `financeiroData.js` persiste extratos, contas bancárias extras, contas contábeis extras/inativas, configurações de exibição.
   - Forte acoplamento com vínculos `codCliente` + `proc`.

6. **Publicações**
   - `publicacoesStorage.js`: publicações importadas, deduplicação, score, vínculo manual.
   - Integração DataJud no frontend (`datajudApiClient.js`) com cache local.

7. **Documentos de pessoa**
   - `pessoaDocumentoService.js` salva arquivo em **Base64 no localStorage** por pessoa.

8. **Cálculos**
   - `calculosRodadasStorage.js` + `clienteConfigCalculoStorage.js`
   - Rodadas de cálculo, títulos/parcelas, configurações por cliente.

9. **Imóveis e administração de imóveis**
   - `imoveisMockData.js` e componentes associados
   - Dados completos de contrato/contas/utilidades/proprietário/inquilino hoje estão mockados.

## 5) Formulários e campos relevantes por domínio

## Pessoas (`CadastroPessoas`)

### Encontrado no código

- Campos de ficha: `nome`, `cpf`, `rg`, `orgaoExpedidor`, `profissao`, `dataNascimento`, `nacionalidade`, `estadoCivil`, `email`, `contato`, `ativo`, `marcadoMonitoramento`, `responsavelId`.
- Estruturas associadas em UI: endereços, contatos, documento anexado.
- Observação crítica:
  - **Backend atual salva subset** (nome/email/cpf/telefone/dataNascimento/ativo/marcadoMonitoramento/responsavel).
  - Campos civis/documentais adicionais ainda não existem no backend.

## Clientes (`CadastroClientes`)

### Encontrado no código

- Cliente por código (8 dígitos), ligação com pessoa, dados de identificação e lista de processos.
- Persistência 100% local.

## Processos (`Processos`)

### Encontrado no código

- Dados processuais e de partes, natureza da ação, números processuais, prazos, histórico, vínculo com imóveis e conta corrente.
- Sem API dedicada; dependente de mocks + localStorage.

## Publicações (`PublicacoesProcessos`)

### Encontrado no código

- Pipeline de importação de PDF, hash/dedup, status de validação CNJ, score de confiança, vínculo a cliente/processo.
- Persistência local de itens já “confirmados”.

## Financeiro (`Financeiro`)

### Encontrado no código

- Extratos multi-banco, classificação por conta contábil, vínculo a cliente/processo, lógica de compensação/repasses, filtros de período e busca.
- Persistência local extensa (várias versões de chave).

## Imóveis (`Imoveis`, `ImoveisAdministracaoFinanceiro`)

### Encontrado no código

- Cadastro completo de imóvel, proprietário/inquilino, contrato, utilidades, banco/repasse, débitos e checklist documental.
- Hoje dependente de mock.

## Usuários/Agenda/Permissões (`Usuarios`, `Agenda`)

### Encontrado no código

- Usuários ativos, apelido, login, hash de senha local, vínculo com pessoa, permissões por módulo e compromissos da agenda.
- Sem backend de identidade/autorização próprio ainda.

## 6) Chaves de localStorage identificadas (resumo técnico)

### Encontrado no código

- Agenda/usuários: `vilareal:agenda-eventos:v1`, `vilareal:agenda-usuarios:v2`
- Permissões/sessão: `vilareal.usuarios.permissoes.v1`, `vilareal.usuario.sessaoAtiva.v1`
- Pessoas documento: `vilareal.cadastroPessoas.documentos.v1`
- Clientes: `vilareal:cadastro-clientes-dados:v1`
- Processos: `vilareal:processos-historico:v1`
- Publicações: `vilareal.processos.publicacoes.v2`
- Financeiro: `vilareal.financeiro.extratos.v20` e auxiliares
- Cálculos: `vilareal.calculos.rodadas.v1`, `vilareal.cliente.configCalculo.v1`
- Relatórios/presets UI: múltiplas chaves de preferência (baixo valor transacional)

## 7) O que o frontend realmente precisa persistir no backend

### Encontrado + inferido (alta confiança)

- Dados mestres:
  - pessoas, usuários, perfis/permissões, clientes, imóveis
- Dados transacionais:
  - processos, partes, andamentos/histórico, prazos
  - lançamentos financeiros e vínculos com cliente/processo
  - publicações e revisão/vínculo
- Dados documentais:
  - anexos/documentos e seus metadados
- Dados operacionais:
  - agenda de compromissos, auditoria (já existe), monitoramento (já existe)

### Recomendação

- Preferências puramente visuais (layout, colunas, dark mode) podem continuar no `localStorage`.
- Dados de negócio/jurídico-financeiros devem migrar para backend + MySQL.
