/**
 * Itens do menu lateral e mapeamento para permissões (`usuarioPermissoesStorage`).
 * Não são dados de negócio — só estrutura de navegação.
 */

export const navItems = [
  {
    id: 'admin-imoveis-grupo',
    label: 'Administração de Imóveis',
    icon: 'Landmark',
    children: [
      { id: 'imoveis', label: 'Imóveis', icon: 'Building2' },
      { id: 'imoveis/demandas', label: 'Demandas', icon: 'LayoutGrid' },
      { id: 'imoveis/pagamentos', label: 'Pagamentos', icon: 'Wallet' },
      { id: 'imoveis/pagamentos/conciliacao', label: 'Conciliação bancária', icon: 'Link2' },
      { id: 'imoveis/acerto-cliente', label: 'Acerto com Cliente', icon: 'FileCheck' },
      { id: 'imoveis/relatorio-pagamentos', label: 'Relatório Pagamentos', icon: 'BarChart3' },
      { id: 'imoveis/sugestoes-vinculo', label: 'Sugestões de vínculo', icon: 'Sparkles' },
      { id: 'iptu', label: 'IPTU', icon: 'Receipt' },
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
      { id: 'documentos/gerar', label: 'Gerar Documento', icon: 'FileText' },
      { id: 'processos/publicacoes', label: 'Publicações', icon: 'Newspaper' },
      { id: 'processos/consultas-periodicas', label: 'Consultas periódicas', icon: 'CalendarClock' },
      { id: 'publicacoes-email', label: 'Publicações Email', icon: 'Mail' },
      { id: 'processos/manifestacoes-projudi', label: 'Movimentações Email', icon: 'Gavel' },
      { id: 'processos/peticionamento-projudi', label: 'Peticionamento PROJUDI', icon: 'FileSignature' },
      { id: 'processos/monitoramento', label: 'Monitoramento de Pessoas', icon: 'Radar' },
      { id: 'relatorio', label: 'Relatório de Processos', icon: 'FileSpreadsheet' },
      { id: 'relatorio-resultado-processos', label: 'Resultado financeiro (proc.)', icon: 'CircleDollarSign' },
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
  { id: 'julia/caixa', label: 'Caixa da Júlia', icon: 'Sparkles', badgeIa: true },
  { id: 'patrimonio', label: 'Patrimônio', icon: 'Wallet' },
  { id: 'atividade', label: 'Atividade', icon: 'ClipboardList' },
  { id: 'atividades-em-lote', label: 'Atividades em Lote', icon: 'Layers' },
  {
    id: 'financeiro-grupo',
    label: 'Financeiro',
    icon: 'CircleDollarSign',
    children: [
      { id: 'financeiro', label: 'Extratos', icon: 'CircleDollarSign' },
      { id: 'financeiro/relatorios', label: 'Relatórios', icon: 'FileBarChart' },
    ],
  },
  { id: 'pagamentos', label: 'Pagamentos', icon: 'Wallet' },
  { id: 'descontos-cheque', label: 'Desconto de Cheques', icon: 'Banknote' },
  { id: 'pendencias', label: 'Pendências', icon: 'AlertTriangle' },
  {
    id: 'topicos-grupo',
    label: 'Tópicos',
    icon: 'Layers',
    children: [
      { id: 'topicos', label: 'Catálogo', icon: 'Layers' },
      { id: 'topicos/gerente', label: 'Gerente de Tópicos', icon: 'LayoutDashboard' },
    ],
  },
  { id: 'relatorio-tarefas', label: 'Relatório de Tarefas', icon: 'Server' },
  { id: 'diagnosticos', label: 'Relatórios e Consultas', icon: 'Activity' },
  {
    id: 'whatsapp-grupo',
    label: 'WhatsApp',
    icon: 'MessageCircle',
    children: [
      { id: 'whatsapp/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
      { id: 'whatsapp/conversas', label: 'Conversas', icon: 'MessageCircle' },
      { id: 'whatsapp/enviar', label: 'Enviar mensagem', icon: 'Send' },
      { id: 'whatsapp/agendamentos', label: 'Agendamentos', icon: 'CalendarClock' },
    ],
  },
  {
    id: 'integracoes-grupo',
    label: 'Integrações',
    icon: 'Plug',
    children: [{ id: 'integracoes/scraper-lab', label: 'Consulta DataJud', icon: 'Link' }],
  },
  { id: 'usuarios', label: 'Usuários', icon: 'UserCog' },
  { id: 'configuracoes', label: 'Configurações', icon: 'Settings' },
];
