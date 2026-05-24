/**
 * Telas carregadas sob demanda (code-splitting) para reduzir o JS inicial.
 * Exportam default via wrapper para uso com React.lazy.
 */
import { lazy } from 'react';

const fromNamed = (loader, exportName) =>
  lazy(() => loader().then((m) => ({ default: m[exportName] })));

export const LazyBoard = fromNamed(() => import('../components/Board.jsx'), 'Board');
export const LazyCadastroPessoas = fromNamed(
  () => import('../components/cadastro-pessoas/CadastroPessoas.jsx'),
  'CadastroPessoas'
);
export const LazyRelatorioPessoas = fromNamed(
  () => import('../components/cadastro-pessoas/RelatorioPessoas.jsx'),
  'RelatorioPessoas'
);
export const LazyCadastroClientes = fromNamed(() => import('../components/CadastroClientes.jsx'), 'CadastroClientes');
export const LazyAgenda = fromNamed(() => import('../components/Agenda.jsx'), 'Agenda');
export const LazyAnaLuisa = fromNamed(() => import('../components/AnaLuisa.jsx'), 'AnaLuisa');
export const LazyAtividade = fromNamed(() => import('../components/Atividade.jsx'), 'Atividade');
export const LazyAtividadesEmLote = fromNamed(
  () => import('../components/AtividadesEmLote.jsx'),
  'AtividadesEmLote'
);
export const LazyProcessos = fromNamed(() => import('../components/Processos.jsx'), 'Processos');
export const LazyPublicacoesProcessos = fromNamed(
  () => import('../components/PublicacoesProcessos.jsx'),
  'PublicacoesProcessos'
);
export const LazyPublicacoesEmail = fromNamed(
  () => import('../components/PublicacoesEmail.jsx'),
  'PublicacoesEmail'
);
export const LazyMonitoringPeoplePage = fromNamed(
  () => import('../components/monitoring/MonitoringPeoplePage.jsx'),
  'MonitoringPeoplePage'
);
export const LazyImoveis = fromNamed(() => import('../components/Imoveis.jsx'), 'Imoveis');
export const LazyIptu = fromNamed(() => import('../components/Iptu.jsx'), 'Iptu');
export const LazyIptuDashboard = fromNamed(() => import('../components/IptuDashboard.jsx'), 'IptuDashboard');
export const LazyImoveisAdministracaoFinanceiro = fromNamed(
  () => import('../components/ImoveisAdministracaoFinanceiro.jsx'),
  'ImoveisAdministracaoFinanceiro'
);
export const LazyImoveisSugestoesVinculoGeral = fromNamed(
  () => import('../components/ImoveisSugestoesVinculoGeral.jsx'),
  'ImoveisSugestoesVinculoGeral'
);
export const LazyRelatorioFinanceiroImoveis = fromNamed(
  () => import('../components/RelatorioFinanceiroImoveis.jsx'),
  'RelatorioFinanceiroImoveis'
);
export const LazyRelatorioPagamentos = fromNamed(
  () => import('../components/RelatorioPagamentos.jsx'),
  'RelatorioPagamentos'
);
export const LazyRelatorioImoveis = fromNamed(() => import('../components/RelatorioImoveis.jsx'), 'RelatorioImoveis');
export const LazyRelatorio = fromNamed(() => import('../components/Relatorio.jsx'), 'Relatorio');
export const LazyRelatorioResultadoProcessos = fromNamed(
  () => import('../components/RelatorioResultadoProcessos.jsx'),
  'RelatorioResultadoProcessos',
);
export const LazyRelatorioCalculos = fromNamed(() => import('../components/RelatorioCalculos.jsx'), 'RelatorioCalculos');
export const LazyCalculos = fromNamed(() => import('../components/Calculos.jsx'), 'Calculos');
export const LazyDiagnosticos = fromNamed(() => import('../components/Diagnosticos.jsx'), 'Diagnosticos');
export const LazyFinanceiroLayout = fromNamed(
  () => import('../components/financeiro/FinanceiroLayout.jsx'),
  'FinanceiroLayout',
);
export const LazyFinanceiroDashboard = fromNamed(
  () => import('../components/financeiro/dashboard/DashboardPage.jsx'),
  'DashboardPage',
);
export const LazyFinanceiroExtrato = fromNamed(
  () => import('../components/financeiro/extrato/ExtratoPage.jsx'),
  'ExtratoPage',
);
export const LazyFinanceiroInbox = fromNamed(
  () => import('../components/financeiro/inbox/InboxPage.jsx'),
  'InboxPage',
);
export const LazyFinanceiroConsolidado = fromNamed(
  () => import('../components/financeiro/consolidado/ConsolidadoPage.jsx'),
  'ConsolidadoPage',
);
export const LazyFinanceiroCompensacao = fromNamed(
  () => import('../components/financeiro/compensacao/CompensacaoPage.jsx'),
  'CompensacaoPage',
);
export const LazyFinanceiroFatura = fromNamed(
  () => import('../components/financeiro/fatura/FaturaPage.jsx'),
  'FaturaPage',
);
export const LazyFinanceiroCartao = fromNamed(
  () => import('../components/financeiro/cartao/CartaoPage.jsx'),
  'CartaoPage',
);
export const LazyFinanceiroConfig = fromNamed(
  () => import('../components/financeiro/config/ConfigPage.jsx'),
  'ConfigPage',
);
export const LazyFinanceiro = fromNamed(() => import('../components/Financeiro.jsx'), 'Financeiro');
export const LazyFinanceiroRelatorios = fromNamed(
  () => import('../components/FinanceiroRelatorios.jsx'),
  'FinanceiroRelatorios',
);
export const LazyPagamentos = fromNamed(() => import('../components/Pagamentos.jsx'), 'Pagamentos');
export const LazyImoveisPagamentos = fromNamed(
  () => import('../components/ImoveisPagamentos.jsx'),
  'ImoveisPagamentos',
);
export const LazyConciliacaoBancaria = fromNamed(
  () => import('../components/ConciliacaoBancaria.jsx'),
  'ConciliacaoBancaria',
);
export const LazyAcertoCliente = fromNamed(
  () => import('../components/AcertoCliente.jsx'),
  'AcertoCliente',
);
export const LazyUsuarios = fromNamed(() => import('../components/Usuarios.jsx'), 'Usuarios');
export const LazyConfiguracoes = fromNamed(() => import('../components/Configuracoes.jsx'), 'Configuracoes');
export const LazyTopicos = fromNamed(() => import('../components/Topicos.jsx'), 'Topicos');
export const LazyGerenteTopicos = fromNamed(() => import('../components/GerenteTopicos.jsx'), 'GerenteTopicos');
export const LazyIntegracoesTribunalScraperLab = fromNamed(
  () => import('../components/integracoes/IntegracoesTribunalScraperLab.jsx'),
  'IntegracoesTribunalScraperLab'
);
export const LazyGerarDocumento = fromNamed(
  () => import('../pages/documentos/GerarDocumento.jsx'),
  'GerarDocumento'
);
export const LazyWhatsAppLayout = fromNamed(
  () => import('../components/whatsapp/WhatsAppLayout.jsx'),
  'WhatsAppLayout',
);
export const LazyWhatsAppDashboard = fromNamed(
  () => import('../components/whatsapp/Dashboard.jsx'),
  'WhatsAppDashboard',
);
export const LazyWhatsAppConversas = fromNamed(
  () => import('../components/whatsapp/Conversas.jsx'),
  'WhatsAppConversas',
);
export const LazyWhatsAppEnviarMensagem = fromNamed(
  () => import('../components/whatsapp/EnviarMensagem.jsx'),
  'WhatsAppEnviarMensagem',
);
export const LazyWhatsAppAgendamentos = fromNamed(
  () => import('../components/whatsapp/Agendamentos.jsx'),
  'WhatsAppAgendamentos',
);
