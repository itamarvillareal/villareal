/**
 * Submenu «Processos» — seções, tons de ícone e itens (rotas inalteradas).
 * `children` em navConfig permanece plano para permissões (`usuarioPermissoesStorage`).
 */

/** @typedef {'blue' | 'teal' | 'amber' | 'purple'} ProcessosMenuTone */

/** @type {{ id: string, label: string, tone: ProcessosMenuTone, items: { id: string, label: string, icon: string }[] }[]} */
export const processosMenuSections = [
  {
    id: 'documentos',
    label: 'Documentos',
    tone: 'blue',
    items: [
      { id: 'documentos/gerar', label: 'Gerar documento', icon: 'FileText' },
      { id: 'documentos/modelos', label: 'Modelos de petição', icon: 'Layers' },
      { id: 'processos/peticionamento-projudi', label: 'Peticionamento PROJUDI', icon: 'Gavel' },
    ],
  },
  {
    id: 'publicacoes',
    label: 'Publicações e movimentações',
    tone: 'teal',
    items: [
      { id: 'processos/publicacoes', label: 'Publicações', icon: 'Megaphone' },
      { id: 'publicacoes-email', label: 'Publicações por e-mail', icon: 'Mail' },
      { id: 'processos/manifestacoes-projudi', label: 'Movimentações por e-mail', icon: 'Forward' },
      { id: 'processos/consultas-periodicas', label: 'Consultas periódicas', icon: 'CalendarClock' },
    ],
  },
  {
    id: 'monitoramento',
    label: 'Monitoramento',
    tone: 'amber',
    items: [
      { id: 'processos/monitoramento', label: 'Monitoramento de pessoas', icon: 'UserSearch' },
    ],
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    tone: 'purple',
    items: [
      { id: 'relatorio', label: 'Relatório de processos', icon: 'BarChart3' },
    ],
  },
];

export const processosMenuPrimary = { id: 'processos', label: 'Processos', icon: 'Folder', tone: 'blue' };

/** Itens planos do grupo (permissões + fallback). */
export const processosMenuChildrenFlat = [
  processosMenuPrimary,
  ...processosMenuSections.flatMap((section) => section.items),
];
