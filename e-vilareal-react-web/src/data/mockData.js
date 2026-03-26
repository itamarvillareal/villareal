/**
 * Navegação e defaults de UI compartilhados (Pendências, Agenda, Cadastro de Clientes).
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
    { id: 'i1', title: '', isEmpty: true },
    { id: 'i2', title: '', isEmpty: true },
    { id: 'i3', title: '', isEmpty: true },
  ],
  thalita: [
    { id: 't1', title: '', isEmpty: true },
    { id: 't2', title: '', isEmpty: true },
    { id: 't3', title: '', isEmpty: true },
  ],
};

/** Valores padrão neutros para novo cliente (sem PDF / demonstração). */
export const clienteMock = {
  proximoCliente: '00000001000',
  codigo: '00000001',
  pessoa: '',
  nomeRazao: '',
  cnpjCpf: '',
  edicaoDesabilitada: false,
  clienteInativo: false,
  observacao: '',
};

export const processosClienteMock = [];

export const controleButtons = [
  { id: 'agenda', label: 'Agenda', icon: 'BookOpen' },
  { id: 'recibos', label: 'Recibos', icon: 'Receipt' },
  { id: 'relatorio', label: 'Relatório', icon: 'FileText' },
  { id: 'configuracoes', label: 'Configurações', icon: 'Settings' },
  { id: 'conta', label: 'Conta', icon: 'User' },
];

/**
 * Colunas da Agenda / Usuários (modo local) — mesmos ids que `columns` do quadro Pendências.
 * Evita divergência (ex.: kari vs karla) que quebrava o vínculo ao renomear o id do usuário.
 */
export const agendaUsuarios = [
  { id: 'itamar', nome: 'ITAMAR' },
  { id: 'karla', nome: 'KARLA' },
  { id: 'isabella', nome: 'ISABELLA' },
  { id: 'thalita', nome: 'THALITA' },
];

export const agendaDataEsquerda = '10/03/2026'; // Terça-feira
export const agendaDataDireita = '11/03/2026'; // Quarta-feira

export const agendaEventosTerça = [];

export const agendaEventosQuarta = [];

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
