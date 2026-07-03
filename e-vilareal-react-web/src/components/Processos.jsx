import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { OrgaoJulgadorAutocomplete } from './ui/OrgaoJulgadorAutocomplete.jsx';
import { MunicipioAutocomplete } from './ui/MunicipioAutocomplete.jsx';
import { CampoDataBr } from './ui/CampoDataBr.jsx';
import {
  getLancamentosContaCorrente,
  getTransacoesContaCorrenteCompleto,
  mapLinhasFinanceiroParaContaCorrenteModal,
  mergeContaCorrenteComLinhaOrigem,
} from '../data/financeiroData';
import {
  PAPEL_DESPESA,
  PAPEL_ENTRADA,
  PAPEL_OUTRO,
  PAPEL_PAGAMENTO,
  aplicarNumeroVinculoDescricao,
  aplicarTagPapelDescricao,
  atribuirNumeroVinculoLancamentos,
  gravarPapelManualProcesso,
  montarPainelResultadoContaCorrenteProcesso,
  normalizarNumeroVinculo,
  proximoNumeroVinculoProcesso,
  rotuloPapelContaCorrenteProcesso,
} from '../data/contaCorrenteProcessoResultado.js';
import {
  carregarResumoContaCorrenteProcesso,
  desvincularLancamentoClienteProcesso,
  listarLancamentosProcessoApiFirst,
  salvarOuAtualizarLancamentoFinanceiroApi,
} from '../repositories/financeiroRepository.js';
import {
  classificarAlvaraHonorarioApi,
  listarRepassesPendentesHonorarioApi,
  vincularRepasseHonorarioApi,
} from '../repositories/honorariosRepository.js';
import { EVENT_FINANCEIRO_PERSISTENCIA_EXTERNA } from '../services/crossTabLocalStorageSync.js';
import {
  UFS,
  FASES,
  canonicalizarFaseParaOpcoesRadiosProcessos,
  classeShellFormularioProcessoPorFase,
  COMPETENCIAS,
  TIPOS_AUDIENCIA,
  TRAMITACAO_OPCOES,
  gerarMockProcesso,
  normalizarCliente,
  normalizarProcesso,
  normalizarTipoAudienciaCanonico,
  padCliente,
} from '../data/processosDadosRelatorio';
import {
  obterPessoaParaVinculoUsuario,
  pesquisarPessoasParaVinculoUsuario,
} from '../services/pessoaVinculoUsuarioService.js';
import { loadCadastroClienteDados } from '../data/cadastroClientesStorage.js';
import {
  getHistoricoDoProcesso,
  getRegistroProcesso,
  normalizarDataBr,
  salvarHistoricoDoProcesso,
  salvarPrazoFatalDoProcesso,
  seedHistoricoDoProcesso,
} from '../data/processosHistoricoData';
import { parteApiEhLadoCliente } from '../data/partesLadoEscritorio.js';
import { resolverAliasHojeEmTexto } from '../services/hjDateAliasService.js';
import {
  agendarAudienciaParaTodosUsuarios,
  agendarEmLoteParaUsuarios,
  calcularPrimeiraOcorrenciaAgendaLote,
  getUsuariosAtivos,
  getColaboradoresHumanosAtivos,
  removerAudienciaProcessoDaAgenda,
} from '../data/agendaPersistenciaData';
import {
  replicarAudienciaProcessoTodosColaboradoresApi,
  replicarCompromissoLoteTodosColaboradoresApi,
  removerAudienciaProcessoAgendaApi,
} from '../repositories/agendaRepository.js';
import { getApiUsuarioSessao, getPerfilAtivoParaPermissoes } from '../data/usuarioPermissoesStorage.js';
import { getNomeExibicaoUsuario } from '../data/usuarioDisplayHelpers.js';
import { listarColaboradoresHumanos } from '../repositories/usuariosRepository.js';
import { SidebarMenuIcon } from './navigation/SidebarMenuIcons.jsx';
import {
  X,
  FolderOpen,
  Calendar,
  ChevronLeft,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,
  UserPlus,
  Newspaper,
  ListTodo,
  Hand,
  PenLine,
  AlertCircle,
  Users,
  Undo2,
  Copy,
  AlertTriangle,
  CircleDollarSign,
  GitBranch,
  Scale,
  Link2,
  Building2,
  Clock,
  Trash2,
  FileText,
  FileSignature,
  Download,
  CloudDownload,
  CalendarClock,
  Send,
  Receipt,
  MessageCircle,
} from 'lucide-react';
import { ContaCorrenteVinculoAssist } from './processos/ContaCorrenteVinculoAssist.jsx';
import {
  ProcessosAccordionSection,
  ProcessosStickyHeader,
  ProcessosSummaryCards,
  ProcessosTabButton,
  ProcessosToast,
  useProcessosBannerExpandido,
  diasAteDataBr,
  formatValorCausaExibicao,
  processosBtnGhost,
  processosBtnIndigo,
  processosBtnOutlineIndigo,
  processosBtnPrimary,
  processosBtnSecondary,
  processosBtnToolbarAmber,
  processosBtnToolbarCyan,
  processosBtnToolbarGreen,
  processosBtnToolbarIndigo,
  processosBtnToolbarOrange,
  processosBtnToolbarPurple,
  processosBtnToolbarRed,
  processosBtnToolbarRedacao,
  processosBtnToolbarPrimary,
  processosBtnToolbarRose,
  processosBtnToolbarSky,
  processosBtnToolbarTeal,
  processosInputClass,
  processosInputDenseClass,
  processosInputDenseReadOnlyClass,
  processosInputReadOnlyClass,
  processosLinkClass,
} from './processos/ProcessosAdminLayout.jsx';
import { ModalRelatorioPublicacoesProcesso, PublicacoesRelatorioConteudo } from './ModalRelatorioPublicacoesProcesso.jsx';
import { listarPublicacoesRelatorioPorProcesso, listarMovimentacoesEmailPorProcesso } from '../repositories/publicacoesRepository.js';
import { ModalCriarTarefaContextual } from './ModalCriarTarefaContextual.jsx';
import { ModalConsultaPeriodicaProcesso } from './consultas-periodicas/ModalConsultaPeriodicaProcesso.jsx';
import { ProcessoWhatsAppContatosSecao } from './whatsapp/ProcessoWhatsAppContatosSecao.jsx';
import { ProcessoRemuneracaoSecao } from './processos/ProcessoRemuneracaoSecao.jsx';
import { ModalPeticionamentoProcesso } from './projudi/ModalPeticionamentoProcesso.jsx';
import { PessoaEmbedModal } from './PessoaEmbedModal.jsx';
import { useCloseOnEscape } from '../hooks/useCloseOnEscape.js';
import { AutorUsuarioExibicao } from './ui/AutorUsuarioExibicao.jsx';
import { buildContextFromProcesso, buildContextFromProcessoComPrazoFatal } from '../data/tarefasContextualPayload.js';
import { montarDadosParaDocumentoFromProcesso } from '../helpers/documentoHelper.js';
import { montarDadosDistribuicaoInicialFromProcesso } from '../helpers/distribuicaoInicialProjudiHelper.js';
import {
  downloadPdfBlob,
  gerarProcuracao,
  nomeArquivoProcuracaoPdf,
} from '../repositories/documentosRepository.js';
import { obterStatusDrive } from '../repositories/driveRepository.js';
import { featureFlags } from '../config/featureFlags.js';
import { obterClienteCadastroPorCodigo } from '../repositories/clientesRepository.js';
import { CampoNumeroComContador } from './ui/CampoNumeroComContador.jsx';
import {
  buscarClientePorCodigo,
  formatarUsuarioHistoricoExibicao,
  usuarioHistoricoParaExibicao,
  usuarioHistoricoAutorMeta,
  buscarProcessoPorChaveNatural,
  buscarProcessoPorId,
  resolverProcessoId,
  mapApiProcessoToUiShape,
  salvarCabecalhoProcesso,
  listarPartesProcesso,
  sincronizarPartesIncremental,
  listarAndamentosProcesso,
  sincronizarAndamentosIncremental,
  mapApiAndamentoToHistoricoItem,
  entradaHistoricoPertenceAoUsuarioAtivo,
  upsertPrazoFatalProcesso,
  alterarAtivoProcesso,
  baixarAutosIntegralProcesso,
  obterMovimentacoesDrive,
  consultarStatusPjeCopiaIntegral,
} from '../repositories/processosRepository.js';
import {
  buscarNumeroImovelPorVinculo,
  carregarImovelCadastroPorNumeroPlanilha,
  vincularProcessoAoNumeroImovel,
} from '../repositories/imoveisRepository.js';
import { ModalBuscaImovel } from './imoveis/ModalBuscaImovel.jsx';
import {
  buildRouterStateChaveClienteProcesso,
  extrairIntentNavegacaoProcessos,
  gravarUltimaSelecaoProcessosArmazenamento,
  lerUltimaSelecaoProcessosArmazenamento,
  resolverIntentNavegacaoProcessosDeRota,
  resolverSelecaoInicialProcessos,
} from '../domain/camposProcessoCliente.js';
import { cnjEhTrt18 } from '../domain/cnjFuzzyBusca.js';
import {
  PJE_GRAU_OPCOES,
  PJE_TRIBUNAL_OPCOES,
  detectarPjeTribunalPorCnj,
  rotuloPjeTribunal,
  tribunalPjeAutomacaoDisponivel,
} from '../domain/pjeTribunalCnj.js';

/** Linhas por página na aba Histórico — preenche melhor a área útil sem depender de linhas vazias. */
const HISTORICO_POR_PAGINA = 24;

const CadastroClientesLazy = lazy(() =>
  import('./CadastroClientes.jsx').then((module) => ({ default: module.CadastroClientes }))
);

const DriveExplorerLazy = lazy(() => import('./DriveExplorer.jsx'));

const AgendaModal = lazy(() => import('./Agenda.jsx').then((m) => ({ default: m.Agenda })));

/** Dois primeiros blocos do nº novo (CNJ): segmento antes do 1.º ponto — ex. `NNNNNNN-DD.aaaa…` → `NNNNNNN-DD`. */
function doisPrimeirosBlocosNumeroProcessoNovoParaCopia(valor) {
  const s = String(valor ?? '').trim();
  if (!s) return '';
  const i = s.indexOf('.');
  return i === -1 ? s : s.slice(0, i);
}

/** Legenda do botão «copiar prefixo»: exemplo com o nº novo atual (quando houver). */
function tituloCopiarPrefixoNumeroProcessoNovo(numeroProcessoNovo) {
  const s = String(numeroProcessoNovo ?? '').trim();
  const trecho = doisPrimeirosBlocosNumeroProcessoNovoParaCopia(numeroProcessoNovo);
  if (!trecho) return 'Copiar só o trecho até o 1.º ponto';
  if (trecho === s) {
    return `Copiar só o trecho até o 1.º ponto (sem ponto no número: copia o valor inteiro — ${s})`;
  }
  return `Copiar só o trecho até o 1.º ponto (ex.: ${trecho} a partir de ${s})`;
}

/**
 * Nome / Razão Social do módulo Clientes (localStorage), alinhado a CadastroClientes.
 * Sem nome no cadastro local: vazio (API ou «—» em outros fluxos preenchem quando aplicável).
 */
function resolverNomeRazaoClienteMockPath(codigoCliente) {
  const cad = loadCadastroClienteDados(codigoCliente);
  return String(cad?.nomeRazao ?? '').trim();
}

/** Tipos de ação de redação vinculados ao processo atual (modal «mão escrevendo»). */
const ACOES_REDACAO_PROCESSO = [
  { id: 'montar', label: 'Montar' },
  { id: 'geral', label: 'Geral' },
  { id: 'peticao_inicial', label: 'Petição inicial' },
  { id: 'procuracao', label: 'Procuração' },
  { id: 'informar_endereco', label: 'Informar endereço' },
  { id: 'alvara', label: 'Alvará' },
  { id: 'informar_numero_conta_judicial', label: 'Informar número de conta judicial' },
  { id: 'desistencia_requerida', label: 'Desistência requerida' },
  { id: 'juntada_procuracao', label: 'Juntada de procuração' },
  { id: 'substabelecimento', label: 'Substabelecimento' },
  { id: 'contestacao', label: 'Contestação' },
  { id: 'impugnacao', label: 'Impugnação' },
  { id: 'emenda_inicial', label: 'Emenda à inicial' },
  { id: 'execucao', label: 'Execução' },
];

function storageKeyAcaoRedacaoProcesso(codigoCliente, processo) {
  const c = String(codigoCliente ?? '').trim();
  const p = Number(processo);
  const pSafe = Number.isFinite(p) ? p : 0;
  return `e-vilareal-acao-redacao:${c}:${pSafe}`;
}

const PERIODICIDADES_AGENDA_LOTE = [
  'Agendamento único',
  'Diariamente',
  'Semanalmente',
  'Quinzenalmente',
  'Mensalmente',
  'Bimestralmente',
  'Trimestralmente',
  'Semestralmente',
  'Todo dia X do mês',
];

/** Vínculo mock cliente×processo → imóvel (mesma regra do useMemo `vinculoImovelMock`). */
function buscarVinculoImovelMock() {
  return null;
}

function pickCampoStrSalvo(reg, key, mockVal) {
  if (!reg || !(key in reg)) return mockVal;
  return String(reg[key] ?? '');
}

/** Converte `dataProtocolo` da API (ISO ou objeto Jackson) para dd/mm/aaaa. */
function dataProtocoloApiParaCampoBr(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value.trim())) return value.trim();
    return value.trim();
  }
  if (typeof value === 'object' && value.year != null && value.month != null && value.day != null) {
    const d = String(value.day).padStart(2, '0');
    const m = String(value.month).padStart(2, '0');
    return `${d}/${m}/${value.year}`;
  }
  return '';
}

function mensagemIndicaDataProtocoloSincronizada(mensagem) {
  return String(mensagem ?? '').includes('Data do protocolo preenchida');
}

function pickCampoBoolSalvo(reg, key, mockVal) {
  if (!reg || !(key in reg) || reg[key] === null) return mockVal;
  if (reg[key] === false || reg[key] === 'false') return false;
  return reg[key] === true || reg[key] === 'true';
}

function apenasDigitos(val) {
  return String(val ?? '').replace(/\D/g, '');
}

function parseValorMonetarioBr(valor) {
  const cleaned = String(valor ?? '').trim().replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatarListaComConjuncaoE(itens) {
  const lista = (itens || []).map((x) => String(x ?? '').trim()).filter(Boolean);
  if (lista.length === 0) return '';
  if (lista.length === 1) return lista[0];
  if (lista.length === 2) return `${lista[0]} e ${lista[1]}`;
  return `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}`;
}

function hojeBr() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

/** Texto legado `consultor` gravado junto com `usuarioResponsavelId` (login ou apelido). */
function consultorLegadoDeUsuario(u) {
  if (!u) return '';
  const login = String(u.login ?? '').trim();
  if (login) return login;
  const apelido = String(u.apelido ?? '').trim();
  if (apelido) return apelido;
  return String(getNomeExibicaoUsuario(u) ?? '').trim();
}

/** Espelha `ConsultorUsuarioResolver`: match exato login/apelido, único. */
function resolverUsuarioIdPorConsultorLegado(consultor, usuarios) {
  const texto = String(consultor ?? '').trim();
  if (!texto || !Array.isArray(usuarios) || usuarios.length === 0) return '';
  const alvo = texto.toLowerCase();
  const porLogin = usuarios.filter((u) => String(u.login ?? '').trim().toLowerCase() === alvo);
  if (porLogin.length === 1) return String(porLogin[0].id);
  const porApelido = usuarios.filter((u) => String(u.apelido ?? '').trim().toLowerCase() === alvo);
  if (porApelido.length === 1) return String(porApelido[0].id);
  return '';
}

/** Mesmo critério do seletor «Perfil ativo» no menu (apelido ou login). */
function nomeUsuarioAtivoParaHistorico() {
  const perfilId = getPerfilAtivoParaPermissoes();
  const lista = getUsuariosAtivos();
  const u = (lista || []).find((x) => String(x.id) === String(perfilId));
  const nome = getNomeExibicaoUsuario(u);
  if (nome && nome !== '—') return formatarUsuarioHistoricoExibicao(nome);
  const id = String(perfilId || '').trim();
  if (id) return formatarUsuarioHistoricoExibicao(id.charAt(0).toUpperCase() + id.slice(1).toLowerCase());
  return formatarUsuarioHistoricoExibicao('Usuário');
}

function rotuloUsuarioHistoricoLinha(h) {
  return usuarioHistoricoParaExibicao(h, getUsuariosAtivos());
}

function autorHistoricoLinha(h) {
  return usuarioHistoricoAutorMeta(h, getUsuariosAtivos());
}

function usuarioAtivoIdParaHistorico() {
  const perfilId = getPerfilAtivoParaPermissoes();
  const perfilNum = Number(perfilId);
  if (Number.isFinite(perfilNum) && perfilNum >= 1) return perfilNum;
  const lista = getUsuariosAtivos();
  const u = (lista || []).find((x) => String(x.id) === String(perfilId));
  const idLista = Number(u?.id);
  if (Number.isFinite(idLista) && idLista >= 1) return idLista;
  const api = getApiUsuarioSessao();
  const apiNum = Number(api?.id);
  if (Number.isFinite(apiNum) && apiNum >= 1) return apiNum;
  return null;
}

function ultimaEntradaHistoricoEhDoUsuarioAtivo(entrada) {
  return entradaHistoricoPertenceAoUsuarioAtivo(entrada, {
    perfilId: getPerfilAtivoParaPermissoes(),
    usuariosAtivos: getUsuariosAtivos(),
    nomeAtivo: nomeUsuarioAtivoParaHistorico(),
    apiUsuario: getApiUsuarioSessao(),
  });
}

function formatValorContaCorrente(v) {
  const s = Math.abs(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return v < 0 ? `-${s}` : s;
}

function Field({ label, children, className = '', title, dense = false }) {
  return (
    <div className={className} title={title}>
      <label
        className={
          dense
            ? 'block text-[11px] font-semibold text-slate-600 mb-0 leading-tight'
            : 'block text-sm font-medium text-slate-700 mb-0.5'
        }
      >
        {label}
      </label>
      {children}
    </div>
  );
}

/** Mão com caneta — evoca “mão escrevendo” (✍️); Lucide não tem um único glifo para isso. */
function IconMaoEscrevendo({ className }) {
  return (
    <span className={`relative inline-flex h-4 w-4 shrink-0 items-end justify-center overflow-visible ${className ?? ''}`} aria-hidden>
      <Hand className="h-[15px] w-[15px]" strokeWidth={1.5} />
      <PenLine className="absolute -right-0.5 bottom-0 h-[11px] w-[11px] rotate-[-28deg]" strokeWidth={2} />
    </span>
  );
}

/** Linha de parte no processo: pessoa + N advogados (cada advogado é pessoa). */
function clonarLinhasParteProcesso(linhas) {
  return (linhas || [])
    .map((l) => ({
      pessoaId: Number(l.pessoaId),
      advogadoPessoaIds: Array.isArray(l.advogadoPessoaIds)
        ? l.advogadoPessoaIds.map(Number).filter((x) => Number.isFinite(x) && x > 0)
        : [],
    }))
    .filter((l) => Number.isFinite(l.pessoaId) && l.pessoaId > 0);
}

function entradasParteDesdeRegistro(idsLegado, entradasSalvas) {
  const ent = clonarLinhasParteProcesso(entradasSalvas);
  if (ent.length) return ent;
  return (idsLegado || [])
    .map((id) => ({ pessoaId: Number(id), advogadoPessoaIds: [] }))
    .filter((l) => l.pessoaId > 0);
}

/**
 * @param {object} [props]
 * @param {import('react-router-dom').Location['state'] | null} [props.embedIntent] — quando definido, substitui `location.state` para hidratar cliente/proc. (ex.: modal em Publicações).
 * @param {number|string} [props.embedIntentRevision] — incrementa/altera para re-aplicar o intent sem mudar de rota.
 * @param {() => void} [props.onFecharEmbed] — se definido, o «X» do cabeçalho chama isto em vez de `history.back()` (modo embutido).
 */
export function Processos({ embedIntent, embedIntentRevision = 0, onFecharEmbed } = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isEmbedded = embedIntent !== undefined && embedIntent !== null;
  const intentStateForHydration = isEmbedded ? embedIntent : location.state;
  const intentRevisionForHydration = isEmbedded ? String(embedIntentRevision) : location.key;
  const contaCorrenteSomenteEmbed = useMemo(
    () =>
      Boolean(
        intentStateForHydration &&
          typeof intentStateForHydration === 'object' &&
          intentStateForHydration.contaCorrenteSomente === true
      ),
    [intentStateForHydration]
  );

  const [codigoCliente, setCodigoCliente] = useState(
    () => resolverSelecaoInicialProcessos(isEmbedded ? null : location).codigoCliente,
  );
  const [cliente, setCliente] = useState('');
  /** Re-dispara resolução do nome após salvar no cadastro de clientes (mesmo dado que «Nome / Razão Social»). */
  const [clienteNomeRefreshTick, setClienteNomeRefreshTick] = useState(0);
  const [processo, setProcesso] = useState(
    () => resolverSelecaoInicialProcessos(isEmbedded ? null : location).numeroInterno,
  );
  /** Lançamento do duplo clique no extrato consolidado (Financeiro → Processos). */
  const [linhaOrigemContaCorrente, setLinhaOrigemContaCorrente] = useState(null);
  /** Abre Conta Corrente em modo Proc. 0 quando o Financeiro envia proc 0 (mensalista). Declarado cedo para o efeito abaixo. */
  const [contaCorrenteModo, setContaCorrenteModo] = useState('processo');
  const [modalContaCorrente, setModalContaCorrente] = useState(false);
  const fecharModalContaCorrente = useCallback(() => {
    setModalContaCorrente(false);
    if (contaCorrenteSomenteEmbed && typeof onFecharEmbed === 'function') {
      onFecharEmbed();
    }
  }, [contaCorrenteSomenteEmbed, onFecharEmbed]);
  const [resumoContaCorrenteApi, setResumoContaCorrenteApi] = useState(null);
  const [resumoContaCorrenteApiErro, setResumoContaCorrenteApiErro] = useState('');
  /** Lista do modal Conta Corrente quando a API financeira é a fonte de verdade (evita extrato local obsoleto após zerar). */
  const [contaCorrenteListaApi, setContaCorrenteListaApi] = useState({
    phase: 'idle',
    data: null,
    error: '',
  });
  const [contaCorrenteListaApiTick, setContaCorrenteListaApiTick] = useState(0);
  const [contaCorrenteTransacoesUi, setContaCorrenteTransacoesUi] = useState([]);
  const [ccSelecionados, setCcSelecionados] = useState(() => new Set());
  const [ccVinculoTick, setCcVinculoTick] = useState(0);
  const [ccSalvandoPapel, setCcSalvandoPapel] = useState(false);
  const [ccNumeroVinculoInput, setCcNumeroVinculoInput] = useState('');
  const [ccModoVincular, setCcModoVincular] = useState(true);
  const [ccPendenteChave, setCcPendenteChave] = useState(null);
  const [ccFiltroSemVinculo, setCcFiltroSemVinculo] = useState(false);
  const [ccMensagem, setCcMensagem] = useState('');
  /** Alvarás classificados / pendentes de repasse neste processo (API honorários). */
  const [ccHonorarioAlvaras, setCcHonorarioAlvaras] = useState({});
  const [ccHonorarioPendentes, setCcHonorarioPendentes] = useState([]);
  const [ccHonorarioTick, setCcHonorarioTick] = useState(0);
  const [ccHonorarioSalvando, setCcHonorarioSalvando] = useState(null);
  const [ccAlvaraRepasseAlvo, setCcAlvaraRepasseAlvo] = useState('');
  const [modalRelatorioPublicacoes, setModalRelatorioPublicacoes] = useState(false);
  const [modalConsultaPeriodica, setModalConsultaPeriodica] = useState(false);
  const [modalPeticionamentoProjudi, setModalPeticionamentoProjudi] = useState(false);
  /** Modal com cadastro de clientes (mesmo formulário de /pessoas) para o cliente e proc. atuais. */
  const [clientesEmbed, setClientesEmbed] = useState(null);
  /** Cadastro de Pessoas em janela suspensa (duplo clique na lista «Nesta parte»). */
  const [pessoaEmbed, setPessoaEmbed] = useState(null);
  const [modalTarefaContextual, setModalTarefaContextual] = useState(null);

  useLayoutEffect(() => {
    const intent = isEmbedded
      ? extrairIntentNavegacaoProcessos(intentStateForHydration)
      : resolverIntentNavegacaoProcessosDeRota(location);
    const saved = lerUltimaSelecaoProcessosArmazenamento();
    if (intent) {
      if (intent.hasCod) setCodigoCliente(padCliente(intent.codRaw));
      if (intent.hasProcKey && String(intent.procRaw ?? '').trim() !== '') {
        const num = parseInt(String(intent.procRaw), 10);
        if (!Number.isNaN(num) && num === 0) {
          setContaCorrenteModo('proc0');
          setModalContaCorrente(true);
        } else {
          setProcesso(Number.isNaN(num) ? 1 : Math.max(1, num));
        }
      }
    } else if (saved && !isEmbedded) {
      setCodigoCliente(saved.codigoCliente);
      setProcesso(saved.numeroInterno);
    }
  }, [intentRevisionForHydration, intentStateForHydration, isEmbedded, location]);

  useEffect(() => {
    gravarUltimaSelecaoProcessosArmazenamento(codigoCliente, processo);
  }, [codigoCliente, processo]);

  useEffect(() => {
    const s = intentStateForHydration && typeof intentStateForHydration === 'object' ? intentStateForHydration : null;
    setLinhaOrigemContaCorrente(s?.contaCorrenteLinha ?? null);
  }, [intentRevisionForHydration, location.pathname, intentStateForHydration]);
  const [parteCliente, setParteCliente] = useState('');
  const [edicaoDesabilitada, setEdicaoDesabilitada] = useState(true);
  const [parteOposta, setParteOposta] = useState('');
  /** Resultados da busca no modal «Detalhes» (não carrega o cadastro inteiro). */
  const [pessoasBuscaVinculoResultados, setPessoasBuscaVinculoResultados] = useState([]);
  const [buscaVinculoPessoasEmAndamento, setBuscaVinculoPessoasEmAndamento] = useState(false);
  /** id → dados para exibir partes/advogados e salvar nomes (preenchido por busca + resolução por id). */
  const [pessoasVinculoCache, setPessoasVinculoCache] = useState({});
  const buscaVinculoSeqRef = useRef(0);
  const pessoasVinculoCacheRef = useRef({});
  const [parteClienteEntradas, setParteClienteEntradas] = useState([]);
  const [parteOpostaEntradas, setParteOpostaEntradas] = useState([]);
  const parteClienteIds = useMemo(
    () => parteClienteEntradas.map((e) => e.pessoaId),
    [parteClienteEntradas]
  );
  const parteOpostaIds = useMemo(
    () => parteOpostaEntradas.map((e) => e.pessoaId),
    [parteOpostaEntradas]
  );
  const [modalVinculoPartes, setModalVinculoPartes] = useState(null); // 'detalhes' | null
  const [buscaPessoaVinculo, setBuscaPessoaVinculo] = useState('');
  /** Linhas editadas na aba atual do modal (pessoa + advogados). */
  const [linhasModalPartes, setLinhasModalPartes] = useState([]);
  /** Aba ativa no modal «Detalhes» (vínculo de pessoas). */
  const [detalhesAbaPartes, setDetalhesAbaPartes] = useState('cliente');
  const draftParteClienteLinhasRef = useRef([]);
  const draftParteOpostaLinhasRef = useRef([]);
  const [numeroProcessoVelho, setNumeroProcessoVelho] = useState('');
  const [numeroProcessoNovo, setNumeroProcessoNovo] = useState('');
  const [hintCopiaNumeroProcessoNovo, setHintCopiaNumeroProcessoNovo] = useState('');
  const hintCopiaNumeroProcessoNovoTimerRef = useRef(null);
  const [consultaAutomatica, setConsultaAutomatica] = useState(false);
  const [estado, setEstado] = useState('');
  const [cidade, setCidade] = useState('');
  const [municipioSelecionado, setMunicipioSelecionado] = useState(null);
  const [orgaoJulgadorSelecionado, setOrgaoJulgadorSelecionado] = useState(null);
  /** "Vara a distribuir": cidade conhecida, órgão ainda não sorteado (orgaoJulgadorId nulo). */
  const [varaADistribuir, setVaraADistribuir] = useState(false);
  const [dataProtocolo, setDataProtocolo] = useState('');
  /** Pasta do processo (API `pasta`); legado localStorage também em `pastaArquivo`. */
  const [pasta, setPasta] = useState('');
  const [naturezaAcao, setNaturezaAcao] = useState('');
  const [valorCausa, setValorCausa] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [usuarioResponsavelId, setUsuarioResponsavelId] = useState('');
  const [colaboradoresResponsavel, setColaboradoresResponsavel] = useState([]);
  const [competencia, setCompetencia] = useState('');
  const [observacao, setObservacao] = useState('');
  const [periodicidadeConsulta, setPeriodicidadeConsulta] = useState('');
  const [papelParte, setPapelParte] = useState('requerente');
  const [faseSelecionada, setFaseSelecionada] = useState('');
  const [statusAtivo, setStatusAtivo] = useState(true);
  const [faseCampo, setFaseCampo] = useState('');
  const [audienciaData, setAudienciaData] = useState('');
  const [audienciaHora, setAudienciaHora] = useState('');
  const [audienciaTipo, setAudienciaTipo] = useState('');
  const audienciaHoraInputRef = useRef(null);
  const [avisoAudiencia, setAvisoAudiencia] = useState('nao_avisado');
  const [prazoFatal, setPrazoFatal] = useState('');
  const [unidadeEndereco, setUnidadeEndereco] = useState('');
  const [imovelId, setImovelId] = useState('');
  const [imovelManual, setImovelManual] = useState(false);
  const [imovelVinculando, setImovelVinculando] = useState(false);
  const [modalBuscaImovelAberto, setModalBuscaImovelAberto] = useState(false);
  const [imovelVinculoMsg, setImovelVinculoMsg] = useState('');
  /** Evita sobrescrever o texto da unidade quando o vínculo mock mudar, após edição manual. */
  const [unidadeEnderecoManual, setUnidadeEnderecoManual] = useState(false);
  const [tramitacao, setTramitacao] = useState('');
  const [modalTramitacaoAberto, setModalTramitacaoAberto] = useState(false);
  /** Modal aberto pelo botão «Obter movimentações» com tramitação vazia — confirmação dispara consulta. */
  const [tramitacaoConfirmarDepoisObterMovimentacoes, setTramitacaoConfirmarDepoisObterMovimentacoes] =
    useState(false);
  const [tramitacaoDraft, setTramitacaoDraft] = useState('');
  const [pjeTribunal, setPjeTribunal] = useState('');
  const [pjeGrau, setPjeGrau] = useState('');
  const [pjeTribunalDraft, setPjeTribunalDraft] = useState('');
  const [pjeGrauDraft, setPjeGrauDraft] = useState('PRIMEIRO_GRAU');
  const [tabAtiva, setTabAtiva] = useState('historico');
  const [historicoToast, setHistoricoToast] = useState(null);
  const showProcessoToast = useCallback((message, variant = 'success') => {
    const msg = String(message ?? '').trim();
    if (!msg) {
      setHistoricoToast(null);
      return;
    }
    setHistoricoToast({ message: msg, variant });
  }, []);
  const bannerProcesso = useProcessosBannerExpandido();
  const abasProcessoRef = useRef(null);
  const [modalAcoesRedacaoAberto, setModalAcoesRedacaoAberto] = useState(false);
  const [indiceAcaoRedacaoFocada, setIndiceAcaoRedacaoFocada] = useState(0);
  /** Ação de redação guardada para o par cliente×processo (também em sessionStorage). */
  const [acaoRedacaoVinculada, setAcaoRedacaoVinculada] = useState(null);
  const indiceAcaoRedacaoFocadaRef = useRef(0);
  const [historico, setHistorico] = useState(() => []);
  const [proximaInformacao, setProximaInformacao] = useState('');
  const [dataProximaInformacao, setDataProximaInformacao] = useState('');
  const [paginaHistorico, setPaginaHistorico] = useState(1);
  const [informacaoModal, setInformacaoModal] = useState(null);
  const [modalAgendaLoteAberto, setModalAgendaLoteAberto] = useState(false);
  const [agendaLoteTexto, setAgendaLoteTexto] = useState('');
  const [agendaLoteData, setAgendaLoteData] = useState('');
  const [agendaLoteHora, setAgendaLoteHora] = useState('');
  const [agendaLotePeriodicidade, setAgendaLotePeriodicidade] = useState('Agendamento único');
  const [agendaLoteDiaDoMes, setAgendaLoteDiaDoMes] = useState('');
  const [agendaLoteInfo, setAgendaLoteInfo] = useState('');
  /** Duplo clique em «Audiência»: agenda em modal na data informada. */
  const [modalAgendaAudiencia, setModalAgendaAudiencia] = useState({
    aberto: false,
    dataBr: null,
    revision: 0,
  });
  const [sortContaCorrente, setSortContaCorrente] = useState({ col: 'data', dir: 'desc' });
  const [buscaContaCorrente, setBuscaContaCorrente] = useState({ campo: 'todos', termo: '' });
  const [processoApiId, setProcessoApiId] = useState(null);
  /** `clienteId` retornado pelo GET do processo na API (preferência sobre resolução por código). */
  const [clienteProcessoApiId, setClienteProcessoApiId] = useState(null);
  const [apiSaving, setApiSaving] = useState(false);
  const [gerandoDocNav, setGerandoDocNav] = useState(false);
  const [gerandoProcuracao, setGerandoProcuracao] = useState(false);
  const [gerandoDistribuicaoInicial, setGerandoDistribuicaoInicial] = useState(false);
  const [driveExplorerAberto, setDriveExplorerAberto] = useState(false);
  const [driveConfigurado, setDriveConfigurado] = useState(false);
  const [baixandoAutosIntegral, setBaixandoAutosIntegral] = useState(false);
  const [buscandoMovimentacoes, setBuscandoMovimentacoes] = useState(false);
  const [apiError, setApiError] = useState('');
  const [historicoExternoTick, setHistoricoExternoTick] = useState(0);
  /** Evita aplicar resposta antiga se o usuário trocar de processo antes do GET terminar. */
  const carregarProcessoApiSeqRef = useRef(0);
  /** Bloqueia auto-save enquanto GET /api/processos (troca de código ou nº interno) está em andamento. */
  const carregandoProcessoNavegacaoRef = useRef(false);
  /** Evita recarregar histórico da API para o mesmo processoId. */
  const historicoCarregadoParaProcessoRef = useRef(null);
  /**
   * Id do processo na API efetivamente selecionado (alinha com commit React).
   * Evita que GET /andamentos «atrasado» de outro `processoApiId` grave por cima do estado atual.
   */
  const processoApiIdRef = useRef(null);
  /** Geração de carregamento do histórico (evita «loading=false» no meio de outro GET). */
  const historicoApiCargaSeqRef = useRef(0);
  const carregarHistoricoApiRef = useRef(async () => {});
  const carregarProcessoApiAtualRef = useRef(async () => {});
  /** Evita POST de tramitação/periodicidade logo após GET hidratar o formulário (embed Agenda). */
  const ignorarSyncCamposLevesAposHidratarRef = useRef(false);
  const [historicoApiCarregando, setHistoricoApiCarregando] = useState(false);
  const [publicacoesRelatorioItens, setPublicacoesRelatorioItens] = useState([]);
  const [publicacoesRelatorioMeta, setPublicacoesRelatorioMeta] = useState(null);
  const [publicacoesRelatorioCarregando, setPublicacoesRelatorioCarregando] = useState(false);
  const [publicacoesRelatorioErro, setPublicacoesRelatorioErro] = useState('');
  const [publicacoesRelatorioTick, setPublicacoesRelatorioTick] = useState(0);
  const [movEmailItens, setMovEmailItens] = useState([]);
  const [movEmailCarregando, setMovEmailCarregando] = useState(false);
  const [movEmailErro, setMovEmailErro] = useState('');
  const [movEmailMeta, setMovEmailMeta] = useState(null);

  const fecharModalAgendaAudiencia = useCallback(
    () => setModalAgendaAudiencia({ aberto: false, dataBr: null, revision: 0 }),
    [],
  );

  useCloseOnEscape(driveExplorerAberto, () => setDriveExplorerAberto(false));
  useCloseOnEscape(modalBuscaImovelAberto, () => setModalBuscaImovelAberto(false));
  useCloseOnEscape(!!clientesEmbed, () => setClientesEmbed(null));
  useCloseOnEscape(modalAgendaAudiencia.aberto, fecharModalAgendaAudiencia);
  useCloseOnEscape(!!modalVinculoPartes, () => setModalVinculoPartes(null));
  useCloseOnEscape(!!informacaoModal, () => setInformacaoModal(null));
  useCloseOnEscape(modalContaCorrente, fecharModalContaCorrente);
  useCloseOnEscape(modalTramitacaoAberto, fecharModalTramitacao);
  useCloseOnEscape(modalAcoesRedacaoAberto, () => setModalAcoesRedacaoAberto(false));
  useCloseOnEscape(modalAgendaLoteAberto, () => setModalAgendaLoteAberto(false));
  useCloseOnEscape(
    isEmbedded &&
      !driveExplorerAberto &&
      !modalBuscaImovelAberto &&
      !pessoaEmbed &&
      !clientesEmbed &&
      !modalAgendaAudiencia.aberto &&
      !modalVinculoPartes &&
      !informacaoModal &&
      !modalContaCorrente &&
      !modalRelatorioPublicacoes &&
      !modalTarefaContextual &&
      !modalTramitacaoAberto &&
      !modalAcoesRedacaoAberto &&
      !modalAgendaLoteAberto,
    onFecharEmbed,
  );

  /** Evita página vazia quando o nº de linhas do histórico diminui (ex.: troca de processo ou carga API). */
  useEffect(() => {
    const totalP = Math.max(1, Math.ceil(historico.length / HISTORICO_POR_PAGINA));
    setPaginaHistorico((p) => {
      if (p > totalP) return totalP;
      if (p < 1) return 1;
      return p;
    });
  }, [historico.length]);

  useEffect(() => {
    const h = () => setHistoricoExternoTick((t) => t + 1);
    window.addEventListener('vilareal:processos-historico-atualizado', h);
    return () => window.removeEventListener('vilareal:processos-historico-atualizado', h);
  }, []);

  useEffect(() => {
    const h = (ev) => {
      setPublicacoesRelatorioTick((t) => t + 1);
      if (featureFlags.useApiProcessos && ev?.detail?.recarregarProcesso) {
        historicoCarregadoParaProcessoRef.current = null;
        const pid = processoApiIdRef.current;
        if (pid) {
          void carregarHistoricoApiRef.current(pid, carregarProcessoApiSeqRef.current);
        }
        void carregarProcessoApiAtualRef.current();
      }
    };
    window.addEventListener('vilareal:publicacoes-processo-relatorio-atualizado', h);
    return () => window.removeEventListener('vilareal:publicacoes-processo-relatorio-atualizado', h);
  }, []);

  useEffect(() => {
    if (tabAtiva !== 'publicacoes') return undefined;
    let cancelado = false;
    setPublicacoesRelatorioCarregando(true);
    setPublicacoesRelatorioErro('');
    setPublicacoesRelatorioMeta(null);
    void listarPublicacoesRelatorioPorProcesso({
      processoIdFromUi: processoApiId,
      codigoCliente,
      processo,
      numeroProcessoNovo,
    })
      .then((r) => {
        if (cancelado) return;
        setPublicacoesRelatorioItens(r.itens || []);
        setPublicacoesRelatorioMeta(r);
        setPublicacoesRelatorioErro(r.erro ? String(r.erro) : '');
      })
      .catch((e) => {
        if (cancelado) return;
        setPublicacoesRelatorioItens([]);
        setPublicacoesRelatorioErro(e?.message || 'Não foi possível carregar as publicações.');
      })
      .finally(() => {
        if (!cancelado) setPublicacoesRelatorioCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [tabAtiva, processoApiId, codigoCliente, processo, numeroProcessoNovo, publicacoesRelatorioTick]);

  useEffect(() => {
    if (tabAtiva !== 'movemail') return undefined;
    let cancelado = false;
    setMovEmailCarregando(true);
    setMovEmailErro('');
    setMovEmailMeta(null);
    void listarMovimentacoesEmailPorProcesso({
      processoIdFromUi: processoApiId,
      codigoCliente,
      numeroInterno: processo,
    })
      .then((r) => {
        if (cancelado) return;
        setMovEmailItens(r.itens || []);
        setMovEmailMeta(r);
        setMovEmailErro(r.erro ? String(r.erro) : '');
      })
      .catch((e) => {
        if (cancelado) return;
        setMovEmailItens([]);
        setMovEmailErro(e?.message || 'Não foi possível carregar as movimentações por e-mail.');
      })
      .finally(() => {
        if (!cancelado) setMovEmailCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [tabAtiva, processoApiId, codigoCliente, processo, publicacoesRelatorioTick]);

  useEffect(() => {
    const n = Number(processoApiId);
    processoApiIdRef.current = Number.isFinite(n) && n > 0 ? n : null;
  }, [processoApiId]);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro || !modalContaCorrente) {
      if (!modalContaCorrente) {
        setResumoContaCorrenteApi(null);
        setResumoContaCorrenteApiErro('');
      }
      return;
    }
    const procResumo = contaCorrenteModo === 'proc0' ? 0 : Number(processo) || 0;
    const temChaveNatural = String(codigoCliente ?? '').trim() !== '';
    if (!Number(processoApiId) && !temChaveNatural) return;
    let ativo = true;
    void carregarResumoContaCorrenteProcesso(Number(processoApiId) > 0 ? processoApiId : null, {
      codigoCliente,
      numeroInterno: procResumo,
    })
      .then((r) => {
        if (!ativo) return;
        setResumoContaCorrenteApi(r || null);
        setResumoContaCorrenteApiErro('');
      })
      .catch((e) => {
        if (!ativo) return;
        setResumoContaCorrenteApiErro(e?.message || 'Falha ao carregar resumo financeiro do processo.');
      });
    return () => {
      ativo = false;
    };
  }, [processoApiId, modalContaCorrente, codigoCliente, processo, contaCorrenteModo]);

  useEffect(() => {
    const h = () => setContaCorrenteListaApiTick((t) => t + 1);
    window.addEventListener(EVENT_FINANCEIRO_PERSISTENCIA_EXTERNA, h);
    return () => window.removeEventListener(EVENT_FINANCEIRO_PERSISTENCIA_EXTERNA, h);
  }, []);

  useEffect(() => {
    if (!modalContaCorrente) {
      setContaCorrenteListaApi({ phase: 'idle', data: null, error: '' });
      setContaCorrenteTransacoesUi([]);
      setCcSelecionados(new Set());
      setCcPendenteChave(null);
      setCcFiltroSemVinculo(false);
      setCcMensagem('');
      setCcHonorarioAlvaras({});
      setCcHonorarioPendentes([]);
      setCcAlvaraRepasseAlvo('');
      return;
    }
    if (!featureFlags.useApiFinanceiro) {
      setContaCorrenteListaApi({ phase: 'local', data: null, error: '' });
      return;
    }
    const procEfetivo = contaCorrenteModo === 'proc0' ? 0 : Number(processo) || 0;
    let alive = true;
    setContaCorrenteListaApi({ phase: 'loading', data: null, error: '' });

    void (async () => {
      try {
        const resolved = await resolverProcessoId({
          processoId: processoApiId,
          codigoCliente,
          numeroInterno: procEfetivo,
        });
        if (!alive) return;
        const temCodigo = String(codigoCliente ?? '').trim() !== '';
        if (!resolved && !temCodigo) {
          setContaCorrenteListaApi({ phase: 'local', data: null, error: '' });
          return;
        }
        const rows = await listarLancamentosProcessoApiFirst({
          processoId: resolved ?? null,
          codigoCliente,
          numeroInterno: procEfetivo,
        });
        if (!alive) return;
        const mapped = mapLinhasFinanceiroParaContaCorrenteModal(rows);
        setContaCorrenteTransacoesUi(Array.isArray(rows) ? rows : []);
        setContaCorrenteListaApi({ phase: 'ok', data: mapped, error: '' });
      } catch (e) {
        if (!alive) return;
        setContaCorrenteListaApi({
          phase: 'error',
          data: null,
          error: e?.message || 'Falha ao carregar lançamentos do financeiro (API).',
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    modalContaCorrente,
    contaCorrenteListaApiTick,
    processoApiId,
    codigoCliente,
    processo,
    contaCorrenteModo,
  ]);

  useEffect(() => {
    if (!modalContaCorrente || !featureFlags.useApiFinanceiro || contaCorrenteModo === 'proc0') {
      return undefined;
    }
    const procId = Number(processoApiId);
    if (!Number.isFinite(procId) || procId <= 0) {
      return undefined;
    }
    let ativo = true;
    void listarRepassesPendentesHonorarioApi()
      .then((data) => {
        if (!ativo) return;
        const itens = (data?.itens ?? []).filter((i) => Number(i.processoId) === procId);
        setCcHonorarioPendentes(itens);
        const mapa = {};
        for (const item of itens) {
          if (item.alvaraLancamentoId != null) {
            mapa[item.alvaraLancamentoId] = {
              retencao: item.retencao,
              repasseEsperado: item.repasseEsperado,
              percentualProveito: item.percentualProveito,
            };
          }
        }
        setCcHonorarioAlvaras(mapa);
        if (itens.length === 1 && itens[0].alvaraLancamentoId != null) {
          setCcAlvaraRepasseAlvo(String(itens[0].alvaraLancamentoId));
        }
      })
      .catch(() => {
        if (!ativo) return;
        setCcHonorarioPendentes([]);
      });
    return () => {
      ativo = false;
    };
  }, [modalContaCorrente, processoApiId, contaCorrenteModo, ccHonorarioTick]);

  const recarregarHonorarioCc = useCallback(() => setCcHonorarioTick((t) => t + 1), []);

  async function handleClassificarAlvaraCc(lancamentoId) {
    if (!lancamentoId) return;
    setCcHonorarioSalvando(`alvara-${lancamentoId}`);
    setCcMensagem('');
    try {
      const resp = await classificarAlvaraHonorarioApi(lancamentoId);
      setCcHonorarioAlvaras((prev) => ({
        ...prev,
        [lancamentoId]: {
          retencao: resp.retencao,
          repasseEsperado: resp.repasseEsperado,
          percentualProveito: resp.percentualProveito,
        },
      }));
      setCcMensagem(
        resp.repasseEsperado != null && resp.retencao != null
          ? `Alvará classificado — retenção ${formatValorContaCorrente(resp.retencao)} · repasse ${formatValorContaCorrente(resp.repasseEsperado)}`
          : 'Alvará classificado.',
      );
      recarregarHonorarioCc();
    } catch (e) {
      setCcMensagem(e?.message || 'Falha ao classificar alvará.');
    } finally {
      setCcHonorarioSalvando(null);
    }
  }

  async function handleVincularRepasseAlvaraCc(lancamentoDebitoId, alvaraLancamentoId) {
    if (!lancamentoDebitoId) return;
    setCcHonorarioSalvando(`repasse-${lancamentoDebitoId}`);
    setCcMensagem('');
    try {
      await vincularRepasseHonorarioApi(lancamentoDebitoId, alvaraLancamentoId || null);
      setCcMensagem('Repasse vinculado ao alvará.');
      recarregarHonorarioCc();
    } catch (e) {
      setCcMensagem(e?.message || 'Falha ao vincular repasse.');
    } finally {
      setCcHonorarioSalvando(null);
    }
  }

  const confirmarAcaoRedacaoPorIndice = useCallback(
    (idx) => {
      const op = ACOES_REDACAO_PROCESSO[idx];
      if (!op) return;
      const payload = {
        id: op.id,
        label: op.label,
        codigoCliente: String(codigoCliente ?? '').trim(),
        processo: Number(processo),
        processoApiId:
          processoApiId != null && Number.isFinite(Number(processoApiId)) ? Number(processoApiId) : null,
        savedAt: new Date().toISOString(),
      };
      try {
        sessionStorage.setItem(storageKeyAcaoRedacaoProcesso(codigoCliente, processo), JSON.stringify(payload));
      } catch {
        /* ignore */
      }
      setAcaoRedacaoVinculada(payload);
      setModalAcoesRedacaoAberto(false);
      if (op.id === 'montar') {
        navigate('/topicos/gerente', {
          state: {
            fromProcessosAcaoMontar: true,
            codigoCliente: payload.codigoCliente,
            processo: payload.processo,
            processoApiId: payload.processoApiId,
          },
        });
      }
    },
    [codigoCliente, processo, processoApiId, navigate]
  );

  const dispensarBannerAcaoRedacao = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKeyAcaoRedacaoProcesso(codigoCliente, processo));
    } catch {
      /* ignore */
    }
    setAcaoRedacaoVinculada(null);
  }, [codigoCliente, processo]);

  useEffect(() => {
    try {
      const k = storageKeyAcaoRedacaoProcesso(codigoCliente, processo);
      const raw = sessionStorage.getItem(k);
      if (!raw) {
        setAcaoRedacaoVinculada(null);
        return;
      }
      const o = JSON.parse(raw);
      if (
        o &&
        String(o.codigoCliente) === String(codigoCliente ?? '').trim() &&
        Number(o.processo) === Number(processo)
      ) {
        setAcaoRedacaoVinculada(o);
      } else {
        setAcaoRedacaoVinculada(null);
      }
    } catch {
      setAcaoRedacaoVinculada(null);
    }
  }, [codigoCliente, processo]);

  useEffect(() => {
    indiceAcaoRedacaoFocadaRef.current = indiceAcaoRedacaoFocada;
  }, [indiceAcaoRedacaoFocada]);

  useEffect(() => {
    if (!modalAcoesRedacaoAberto) return undefined;
    const n = ACOES_REDACAO_PROCESSO.length;
    const onKey = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndiceAcaoRedacaoFocada((i) => (i + 1) % n);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndiceAcaoRedacaoFocada((i) => (i - 1 + n) % n);
        return;
      }
      if (e.key === 'Home') {
        e.preventDefault();
        setIndiceAcaoRedacaoFocada(0);
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        setIndiceAcaoRedacaoFocada(n - 1);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmarAcaoRedacaoPorIndice(indiceAcaoRedacaoFocadaRef.current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalAcoesRedacaoAberto, confirmarAcaoRedacaoPorIndice]);

  useEffect(() => {
    if (!modalAcoesRedacaoAberto) return undefined;
    const id = window.requestAnimationFrame(() => {
      const el = document.getElementById(`acao-redacao-op-${indiceAcaoRedacaoFocada}`);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: 'nearest' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [modalAcoesRedacaoAberto, indiceAcaoRedacaoFocada]);

  useEffect(() => {
    return () => {
      try {
        window.localStorage.setItem('vilareal:processos:edicao-desabilitada-ao-sair:v1', 'true');
      } catch {
        /* ignore */
      }
    };
  }, []);

  // Mantém Processo sempre >= 1
  useEffect(() => {
    setProcesso((p) => Math.max(1, Number(p) || 1));
  }, []);

  useEffect(() => {
    const h = () => setClienteNomeRefreshTick((t) => t + 1);
    window.addEventListener('vilareal:cadastro-clientes-externo-atualizado', h);
    return () => window.removeEventListener('vilareal:cadastro-clientes-externo-atualizado', h);
  }, []);

  /**
   * Campo «Cliente» = mesmo texto que «Nome / Razão Social» em Clientes (`nomeRazao` / API `nomeReferencia`).
   * Prioridade: API cadastro de clientes → API processos (lista/resolução) → cadastro local (nomeRazao).
   */
  useEffect(() => {
    let cancelled = false;
    const cod = padCliente(String(codigoCliente ?? '').trim() || '00000001');

    const fallbackLocal = () => resolverNomeRazaoClienteMockPath(codigoCliente);

    if (!featureFlags.useApiClientes && !featureFlags.useApiProcessos) {
      setCliente(fallbackLocal());
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        if (featureFlags.useApiClientes) {
          const c = await obterClienteCadastroPorCodigo(cod);
          if (cancelled) return;
          const nomeRz = String(c?.nomeRazao ?? '').trim();
          if (nomeRz) {
            setCliente(nomeRz);
            return;
          }
        }
        if (featureFlags.useApiProcessos) {
          const row = await buscarClientePorCodigo(cod);
          if (cancelled) return;
          const nome = String(row?.nomeReferencia ?? row?.nome ?? '').trim();
          setCliente(nome || fallbackLocal() || '—');
          return;
        }
        if (!cancelled) setCliente(fallbackLocal());
      } catch {
        if (!cancelled) setCliente(fallbackLocal() || '—');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [codigoCliente, processo, clienteNomeRefreshTick]);

  // Atualiza campos com dados mock ao mudar cliente ou processo
  useEffect(() => {
    const procNorm = normalizarProcesso(processo);
    if (procNorm !== processo) setProcesso(procNorm);

    const mock = gerarMockProcesso(codigoCliente, procNorm);
    // Não sobrescreve o código vindo de outras telas; mantém exatamente o código em tela.
    const registroPersistido = getRegistroProcesso(mock.codigoCliente, mock.processo);
    const r = registroPersistido;

    const papelDefault = 'requerente';
    const papelSalvo = pickCampoStrSalvo(r, 'papelParte', '');
    const papelFinal = papelSalvo === 'requerente' || papelSalvo === 'requerido' ? papelSalvo : papelDefault;

    const fasePersistida =
      registroPersistido?.faseSelecionada != null && String(registroPersistido.faseSelecionada).trim() !== ''
        ? registroPersistido.faseSelecionada
        : mock.faseSelecionada;
    const naturezaDoHistorico = String(registroPersistido?.naturezaAcao ?? '').trim();
    const velhoDoHistorico = String(registroPersistido?.numeroProcessoVelho ?? '').trim();
    const novoDoHistorico = String(registroPersistido?.numeroProcessoNovo ?? '').trim();
    const parteOpostaDoHistorico = String(registroPersistido?.parteOposta ?? '').trim();
    let naturezaDoCadastro = '';
    let velhoDoCadastro = '';
    let novoDoCadastro = '';
    let parteOpostaDoCadastro = '';
    try {
      const cad = loadCadastroClienteDados(mock.codigoCliente);
      const rows = cad?.processos;
      if (Array.isArray(rows)) {
        const row = rows.find((p) => Number(p?.procNumero) === Number(mock.processo));
        naturezaDoCadastro = String(row?.descricao ?? '').trim();
        velhoDoCadastro = String(row?.processoVelho ?? '').trim();
        novoDoCadastro = String(row?.processoNovo ?? '').trim();
        parteOpostaDoCadastro = String(row?.parteOposta ?? '').trim();
      }
    } catch {
      /* ignore */
    }
    const numeroNovoPersistido = novoDoHistorico || novoDoCadastro || mock.numeroProcessoNovo;
    const numeroVelhoPersistido = velhoDoHistorico || velhoDoCadastro || mock.numeroProcessoVelho;
    const naturezaPersistida = naturezaDoHistorico || naturezaDoCadastro || mock.naturezaAcao;
    const parteOpostaPersistida = parteOpostaDoHistorico || parteOpostaDoCadastro || mock.parteOposta;

    if (!featureFlags.useApiProcessos) {
      setParteCliente(pickCampoStrSalvo(r, 'parteCliente', mock.parteCliente));
      setParteClienteEntradas(
        entradasParteDesdeRegistro(registroPersistido?.parteClienteIds, registroPersistido?.parteClienteEntradas)
      );
      setParteOpostaEntradas(
        entradasParteDesdeRegistro(registroPersistido?.parteOpostaIds, registroPersistido?.parteOpostaEntradas)
      );
      setStatusAtivo(pickCampoBoolSalvo(r, 'statusAtivo', mock.statusAtivo));
      setPapelParte(papelFinal);
      setCompetencia(pickCampoStrSalvo(r, 'competencia', mock.competencia));
      setNumeroProcessoNovo(numeroNovoPersistido);
      setNumeroProcessoVelho(numeroVelhoPersistido);
      setParteOposta(parteOpostaPersistida);
      setFaseSelecionada(fasePersistida);
      setConsultaAutomatica(pickCampoBoolSalvo(r, 'consultaAutomatica', mock.consultaAutomatica));
      setPeriodicidadeConsulta(registroPersistido?.periodicidadeConsulta ?? '');
      setTramitacao(registroPersistido?.tramitacao ?? '');
      setPjeTribunal(registroPersistido?.pjeTribunal ?? '');
      setPjeGrau(registroPersistido?.pjeGrau ?? '');
      setDataProtocolo(pickCampoStrSalvo(r, 'dataProtocolo', mock.dataProtocolo));
      setNaturezaAcao(naturezaPersistida);
      setValorCausa(pickCampoStrSalvo(r, 'valorCausa', mock.valorCausa));
      setObservacao(pickCampoStrSalvo(r, 'observacao', mock.observacao));
      setEstado(pickCampoStrSalvo(r, 'estado', mock.estado));
      setCidade(pickCampoStrSalvo(r, 'cidade', mock.cidade));
      const mid = r?.municipioId ?? r?.municipio?.id;
      if (mid) {
        setMunicipioSelecionado({
          municipioId: mid,
          municipio: r.municipio || { id: mid, nome: pickCampoStrSalvo(r, 'cidade', mock.cidade), uf: pickCampoStrSalvo(r, 'estado', mock.estado) },
        });
      } else {
        setMunicipioSelecionado(null);
      }
      const oid = r?.orgaoJulgadorId ?? r?.orgaoJulgador?.id;
      if (oid) {
        setOrgaoJulgadorSelecionado({
          orgaoJulgadorId: oid,
          orgaoJulgador: r.orgaoJulgador || { id: oid, nome: r.orgaoJulgador?.nome },
        });
        if (r.orgaoJulgador?.municipio) {
          setEstado(r.orgaoJulgador.municipio.uf || '');
          setCidade(r.orgaoJulgador.municipio.nome || '');
        }
      } else {
        setOrgaoJulgadorSelecionado(null);
      }
      // Default "a distribuir": processo sem número e sem vara abre com a checkbox marcada (sobrescrevível).
      setVaraADistribuir(!oid && String(numeroNovoPersistido ?? '').trim() === '');
      setResponsavel(pickCampoStrSalvo(r, 'responsavel', ''));
      const fkSalvo = pickCampoStrSalvo(r, 'usuarioResponsavelId', '');
      setUsuarioResponsavelId(fkSalvo.trim() !== '' ? fkSalvo : '');
    } else {
      // Com API: cabeçalho, partes e histórico vêm de GET /api/processos e sub-rotas (importação/planilha).
      setPeriodicidadeConsulta(registroPersistido?.periodicidadeConsulta ?? '');
    }
    if (!featureFlags.useApiProcessos) {
      setPasta(pickCampoStrSalvo(r, 'pasta', pickCampoStrSalvo(r, 'pastaArquivo', '')));
      setFaseCampo(pickCampoStrSalvo(r, 'faseCampo', ''));
      setAudienciaData(pickCampoStrSalvo(r, 'audienciaData', ''));
      setAudienciaHora(pickCampoStrSalvo(r, 'audienciaHora', ''));
      setAudienciaTipo(normalizarTipoAudienciaCanonico(pickCampoStrSalvo(r, 'audienciaTipo', '')));
      setAvisoAudiencia(pickCampoStrSalvo(r, 'avisoAudiencia', 'nao_avisado') || 'nao_avisado');
      setProximaInformacao(pickCampoStrSalvo(r, 'proximaInformacao', ''));
      setDataProximaInformacao(pickCampoStrSalvo(r, 'dataProximaInformacao', ''));
      const valorCausaHist = pickCampoStrSalvo(r, 'valorCausa', '');
      if (valorCausaHist.trim() !== '') {
        setValorCausa(valorCausaHist);
      }
    }
    const vinc = buscarVinculoImovelMock(mock.codigoCliente, mock.processo);
    const imovelSalvo = pickCampoStrSalvo(r, 'imovelId', '');

    const nav = typeof intentStateForHydration === 'object' && intentStateForHydration ? intentStateForHydration : null;
    const navImovelNum =
      nav?.imovelId != null && String(nav.imovelId).trim() !== ''
        ? Number(String(nav.imovelId).replace(/\D/g, ''))
        : NaN;
    const codNavRaw = nav?.codigoCliente ?? nav?.codCliente;
    const codNavPad =
      codNavRaw != null && String(codNavRaw).trim() !== '' ? padCliente(codNavRaw) : '';
    const procNavRaw = nav?.numeroInterno ?? nav?.proc ?? nav?.processo;
    const procNavStr =
      procNavRaw !== undefined && procNavRaw !== null && String(procNavRaw).trim() !== ''
        ? String(normalizarProcesso(procNavRaw))
        : '';
    const procMockStr = String(normalizarProcesso(mock.processo));
    const navAlinha =
      codNavPad !== '' &&
      procNavStr !== '' &&
      codNavPad === mock.codigoCliente &&
      procNavStr === procMockStr;
    const imovelPorNavegacao =
      navAlinha && Number.isFinite(navImovelNum) && navImovelNum > 0 ? navImovelNum : null;

    let nextImovelIdStr = '';
    if (imovelPorNavegacao != null) {
      nextImovelIdStr = String(imovelPorNavegacao);
    } else if (imovelSalvo.trim() !== '') {
      nextImovelIdStr = imovelSalvo.trim();
    } else if (vinc) {
      nextImovelIdStr = String(vinc.imovelId);
    }
    setImovelId(nextImovelIdStr);

    const mockDoImovel = null;

    const ueSalvo = pickCampoStrSalvo(r, 'unidadeEndereco', '');
    const uSalvo = pickCampoStrSalvo(r, 'unidade', '');
    const mergedUnidade =
      String(ueSalvo ?? '').trim() !== ''
        ? String(ueSalvo).trim()
        : String(uSalvo ?? '').trim() !== ''
          ? String(uSalvo).trim()
          : mockDoImovel && String(mockDoImovel.unidade ?? '').trim() !== ''
            ? String(mockDoImovel.unidade).trim()
            : vinc && String(vinc.unidade ?? '').trim() !== ''
              ? String(vinc.unidade).trim()
              : '';
    // Com API: unidade vem de GET /api/processos (efeito carregarProcessoApiAtual), não do localStorage.
    if (!featureFlags.useApiProcessos) {
      setUnidadeEndereco(mergedUnidade);

      const historicoPersistido = getHistoricoDoProcesso(mock.codigoCliente, mock.processo);
      setPrazoFatal(registroPersistido?.prazoFatal ?? '');
      const payloadFormBase = {
        codCliente: mock.codigoCliente,
        proc: mock.processo,
        cliente: resolverNomeRazaoClienteMockPath(codigoCliente),
        parteCliente: pickCampoStrSalvo(r, 'parteCliente', mock.parteCliente),
        parteOposta: parteOpostaPersistida,
        numeroProcessoVelho: numeroVelhoPersistido,
        numeroProcessoNovo: numeroNovoPersistido,
        consultaAutomatica: pickCampoBoolSalvo(r, 'consultaAutomatica', mock.consultaAutomatica),
        statusAtivo: pickCampoBoolSalvo(r, 'statusAtivo', mock.statusAtivo),
        papelParte: papelFinal,
        estado: pickCampoStrSalvo(r, 'estado', mock.estado),
        cidade: pickCampoStrSalvo(r, 'cidade', mock.cidade),
        dataProtocolo: pickCampoStrSalvo(r, 'dataProtocolo', mock.dataProtocolo),
        pasta: pickCampoStrSalvo(r, 'pasta', pickCampoStrSalvo(r, 'pastaArquivo', '')),
        pastaArquivo: pickCampoStrSalvo(r, 'pasta', pickCampoStrSalvo(r, 'pastaArquivo', '')),
        valorCausa: pickCampoStrSalvo(r, 'valorCausa', mock.valorCausa),
        procedimento: pickCampoStrSalvo(r, 'procedimento', ''),
        responsavel: pickCampoStrSalvo(r, 'responsavel', ''),
        usuarioResponsavelId: pickCampoStrSalvo(r, 'usuarioResponsavelId', ''),
        competencia: pickCampoStrSalvo(r, 'competencia', mock.competencia),
        observacao: pickCampoStrSalvo(r, 'observacao', mock.observacao),
        faseCampo: pickCampoStrSalvo(r, 'faseCampo', ''),
        audienciaData: pickCampoStrSalvo(r, 'audienciaData', ''),
        audienciaHora: pickCampoStrSalvo(r, 'audienciaHora', ''),
        audienciaTipo: normalizarTipoAudienciaCanonico(pickCampoStrSalvo(r, 'audienciaTipo', '')),
        avisoAudiencia: pickCampoStrSalvo(r, 'avisoAudiencia', 'nao_avisado') || 'nao_avisado',
        imovelId: nextImovelIdStr,
        unidade: mergedUnidade,
        unidadeEndereco: mergedUnidade,
        proximaInformacao: pickCampoStrSalvo(r, 'proximaInformacao', ''),
        dataProximaInformacao: pickCampoStrSalvo(r, 'dataProximaInformacao', ''),
        prazoFatal: registroPersistido?.prazoFatal ?? '',
        parteClienteEntradas: entradasParteDesdeRegistro(
          registroPersistido?.parteClienteIds,
          registroPersistido?.parteClienteEntradas
        ),
        parteOpostaEntradas: entradasParteDesdeRegistro(
          registroPersistido?.parteOpostaIds,
          registroPersistido?.parteOpostaEntradas
        ),
        parteClienteIds: entradasParteDesdeRegistro(
          registroPersistido?.parteClienteIds,
          registroPersistido?.parteClienteEntradas
        ).map((e) => e.pessoaId),
        parteOpostaIds: entradasParteDesdeRegistro(
          registroPersistido?.parteOpostaIds,
          registroPersistido?.parteOpostaEntradas
        ).map((e) => e.pessoaId),
        faseSelecionada: fasePersistida,
        periodicidadeConsulta: registroPersistido?.periodicidadeConsulta ?? '',
        tramitacao: registroPersistido?.tramitacao ?? '',
        naturezaAcao: naturezaPersistida,
      };
      if (historicoPersistido.length > 0) {
        setHistorico(historicoPersistido);
        if (!String(registroPersistido?.faseSelecionada ?? '').trim()) {
          salvarHistoricoDoProcesso({
            ...payloadFormBase,
            historico: historicoPersistido,
            faseSelecionada: fasePersistida,
          });
        }
      } else {
        const historicoInicial = [];
        setHistorico(historicoInicial);
        seedHistoricoDoProcesso({
          ...payloadFormBase,
          historico: historicoInicial,
          faseSelecionada: fasePersistida,
        });
      }
    }
    setPaginaHistorico(1);
    setInformacaoModal(null);
  }, [codigoCliente, processo, intentRevisionForHydration, intentStateForHydration, historicoExternoTick]);

  useEffect(() => {
    if (!featureFlags.useApiProcessos) return;
    carregandoProcessoNavegacaoRef.current = true;
    aplicarCabecalhoVazioProcessoNaoCadastradoApi();
    void carregarProcessoApiAtual().finally(() => {
      carregandoProcessoNavegacaoRef.current = false;
      ignorarSyncCamposLevesAposHidratarRef.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoCliente, processo]);

  useEffect(() => {
    if (!featureFlags.useApiProcessos || tabAtiva !== 'historico' || !processoApiId) return;
    if (historicoCarregadoParaProcessoRef.current === processoApiId) return;
    const seq = carregarProcessoApiSeqRef.current;
    void carregarHistoricoApi(processoApiId, seq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabAtiva, processoApiId]);

  useEffect(() => {
    setImovelManual(false);
    setUnidadeEnderecoManual(false);
    setImovelVinculoMsg('');
  }, [codigoCliente, processo]);

  const vinculoImovelMock = useMemo(() => null, [codigoCliente, processo]);

  useEffect(() => {
    if (vinculoImovelMock) {
      if (!imovelManual && !String(imovelId ?? '').trim()) setImovelId(String(vinculoImovelMock.imovelId));
      if (!unidadeEnderecoManual && !String(unidadeEndereco ?? '').trim()) {
        setUnidadeEndereco(String(vinculoImovelMock.unidade ?? ''));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vinculoImovelMock]);

  async function handleImovelIdBlur(npOverride) {
    const np =
      npOverride != null
        ? Math.trunc(Number(npOverride))
        : Math.trunc(Number(String(imovelId ?? '').replace(/\D/g, '')));
    const procNum = Math.trunc(Number(normalizarProcesso(processo)));
    if (!featureFlags.useApiImoveis || !String(codigoCliente ?? '').trim() || procNum < 1 || np < 1) {
      return;
    }

    setImovelVinculando(true);
    setImovelVinculoMsg('');
    try {
      const r = await vincularProcessoAoNumeroImovel(codigoCliente, procNum, np);
      if (r.ok) {
        setImovelId(String(np));
        const un = String(r.unidade ?? '').trim();
        if (un && !unidadeEnderecoManual && !String(unidadeEndereco ?? '').trim()) {
          setUnidadeEndereco(un);
        }
        setImovelVinculoMsg(r.mensagem || 'Vínculo gravado.');
      } else {
        setImovelVinculoMsg(r.mensagem || 'Não foi possível vincular o imóvel.');
      }
    } catch (e) {
      setImovelVinculoMsg(e?.message || 'Erro ao vincular imóvel.');
    } finally {
      setImovelVinculando(false);
    }
  }

  async function handleSelecionarImovelBusca(im) {
    const np = im?.numeroPlanilha != null ? Math.trunc(Number(im.numeroPlanilha)) : NaN;
    if (!Number.isFinite(np) || np < 1) {
      setImovelVinculoMsg('Este imóvel não tem nº da planilha (col. A). Escolha outro ou corrija o cadastro.');
      return;
    }
    setImovelManual(true);
    setImovelId(String(np));
    const un = String(im?.unidade ?? '').trim();
    if (un && !unidadeEnderecoManual && !String(unidadeEndereco ?? '').trim()) {
      setUnidadeEndereco(un);
    }
    setModalBuscaImovelAberto(false);
    await handleImovelIdBlur(np);
  }

  function handleAbrirImovel() {
    let idNum = Number(String(imovelId ?? '').replace(/\D/g, ''));
    if (!Number.isFinite(idNum) || idNum <= 0) {
      const v = vinculoImovelMock?.imovelId;
      if (v != null && Number.isFinite(Number(v)) && Number(v) > 0) {
        idNum = Number(v);
      }
    }

    if (!Number.isFinite(idNum) || idNum <= 0) {
      window.alert('Informe o nº do imóvel (Administração de Imóveis → Imóveis) ou use um id gravado na API.');
      return;
    }

    let unidadeTrim = String(unidadeEndereco ?? '').trim();

    /** Abre Imóveis pelo nº da planilha (col. A) — não confundir com id interno da API. */
    navigate('/imoveis', {
      state: {
        imovelId: idNum,
        ...(unidadeTrim ? { unidade: unidadeTrim } : {}),
      },
    });
  }

  useEffect(() => {
    if (modalContaCorrente) setSortContaCorrente({ col: 'data', dir: 'desc' });
  }, [modalContaCorrente, codigoCliente, processo, contaCorrenteModo]);

  useEffect(() => {
    if (modalContaCorrente) setBuscaContaCorrente({ campo: 'todos', termo: '' });
  }, [modalContaCorrente, codigoCliente, processo, contaCorrenteModo]);

  function montarTituloAgendaDoProcesso() {
    const cli = String(cliente ?? '').trim();
    const op = String(textoParteOposta || parteOposta || '').trim();
    const num = String(numeroProcessoNovo ?? '').trim();
    const left = cli || 'Cliente';
    const right = op || 'Parte Oposta';
    const procTxt = num ? ` (${num})` : '';
    return `${left} x ${right}${procTxt}`.trim();
  }

  function abrirAgendaEmLote() {
    const hoje = hojeBr();
    const dataInicial = normalizarDataBr(audienciaData) || hoje;
    const diaInicial = Number(String(dataInicial).slice(0, 2));
    setAgendaLoteTexto(montarTituloAgendaDoProcesso());
    setAgendaLoteData(dataInicial);
    setAgendaLoteHora(normalizarHoraAudiencia(audienciaHora) || '');
    setAgendaLotePeriodicidade('Agendamento único');
    setAgendaLoteDiaDoMes(Number.isFinite(diaInicial) ? String(diaInicial) : '');
    setAgendaLoteInfo('');
    setModalAgendaLoteAberto(true);
  }

  function abrirAgendaFlutuanteNaDataAudiencia() {
    const norm = normalizarDataBr(audienciaData);
    if (!norm || !/^\d{2}\/\d{2}\/\d{4}$/.test(norm)) return;
    setModalAgendaAudiencia((prev) => ({
      aberto: true,
      dataBr: norm,
      revision: prev.revision + 1,
    }));
  }

  async function salvarAgendaEmLote() {
    const dataNorm = normalizarDataBr(agendaLoteData);
    if (!dataNorm) {
      setAgendaLoteInfo('Informe uma data válida no formato dd/mm/aaaa.');
      return;
    }

    const horaNorm = normalizarHoraAudiencia(agendaLoteHora);
    const periodicidadeTodoDiaMes = agendaLotePeriodicidade === 'Todo dia X do mês';
    const diaDoMesNum = Number(agendaLoteDiaDoMes);
    if (
      periodicidadeTodoDiaMes &&
      (!Number.isInteger(diaDoMesNum) || !Number.isFinite(diaDoMesNum) || diaDoMesNum < 1 || diaDoMesNum > 31)
    ) {
      setAgendaLoteInfo('Informe um dia do mês válido entre 1 e 31.');
      return;
    }

    if (featureFlags.useApiAgenda) {
      try {
        const resultado = await replicarCompromissoLoteTodosColaboradoresApi({
          textoCompromisso: agendaLoteTexto,
          dataBaseBr: dataNorm,
          hora: horaNorm,
          periodicidade: agendaLotePeriodicidade,
          diaDoMes: periodicidadeTodoDiaMes ? diaDoMesNum : null,
          ajustarParaDiaUtil: true,
          codigoCliente,
          numeroInterno: processo,
        });
        if (!resultado?.ok) {
          setAgendaLoteInfo('Não foi possível salvar o agendamento na API.');
          return;
        }
        setAgendaLoteInfo(
          `Agendamento replicado na API: ${resultado.criados} compromisso(s), ${resultado.ocorrencias} dia(s), ${resultado.usuarios} colaborador(es) na lista.`
        );
      } catch {
        setAgendaLoteInfo('Erro ao salvar agendamento na API.');
        return;
      }
      setTimeout(() => setModalAgendaLoteAberto(false), 700);
      return;
    }

    const usuariosAlvo = (getColaboradoresHumanosAtivos() || []).map((u) => ({
      id: u.id,
      nome: String(getNomeExibicaoUsuario(u) || u.id || '').trim() || String(u.id),
    }));
    if (usuariosAlvo.length === 0) {
      setAgendaLoteInfo('Cadastre usuários ativos em Usuários para replicar na agenda de todos.');
      return;
    }

    const resultado = agendarEmLoteParaUsuarios({
      textoCompromisso: agendaLoteTexto,
      dataBaseBr: dataNorm,
      hora: horaNorm,
      periodicidade: agendaLotePeriodicidade,
      diaDoMes: periodicidadeTodoDiaMes ? diaDoMesNum : null,
      ajustarParaDiaUtil: true,
      usuarios: usuariosAlvo,
      processoId: String(processo ?? ''),
      clienteId: String(codigoCliente ?? ''),
      numeroProcessoNovo: String(numeroProcessoNovo ?? ''),
    });

    if (!resultado?.ok) {
      setAgendaLoteInfo('Não foi possível salvar o agendamento em lote.');
      return;
    }

    setAgendaLoteInfo(
      `Agendamento criado: ${resultado.inseridos} item(ns), ${resultado.ocorrencias} ocorrência(s), ${resultado.usuarios} usuário(s).`
    );
    setTimeout(() => setModalAgendaLoteAberto(false), 700);
  }

  const primeiraOcorrenciaAjustadaAgendaLote = useMemo(() => {
    const dataNorm = normalizarDataBr(agendaLoteData);
    if (!dataNorm) return '';
    const periodicidadeTodoDiaMes = agendaLotePeriodicidade === 'Todo dia X do mês';
    const diaDoMesNum = Number(agendaLoteDiaDoMes);
    if (
      periodicidadeTodoDiaMes &&
      (!Number.isInteger(diaDoMesNum) || !Number.isFinite(diaDoMesNum) || diaDoMesNum < 1 || diaDoMesNum > 31)
    ) {
      return '';
    }
    return calcularPrimeiraOcorrenciaAgendaLote({
      dataBaseBr: dataNorm,
      periodicidade: agendaLotePeriodicidade,
      diaDoMes: periodicidadeTodoDiaMes ? diaDoMesNum : null,
      ajustarParaDiaUtil: true,
    });
  }, [agendaLoteData, agendaLotePeriodicidade, agendaLoteDiaDoMes]);

  /** Disponível mesmo com edição desabilitada: abre http(s) ou mostra o caminho. */
  function abrirLinkPastaArquivo() {
    const s = String(pasta || '').trim();
    if (!s) {
      window.alert('Informe o link ou caminho em "Pasta do Processo".');
      return;
    }
    if (/^https?:\/\//i.test(s)) {
      window.open(s, '_blank', 'noopener,noreferrer');
      return;
    }
    window.alert('Copie ou abra manualmente:\n\n' + s);
  }

  function abrirModalTarefaDoProcesso() {
    if (!featureFlags.useApiTarefas) return;
    const ctx = buildContextFromProcesso({
      processoApiId,
      clienteIdNativo: clienteProcessoApiId,
      codigoCliente,
      processoNumero: processo,
      clienteNome: cliente,
      numeroProcessoNovo,
    });
    if (featureFlags.useApiProcessos && !processoApiId) {
      ctx.aviso =
        'O processo ainda não possui id na API — a tarefa pode ser criada sem vínculo até o cadastro ser sincronizado.';
    }
    setModalTarefaContextual(ctx);
  }

  function abrirModalTarefaComPrazoFatal() {
    if (!featureFlags.useApiTarefas) return;
    const ctx = buildContextFromProcessoComPrazoFatal(
      {
        processoApiId,
        clienteIdNativo: clienteProcessoApiId,
        codigoCliente,
        processoNumero: processo,
        clienteNome: cliente,
        numeroProcessoNovo,
      },
      prazoFatal
    );
    if (featureFlags.useApiProcessos && !processoApiId) {
      ctx.aviso =
        'O processo ainda não possui id na API — a tarefa pode ser criada sem vínculo até o cadastro ser sincronizado.';
    }
    setModalTarefaContextual(ctx);
  }

  function abrirModalTramitacao(opcoes = {}) {
    const { aposObterMovimentacoes = false } = opcoes;
    const sistema = tramitacao || '';
    setTramitacaoDraft(sistema);
    const det = detectarPjeTribunalPorCnj(numeroProcessoNovo);
    setPjeTribunalDraft(
      pjeTribunal || (sistema === 'PJe' ? det.codigo || '' : '')
    );
    setPjeGrauDraft(pjeGrau || 'PRIMEIRO_GRAU');
    setTramitacaoConfirmarDepoisObterMovimentacoes(aposObterMovimentacoes);
    setModalTramitacaoAberto(true);
  }

  function fecharModalTramitacao() {
    setModalTramitacaoAberto(false);
    setTramitacaoConfirmarDepoisObterMovimentacoes(false);
  }

  async function confirmarTramitacao() {
    const valor = String(tramitacaoDraft ?? '').trim();
    const aposObter = tramitacaoConfirmarDepoisObterMovimentacoes;
    const tribunalSalvar = valor === 'PJe' ? String(pjeTribunalDraft ?? '').trim() || null : null;
    const grauSalvar = valor === 'PJe' ? String(pjeGrauDraft ?? '').trim() || 'PRIMEIRO_GRAU' : null;
    setTramitacao(valor);
    setPjeTribunal(tribunalSalvar || '');
    setPjeGrau(grauSalvar || '');
    setModalTramitacaoAberto(false);
    setTramitacaoConfirmarDepoisObterMovimentacoes(false);

    const overridesPje = {
      tramitacao: valor,
      pjeTribunal: tribunalSalvar,
      pjeGrau: grauSalvar,
    };

    if (aposObter) {
      if (featureFlags.useApiProcessos) {
        await sincronizarApiProcessoAtual(overridesPje, {
          syncPartes: false,
          syncAndamentos: false,
          syncPrazoFatal: false,
          permitirComEdicaoDesabilitada: true,
        });
      } else {
        salvarHistoricoDoProcesso(montarPayloadRegistroProcesso(overridesPje));
      }
      if (valor === 'TJ Go - Autos Físicos') {
        showProcessoToast('Processo em autos físicos — sem consulta automática.', 'warning');
        return;
      }
      if (valor === 'Projudi' || valor === 'PJe') {
        await executarObterMovimentacoesDrive();
      }
      return;
    }

    if (featureFlags.useApiProcessos) {
      void sincronizarApiProcessoAtual(overridesPje, {
        syncPartes: false,
        syncAndamentos: false,
        syncPrazoFatal: false,
        permitirComEdicaoDesabilitada: true,
      });
    } else {
      salvarHistoricoDoProcesso(montarPayloadRegistroProcesso(overridesPje));
    }
  }

  function dataParaOrdenarContaCorrente(data) {
    const s = String(data ?? '').trim();
    if (!s || s.length < 10) return '';
    const [dd, mm, yyyy] = s.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }

  function ordenarLancamentosContaCorrente(lista, col, dir) {
    if (!col || !Array.isArray(lista) || lista.length === 0) return lista;
    const asc = dir === 'asc';
    const sorted = [...lista].sort((a, b) => {
      let va = a[col];
      let vb = b[col];
      if (col === 'data') {
        va = dataParaOrdenarContaCorrente(va);
        vb = dataParaOrdenarContaCorrente(vb);
        const r = String(va).localeCompare(String(vb));
        return asc ? r : -r;
      }
      if (col === 'valor') {
        const r = (Number(va) || 0) - (Number(vb) || 0);
        return asc ? r : -r;
      }
      if (col === 'numero') {
        const r = (Number(va) || 0) - (Number(vb) || 0);
        return asc ? r : -r;
      }
      const r = String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR');
      return asc ? r : -r;
    });
    return sorted;
  }

  /** Ordenação da tabela Conta Corrente: 1.º clique asc, 2.º desc, 3.º volta ao padrão (data mais recente primeiro). */
  function handleClicTituloOrdenacaoContaCorrente(col) {
    setSortContaCorrente((prev) => {
      if (prev.col !== col) {
        return { col, dir: 'asc' };
      }
      if (prev.dir === 'asc') {
        return { col, dir: 'desc' };
      }
      return { col: 'data', dir: 'desc' };
    });
  }

  function toggleCcSelecionado(chave) {
    setCcSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(chave)) next.delete(chave);
      else next.add(chave);
      return next;
    });
  }

  async function persistirNumeroVinculoLinha(chave, numeroVinculo, transacaoUi) {
    const procEf = contaCorrenteModo === 'proc0' ? 0 : processo;
    const num = normalizarNumeroVinculo(numeroVinculo);
    atribuirNumeroVinculoLancamentos(codigoCliente, procEf, [chave], num);
    if (featureFlags.useApiFinanceiro && transacaoUi?.apiId) {
      const baseDesc = aplicarTagPapelDescricao(
        transacaoUi.descricaoDetalhada,
        transacaoUi.classificacao?.papel,
      );
      const novaDesc = aplicarNumeroVinculoDescricao(baseDesc, num);
      await salvarOuAtualizarLancamentoFinanceiroApi({
        ...transacaoUi,
        descricaoDetalhada: novaDesc,
        categoria: novaDesc,
        eq: num,
      });
      setContaCorrenteListaApiTick((t) => t + 1);
    }
    setCcVinculoTick((t) => t + 1);
  }

  async function handlePapelContaCorrenteLinha(chave, papel, transacaoUi) {
    const procEf = contaCorrenteModo === 'proc0' ? 0 : processo;
    setCcSalvandoPapel(true);
    try {
      gravarPapelManualProcesso(codigoCliente, procEf, chave, papel);
      if (featureFlags.useApiFinanceiro && transacaoUi?.apiId) {
        const comVinc = aplicarNumeroVinculoDescricao(
          aplicarTagPapelDescricao(transacaoUi.descricaoDetalhada, papel),
          transacaoUi.numeroVinculo,
        );
        await salvarOuAtualizarLancamentoFinanceiroApi({
          ...transacaoUi,
          descricaoDetalhada: comVinc,
          categoria: comVinc,
        });
        setContaCorrenteListaApiTick((t) => t + 1);
      }
      setCcVinculoTick((t) => t + 1);
    } catch {
      /* mantém classificação local */
    } finally {
      setCcSalvandoPapel(false);
    }
  }

  async function handleCcParDoisCliques(linha, transacoesFonte) {
    const ch = linha.chave;
    const procEf = contaCorrenteModo === 'proc0' ? 0 : processo;
    const mapa = new Map((transacoesFonte || []).map((t) => [t.chave, t]));
    if (!ccPendenteChave) {
      setCcPendenteChave(ch);
      return;
    }
    if (ccPendenteChave === ch) {
      setCcPendenteChave(null);
      return;
    }
    const num = proximoNumeroVinculoProcesso(codigoCliente, procEf, transacoesFonte);
    setCcSalvandoPapel(true);
    try {
      await persistirNumeroVinculoLinha(ccPendenteChave, num, mapa.get(ccPendenteChave));
      await persistirNumeroVinculoLinha(ch, num, mapa.get(ch));
      setCcPendenteChave(null);
    } catch {
      /* mantém local */
    } finally {
      setCcSalvandoPapel(false);
    }
  }

  async function handleVincularParSugeridoCc(par, transacoesFonte) {
    const procEf = contaCorrenteModo === 'proc0' ? 0 : processo;
    const num = proximoNumeroVinculoProcesso(codigoCliente, procEf, transacoesFonte);
    setCcSalvandoPapel(true);
    try {
      await persistirNumeroVinculoLinha(par.entrada.chave, num, par.entrada);
      await persistirNumeroVinculoLinha(par.pagamento.chave, num, par.pagamento);
    } finally {
      setCcSalvandoPapel(false);
    }
  }

  async function handleVincularTodosParesSugeridosCc(pares, transacoesFonte) {
    const procEf = contaCorrenteModo === 'proc0' ? 0 : processo;
    let fonte = transacoesFonte || [];
    setCcSalvandoPapel(true);
    try {
      for (const par of pares) {
        const num = proximoNumeroVinculoProcesso(codigoCliente, procEf, fonte);
        await persistirNumeroVinculoLinha(par.entrada.chave, num, par.entrada);
        await persistirNumeroVinculoLinha(par.pagamento.chave, num, par.pagamento);
        fonte = fonte.map((t) => {
          if (t.chave === par.entrada.chave || t.chave === par.pagamento.chave) {
            return { ...t, numeroVinculo: num, eq: num };
          }
          return t;
        });
      }
      setCcVinculoTick((t) => t + 1);
      setContaCorrenteListaApiTick((t) => t + 1);
    } finally {
      setCcSalvandoPapel(false);
    }
  }

  async function handleExcluirLancamentoContaCorrente(linha) {
    const ui =
      linha.transacaoUi ??
      (linha.nomeBanco && linha.numero != null && linha.data
        ? {
            nomeBanco: linha.nomeBanco,
            numero: String(linha.numero),
            data: linha.data,
            valor: linha.valor,
            descricao: linha.descricao,
            descricaoDetalhada: linha.descricaoDetalhada,
            letra: linha.letra,
            apiId: linha.apiId ?? null,
            codCliente: '',
            proc: '',
            _financeiroMeta: linha._financeiroMeta ?? null,
          }
        : null);
    if (!ui) {
      setCcMensagem('Não foi possível identificar o lançamento para excluir.');
      return;
    }
    const ok = window.confirm(
      'Remover este lançamento da Conta Corrente deste processo?\n\nO código de cliente e o nº de processo serão apagados no Financeiro. O lançamento continua no extrato.',
    );
    if (!ok) return;
    setCcSalvandoPapel(true);
    setCcMensagem('');
    try {
      if (featureFlags.useApiFinanceiro && Number(ui.apiId) > 0) {
        const r = await desvincularLancamentoClienteProcesso(ui);
        if (!r.ok) {
          setCcMensagem(r.message || 'Falha ao desvincular na API.');
          return;
        }
      } else {
        const r = desvincularLancamentoClienteProcessoLocal({
          nomeBanco: ui.nomeBanco ?? linha.nomeBanco,
          numero: ui.numero ?? linha.numero,
          data: ui.data ?? linha.data,
        });
        if (!r.ok) {
          setCcMensagem(r.message || 'Lançamento não encontrado no extrato local.');
          return;
        }
        window.dispatchEvent(new CustomEvent(EVENT_FINANCEIRO_PERSISTENCIA_EXTERNA));
      }
      setCcSelecionados((prev) => {
        const next = new Set(prev);
        next.delete(linha.chave);
        return next;
      });
      setContaCorrenteListaApiTick((t) => t + 1);
      setCcVinculoTick((t) => t + 1);
      setCcMensagem('Lançamento removido da Conta Corrente (código e processo apagados).');
    } catch (e) {
      setCcMensagem(e?.message || 'Falha ao excluir vínculo do lançamento.');
    } finally {
      setCcSalvandoPapel(false);
    }
  }

  async function handleAtribuirNumeroVinculoCc(transacoesFonte) {
    const procEf = contaCorrenteModo === 'proc0' ? 0 : processo;
    const chaves = [...ccSelecionados];
    if (chaves.length < 2) return;
    const num =
      normalizarNumeroVinculo(ccNumeroVinculoInput) ||
      proximoNumeroVinculoProcesso(codigoCliente, procEf, transacoesFonte);
    setCcSalvandoPapel(true);
    try {
      const mapaChave = new Map((transacoesFonte || []).map((t) => [t.chave, t]));
      for (const ch of chaves) {
        await persistirNumeroVinculoLinha(ch, num, mapaChave.get(ch));
      }
      setCcSelecionados(new Set());
      setCcNumeroVinculoInput('');
    } catch {
      /* mantém vínculo local */
    } finally {
      setCcSalvandoPapel(false);
    }
  }

  function normalizarTextoBusca(s) {
    return String(s ?? '')
      .toLocaleLowerCase('pt-BR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  const mergeVinculoPessoasNoCache = useCallback((lista) => {
    if (!lista?.length) return;
    setPessoasVinculoCache((prev) => {
      const next = { ...prev };
      for (const p of lista) {
        const id = Number(p.id);
        if (!Number.isFinite(id) || id < 1) continue;
        const nome = String(p.nome ?? '').trim();
        const cpf = p.cpf != null ? String(p.cpf) : '';
        const old = next[id];
        next[id] = {
          id,
          nome: nome || old?.nome || '',
          cpf: cpf || old?.cpf || '',
        };
      }
      return next;
    });
  }, []);

  const idsNecessariosVinculo = useMemo(() => {
    const s = new Set();
    const addLinhas = (arr) => {
      for (const e of arr || []) {
        const pid = Number(e.pessoaId);
        if (Number.isFinite(pid) && pid > 0) s.add(pid);
        for (const a of e.advogadoPessoaIds || []) {
          const aid = Number(a);
          if (Number.isFinite(aid) && aid > 0) s.add(aid);
        }
      }
    };
    addLinhas(parteClienteEntradas);
    addLinhas(parteOpostaEntradas);
    if (modalVinculoPartes) addLinhas(linhasModalPartes);
    return [...s];
  }, [parteClienteEntradas, parteOpostaEntradas, modalVinculoPartes, linhasModalPartes]);

  const idsVinculoResolveKey = useMemo(
    () => [...idsNecessariosVinculo].sort((a, b) => a - b).join(','),
    [idsNecessariosVinculo]
  );

  pessoasVinculoCacheRef.current = pessoasVinculoCache;

  useEffect(() => {
    if (modalVinculoPartes) return undefined;
    setPessoasBuscaVinculoResultados([]);
    setBuscaVinculoPessoasEmAndamento(false);
    return undefined;
  }, [modalVinculoPartes]);

  useEffect(() => {
    if (!idsVinculoResolveKey) return undefined;
    const faltando = idsNecessariosVinculo.filter((id) => pessoasVinculoCacheRef.current[id] === undefined);
    if (!faltando.length) return undefined;
    let cancelled = false;
    void (async () => {
      const resolved = await Promise.all(
        faltando.map(async (id) => {
          const p = await obterPessoaParaVinculoUsuario(id);
          return p
            ? { id: Number(p.id), nome: String(p.nome ?? '').trim(), cpf: String(p.cpf ?? '') }
            : { id, nome: '', cpf: '' };
        })
      );
      if (cancelled) return;
      mergeVinculoPessoasNoCache(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, [idsVinculoResolveKey, idsNecessariosVinculo, mergeVinculoPessoasNoCache]);

  useEffect(() => {
    if (!modalVinculoPartes) return undefined;
    const raw = String(buscaPessoaVinculo ?? '').trim();
    const digitos = raw.replace(/\D/g, '');
    const temLetras = /[a-zA-ZÀ-ÿ\u00C0-\u024F]/.test(raw);
    if (!raw) {
      setPessoasBuscaVinculoResultados([]);
      setBuscaVinculoPessoasEmAndamento(false);
      return undefined;
    }
    if (temLetras && raw.length < 2) {
      setPessoasBuscaVinculoResultados([]);
      setBuscaVinculoPessoasEmAndamento(false);
      return undefined;
    }
    if (!temLetras && digitos.length < 3) {
      setPessoasBuscaVinculoResultados([]);
      setBuscaVinculoPessoasEmAndamento(false);
      return undefined;
    }
    setBuscaVinculoPessoasEmAndamento(true);
    const seq = ++buscaVinculoSeqRef.current;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const lista = await pesquisarPessoasParaVinculoUsuario(raw, 200);
          if (seq !== buscaVinculoSeqRef.current) return;
          mergeVinculoPessoasNoCache(lista);
          setPessoasBuscaVinculoResultados(Array.isArray(lista) ? lista : []);
        } catch {
          if (seq !== buscaVinculoSeqRef.current) return;
          setPessoasBuscaVinculoResultados([]);
        } finally {
          if (seq === buscaVinculoSeqRef.current) setBuscaVinculoPessoasEmAndamento(false);
        }
      })();
    }, 350);
    return () => window.clearTimeout(t);
  }, [buscaPessoaVinculo, modalVinculoPartes, mergeVinculoPessoasNoCache]);

  const pessoasPorId = useMemo(() => {
    const m = new Map();
    for (const p of Object.values(pessoasVinculoCache || {})) {
      if (p && Number.isFinite(Number(p.id))) m.set(Number(p.id), p);
    }
    return m;
  }, [pessoasVinculoCache]);

  /** Nomes completos na ordem das abas «Detalhes», separados por vírgula (read-only no frame). */
  const textoParteCliente = useMemo(() => {
    const linhas = parteClienteEntradas || [];
    if (!linhas.length) return parteCliente;
    const nomes = linhas
      .map((e) => {
        const pid = Number(e.pessoaId);
        const p = pessoasPorId.get(pid);
        const n = p?.nome != null ? String(p.nome).trim() : '';
        if (n) return n;
        if (Number.isFinite(pid) && pid > 0) return `Pessoa nº ${pid}`;
        return null;
      })
      .filter(Boolean);
    return nomes.length ? nomes.join(', ') : parteCliente;
  }, [parteClienteEntradas, pessoasPorId, parteCliente]);

  const textoParteOposta = useMemo(() => {
    const linhas = parteOpostaEntradas || [];
    if (!linhas.length) return parteOposta;
    const nomes = linhas
      .map((e) => {
        const pid = Number(e.pessoaId);
        const p = pessoasPorId.get(pid);
        const n = p?.nome != null ? String(p.nome).trim() : '';
        if (n) return n;
        if (Number.isFinite(pid) && pid > 0) return `Pessoa nº ${pid}`;
        return null;
      })
      .filter(Boolean);
    return nomes.length ? nomes.join(', ') : parteOposta;
  }, [parteOpostaEntradas, pessoasPorId, parteOposta]);

  const podeGerarDocumento =
    featureFlags.useApiProcessos &&
    (Number(processoApiId) > 0 || String(numeroProcessoNovo ?? '').trim() !== '');

  const deveConsultarDrive =
    featureFlags.useApiProcessos &&
    (Number(processoApiId) > 0 ||
      (String(codigoCliente ?? '').trim() !== '' && Number.isFinite(Number(processo))));

  useEffect(() => {
    if (!deveConsultarDrive) {
      setDriveConfigurado(false);
      return;
    }
    let cancelado = false;
    obterStatusDrive()
      .then((ok) => {
        if (!cancelado) setDriveConfigurado(ok);
      })
      .catch(() => {
        if (!cancelado) setDriveConfigurado(false);
      });
    return () => {
      cancelado = true;
    };
  }, [deveConsultarDrive]);

  const handleGerarDocumento = useCallback(async () => {
    if (!podeGerarDocumento || gerandoDocNav) return;
    setGerandoDocNav(true);
    setApiError('');
    try {
      const dadosProcesso = await montarDadosParaDocumentoFromProcesso({
        processoApiId,
        codigoCliente,
        processo,
        numeroInterno: processo,
        numeroProcessoNovo,
        numeroProcessoVelho,
        naturezaAcao,
        competencia,
        orgaoJulgador: orgaoJulgadorSelecionado?.orgaoJulgador ?? null,
        valorCausa,
        cidade,
        estado,
        observacao,
        papelParte,
        textoParteCliente,
        textoParteOposta,
        parteCliente,
        parteOposta,
        pessoasVinculoCache,
      });
      navigate('/documentos/gerar', { state: { dadosProcesso } });
    } catch (e) {
      setApiError(e?.message || 'Falha ao preparar dados para gerar documento.');
    } finally {
      setGerandoDocNav(false);
    }
  }, [
    podeGerarDocumento,
    gerandoDocNav,
    processoApiId,
    codigoCliente,
    processo,
    numeroProcessoNovo,
    numeroProcessoVelho,
    naturezaAcao,
    competencia,
    orgaoJulgadorSelecionado,
    valorCausa,
    cidade,
    estado,
    observacao,
    papelParte,
    textoParteCliente,
    textoParteOposta,
    parteCliente,
    parteOposta,
    pessoasVinculoCache,
    navigate,
  ]);

  const handleAbrirGerarContratoHonorarios = useCallback(async () => {
    if (!podeGerarDocumento || gerandoDocNav) return;
    setGerandoDocNav(true);
    setApiError('');
    try {
      const dadosProcesso = await montarDadosParaDocumentoFromProcesso({
        processoApiId,
        codigoCliente,
        processo,
        numeroInterno: processo,
        numeroProcessoNovo,
        numeroProcessoVelho,
        naturezaAcao,
        competencia,
        orgaoJulgador: orgaoJulgadorSelecionado?.orgaoJulgador ?? null,
        valorCausa,
        cidade,
        estado,
        observacao,
        papelParte,
        textoParteCliente,
        textoParteOposta,
        parteCliente,
        parteOposta,
        pessoasVinculoCache,
      });
      navigate('/documentos/gerar', { state: { dadosProcesso, modoInicial: 'contrato' } });
    } catch (e) {
      setApiError(e?.message || 'Falha ao preparar dados para gerar contrato.');
    } finally {
      setGerandoDocNav(false);
    }
  }, [
    podeGerarDocumento,
    gerandoDocNav,
    processoApiId,
    codigoCliente,
    processo,
    numeroProcessoNovo,
    numeroProcessoVelho,
    naturezaAcao,
    competencia,
    orgaoJulgadorSelecionado,
    valorCausa,
    cidade,
    estado,
    observacao,
    papelParte,
    textoParteCliente,
    textoParteOposta,
    parteCliente,
    parteOposta,
    pessoasVinculoCache,
    navigate,
  ]);

  const handleDistribuirInicialProjudi = useCallback(async () => {
    if (!podeGerarDocumento || gerandoDistribuicaoInicial) return;
    setGerandoDistribuicaoInicial(true);
    setApiError('');
    try {
      const dadosDistribuicaoInicial = await montarDadosDistribuicaoInicialFromProcesso({
        processoApiId,
        codigoCliente,
        processo,
        valorCausa,
        naturezaAcao,
        papelParte,
        textoParteCliente,
        textoParteOposta,
        parteCliente,
        parteOposta,
        parteClienteEntradas,
        parteOpostaEntradas,
        pessoasPorId,
      });
      if (!dadosDistribuicaoInicial.pessoaAutor?.id || !dadosDistribuicaoInicial.pessoaReu?.id) {
        setApiError(
          'Informe autor e réu com pessoa cadastrada (partes do processo) antes de distribuir a inicial.',
        );
        return;
      }
      navigate('/processos/distribuicao-inicial-projudi', { state: { dadosDistribuicaoInicial } });
    } catch (e) {
      setApiError(e?.message || 'Falha ao preparar distribuição inicial PROJUDI.');
    } finally {
      setGerandoDistribuicaoInicial(false);
    }
  }, [
    podeGerarDocumento,
    gerandoDistribuicaoInicial,
    processoApiId,
    codigoCliente,
    processo,
    valorCausa,
    naturezaAcao,
    papelParte,
    textoParteCliente,
    textoParteOposta,
    parteCliente,
    parteOposta,
    parteClienteEntradas,
    parteOpostaEntradas,
    pessoasPorId,
    navigate,
  ]);

  const handleGerarProcuracao = useCallback(async () => {
    if (!podeGerarDocumento || gerandoProcuracao) return;
    const entrada = (parteClienteEntradas || []).find((e) => Number(e?.pessoaId) > 0);
    const pessoaId = entrada ? Number(entrada.pessoaId) : null;
    if (!pessoaId) {
      setApiError('Nenhuma parte cliente com pessoa cadastrada encontrada neste processo.');
      return;
    }
    const pid = Number(entrada.pessoaId);
    const pessoa = pessoasPorId.get(pid);
    const nomeArquivo = nomeArquivoProcuracaoPdf(pessoa?.nome || textoParteCliente);
    setGerandoProcuracao(true);
    setApiError('');
    try {
      const blob = await gerarProcuracao({ pessoaId });
      downloadPdfBlob(blob, nomeArquivo);
    } catch (e) {
      setApiError(e?.message || 'Falha ao gerar procuração.');
    } finally {
      setGerandoProcuracao(false);
    }
  }, [
    podeGerarDocumento,
    gerandoProcuracao,
    parteClienteEntradas,
    pessoasPorId,
    textoParteCliente,
  ]);

  const handleBaixarAutosIntegral = useCallback(async () => {
    const cnj = String(numeroProcessoNovo ?? '').trim();
    if (!cnj || baixandoAutosIntegral) return;
    setBaixandoAutosIntegral(true);
    setApiError('');
    try {
      const { avisos } = await baixarAutosIntegralProcesso(cnj);
      if (avisos) {
        showProcessoToast(`Autos integral baixado com avisos: ${avisos}`, 'warning');
      }
    } catch (e) {
      setApiError(e?.message || 'Falha ao baixar autos integral.');
    } finally {
      setBaixandoAutosIntegral(false);
    }
  }, [numeroProcessoNovo, baixandoAutosIntegral, showProcessoToast]);

  const tramitacaoNorm = useMemo(() => {
    const t = String(tramitacao ?? '').trim();
    if (!t) return null;
    const lower = t.toLowerCase();
    if (t === 'Projudi' || lower === 'projudi') return 'Projudi';
    if (t === 'PJe' || lower === 'pje') return 'PJe';
    if (t === 'TJ Go - Autos Físicos' || lower === 'tj go - autos fisicos') return 'TJ Go - Autos Físicos';
    return t;
  }, [tramitacao]);

  const tramitacaoBloqueiaObterMovimentacoes = tramitacaoNorm === 'TJ Go - Autos Físicos';

  const cnjProcessoAtual = useMemo(
    () => String(numeroProcessoNovo ?? '').trim(),
    [numeroProcessoNovo]
  );
  const processoCnjTrt18 = useMemo(() => cnjEhTrt18(cnjProcessoAtual), [cnjProcessoAtual]);
  const pjeTribunalNorm = String(pjeTribunal ?? '').trim();
  const pjeAutomacaoTrt18 =
    tribunalPjeAutomacaoDisponivel(pjeTribunalNorm) ||
    (!pjeTribunalNorm && processoCnjTrt18);
  const obterMovimentacoesViaPje =
    tramitacaoNorm === 'PJe' || (!tramitacaoNorm && processoCnjTrt18);

  /** Atualiza «Data do Protocolo» na UI assim que o backend sincroniza (formulário aberto). */
  const aplicarDataProtocoloObterMovimentacoesNaUi = useCallback(
    async (respostaObterMovimentacoes) => {
      let dataProtocoloBr = dataProtocoloApiParaCampoBr(respostaObterMovimentacoes?.dataProtocolo);
      const syncMsg = mensagemIndicaDataProtocoloSincronizada(respostaObterMovimentacoes?.mensagem);

      if (!dataProtocoloBr && syncMsg && featureFlags.useApiProcessos) {
        try {
          const procApi = await buscarProcessoPorChaveNatural(codigoCliente, processo);
          if (procApi) {
            dataProtocoloBr = mapApiProcessoToUiShape(procApi).dataProtocolo ?? '';
          }
        } catch {
          /* mantém vazio; toast da operação principal já informa */
        }
      }

      if (!dataProtocoloBr) return false;

      flushSync(() => {
        setDataProtocolo(dataProtocoloBr);
      });
      salvarHistoricoDoProcesso(
        montarPayloadRegistroProcesso({ dataProtocolo: dataProtocoloBr }),
      );
      return true;
    },
    [codigoCliente, processo],
  );

  const aguardarResultadoPjeCopiaIntegral = useCallback(
    async (processoId) => {
      const maxTentativas = 40;
      for (let i = 0; i < maxTentativas; i += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 15_000));
        try {
          const st = await consultarStatusPjeCopiaIntegral(processoId);
          const fase = String(st?.fase ?? '').toUpperCase();
          if (fase === 'EM_ANDAMENTO' || fase === 'NENHUM') {
            continue;
          }
          if (fase === 'SUCESSO') {
            showProcessoToast(
              String(st?.mensagem ?? '').trim()
                || 'Cópia integral salva na subpasta Movimentações do Drive.',
            );
            return;
          }
          if (fase === 'FALHA') {
            showProcessoToast(
              String(st?.mensagem ?? '').trim() || 'Falha na cópia integral PJe TRT18.',
              'error',
            );
            return;
          }
        } catch {
          /* polling silencioso */
        }
      }
      showProcessoToast(
        'PJe ainda em execução ou sem resposta — confira a subpasta Movimentações no Drive em alguns minutos.',
        'warning',
      );
    },
    [showProcessoToast],
  );

  const executarObterMovimentacoesDrive = useCallback(async () => {
    const id = Number(processoApiId);
    if (!id || buscandoMovimentacoes) return;
    setBuscandoMovimentacoes(true);
    setApiError('');
    try {
      const r = await obterMovimentacoesDrive(id);
      await aplicarDataProtocoloObterMovimentacoesNaUi(r);
      if (r?.erro) {
        showProcessoToast(String(r.mensagem ?? r.erro), 'error');
        return;
      }
      const status = String(r?.status ?? '').toUpperCase();
      if (status === 'SEM_SISTEMA') {
        showProcessoToast(
          String(r?.mensagem ?? '').trim()
            || 'Sem sistema digital para consulta automática; defina a tramitação (Projudi ou PJe).',
          'error',
        );
        return;
      }
      if (status === 'INICIADO') {
        showProcessoToast(
          String(r?.mensagem ?? '').trim()
            || 'PJe TRT18 em execução — aguarde; o PDF irá para a subpasta Movimentações.',
        );
        void aguardarResultadoPjeCopiaIntegral(id);
        return;
      }
      if (status === 'PJE_AUTOMACAO_INDISPONIVEL') {
        showProcessoToast(
          String(r?.mensagem ?? r?.erro ?? '').trim()
            || 'Automação de cópia integral indisponível para este tribunal.',
          'error',
        );
        return;
      }
      const baixados = Number(r?.arquivosBaixados ?? 0);
      const msg = String(r?.mensagem ?? '').trim();
      if (msg) {
        showProcessoToast(msg);
      } else if (baixados > 0) {
        showProcessoToast(`${baixados} arquivo(s) enviado(s) ao Drive.`);
      } else {
        showProcessoToast('Consulta concluída; nenhum arquivo novo enviado.');
      }
    } catch (e) {
      showProcessoToast(e?.message || 'Falha ao obter movimentações.', 'error');
    } finally {
      setBuscandoMovimentacoes(false);
    }
  }, [
    processoApiId,
    buscandoMovimentacoes,
    showProcessoToast,
    aplicarDataProtocoloObterMovimentacoesNaUi,
    aguardarResultadoPjeCopiaIntegral,
  ]);

  const handleObterMovimentacoes = useCallback(async () => {
    const id = Number(processoApiId);
    if (!id || buscandoMovimentacoes) return;
    const cnj = String(numeroProcessoNovo ?? '').trim();
    if (!cnj) {
      showProcessoToast('Informe o número CNJ do processo.', 'error');
      return;
    }
    if (tramitacaoBloqueiaObterMovimentacoes) {
      return;
    }
    if (!tramitacaoNorm && !processoCnjTrt18) {
      abrirModalTramitacao({ aposObterMovimentacoes: true });
      return;
    }
    await executarObterMovimentacoesDrive();
  }, [
    processoApiId,
    numeroProcessoNovo,
    buscandoMovimentacoes,
    tramitacaoNorm,
    processoCnjTrt18,
    tramitacaoBloqueiaObterMovimentacoes,
    executarObterMovimentacoesDrive,
    showProcessoToast,
  ]);

  /** Snapshot completo do formulário para `localStorage` (processo × cliente). */
  function montarPayloadRegistroProcesso(overrides = {}) {
    const pf = String((overrides.prazoFatal ?? prazoFatal) ?? '').trim();
    const prazoNorm =
      pf && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(pf) ? normalizarDataBr(pf) || '' : '';
    return {
      codCliente: codigoCliente,
      proc: processo,
      cliente,
      parteCliente: textoParteCliente || parteCliente,
      parteOposta: textoParteOposta || parteOposta,
      numeroProcessoNovo,
      numeroProcessoVelho,
      historico,
      prazoFatal: prazoNorm,
      parteClienteEntradas: clonarLinhasParteProcesso(parteClienteEntradas),
      parteOpostaEntradas: clonarLinhasParteProcesso(parteOpostaEntradas),
      parteClienteIds,
      parteOpostaIds,
      faseSelecionada,
      periodicidadeConsulta,
      tramitacao,
      pjeTribunal: pjeTribunal || null,
      pjeGrau: pjeGrau || null,
      naturezaAcao,
      consultaAutomatica,
      estado,
      cidade,
      municipioId:
        municipioSelecionado?.municipioId ?? orgaoJulgadorSelecionado?.orgaoJulgador?.municipio?.id ?? null,
      orgaoJulgadorId: varaADistribuir ? null : (orgaoJulgadorSelecionado?.orgaoJulgadorId ?? null),
      dataProtocolo,
      pasta,
      pastaArquivo: String(pasta ?? ''),
      valorCausa,
      responsavel,
      usuarioResponsavelId:
        usuarioResponsavelId != null && String(usuarioResponsavelId).trim() !== ''
          ? Number(usuarioResponsavelId)
          : null,
      competencia,
      observacao,
      papelParte,
      statusAtivo,
      faseCampo,
      audienciaData,
      audienciaHora,
      audienciaTipo: normalizarTipoAudienciaCanonico(audienciaTipo),
      avisoAudiencia,
      imovelId: String(imovelId ?? ''),
      unidade: String(unidadeEndereco ?? ''),
      unidadeEndereco: String(unidadeEndereco ?? ''),
      proximaInformacao,
      dataProximaInformacao,
      ...overrides,
    };
  }

  /** Aplica resposta de GET /partes: entradas, rótulos e cache de nomes (mantém UI alinhada ao servidor). */
  function aplicarListaPartesApiNaUi(partes, papelParteAtual = papelParte) {
    const entradasCliente = [];
    const entradasOposta = [];
    const nomesCliente = [];
    const nomesOposta = [];
    const cacheNomesPartes = [];
    for (const p of partes || []) {
      const alvoCliente = parteApiEhLadoCliente(p, papelParteAtual, partes);
      const nomeApi = String(p.nomeExibicao || p.nomeLivre || '').trim();
      const adv = Array.isArray(p.advogadoPessoaIds)
        ? p.advogadoPessoaIds.map(Number).filter((x) => Number.isFinite(x) && x > 0)
        : [];
      const pessoaNum = Number(p.pessoaId);
      const temPessoa = Number.isFinite(pessoaNum) && pessoaNum > 0;
      // Rótulo para cache e campos read-only: sem nome na API o useMemo textoParte* só olha pessoasVinculoCache — ficava vazio com IDs válidos.
      const rotulo = nomeApi || (temPessoa ? `Pessoa nº ${pessoaNum}` : '');
      if (temPessoa && rotulo) {
        cacheNomesPartes.push({ id: pessoaNum, nome: rotulo, cpf: '' });
      }
      if (alvoCliente && temPessoa) {
        entradasCliente.push({ pessoaId: pessoaNum, advogadoPessoaIds: adv });
        if (rotulo) nomesCliente.push(rotulo);
      }
      if (!alvoCliente && temPessoa) {
        entradasOposta.push({ pessoaId: pessoaNum, advogadoPessoaIds: adv });
        if (rotulo) nomesOposta.push(rotulo);
      }
    }
    if (cacheNomesPartes.length) {
      setPessoasVinculoCache((prev) => {
        const next = { ...prev };
        for (const row of cacheNomesPartes) {
          const id = Number(row.id);
          if (!Number.isFinite(id) || id < 1) continue;
          const incoming = String(row.nome || '').trim();
          const anterior = next[id];
          next[id] = {
            id,
            nome: incoming || anterior?.nome || '',
            cpf: String(row.cpf ?? anterior?.cpf ?? ''),
          };
        }
        return next;
      });
    }
    setParteClienteEntradas(clonarLinhasParteProcesso(entradasCliente));
    setParteOpostaEntradas(clonarLinhasParteProcesso(entradasOposta));
    setParteCliente(nomesCliente.length ? formatarListaComConjuncaoE(nomesCliente) : '');
    setParteOposta(nomesOposta.length ? formatarListaComConjuncaoE(nomesOposta) : '');
  }

  /** Processo sem linha na API: formulário como novo (sem reaproveitar cabeçalho/histórico do proc. anterior). */
  function aplicarCabecalhoVazioProcessoNaoCadastradoApi() {
    setProcessoApiId(null);
    processoApiIdRef.current = null;
    setClienteProcessoApiId(null);
    setParteClienteEntradas([]);
    setParteOpostaEntradas([]);
    setParteCliente('');
    setParteOposta('');
    setNumeroProcessoNovo('');
    setNumeroProcessoVelho('');
    setNaturezaAcao('');
    setCompetencia('');
    setFaseSelecionada('');
    setStatusAtivo(true);
    setPrazoFatal('');
    setObservacao('');
    setDataProtocolo('');
    setEstado('');
    setCidade('');
    setMunicipioSelecionado(null);
    setOrgaoJulgadorSelecionado(null);
    // Processo novo (sem número, sem vara) → "a distribuir" por padrão.
    setVaraADistribuir(true);
    setConsultaAutomatica(false);
    setTramitacao('');
    setPjeTribunal('');
    setPjeGrau('');
    setResponsavel('');
    setUsuarioResponsavelId('');
    setValorCausa('');
    setHistorico([]);
    setPeriodicidadeConsulta('');
    setPasta('');
    setFaseCampo('');
    setAudienciaData('');
    setAudienciaHora('');
    setAudienciaTipo('');
    setAvisoAudiencia('nao_avisado');
    setProximaInformacao('');
    setDataProximaInformacao('');
    setPapelParte('requerente');
    setImovelId('');
    setUnidadeEndereco('');
    setInformacaoModal(null);
    setPaginaHistorico(1);
  }

  async function carregarHistoricoApi(processoId, seq) {
    if (!featureFlags.useApiProcessos || !Number(processoId)) return;
    const carga = ++historicoApiCargaSeqRef.current;
    setHistoricoApiCarregando(true);
    try {
      const andamentos = await listarAndamentosProcesso(processoId);
      if (seq !== carregarProcessoApiSeqRef.current) return;
      if (Number(processoId) !== Number(processoApiIdRef.current)) return;

      if (!Array.isArray(andamentos)) {
        setHistorico([]);
        setPaginaHistorico(1);
        setApiError(
          typeof andamentos?.message === 'string' && andamentos.message
            ? andamentos.message
            : 'Histórico: resposta inválida da API (não é uma lista). Verifique GET /api/processos/…/andamentos na rede.'
        );
      } else if (andamentos.length > 0) {
        const hist = andamentos.map((a, idx) => mapApiAndamentoToHistoricoItem(a, idx, andamentos.length));
        setHistorico(hist);
        setPaginaHistorico(1);
      } else {
        /** Com API: lista vazia = sem andamentos na base (não reidratar localStorage — evita histórico de outro processo). */
        setHistorico([]);
        setPaginaHistorico(1);
      }
      historicoCarregadoParaProcessoRef.current = processoId;
    } catch (e) {
      if (seq !== carregarProcessoApiSeqRef.current) return;
      if (Number(processoId) !== Number(processoApiIdRef.current)) return;
      setApiError(e?.message || 'Falha ao carregar histórico da API.');
    } finally {
      if (seq === carregarProcessoApiSeqRef.current && carga === historicoApiCargaSeqRef.current) {
        setHistoricoApiCarregando(false);
      }
    }
  }
  carregarHistoricoApiRef.current = carregarHistoricoApi;

  async function carregarProcessoApiAtual() {
    if (!featureFlags.useApiProcessos) return;
    const seq = ++carregarProcessoApiSeqRef.current;
    historicoCarregadoParaProcessoRef.current = null;
    setHistorico([]);
    setHistoricoApiCarregando(false);
    setApiError('');
    try {
      setParteClienteEntradas([]);
      setParteOpostaEntradas([]);
      setParteCliente('');
      setParteOposta('');
      const navIntent = isEmbedded ? null : resolverIntentNavegacaoProcessosDeRota(location);
      let procApi = await buscarProcessoPorChaveNatural(codigoCliente, processo);
      if (navIntent?.processoApiId) {
        const esperado = Number(navIntent.processoApiId);
        if (!procApi || Number(procApi.id) !== esperado) {
          const byId = await buscarProcessoPorId(esperado);
          if (byId) {
            procApi = byId;
            const codApi = byId.codigoCliente ?? byId.codigo_cliente;
            const niApi = byId.numeroInterno ?? byId.numero_interno;
            if (codApi) setCodigoCliente(padCliente(codApi));
            if (niApi != null && Number.isFinite(Number(niApi))) {
              setProcesso(Math.max(1, Math.floor(Number(niApi))));
            }
          }
        }
      }
      if (seq !== carregarProcessoApiSeqRef.current) return;
      if (!procApi) {
        setProcessoApiId(null);
        processoApiIdRef.current = null;
        setClienteProcessoApiId(null);
        setParteClienteEntradas([]);
        setParteOpostaEntradas([]);
        setParteCliente('');
        setParteOposta('');
        aplicarCabecalhoVazioProcessoNaoCadastradoApi();
        return;
      }
      setProcessoApiId(procApi.id);
      processoApiIdRef.current = Number(procApi.id);
      const mapped = mapApiProcessoToUiShape(procApi);
      setClienteProcessoApiId(
        mapped.clienteIdNativo != null && Number.isFinite(Number(mapped.clienteIdNativo))
          ? Number(mapped.clienteIdNativo)
          : mapped.clienteId != null && Number.isFinite(Number(mapped.clienteId))
            ? Number(mapped.clienteId)
            : null
      );
      setNumeroProcessoNovo(mapped.numeroProcessoNovo ?? '');
      setNumeroProcessoVelho(mapped.numeroProcessoVelho ?? '');
      setNaturezaAcao(mapped.naturezaAcao ?? '');
      setCompetencia(mapped.competencia ?? '');
      setFaseSelecionada(mapped.faseSelecionada ?? '');
      setStatusAtivo(mapped.statusAtivo);
      setPrazoFatal(mapped.prazoFatal ?? '');
      setObservacao(mapped.observacao ?? '');
      setDataProtocolo(mapped.dataProtocolo ?? '');
      setEstado(mapped.estado ?? '');
      setCidade(mapped.cidade ?? '');
      // Hidrata cidade/comarca e vara selecionadas; sem isso o auto-save zeraria municipio/orgao ao editar.
      const midApi = mapped.municipioId ?? mapped.municipio?.id ?? null;
      setMunicipioSelecionado(
        midApi
          ? {
              municipioId: midApi,
              municipio:
                mapped.municipio || { id: midApi, nome: mapped.cidade || '', uf: mapped.estado || '' },
            }
          : null,
      );
      const oidApi = mapped.orgaoJulgadorId ?? mapped.orgaoJulgador?.id ?? null;
      setOrgaoJulgadorSelecionado(
        oidApi
          ? {
              orgaoJulgadorId: oidApi,
              orgaoJulgador: mapped.orgaoJulgador || { id: oidApi, nome: mapped.orgaoJulgador?.nome },
            }
          : null,
      );
      // Default "a distribuir": sem número e sem vara → checkbox marcada (sobrescrevível); com vara → desmarcada.
      setVaraADistribuir(!oidApi && String(mapped.numeroProcessoNovo ?? '').trim() === '');
      setConsultaAutomatica(mapped.consultaAutomatica);
      setTramitacao(mapped.tramitacao ?? '');
      setPjeTribunal(mapped.pjeTribunal ?? '');
      setPjeGrau(mapped.pjeGrau ?? '');
      setFaseCampo(mapped.observacaoFase ?? '');
      setResponsavel(mapped.responsavel ?? '');
      const fkApi =
        mapped.usuarioResponsavelId != null &&
        Number.isFinite(Number(mapped.usuarioResponsavelId)) &&
        Number(mapped.usuarioResponsavelId) > 0
          ? String(mapped.usuarioResponsavelId)
          : resolverUsuarioIdPorConsultorLegado(mapped.responsavel, colaboradoresResponsavel);
      setUsuarioResponsavelId(fkApi);
      setUnidadeEndereco(mapped.unidade ?? '');
      setUnidadeEnderecoManual(String(mapped.unidade ?? '').trim() !== '');
      setPasta(mapped.pasta ?? '');
      setValorCausa(mapped.valorCausa ?? '');
      const papelCarregado = mapped.papelParte ?? 'requerente';
      setPapelParte(papelCarregado);
      setAudienciaData(mapped.audienciaData ?? '');
      setAudienciaHora(mapped.audienciaHora ?? '');
      setAudienciaTipo(normalizarTipoAudienciaCanonico(mapped.audienciaTipo ?? ''));
      setAvisoAudiencia(mapped.avisoAudiencia ?? 'nao_avisado');

      const partes = await listarPartesProcesso(procApi.id);
      if (seq !== carregarProcessoApiSeqRef.current) return;
      aplicarListaPartesApiNaUi(partes, papelCarregado);
      await carregarHistoricoApi(procApi.id, seq);

      if (featureFlags.useApiImoveis) {
        const numImovel = await buscarNumeroImovelPorVinculo(codigoCliente, processo);
        if (seq === carregarProcessoApiSeqRef.current && numImovel) {
          setImovelId(numImovel);
          const cad = await carregarImovelCadastroPorNumeroPlanilha(numImovel);
          if (seq === carregarProcessoApiSeqRef.current) {
            const u = String(cad.item?.unidade ?? '').trim();
            const unidadeProcesso = String(mapped.unidade ?? '').trim();
            if (u && !unidadeProcesso) {
              setUnidadeEndereco(u);
            }
          }
        }
      }
    } catch (e) {
      if (seq !== carregarProcessoApiSeqRef.current) return;
      aplicarCabecalhoVazioProcessoNaoCadastradoApi();
      setApiError(e?.message || 'Falha ao carregar processo da API.');
    }
  }
  carregarProcessoApiAtualRef.current = carregarProcessoApiAtual;

  async function sincronizarApiProcessoAtual(
    overrides = {},
    options = {}
  ) {
    const opts = {
      syncPartes: false,
      syncAndamentos: false,
      syncPrazoFatal: true,
      /** Após gravar, busca de novo GET /partes para atualizar nomes na UI (cache + rótulos). */
      refetchPartesAfterSync: undefined,
      /** Ex.: salvamento do modal «Detalhes» (partes/advogados) com «Edição Desabilitada» ligada. */
      permitirComEdicaoDesabilitada: false,
      ...options,
    };
    const deveRefetchPartes =
      opts.refetchPartesAfterSync === true ||
      (opts.refetchPartesAfterSync !== false && opts.syncPartes);
    if (!featureFlags.useApiProcessos || (edicaoDesabilitada && !opts.permitirComEdicaoDesabilitada)) return;
    setApiSaving(true);
    setApiError('');
    try {
      let snapshot = montarPayloadRegistroProcesso(overrides);
      const clienteApi = await buscarClientePorCodigo(snapshot.codCliente);
      const clientePk =
        clienteApi?.clienteId != null
          ? Number(clienteApi.clienteId)
          : clienteApi?.id != null
            ? Number(clienteApi.id)
            : null;
      if (!Number.isFinite(clientePk) || clientePk < 1) {
        throw new Error('Cliente não encontrado na API para este código.');
      }
      const titularPartes =
        snapshot.parteClienteEntradas?.[0]?.pessoaId ?? snapshot.parteClienteIds?.[0] ?? null;
      const saved = await salvarCabecalhoProcesso({
        ...snapshot,
        processoId: processoApiId,
        clienteId: clientePk,
        pessoaTitularId:
          titularPartes != null && Number.isFinite(Number(titularPartes))
            ? Number(titularPartes)
            : null,
        numeroInterno: Number(snapshot.proc),
        valorCausaNumero: parseValorMonetarioBr(snapshot.valorCausa),
      });
      const pid = saved?.id || processoApiId;
      setProcessoApiId(pid);
      if (pid != null && Number.isFinite(Number(pid)) && Number(pid) > 0) {
        processoApiIdRef.current = Number(pid);
      } else {
        processoApiIdRef.current = null;
      }
      if (saved?.id && snapshot.statusAtivo !== undefined) {
        await alterarAtivoProcesso(saved.id, snapshot.statusAtivo !== false);
      }
      if (pid && opts.syncPartes) {
        const linhasCli =
          snapshot.parteClienteEntradas?.length > 0
            ? clonarLinhasParteProcesso(snapshot.parteClienteEntradas)
            : (snapshot.parteClienteIds || []).map((id) => ({
                pessoaId: Number(id),
                advogadoPessoaIds: [],
              }));
        const linhasOp =
          snapshot.parteOpostaEntradas?.length > 0
            ? clonarLinhasParteProcesso(snapshot.parteOpostaEntradas)
            : (snapshot.parteOpostaIds || []).map((id) => ({
                pessoaId: Number(id),
                advogadoPessoaIds: [],
              }));
        const poloCliente =
          snapshot.papelParte === 'requerido' ? 'REU' : 'AUTOR';
        const poloOposta =
          snapshot.papelParte === 'requerido' ? 'AUTOR' : 'REU';
        const qualCliente =
          snapshot.papelParte === 'requerido' ? 'Parte cliente (requerido)' : 'Parte cliente';
        const qualOposta =
          snapshot.papelParte === 'requerido' ? 'Parte oposta (requerente)' : 'Parte oposta';
        await sincronizarPartesIncremental(pid, [
          ...linhasCli.map((row, ordem) => ({
            pessoaId: Number(row.pessoaId),
            nomeLivre: null,
            polo: poloCliente,
            qualificacao: qualCliente,
            ordem,
            advogadoPessoaIds: row.advogadoPessoaIds || [],
          })),
          ...linhasOp.map((row, ordem) => ({
            pessoaId: Number(row.pessoaId),
            nomeLivre: null,
            polo: poloOposta,
            qualificacao: qualOposta,
            ordem,
            advogadoPessoaIds: row.advogadoPessoaIds || [],
          })),
          ...(linhasCli.length ? [] : [{
            pessoaId: null,
            nomeLivre: snapshot.parteCliente || null,
            polo: poloCliente,
            qualificacao: qualCliente,
            ordem: 0,
            advogadoPessoaIds: [],
          }]),
          ...(linhasOp.length ? [] : [{
            pessoaId: null,
            nomeLivre: snapshot.parteOposta || null,
            polo: poloOposta,
            qualificacao: qualOposta,
            ordem: 0,
            advogadoPessoaIds: [],
          }]),
        ]);
        try {
          const { sincronizarParteOpostaProcessoParaInquilinosImovel } = await import(
            '../repositories/imovelInquilinoProcessoSync.js'
          );
          await sincronizarParteOpostaProcessoParaInquilinosImovel(pid, linhasOp);
        } catch {
          /* sync imóvel best-effort */
        }
      }
      if (pid && opts.syncAndamentos) {
        await sincronizarAndamentosIncremental(pid, snapshot.historico || []);
        try {
          const andamentos = await listarAndamentosProcesso(pid);
          if (Array.isArray(andamentos)) {
            const aindaMesmoProcesso = Number(pid) === Number(processoApiIdRef.current);
            const tinhaNoSnapshot = (snapshot.historico || []).length > 0;
            if (andamentos.length > 0) {
              const hist = andamentos.map((a, idx) =>
                mapApiAndamentoToHistoricoItem(a, idx, andamentos.length)
              );
              if (aindaMesmoProcesso) {
                snapshot = { ...snapshot, historico: hist };
                setHistorico(hist);
                setPaginaHistorico(1);
                historicoCarregadoParaProcessoRef.current = pid;
              }
            } else if (aindaMesmoProcesso) {
              if (!tinhaNoSnapshot) {
                snapshot = { ...snapshot, historico: [] };
                setHistorico([]);
                setPaginaHistorico(1);
              }
              historicoCarregadoParaProcessoRef.current = pid;
            }
          }
        } catch {
          /* mantém o histórico já exibido se o GET falhar */
        }
      }
      if (pid && opts.syncPrazoFatal) {
        await upsertPrazoFatalProcesso(pid, snapshot.prazoFatal);
      }
      if (pid && deveRefetchPartes) {
        const partesAtualizadas = await listarPartesProcesso(pid);
        aplicarListaPartesApiNaUi(partesAtualizadas);
      }
      salvarHistoricoDoProcesso(snapshot);
    } catch (e) {
      setApiError(e?.message || 'Falha ao sincronizar processo na API.');
    } finally {
      setApiSaving(false);
    }
  }

  const edicaoDesabilitadaAnteriorRef = useRef(edicaoDesabilitada);

  useEffect(() => {
    if (edicaoDesabilitada) return;
    if (carregandoProcessoNavegacaoRef.current) return;
    if (featureFlags.useApiProcessos) {
      void sincronizarApiProcessoAtual();
      return;
    }
    salvarHistoricoDoProcesso(montarPayloadRegistroProcesso());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot completo; listar deps duplicaria montarPayload
  }, [
    edicaoDesabilitada,
    cliente,
    parteCliente,
    parteOposta,
    textoParteCliente,
    textoParteOposta,
    numeroProcessoNovo,
    numeroProcessoVelho,
    historico,
    prazoFatal,
    parteClienteEntradas,
    parteOpostaEntradas,
    faseSelecionada,
    periodicidadeConsulta,
    tramitacao,
    pjeTribunal,
    pjeGrau,
    naturezaAcao,
    consultaAutomatica,
    estado,
    cidade,
    orgaoJulgadorSelecionado?.orgaoJulgador?.municipio?.id,
    municipioSelecionado?.municipioId,
    orgaoJulgadorSelecionado?.orgaoJulgadorId,
    varaADistribuir,
    dataProtocolo,
    pasta,
    valorCausa,
    responsavel,
    usuarioResponsavelId,
    competencia,
    observacao,
    papelParte,
    statusAtivo,
    faseCampo,
    audienciaData,
    audienciaHora,
    audienciaTipo,
    avisoAudiencia,
    imovelId,
    unidadeEndereco,
    proximaInformacao,
    dataProximaInformacao,
  ]);

  /** Periodicidade e tramitação permanecem editáveis com «Edição desabilitada». */
  useEffect(() => {
    if (!edicaoDesabilitada) return;
    if (carregandoProcessoNavegacaoRef.current) return;
    if (ignorarSyncCamposLevesAposHidratarRef.current) {
      ignorarSyncCamposLevesAposHidratarRef.current = false;
      return;
    }
    if (featureFlags.useApiProcessos) {
      void sincronizarApiProcessoAtual(
        {},
        {
          syncPartes: false,
          syncAndamentos: false,
          syncPrazoFatal: false,
          permitirComEdicaoDesabilitada: true,
        }
      );
      return;
    }
    salvarHistoricoDoProcesso(montarPayloadRegistroProcesso());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot tramitação; deps listadas
  }, [
    edicaoDesabilitada,
    periodicidadeConsulta,
    tramitacao,
    pjeTribunal,
    pjeGrau,
  ]);

  useEffect(() => {
    let ativo = true;
    void listarColaboradoresHumanos()
      .then((lista) => {
        if (!ativo) return;
        setColaboradoresResponsavel(Array.isArray(lista) ? lista : []);
      })
      .catch(() => {
        if (!ativo) return;
        setColaboradoresResponsavel(getColaboradoresHumanosAtivos() || []);
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (usuarioResponsavelId || !String(responsavel ?? '').trim()) return;
    const inferido = resolverUsuarioIdPorConsultorLegado(responsavel, colaboradoresResponsavel);
    if (inferido) setUsuarioResponsavelId(inferido);
  }, [colaboradoresResponsavel, responsavel, usuarioResponsavelId]);

  function alterarResponsavelProcesso(nextUsuarioId) {
    const id = String(nextUsuarioId ?? '').trim();
    setUsuarioResponsavelId(id);
    if (!id) {
      setResponsavel('');
      return;
    }
    const u = colaboradoresResponsavel.find((x) => String(x.id) === id);
    setResponsavel(consultorLegadoDeUsuario(u));
  }

  useEffect(() => {
    if (edicaoDesabilitadaAnteriorRef.current === false && edicaoDesabilitada === true) {
      if (featureFlags.useApiProcessos) {
        void sincronizarApiProcessoAtual(undefined, { refetchPartesAfterSync: true });
      } else {
        salvarHistoricoDoProcesso(montarPayloadRegistroProcesso());
      }
    }
    edicaoDesabilitadaAnteriorRef.current = edicaoDesabilitada;
  }, [edicaoDesabilitada]);

  function abrirPessoaFlutuanteNoModalPartes(pessoaId) {
    const id = Number(pessoaId);
    if (!Number.isFinite(id) || id < 1) return;
    setPessoaEmbed((prev) => ({
      revision: (prev?.revision ?? 0) + 1,
      pessoaId: id,
    }));
  }

  function abrirNovaPessoaNoModalPartes() {
    setPessoaEmbed((prev) => ({
      revision: (prev?.revision ?? 0) + 1,
      modo: 'criar',
    }));
  }

  function aoPessoaSalvaNoModalPartes(pessoa) {
    const id = Number(pessoa?.id);
    if (!Number.isFinite(id) || id < 1) return;
    const row = {
      id,
      nome: String(pessoa?.nome ?? '').trim() || `Pessoa #${id}`,
      cpf: String(pessoa?.cpf ?? ''),
    };
    mergeVinculoPessoasNoCache([row]);
    setPessoasBuscaVinculoResultados([row]);
    setLinhasModalPartes((prev) => {
      if (prev.some((l) => l.pessoaId === id)) return prev;
      return [...prev, { pessoaId: id, advogadoPessoaIds: [] }];
    });
    setBuscaPessoaVinculo(row.nome);
    setPessoaEmbed(null);
  }

  function abrirModalDetalhesPartes() {
    draftParteClienteLinhasRef.current = clonarLinhasParteProcesso(parteClienteEntradas);
    draftParteOpostaLinhasRef.current = clonarLinhasParteProcesso(parteOpostaEntradas);
    setDetalhesAbaPartes('cliente');
    setLinhasModalPartes(clonarLinhasParteProcesso(parteClienteEntradas));
    setBuscaPessoaVinculo('');
    setPessoasBuscaVinculoResultados([]);
    setBuscaVinculoPessoasEmAndamento(false);
    buscaVinculoSeqRef.current += 1;
    setModalVinculoPartes('detalhes');
  }

  function mudarAbaDetalhesPartes(nova) {
    if (nova === detalhesAbaPartes) return;
    if (detalhesAbaPartes === 'cliente') {
      draftParteClienteLinhasRef.current = clonarLinhasParteProcesso(linhasModalPartes);
    } else {
      draftParteOpostaLinhasRef.current = clonarLinhasParteProcesso(linhasModalPartes);
    }
    setDetalhesAbaPartes(nova);
    setLinhasModalPartes(
      clonarLinhasParteProcesso(
        nova === 'cliente' ? draftParteClienteLinhasRef.current : draftParteOpostaLinhasRef.current
      )
    );
  }

  function alternarPessoaNaParteModal(pessoaId) {
    const pid = Number(pessoaId);
    if (!Number.isFinite(pid) || pid < 1) return;
    const adicionando = !linhasModalPartes.some((l) => l.pessoaId === pid);
    setLinhasModalPartes((prev) => {
      const i = prev.findIndex((l) => l.pessoaId === pid);
      if (i >= 0) return prev.filter((_, j) => j !== i);
      return [...prev, { pessoaId: pid, advogadoPessoaIds: [] }];
    });
    if (adicionando) setBuscaPessoaVinculo('');
  }

  function adicionarAdvogadoLinhaModal(pessoaParteId, advogadoPessoaId) {
    const parte = Number(pessoaParteId);
    const adv = Number(advogadoPessoaId);
    if (!Number.isFinite(parte) || parte < 1 || !Number.isFinite(adv) || adv < 1 || adv === parte) return;
    setLinhasModalPartes((prev) => {
      const semAdvComoParte = prev.filter((l) => l.pessoaId !== adv);
      return semAdvComoParte.map((l) => {
        if (l.pessoaId !== parte) return l;
        if (l.advogadoPessoaIds.includes(adv)) return l;
        return { ...l, advogadoPessoaIds: [...l.advogadoPessoaIds, adv] };
      });
    });
  }

  function removerAdvogadoLinhaModal(pessoaParteId, advogadoPessoaId) {
    const parte = Number(pessoaParteId);
    const adv = Number(advogadoPessoaId);
    setLinhasModalPartes((prev) =>
      prev.map((l) =>
        l.pessoaId === parte
          ? { ...l, advogadoPessoaIds: l.advogadoPessoaIds.filter((x) => x !== adv) }
          : l
      )
    );
  }

  function salvarVinculoPartes() {
    if (detalhesAbaPartes === 'cliente') {
      draftParteClienteLinhasRef.current = clonarLinhasParteProcesso(linhasModalPartes);
    } else {
      draftParteOpostaLinhasRef.current = clonarLinhasParteProcesso(linhasModalPartes);
    }
    const nextCliente = clonarLinhasParteProcesso(draftParteClienteLinhasRef.current);
    const nextOposta = clonarLinhasParteProcesso(draftParteOpostaLinhasRef.current);
    setParteClienteEntradas(nextCliente);
    setParteOpostaEntradas(nextOposta);
    setModalVinculoPartes(null);

    const pcNome = formatarListaComConjuncaoE(
      nextCliente.map((row) => pessoasPorId.get(Number(row.pessoaId))?.nome).filter(Boolean)
    );
    const poNome = formatarListaComConjuncaoE(
      nextOposta.map((row) => pessoasPorId.get(Number(row.pessoaId))?.nome).filter(Boolean)
    );
    const idsCli = nextCliente.map((r) => r.pessoaId);
    const idsOp = nextOposta.map((r) => r.pessoaId);
    if (featureFlags.useApiProcessos) {
      void sincronizarApiProcessoAtual(
        {
          parteCliente: pcNome || parteCliente,
          parteOposta: poNome || parteOposta,
          parteClienteEntradas: nextCliente,
          parteOpostaEntradas: nextOposta,
          parteClienteIds: idsCli,
          parteOpostaIds: idsOp,
        },
        {
          syncPartes: true,
          syncAndamentos: false,
          syncPrazoFatal: false,
          permitirComEdicaoDesabilitada: true,
        }
      );
    } else {
      salvarHistoricoDoProcesso(
        montarPayloadRegistroProcesso({
          parteCliente: pcNome || parteCliente,
          parteOposta: poNome || parteOposta,
          parteClienteEntradas: nextCliente,
          parteOpostaEntradas: nextOposta,
          parteClienteIds: idsCli,
          parteOpostaIds: idsOp,
        })
      );
    }
  }

  function parseValorBusca(termo) {
    const s = String(termo ?? '').trim();
    if (!s) return null;
    // aceita "1.234,56" ou "1234.56" e sinais
    const cleaned = s.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const n = Number(cleaned);
    return Number.isNaN(n) ? null : n;
  }

  function filtrarLancamentosContaCorrente(lista, campo, termo) {
    const t = normalizarTextoBusca(termo);
    if (!t) return lista;
    const c = campo || 'todos';
    const valorNum = c === 'valor' ? parseValorBusca(termo) : null;
    return lista.filter((l) => {
      const hay = {
        data: l.data,
        descricao: l.descricao,
        proc: l.dataOuId,
        valor: l.valor,
        nome: l.nome,
        banco: l.nomeBanco,
        numero: l.numero,
        vinculo: l.numeroVinculo,
      };
      if (c === 'valor') {
        if (valorNum == null) return false;
        return Math.abs((Number(hay.valor) || 0) - valorNum) < 0.0001;
      }
      if (c === 'data') return normalizarTextoBusca(hay.data).includes(t);
      if (c === 'descricao') return normalizarTextoBusca(hay.descricao).includes(t);
      if (c === 'proc') return normalizarTextoBusca(hay.proc).includes(t);
      if (c === 'nome') return normalizarTextoBusca(hay.nome).includes(t);
      if (c === 'banco') return normalizarTextoBusca(hay.banco).includes(t);
      if (c === 'numero') return normalizarTextoBusca(hay.numero).includes(t);
      if (c === 'vinculo') return normalizarTextoBusca(hay.vinculo).includes(t);
      // todos
      return (
        normalizarTextoBusca(hay.data).includes(t) ||
        normalizarTextoBusca(hay.descricao).includes(t) ||
        normalizarTextoBusca(hay.proc).includes(t) ||
        normalizarTextoBusca(hay.nome).includes(t) ||
        normalizarTextoBusca(hay.banco).includes(t) ||
        normalizarTextoBusca(hay.numero).includes(t) ||
        normalizarTextoBusca(String(hay.valor)).includes(t)
      );
    });
  }

  function manterInformacaoNoHistorico() {
    const info = String(proximaInformacao ?? '').trim();
    const dataCampo = String(dataProximaInformacao ?? '').trim();

    /** Com os dois campos vazios: regrava usuário e data na linha mais recente (topo da tabela), sem alterar o texto. */
    if (!info && !dataCampo) {
      if (historico.length === 0) return;
      const hoje = hojeBr();
      const usuario = nomeUsuarioAtivoParaHistorico();
      const [primeiro, ...resto] = historico;
      const atualizado = { ...primeiro, usuario, data: hoje };
      const historicoAtualizado = [atualizado, ...resto];
      setHistorico(historicoAtualizado);
      /** Rascunho explícito: evita gravar estado antigo no snapshot (setState é assíncrono; sync API usa snapshot inicial). */
      const overridesHistorico = {
        historico: historicoAtualizado,
        proximaInformacao: '',
        dataProximaInformacao: '',
      };
      const payloadHistorico = montarPayloadRegistroProcesso(overridesHistorico);
      salvarHistoricoDoProcesso(payloadHistorico);
      if (featureFlags.useApiProcessos) {
        void sincronizarApiProcessoAtual(overridesHistorico, {
          syncPartes: false,
          syncAndamentos: true,
          syncPrazoFatal: false,
          permitirComEdicaoDesabilitada: true,
        });
      }
      showProcessoToast('Informação atualizada no histórico.');
      return;
    }

    if (!info) return;
    const data = dataCampo || hojeBr();
    const maiorNumero = historico.reduce((acc, h) => {
      const n = Number(h?.numero);
      return Number.isFinite(n) ? Math.max(acc, n) : acc;
    }, 0);
    const novoNumero = maiorNumero + 1;
    const novoItem = {
      id: Date.now(),
      fromApi: false,
      inf: String(novoNumero).padStart(2, '0'),
      info,
      data,
      usuario: nomeUsuarioAtivoParaHistorico(),
      usuarioId: usuarioAtivoIdParaHistorico(),
      numero: String(novoNumero).padStart(4, '0'),
    };
    const historicoAtualizado = [novoItem, ...historico];
    setHistorico(historicoAtualizado);
    setPaginaHistorico(1);
    setProximaInformacao('');
    setDataProximaInformacao('');
    /** Rascunho zerado nos overrides: `montarPayload` e `sincronizarApiProcessoAtual` rodam antes do re-render com estado velho. */
    const overridesHistorico = {
      historico: historicoAtualizado,
      proximaInformacao: '',
      dataProximaInformacao: '',
    };
    const payloadHistorico = montarPayloadRegistroProcesso(overridesHistorico);
    salvarHistoricoDoProcesso(payloadHistorico);
    if (featureFlags.useApiProcessos) {
      void sincronizarApiProcessoAtual(overridesHistorico, {
        syncPartes: false,
        syncAndamentos: true,
        syncPrazoFatal: false,
        permitirComEdicaoDesabilitada: true,
      });
    }
    showProcessoToast('Informação adicionada ao histórico.');
  }

  function desfazerUltimaInformacaoHistorico() {
    if (historico.length === 0) return;
    const ultima = historico[0];
    if (!ultimaEntradaHistoricoEhDoUsuarioAtivo(ultima)) return;

    const resumo = String(ultima.info ?? '').trim() || '(sem texto)';
    const ok = window.confirm(
      `Remover a última informação que você inseriu neste processo?\n\nInf. ${ultima.inf}: ${resumo}`
    );
    if (!ok) return;

    const historicoAtualizado = historico.slice(1);
    setHistorico(historicoAtualizado);
    const totalP = Math.max(1, Math.ceil(historicoAtualizado.length / HISTORICO_POR_PAGINA));
    if (paginaHistorico > totalP) setPaginaHistorico(totalP);

    const payloadHistorico = montarPayloadRegistroProcesso({ historico: historicoAtualizado });
    salvarHistoricoDoProcesso(payloadHistorico);
    if (featureFlags.useApiProcessos) {
      void sincronizarApiProcessoAtual(
        { historico: historicoAtualizado },
        {
          syncPartes: false,
          syncAndamentos: true,
          syncPrazoFatal: false,
          permitirComEdicaoDesabilitada: true,
        }
      );
    }
  }

  function persistirPrazoFatalAposEdicao(valorBruto) {
    const t = String(valorBruto ?? '').trim();
    const prazoNorm =
      t && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t) ? normalizarDataBr(t) || '' : '';
    setPrazoFatal(prazoNorm);
    if (featureFlags.useApiProcessos) {
      void sincronizarApiProcessoAtual(
        { prazoFatal: prazoNorm },
        { syncPartes: false, syncAndamentos: false, syncPrazoFatal: true }
      );
    } else {
      salvarPrazoFatalDoProcesso(codigoCliente, processo, prazoNorm, montarPayloadRegistroProcesso({ prazoFatal: prazoNorm }));
    }
  }

  const totalPaginasHistorico = Math.max(1, Math.ceil(historico.length / HISTORICO_POR_PAGINA));
  const historicoPaginado = historico.slice(
    (paginaHistorico - 1) * HISTORICO_POR_PAGINA,
    paginaHistorico * HISTORICO_POR_PAGINA
  );
  const podeDesfazerUltimaInformacaoHistorico =
    historico.length > 0 && ultimaEntradaHistoricoEhDoUsuarioAtivo(historico[0]);
  const ufAtual = UFS.find((u) => u.sigla === estado);

  /** Igualdade estrita com `FASES` falha quando a API grava sinónimo (ex.: «Aguardando Verificação» vs «Ag. Verificação»). */
  const faseParaRadiosProcessos = canonicalizarFaseParaOpcoesRadiosProcessos(faseSelecionada);
  const shellFormularioClass = classeShellFormularioProcessoPorFase(faseSelecionada);

  const inputClass = processosInputClass;
  const inputDisabledClass = processosInputReadOnlyClass;
  const camposBloqueados = edicaoDesabilitada;
  const clsCampo = camposBloqueados ? inputDisabledClass : inputClass;
  /** Campos mais baixos na secção «Dados processuais» (menos rolagem). */
  const inputClassDenso = processosInputDenseClass;
  const inputDisabledClassDenso = processosInputDenseReadOnlyClass;
  const clsCampoDenso = camposBloqueados ? inputDisabledClassDenso : inputClassDenso;

  const diasPrazoFatal = diasAteDataBr(prazoFatal);
  const prazoUrgente = diasPrazoFatal != null && diasPrazoFatal >= 0 && diasPrazoFatal < 5;
  const valorCausaFmt = formatValorCausaExibicao(valorCausa);
  const valorCausaZerado = !String(valorCausa ?? '').trim() || valorCausaFmt === 'R$ 0,00';

  useEffect(() => {
    if (!historicoToast?.message) return undefined;
    const ms = historicoToast.variant === 'error' ? 6000 : 3200;
    const t = window.setTimeout(() => setHistoricoToast(null), ms);
    return () => window.clearTimeout(t);
  }, [historicoToast]);

  const agendarAudienciaApiDebounceRef = useRef(null);

  // Agenda: replica a audiência para todos os colaboradores ao haver data válida (formulário Processos).
  useEffect(() => {
    if (isEmbedded) return undefined;

    const payloadBase = {
      codigoCliente,
      numeroInterno: processo,
    };

    if (featureFlags.useApiAgenda) {
      if (agendarAudienciaApiDebounceRef.current != null) {
        window.clearTimeout(agendarAudienciaApiDebounceRef.current);
      }
      agendarAudienciaApiDebounceRef.current = window.setTimeout(() => {
        agendarAudienciaApiDebounceRef.current = null;
        if (!audienciaData) {
          void removerAudienciaProcessoAgendaApi(payloadBase);
          return;
        }
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(audienciaData)) return;
        void replicarAudienciaProcessoTodosColaboradoresApi({
          audienciaData,
          audienciaHora,
          audienciaTipo: normalizarTipoAudienciaCanonico(audienciaTipo),
          numeroProcessoNovo,
          codigoCliente,
          numeroInterno: processo,
          parteCliente: textoParteCliente || parteCliente,
          parteOposta: textoParteOposta || parteOposta,
          competencia,
        });
      }, 600);
      return () => {
        if (agendarAudienciaApiDebounceRef.current != null) {
          window.clearTimeout(agendarAudienciaApiDebounceRef.current);
          agendarAudienciaApiDebounceRef.current = null;
        }
      };
    }

    if (!audienciaData) {
      removerAudienciaProcessoDaAgenda(payloadBase);
      return undefined;
    }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(audienciaData)) return undefined;

    agendarAudienciaParaTodosUsuarios({
      audienciaData,
      audienciaHora,
      audienciaTipo: normalizarTipoAudienciaCanonico(audienciaTipo),
      numeroProcessoNovo,
      codigoCliente,
      numeroInterno: processo,
      parteCliente: textoParteCliente || parteCliente,
      parteOposta: textoParteOposta || parteOposta,
      competencia,
    });
    return undefined;
  }, [
    audienciaData,
    audienciaHora,
    audienciaTipo,
    numeroProcessoNovo,
    codigoCliente,
    processo,
    textoParteCliente,
    textoParteOposta,
    parteCliente,
    parteOposta,
    competencia,
    isEmbedded,
  ]);

  function eliminarAgendamentoAudiencia() {
    if (camposBloqueados || !String(audienciaData ?? '').trim()) return;

    const payloadBase = {
      codigoCliente,
      numeroInterno: processo,
    };

    if (agendarAudienciaApiDebounceRef.current != null) {
      window.clearTimeout(agendarAudienciaApiDebounceRef.current);
      agendarAudienciaApiDebounceRef.current = null;
    }

    if (featureFlags.useApiAgenda) {
      void removerAudienciaProcessoAgendaApi(payloadBase);
    } else {
      removerAudienciaProcessoDaAgenda(payloadBase);
    }

    setAudienciaData('');
    setAudienciaHora('');
    setAudienciaTipo('');
    setAvisoAudiencia('nao_avisado');
  }

  function formatarHoraAudienciaInput(valor) {
    // Máscara parcial do horário para permitir digitação sem “embaralhar” dígitos.
    // Regras:
    // - 1 dígito  -> "H"
    // - 2 dígitos -> "HH"
    // - 3 dígitos -> "HH:M"
    // - 4 dígitos -> "HH:MM"
    const digits = String(valor ?? '').replace(/\D/g, '').slice(0, 4);
    if (!digits) return '';
    if (digits.length === 1) return digits;
    if (digits.length === 2) return digits;
    if (digits.length === 3) return `${digits.slice(0, 2)}:${digits.slice(2, 3)}`;
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
  }

  function normalizarHoraAudiencia(valor) {
    const digits = String(valor ?? '').replace(/\D/g, '');
    if (!digits) return '';
    // Normaliza para HH:MM mesmo com entrada incompleta (ex.: "9" -> "09:00", "930" -> "09:30")
    let hhDigits = '';
    let mmDigits = '';
    if (digits.length <= 2) {
      hhDigits = digits.padStart(2, '0').slice(0, 2);
      mmDigits = '00';
    } else if (digits.length === 3) {
      hhDigits = digits.slice(0, 2);
      mmDigits = `${digits.slice(2, 3)}0`;
    } else {
      hhDigits = digits.slice(0, 2);
      mmDigits = digits.slice(2, 4);
    }

    const hh = Number(hhDigits);
    const mm = Number(mmDigits);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return '';
    if (hh < 0 || hh > 23) return '';
    if (mm < 0 || mm > 59) return '';
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  function handleAudienciaHoraChange(e) {
    const inputEl = e.target;
    const raw = inputEl?.value ?? '';
    const selectionStart = typeof inputEl?.selectionStart === 'number' ? inputEl.selectionStart : raw.length;

    // Conta quantos dígitos estavam antes do cursor para reposicionar após o “format”.
    const digitsAntesCursor = raw.slice(0, selectionStart).replace(/\D/g, '').slice(0, 4).length;
    const formatted = formatarHoraAudienciaInput(raw);
    setAudienciaHora(formatted);

    requestAnimationFrame(() => {
      const el = audienciaHoraInputRef.current;
      if (!el) return;
      const pos = digitsAntesCursor <= 2 ? digitsAntesCursor : digitsAntesCursor + 1; // +1 pula o ':'
      const clamped = Math.max(0, Math.min(pos, String(formatted ?? '').length));
      try {
        el.setSelectionRange(clamped, clamped);
      } catch {
        // ignora
      }
    });
  }

  /**
   * Fechar ao clicar no fundo só se pressão e soltura começaram no overlay.
   * Evita fechar ao selecionar texto dentro do modal e soltar o cursor fora do painel.
   */
  const modalOverlayPressStartedRef = useRef(false);
  const onModalOverlayMouseDown = useCallback((e) => {
    if (e.target === e.currentTarget) modalOverlayPressStartedRef.current = true;
  }, []);
  const onModalPanelMouseDown = useCallback(() => {
    modalOverlayPressStartedRef.current = false;
  }, []);
  const criarModalOverlayClickFechar = useCallback(
    (closeFn) => (e) => {
      if (e.target !== e.currentTarget) return;
      if (!modalOverlayPressStartedRef.current) {
        modalOverlayPressStartedRef.current = false;
        return;
      }
      modalOverlayPressStartedRef.current = false;
      closeFn();
    },
    []
  );

  const audienciaTipoCanonico = normalizarTipoAudienciaCanonico(audienciaTipo);
  const audienciaResumo = [audienciaData, audienciaHora, audienciaTipoCanonico].filter((x) => String(x ?? '').trim()).join(' · ') || 'Sem audiência agendada';

  return (
    <div
      className={
        contaCorrenteSomenteEmbed
          ? 'contents'
          : `${isEmbedded ? 'min-h-0 w-full' : 'min-h-full'} bg-slate-100`
      }
    >
      <div
        className={`max-w-[1400px] mx-auto px-3 sm:px-4 py-4 ${isEmbedded ? 'min-w-0' : ''} ${contaCorrenteSomenteEmbed ? '!p-0 !max-w-none' : ''}`}
      >
        <ProcessosToast
          message={historicoToast?.message}
          variant={historicoToast?.variant ?? 'success'}
          onClose={() => setHistoricoToast(null)}
        />
        {!contaCorrenteSomenteEmbed ? (
        <>
        <ProcessosStickyHeader
          numeroCnj={numeroProcessoNovo}
          cliente={cliente}
          statusAtivo={statusAtivo}
          faseSelecionada={faseSelecionada}
          edicaoDesabilitada={edicaoDesabilitada}
          onEdicaoDesabilitadaChange={setEdicaoDesabilitada}
          isMobile={bannerProcesso.isMobile}
          bannerExpandido={bannerProcesso.expandido}
          onBannerExpandidoChange={bannerProcesso.setExpandido}
          observacaoFase={faseCampo}
          onFechar={() => {
            if (isEmbedded && typeof onFecharEmbed === 'function') onFecharEmbed();
            else window.history.back();
          }}
          actions={
            <div className="contents">
              <button
                  type="button"
                  onClick={() =>
                    setClientesEmbed({
                      revision: Date.now(),
                      routerState: buildRouterStateChaveClienteProcesso(codigoCliente, processo),
                    })
                  }
                  className={processosBtnToolbarPurple}
                >
                  <Users className="w-3.5 h-3.5" aria-hidden />
                  Clientes
                </button>
                <button type="button" onClick={() => setModalRelatorioPublicacoes(true)} className={processosBtnToolbarTeal}>
                  <Newspaper className="w-3.5 h-3.5" aria-hidden />
                  Publicações
                </button>
                <button
                  type="button"
                  className={processosBtnToolbarAmber}
                  onClick={() => setModalConsultaPeriodica(true)}
                  title="Agendamentos automáticos ao PROJUDI, monitor manual e destinatários de notificação"
                >
                  <CalendarClock className="w-3.5 h-3.5" aria-hidden />
                  Consulta periódica
                </button>
                <button
                  type="button"
                  className={processosBtnToolbarGreen}
                  onClick={() => {
                    setContaCorrenteModo('processo');
                    setModalContaCorrente(true);
                  }}
                  title="Lançamentos do Financeiro com Cod. Cliente e Proc. iguais a este processo (qualquer classificação contábil no extrato)"
                >
                  <CircleDollarSign className="w-3.5 h-3.5" aria-hidden />
                  Conta Corrente
                </button>
                {featureFlags.useApiProcessos ? (
                  <>
                    <button
                      type="button"
                      className={processosBtnToolbarSky}
                      disabled={
                        apiSaving ||
                        buscandoMovimentacoes ||
                        !driveConfigurado ||
                        !Number(processoApiId) ||
                        !String(numeroProcessoNovo ?? '').trim() ||
                        tramitacaoBloqueiaObterMovimentacoes
                      }
                      onClick={() => void handleObterMovimentacoes()}
                      title={
                        !driveConfigurado
                          ? 'Google Drive não configurado no servidor'
                          : !Number(processoApiId)
                            ? 'Processo ainda sem id na API — aguarde o carregamento ou salve o cadastro'
                            : !String(numeroProcessoNovo ?? '').trim()
                              ? 'Preencha o Nº Processo Novo (CNJ) para consultar movimentações'
                              : tramitacaoBloqueiaObterMovimentacoes
                                ? 'Processo em autos físicos — sem consulta automática.'
                                : obterMovimentacoesViaPje
                                  ? pjeAutomacaoTrt18
                                    ? 'Dispara cópia integral PJe TRT18 (assíncrono) — acompanhe o badge No Drive'
                                    : `PJe (${rotuloPjeTribunal(pjeTribunalNorm)}) — automação indisponível; registro salvo no cadastro`
                                  : !tramitacaoNorm
                                    ? 'Defina a tramitação dos autos para consultar movimentações'
                                    : 'Consulta o PROJUDI agora (mesmo com acervo integral no pipeline automático; pode não trazer arquivos novos)'
                      }
                    >
                      <CloudDownload className="w-3.5 h-3.5" aria-hidden />
                      {buscandoMovimentacoes
                        ? obterMovimentacoesViaPje
                          ? 'Iniciando PJe…'
                          : 'Consultando PROJUDI…'
                        : 'Obter movimentações'}
                    </button>
                    <button
                      type="button"
                      className={processosBtnToolbarRose}
                      disabled={apiSaving || !driveConfigurado || !Number(processoApiId)}
                      onClick={() => setDriveExplorerAberto(true)}
                      title={
                        !driveConfigurado
                          ? 'Google Drive não configurado no servidor'
                          : !Number(processoApiId)
                            ? 'Processo ainda sem id na API'
                            : 'Arquivos do processo no Google Drive'
                      }
                    >
                      <FolderOpen className="w-3.5 h-3.5" aria-hidden />
                      Arquivos
                    </button>
                    <button
                      type="button"
                      className={processosBtnToolbarCyan}
                      disabled={!Number(processoApiId)}
                      onClick={() =>
                        navigate('/processos/recebiveis', {
                          state: buildRouterStateChaveClienteProcesso(codigoCliente, processo, { processoApiId }),
                        })
                      }
                      title={
                        Number(processoApiId)
                          ? 'Parcelas de honorários e cobrança deste processo'
                          : 'Disponível após o processo ter id na API'
                      }
                    >
                      <Receipt className="w-3.5 h-3.5" aria-hidden />
                      Recebíveis
                    </button>
                    <button
                      type="button"
                      className={processosBtnToolbarOrange}
                      disabled={!podeGerarDocumento || gerandoDocNav || gerandoProcuracao || apiSaving}
                      onClick={() => void handleGerarDocumento()}
                      title={
                        podeGerarDocumento
                          ? 'Gerar petição ou documento com dados deste processo'
                          : 'Informe o CNJ ou salve o processo na API'
                      }
                    >
                      <FileText className="w-3.5 h-3.5" aria-hidden />
                      {gerandoDocNav ? 'Preparando…' : 'Gerar Documento'}
                    </button>
                    <button
                      type="button"
                      className={processosBtnToolbarIndigo}
                      disabled={!podeGerarDocumento || gerandoProcuracao || gerandoDocNav || apiSaving}
                      onClick={() => void handleGerarProcuracao()}
                      title={
                        podeGerarDocumento
                          ? 'Gerar procuração Ad Judicia da parte cliente'
                          : 'Informe o CNJ ou salve o processo na API'
                      }
                    >
                      <FileSignature className="w-3.5 h-3.5" aria-hidden />
                      {gerandoProcuracao ? 'Gerando…' : 'Procuração'}
                    </button>
                    <button
                      type="button"
                      className={processosBtnToolbarCyan}
                      disabled={
                        !podeGerarDocumento ||
                        !driveConfigurado ||
                        apiSaving ||
                        baixandoAutosIntegral ||
                        !String(numeroProcessoNovo ?? '').trim()
                      }
                      onClick={() => void handleBaixarAutosIntegral()}
                      title="Baixa PDF único juntando os documentos da pasta Movimentações no Drive"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden />
                      {baixandoAutosIntegral ? 'Gerando PDF…' : 'Baixar processo integral'}
                    </button>
                    <button
                      type="button"
                      className={processosBtnToolbarPurple}
                      disabled={
                        !podeGerarDocumento ||
                        gerandoDistribuicaoInicial ||
                        apiSaving ||
                        gerandoDocNav ||
                        gerandoProcuracao
                      }
                      onClick={() => void handleDistribuirInicialProjudi()}
                      title={
                        podeGerarDocumento
                          ? 'Montar petição inicial no PROJUDI até a revisão (autor, réu e valor da causa deste processo)'
                          : 'Informe o CNJ ou salve o processo na API'
                      }
                    >
                      <Scale className="w-3.5 h-3.5" aria-hidden />
                      {gerandoDistribuicaoInicial ? 'Preparando…' : 'Distribuir Inicial PROJUDI'}
                    </button>
                    <button
                      type="button"
                      className={processosBtnToolbarRed}
                      disabled={apiSaving || !podeGerarDocumento}
                      onClick={() => setModalPeticionamentoProjudi(true)}
                      title={
                        String(numeroProcessoNovo ?? '').trim()
                          ? 'Petições registradas para protocolo no PROJUDI (deste processo)'
                          : 'Preencha o Nº Processo Novo (CNJ) para peticionar no PROJUDI'
                      }
                    >
                      <Send className="w-3.5 h-3.5" aria-hidden />
                      Peticionamento PROJUDI
                    </button>
                  </>
                ) : null}
              <button
                type="button"
                onClick={() => {
                  setIndiceAcaoRedacaoFocada(0);
                  indiceAcaoRedacaoFocadaRef.current = 0;
                  setModalAcoesRedacaoAberto(true);
                }}
                className={processosBtnToolbarRedacao}
                aria-label="Ações de redação"
              >
                <IconMaoEscrevendo />
              </button>
              {featureFlags.useApiTarefas ? (
                <button type="button" onClick={abrirModalTarefaDoProcesso} className={processosBtnToolbarPrimary}>
                  <ListTodo className="w-3.5 h-3.5" aria-hidden />
                  Criar tarefa
                </button>
              ) : null}
            </div>
          }
        />
        <ProcessosSummaryCards
          cards={[
            { variant: 'prazo', label: 'Prazo fatal / urgência', value: String(prazoFatal ?? '').trim() || 'Sem prazo fatal', muted: !String(prazoFatal ?? '').trim(), alert: prazoUrgente, Icon: AlertTriangle },
            { variant: 'audiencia', label: 'Audiência', value: audienciaResumo, muted: audienciaResumo === 'Sem audiência agendada', Icon: Calendar, extra: <span className={`mt-1 inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border ${avisoAudiencia === 'avisado' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-amber-100 text-amber-700 border-amber-300'}`}>{avisoAudiencia === 'avisado' ? 'Avisado' : 'Não avisado'}</span> },
            ...(statusAtivo
              ? [{ variant: 'fase', label: 'Fase processual', value: faseSelecionada || 'Não definida', muted: !String(faseSelecionada ?? '').trim(), Icon: GitBranch }]
              : []),
            { variant: 'valor', label: 'Valor da causa', value: valorCausaFmt, muted: valorCausaZerado, Icon: CircleDollarSign },
          ]}
        />
        {statusAtivo && String(faseCampo ?? '').trim() ? (
          <div className="mb-4 rounded-xl border border-blue-200/80 bg-blue-50/50 px-3 py-2.5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-800 mb-1">
              Observação de Fase
            </p>
            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-snug">{faseCampo}</p>
          </div>
        ) : null}

        {featureFlags.useApiProcessos && apiSaving ? (
          <div className="mb-3 rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
            Salvando alterações no backend...
          </div>
        ) : null}
        {featureFlags.useApiProcessos && apiError ? (
          <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {apiError}
          </div>
        ) : null}
        {acaoRedacaoVinculada &&
        String(acaoRedacaoVinculada.codigoCliente) === String(codigoCliente ?? '').trim() &&
        Number(acaoRedacaoVinculada.processo) === Number(processo) ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm">
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-slate-700">Ação de redação vinculada a este processo:</span>{' '}
              <span className="text-slate-900">{acaoRedacaoVinculada.label}</span>
              <span className="text-slate-500">
                {' '}
                · Cliente {acaoRedacaoVinculada.codigoCliente} · Proc. {acaoRedacaoVinculada.processo}
                {acaoRedacaoVinculada.processoApiId
                  ? ` · API #${acaoRedacaoVinculada.processoApiId}`
                  : ''}
              </span>
            </div>
            <button
              type="button"
              onClick={dispensarBannerAcaoRedacao}
              className="p-1.5 rounded text-slate-500 hover:bg-slate-100 shrink-0"
              aria-label="Dispensar aviso da ação de redação"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : null}

                <div className={`space-y-4 pb-6 p-3 sm:p-4 ${shellFormularioClass}`}>
            {/* Urgência: prazo fatal + audiência no topo para leitura imediata */}
            <div className="rounded-lg border-2 border-violet-300/50 bg-gradient-to-br from-violet-50/95 via-white to-rose-50/40 p-2 sm:p-2 shadow-sm">
              <div className="flex flex-col lg:flex-row gap-2 lg:items-stretch">
                <div className="lg:w-[min(100%,15.5rem)] shrink-0 rounded-md border-2 border-rose-400/60 bg-gradient-to-b from-rose-50 to-rose-100/80 p-2 shadow-sm ring-1 ring-rose-200/60">
                  <div className="flex items-center gap-1.5 mb-1 text-rose-950">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden />
                    <span className="text-[11px] font-bold uppercase tracking-wide">Urgência</span>
                  </div>
                  <Field label="Prazo Fatal" dense className="w-full [&_label]:text-rose-900">
                    <CampoDataBr
                      value={prazoFatal}
                      readOnly={camposBloqueados}
                      onChange={setPrazoFatal}
                      onBlurExtra={persistirPrazoFatalAposEdicao}
                      placeholder="dd/mm/aaaa"
                      title="Data do prazo fatal (dd/mm/aaaa)"
                      className={`${clsCampoDenso} border-rose-200/80 focus:border-rose-400 focus:ring-rose-200`}
                    />
                  </Field>
                  {featureFlags.useApiTarefas && String(prazoFatal ?? '').trim() ? (
                    <button
                      type="button"
                      onClick={abrirModalTarefaComPrazoFatal}
                      className="mt-1.5 text-[11px] font-medium text-rose-800 hover:text-rose-950 hover:underline text-left w-full leading-tight"
                      title="Abre criação de tarefa com data limite sugerida a partir do prazo fatal"
                    >
                      + Criar tarefa com esta data
                    </button>
                  ) : null}
                </div>
                <div className="flex-1 min-w-0 rounded-md border border-violet-300/70 bg-violet-50/35 p-1.5 sm:p-2">
                  <div
                    className={`flex items-center gap-1.5 mb-1 pb-1 border-b border-violet-200/70 ${
                      camposBloqueados ? '' : 'cursor-pointer select-none'
                    }`}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      if (camposBloqueados) return;
                      abrirAgendaFlutuanteNaDataAudiencia();
                    }}
                    title={
                      camposBloqueados
                        ? undefined
                        : 'Duplo clique para abrir a Agenda nesta data (painel flutuante)'
                    }
                    role="group"
                    aria-label="Audiência — duplo clique para abrir a agenda na data"
                  >
                    <Calendar className="w-4 h-4 text-violet-600 shrink-0" aria-hidden />
                    <span className="text-[11px] font-bold uppercase tracking-wide text-violet-950">Audiência</span>
                    <div className="ml-auto flex items-center gap-1.5 shrink-0">
                      {!camposBloqueados && String(audienciaData ?? '').trim() ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md border border-rose-300/80 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-rose-800 hover:bg-rose-50"
                          onClick={eliminarAgendamentoAudiencia}
                          title="Remove a audiência deste processo e apaga o compromisso nas agendas dos colaboradores"
                        >
                          <Trash2 className="w-3 h-3" aria-hidden />
                          Eliminar agendamento
                        </button>
                      ) : null}
                      {avisoAudiencia === 'avisado' ? (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-400/40">
                          Avisado
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-900 ring-1 ring-amber-400/35">
                          Não avisado
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end gap-x-2 gap-y-1.5">
                    <Field label="Data" className="w-[7.25rem] shrink-0 min-w-0">
                      <CampoDataBr
                        value={audienciaData}
                        readOnly={camposBloqueados}
                        onChange={setAudienciaData}
                        placeholder="dd/mm/aaaa ou hj"
                        className={clsCampo}
                      />
                    </Field>
                    <Field label="Hora" className="w-[5.75rem] shrink-0 min-w-0">
                      <input
                        type="text"
                        value={audienciaHora}
                        ref={audienciaHoraInputRef}
                        readOnly={camposBloqueados}
                        onChange={handleAudienciaHoraChange}
                        onBlur={() => {
                          const norm = normalizarHoraAudiencia(audienciaHora);
                          if (norm) setAudienciaHora(norm);
                        }}
                        placeholder="hh:mm"
                        className={clsCampo}
                      />
                    </Field>
                    <Field
                      label="Tipo de Audiência"
                      className="min-w-0 shrink-0 w-[min(100%,11rem)] max-w-[11rem]"
                      title="Tipo de audiência"
                    >
                      {camposBloqueados ? (
                        <input
                          type="text"
                          value={audienciaTipoCanonico || '—'}
                          readOnly
                          className={`w-full min-w-0 ${clsCampo}`}
                          title={audienciaTipoCanonico || undefined}
                        />
                      ) : (
                        <select
                          value={audienciaTipoCanonico}
                          onChange={(e) => setAudienciaTipo(e.target.value)}
                          className={`w-full min-w-0 ${clsCampo}`}
                        >
                          <option value="">—</option>
                          {TIPOS_AUDIENCIA.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      )}
                    </Field>
                    <div className="w-full shrink-0 min-w-0 sm:w-auto sm:min-w-[10.5rem]">
                      <span className="block text-xs font-semibold text-violet-900 mb-0.5">Aviso</span>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                        <label className={`flex items-center gap-1 text-xs shrink-0 ${camposBloqueados ? 'cursor-default' : 'cursor-pointer'}`}>
                          <input
                            type="radio"
                            name="aviso"
                            checked={avisoAudiencia === 'avisado'}
                            disabled={camposBloqueados}
                            onChange={() => setAvisoAudiencia('avisado')}
                            className="text-violet-600"
                          />
                          Avisado
                        </label>
                        <label className={`flex items-center gap-1 text-xs shrink-0 ${camposBloqueados ? 'cursor-default' : 'cursor-pointer'}`}>
                          <input
                            type="radio"
                            name="aviso"
                            checked={avisoAudiencia === 'nao_avisado'}
                            disabled={camposBloqueados}
                            onChange={() => setAvisoAudiencia('nao_avisado')}
                            className="text-violet-600"
                          />
                          Não avisado
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Seção superior: 3 colunas - Identificação | Status/Partes/Local | Papel/Fase */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-2.5 md:gap-3 md:items-stretch">
              {/* Coluna esquerda: Código + Processo na mesma linha, Cliente, Nº velho/novo */}
              <div className="order-2 space-y-2 rounded-xl border border-slate-200/90 bg-white/95 p-3 shadow-sm text-slate-900 md:order-none">
                <div className="flex flex-wrap items-end gap-3">
                  <Field
                    label="Código do Cliente"
                    title="Único campo editável com «Edição desabilitada» marcada: permite trocar de cliente e recarregar o formulário."
                  >
                    <CampoNumeroComContador
                      variant="embedded"
                      formato="paddedCliente"
                      className="w-[8.75rem] shrink-0"
                      value={codigoCliente}
                      onChange={setCodigoCliente}
                      ariaLabel="Código do Cliente"
                    />
                  </Field>
                  <Field
                    label="Processo"
                    title="Único campo editável com «Edição desabilitada» marcada: permite trocar de processo e recarregar o formulário."
                  >
                    <CampoNumeroComContador
                      variant="embedded"
                      className="w-[7.25rem] shrink-0"
                      value={processo}
                      onChange={setProcesso}
                      min={1}
                      ariaLabel="Número do processo"
                      inputClassName="text-center min-w-[3ch]"
                    />
                  </Field>
                </div>
                <Field
                  label="Cliente"
                  title="Nome / Razão Social do cadastro de Clientes para este código. Somente leitura aqui; altere em Clientes."
                >
                  <input type="text" value={cliente} readOnly className={`${inputDisabledClass} cursor-default`} />
                </Field>
                <Field label="Nº Processo Velho">
                  <input
                    type="text"
                    value={numeroProcessoVelho}
                    readOnly={camposBloqueados}
                    onChange={(e) => setNumeroProcessoVelho(e.target.value)}
                    className={clsCampo}
                  />
                </Field>
                <Field label="Nº Processo Novo">
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={numeroProcessoNovo}
                      readOnly={camposBloqueados}
                      onChange={(e) => setNumeroProcessoNovo(e.target.value)}
                      className={`flex-1 ${clsCampo}`}
                    />
                    <button
                      type="button"
                      title={tituloCopiarPrefixoNumeroProcessoNovo(numeroProcessoNovo)}
                      disabled={!doisPrimeirosBlocosNumeroProcessoNovoParaCopia(numeroProcessoNovo)}
                      className="p-1.5 rounded border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none shrink-0"
                      onClick={() => {
                        const t = doisPrimeirosBlocosNumeroProcessoNovoParaCopia(numeroProcessoNovo);
                        if (hintCopiaNumeroProcessoNovoTimerRef.current != null) {
                          window.clearTimeout(hintCopiaNumeroProcessoNovoTimerRef.current);
                          hintCopiaNumeroProcessoNovoTimerRef.current = null;
                        }
                        if (!t) {
                          setHintCopiaNumeroProcessoNovo('Nada para copiar');
                          hintCopiaNumeroProcessoNovoTimerRef.current = window.setTimeout(
                            () => setHintCopiaNumeroProcessoNovo(''),
                            2000
                          );
                          return;
                        }
                        void navigator.clipboard.writeText(t).then(
                          () => {
                            setHintCopiaNumeroProcessoNovo('Copiado.');
                            hintCopiaNumeroProcessoNovoTimerRef.current = window.setTimeout(
                              () => setHintCopiaNumeroProcessoNovo(''),
                              2000
                            );
                          },
                          () => {
                            setHintCopiaNumeroProcessoNovo('Cópia não disponível neste navegador.');
                            hintCopiaNumeroProcessoNovoTimerRef.current = window.setTimeout(
                              () => setHintCopiaNumeroProcessoNovo(''),
                              2500
                            );
                          }
                        );
                      }}
                    >
                      <Copy className="w-4 h-4 text-slate-600" aria-hidden />
                      <span className="sr-only">Copiar prefixo do nº processo novo</span>
                    </button>
                    <button
                      type="button"
                      disabled={camposBloqueados}
                      className="p-1.5 rounded border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:pointer-events-none"
                      title="Documentos"
                    >
                      <FolderOpen className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                  {hintCopiaNumeroProcessoNovo ? (
                    <p className="mt-0.5 text-xs text-emerald-800" role="status">
                      {hintCopiaNumeroProcessoNovo}
                    </p>
                  ) : null}
                </Field>
              </div>

              {/* Coluna central: Status, Partes, Consulta, Estado+Cidade */}
              <div className="order-3 space-y-2 rounded-xl border border-slate-200/90 bg-white/95 p-3 shadow-sm text-slate-900 md:order-none">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                  <span className="text-sm font-medium text-slate-700 shrink-0">Status</span>
                  <label className={`flex items-center gap-1.5 text-sm shrink-0 ${camposBloqueados ? 'cursor-default' : 'cursor-pointer'}`}>
                    <input
                      type="radio"
                      name="status"
                      checked={statusAtivo}
                      disabled={camposBloqueados}
                      onChange={() => setStatusAtivo(true)}
                      className="text-slate-600"
                    />
                    Ativo
                  </label>
                  <label className={`flex items-center gap-1.5 text-sm shrink-0 ${camposBloqueados ? 'cursor-default' : 'cursor-pointer'}`}>
                    <input
                      type="radio"
                      name="status"
                      checked={!statusAtivo}
                      disabled={camposBloqueados}
                      onChange={() => setStatusAtivo(false)}
                      className="text-slate-600"
                    />
                    Inativo
                  </label>
                </div>
                <div className="rounded-lg border border-indigo-200/60 bg-indigo-50/40 p-2.5 shadow-sm space-y-2">
                  <Field label="Parte Cliente">
                    <input
                      type="text"
                      value={textoParteCliente}
                      readOnly
                      className={`w-full min-w-0 ${inputDisabledClass}`}
                      title={textoParteCliente}
                    />
                  </Field>
                  <Field label="Parte Oposta">
                    <input
                      type="text"
                      value={textoParteOposta}
                      readOnly
                      className={`w-full min-w-0 ${inputDisabledClass}`}
                      title={textoParteOposta}
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={abrirModalDetalhesPartes}
                    className={processosBtnOutlineIndigo + " w-full"}
                    title="Partes e advogados — disponível mesmo com «Edição Desabilitada» marcada."
                  >
                    Detalhes das partes
                  </button>
                </div>
                <label className={`flex items-center gap-2 text-sm text-slate-600 ${camposBloqueados ? 'cursor-default' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={consultaAutomatica}
                    disabled={camposBloqueados}
                    onChange={(e) => setConsultaAutomatica(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Consulta Automática
                </label>
                <Field label="Cidade/Comarca" className="min-w-0 col-span-2">
                  {camposBloqueados ? (
                    <input
                      type="text"
                      readOnly
                      value={cidade && estado ? `${cidade} (${estado})` : cidade || estado || ''}
                      className={`w-full min-w-0 ${clsCampo}`}
                    />
                  ) : (
                    <>
                      <MunicipioAutocomplete
                        value={municipioSelecionado}
                        uf={estado || 'GO'}
                        onUfChange={(sigla) => setEstado(sigla)}
                        onChange={(sel) => {
                          // Trocar de cidade limpa a vara (evita inconsistência cidade × órgão).
                          setOrgaoJulgadorSelecionado(null);
                          setMunicipioSelecionado(sel);
                          if (sel) {
                            setEstado(sel.uf || sel.municipio?.uf || '');
                            setCidade(sel.municipio?.nome || sel.nome || '');
                          } else {
                            setCidade('');
                          }
                        }}
                        idPrefix="processo-municipio"
                        className={`w-full min-w-0 ${inputClass}`}
                      />
                      {!Number(processoApiId) && !municipioSelecionado?.municipioId ? (
                        <p className="text-xs text-rose-700 mt-1">Obrigatório para novos processos.</p>
                      ) : null}
                    </>
                  )}
                </Field>
                <Field label="Órgão julgador" className="min-w-0 col-span-2">
                  {!camposBloqueados ? (
                    <label className="flex items-center gap-2 text-sm text-slate-600 mb-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={varaADistribuir}
                        disabled={!municipioSelecionado?.municipioId}
                        onChange={(e) => {
                          const marcado = e.target.checked;
                          setVaraADistribuir(marcado);
                          if (marcado) setOrgaoJulgadorSelecionado(null);
                        }}
                        className="rounded border-slate-300 disabled:opacity-40"
                      />
                      Vara a distribuir (sorteio pendente)
                    </label>
                  ) : null}
                  {camposBloqueados ? (
                    <input
                      type="text"
                      readOnly
                      value={
                        orgaoJulgadorSelecionado?.orgaoJulgador?.nome ||
                        (municipioSelecionado?.municipioId ? 'A distribuir' : '')
                      }
                      className={`w-full min-w-0 ${clsCampo}`}
                    />
                  ) : varaADistribuir ? (
                    <input
                      type="text"
                      readOnly
                      value="A distribuir (defina a vara após o sorteio)"
                      className={`w-full min-w-0 ${clsCampo}`}
                    />
                  ) : (
                    <OrgaoJulgadorAutocomplete
                      value={orgaoJulgadorSelecionado}
                      tribunal="TJGO"
                      municipioId={municipioSelecionado?.municipioId}
                      disabled={!municipioSelecionado?.municipioId}
                      placeholder={
                        municipioSelecionado?.municipioId
                          ? 'Digite para buscar vara, juizado ou câmara…'
                          : 'Escolha a cidade primeiro'
                      }
                      onChange={(sel) => {
                        setOrgaoJulgadorSelecionado(sel);
                        if (sel) setVaraADistribuir(false);
                        const mun = sel?.orgaoJulgador?.municipio;
                        if (mun) {
                          setEstado(mun.uf || '');
                          setCidade(mun.nome || '');
                          setMunicipioSelecionado({
                            municipioId: mun.id,
                            municipio: mun,
                          });
                        }
                      }}
                      idPrefix="processo-orgao"
                      className={`w-full min-w-0 ${inputClass}`}
                    />
                  )}
                </Field>
                {!camposBloqueados && !municipioSelecionado?.municipioId && (cidade || estado) ? (
                  // Legado sem municipio_id: o autocomplete "Cidade/Comarca" fica vazio na edição,
                  // então preserva a exibição da comarca (evita processo legado sem cidade visível).
                  <Field label="Comarca (legado)" className="min-w-0 col-span-2">
                    <input
                      type="text"
                      readOnly
                      value={cidade && estado ? `${cidade} (${estado})` : cidade || estado}
                      className={`w-full min-w-0 ${clsCampo}`}
                    />
                  </Field>
                ) : null}
              </div>

              {/* Coluna direita: Papel, Fase processual, Observação de Fase — primeiro no mobile */}
              <div className="order-1 flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-white/95 p-3 shadow-sm text-slate-900 md:order-none">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 shrink-0">
                  <span className="text-sm font-medium text-slate-700 shrink-0">Cliente é</span>
                  {camposBloqueados ? (
                    <input
                      type="text"
                      readOnly
                      value={papelParte === 'requerente' ? 'Requerente' : 'Requerido'}
                      className={`min-w-[7.5rem] w-auto max-w-[10rem] ${clsCampo}`}
                    />
                  ) : (
                    <select
                      value={papelParte}
                      onChange={(e) => setPapelParte(e.target.value)}
                      className={`min-w-[7.5rem] w-auto max-w-[10rem] ${inputClass}`}
                    >
                      <option value="requerente">Requerente</option>
                      <option value="requerido">Requerido</option>
                    </select>
                  )}
                </div>
                {statusAtivo ? (
                  <>
                    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 shrink-0">
                      <p className="text-sm font-semibold text-blue-800 mb-3">Fase processual</p>
                      <div className="flex flex-wrap gap-2 max-h-[12rem] overflow-y-auto">
                        {FASES.map((f) => {
                          const ativa = faseParaRadiosProcessos === f;
                          return (
                            <button key={f} type="button" disabled={camposBloqueados} onClick={() => { setFaseSelecionada(f); salvarHistoricoDoProcesso(montarPayloadRegistroProcesso({ faseSelecionada: f })); }} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 hover:scale-105 ${ativa ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}>{f}</button>
                          );
                        })}
                      </div>
                    </div>
                    <Field label="Observação de Fase" className="flex flex-1 flex-col min-h-[10rem] min-w-0">
                      <textarea
                        value={faseCampo}
                        readOnly={camposBloqueados}
                        onChange={(e) => setFaseCampo(e.target.value)}
                        rows={6}
                        className={`flex-1 min-h-[10rem] w-full resize-y ${clsCampo} leading-snug`}
                      />
                    </Field>
                  </>
                ) : null}
              </div>
            </section>

            {/* Dados processuais — grelha 12 col em md+; campos densos */}
            <section className="border-t border-slate-200/80 pt-2">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 shadow-sm shrink-0" aria-hidden />
                <h2 className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight leading-none">
                  Dados processuais e administrativos
                </h2>
              </div>
              <div className="rounded-lg border border-slate-200/90 bg-white/90 p-2 sm:p-2.5 shadow-sm text-slate-900">
                <div className="grid grid-cols-2 md:grid-cols-12 gap-x-2 gap-y-1.5">
                  <Field label="Data do Protocolo" dense className="col-span-1 md:col-span-2 min-w-0">
                    <input
                      type="text"
                      value={dataProtocolo}
                      readOnly={camposBloqueados}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDataProtocolo(resolverAliasHojeEmTexto(v, 'br') ?? v);
                      }}
                      placeholder="dd/mm/aaaa ou hj"
                      className={clsCampoDenso}
                    />
                  </Field>
                  <Field label="Pasta do Processo" dense className="col-span-1 md:col-span-3 min-w-0">
                    <input
                      type="text"
                      value={pasta}
                      readOnly={camposBloqueados}
                      onChange={(e) => setPasta(e.target.value)}
                      className={clsCampoDenso}
                    />
                  </Field>
                  <Field label="Responsável" dense className="col-span-1 md:col-span-3 min-w-0">
                    <select
                      value={usuarioResponsavelId}
                      disabled={camposBloqueados}
                      onChange={(e) => alterarResponsavelProcesso(e.target.value)}
                      className={clsCampoDenso}
                    >
                      <option value="">(nenhum)</option>
                      {colaboradoresResponsavel.map((u) => (
                        <option key={u.id} value={u.id}>
                          {getNomeExibicaoUsuario(u)}
                        </option>
                      ))}
                      {usuarioResponsavelId &&
                      !colaboradoresResponsavel.some((u) => String(u.id) === String(usuarioResponsavelId)) ? (
                        <option value={usuarioResponsavelId}>
                          {String(responsavel || usuarioResponsavelId).trim() || usuarioResponsavelId}
                        </option>
                      ) : null}
                    </select>
                  </Field>
                                    <div className="col-span-2 md:col-span-4 min-w-0 border-l-4 border-emerald-500 pl-3">
                    <Field label="Valor da Causa" dense>
                      <input
                        type="text"
                        value={valorCausa}
                        readOnly={camposBloqueados}
                        onChange={(e) => setValorCausa(e.target.value)}
                        className={clsCampoDenso}
                      />
                    </Field>
                  </div>
                  <Field label="Natureza da Ação" dense className="col-span-2 md:col-span-3 min-w-0">
                    <input
                      type="text"
                      value={naturezaAcao}
                      readOnly={camposBloqueados}
                      onChange={(e) => setNaturezaAcao(e.target.value)}
                      className={clsCampoDenso}
                    />
                  </Field>
                  <Field label="Competência" dense className="col-span-2 md:col-span-6 min-w-0">
                    <div className="flex gap-0.5">
                      {camposBloqueados ? (
                        <input type="text" readOnly value={competencia} className={`flex-1 min-w-0 ${clsCampoDenso}`} title={competencia} />
                      ) : (
                        <select
                          value={competencia ?? ''}
                          onChange={(e) => setCompetencia(e.target.value)}
                          className={`flex-1 min-w-0 ${inputClassDenso}`}
                        >
                          <option value="">— Selecione —</option>
                          {COMPETENCIAS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        type="button"
                        disabled={camposBloqueados}
                        className="p-1 rounded border border-slate-300 hover:bg-slate-100 shrink-0 disabled:opacity-50 disabled:pointer-events-none"
                      >
                        <Search className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                    </div>
                  </Field>
                  <Field label="Observação" dense className="col-span-2 md:col-span-12 min-w-0">
                    <textarea
                      value={observacao}
                      readOnly={camposBloqueados}
                      onChange={(e) => setObservacao(e.target.value)}
                      rows={2}
                      className={`${clsCampoDenso} resize-y min-h-0 py-1 leading-snug`}
                    />
                  </Field>
                  <div className="col-span-2 md:col-span-12 rounded-md border border-teal-200/70 bg-gradient-to-r from-teal-50/80 to-slate-50/80 px-2 py-1.5">
                    <h3 className="text-[10px] font-bold uppercase tracking-wide text-teal-900 pb-1 mb-1 border-b border-teal-200/50 leading-none">
                      Periodicidade e tramitação
                    </h3>
                    <div className="flex flex-wrap items-end gap-x-1.5 gap-y-1">
                      <button
                        type="button"
                        onClick={abrirLinkPastaArquivo}
                        className="shrink-0 px-2.5 py-1 rounded-md border border-teal-300/80 bg-white text-teal-900 text-xs font-semibold hover:bg-teal-50 self-end"
                        title="Abre o link da pasta do arquivo, se informado"
                      >
                        Link p/ pasta
                      </button>
                      <Field
                        label="Periodicidade Consulta"
                        dense
                        className="min-w-0 shrink-0 w-[min(100%,13rem)] max-w-[13rem]"
                        title="Editável mesmo com «Edição desabilitada» marcada"
                      >
                        <select
                          value={periodicidadeConsulta}
                          onChange={(e) => setPeriodicidadeConsulta(e.target.value)}
                          className={`w-full min-w-0 ${inputClassDenso}`}
                        >
                          <option value="">—</option>
                          <option value="Diária">Diária</option>
                          <option value="Semanal">Semanal</option>
                          <option value="Quinzenal">Quinzenal</option>
                          <option value="Mensal">Mensal</option>
                          <option value="Bimestral">Bimestral</option>
                          <option value="Trimensal">Trimensal</option>
                          <option value="Semestral">Semestral</option>
                          <option value="Anual">Anual</option>
                        </select>
                      </Field>
                      <button
                        type="button"
                        onClick={abrirModalTramitacao}
                        className={processosBtnIndigo + " shrink-0 self-end text-sm py-2"}
                        title="Editável mesmo com «Edição desabilitada» marcada"
                      >
                        Tramitação
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Unidade do processo (persistida na API); independente do vínculo com Imóveis */}
            <section className="rounded-lg border border-slate-200/90 bg-white px-2.5 py-2 mt-1.5 shadow-sm">
              <p className="w-full text-[10px] text-slate-600 leading-snug mb-1.5">
                <strong className="text-slate-800">Unidade:</strong> gravada no processo (ex.: código condominial A-0103). Se estiver vazia e você vincular um imóvel abaixo, o campo pode ser preenchido automaticamente pelo cadastro de Imóveis.
              </p>
              <Field
                label="Unidade"
                className="w-full min-w-0 max-w-[16rem]"
                title="Unidade condominial ou identificação da fração — salva no processo."
              >
                <input
                  type="text"
                  value={unidadeEndereco}
                  readOnly={camposBloqueados}
                  onChange={(e) => {
                    setUnidadeEndereco(e.target.value);
                    setUnidadeEnderecoManual(true);
                  }}
                  className={`w-full min-w-0 ${clsCampo}`}
                  placeholder="(vazio)"
                />
              </Field>
            </section>

            {/* Imóvel / agenda / cálculos — barra operacional */}
            <section className="rounded-lg border border-sky-200/80 bg-gradient-to-r from-sky-50/90 via-white to-cyan-50/50 px-2.5 py-2 mt-1.5 shadow-sm">
              <p className="w-full text-[10px] text-sky-900/80 leading-snug mb-1.5">
                <strong className="text-sky-950">Imóveis:</strong> informe o nº sequencial do cadastro Imóveis (col. A) ou <strong>duplo clique</strong> no campo para buscar. Ao sair do campo, o par <strong>Código + Proc.</strong> atual é vinculado na API e passa a aparecer em <strong>Abrir Proc.</strong> na ficha do imóvel. A <strong>Unidade</strong> acima preenche-se se estiver vazia.
              </p>
              <div className="flex flex-wrap items-end gap-2">
              <button
                type="button"
                disabled={camposBloqueados}
                onClick={abrirAgendaEmLote}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-sky-400/70 bg-white text-sky-900 text-xs font-semibold hover:bg-sky-50 disabled:opacity-50 disabled:pointer-events-none"
              >
                <Calendar className="w-4 h-4" /> Agenda Em lote
              </button>
              <Field
                label="Imóvel"
                className="w-24"
                title="Número do imóvel na tela Imóveis (col. A) — duplo clique para buscar no cadastro."
              >
                <input
                  type="number"
                  value={imovelId}
                  readOnly={camposBloqueados}
                  onChange={(e) => {
                    setImovelId(e.target.value);
                    setImovelManual(true);
                  }}
                  onBlur={() => void handleImovelIdBlur()}
                  onDoubleClick={() => {
                    if (camposBloqueados) return;
                    setModalBuscaImovelAberto(true);
                  }}
                  className={clsCampo}
                  placeholder="(vazio)"
                  disabled={imovelVinculando}
                />
              </Field>
              {imovelVinculando ? (
                <span className="text-[10px] text-sky-800 self-center">Vinculando…</span>
              ) : null}
              {imovelVinculoMsg ? (
                <p className="w-full text-[10px] text-sky-900/90 leading-snug basis-full">{imovelVinculoMsg}</p>
              ) : null}
              <button
                type="button"
                onClick={handleAbrirImovel}
                title="Abre o cadastro Imóveis com este nº (ou vínculo mock). Sempre disponível, inclusive com «Edição desabilitada»."
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-300 bg-white text-sky-900 text-sm font-medium hover:bg-sky-50 shadow-sm"
              >
                <SidebarMenuIcon id="admin-imoveis-grupo" className="w-4 h-4" /> Abrir Imóvel
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate('/calculos', { state: buildRouterStateChaveClienteProcesso(codigoCliente, processo) });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-950 text-sm font-medium hover:bg-indigo-100 shadow-sm"
              >
                <SidebarMenuIcon id="calcular-grupo" className="w-4 h-4" /> Cálculos
              </button>
              </div>
            </section>

            {/* Abas: Histórico do Processo | Publicações | Observações | Execução */}
            <section ref={abasProcessoRef} className="mt-2">
                            <div className="flex flex-wrap items-end gap-0.5 bg-white shadow-sm rounded-t-xl px-1 pt-1" role="tablist">
                <ProcessosTabButton id="tab-historico" label="Histórico do Processo" active={tabAtiva === 'historico'} count={historico.length} onClick={() => setTabAtiva('historico')} />
                <ProcessosTabButton id="tab-publicacoes" label="Publicações" active={tabAtiva === 'publicacoes'} count={publicacoesRelatorioItens?.length ?? 0} onClick={() => setTabAtiva('publicacoes')} />
                <ProcessosTabButton id="tab-movemail" label="Mov. por Email" active={tabAtiva === 'movemail'} count={movEmailItens?.length ?? 0} onClick={() => setTabAtiva('movemail')} />
                <ProcessosTabButton id="tab-remuneracao" label="Remuneração" active={tabAtiva === 'remuneracao'} onClick={() => setTabAtiva('remuneracao')} />
                <ProcessosTabButton id="tab-whatsapp" label="WhatsApp" active={tabAtiva === 'whatsapp'} onClick={() => setTabAtiva('whatsapp')} />
                <ProcessosTabButton id="tab-observacoes" label="Observações" active={tabAtiva === 'observacoes'} onClick={() => setTabAtiva('observacoes')} />
                <ProcessosTabButton id="tab-execucao" label="Execução" active={tabAtiva === 'execucao'} onClick={() => setTabAtiva('execucao')} />
              </div>
              {tabAtiva === 'historico' && (
                <div className="border border-slate-200 rounded-b-xl overflow-hidden bg-white shadow-sm p-0">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-sm font-medium text-slate-700 mb-0.5">Próxima informação</label>
                      <input
                        type="text"
                        value={proximaInformacao}
                        onChange={(e) => setProximaInformacao(e.target.value)}
                        placeholder="Digite a próxima informação a ser inserida..."
                        className={`${inputClass} focus:ring-teal-400 focus:border-teal-400`}
                        title="Editável mesmo com «Edição Desabilitada» — para incluir andamento no histórico"
                      />
                    </div>
                    <div className="w-36">
                      <label className="block text-sm font-medium text-slate-700 mb-0.5">Data</label>
                      <input
                        type="text"
                        value={dataProximaInformacao}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDataProximaInformacao(resolverAliasHojeEmTexto(v, 'br') ?? v);
                        }}
                        placeholder="dd/mm/aaaa ou hj"
                        className={inputClass}
                        title="Editável mesmo com «Edição Desabilitada»"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={manterInformacaoNoHistorico}
                      className={processosBtnPrimary + " whitespace-nowrap"}
                      title="Grava a informação no histórico (disponível mesmo com edição do formulário desabilitada)"
                    >
                      Manter Inf.
                    </button>
                    {podeDesfazerUltimaInformacaoHistorico ? (
                      <button
                        type="button"
                        onClick={desfazerUltimaInformacaoHistorico}
                        disabled={apiSaving}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-amber-300 bg-amber-50 text-amber-900 text-sm hover:bg-amber-100 whitespace-nowrap disabled:opacity-50"
                        title="Remove só a informação mais recente, se foi inserida por você (correção de digitação acidental)"
                      >
                        <Undo2 className="w-4 h-4 shrink-0" />
                        Desfazer última
                      </button>
                    ) : null}
                  </div>
                  <div className="space-y-2 border-t border-slate-200 p-2 md:hidden">
                    {historicoApiCarregando ? (
                      <p className="py-4 text-center text-sm text-slate-500">A carregar histórico…</p>
                    ) : historicoPaginado.length === 0 ? (
                      <p className="py-4 text-center text-sm text-slate-500">Nenhum registro.</p>
                    ) : (
                      historicoPaginado.map((h, rowIdx) => (
                        <button
                          key={`hist-m-${h.id}-${rowIdx}`}
                          type="button"
                          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm ring-1 ring-slate-100/80 active:bg-slate-50"
                          onClick={() =>
                            setInformacaoModal({
                              info: h.info,
                              inf: h.inf,
                              data: h.data,
                              usuario: h.usuario,
                              usuarioId: h.usuarioId,
                            })
                          }
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-xs text-slate-500">
                            <span className="font-mono font-semibold text-slate-700">Inf. {h.inf}</span>
                            <span className="shrink-0 text-slate-600">{h.data}</span>
                          </div>
                          <p className="mt-2 line-clamp-3 text-sm text-slate-800" title={h.info}>
                            {h.info}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500" title={rotuloUsuarioHistoricoLinha(h)}>
                            <AutorUsuarioExibicao {...autorHistoricoLinha(h)} />
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="hidden max-h-[min(72vh,56rem)] min-h-[8rem] overflow-x-auto overflow-y-auto md:block">
                    <table className="w-full table-fixed border-collapse text-sm">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr>
                          <th className="w-[6.25rem] shrink-0 py-2.5 pl-3 pr-6 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                            Inf.
                          </th>
                          <th className="min-w-0 w-[72%] py-1.5 pl-2 pr-3 text-left font-semibold text-slate-700">
                            Informação
                          </th>
                          <th className="w-28 shrink-0 whitespace-nowrap px-2 py-1.5 text-left font-semibold text-slate-700">
                            Data
                          </th>
                          <th className="w-[11ch] max-w-[11ch] shrink-0 py-1.5 pl-2 pr-2 text-left font-semibold text-slate-700">
                            Usuário
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {historicoApiCarregando ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                              A carregar histórico…
                            </td>
                          </tr>
                        ) : historicoPaginado.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                              Nenhum registro.
                            </td>
                          </tr>
                        ) : (
                          <>
                            {historicoPaginado.map((h, rowIdx) => (
                              <tr
                                key={`hist-d-${h.id}-${rowIdx}`}
                                className="cursor-pointer border-t border-slate-100 even:bg-slate-50/40 hover:bg-slate-100 transition-colors"
                                onDoubleClick={() =>
                                  setInformacaoModal({
                                    info: h.info,
                                    inf: h.inf,
                                    data: h.data,
                                    usuario: h.usuario,
                                    usuarioId: h.usuarioId,
                                  })
                                }
                                title="Duplo clique para ver o texto completo"
                              >
                                <td className="whitespace-nowrap py-1.5 pl-2 pr-6 align-top text-slate-700">Inf.: {h.inf}</td>
                                <td className="min-w-0 py-1.5 pl-2 pr-3 align-top text-slate-800">
                                  <div className="truncate" title={h.info}>
                                    {h.info}
                                  </div>
                                </td>
                                <td className="whitespace-nowrap px-2 py-1.5 align-top text-slate-600">{h.data}</td>
                                <td className="max-w-[11ch] min-w-0 py-1.5 pl-2 pr-2 align-top text-slate-700">
                                  <div className="truncate" title={rotuloUsuarioHistoricoLinha(h)}>
                                    <AutorUsuarioExibicao {...autorHistoricoLinha(h)} />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setPaginaHistorico((p) => Math.min(p + 1, totalPaginasHistorico))}
                      disabled={paginaHistorico >= totalPaginasHistorico}
                      className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ← Informações anteriores
                    </button>
                    <span className="text-sm text-slate-600">
                      Página {paginaHistorico} de {totalPaginasHistorico}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPaginaHistorico((p) => Math.max(p - 1, 1))}
                      disabled={paginaHistorico <= 1}
                      className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Próxima →
                    </button>
                  </div>
                </div>
              )}
              {tabAtiva === 'publicacoes' && (
                <div className="border border-slate-300 rounded-b-lg overflow-hidden bg-white shadow-sm -mt-px flex flex-col max-h-[min(72vh,56rem)]">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
                    <p className="text-sm text-slate-600">
                      Registos vinculados a este processo após importação e confirmação em{' '}
                      <strong className="text-slate-800">Processos → Publicações</strong>.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/processos/publicacoes')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-300 bg-white text-sky-900 text-sm font-medium hover:bg-sky-50 shadow-sm shrink-0"
                    >
                      <Newspaper className="w-4 h-4 shrink-0" aria-hidden />
                      Abrir Publicações
                    </button>
                  </div>
                  <div className="flex flex-col flex-1 min-h-0 overflow-auto">
                    <PublicacoesRelatorioConteudo
                      itens={publicacoesRelatorioItens}
                      carregando={publicacoesRelatorioCarregando}
                      erro={publicacoesRelatorioErro}
                      relatorioMeta={publicacoesRelatorioMeta}
                      compact
                    />
                  </div>
                </div>
              )}
              {tabAtiva === 'movemail' && (
                <div className="border border-slate-300 rounded-b-lg overflow-hidden bg-white shadow-sm -mt-px flex flex-col max-h-[min(72vh,56rem)]">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
                    <p className="text-sm text-slate-600">
                      Movimentações importadas por e-mail (Projudi TJGO + PUSH dos TRTs/PJe) vinculadas a este processo, de{' '}
                      <strong className="text-slate-800">Movimentações Email</strong>.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/processos/manifestacoes-projudi')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-300 bg-white text-sky-900 text-sm font-medium hover:bg-sky-50 shadow-sm shrink-0"
                    >
                      <Newspaper className="w-4 h-4 shrink-0" aria-hidden />
                      Abrir Movimentações Email
                    </button>
                  </div>
                  <div className="flex flex-col flex-1 min-h-0 overflow-auto">
                    <PublicacoesRelatorioConteudo
                      itens={movEmailItens}
                      carregando={movEmailCarregando}
                      erro={movEmailErro}
                      relatorioMeta={movEmailMeta}
                      compact
                    />
                  </div>
                </div>
              )}
              {tabAtiva === 'observacoes' && (
                <div className="border border-slate-300 rounded-b-lg p-4 bg-white shadow-sm -mt-px">
                  <p className="text-sm text-slate-500">Conteúdo da aba Observações.</p>
                </div>
              )}
              {tabAtiva === 'remuneracao' && (
                <div className="border border-slate-300 rounded-b-lg p-4 bg-white shadow-sm -mt-px">
                  <ProcessoRemuneracaoSecao
                    processoApiId={processoApiId}
                    codigoCliente={codigoCliente}
                    numeroInterno={processo}
                    pessoaIdContratante={parteClienteIds[0] ?? null}
                    onAbrirGerarContrato={() => void handleAbrirGerarContratoHonorarios()}
                  />
                </div>
              )}
              {tabAtiva === 'whatsapp' && (
                <div className="border border-slate-300 rounded-b-lg p-4 bg-white shadow-sm -mt-px">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                    <MessageCircle className="h-4 w-4 text-emerald-600" />
                    <h3 className="text-sm font-semibold text-slate-800">Cobranças WhatsApp enviadas</h3>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">
                    Mensagens do template <strong>cobranca_pagamento</strong> disparadas ou agendadas para este processo.
                  </p>
                  <ProcessoWhatsAppContatosSecao processoApiId={processoApiId} />
                </div>
              )}
              {tabAtiva === 'execucao' && (
                <div className="border border-slate-300 rounded-b-lg p-4 bg-white shadow-sm -mt-px">
                  <p className="text-sm text-slate-500">Conteúdo da aba Execução.</p>
                </div>
              )}
            </section>

            {/* Rodapé */}
            <footer className="flex flex-wrap gap-2 pt-3 border-t border-slate-200">
              <button type="button" className={processosLinkClass}>
                Texto para Área de Trasnf.
              </button>
            </footer>
          </div>

      {modalTramitacaoAberto && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-tramitacao-titulo"
          onMouseDown={onModalOverlayMouseDown}
          onClick={criarModalOverlayClickFechar(fecharModalTramitacao)}
        >
          <div
            className="flex h-full w-full max-w-none flex-col rounded-none border border-slate-200 bg-white shadow-xl md:h-auto md:max-h-[min(90vh,36rem)] md:max-w-md md:rounded-lg"
            onMouseDown={onModalPanelMouseDown}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-3 md:px-4">
              <button
                type="button"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
                aria-label="Voltar"
                onClick={fecharModalTramitacao}
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
              <h2 id="modal-tramitacao-titulo" className="min-w-0 flex-1 text-base font-semibold text-slate-800">
                Tramitação dos Autos
              </h2>
              <button
                type="button"
                onClick={fecharModalTramitacao}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sistema</p>
                {TRAMITACAO_OPCOES.map((op) => (
                  <label key={op} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="tramitacao-autos"
                      checked={tramitacaoDraft === op}
                      onChange={() => {
                        setTramitacaoDraft(op);
                        if (op === 'PJe' && !pjeTribunalDraft) {
                          const det = detectarPjeTribunalPorCnj(numeroProcessoNovo);
                          if (det.codigo) setPjeTribunalDraft(det.codigo);
                        }
                      }}
                      className="text-slate-600"
                    />
                    {op === 'TJ Go - Autos Físicos' ? 'Autos físicos' : op}
                  </label>
                ))}
              </div>

              {tramitacaoDraft === 'PJe' && (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <label htmlFor="pje-tribunal-select" className="mb-1 block text-xs font-semibold text-slate-600">
                      Tribunal
                    </label>
                    <select
                      id="pje-tribunal-select"
                      className={processosInputClass}
                      value={pjeTribunalDraft}
                      onChange={(e) => setPjeTribunalDraft(e.target.value)}
                    >
                      <option value="">PJe (tribunal não mapeado)</option>
                      {PJE_TRIBUNAL_OPCOES.map((t) => (
                        <option key={t.codigo} value={t.codigo}>
                          {t.rotulo}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-slate-600">Grau</p>
                    <div className="flex flex-wrap gap-4">
                      {PJE_GRAU_OPCOES.map((g) => (
                        <label key={g.codigo} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="pje-grau-autos"
                            checked={pjeGrauDraft === g.codigo}
                            onChange={() => setPjeGrauDraft(g.codigo)}
                            className="text-slate-600"
                          />
                          {g.rotulo}
                        </label>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Automação de cópia integral disponível hoje só para TRT18; outros tribunais ficam registrados.
                  </p>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={fecharModalTramitacao}
                className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => void confirmarTramitacao()}
                className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {modalAcoesRedacaoAberto && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-acoes-redacao-titulo"
          onMouseDown={onModalOverlayMouseDown}
          onClick={criarModalOverlayClickFechar(() => setModalAcoesRedacaoAberto(false))}
        >
          <div
            className="flex h-full max-h-none w-full max-w-none flex-col rounded-none border border-slate-200 bg-white shadow-xl md:max-h-[min(90vh,28rem)] md:max-w-md md:rounded-lg"
            onMouseDown={onModalPanelMouseDown}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-3 md:px-4">
              <button
                type="button"
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
                aria-label="Voltar"
                onClick={() => setModalAcoesRedacaoAberto(false)}
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
              <h2 id="modal-acoes-redacao-titulo" className="min-w-0 flex-1 pr-2 text-base font-semibold text-slate-800">
                Tipo de ação
              </h2>
              <button
                type="button"
                onClick={() => setModalAcoesRedacaoAberto(false)}
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="px-4 pt-3 pb-2 text-sm text-slate-600 border-b border-slate-100 shrink-0">
              Processo selecionado: <strong className="text-slate-800">Cliente {String(codigoCliente ?? '').trim()}</strong>
              {' · '}
              <strong className="text-slate-800">Proc. {Number(processo)}</strong>
              {processoApiId != null && Number.isFinite(Number(processoApiId)) ? (
                <span className="text-slate-500"> (API #{processoApiId})</span>
              ) : null}
            </p>
            <p className="px-4 py-2 text-xs text-slate-500 shrink-0">
              Use as setas para percorrer a lista (cíclica), Enter para confirmar, Esc para fechar.
            </p>
            <div className="px-2 pb-3 flex-1 min-h-0 overflow-y-auto" aria-label="Opções de tipo de ação">
              <ul className="flex flex-col gap-1 list-none p-0 m-0">
                {ACOES_REDACAO_PROCESSO.map((op, i) => {
                  const ativa = i === indiceAcaoRedacaoFocada;
                  return (
                    <li key={op.id}>
                      <button
                        type="button"
                        id={`acao-redacao-op-${i}`}
                        role="option"
                        aria-selected={ativa}
                        onClick={() => confirmarAcaoRedacaoPorIndice(i)}
                        onMouseEnter={() => setIndiceAcaoRedacaoFocada(i)}
                        className={`w-full text-left px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                          ativa
                            ? 'border-blue-500 bg-blue-50 text-blue-950 ring-2 ring-blue-400 ring-offset-1'
                            : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        {op.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setModalAcoesRedacaoAberto(false)}
                className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalAgendaAudiencia.aberto && modalAgendaAudiencia.dataBr ? (
        <div
          className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/50 p-0 backdrop-blur-[2px] md:items-center md:p-3"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-agenda-audiencia-titulo"
          onMouseDown={onModalOverlayMouseDown}
          onClick={criarModalOverlayClickFechar(() =>
            setModalAgendaAudiencia({ aberto: false, dataBr: null, revision: 0 })
          )}
        >
          <div
            className="flex h-full w-full max-w-none flex-col overflow-hidden border-0 border-slate-200 bg-white shadow-2xl md:h-[min(92vh,900px)] md:max-h-[92vh] md:max-w-[min(96vw,1800px)] md:rounded-2xl md:border md:border-slate-200/90"
            onMouseDown={onModalPanelMouseDown}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-gradient-to-r from-sky-600 to-indigo-700 px-3 py-3 text-white shadow-md md:rounded-t-2xl">
              <button
                type="button"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/25 bg-white/10 text-white hover:bg-white/20 md:hidden"
                aria-label="Voltar"
                onClick={() => setModalAgendaAudiencia({ aberto: false, dataBr: null, revision: 0 })}
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
              <h2 id="modal-agenda-audiencia-titulo" className="min-w-0 flex-1 text-base font-semibold tracking-tight">
                Agenda — {modalAgendaAudiencia.dataBr}
              </h2>
              <button
                type="button"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/20 bg-white/15 text-white hover:bg-white/25"
                aria-label="Fechar agenda"
                onClick={() => setModalAgendaAudiencia({ aberto: false, dataBr: null, revision: 0 })}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden bg-slate-50/80">
              <Suspense
                fallback={
                  <div className="flex h-48 items-center justify-center text-sm text-slate-600">A carregar agenda…</div>
                }
              >
                <AgendaModal
                  focoDataBr={modalAgendaAudiencia.dataBr}
                  focoRevision={modalAgendaAudiencia.revision}
                  modoFlutuante
                />
              </Suspense>
            </div>
          </div>
        </div>
      ) : null}

      {modalAgendaLoteAberto && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-agenda-lote-titulo"
          onMouseDown={onModalOverlayMouseDown}
          onClick={criarModalOverlayClickFechar(() => setModalAgendaLoteAberto(false))}
        >
          <div
            className="flex h-full w-full max-w-none flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-xl md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-lg"
            onMouseDown={onModalPanelMouseDown}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-3 md:px-4">
              <button
                type="button"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
                aria-label="Voltar"
                onClick={() => setModalAgendaLoteAberto(false)}
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
              <h2 id="modal-agenda-lote-titulo" className="min-w-0 flex-1 text-base font-semibold text-slate-800">
                Agendamento em lote
              </h2>
              <button
                type="button"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
                onClick={() => setModalAgendaLoteAberto(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <div className="text-sm text-slate-600">
                Este compromisso será lançado para <strong>Dr. Itamar</strong>, <strong>Karla</strong> e <strong>Ana Luisa</strong>.
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Texto do compromisso</label>
                <textarea
                  value={agendaLoteTexto}
                  onChange={(e) => setAgendaLoteTexto(e.target.value)}
                  rows={2}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-base md:text-sm"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                  <input
                    type="text"
                    value={agendaLoteData}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAgendaLoteData(resolverAliasHojeEmTexto(v, 'br') ?? v);
                    }}
                    onBlur={() => setAgendaLoteData(normalizarDataBr(agendaLoteData) || agendaLoteData)}
                    placeholder="dd/mm/aaaa ou hj"
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-base md:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hora</label>
                  <input
                    type="text"
                    value={agendaLoteHora}
                    onChange={(e) => setAgendaLoteHora(formatarHoraAudienciaInput(e.target.value))}
                    onBlur={() => setAgendaLoteHora(normalizarHoraAudiencia(agendaLoteHora) || '')}
                    placeholder="hh:mm"
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-base md:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Periodicidade</label>
                  <select
                    value={agendaLotePeriodicidade}
                    onChange={(e) => {
                      const novaPeriodicidade = e.target.value;
                      setAgendaLotePeriodicidade(novaPeriodicidade);
                      if (novaPeriodicidade === 'Todo dia X do mês' && !String(agendaLoteDiaDoMes || '').trim()) {
                        const base = normalizarDataBr(agendaLoteData);
                        const diaBase = Number(String(base || '').slice(0, 2));
                        if (Number.isFinite(diaBase) && diaBase >= 1 && diaBase <= 31) {
                          setAgendaLoteDiaDoMes(String(diaBase));
                        }
                      }
                    }}
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-base md:text-sm"
                  >
                    {PERIODICIDADES_AGENDA_LOTE.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              {agendaLotePeriodicidade === 'Todo dia X do mês' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Dia do mês</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={agendaLoteDiaDoMes}
                      onChange={(e) => setAgendaLoteDiaDoMes(String(e.target.value ?? ''))}
                      onBlur={() => {
                        const n = Number(agendaLoteDiaDoMes);
                        if (!Number.isFinite(n)) return;
                        const limitado = Math.max(1, Math.min(31, Math.trunc(n)));
                        setAgendaLoteDiaDoMes(String(limitado));
                      }}
                      placeholder="1 a 31"
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-base md:text-sm"
                    />
                  </div>
                </div>
              ) : null}
              <div className="text-xs text-slate-500">
                Primeira ocorrência: <strong>{primeiraOcorrenciaAjustadaAgendaLote || '—'}</strong> | Periodicidade:{' '}
                <strong>{agendaLotePeriodicidade}</strong>
                {agendaLotePeriodicidade === 'Todo dia X do mês' && primeiraOcorrenciaAjustadaAgendaLote
                  ? ' (ajustado automaticamente para próximo dia útil quando necessário)'
                  : ''}
              </div>
              {agendaLoteInfo ? (
                <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
                  {agendaLoteInfo}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 px-4 py-3 md:flex-row md:justify-end md:gap-2">
              <button
                type="button"
                onClick={() => setModalAgendaLoteAberto(false)}
                className="min-h-11 w-full rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 md:w-auto"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarAgendaEmLote}
                className="min-h-11 w-full rounded border border-blue-600 bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 md:w-auto"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalVinculoPartes && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-vinculo-partes-titulo"
          onMouseDown={onModalOverlayMouseDown}
          onClick={criarModalOverlayClickFechar(() => setModalVinculoPartes(null))}
        >
          <div
            className="flex h-full w-full max-w-none flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-xl md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-lg"
            onMouseDown={onModalPanelMouseDown}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start gap-2 border-b border-slate-200 px-3 py-3 md:px-4">
              <button
                type="button"
                className="mt-0.5 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
                aria-label="Voltar"
                onClick={() => setModalVinculoPartes(null)}
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
              <div className="min-w-0 flex-1">
                <h2 id="modal-vinculo-partes-titulo" className="text-base font-semibold text-slate-800">
                  Partes do processo
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Formulário com duas abas: primeiro Parte Cliente, depois Parte Oposta.
                </p>
              </div>
              <button
                type="button"
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
                onClick={() => setModalVinculoPartes(null)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                salvarVinculoPartes();
              }}
            >
              <div className="px-4 pt-3 flex border-b border-slate-200 gap-0" role="tablist" aria-label="Abas do formulário de partes">
                <button
                  id="tab-detalhes-parte-cliente"
                  type="button"
                  role="tab"
                  aria-selected={detalhesAbaPartes === 'cliente'}
                  aria-controls="painel-form-partes"
                  tabIndex={detalhesAbaPartes === 'cliente' ? 0 : -1}
                  onClick={() => mudarAbaDetalhesPartes('cliente')}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    detalhesAbaPartes === 'cliente'
                      ? 'border-blue-600 text-blue-700 bg-white'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  Parte Cliente
                </button>
                <button
                  id="tab-detalhes-parte-oposta"
                  type="button"
                  role="tab"
                  aria-selected={detalhesAbaPartes === 'oposta'}
                  aria-controls="painel-form-partes"
                  tabIndex={detalhesAbaPartes === 'oposta' ? 0 : -1}
                  onClick={() => mudarAbaDetalhesPartes('oposta')}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    detalhesAbaPartes === 'oposta'
                      ? 'border-blue-600 text-blue-700 bg-white'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  Parte Oposta
                </button>
              </div>
              <div className="p-4 flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
                <div
                  id="painel-form-partes"
                  role="tabpanel"
                  aria-labelledby={
                    detalhesAbaPartes === 'cliente' ? 'tab-detalhes-parte-cliente' : 'tab-detalhes-parte-oposta'
                  }
                  className="rounded-lg border border-slate-200 bg-slate-50/40 p-3 flex flex-col gap-3 flex-1 min-h-0"
                >
                  <p className="text-sm font-medium text-slate-700">
                    {detalhesAbaPartes === 'cliente' ? 'Parte Cliente' : 'Parte Oposta'}
                  </p>
                  <p className="text-xs text-slate-500 -mt-2">
                    Inclua quantas pessoas precisar (marque na lista abaixo). Para cada uma, cadastre um ou mais
                    advogados — também são pessoas do cadastro. Desmarque ou use Remover para excluir da parte.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Search className="w-4 h-4 text-slate-500 shrink-0" />
                    <input
                      type="text"
                      value={buscaPessoaVinculo}
                      onChange={(e) => setBuscaPessoaVinculo(e.target.value)}
                      placeholder="Nome (mín. 2 letras) ou documento (mín. 3 dígitos)"
                      className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                    />
                    <button
                      type="button"
                      onClick={abrirNovaPessoaNoModalPartes}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100"
                      title="Cadastrar nova pessoa sem sair deste formulário"
                    >
                      <UserPlus className="h-4 w-4" aria-hidden />
                      Nova pessoa
                    </button>
                  </div>
                  <div className="border border-slate-300 rounded overflow-auto max-h-[220px] min-h-[120px] bg-white">
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-slate-100 sticky top-0">
                        <tr>
                          <th className="border-b border-slate-300 px-3 py-2 text-left w-16">Incluir</th>
                          <th className="border-b border-slate-300 px-3 py-2 text-left w-24">Código</th>
                          <th className="border-b border-slate-300 px-3 py-2 text-left">Nome</th>
                          <th className="border-b border-slate-300 px-3 py-2 text-left w-44">CPF/CNPJ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const buscaBruto = String(buscaPessoaVinculo ?? '').trim();
                          const buscaDig = buscaBruto.replace(/\D/g, '');
                          const buscaLetras = /[a-zA-ZÀ-ÿ\u00C0-\u024F]/.test(buscaBruto);
                          const buscaValida =
                            buscaBruto.length > 0 &&
                            (buscaLetras ? buscaBruto.length >= 2 : buscaDig.length >= 3);
                          if (buscaVinculoPessoasEmAndamento && buscaValida) {
                            return (
                              <tr>
                                <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                                  Buscando…
                                </td>
                              </tr>
                            );
                          }
                          if (!buscaValida) {
                            return (
                              <tr>
                                <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                                  Digite para buscar no cadastro: pelo menos 2 letras no nome ou 3 dígitos do
                                  CPF/CNPJ. Use «Nova pessoa» para incluir alguém que ainda não está cadastrado.
                                </td>
                              </tr>
                            );
                          }
                          if (pessoasBuscaVinculoResultados.length === 0) {
                            return (
                              <tr>
                                <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                                  <span className="block">Nenhuma pessoa encontrada para este termo.</span>
                                  <button
                                    type="button"
                                    onClick={abrirNovaPessoaNoModalPartes}
                                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
                                  >
                                    <UserPlus className="h-4 w-4" aria-hidden />
                                    Cadastrar nova pessoa
                                  </button>
                                </td>
                              </tr>
                            );
                          }
                          return pessoasBuscaVinculoResultados.map((p, idx) => {
                            const id = Number(p.id);
                            const checked = linhasModalPartes.some((l) => l.pessoaId === id);
                            return (
                              <tr
                                key={id}
                                className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} cursor-pointer hover:bg-blue-50`}
                                onClick={() => alternarPessoaNaParteModal(id)}
                              >
                                <td className="border-t border-slate-200 px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => alternarPessoaNaParteModal(id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="rounded border-slate-300"
                                  />
                                </td>
                                <td className="border-t border-slate-200 px-3 py-2 text-slate-700">{id}</td>
                                <td className="border-t border-slate-200 px-3 py-2 text-slate-800">{p.nome}</td>
                                <td className="border-t border-slate-200 px-3 py-2 text-slate-700">{p.cpf || '—'}</td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                  <div className="border border-slate-200 rounded-md bg-white p-2 max-h-[200px] overflow-y-auto">
                    <p className="text-xs font-semibold text-slate-600 mb-2">Nesta parte ({linhasModalPartes.length})</p>
                    {linhasModalPartes.length === 0 ? (
                      <p className="text-xs text-slate-400">Nenhuma pessoa selecionada.</p>
                    ) : (
                      <ul className="space-y-2">
                        {linhasModalPartes.map((linha) => {
                          const pessoaLinha = pessoasPorId.get(linha.pessoaId);
                          const nomeP = pessoaLinha?.nome || `Pessoa #${linha.pessoaId}`;
                          const codigoPessoa =
                            pessoaLinha?.id != null && Number.isFinite(Number(pessoaLinha.id))
                              ? Number(pessoaLinha.id)
                              : linha.pessoaId;
                          return (
                            <li
                              key={linha.pessoaId}
                              className="text-xs border border-slate-100 rounded p-2 bg-slate-50/80"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span
                                  className="font-medium text-slate-800 min-w-0 cursor-pointer rounded px-0.5 -mx-0.5 hover:bg-slate-100/90"
                                  title="Duplo clique para abrir o cadastro da pessoa"
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    abrirPessoaFlutuanteNoModalPartes(codigoPessoa);
                                  }}
                                >
                                  <span className="text-slate-500 font-normal tabular-nums mr-2 shrink-0">
                                    Cód. {codigoPessoa}
                                  </span>
                                  <span className="align-middle">{nomeP}</span>
                                </span>
                                <button
                                  type="button"
                                  className="shrink-0 text-red-600 hover:underline"
                                  onClick={() => alternarPessoaNaParteModal(linha.pessoaId)}
                                >
                                  Remover
                                </button>
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                <span className="text-slate-500">Advogados:</span>
                                {linha.advogadoPessoaIds.length === 0 ? (
                                  <span className="text-slate-400">nenhum</span>
                                ) : (
                                  linha.advogadoPessoaIds.map((aid) => (
                                    <span
                                      key={aid}
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-100"
                                    >
                                      {pessoasPorId.get(aid)?.nome || `#${aid}`}
                                      <button
                                        type="button"
                                        className="text-blue-700 hover:text-red-600 px-0.5"
                                        aria-label="Remover advogado"
                                        onClick={() => removerAdvogadoLinhaModal(linha.pessoaId, aid)}
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))
                                )}
                                <select
                                  className="ml-1 max-w-[10rem] text-xs border border-slate-300 rounded px-1 py-0.5 bg-white"
                                  defaultValue=""
                                  onChange={(e) => {
                                    const v = Number(e.target.value);
                                    if (v) adicionarAdvogadoLinhaModal(linha.pessoaId, v);
                                    e.target.value = '';
                                  }}
                                >
                                  <option value="">+ advogado (use a busca acima)…</option>
                                  {pessoasBuscaVinculoResultados
                                    .filter((x) => Number(x.id) !== linha.pessoaId)
                                    .map((x) => (
                                      <option key={x.id} value={x.id}>
                                        {x.nome}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalVinculoPartes(null)}
                  className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded border border-blue-600 bg-blue-600 text-white text-sm hover:bg-blue-700"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

        </>
        ) : null}

      {/* Janela Conta Corrente: lançamentos dos extratos vinculados a cliente + proc. (Financeiro) */}
      {modalContaCorrente && (() => {
        const processoContaCorrenteEfetivo = contaCorrenteModo === 'proc0' ? 0 : processo;
        const baseLocal = getLancamentosContaCorrente(codigoCliente, processoContaCorrenteEfetivo);
        let base;
        if (!featureFlags.useApiFinanceiro) {
          base = baseLocal;
        } else if (
          contaCorrenteListaApi.phase === 'idle' ||
          contaCorrenteListaApi.phase === 'loading'
        ) {
          base = { lancamentos: [], soma: 0 };
        } else if (contaCorrenteListaApi.phase === 'ok' && contaCorrenteListaApi.data) {
          base = contaCorrenteListaApi.data;
        } else {
          base = baseLocal;
        }
        const carregandoListaApi =
          featureFlags.useApiFinanceiro &&
          (contaCorrenteListaApi.phase === 'idle' || contaCorrenteListaApi.phase === 'loading');
        const { lancamentos } = mergeContaCorrenteComLinhaOrigem(
          base.lancamentos,
          base.soma,
          linhaOrigemContaCorrente,
          codigoCliente,
          processoContaCorrenteEfetivo
        );
        const transacoesFonte =
          featureFlags.useApiFinanceiro &&
          contaCorrenteListaApi.phase === 'ok' &&
          contaCorrenteTransacoesUi.length > 0
            ? contaCorrenteTransacoesUi
            : getTransacoesContaCorrenteCompleto(codigoCliente, processoContaCorrenteEfetivo);
        void ccVinculoTick;
        const painelCc = montarPainelResultadoContaCorrenteProcesso(
          transacoesFonte,
          codigoCliente,
          processoContaCorrenteEfetivo,
        );
        const mapaClass = new Map(painelCc.transacoes.map((t) => [t.chave, t]));
        const listaBase = lancamentos.map((l, idx) => {
          const chave = l.chave || `${String(l.nomeBanco ?? '').trim()}|${String(l.numero ?? '').trim()}|${String(l.data ?? '').trim()}`;
          const enriched = mapaClass.get(chave);
          return {
            ...l,
            numero: l.numero ?? (idx + 1),
            chave,
            classificacao: enriched?.classificacao,
            numeroVinculo: enriched?.numeroVinculo ?? '',
            transacaoUi: enriched,
          };
        });
        let listaFiltrada = filtrarLancamentosContaCorrente(listaBase, buscaContaCorrente.campo, buscaContaCorrente.termo);
        if (ccFiltroSemVinculo) {
          listaFiltrada = listaFiltrada.filter((l) => !String(l.numeroVinculo ?? '').trim());
        }
        const somaDasLinhasExibidas = listaFiltrada.reduce((s, l) => s + (Number(l.valor) || 0), 0);
        const listaOrdenada = ordenarLancamentosContaCorrente(listaFiltrada, sortContaCorrente.col, sortContaCorrente.dir);
        const somaFormatada = formatValorContaCorrente(somaDasLinhasExibidas);
        const qtdCcSel = ccSelecionados.size;
        return (
        <div
          className={`fixed inset-0 ${contaCorrenteSomenteEmbed ? 'z-[80]' : 'z-50'} flex items-stretch justify-center bg-black/50 p-0 md:items-center md:p-4`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-conta-corrente-titulo"
        >
          <div
            className="flex h-full w-full max-w-none flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-xl md:h-auto md:max-h-[90vh] md:max-w-5xl md:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 md:px-4">
              <button
                type="button"
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
                aria-label="Voltar"
                onClick={() => void fecharModalContaCorrente()}
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
              <h2
                id="modal-conta-corrente-titulo"
                className="min-w-0 flex-1 text-base font-semibold text-slate-800"
              >
                Conta Corrente – Cliente {codigoCliente}
                {contaCorrenteModo === 'proc0' ? ', Processo 0 (mensalista / geral)' : processo ? `, Processo ${processo}` : ''}
              </h2>
              <button
                type="button"
                onClick={() => void fecharModalContaCorrente()}
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {featureFlags.useApiFinanceiro &&
            contaCorrenteListaApi.phase === 'error' &&
            contaCorrenteListaApi.error ? (
              <p className="text-xs text-red-700 px-4 py-2 border-b border-red-100 bg-red-50 shrink-0">
                {contaCorrenteListaApi.error} — a tabela usa a cópia local dos extratos.
              </p>
            ) : null}
            <div className="flex-1 min-h-0 flex flex-col p-4">
              <div className="flex-1 min-h-0 overflow-auto border border-slate-300 rounded bg-white">
                  <div className="px-2 py-2 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-center gap-2">
                    <label className="text-sm font-medium text-slate-700 shrink-0">Soma:</label>
                    <input
                      type="text"
                      readOnly
                      value={somaFormatada}
                      className="w-36 px-2 py-1.5 border border-slate-300 rounded text-sm bg-white text-right font-medium tabular-nums"
                    />
                    {featureFlags.useApiFinanceiro && Number(processoApiId) ? (
                      <span className="text-[11px] text-slate-600 shrink-0">
                        API: {Number(resumoContaCorrenteApi?.totalLancamentos ?? 0)} lanç.
                      </span>
                    ) : null}
                    {featureFlags.useApiFinanceiro && resumoContaCorrenteApiErro ? (
                      <span className="text-[11px] text-red-600 shrink-0">{resumoContaCorrenteApiErro}</span>
                    ) : null}
                  </div>
                  <ContaCorrenteVinculoAssist
                    painel={painelCc}
                    modoVincular={ccModoVincular}
                    onToggleModoVincular={() => {
                      setCcModoVincular((v) => !v);
                      setCcPendenteChave(null);
                    }}
                    filtroSemVinculo={ccFiltroSemVinculo}
                    onToggleFiltroSemVinculo={() => setCcFiltroSemVinculo((v) => !v)}
                    pendenteChave={ccPendenteChave}
                    onCancelarPendente={() => setCcPendenteChave(null)}
                    onFiltrarNumero={(n) =>
                      setBuscaContaCorrente({ campo: 'vinculo', termo: String(n) })
                    }
                    onVincularParSugerido={(par) => void handleVincularParSugeridoCc(par, transacoesFonte)}
                    onVincularTodosSugeridos={() =>
                      void handleVincularTodosParesSugeridosCc(painelCc.paresSugeridos, transacoesFonte)
                    }
                    salvando={ccSalvandoPapel}
                    qtdSelecionados={qtdCcSel}
                    numeroVinculoInput={ccNumeroVinculoInput}
                    onNumeroVinculoInputChange={setCcNumeroVinculoInput}
                    onAtribuirSelecionados={() => void handleAtribuirNumeroVinculoCc(transacoesFonte)}
                  />
                  {ccMensagem ? (
                    <p
                      className={`text-xs px-3 py-1.5 border-b shrink-0 ${
                        /falha|não encontrado/i.test(ccMensagem)
                          ? 'text-red-700 bg-red-50 border-red-100'
                          : 'text-emerald-800 bg-emerald-50 border-emerald-100'
                      }`}
                      role="status"
                    >
                      {ccMensagem}
                    </p>
                  ) : null}
                  <div className="px-2 py-1 border-b border-indigo-50 flex justify-end">
                    <button
                      type="button"
                      className="text-[11px] text-indigo-700 hover:underline"
                      onClick={() => navigate('/resultado-financeiro/autos')}
                    >
                      Relatório de resultados →
                    </button>
                  </div>
                  <div className="p-2 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-slate-500" />
                      <span className="text-xs font-medium text-slate-700">Buscar:</span>
                    </div>
                    <select
                      value={buscaContaCorrente.campo}
                      onChange={(e) => setBuscaContaCorrente((prev) => ({ ...prev, campo: e.target.value }))}
                      className="px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                      title="Campo de busca"
                    >
                      <option value="todos">Todos</option>
                      <option value="valor">Valor (exato)</option>
                      <option value="banco">Banco</option>
                      <option value="descricao">Descrição</option>
                      <option value="nome">Nome</option>
                      <option value="proc">Proc.</option>
                      <option value="numero">Nº</option>
                      <option value="vinculo">Vínculo</option>
                      <option value="data">Data</option>
                    </select>
                    <input
                      type="text"
                      value={buscaContaCorrente.termo}
                      onChange={(e) => setBuscaContaCorrente((prev) => ({ ...prev, termo: e.target.value }))}
                      className="min-h-11 min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-base md:min-h-0 md:min-w-[220px] md:text-xs"
                      placeholder="Digite para filtrar..."
                    />
                    <button
                      type="button"
                      onClick={() => setBuscaContaCorrente({ campo: 'todos', termo: '' })}
                      className="px-2 py-1 rounded border border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-100"
                      disabled={!buscaContaCorrente.termo}
                      title="Limpar busca"
                    >
                      Limpar
                    </button>
                    <span className="text-xs text-slate-500 ml-auto">
                      {listaOrdenada.length} itens
                      <span className="text-cyan-700 ml-1">
                        · ordem:{' '}
                        {sortContaCorrente.col === 'data' && sortContaCorrente.dir === 'desc'
                          ? 'data (mais recente)'
                          : `${sortContaCorrente.col} (${sortContaCorrente.dir === 'asc' ? 'crescente' : 'decrescente'})`}
                      </span>
                    </span>
                  </div>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-100">
                        {!ccModoVincular ? (
                          <th className="border border-slate-300 w-8 px-1 py-1" scope="col">
                            <span className="sr-only">Selecionar</span>
                          </th>
                        ) : null}
                        {[
                          { key: 'data', label: 'Data', w: 'w-24', align: 'text-left' },
                          { key: 'descricao', label: 'Descrição', w: 'min-w-[160px]', align: 'text-left' },
                          { key: 'dataOuId', label: 'Proc.', w: 'w-16', align: 'text-left' },
                          { key: 'valor', label: 'Valor', w: 'w-28', align: 'text-right' },
                          { key: 'nome', label: 'Nome', w: 'min-w-[100px]', align: 'text-left' },
                          { key: 'numero', label: 'Nº', w: 'w-12', align: 'text-center' },
                        ].map((h) => {
                          const ativo = sortContaCorrente.col === h.key;
                          return (
                            <th
                              key={h.key}
                              scope="col"
                              className={`border border-slate-300 px-0 py-0 font-semibold text-slate-700 ${h.w} ${h.align}`}
                            >
                              <button
                                type="button"
                                className={`flex w-full min-w-0 items-center gap-1 px-2 py-1.5 hover:bg-slate-200/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 ${h.align === 'text-right' ? 'justify-end' : h.align === 'text-center' ? 'justify-center' : 'justify-start'}`}
                                onClick={() => handleClicTituloOrdenacaoContaCorrente(h.key)}
                                title="Clique para ordenar (asc → desc → volta à ordem por data recente)"
                              >
                                <span>{h.label}</span>
                                <span className="inline-flex shrink-0 text-cyan-600">
                                  {!ativo ? (
                                    <ArrowUpDown className="w-3.5 h-3.5 opacity-50" aria-hidden />
                                  ) : sortContaCorrente.dir === 'asc' ? (
                                    <ArrowUp className="w-3.5 h-3.5" aria-hidden />
                                  ) : (
                                    <ArrowDown className="w-3.5 h-3.5" aria-hidden />
                                  )}
                                </span>
                              </button>
                            </th>
                          );
                        })}
                        <th className="border border-slate-300 px-2 py-1.5 font-semibold text-slate-700 w-16 text-center">
                          Vínc.
                        </th>
                        <th className="border border-slate-300 px-2 py-1.5 font-semibold text-slate-700 min-w-[120px] text-left">
                          Papel
                        </th>
                        <th className="border border-slate-300 px-1 py-1.5 font-semibold text-slate-700 w-10 text-center">
                          <span className="sr-only">Excluir</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {carregandoListaApi ? (
                        <tr>
                          <td colSpan={ccModoVincular ? 9 : 10} className="border border-slate-200 px-2 py-4 text-center text-slate-500">
                            A carregar lançamentos da API…
                          </td>
                        </tr>
                      ) : listaOrdenada.length === 0 ? (
                        <tr>
                          <td colSpan={ccModoVincular ? 9 : 10} className="border border-slate-200 px-2 py-4 text-center text-slate-500">
                            Nenhum lançamento do Financeiro vinculado ao cliente {codigoCliente}
                            {contaCorrenteModo === 'proc0' ? ' e processo 0' : processo ? ` e processo ${processo}` : ''}.
                          </td>
                        </tr>
                      ) : (
                        listaOrdenada.map((linha, idx) => {
                          const papelAtual = linha.classificacao?.papel ?? PAPEL_OUTRO;
                          const ehPendente = ccModoVincular && ccPendenteChave === linha.chave;
                          const rowTint = ehPendente
                            ? 'bg-indigo-200/60 ring-2 ring-inset ring-indigo-500'
                            : linha.numeroVinculo
                              ? 'bg-indigo-50/70'
                              : papelAtual === PAPEL_ENTRADA
                                ? 'bg-emerald-50/50'
                                : papelAtual === PAPEL_PAGAMENTO
                                  ? 'bg-orange-50/40'
                                  : idx % 2 === 0
                                    ? 'bg-white'
                                    : 'bg-slate-50/50';
                          return (
                          <tr
                            key={`${linha.chave ?? linha.numero ?? idx}-${idx}`}
                            className={`${rowTint} ${ccModoVincular || (linha.nomeBanco && linha.numero) ? 'cursor-pointer hover:bg-blue-50/80' : ''}`}
                            title={
                              ccModoVincular
                                ? ccPendenteChave
                                  ? 'Clique na 2ª linha do par (entrada + pagamento)'
                                  : '1º clique: marcar linha do par'
                                : linha.nomeBanco && linha.numero
                                  ? 'Duplo clique: abrir no Financeiro'
                                  : undefined
                            }
                            onClick={(e) => {
                              if (!ccModoVincular) return;
                              if (e.target.closest('input, select, button, textarea')) return;
                              void handleCcParDoisCliques(linha, transacoesFonte);
                            }}
                            onDoubleClick={() => {
                              if (ccModoVincular) return;
                              if (!linha.nomeBanco || linha.numero == null || !linha.data) return;
                              fecharModalContaCorrente();
                              navigate('/financeiro', {
                                state: {
                                  financeiroContaCorrenteLinha: {
                                    nomeBanco: linha.nomeBanco,
                                    numero: String(linha.numero),
                                    data: linha.data,
                                  },
                                },
                              });
                            }}
                          >
                            {!ccModoVincular ? (
                              <td className="border border-slate-200 px-1 py-1 text-center">
                                <input
                                  type="checkbox"
                                  checked={ccSelecionados.has(linha.chave)}
                                  onChange={() => toggleCcSelecionado(linha.chave)}
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label="Selecionar para vínculo"
                                />
                              </td>
                            ) : null}
                            <td className="border border-slate-200 px-2 py-1 text-slate-700">{linha.data}</td>
                            <td className="border border-slate-200 px-2 py-1 text-slate-700">{linha.descricao}</td>
                            <td className="border border-slate-200 px-2 py-1 text-slate-700">{linha.dataOuId}</td>
                            <td className={`border border-slate-200 px-2 py-1 text-right font-medium ${linha.valor < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                              {formatValorContaCorrente(linha.valor)}
                            </td>
                            <td className="border border-slate-200 px-2 py-1 text-slate-700">{linha.nome}</td>
                            <td className="border border-slate-200 px-2 py-1 text-center text-slate-600">{linha.numero ?? (idx + 1)}</td>
                            <td className="border border-slate-200 px-1 py-0.5 text-center">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={linha.numeroVinculo ?? ''}
                                disabled={ccSalvandoPapel}
                                onClick={(e) => e.stopPropagation()}
                                onBlur={(e) => {
                                  const v = e.target.value.replace(/\D/g, '');
                                  const chave = linha.chave;
                                  const mapa = new Map(painelCc.transacoes.map((t) => [t.chave, t]));
                                  void persistirNumeroVinculoLinha(chave, v, mapa.get(chave) ?? linha.transacaoUi);
                                }}
                                className="w-12 mx-auto px-1 py-0.5 text-xs text-center border border-slate-300 rounded bg-white font-mono"
                                title="Número de vínculo (igual na entrada e no pagamento)"
                              />
                            </td>
                            <td className="border border-slate-200 px-1 py-0.5">
                              <select
                                value={papelAtual}
                                disabled={ccSalvandoPapel}
                                onChange={(e) =>
                                  void handlePapelContaCorrenteLinha(linha.chave, e.target.value, linha.transacaoUi)
                                }
                                onClick={(e) => e.stopPropagation()}
                                className="w-full text-xs border border-slate-300 rounded px-1 py-1 bg-white"
                                title={rotuloPapelContaCorrenteProcesso(papelAtual)}
                              >
                                <option value={PAPEL_ENTRADA}>Entrada</option>
                                <option value={PAPEL_PAGAMENTO}>Pagamento</option>
                                <option value={PAPEL_DESPESA}>Despesa</option>
                                <option value={PAPEL_OUTRO}>Outro</option>
                              </select>
                              {featureFlags.useApiFinanceiro &&
                              contaCorrenteModo !== 'proc0' &&
                              Number(processoApiId) > 0 &&
                              linha.transacaoUi?.apiId ? (
                                <div className="mt-1 space-y-1" onClick={(e) => e.stopPropagation()}>
                                  {linha.valor > 0 ? (
                                    ccHonorarioAlvaras[linha.transacaoUi.apiId] ? (
                                      <p className="text-[10px] leading-snug text-emerald-800 bg-emerald-50 rounded px-1 py-0.5">
                                        Alvará · ret.{' '}
                                        {formatValorContaCorrente(
                                          ccHonorarioAlvaras[linha.transacaoUi.apiId].retencao,
                                        )}{' '}
                                        / rep.{' '}
                                        {formatValorContaCorrente(
                                          ccHonorarioAlvaras[linha.transacaoUi.apiId].repasseEsperado,
                                        )}
                                      </p>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={Boolean(ccHonorarioSalvando)}
                                        onClick={() => void handleClassificarAlvaraCc(linha.transacaoUi.apiId)}
                                        className="w-full text-[10px] font-semibold rounded border border-teal-300 bg-teal-50 text-teal-900 px-1 py-0.5 hover:bg-teal-100 disabled:opacity-50"
                                      >
                                        {ccHonorarioSalvando === `alvara-${linha.transacaoUi.apiId}`
                                          ? 'Marcando…'
                                          : 'Marcar como alvará'}
                                      </button>
                                    )
                                  ) : linha.valor < 0 && ccHonorarioPendentes.length > 0 ? (
                                    <div className="space-y-1">
                                      {ccHonorarioPendentes.length > 1 ? (
                                        <select
                                          value={ccAlvaraRepasseAlvo}
                                          onChange={(e) => setCcAlvaraRepasseAlvo(e.target.value)}
                                          className="w-full text-[10px] border border-slate-300 rounded px-1 py-0.5 bg-white"
                                          title="Alvará pendente de repasse"
                                        >
                                          {ccHonorarioPendentes.map((p) => (
                                            <option
                                              key={p.alvaraLancamentoId}
                                              value={String(p.alvaraLancamentoId)}
                                            >
                                              Alvará {formatValorContaCorrente(p.valorAlvara)} (
                                              {p.dataReferencia?.slice(0, 10) || '—'})
                                            </option>
                                          ))}
                                        </select>
                                      ) : null}
                                      <button
                                        type="button"
                                        disabled={Boolean(ccHonorarioSalvando)}
                                        onClick={() =>
                                          void handleVincularRepasseAlvaraCc(
                                            linha.transacaoUi.apiId,
                                            ccAlvaraRepasseAlvo ||
                                              ccHonorarioPendentes[0]?.alvaraLancamentoId,
                                          )
                                        }
                                        className="w-full text-[10px] font-semibold rounded border border-amber-300 bg-amber-50 text-amber-950 px-1 py-0.5 hover:bg-amber-100 disabled:opacity-50"
                                      >
                                        {ccHonorarioSalvando === `repasse-${linha.transacaoUi.apiId}`
                                          ? 'Vinculando…'
                                          : 'Vincular repasse do alvará'}
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </td>
                            <td className="border border-slate-200 px-1 py-0.5 text-center">
                              <button
                                type="button"
                                disabled={ccSalvandoPapel}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleExcluirLancamentoContaCorrente(linha);
                                }}
                                className="inline-flex items-center justify-center p-1 rounded text-red-600 hover:bg-red-50 disabled:opacity-40"
                                title="Excluir da Conta Corrente (apaga código cliente e processo no Financeiro)"
                                aria-label="Excluir lançamento da Conta Corrente"
                              >
                                <Trash2 className="w-4 h-4" aria-hidden />
                              </button>
                            </td>
                          </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
              </div>
              <div className="flex justify-center px-4 pb-4 pt-4 md:px-0">
                <button
                  type="button"
                  onClick={() => void fecharModalContaCorrente()}
                  className="min-h-11 w-full rounded border border-slate-300 bg-white px-8 py-2 text-sm text-slate-700 hover:bg-slate-50 md:w-auto"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Caixa de diálogo com o texto completo da informação */}
      {informacaoModal && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-0 md:items-center md:p-4"
          onMouseDown={onModalOverlayMouseDown}
          onClick={criarModalOverlayClickFechar(() => setInformacaoModal(null))}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-informacao-titulo"
        >
          <div
            className="flex h-full w-full max-w-none flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-xl md:h-auto md:max-h-[80vh] md:max-w-2xl md:rounded-lg"
            onMouseDown={onModalPanelMouseDown}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-3 md:px-4">
              <button
                type="button"
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
                aria-label="Voltar"
                onClick={() => setInformacaoModal(null)}
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
              <h2
                id="modal-informacao-titulo"
                className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-800"
              >
                Inf.: {informacaoModal.inf} — {informacaoModal.data} —{' '}
                <AutorUsuarioExibicao {...usuarioHistoricoAutorMeta(informacaoModal, getUsuariosAtivos())} />
              </h2>
              <button
                type="button"
                onClick={() => setInformacaoModal(null)}
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <p className="text-slate-800 whitespace-pre-wrap break-words">{informacaoModal.info}</p>
            </div>
            <div className="flex shrink-0 justify-end border-t border-slate-200 px-4 py-3">
              <button
                type="button"
                onClick={() => setInformacaoModal(null)}
                className="min-h-11 w-full rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 md:w-auto"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <ModalRelatorioPublicacoesProcesso
        open={modalRelatorioPublicacoes}
        onClose={() => setModalRelatorioPublicacoes(false)}
        processoId={featureFlags.useApiPublicacoes ? processoApiId : null}
        codigoCliente={codigoCliente}
        processo={processo}
        numeroProcessoNovo={numeroProcessoNovo}
        nomeCliente={cliente}
      />

      <ModalConsultaPeriodicaProcesso
        open={modalConsultaPeriodica}
        onClose={() => setModalConsultaPeriodica(false)}
        processoApiId={processoApiId}
        numeroCnj={numeroProcessoNovo}
        clienteNome={cliente}
      />

      <ModalPeticionamentoProcesso
        open={modalPeticionamentoProjudi}
        onClose={() => setModalPeticionamentoProjudi(false)}
        numeroCnj={numeroProcessoNovo}
        clienteNome={cliente}
      />

      <ModalCriarTarefaContextual
        open={modalTarefaContextual != null}
        onClose={() => setModalTarefaContextual(null)}
        context={modalTarefaContextual}
      />

      <PessoaEmbedModal
        embed={pessoaEmbed}
        onFechar={() => setPessoaEmbed(null)}
        onPessoaSalva={aoPessoaSalvaNoModalPartes}
      />

      {clientesEmbed ? (
        <div
          className="fixed inset-0 z-[75] flex items-stretch justify-center bg-black/55 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="processos-clientes-embed-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setClientesEmbed(null);
          }}
        >
          <div
            className="flex h-[100dvh] w-full max-w-none min-h-0 flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0f141c] md:h-[min(100dvh-0.5rem,920px)] md:max-h-[min(100dvh-0.5rem,920px)] md:w-[min(100vw-0.5rem,1280px)] md:rounded-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-[#141c2c] md:px-3">
              <button
                type="button"
                onClick={() => setClientesEmbed(null)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10 md:hidden"
                aria-label="Voltar"
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
              <h2
                id="processos-clientes-embed-title"
                className="min-w-0 flex-1 text-sm font-semibold text-slate-900 dark:text-white"
              >
                Cadastro de clientes
              </h2>
              <button
                type="button"
                onClick={() => setClientesEmbed(null)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10"
                aria-label="Fechar cadastro de clientes"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]">
              <Suspense
                fallback={
                  <div className="flex min-h-[12rem] items-center justify-center p-8 text-sm text-slate-600 dark:text-slate-400">
                    Carregando cadastro de clientes…
                  </div>
                }
              >
                <CadastroClientesLazy
                  key={clientesEmbed.revision}
                  embedIntent={clientesEmbed.routerState}
                  embedIntentRevision={clientesEmbed.revision}
                  onFecharEmbed={() => setClientesEmbed(null)}
                />
              </Suspense>
            </div>
          </div>
        </div>
      ) : null}

      {driveExplorerAberto && driveConfigurado ? (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 text-sm text-white">
              Carregando arquivos do Drive…
            </div>
          }
        >
          <DriveExplorerLazy
            codigoCliente={String(codigoCliente ?? '').trim()}
            numeroInterno={Number(processo)}
            processoId={processoApiId}
            numeroCnj={String(numeroProcessoNovo ?? '').trim()}
            onClose={() => setDriveExplorerAberto(false)}
          />
        </Suspense>
      ) : null}

      <ModalBuscaImovel
        open={modalBuscaImovelAberto}
        onClose={() => setModalBuscaImovelAberto(false)}
        onSelecionar={(im) => void handleSelecionarImovelBusca(im)}
      />
    </div>
    </div>
  );
}
