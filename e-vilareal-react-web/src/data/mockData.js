/**
 * Defaults de UI locais (quadro Pendências, Agenda) — sem dados de negócio de demonstração.
 * Navegação: {@link ./navConfig.js}.
 */

export const columns = [
  { id: 'itamar', name: 'Coluna 1' },
  { id: 'karla', name: 'Coluna 2' },
  { id: 'isabella', name: 'Coluna 3' },
  { id: 'thalita', name: 'Coluna 4' },
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

export const controleButtons = [
  { id: 'agenda', label: 'Agenda', icon: 'BookOpen' },
  { id: 'recibos', label: 'Recibos', icon: 'Receipt' },
  { id: 'relatorio', label: 'Relatório', icon: 'FileText' },
  { id: 'configuracoes', label: 'Configurações', icon: 'Settings' },
  { id: 'conta', label: 'Conta', icon: 'User' },
];

/**
 * Colunas da Agenda / Usuários (modo local) — mesmos ids que `columns` do quadro Pendências.
 */
export const agendaUsuarios = [
  { id: 'itamar', nome: 'Usuário 1' },
  { id: 'karla', nome: 'Usuário 2' },
  { id: 'isabella', nome: 'Usuário 3' },
  { id: 'thalita', nome: 'Usuário 4' },
];

export const agendaDataEsquerda = '10/03/2026';
export const agendaDataDireita = '11/03/2026';

export const agendaEventosTerça = [];

export const agendaEventosQuarta = [];

/** Eventos fixos por data desativados — use apenas persistência/API de agenda. */
export function getMockEventosAgendaPorData(_dataBr) {
  return [];
}

export const agendaCalendarioMarco2026 = {
  mes: 'março',
  ano: 2026,
  diaSelecionado: 10,
  hoje: 10,
  diasSemana: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
  dias: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
  primeiroDiaSemana: 0,
};

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
