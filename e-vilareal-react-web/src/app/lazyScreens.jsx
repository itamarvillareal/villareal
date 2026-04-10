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
export const LazyProcessos = fromNamed(() => import('../components/Processos.jsx'), 'Processos');
export const LazyPublicacoesProcessos = fromNamed(
  () => import('../components/PublicacoesProcessos.jsx'),
  'PublicacoesProcessos'
);
export const LazyMonitoringPeoplePage = fromNamed(
  () => import('../components/monitoring/MonitoringPeoplePage.jsx'),
  'MonitoringPeoplePage'
);
export const LazyImoveis = fromNamed(() => import('../components/Imoveis.jsx'), 'Imoveis');
export const LazyImoveisAdministracaoFinanceiro = fromNamed(
  () => import('../components/ImoveisAdministracaoFinanceiro.jsx'),
  'ImoveisAdministracaoFinanceiro'
);
export const LazyRelatorioFinanceiroImoveis = fromNamed(
  () => import('../components/RelatorioFinanceiroImoveis.jsx'),
  'RelatorioFinanceiroImoveis'
);
export const LazyRelatorioImoveis = fromNamed(() => import('../components/RelatorioImoveis.jsx'), 'RelatorioImoveis');
export const LazyRelatorio = fromNamed(() => import('../components/Relatorio.jsx'), 'Relatorio');
export const LazyRelatorioCalculos = fromNamed(() => import('../components/RelatorioCalculos.jsx'), 'RelatorioCalculos');
export const LazyCalculos = fromNamed(() => import('../components/Calculos.jsx'), 'Calculos');
export const LazyDiagnosticos = fromNamed(() => import('../components/Diagnosticos.jsx'), 'Diagnosticos');
export const LazyFinanceiro = fromNamed(() => import('../components/Financeiro.jsx'), 'Financeiro');
export const LazyUsuarios = fromNamed(() => import('../components/Usuarios.jsx'), 'Usuarios');
export const LazyConfiguracoes = fromNamed(() => import('../components/Configuracoes.jsx'), 'Configuracoes');
export const LazyTopicos = fromNamed(() => import('../components/Topicos.jsx'), 'Topicos');
export const LazyGerenteTopicos = fromNamed(() => import('../components/GerenteTopicos.jsx'), 'GerenteTopicos');
