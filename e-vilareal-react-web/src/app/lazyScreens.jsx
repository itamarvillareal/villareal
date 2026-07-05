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
export const LazyJuliaCaixa = fromNamed(() => import('../components/JuliaCaixa.jsx'), 'JuliaCaixa');
export const LazyAnaLuisa = fromNamed(() => import('../components/AnaLuisa.jsx'), 'AnaLuisa');
export const LazyAtividade = fromNamed(() => import('../components/Atividade.jsx'), 'Atividade');
export const LazyPatrimonio = fromNamed(() => import('../components/Patrimonio.jsx'), 'Patrimonio');
export const LazyAtividadesEmLote = fromNamed(
  () => import('../components/AtividadesEmLote.jsx'),
  'AtividadesEmLote'
);
export { LazyProcessos } from './lazyProcessos.jsx';
export const LazyPublicacoesProcessos = fromNamed(
  () => import('../components/PublicacoesProcessos.jsx'),
  'PublicacoesProcessos'
);
export const LazyConsultasPeriodicas = fromNamed(
  () => import('../components/consultas-periodicas/ConsultasPeriodicasPainel.jsx'),
  'ConsultasPeriodicasPainel'
);
export const LazyPublicacoesEmail = fromNamed(
  () => import('../components/PublicacoesEmail.jsx'),
  'PublicacoesEmail'
);
export const LazyManifestacoesProjudi = fromNamed(
  () => import('../components/ManifestacoesProjudi.jsx'),
  'ManifestacoesProjudi'
);
export const LazyPeticionamentoProjudi = fromNamed(
  () => import('../components/projudi/PeticionamentoProjudi.jsx'),
  'PeticionamentoProjudi'
);
export const LazyDistribuicaoInicialProjudi = fromNamed(
  () => import('../components/projudi/DistribuicaoInicialProjudi.jsx'),
  'DistribuicaoInicialProjudi'
);
export const LazyMonitoringPeoplePage = fromNamed(
  () => import('../components/monitoring/MonitoringPeoplePage.jsx'),
  'MonitoringPeoplePage'
);
export const LazyImoveis = fromNamed(() => import('../components/Imoveis.jsx'), 'Imoveis');
export const LazyDemandas = fromNamed(() => import('../components/Demandas.jsx'), 'Demandas');
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
export const LazyRecebiveisConsolidados = lazy(() => import('../components/RecebiveisConsolidados.jsx'));
export const LazyQuadroRecebiveis = fromNamed(() => import('../components/QuadroRecebiveis.jsx'), 'QuadroRecebiveis');
export const LazyAcoesDoDia = fromNamed(() => import('../components/AcoesDoDia.jsx'), 'AcoesDoDia');
export const LazyRelatorioCalculos = fromNamed(() => import('../components/RelatorioCalculos.jsx'), 'RelatorioCalculos');
export const LazyCalculos = fromNamed(() => import('../components/Calculos.jsx'), 'Calculos');
export const LazyDiagnosticos = fromNamed(() => import('../components/Diagnosticos.jsx'), 'Diagnosticos');
export const LazyRelatorioTarefas = fromNamed(() => import('../components/RelatorioTarefas.jsx'), 'RelatorioTarefas');
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
export const LazyFinanceiroTotal = fromNamed(
  () => import('../components/financeiro/total/TotalPage.jsx'),
  'TotalPage',
);
export const LazyFinanceiroAnalises = fromNamed(
  () => import('../components/financeiro/analises/AnalisesPage.jsx'),
  'AnalisesPage',
);
export const LazyFinanceiroInvestimentos = fromNamed(
  () => import('../components/financeiro/investimentos/InvestimentosPage.jsx'),
  'InvestimentosPage',
);
export const LazyFinanceiroCompensacao = fromNamed(
  () => import('../components/financeiro/compensacao/CompensacaoPage.jsx'),
  'CompensacaoPage',
);
export const LazyFinanceiroFatura = fromNamed(
  () => import('../components/financeiro/fatura/FaturaPage.jsx'),
  'FaturaPage',
);
export const LazyFinanceiroFaturaFechamentos = fromNamed(
  () => import('../components/financeiro/fatura/FechamentoFaturaExtratoPage.jsx'),
  'FechamentoFaturaExtratoPage',
);
export const LazyFinanceiroCartoesHub = fromNamed(
  () => import('../components/financeiro/cartao/CartoesHubPage.jsx'),
  'CartoesHubPage',
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
export const LazyDescontoCheques = fromNamed(
  () => import('../components/DescontoCheques.jsx'),
  'DescontoCheques',
);
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
export const LazyTribunaisCatalogoAdmin = fromNamed(
  () => import('../components/integracoes/TribunaisCatalogoAdmin.jsx'),
  'TribunaisCatalogoAdmin'
);
export const LazyGerarDocumento = fromNamed(
  () => import('../pages/documentos/GerarDocumento.jsx'),
  'GerarDocumento'
);
export const LazyModelosPeticao = fromNamed(
  () => import('../pages/documentos/ModelosPeticao.jsx'),
  'ModelosPeticao'
);
export const LazyProcessoRecebiveis = fromNamed(
  () => import('../pages/processos/ProcessoRecebiveis.jsx'),
  'ProcessoRecebiveis'
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
export const LazyWhatsAppTemplates = fromNamed(
  () => import('../components/whatsapp/Templates.jsx'),
  'WhatsAppTemplates',
);
export const LazyWhatsAppAniversarios = fromNamed(
  () => import('../components/whatsapp/Aniversarios.jsx'),
  'WhatsAppAniversarios',
);
export const LazyWhatsAppCobrancas = fromNamed(
  () => import('../components/whatsapp/Cobrancas.jsx'),
  'WhatsAppCobrancas',
);
export const LazyPoliticaPrivacidade = fromNamed(
  () => import('../pages/PoliticaPrivacidade.jsx'),
  'PoliticaPrivacidade',
);
