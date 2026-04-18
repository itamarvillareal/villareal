import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getLancamentosContaCorrente,
  mapLinhasFinanceiroParaContaCorrenteModal,
  mergeContaCorrenteComLinhaOrigem,
} from '../data/financeiroData';
import {
  carregarResumoContaCorrenteProcesso,
  listarLancamentosProcessoApiFirst,
} from '../repositories/financeiroRepository.js';
import { EVENT_FINANCEIRO_PERSISTENCIA_EXTERNA } from '../services/crossTabLocalStorageSync.js';
import {
  UFS,
  CIDADES_POR_UF,
  FASES,
  COMPETENCIAS,
  TIPOS_AUDIENCIA,
  TRAMITACAO_OPCOES,
  gerarMockProcesso,
  normalizarCliente,
  normalizarProcesso,
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
import { resolverAliasHojeEmTexto } from '../services/hjDateAliasService.js';
import {
  agendarAudienciaParaTodosUsuarios,
  agendarEmLoteParaUsuarios,
  calcularPrimeiraOcorrenciaAgendaLote,
  getUsuariosAtivos,
} from '../data/agendaPersistenciaData';
import {
  replicarAudienciaProcessoTodosColaboradoresApi,
  replicarCompromissoLoteTodosColaboradoresApi,
} from '../repositories/agendaRepository.js';
import { getPerfilAtivoParaPermissoes } from '../data/usuarioPermissoesStorage.js';
import { getNomeExibicaoUsuario } from '../data/usuarioDisplayHelpers.js';
import { SidebarMenuIcon } from './navigation/SidebarMenuIcons.jsx';
import {
  X,
  FolderOpen,
  Calendar,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,
  Newspaper,
  ListTodo,
  Hand,
  PenLine,
  AlertCircle,
  Users,
} from 'lucide-react';
import { ModalRelatorioPublicacoesProcesso } from './ModalRelatorioPublicacoesProcesso.jsx';
import { ModalCriarTarefaContextual } from './ModalCriarTarefaContextual.jsx';
import { buildContextFromProcesso, buildContextFromProcessoComPrazoFatal } from '../data/tarefasContextualPayload.js';
import { featureFlags } from '../config/featureFlags.js';
import { obterClienteCadastroPorCodigo } from '../repositories/clientesRepository.js';
import {
  buscarClientePorCodigo,
  buscarProcessoPorChaveNatural,
  resolverProcessoId,
  mapApiProcessoToUiShape,
  salvarCabecalhoProcesso,
  listarPartesProcesso,
  sincronizarPartesIncremental,
  listarAndamentosProcesso,
  sincronizarAndamentosIncremental,
  mapApiAndamentoToHistoricoItem,
  upsertPrazoFatalProcesso,
  alterarAtivoProcesso,
} from '../repositories/processosRepository.js';
import {
  buildRouterStateChaveClienteProcesso,
  extrairIntentNavegacaoProcessos,
  gravarUltimaSelecaoProcessosArmazenamento,
  lerUltimaSelecaoProcessosArmazenamento,
} from '../domain/camposProcessoCliente.js';

const CadastroClientesLazy = lazy(() =>
  import('./CadastroClientes.jsx').then((module) => ({ default: module.CadastroClientes }))
);

/** Linhas por página na aba Histórico — preenche melhor a área útil sem depender de linhas vazias. */
const HISTORICO_POR_PAGINA = 24;

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

/** Mesmo critério do seletor «Perfil ativo» no menu (apelido ou nome do cadastro Agenda). */
function nomeUsuarioAtivoParaHistorico() {
  const perfilId = getPerfilAtivoParaPermissoes();
  const lista = getUsuariosAtivos();
  const u = (lista || []).find((x) => String(x.id) === String(perfilId));
  const nome = getNomeExibicaoUsuario(u);
  if (nome && nome !== '—') return nome;
  const id = String(perfilId || '').trim();
  if (id) return id.charAt(0).toUpperCase() + id.slice(1).toLowerCase();
  return 'Usuário';
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

  const [codigoCliente, setCodigoCliente] = useState(
    () => (typeof window !== 'undefined' ? lerUltimaSelecaoProcessosArmazenamento()?.codigoCliente : null) ?? '00000001'
  );
  const [cliente, setCliente] = useState('');
  /** Re-dispara resolução do nome após salvar no cadastro de clientes (mesmo dado que «Nome / Razão Social»). */
  const [clienteNomeRefreshTick, setClienteNomeRefreshTick] = useState(0);
  const [processo, setProcesso] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const s = lerUltimaSelecaoProcessosArmazenamento();
    return s?.numeroInterno ?? 1;
  });
  /** Lançamento do duplo clique no extrato consolidado (Financeiro → Processos). */
  const [linhaOrigemContaCorrente, setLinhaOrigemContaCorrente] = useState(null);
  /** Abre Conta Corrente em modo Proc. 0 quando o Financeiro envia proc 0 (mensalista). Declarado cedo para o efeito abaixo. */
  const [contaCorrenteModo, setContaCorrenteModo] = useState('processo');
  const [modalContaCorrente, setModalContaCorrente] = useState(false);
  const [resumoContaCorrenteApi, setResumoContaCorrenteApi] = useState(null);
  const [resumoContaCorrenteApiErro, setResumoContaCorrenteApiErro] = useState('');
  /** Lista do modal Conta Corrente quando a API financeira é a fonte de verdade (evita extrato local obsoleto após zerar). */
  const [contaCorrenteListaApi, setContaCorrenteListaApi] = useState({
    phase: 'idle',
    data: null,
    error: '',
  });
  const [contaCorrenteListaApiTick, setContaCorrenteListaApiTick] = useState(0);
  const [modalRelatorioPublicacoes, setModalRelatorioPublicacoes] = useState(false);
  /** Modal com cadastro de clientes (mesmo formulário de /pessoas) para o cliente e proc. atuais. */
  const [clientesEmbed, setClientesEmbed] = useState(null);
  const [modalTarefaContextual, setModalTarefaContextual] = useState(null);

  useLayoutEffect(() => {
    const intent = extrairIntentNavegacaoProcessos(intentStateForHydration);
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
  }, [intentRevisionForHydration, intentStateForHydration, isEmbedded]);

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
  const [consultaAutomatica, setConsultaAutomatica] = useState(false);
  const [estado, setEstado] = useState('');
  const [cidade, setCidade] = useState('');
  const [dataProtocolo, setDataProtocolo] = useState('');
  const [pastaArquivo, setPastaArquivo] = useState('');
  const [naturezaAcao, setNaturezaAcao] = useState('');
  const [valorCausa, setValorCausa] = useState('');
  const [procedimento, setProcedimento] = useState('');
  const [responsavel, setResponsavel] = useState('');
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
  const [imovelId, setImovelId] = useState(''); // vínculo com a aba Imóveis (mock)
  const [imovelManual, setImovelManual] = useState(false);
  /** Evita sobrescrever o texto da unidade quando o vínculo mock mudar, após edição manual. */
  const [unidadeEnderecoManual, setUnidadeEnderecoManual] = useState(false);
  const [tramitacao, setTramitacao] = useState('');
  const [modalTramitacaoAberto, setModalTramitacaoAberto] = useState(false);
  const [tramitacaoDraft, setTramitacaoDraft] = useState('');
  const [tabAtiva, setTabAtiva] = useState('historico');
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
  const [sortContaCorrente, setSortContaCorrente] = useState({ col: 'data', dir: 'desc' });
  const [buscaContaCorrente, setBuscaContaCorrente] = useState({ campo: 'todos', termo: '' });
  const [processoApiId, setProcessoApiId] = useState(null);
  /** `clienteId` retornado pelo GET do processo na API (preferência sobre resolução por código). */
  const [clienteProcessoApiId, setClienteProcessoApiId] = useState(null);
  const [apiSaving, setApiSaving] = useState(false);
  const [apiError, setApiError] = useState('');
  const [historicoExternoTick, setHistoricoExternoTick] = useState(0);
  /** Evita aplicar resposta antiga se o usuário trocar de processo antes do GET terminar. */
  const carregarProcessoApiSeqRef = useRef(0);

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
    if (!featureFlags.useApiFinanceiro || !Number(processoApiId)) {
      setResumoContaCorrenteApi(null);
      setResumoContaCorrenteApiErro('');
      return;
    }
    let ativo = true;
    void carregarResumoContaCorrenteProcesso(processoApiId)
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
  }, [processoApiId]);

  useEffect(() => {
    const h = () => setContaCorrenteListaApiTick((t) => t + 1);
    window.addEventListener(EVENT_FINANCEIRO_PERSISTENCIA_EXTERNA, h);
    return () => window.removeEventListener(EVENT_FINANCEIRO_PERSISTENCIA_EXTERNA, h);
  }, []);

  useEffect(() => {
    if (!modalContaCorrente) {
      setContaCorrenteListaApi({ phase: 'idle', data: null, error: '' });
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
        if (!resolved) {
          setContaCorrenteListaApi({ phase: 'local', data: null, error: '' });
          return;
        }
        const rows = await listarLancamentosProcessoApiFirst({
          processoId: resolved,
          codigoCliente,
          numeroInterno: procEfetivo,
        });
        if (!alive) return;
        const mapped = mapLinhasFinanceiroParaContaCorrenteModal(rows);
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
      if (e.key === 'Escape') {
        e.preventDefault();
        setModalAcoesRedacaoAberto(false);
        return;
      }
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
      setDataProtocolo(pickCampoStrSalvo(r, 'dataProtocolo', mock.dataProtocolo));
      setNaturezaAcao(naturezaPersistida);
      setValorCausa(pickCampoStrSalvo(r, 'valorCausa', mock.valorCausa));
      setObservacao(pickCampoStrSalvo(r, 'observacao', mock.observacao));
      setEstado(pickCampoStrSalvo(r, 'estado', mock.estado));
      setCidade(pickCampoStrSalvo(r, 'cidade', mock.cidade));
      setResponsavel(pickCampoStrSalvo(r, 'responsavel', ''));
    } else {
      // Com API: cabeçalho, partes e histórico vêm de GET /api/processos e sub-rotas (importação/planilha).
      setPeriodicidadeConsulta(registroPersistido?.periodicidadeConsulta ?? '');
    }
    setPastaArquivo(pickCampoStrSalvo(r, 'pastaArquivo', ''));
    setProcedimento(pickCampoStrSalvo(r, 'procedimento', ''));
    setFaseCampo(pickCampoStrSalvo(r, 'faseCampo', ''));
    setAudienciaData(pickCampoStrSalvo(r, 'audienciaData', ''));
    setAudienciaHora(pickCampoStrSalvo(r, 'audienciaHora', ''));
    setAudienciaTipo(pickCampoStrSalvo(r, 'audienciaTipo', ''));
    setAvisoAudiencia(pickCampoStrSalvo(r, 'avisoAudiencia', 'nao_avisado') || 'nao_avisado');
    setProximaInformacao(pickCampoStrSalvo(r, 'proximaInformacao', ''));
    setDataProximaInformacao(pickCampoStrSalvo(r, 'dataProximaInformacao', ''));
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
    setUnidadeEndereco(mergedUnidade);

    if (!featureFlags.useApiProcessos) {
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
        pastaArquivo: pickCampoStrSalvo(r, 'pastaArquivo', ''),
        valorCausa: pickCampoStrSalvo(r, 'valorCausa', mock.valorCausa),
        procedimento: pickCampoStrSalvo(r, 'procedimento', ''),
        responsavel: pickCampoStrSalvo(r, 'responsavel', ''),
        competencia: pickCampoStrSalvo(r, 'competencia', mock.competencia),
        observacao: pickCampoStrSalvo(r, 'observacao', mock.observacao),
        faseCampo: pickCampoStrSalvo(r, 'faseCampo', ''),
        audienciaData: pickCampoStrSalvo(r, 'audienciaData', ''),
        audienciaHora: pickCampoStrSalvo(r, 'audienciaHora', ''),
        audienciaTipo: pickCampoStrSalvo(r, 'audienciaTipo', ''),
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
    void carregarProcessoApiAtual();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoCliente, processo]);

  useEffect(() => {
    // Ao mudar cliente/processo, permite de novo o preenchimento automático do vínculo com imóvel
    // (valores vêm do registro persistido ou do mock no efeito de carga).
    setImovelManual(false);
    setUnidadeEnderecoManual(false);
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

  function handleImovelIdBlur() {
    /* Unidade vem do cadastro de imóveis na API ou do que o usuário informou. */
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

    /** Abre Imóveis: com API, o campo costuma ser o nº da planilha (col. A); links antigos com id interno ainda funcionam (fallback no carregamento). */
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

    const usuariosAlvo = (getUsuariosAtivos() || []).map((u) => ({
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
    const s = String(pastaArquivo || '').trim();
    if (!s) {
      window.alert('Informe o link ou caminho em "Pasta do Arquivo".');
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

  function abrirModalTramitacao() {
    setTramitacaoDraft(tramitacao || '');
    setModalTramitacaoAberto(true);
  }

  function confirmarTramitacao() {
    const valor = String(tramitacaoDraft ?? '').trim();
    setTramitacao(valor);
    setProcedimento(valor);
    if (featureFlags.useApiProcessos) {
      void sincronizarApiProcessoAtual({ tramitacao: valor });
    } else {
      salvarHistoricoDoProcesso(montarPayloadRegistroProcesso({ tramitacao: valor }));
    }
    setModalTramitacaoAberto(false);
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

  /** Snapshot completo do formulário para `localStorage` (processo × cliente). */
  function montarPayloadRegistroProcesso(overrides = {}) {
    const pf = String(prazoFatal ?? '').trim();
    const prazoNorm = pf ? (normalizarDataBr(pf) || pf) : '';
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
      naturezaAcao,
      consultaAutomatica,
      estado,
      cidade,
      dataProtocolo,
      pastaArquivo,
      valorCausa,
      procedimento,
      responsavel,
      competencia,
      observacao,
      papelParte,
      statusAtivo,
      faseCampo,
      audienciaData,
      audienciaHora,
      audienciaTipo,
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
  function aplicarListaPartesApiNaUi(partes) {
    const entradasCliente = [];
    const entradasOposta = [];
    const nomesCliente = [];
    const nomesOposta = [];
    const cacheNomesPartes = [];
    for (const p of partes || []) {
      const poloNorm = String(p.polo ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
      const alvoCliente =
        poloNorm.includes('AUTOR') ||
        poloNorm.includes('REQUERENTE') ||
        poloNorm.includes('CLIENTE');
      const alvoOposta = !alvoCliente;
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
      if (alvoOposta && temPessoa) {
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
    setConsultaAutomatica(false);
    setTramitacao('');
    setResponsavel('');
    setValorCausa('');
    setHistorico([]);
    setPeriodicidadeConsulta('');
    setPastaArquivo('');
    setProcedimento('');
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

  async function carregarProcessoApiAtual() {
    if (!featureFlags.useApiProcessos) return;
    const seq = ++carregarProcessoApiSeqRef.current;
    setApiError('');
    try {
      setParteClienteEntradas([]);
      setParteOpostaEntradas([]);
      setParteCliente('');
      setParteOposta('');
      // Sempre pela chave natural (cliente + proc.): processoApiId pode ser do cliente anterior ao trocar o código.
      const procApi = await buscarProcessoPorChaveNatural(codigoCliente, processo);
      if (seq !== carregarProcessoApiSeqRef.current) return;
      if (!procApi) {
        setProcessoApiId(null);
        setClienteProcessoApiId(null);
        setParteClienteEntradas([]);
        setParteOpostaEntradas([]);
        setParteCliente('');
        setParteOposta('');
        aplicarCabecalhoVazioProcessoNaoCadastradoApi();
        return;
      }
      setProcessoApiId(procApi.id);
      const mapped = mapApiProcessoToUiShape(procApi);
      setClienteProcessoApiId(
        mapped.clienteId != null && Number.isFinite(Number(mapped.clienteId)) && Number(mapped.clienteId) > 0
          ? Number(mapped.clienteId)
          : procApi.clienteId != null
            ? Number(procApi.clienteId)
            : null
      );
      // Valores exatamente como na API (sem || estado anterior): evita manter mock/localStorage quando a API devolve vazio.
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
      setConsultaAutomatica(mapped.consultaAutomatica);
      setTramitacao(mapped.tramitacao ?? '');
      setProcedimento(mapped.procedimento ?? mapped.tramitacao ?? '');
      setFaseCampo(mapped.observacaoFase ?? '');
      setResponsavel(mapped.responsavel ?? '');
      setUnidadeEndereco(mapped.unidade ?? '');
      setUnidadeEnderecoManual(String(mapped.unidade ?? '').trim() !== '');

      const partes = await listarPartesProcesso(procApi.id);
      if (seq !== carregarProcessoApiSeqRef.current) return;
      aplicarListaPartesApiNaUi(partes);

      const andamentos = await listarAndamentosProcesso(procApi.id);
      if (seq !== carregarProcessoApiSeqRef.current) return;
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
        setHistorico([]);
        setPaginaHistorico(1);
      }
    } catch (e) {
      if (seq !== carregarProcessoApiSeqRef.current) return;
      setApiError(e?.message || 'Falha ao carregar processo da API.');
    }
  }

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
      const snapshot = montarPayloadRegistroProcesso(overrides);
      const clienteApi = await buscarClientePorCodigo(snapshot.codCliente);
      if (!clienteApi?.id) throw new Error('Cliente não encontrado na API para este código.');
      const saved = await salvarCabecalhoProcesso({
        ...snapshot,
        processoId: processoApiId,
        clienteId: clienteApi.id,
        numeroInterno: Number(snapshot.proc),
        valorCausaNumero: parseValorMonetarioBr(snapshot.valorCausa),
      });
      const pid = saved?.id || processoApiId;
      setProcessoApiId(pid);
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
        await sincronizarPartesIncremental(pid, [
          ...linhasCli.map((row, ordem) => ({
            pessoaId: Number(row.pessoaId),
            nomeLivre: null,
            polo: 'AUTOR',
            qualificacao: 'Parte cliente',
            ordem,
            advogadoPessoaIds: row.advogadoPessoaIds || [],
          })),
          ...linhasOp.map((row, ordem) => ({
            pessoaId: Number(row.pessoaId),
            nomeLivre: null,
            polo: 'REU',
            qualificacao: 'Parte oposta',
            ordem,
            advogadoPessoaIds: row.advogadoPessoaIds || [],
          })),
          ...(linhasCli.length ? [] : [{
            pessoaId: null,
            nomeLivre: snapshot.parteCliente || null,
            polo: 'AUTOR',
            qualificacao: 'Parte cliente',
            ordem: 0,
            advogadoPessoaIds: [],
          }]),
          ...(linhasOp.length ? [] : [{
            pessoaId: null,
            nomeLivre: snapshot.parteOposta || null,
            polo: 'REU',
            qualificacao: 'Parte oposta',
            ordem: 0,
            advogadoPessoaIds: [],
          }]),
        ]);
      }
      if (pid && opts.syncAndamentos) {
        await sincronizarAndamentosIncremental(pid, snapshot.historico || []);
      }
      if (pid && opts.syncPrazoFatal) {
        await upsertPrazoFatalProcesso(pid, snapshot.prazoFatal);
      }
      if (pid && deveRefetchPartes) {
        const partesAtualizadas = await listarPartesProcesso(pid);
        aplicarListaPartesApiNaUi(partesAtualizadas);
      }
      // O backend ainda não persiste audiência; o relatório «Audiências pendentes» (Diagnósticos) lê só o histórico local.
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
    if (featureFlags.useApiProcessos) {
      void sincronizarApiProcessoAtual();
      return;
    }
    salvarHistoricoDoProcesso(montarPayloadRegistroProcesso());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot completo; listar deps duplicaria montarPayload
  }, [
    edicaoDesabilitada,
    codigoCliente,
    processo,
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
    naturezaAcao,
    consultaAutomatica,
    estado,
    cidade,
    dataProtocolo,
    pastaArquivo,
    valorCausa,
    procedimento,
    responsavel,
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
      if (featureFlags.useApiProcessos) {
        void sincronizarApiProcessoAtual(
          { historico: historicoAtualizado },
          { syncPartes: false, syncAndamentos: true, syncPrazoFatal: false }
        );
      } else {
        salvarHistoricoDoProcesso(montarPayloadRegistroProcesso({ historico: historicoAtualizado }));
      }
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
      inf: String(novoNumero).padStart(2, '0'),
      info,
      data,
      usuario: nomeUsuarioAtivoParaHistorico(),
      numero: String(novoNumero).padStart(4, '0'),
    };
    const historicoAtualizado = [novoItem, ...historico];
    setHistorico(historicoAtualizado);
    setPaginaHistorico(1);
    setProximaInformacao('');
    setDataProximaInformacao('');
    if (featureFlags.useApiProcessos) {
      void sincronizarApiProcessoAtual(
        { historico: historicoAtualizado },
        { syncPartes: false, syncAndamentos: true, syncPrazoFatal: false }
      );
    } else {
      salvarHistoricoDoProcesso(montarPayloadRegistroProcesso({ historico: historicoAtualizado }));
    }
  }

  function persistirPrazoFatalAposEdicao(valorBruto) {
    const t = String(valorBruto ?? '').trim();
    const prazoNorm = t ? (normalizarDataBr(t) || t) : '';
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

  const cidades = CIDADES_POR_UF[estado] || [];
  const totalPaginasHistorico = Math.max(1, Math.ceil(historico.length / HISTORICO_POR_PAGINA));
  const historicoPaginado = historico.slice(
    (paginaHistorico - 1) * HISTORICO_POR_PAGINA,
    paginaHistorico * HISTORICO_POR_PAGINA
  );
  const ufAtual = UFS.find((u) => u.sigla === estado);

  const faseSelecionadaNormalizada = normalizarTextoBusca(faseSelecionada);
  // Regra: se estiver em "Ag. Documentos", o formulário da tela deve ficar amarelo.
  // Mantemos uma detecção tolerante (ex.: "Ag. Documetos") removendo pontuação e comparando substrings.
  const faseSelecionadaCompacta = faseSelecionadaNormalizada.replace(/[^a-z0-9]/g, '');
  const isAgDocumentos = faseSelecionadaCompacta.startsWith('ag') && faseSelecionadaCompacta.includes('docu') && (faseSelecionadaCompacta.includes('ment') || faseSelecionadaCompacta.includes('met'));
  const isAgPeticionar =
    faseSelecionadaCompacta.startsWith('ag') &&
    faseSelecionadaCompacta.includes('petic') &&
    (faseSelecionadaCompacta.includes('ar') || faseSelecionadaCompacta.includes('ionar') || faseSelecionadaCompacta.includes('icion'));
  const isAgVerificacao =
    faseSelecionadaCompacta.startsWith('ag') &&
    (faseSelecionadaCompacta.includes('verif') || faseSelecionadaCompacta.includes('verificacao'));
  const isProtocoloMovimentacao =
    faseSelecionadaCompacta.includes('protoc') && faseSelecionadaCompacta.includes('moviment');
  const isAguardandoProvidencia =
    faseSelecionadaCompacta.includes('aguard') && faseSelecionadaCompacta.includes('provid');
  const isProcAdministrativo =
    faseSelecionadaCompacta.includes('procadministrativo') ||
    (faseSelecionadaCompacta.includes('proced') && faseSelecionadaCompacta.includes('adm'));

  const inputClass = "w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white";
  /** Fundo neutro + select-text: em readOnly o usuário ainda seleciona/copia o conteúdo. */
  const inputDisabledClass = "w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-slate-50 select-text";
  /** Edição desabilitada: campos não editáveis, mas texto ainda selecionável/copiável (readOnly, não disabled). */
  const camposBloqueados = edicaoDesabilitada;
  const clsCampo = camposBloqueados ? inputDisabledClass : inputClass;
  /** Campos mais baixos na secção «Dados processuais» (menos rolagem). */
  const inputClassDenso = 'w-full px-1.5 py-1 border border-slate-300 rounded text-sm leading-tight bg-white';
  const inputDisabledClassDenso =
    'w-full px-1.5 py-1 border border-slate-300 rounded text-sm leading-tight bg-slate-50 select-text';
  const clsCampoDenso = camposBloqueados ? inputDisabledClassDenso : inputClassDenso;

  const agendarAudienciaApiDebounceRef = useRef(null);

  // Agenda: replica a audiência para todos os colaboradores ao haver data válida (formulário Processos).
  useEffect(() => {
    if (!audienciaData) return;
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(audienciaData)) return;

    const payload = {
      audienciaData,
      audienciaHora,
      audienciaTipo,
      numeroProcessoNovo,
      codigoCliente,
      numeroInterno: processo,
      parteCliente: textoParteCliente || parteCliente,
      parteOposta: textoParteOposta || parteOposta,
      competencia,
    };

    if (featureFlags.useApiAgenda) {
      if (agendarAudienciaApiDebounceRef.current != null) {
        window.clearTimeout(agendarAudienciaApiDebounceRef.current);
      }
      agendarAudienciaApiDebounceRef.current = window.setTimeout(() => {
        agendarAudienciaApiDebounceRef.current = null;
        void replicarAudienciaProcessoTodosColaboradoresApi(payload);
      }, 600);
      return () => {
        if (agendarAudienciaApiDebounceRef.current != null) {
          window.clearTimeout(agendarAudienciaApiDebounceRef.current);
          agendarAudienciaApiDebounceRef.current = null;
        }
      };
    }

    agendarAudienciaParaTodosUsuarios(payload);
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
  ]);

  function formatarDataAudienciaInput(valor) {
    const alias = resolverAliasHojeEmTexto(valor, 'br');
    if (alias) return alias;
    // Máscara simples para manter no formato dd/mm/aaaa.
    // Aceita digitação/colar com ou sem barras e reformatará ao longo do input.
    const digits = String(valor ?? '').replace(/\D/g, '').slice(0, 8);
    if (!digits) return '';
    const dd = digits.slice(0, 2);
    const mm = digits.slice(2, 4);
    const yyyy = digits.slice(4, 8);
    if (digits.length <= 2) return dd;
    if (digits.length <= 4) return `${dd}/${mm}`;
    return `${dd}/${mm}/${yyyy}`;
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

  return (
    <div
      className={`${isEmbedded ? 'min-h-0 w-full' : 'min-h-full'} bg-gradient-to-br from-slate-100 via-indigo-50/35 to-emerald-50/45 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d]`}
    >
      <div className={`max-w-[1400px] mx-auto px-3 py-3 ${isEmbedded ? 'min-w-0' : ''}`}>
        {/* Cabeçalho: Processos + X */}
        <header className="mb-3 flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-800 dark:from-slate-100 dark:via-indigo-200 dark:to-slate-200 bg-clip-text text-transparent">
              Processos
            </h1>
            <button
              type="button"
              onClick={() =>
                setClientesEmbed({
                  revision: Date.now(),
                  routerState: buildRouterStateChaveClienteProcesso(codigoCliente, processo),
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/60 bg-emerald-50 text-emerald-900 text-sm font-medium hover:bg-emerald-100 shrink-0"
              title="Abrir cadastro de clientes com este código de cliente e nº de processo (janela suspensa)"
            >
              <Users className="w-4 h-4" aria-hidden />
              Clientes
            </button>
            <button
              type="button"
              onClick={() => setModalRelatorioPublicacoes(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-400 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 shrink-0"
              title="Relatório das publicações importadas vinculadas a este processo"
            >
              <Newspaper className="w-4 h-4" aria-hidden />
              Publicações
            </button>
            <button
              type="button"
              onClick={() => {
                setIndiceAcaoRedacaoFocada(0);
                indiceAcaoRedacaoFocadaRef.current = 0;
                setModalAcoesRedacaoAberto(true);
              }}
              className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-400 bg-white text-slate-800 hover:bg-slate-50 shrink-0"
              title="Escolher tipo de ação de redação para este processo"
              aria-label="Abrir ações de redação vinculadas ao processo"
            >
              <IconMaoEscrevendo />
            </button>
            {featureFlags.useApiTarefas ? (
              <button
                type="button"
                onClick={abrirModalTarefaDoProcesso}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/60 bg-emerald-50 text-emerald-900 text-sm font-medium hover:bg-emerald-100 shrink-0"
                title="Criar tarefa operacional vinculada a este processo (API)"
              >
                <ListTodo className="w-4 h-4" aria-hidden />
                Criar tarefa
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              if (isEmbedded && typeof onFecharEmbed === 'function') onFecharEmbed();
              else window.history.back();
            }}
            className="p-2 rounded border border-slate-400 bg-white text-slate-600 hover:bg-slate-100 shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </header>
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

        <div
          className={`rounded-2xl border shadow-md overflow-hidden ${
            isProtocoloMovimentacao
              ? 'bg-black border-slate-700 text-slate-100 dark-mode-protocolo'
              : isAguardandoProvidencia
                ? 'bg-sky-700 border-sky-800 text-white processos-fase-aguardando-providencia'
              : isProcAdministrativo
                ? 'bg-teal-200 border-cyan-300'
              : isAgPeticionar
                ? 'bg-red-400/85 border-red-700 text-slate-900'
                : isAgDocumentos
                  ? 'bg-yellow-200 border-yellow-400'
                  : isAgVerificacao
                    ? 'bg-purple-200 border-purple-400'
                    : 'bg-white border-slate-300'
          }`}
        >
          <div className="p-2.5 sm:p-3 space-y-2.5">
            {/* Faixa CNJ + cliente — distinto de valor da causa e dados internos */}
            <div className="rounded-lg border border-indigo-400/40 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 px-3 py-2 shadow-md ring-1 ring-indigo-500/30 text-white">
              <div className="flex flex-wrap items-start justify-between gap-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-200/90 mb-0.5">
                    Número no tribunal (CNJ)
                  </p>
                  <p
                    className="font-mono text-[15px] sm:text-lg font-semibold tracking-tight break-all leading-snug"
                    title={(numeroProcessoNovo || '').trim() || undefined}
                  >
                    {(numeroProcessoNovo || '').trim() || '—'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      statusAtivo
                        ? 'bg-emerald-400/20 text-emerald-100 ring-1 ring-emerald-400/35'
                        : 'bg-slate-600/60 text-slate-100'
                    }`}
                  >
                    {statusAtivo ? 'Ativo' : 'Inativo'}
                  </span>
                  <span
                    className="rounded-full bg-white/12 px-2 py-0.5 text-[10px] font-semibold text-indigo-50 max-w-[10.5rem] sm:max-w-[14rem] truncate ring-1 ring-white/15"
                    title={faseSelecionada || undefined}
                  >
                    {faseSelecionada || 'Fase'}
                  </span>
                </div>
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-white/15 flex items-baseline gap-2 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300/90 shrink-0">Cliente</span>
                <span className="text-sm font-medium text-white/95 truncate" title={cliente}>
                  {cliente || '—'}
                </span>
              </div>
            </div>

            {/* Urgência: prazo fatal + audiência no topo para leitura imediata */}
            <div className="rounded-lg border-2 border-violet-300/50 bg-gradient-to-br from-violet-50/95 via-white to-rose-50/40 p-2 sm:p-2 shadow-sm">
              <div className="flex flex-col lg:flex-row gap-2 lg:items-stretch">
                <div className="lg:w-[min(100%,15.5rem)] shrink-0 rounded-md border-2 border-rose-400/60 bg-gradient-to-b from-rose-50 to-rose-100/80 p-2 shadow-sm ring-1 ring-rose-200/60">
                  <div className="flex items-center gap-1.5 mb-1 text-rose-950">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden />
                    <span className="text-[11px] font-bold uppercase tracking-wide">Urgência</span>
                  </div>
                  <Field label="Prazo Fatal" dense className="w-full [&_label]:text-rose-900">
                    <input
                      type="text"
                      value={prazoFatal}
                      readOnly={camposBloqueados}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPrazoFatal(resolverAliasHojeEmTexto(v, 'br') ?? v);
                      }}
                      onBlur={(e) => persistirPrazoFatalAposEdicao(e.target.value)}
                      placeholder="dd/mm/aaaa ou hj"
                      title="Data vinculada ao processo (gravada automaticamente)"
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
                  <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-violet-200/70">
                    <Calendar className="w-4 h-4 text-violet-600 shrink-0" aria-hidden />
                    <span className="text-[11px] font-bold uppercase tracking-wide text-violet-950">Audiência</span>
                    {avisoAudiencia === 'avisado' ? (
                      <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-400/40">
                        Avisado
                      </span>
                    ) : (
                      <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-900 ring-1 ring-amber-400/35">
                        Não avisado
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-end gap-x-2 gap-y-1.5">
                    <Field label="Data" className="w-[7.25rem] shrink-0 min-w-0">
                      <input
                        type="text"
                        value={audienciaData}
                        readOnly={camposBloqueados}
                        onChange={(e) => setAudienciaData(formatarDataAudienciaInput(e.target.value))}
                        onDoubleClick={() => {
                          if (camposBloqueados) return;
                          const norm = normalizarDataBr(audienciaData);
                          if (!norm) return;
                          const ok = /^(\d{2})\/(\d{2})\/(\d{4})$/.test(norm);
                          if (!ok) return;
                          navigate('/agenda', {
                            replace: false,
                            state: { agendaData: norm },
                          });
                        }}
                        onBlur={() => {
                          const norm = normalizarDataBr(audienciaData);
                          if (norm) setAudienciaData(norm);
                        }}
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
                          value={audienciaTipo || '—'}
                          readOnly
                          className={`w-full min-w-0 ${clsCampo}`}
                          title={audienciaTipo || undefined}
                        />
                      ) : (
                        <select
                          value={audienciaTipo}
                          onChange={(e) => setAudienciaTipo(e.target.value)}
                          className={`w-full min-w-0 ${clsCampo}`}
                        >
                          <option value="">—</option>
                          {TIPOS_AUDIENCIA.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                          {audienciaTipo &&
                          !TIPOS_AUDIENCIA.includes(audienciaTipo) ? (
                            <option value={audienciaTipo}>{audienciaTipo}</option>
                          ) : null}
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

            {/* Seção superior: 3 colunas - Identificação | Partes/Local | Papel/Fase/Status */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-2.5 md:gap-3">
              {/* Coluna esquerda: Código + Processo na mesma linha, Cliente, Edição, Nº velho/novo */}
              <div className="space-y-2 rounded-xl border border-slate-200/90 bg-white/95 p-3 shadow-sm text-slate-900">
                <div className="flex flex-wrap items-end gap-3">
                  <Field
                    label="Código do Cliente"
                    title="Único campo editável com «Edição desabilitada» marcada: permite trocar de cliente e recarregar o formulário."
                  >
                    <div className="flex border border-slate-300 rounded overflow-hidden bg-white">
                      <button
                        type="button"
                        className="p-1 border-r border-slate-300 hover:bg-slate-100"
                        onClick={() => setCodigoCliente((v) => padCliente(Math.max(1, Number(normalizarCliente(v)) - 1)))}
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <input
                        type="text"
                        value={codigoCliente}
                        onChange={(e) => {
                          const digits = apenasDigitos(e.target.value);
                          // Permite apagar completamente durante digitação (mobile/backspace).
                          setCodigoCliente(digits);
                        }}
                        onBlur={(e) => {
                          const digits = apenasDigitos(e.target.value);
                          setCodigoCliente(padCliente(digits || '1'));
                        }}
                        className="w-20 px-1 py-1 text-sm text-center border-0 bg-white"
                      />
                      <button
                        type="button"
                        className="p-1 border-l border-slate-300 hover:bg-slate-100"
                        onClick={() => setCodigoCliente((v) => padCliente(Number(normalizarCliente(v)) + 1))}
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </Field>
                  <Field
                    label="Processo"
                    title="Único campo editável com «Edição desabilitada» marcada: permite trocar de processo e recarregar o formulário."
                  >
                    <div className="flex border border-slate-300 rounded overflow-hidden w-20">
                      <button
                        type="button"
                        className="p-1 border-r border-slate-300 hover:bg-slate-100"
                        onClick={() => setProcesso((p) => Math.max(1, (Number(p) || 1) - 1))}
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={String(processo)}
                        onChange={(e) => {
                          const raw = String(e.target.value ?? '').replace(/\D/g, '');
                          if (raw === '') {
                            setProcesso(1);
                            return;
                          }
                          setProcesso(Math.max(1, Number(raw) || 1));
                        }}
                        className="w-10 px-0 py-1 text-sm text-center border-0 bg-white"
                      />
                      <button
                        type="button"
                        className="p-1 hover:bg-slate-100"
                        onClick={() => setProcesso((p) => p + 1)}
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </Field>
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer shrink-0">
                    <input type="checkbox" checked={edicaoDesabilitada} onChange={(e) => setEdicaoDesabilitada(e.target.checked)} className="rounded border-slate-300" />
                    Edição Desabilitada
                  </label>
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
                      disabled={camposBloqueados}
                      className="p-1.5 rounded border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:pointer-events-none"
                      title="Documentos"
                    >
                      <FolderOpen className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                </Field>
              </div>

              {/* Coluna central: Parte Cliente, Parte Oposta, Consulta, Estado+Cidade (linha) */}
              <div className="space-y-2 rounded-xl border border-slate-200/90 bg-white/95 p-3 shadow-sm text-slate-900">
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
                    className="w-full px-3 py-2 rounded-lg border border-indigo-300 bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm"
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
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <Field label="Estado" className="min-w-0">
                    <select
                      value={estado}
                      onChange={(e) => {
                        const uf = e.target.value;
                        setEstado(uf);
                        setCidade((CIDADES_POR_UF[uf] || [])[0] || '');
                      }}
                      disabled={camposBloqueados}
                      className={`w-full min-w-0 ${clsCampo}`}
                      title={ufAtual ? `${ufAtual.sigla} — ${ufAtual.nome}` : estado}
                    >
                      {!UFS.some((u) => u.sigla === estado) && estado ? (
                        <option value={estado}>{estado}</option>
                      ) : null}
                      {UFS.map((u) => (
                        <option key={u.sigla} value={u.sigla}>
                          {u.sigla} — {u.nome}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Cidade" className="min-w-0">
                    {camposBloqueados ? (
                      <input type="text" readOnly value={cidade} className={`w-full min-w-0 ${clsCampo}`} title={cidade} />
                    ) : (
                      <select
                        value={cidade}
                        onChange={(e) => setCidade(e.target.value)}
                        className={`w-full min-w-0 ${inputClass}`}
                      >
                        {cidades.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                </div>
              </div>

              {/* Coluna direita: Papel, Status, Fase (caixa) */}
              <div className="space-y-3 rounded-xl border border-slate-200/90 bg-white/95 p-3 shadow-sm text-slate-900">
                <div className="flex flex-row flex-wrap items-end gap-x-4 gap-y-2 w-full min-w-0">
                  <div className="min-w-0 w-[min(100%,13rem)] max-w-[13rem] shrink-0">
                    <p className="text-sm font-medium text-slate-700 mb-1">Cliente é Requerente ou Requerido?</p>
                    {camposBloqueados ? (
                      <input
                        type="text"
                        readOnly
                        value={papelParte === 'requerente' ? 'Requerente' : 'Requerido'}
                        className={`w-full min-w-0 ${clsCampo}`}
                      />
                    ) : (
                      <select
                        value={papelParte}
                        onChange={(e) => setPapelParte(e.target.value)}
                        className={`w-full min-w-0 ${inputClass}`}
                      >
                        <option value="requerente">Requerente</option>
                        <option value="requerido">Requerido</option>
                      </select>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0 shrink-0 pb-0.5">
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
                </div>
                <div className="rounded-lg border border-blue-200/80 border-l-4 border-l-blue-600 bg-gradient-to-br from-blue-50/90 to-slate-50/50 p-2 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-900 mb-1">Fase processual</p>
                  <div className="space-y-0.5 max-h-[11rem] overflow-y-auto pr-0.5">
                    {FASES.map((f) => (
                      <label
                        key={f}
                        className={`flex items-center gap-2 text-sm ${camposBloqueados ? 'cursor-default opacity-90' : 'cursor-pointer'}`}
                      >
                        <input
                          type="radio"
                          name="fase"
                          checked={faseSelecionada === f}
                          disabled={camposBloqueados}
                          onChange={() => {
                            setFaseSelecionada(f);
                            salvarHistoricoDoProcesso(montarPayloadRegistroProcesso({ faseSelecionada: f }));
                          }}
                          className="text-blue-600"
                        />
                        {f}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Dados processuais — grelha 12 col em md+ para Fase na mesma linha; campos densos */}
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
                  <Field label="Pasta do Arquivo" dense className="col-span-1 md:col-span-3 min-w-0">
                    <input
                      type="text"
                      value={pastaArquivo}
                      readOnly={camposBloqueados}
                      onChange={(e) => setPastaArquivo(e.target.value)}
                      className={clsCampoDenso}
                    />
                  </Field>
                  <Field label="Responsável" dense className="col-span-1 md:col-span-3 min-w-0">
                    <input
                      type="text"
                      value={responsavel}
                      readOnly={camposBloqueados}
                      onChange={(e) => setResponsavel(e.target.value)}
                      className={clsCampoDenso}
                    />
                  </Field>
                  <div className="col-span-2 md:col-span-4 rounded-md border-l-[3px] border-amber-500 bg-amber-50/90 pl-2 pr-1.5 py-1 ring-1 ring-amber-200/50 min-w-0">
                    <Field label="Valor da Causa" dense className="[&_label]:text-amber-900/90">
                      <input
                        type="text"
                        value={valorCausa}
                        readOnly={camposBloqueados}
                        onChange={(e) => setValorCausa(e.target.value)}
                        className={`${clsCampoDenso} border-amber-200/90`}
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
                  <Field label="Procedimento" dense className="col-span-2 md:col-span-3 min-w-0">
                    <input
                      type="text"
                      value={procedimento}
                      readOnly={camposBloqueados}
                      onChange={(e) => setProcedimento(e.target.value)}
                      className={clsCampoDenso}
                    />
                  </Field>
                  <Field label="Fase" dense className="col-span-1 md:col-span-2 min-w-0">
                    <input
                      type="text"
                      value={faseCampo}
                      readOnly={camposBloqueados}
                      onChange={(e) => setFaseCampo(e.target.value)}
                      className={clsCampoDenso}
                    />
                  </Field>
                  <Field label="Competência" dense className="col-span-2 md:col-span-4 min-w-0">
                    <div className="flex gap-0.5">
                      {camposBloqueados ? (
                        <input type="text" readOnly value={competencia} className={`flex-1 min-w-0 ${clsCampoDenso}`} title={competencia} />
                      ) : (
                        <select
                          value={competencia}
                          onChange={(e) => setCompetencia(e.target.value)}
                          className={`flex-1 min-w-0 ${inputClassDenso}`}
                        >
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
                      >
                        {camposBloqueados ? (
                          <input
                            type="text"
                            readOnly
                            value={periodicidadeConsulta || '—'}
                            className={`w-full min-w-0 ${clsCampoDenso}`}
                            title={periodicidadeConsulta}
                          />
                        ) : (
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
                        )}
                      </Field>
                      <button
                        type="button"
                        onClick={abrirModalTramitacao}
                        className="shrink-0 px-3 py-1 rounded-md border border-slate-500 bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 self-end"
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
                <strong className="text-sky-950">Imóveis:</strong> o nº do imóvel vem do cadastro no menu lateral; ao sair do campo Imóvel, a <strong>Unidade</strong> acima preenche-se automaticamente se estiver vazia.
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
                title="Número do imóvel na tela Imóveis — mesma base de dados (cadastro central)."
              >
                <input
                  type="number"
                  value={imovelId}
                  readOnly={camposBloqueados}
                  onChange={(e) => {
                    setImovelId(e.target.value);
                    setImovelManual(true);
                  }}
                  onBlur={handleImovelIdBlur}
                  className={clsCampo}
                  placeholder="(vazio)"
                />
              </Field>
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

            {/* Abas: Histórico do Processo | Observações | Execução */}
            <section ref={abasProcessoRef} className="border-t border-slate-200/80 pt-3 mt-1">
              <div className="flex flex-wrap items-end gap-1 mb-0">
                <button type="button" onClick={() => setTabAtiva('historico')} className={`px-3.5 py-2 text-sm font-semibold rounded-t-lg border border-b-0 transition-colors ${tabAtiva === 'historico' ? 'bg-white text-indigo-900 border-slate-300 border-indigo-300/60 -mb-px z-[1] shadow-[0_-2px_0_0_white]' : 'bg-slate-100/90 text-slate-600 border-transparent hover:bg-slate-200/90'}`}>
                  Histórico do Processo
                </button>
                <button type="button" onClick={() => setTabAtiva('observacoes')} className={`px-3.5 py-2 text-sm font-semibold rounded-t-lg border border-b-0 transition-colors ${tabAtiva === 'observacoes' ? 'bg-white text-indigo-900 border-slate-300 border-indigo-300/60 -mb-px z-[1] shadow-[0_-2px_0_0_white]' : 'bg-slate-100/90 text-slate-600 border-transparent hover:bg-slate-200/90'}`}>
                  Observações
                </button>
                <button type="button" onClick={() => setTabAtiva('execucao')} className={`px-3.5 py-2 text-sm font-semibold rounded-t-lg border border-b-0 transition-colors ${tabAtiva === 'execucao' ? 'bg-white text-indigo-900 border-slate-300 border-indigo-300/60 -mb-px z-[1] shadow-[0_-2px_0_0_white]' : 'bg-slate-100/90 text-slate-600 border-transparent hover:bg-slate-200/90'}`}>
                  Execução
                </button>
              </div>
              {tabAtiva === 'historico' && (
                <div className="border border-slate-300 rounded-b-lg overflow-hidden bg-white shadow-sm -mt-px">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-sm font-medium text-slate-700 mb-0.5">Próxima informação</label>
                      <input
                        type="text"
                        value={proximaInformacao}
                        onChange={(e) => setProximaInformacao(e.target.value)}
                        placeholder="Digite a próxima informação a ser inserida..."
                        className={inputClass}
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
                      className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50 whitespace-nowrap"
                      title="Grava a informação no histórico (disponível mesmo com edição do formulário desabilitada)"
                    >
                      Manter Inf.
                    </button>
                  </div>
                  <div className="space-y-2 border-t border-slate-200 p-2 md:hidden">
                    {historicoPaginado.length === 0 ? (
                      <p className="py-4 text-center text-sm text-slate-500">Nenhum registro.</p>
                    ) : (
                      historicoPaginado.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm ring-1 ring-slate-100/80 active:bg-slate-50"
                          onClick={() => setInformacaoModal({ info: h.info, inf: h.inf, data: h.data, usuario: h.usuario })}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-xs text-slate-500">
                            <span className="font-mono font-semibold text-slate-700">Inf. {h.inf}</span>
                            <span className="shrink-0 text-slate-600">{h.data}</span>
                          </div>
                          <p className="mt-2 line-clamp-3 text-sm text-slate-800" title={h.info}>
                            {h.info}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500" title={h.usuario || ''}>
                            {h.usuario}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="hidden max-h-[min(72vh,56rem)] min-h-[8rem] overflow-x-auto overflow-y-auto md:block">
                    <table className="w-full table-fixed border-collapse text-sm">
                      <thead className="sticky top-0 bg-slate-100">
                        <tr>
                          <th className="w-[6.25rem] shrink-0 py-1.5 pl-2 pr-6 text-left font-semibold text-slate-700">
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
                        {historicoPaginado.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                              Nenhum registro.
                            </td>
                          </tr>
                        ) : (
                          <>
                            {historicoPaginado.map((h) => (
                              <tr
                                key={h.id}
                                className="cursor-pointer border-t border-slate-200 hover:bg-slate-50/50"
                                onDoubleClick={() => setInformacaoModal({ info: h.info, inf: h.inf, data: h.data, usuario: h.usuario })}
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
                                  <div className="truncate" title={h.usuario || ''}>
                                    {h.usuario}
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
              {tabAtiva === 'observacoes' && (
                <div className="border border-slate-300 rounded-b-lg p-4 bg-white shadow-sm -mt-px">
                  <p className="text-sm text-slate-500">Conteúdo da aba Observações.</p>
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
              <button type="button" className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50">
                Texto para Área de Trasnf.
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
                onClick={() => {
                  setContaCorrenteModo('processo');
                  setModalContaCorrente(true);
                }}
                title="Lançamentos do Financeiro com Cod. Cliente e Proc. iguais a este processo (qualquer classificação contábil no extrato)"
              >
                Conta Corrente
              </button>
            </footer>
          </div>
        </div>
      </div>

      {modalTramitacaoAberto && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-tramitacao-titulo"
          onMouseDown={onModalOverlayMouseDown}
          onClick={criarModalOverlayClickFechar(() => setModalTramitacaoAberto(false))}
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
                onClick={() => setModalTramitacaoAberto(false)}
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
              <h2 id="modal-tramitacao-titulo" className="min-w-0 flex-1 text-base font-semibold text-slate-800">
                Tramitação dos Autos
              </h2>
              <button
                type="button"
                onClick={() => setModalTramitacaoAberto(false)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {TRAMITACAO_OPCOES.map((op) => (
                <label key={op} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="tramitacao-autos"
                    checked={tramitacaoDraft === op}
                    onChange={() => setTramitacaoDraft(op)}
                    className="text-slate-600"
                  />
                  {op}
                </label>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalTramitacaoAberto(false)}
                className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={confirmarTramitacao}
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
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-slate-500 shrink-0" />
                    <input
                      type="text"
                      value={buscaPessoaVinculo}
                      onChange={(e) => setBuscaPessoaVinculo(e.target.value)}
                      placeholder="Nome (mín. 2 letras) ou documento (mín. 3 dígitos)"
                      className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                    />
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
                                  CPF/CNPJ. Os resultados aparecem aqui; não é carregada a lista inteira.
                                </td>
                              </tr>
                            );
                          }
                          if (pessoasBuscaVinculoResultados.length === 0) {
                            return (
                              <tr>
                                <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                                  Nenhuma pessoa encontrada para este termo.
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
                                <span className="font-medium text-slate-800 min-w-0">
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
        const listaBase = lancamentos.map((l, idx) => ({ ...l, numero: l.numero ?? (idx + 1) }));
        const listaFiltrada = filtrarLancamentosContaCorrente(listaBase, buscaContaCorrente.campo, buscaContaCorrente.termo);
        const somaDasLinhasExibidas = listaFiltrada.reduce((s, l) => s + (Number(l.valor) || 0), 0);
        const listaOrdenada = ordenarLancamentosContaCorrente(listaFiltrada, sortContaCorrente.col, sortContaCorrente.dir);
        const somaFormatada = formatValorContaCorrente(somaDasLinhasExibidas);
        return (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-conta-corrente-titulo"
        >
          <div
            className="flex h-full w-full max-w-none flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-xl md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 md:px-4">
              <button
                type="button"
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
                aria-label="Voltar"
                onClick={() => setModalContaCorrente(false)}
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
                onClick={() => setModalContaCorrente(false)}
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 px-4 py-2 border-b border-slate-200 bg-emerald-50/50 shrink-0">
              Origem: lançamentos dos <strong>extratos bancários</strong> no Financeiro com os mesmos{' '}
              <strong>Cod. Cliente</strong> e <strong>Proc.</strong> deste processo (inclui qualquer letra contábil, ex.: A, N),
              como após vincular pelo número do processo ou editar o extrato.{' '}
              {featureFlags.useApiFinanceiro && contaCorrenteListaApi.phase === 'ok' ? (
                <>
                  Com a <strong>API financeira</strong> ativa, a lista abaixo segue o servidor (inclui após zerar extrato).{' '}
                </>
              ) : null}
              <strong>Clique no cabeçalho</strong> de uma coluna para ordenar (ascendente → descendente → volta à ordem por data
              mais recente). Duplo clique numa <strong>linha</strong> continua abrindo o lançamento no Financeiro.
            </p>
            {featureFlags.useApiFinanceiro &&
            contaCorrenteListaApi.phase === 'error' &&
            contaCorrenteListaApi.error ? (
              <p className="text-xs text-red-700 px-4 py-2 border-b border-red-100 bg-red-50 shrink-0">
                {contaCorrenteListaApi.error} — a tabela usa a cópia local dos extratos.
              </p>
            ) : null}
            <div className="flex-1 min-h-0 flex flex-col p-4">
              <div className="flex gap-4 flex-1 min-h-0">
                <div className="flex-1 min-w-0 overflow-auto border border-slate-300 rounded bg-white">
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
                        {[
                          { key: 'data', label: 'Data', w: 'w-24', align: 'text-left' },
                          { key: 'descricao', label: 'Descrição', w: 'min-w-[180px]', align: 'text-left' },
                          { key: 'dataOuId', label: 'Proc.', w: 'w-24', align: 'text-left' },
                          { key: 'valor', label: 'Valor', w: 'w-28', align: 'text-right' },
                          { key: 'nome', label: 'Nome', w: 'min-w-[120px]', align: 'text-left' },
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
                      </tr>
                    </thead>
                    <tbody>
                      {carregandoListaApi ? (
                        <tr>
                          <td colSpan={6} className="border border-slate-200 px-2 py-4 text-center text-slate-500">
                            A carregar lançamentos da API…
                          </td>
                        </tr>
                      ) : listaOrdenada.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="border border-slate-200 px-2 py-4 text-center text-slate-500">
                            Nenhum lançamento do Financeiro vinculado ao cliente {codigoCliente}
                            {contaCorrenteModo === 'proc0' ? ' e processo 0' : processo ? ` e processo ${processo}` : ''}.
                          </td>
                        </tr>
                      ) : (
                        listaOrdenada.map((linha, idx) => (
                          <tr
                            key={`${linha.numero ?? idx}-${linha.data}-${idx}`}
                            className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} ${linha.nomeBanco && linha.numero ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                            title={linha.nomeBanco && linha.numero ? 'Duplo clique: abrir no Financeiro (conta corrente e extrato Itaú)' : undefined}
                            onDoubleClick={() => {
                              if (!linha.nomeBanco || linha.numero == null || !linha.data) return;
                              setModalContaCorrente(false);
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
                            <td className="border border-slate-200 px-2 py-1 text-slate-700">{linha.data}</td>
                            <td className="border border-slate-200 px-2 py-1 text-slate-700">{linha.descricao}</td>
                            <td className="border border-slate-200 px-2 py-1 text-slate-700">{linha.dataOuId}</td>
                            <td className={`border border-slate-200 px-2 py-1 text-right font-medium ${linha.valor < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                              {formatValorContaCorrente(linha.valor)}
                            </td>
                            <td className="border border-slate-200 px-2 py-1 text-slate-700">{linha.nome}</td>
                            <td className="border border-slate-200 px-2 py-1 text-center text-slate-600">{linha.numero ?? (idx + 1)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="shrink-0 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-700">Soma:</label>
                    <input
                      type="text"
                      readOnly
                      value={somaFormatada}
                      className="w-32 px-2 py-1.5 border border-slate-300 rounded text-sm bg-slate-50 text-right font-medium"
                    />
                  </div>
                  {featureFlags.useApiFinanceiro && Number(processoApiId) ? (
                    <p className="text-[11px] text-slate-600">
                      Resumo API: {Number(resumoContaCorrenteApi?.totalLancamentos ?? 0)} lançamento(s)
                    </p>
                  ) : null}
                  {featureFlags.useApiFinanceiro && resumoContaCorrenteApiErro ? (
                    <p className="text-[11px] text-red-600">{resumoContaCorrenteApiErro}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex justify-center px-4 pb-4 pt-4 md:px-0">
                <button
                  type="button"
                  onClick={() => setModalContaCorrente(false)}
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
                Inf.: {informacaoModal.inf} — {informacaoModal.data} — {informacaoModal.usuario}
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

      <ModalCriarTarefaContextual
        open={modalTarefaContextual != null}
        onClose={() => setModalTarefaContextual(null)}
        context={modalTarefaContextual}
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
    </div>
  );
}
