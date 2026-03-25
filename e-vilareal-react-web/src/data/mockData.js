/**
 * Dados mockados para o projeto jurídico VILA real
 */

export const navItems = [
  {
    id: 'admin-imoveis-grupo',
    label: 'Administração de Imóveis',
    icon: 'Landmark',
    children: [
      { id: 'imoveis', label: 'Imóveis', icon: 'Building2' },
      { id: 'imoveis/relatorio-financeiro', label: 'Relatório Financeiro Imóveis', icon: 'CircleDollarSign' },
      { id: 'relatorio-imoveis', label: 'Relatório Imóveis', icon: 'FileSpreadsheet' },
    ],
  },
  {
    id: 'pessoas-grupo',
    label: 'Pessoas',
    icon: 'Users',
    children: [
      { id: 'clientes/lista', label: 'Todas as pessoas', icon: 'List' },
      { id: 'clientes/relatorio', label: 'Relatório de pessoas', icon: 'FileSpreadsheet' },
      { id: 'clientes/nova', label: 'Nova pessoa', icon: 'UserPlus' },
    ],
  },
  { id: 'pessoas', label: 'Clientes', icon: 'UserCircle' },
  {
    id: 'processos-grupo',
    label: 'Processos',
    icon: 'Folder',
    children: [
      { id: 'processos', label: 'Processos', icon: 'Folder' },
      { id: 'processos/publicacoes', label: 'Publicações', icon: 'Newspaper' },
      { id: 'processos/monitoramento', label: 'Monitoramento de Pessoas', icon: 'Radar' },
      { id: 'relatorio', label: 'Relatório de Processos', icon: 'FileSpreadsheet' },
    ],
  },
  {
    id: 'calcular-grupo',
    label: 'Calcular',
    icon: 'Calculator',
    children: [
      { id: 'calculos', label: 'Cálculos', icon: 'Calculator' },
      { id: 'relatorio-calculos', label: 'Relatório de Cálculos', icon: 'Table2' },
    ],
  },
  { id: 'agenda', label: 'Agenda', icon: 'Calendar' },
  { id: 'ana-luisa', label: 'ANA LUISA', icon: 'User' },
  { id: 'atividade', label: 'Atividade', icon: 'ClipboardList' },
  { id: 'financeiro', label: 'Financeiro', icon: 'CircleDollarSign' },
  { id: 'pendencias', label: 'Pendências', icon: 'AlertTriangle' },
  {
    id: 'topicos-grupo',
    label: 'Tópicos',
    icon: 'Layers',
    children: [
      { id: 'topicos', label: 'Tópicos', icon: 'Layers' },
      { id: 'topicos/gerente', label: 'Gerente de Tópicos', icon: 'LayoutDashboard' },
    ],
  },
  { id: 'diagnosticos', label: 'Diagnósticos', icon: 'Activity' },
  { id: 'usuarios', label: 'Usuários', icon: 'UserCog' },
  { id: 'configuracoes', label: 'Configurações', icon: 'Settings' },
];

export const columns = [
  { id: 'itamar', name: 'Dr. Itamar' },
  { id: 'karla', name: 'Karla' },
  { id: 'isabella', name: 'ISABELLA' },
  { id: 'thalita', name: 'Thalita' },
];

export const tasksByColumn = {
  itamar: [
    { id: 'itamar-1', title: '', isEmpty: true },
    { id: 'itamar-2', title: '', isEmpty: true },
  ],
  karla: [
    { id: 'k1', title: '', isEmpty: true, selected: true },
    { id: 'k2', title: '', isEmpty: true },
    { id: 'k3', title: '', isEmpty: true },
  ],
  isabella: [
    { id: 'i1', title: 'Atualizar proprietarios farol do lago (Dalmo)', isEmpty: false },
    { id: 'i2', title: "IPTU'S", isEmpty: false },
    { id: 'i3', title: 'Conferir acordos ASFAROL', isEmpty: false },
  ],
  thalita: [
    { id: 't1', title: '', isEmpty: true },
    { id: 't2', title: '', isEmpty: true },
    { id: 't3', title: '', isEmpty: true },
  ],
};

/** Dados mockados: PDF clientes_cadastrados (cod. cliente 1 → pessoa 64) */
export const clienteMock = {
  proximoCliente: '00000001000',
  codigo: '00000001',
  pessoa: '64',
  nomeRazao: 'ALEXANDRA GONTIJO DE SOUZA',
  cnpjCpf: '001.298.131-17',
  edicaoDesabilitada: true,
  clienteInativo: false,
  observacao: '',
};

/** Índice = nº do processo (1–10) no cliente; descrições alinhadas ao mock 10×10 (getMockProcesso10x10). */
export const processosClienteMock = [
  { id: 1, processoVelho: '-', processoNovo: '5561596-17.2025.8.09.0137', parteOposta: 'FLAVIA GOMES SANTOS', descricao: 'AÇÃO DE INDENIZAÇÃO POR DANOS' },
  { id: 2, processoVelho: '-', processoNovo: '5602801-26.2025.8.09.0137', parteOposta: 'JAILIS PEREIRA DOURADO', descricao: 'AÇÃO DECLARATÓRIA DE NULIDADE' },
  { id: 3, processoVelho: '-', processoNovo: '5612345-12.2025.8.09.0137', parteOposta: 'CONDOMINIO PORTAL DOS YPES 3 - CASAS FLA', descricao: 'PEDIDO DE DANO MORAL POR CONS' },
  { id: 4, processoVelho: '-', processoNovo: '5623456-33.2025.8.09.0137', parteOposta: 'MARIA SILVA COSTA', descricao: 'AÇÃO DE COBRANÇA' },
  { id: 5, processoVelho: '-', processoNovo: '5634567-45.2025.8.09.0137', parteOposta: 'JOSÉ OLIVEIRA LIMA', descricao: 'AÇÃO DE DESPEJO' },
  { id: 6, processoVelho: '-', processoNovo: '5645678-56.2025.8.09.0137', parteOposta: 'ANA PAULA FERREIRA', descricao: 'AÇÃO DE INDENIZAÇÃO' },
  { id: 7, processoVelho: '-', processoNovo: '5656789-67.2025.8.09.0137', parteOposta: 'CARLOS EDUARDO SOUZA', descricao: 'AÇÃO DE USUCAPIÃO' },
  { id: 8, processoVelho: '-', processoNovo: '5667890-78.2025.8.09.0137', parteOposta: 'FERNANDA LOPES SANTOS', descricao: 'AÇÃO DE DIVÓRCIO' },
  { id: 9, processoVelho: '-', processoNovo: '5678901-89.2025.8.09.0137', parteOposta: 'ROBERTO ALVES PEREIRA', descricao: 'AÇÃO TRABALHISTA' },
  { id: 10, processoVelho: '-', processoNovo: '5689012-90.2025.8.09.0137', parteOposta: 'PATRICIA MENDES COSTA', descricao: 'AÇÃO DE ALIMENTOS' },
];

export const controleButtons = [
  { id: 'agenda', label: 'Agenda', icon: 'BookOpen' },
  { id: 'recibos', label: 'Recibos', icon: 'Receipt' },
  { id: 'relatorio', label: 'Relatório', icon: 'FileText' },
  { id: 'configuracoes', label: 'Configurações', icon: 'Settings' },
  { id: 'conta', label: 'Conta', icon: 'User' },
];

/** Dados mockados para Agenda */
export const agendaUsuarios = [
  { id: 'itamar', nome: 'ITAMAR' },
  { id: 'kari', nome: 'KARLA' },
  { id: 'isabelia', nome: 'ISABELLA' },
  { id: 'ana', nome: 'ANA LUISA' },
];

export const agendaDataEsquerda = '10/03/2026'; // Terça-feira
export const agendaDataDireita = '11/03/2026';  // Quarta-feira

export const agendaEventosTerça = [
  { id: 1, hora: '09:00', descricao: 'CONCILIAÇÃO (MEGA ELITE VIGILANCIA E SEGURANÇA ESPECIALI', destaque: true },
  { id: 2, hora: '09:45', descricao: 'CONCILIAÇÃO (SSMA SEGURANÇA SAÚDE E MEIO AMBIENTE LTDA', destaque: true },
  { id: 3, hora: '13:30', descricao: 'CONCILIAÇÃO (PRISCILLA SILVA SIQUEIRA x MINISTÉRIO PÚBLIC', destaque: true },
  { id: 4, hora: '13:30', descricao: 'SESSÃO DE JULGAMENTO (MARÍLIA GABRIELA DE OLIVEIRA DINIZ', destaque: false },
  {
    id: 5,
    hora: '14:00',
    descricao:
      'Teste duplo clique → abre Processos: CNJ 5600077-15.2025.8.09.1011 (base mock cliente 1 / proc. 4)',
    destaque: false,
  },
  {
    id: 6,
    hora: '',
    descricao:
      'Consultar ITAMAR JUNIOR x KELLY SILVA — use a linha acima para testar número de processo na base',
    destaque: false,
  },
  { id: 7, hora: '', descricao: 'falar com a louyse sobre os boletos do condominio em aberto', destaque: false },
  { id: 8, hora: '', descricao: 'REPASSAR ALUGUEL THAMIRES - BAIRRO DE LOURDES', destaque: false },
  { id: 9, hora: '', descricao: 'Vence conta de energia F-18', destaque: false },
  { id: 10, hora: '', descricao: 'ver se pagou ultima e manifestar ASFAROL LAGO x DIVINA CUSTOD', destaque: false },
  { id: 11, hora: '', descricao: 'VRV LTDA x ISABELLA FAGUNDES (RENOVAR ALUGUEL)', destaque: false },
];

export const agendaEventosQuarta = [
  { id: 12, hora: '09:00', descricao: 'SESSÃO DE JULGAMENTO (SE77E TELECOM EIRELI ME x YNAYRA M', destaque: false },
  { id: 13, hora: '09:30', descricao: '1 da pauta SESSÃO DE JULGAMENTO (MARCELO SOARES DE ALMEII', destaque: false },
  { id: 14, hora: '', descricao: 'Conferir pagamentos ALUGUEIS no CORA', destaque: false },
  { id: 15, hora: '', descricao: 'consultar SAUDE LTDA x (14185.035617/2024-15) + proc 11', destaque: false },
];

/** Eventos mock do dia (para relatório mensal e mesma regra de merge da tela). */
export function getMockEventosAgendaPorData(dataBr) {
  const s = String(dataBr ?? '').trim();
  if (s === agendaDataEsquerda) return [...agendaEventosTerça];
  if (s === agendaDataDireita) return [...agendaEventosQuarta];
  return [];
}

/** Calendário março 2026 - primeiro dia é domingo */
export const agendaCalendarioMarco2026 = {
  mes: 'março',
  ano: 2026,
  diaSelecionado: 10,
  hoje: 10,
  diasSemana: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
  dias: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
  primeiroDiaSemana: 0, // 0 = domingo
};

// Preencher colunas vazias com cards vazios para layout
export function getBoardData() {
  const maxCards = 4;
  return columns.map((col) => {
    const tasks = tasksByColumn[col.id] || [];
    const filled = [...tasks];
    while (filled.length < maxCards) {
      filled.push({
        id: `${col.id}-empty-${filled.length}`,
        title: '',
        isEmpty: true,
        selected: false,
      });
    }
    return { ...col, tasks: filled };
  });
}
