import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsRight,
  SlidersHorizontal,
  MessageCircle,
  PlusCircle,
  X,
  Users,
  Lock,
  Unlock,
  UserX,
  Loader2,
  Check,
  Wallet,
  ClipboardList,
  FileSpreadsheet,
  FileSignature,
} from 'lucide-react';
import { ModalConfiguracoesCalculoCliente } from './ModalConfiguracoesCalculoCliente.jsx';
import { ModalWhatsAppCliente } from './ModalWhatsAppCliente.jsx';
import { ModalCobrancaAutomaticaCliente } from './cobranca/ModalCobrancaAutomaticaCliente.jsx';
import { ModalImportarContratoHonorarios } from './contratos/ModalImportarContratoHonorarios.jsx';
import { estadoPediuFocoCobranca } from './cobranca/cobrancaClienteNav.js';
import { useCloseOnEscape } from '../hooks/useCloseOnEscape.js';
import { importarWhatsAppDaPessoa } from '../repositories/clienteWhatsAppRepository.js';
import { getDadosProcessoClienteUnificado } from '../data/processoClienteProcUnificado.js';
import { buscarCliente, pesquisarCadastroPessoasPorNomeOuCpf } from '../api/clientesService.js';
import { corrigirNomePessoaExibicao } from '../utils/utf8MojibakeUtil.js';
import {
  loadCadastroClienteDados,
  saveCadastroClienteDados,
  mergeProcessosLista,
  loadUltimoCodigoCliente,
  saveUltimoCodigoCliente,
  resolverCodigoClienteInicial,
  coletarCodigosClienteConhecidos,
  obterProximoCodigoClienteSemPessoaAtribuida,
} from '../data/cadastroClientesStorage.js';
import {
  salvarNaturezaAcaoDoProcesso,
  salvarNumeroProcessoNovoDaGradeCadastro,
  salvarParteOpostaDaGradeCadastro,
  alinharListaProcessosDescricaoComHistorico,
  enriquecerListaProcessosComHistoricoLocal,
} from '../data/processosHistoricoData.js';
import { getContextoAuditoriaUsuario, registrarAuditoria } from '../services/auditoriaCliente.js';
import { featureFlags } from '../config/featureFlags.js';
import { validarFormatarCpfCnpjAoSair } from '../services/cpfValidatorService.js';
import {
  buildRouterStateChaveClienteProcesso,
  extrairIntentNavegacaoProcessos,
} from '../domain/camposProcessoCliente.js';
import { filtrarProcessosGradeCliente } from '../data/buscaProcessosGradeCliente.js';
import { filtrarClientesIndicePorCodigo } from '../data/buscaClientesCadastro.js';
import {
  listarClientesIndiceCadastro,
  lerIndiceClientesCacheSincrono,
  buscarClientesCadastroPorTermo,
  obterContextoClienteCadastro,
  resolverClienteCadastroPorCodigo,
  salvarClienteCadastro,
} from '../repositories/clientesRepository.js';
import { getIdPessoaPorCodCliente } from '../data/clienteCodigoHelpers.js';
import {
  buscarMensalistaPorCliente,
  salvarMensalista,
} from '../repositories/mensalistasRepository.js';
import { formatValorMoedaCampo } from '../utils/moneyBr.js';
import { parseValorMonetarioBr as parseValorMonetarioBrUtil } from '../utils/parseValorMonetarioBr.js';
import {
  buscarClientePorCodigo,
  buscarProcessoPorChaveNatural,
  listarProcessosResumoPorCodigoCliente,
  mergeCadastroClientesProcessosComApi,
  salvarCabecalhoProcesso,
} from '../repositories/processosRepository.js';

const ProcessosLazy = lazy(() =>
  import('./Processos.jsx').then((m) => ({ default: m.Processos }))
);

function mensalistaPersistivelKey(m) {
  return JSON.stringify({
    ativo: Boolean(m?.ativo),
    valor: String(m?.valor ?? '').trim(),
    diaVencimento: String(m?.diaVencimento ?? ''),
    dataInicio: String(m?.dataInicio ?? ''),
    dataFim: String(m?.dataFim ?? ''),
    cadastrado: Boolean(m?.cadastrado),
  });
}

const MENSALISTA_ESTADO_VAZIO = {
  cadastrado: false,
  ativo: false,
  valor: '',
  diaVencimento: '10',
  dataInicio: '',
  dataFim: '',
  carregando: false,
  salvando: false,
  erro: '',
};

function hojeIsoLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function editarValorMensalCampo(texto) {
  const raw = String(texto ?? '');
  if (!raw.trim()) return '';
  const n = parseValorMonetarioBrUtil(raw);
  return n != null ? formatValorMoedaCampo(n) : raw;
}

let __ultimoListaClientesLog = 0;
let __ultimoClienteConsultaLog = '';

const DEFAULT_CLIENTE_VAZIO = {
  codigo: '00000001',
  pessoa: '',
  nomeRazao: '',
  cnpjCpf: '',
  edicaoDesabilitada: true,
  clienteInativo: false,
  observacao: '',
};

/** Estado inicial da tela sem cliente escolhido (só busca visível). */
const ESTADO_TELA_SEM_CLIENTE = {
  codigo: '',
  pessoa: '',
  nomeRazao: '',
  cnpjCpf: '',
  edicaoDesabilitada: true,
  clienteInativo: false,
  observacao: '',
  processos: [],
};

/** Transição uniforme em botões da ficha do cliente */
const BTN_TRANSICAO = 'transition-all duration-150 ease-out';

/** Primárias: roxo cheio + elevação no hover */
const btnPrimarioForte = [
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-md',
  'bg-gradient-to-r from-indigo-600 to-violet-600',
  'hover:from-indigo-500 hover:to-violet-500 hover:shadow-lg hover:-translate-y-px',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1',
  'disabled:pointer-events-none disabled:opacity-50 disabled:saturate-50 disabled:hover:translate-y-0',
  BTN_TRANSICAO,
].join(' ');

/** Utilitárias: discretas, não competem com primárias */
const btnUtilDiscreto = [
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-600 shadow-sm',
  'hover:bg-slate-50 hover:border-slate-300',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1',
  'disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-60 disabled:saturate-50',
  BTN_TRANSICAO,
].join(' ');

const btnNavCodigoSeta = [
  'flex w-9 items-center justify-center border-indigo-100 text-indigo-700',
  'hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400',
  BTN_TRANSICAO,
].join(' ');

/** Acentos semânticos da fileira de seções (ícone colorido em repouso) */
const SECAO_BTN_BASE = [
  'inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
  BTN_TRANSICAO,
].join(' ');

const SECAO_ACENTOS = {
  indigo: {
    icon: 'text-indigo-600',
    iconAtivo: 'text-white',
    repouso: 'border-slate-200 bg-white text-slate-800',
    hover: 'hover:border-indigo-200 hover:bg-indigo-50 hover:shadow-md hover:-translate-y-px',
    ativo: 'border-indigo-600 bg-indigo-600 text-white shadow-md',
    focus: 'focus-visible:ring-indigo-500',
  },
  emerald: {
    icon: 'text-emerald-600',
    iconAtivo: 'text-white',
    repouso: 'border-slate-200 bg-white text-slate-800',
    hover: 'hover:border-emerald-200 hover:bg-emerald-50 hover:shadow-md hover:-translate-y-px',
    ativo: 'border-emerald-600 bg-emerald-600 text-white shadow-md',
    focus: 'focus-visible:ring-emerald-500',
  },
  amber: {
    icon: 'text-amber-600',
    iconAtivo: 'text-white',
    repouso: 'border-slate-200 bg-white text-slate-800',
    hover: 'hover:border-amber-200 hover:bg-amber-50 hover:shadow-md hover:-translate-y-px',
    ativo: 'border-amber-600 bg-amber-600 text-white shadow-md',
    focus: 'focus-visible:ring-amber-500',
  },
  cyan: {
    icon: 'text-cyan-600',
    iconAtivo: 'text-white',
    repouso: 'border-slate-200 bg-white text-slate-800',
    hover: 'hover:border-cyan-200 hover:bg-cyan-50 hover:shadow-md hover:-translate-y-px',
    ativo: 'border-cyan-700 bg-cyan-700 text-white shadow-md',
    focus: 'focus-visible:ring-cyan-600',
  },
  violet: {
    icon: 'text-violet-600',
    iconAtivo: 'text-white',
    repouso: 'border-slate-200 bg-white text-slate-800',
    hover: 'hover:border-violet-200 hover:bg-violet-50 hover:shadow-md hover:-translate-y-px',
    ativo: 'border-violet-600 bg-violet-600 text-white shadow-md',
    focus: 'focus-visible:ring-violet-500',
  },
  whatsapp: {
    icon: 'text-[#25D366]',
    iconAtivo: 'text-white',
    repouso: 'border-slate-200 bg-white text-slate-800',
    hover: 'hover:border-[#25D366]/50 hover:bg-[#25D366]/10 hover:shadow-md hover:-translate-y-px',
    ativo: 'border-[#25D366] bg-[#25D366] text-white shadow-md',
    focus: 'focus-visible:ring-[#25D366]',
  },
  sky: {
    icon: 'text-sky-600',
    iconAtivo: 'text-white',
    repouso: 'border-slate-200 bg-white text-slate-800',
    hover: 'hover:border-sky-200 hover:bg-sky-50 hover:shadow-md hover:-translate-y-px',
    ativo: 'border-sky-600 bg-sky-600 text-white shadow-md',
    focus: 'focus-visible:ring-sky-500',
  },
};

/**
 * @param {keyof typeof SECAO_ACENTOS} accent
 * @param {{ ativo?: boolean, disabled?: boolean }} [opts]
 */
function classesBotaoSecao(accent, { ativo = false, disabled = false } = {}) {
  const a = SECAO_ACENTOS[accent];
  if (disabled) {
    return `${SECAO_BTN_BASE} cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-60 saturate-50`;
  }
  if (ativo) {
    return `${SECAO_BTN_BASE} ${a.ativo} ${a.focus}`;
  }
  return `${SECAO_BTN_BASE} ${a.repouso} ${a.hover} ${a.focus}`;
}

/** @param {keyof typeof SECAO_ACENTOS} accent @param {boolean} ativo */
function classesIconeSecao(accent, ativo) {
  const a = SECAO_ACENTOS[accent];
  return `h-4 w-4 shrink-0 ${ativo ? a.iconAtivo : a.icon}`;
}

function formatDocBR(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return d || '—';
}

function textoParteClienteGrade(proc) {
  const t = String(proc?.parteCliente ?? proc?.autor ?? proc?.titularNome ?? '').trim();
  return t && t !== '—' ? t : '—';
}

function textoParteOpostaGrade(proc) {
  const t = String(proc?.parteOposta ?? proc?.reu ?? '').trim();
  return t && t !== '—' ? t : '—';
}

function classeGradeProcessoCliente(proc, idxAlternado) {
  if (proc?.statusAtivo === false) {
    return 'bg-slate-300/75 text-slate-600 cursor-pointer hover:bg-slate-400/60 transition-colors ring-1 ring-inset ring-slate-300/80';
  }
  return `${idxAlternado % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} cursor-pointer hover:bg-indigo-50/60 transition-colors`;
}

function dadosClientePorCodigo(n, clientesApiIndex) {
  const codPad = padCliente8(n);
  const row = Array.isArray(clientesApiIndex) ? clientesApiIndex.find((c) => c.codigo === codPad) : null;
  if (row) {
    const pid = String(row.pessoa ?? '').trim();
    return {
      pessoa: pid,
      nomeRazao: String(row.nomeRazao ?? '').trim(),
      cnpjCpf: formatDocBR(String(row.cnpjCpf ?? '').replace(/\D/g, '')),
    };
  }
  return {
    pessoa: '',
    nomeRazao: `CLIENTE ${String(n).padStart(4, '0')}`,
    cnpjCpf: '—',
  };
}

const inputClass =
  'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400 transition-shadow';

/** Quantidade de processos por página na grade do cadastro de clientes. */
const PROCESSOS_POR_PAGINA = 10;

function normalizarCodigoCliente(val) {
  const s = String(val ?? '').trim();
  if (!s) return '1';
  const n = Number(s);
  if (Number.isNaN(n) || n < 1) return '1';
  return String(Math.floor(n));
}

function padCliente8(val) {
  const n = Number(normalizarCodigoCliente(val));
  return String(n).padStart(8, '0');
}

function apenasDigitos(val) {
  return String(val ?? '').replace(/\D/g, '');
}

/** Exportado para busca de cliente/proc no Financeiro sem sair da tela. */
export function normalizarTextoBusca(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Exportado para busca de cliente/proc no Financeiro sem sair da tela. */
export function normalizarNumeroBusca(s) {
  return String(s ?? '').replace(/\D/g, '');
}

/** Exportado para o cadastro de processos (busca no Financeiro). */
export function gerarMockClienteEProcessos(codigo, clientesApiIndex = []) {
  const n = Number(normalizarCodigoCliente(codigo));
  if (!Number.isFinite(n) || n < 1 || n > 1000) return null;
  const codigoCliente = padCliente8(n);
  const base = dadosClientePorCodigo(n, clientesApiIndex);
  const procRows = [];

  for (let p = 1; p <= 10; p++) {
    const u = getDadosProcessoClienteUnificado(n, p);
    if (!u) continue;
    procRows.push({
      id: `${n}-${p}`,
      procNumero: p,
      processoVelho: u.processoVelho,
      processoNovo: u.processoNovo,
      autor: u.autor,
      reu: u.reu,
      parteOposta: u.parteOposta,
      tipoAcao: u.tipoAcao,
      descricao: u.descricao,
    });
  }

  return {
    codigoCliente,
    pessoa: base.pessoa,
    nomeRazao: base.nomeRazao,
    cnpjCpf: base.cnpjCpf,
    processos: procRows,
  };
}

function somenteDigitos(v) {
  return String(v ?? '').replace(/\D/g, '');
}

function parseValorMonetarioBr(valor) {
  const cleaned = String(valor ?? '').trim().replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function joinComVirgula(partes) {
  return (partes || []).map((x) => String(x ?? '').trim()).filter(Boolean).join(', ');
}

function montarQualificacaoTexto({ nomeRazao, cnpjCpf, pessoaData }) {
  const nome = String(pessoaData?.nome ?? nomeRazao ?? '').trim() || 'QUALIFICAÇÃO NÃO INFORMADA';
  const docDigits = somenteDigitos(pessoaData?.cpf ?? cnpjCpf);
  const email = String(pessoaData?.email ?? '').trim();

  const isPJ = docDigits.length === 14;
  if (isPJ) {
    const cnpjFmt = formatDocBR(docDigits);
    const corpo = [
      `${nome}, pessoa jurídica de direito privado`,
      cnpjFmt !== '—' ? `inscrita no CNPJ sob o nº ${cnpjFmt}` : '',
      'com sede em endereço a ser complementado',
      'neste ato representada na forma de seus atos constitutivos',
    ];
    return `${joinComVirgula(corpo)}.`;
  }

  const cpfFmt = docDigits.length === 11 ? formatDocBR(docDigits) : '';
  const blocos = [
    `${nome}`,
    'brasileiro(a)',
    cpfFmt ? `inscrito(a) no CPF sob o nº ${cpfFmt}` : '',
    'residente e domiciliado(a) em endereço a ser complementado',
    email ? `endereço eletrônico ${email}` : 'não utiliza endereço eletrônico',
  ];
  return `${joinComVirgula(blocos)}.`;
}

/**
 * Com `useApiClientes`, o id da pessoa vem só do backend — não restaurar `pessoa` do localStorage
 * (costumava ficar com o número derivado do código, ex. 728 para 00000728, e mascarava o vínculo real).
 */
function pessoaInicialDoPersistidoOuMock(persisted, mockPessoa) {
  if (featureFlags.useApiClientes) return mockPessoa ?? '';
  return persisted?.pessoa ?? mockPessoa ?? '';
}

function getInitialEstadoCliente(codPreferido, clientesApiIndex = []) {
  const resolved = resolverCodigoClienteInicial(codPreferido, clientesApiIndex);
  const cod = padCliente8(resolved ?? DEFAULT_CLIENTE_VAZIO.codigo);
  const mock = gerarMockClienteEProcessos(cod, clientesApiIndex);
  const persisted = loadCadastroClienteDados(cod);
  if (!mock) {
    return {
      codigo: cod,
      pessoa: pessoaInicialDoPersistidoOuMock(persisted, DEFAULT_CLIENTE_VAZIO.pessoa),
      nomeRazao: persisted?.nomeRazao ?? DEFAULT_CLIENTE_VAZIO.nomeRazao,
      cnpjCpf: persisted?.cnpjCpf ?? DEFAULT_CLIENTE_VAZIO.cnpjCpf,
      observacao: persisted?.observacao !== undefined ? persisted.observacao : DEFAULT_CLIENTE_VAZIO.observacao,
      clienteInativo: persisted?.clienteInativo ?? DEFAULT_CLIENTE_VAZIO.clienteInativo,
      edicaoDesabilitada: true,
      processos: alinharListaProcessosDescricaoComHistorico(
        cod,
        mergeProcessosLista([], persisted?.processos)
      ),
    };
  }
  return {
    codigo: mock.codigoCliente,
    pessoa: pessoaInicialDoPersistidoOuMock(persisted, mock.pessoa),
    nomeRazao: persisted?.nomeRazao ?? mock.nomeRazao,
    cnpjCpf: persisted?.cnpjCpf ?? mock.cnpjCpf,
    observacao: persisted?.observacao !== undefined ? persisted.observacao : DEFAULT_CLIENTE_VAZIO.observacao,
    clienteInativo: persisted?.clienteInativo ?? DEFAULT_CLIENTE_VAZIO.clienteInativo,
    edicaoDesabilitada: true,
    processos: alinharListaProcessosDescricaoComHistorico(
      mock.codigoCliente,
      mergeProcessosLista(mock.processos, persisted?.processos)
    ),
  };
}

/**
 * Estado `codigo` = **codigoCliente** (mesmo dado que a tela Processos em `codigoCliente`). Grade: `procNumero` = **numeroInterno**.
 *
 * @param {import('react-router-dom').Location['state'] | null} [props.embedIntent] — substitui `location.state` para hidratar cliente/proc. (ex.: modal em Processos).
 * @param {number|string} [props.embedIntentRevision] — altera para re-aplicar o intent sem mudar de rota.
 * @param {() => void} [props.onFecharEmbed] — se definido, os botões «Fechar» chamam isto em vez de `history.back()` (modo embutido).
 */
export function CadastroClientes({ embedIntent, embedIntentRevision = 0, onFecharEmbed } = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isEmbedded = embedIntent !== undefined && embedIntent !== null;
  const intentStateForHydration = isEmbedded ? embedIntent : location.state;
  const intentRevisionForHydration = isEmbedded ? String(embedIntentRevision) : location.key;
  const stateFromFinanceiro =
    intentStateForHydration && typeof intentStateForHydration === 'object' ? intentStateForHydration : null;
  const navClientes = extrairIntentNavegacaoProcessos(stateFromFinanceiro);
  const emTelaClientes = location.pathname === '/pessoas' || isEmbedded;
  const codClienteFromState = navClientes?.hasCod ? String(navClientes.codRaw ?? '').trim() : '';
  const focoCobrancaFromState = estadoPediuFocoCobranca(stateFromFinanceiro);
  const cobrancaAutomaticaHabilitada =
    featureFlags.useApiClientes && featureFlags.useApiProcessos && featureFlags.useApiCalculos;
  const procFromState =
    navClientes?.hasProcKey && navClientes.procRaw !== undefined && navClientes.procRaw !== null
      ? String(navClientes.procRaw)
      : '';

  const temClienteNaRota = Boolean(codClienteFromState) || (isEmbedded && navClientes?.hasCod);
  // Persistência da última escolha: ao reentrar na tela Clientes (rota sem cliente, fora de modo
  // embutido), restaura o último cliente aberto em vez de cair na tela de busca vazia.
  const ultimoCodClienteSalvo =
    !temClienteNaRota && !isEmbedded && emTelaClientes ? loadUltimoCodigoCliente() : null;
  const deveRestaurarUltimoCliente = Boolean(ultimoCodClienteSalvo);
  const ini =
    temClienteNaRota || deveRestaurarUltimoCliente
      ? getInitialEstadoCliente(codClienteFromState || ultimoCodClienteSalvo || undefined)
      : ESTADO_TELA_SEM_CLIENTE;
  const [formularioClienteAberto, setFormularioClienteAberto] = useState(
    temClienteNaRota || deveRestaurarUltimoCliente
  );
  const [statusSalvamento, setStatusSalvamento] = useState('idle');
  const [codigo, setCodigo] = useState(ini.codigo);
  const [pessoa, setPessoa] = useState(ini.pessoa);
  const [nomeRazao, setNomeRazao] = useState(ini.nomeRazao);
  const [cnpjCpf, setCnpjCpf] = useState(ini.cnpjCpf);
  const [edicaoDesabilitada, setEdicaoDesabilitada] = useState(ini.edicaoDesabilitada);
  const [clienteInativo, setClienteInativo] = useState(ini.clienteInativo);
  const [observacao, setObservacao] = useState(ini.observacao);
  const [toastDocCliente, setToastDocCliente] = useState(null);
  const [pesquisaProcesso, setPesquisaProcesso] = useState('');
  const [buscaClienteNome, setBuscaClienteNome] = useState('');
  const [paginaProcessos, setPaginaProcessos] = useState(1);
  /** Em mobile: barra extra da grade de processos (botões) fica atrás de «Filtros» recolhível. */
  const [filtrosGradeProcessosAberto, setFiltrosGradeProcessosAberto] = useState(false);
  const [modalQualificacaoAberto, setModalQualificacaoAberto] = useState(false);
  const [modalConfigCalculoAberto, setModalConfigCalculoAberto] = useState(false);
  const [modalCobrancaAutomaticaAberto, setModalCobrancaAutomaticaAberto] = useState(false);
  const [modalImportarContratoAberto, setModalImportarContratoAberto] = useState(false);
  const [modalWhatsAppAberto, setModalWhatsAppAberto] = useState(false);
  const [contaCorrenteEmbed, setContaCorrenteEmbed] = useState(null);
  const [mensalista, setMensalista] = useState(MENSALISTA_ESTADO_VAZIO);
  const [modalEscolherPessoa, setModalEscolherPessoa] = useState(false);
  const [buscaPessoaModal, setBuscaPessoaModal] = useState('');
  const [pessoasModalApiLista, setPessoasModalApiLista] = useState([]);
  const [pessoasModalApiLoading, setPessoasModalApiLoading] = useState(false);
  const [pessoasModalApiErro, setPessoasModalApiErro] = useState('');
  const [processos, setProcessos] = useState(ini.processos);
  const [clientesApiIndex, setClientesApiIndex] = useState(() =>
    featureFlags.useApiClientes ? lerIndiceClientesCacheSincrono() : []
  );
  /** Ref sempre igual ao último `clientesApiIndex` — evita recriar `aplicarDadosCliente` a cada GET e re-disparar efeitos em cadeia. */
  const clientesApiIndexRef = useRef(clientesApiIndex);
  clientesApiIndexRef.current = clientesApiIndex;
  /** Quando `useApiClientes`, fica `true` após o GET /api/clientes/indice (ou cache válido na sessão). */
  const [clientesApiCarregados, setClientesApiCarregados] = useState(() => {
    if (!featureFlags.useApiClientes) return true;
    return lerIndiceClientesCacheSincrono().length > 0;
  });
  const [indiceClientesCarregando, setIndiceClientesCarregando] = useState(false);
  const [clientesBuscaApi, setClientesBuscaApi] = useState([]);
  const [clientesBuscaApiCarregando, setClientesBuscaApiCarregando] = useState(false);
  /** PK `cliente.id` resolvido via `/contexto` ou `/resolucao` — não espera o índice completo. */
  const [clientePkResolvido, setClientePkResolvido] = useState(null);
  const [mensalistaSecaoAberta, setMensalistaSecaoAberta] = useState(false);
  const [erroApiCliente, setErroApiCliente] = useState('');
  /** GET /api/processos?codigoCliente= falhou — a grade fica só com dados locais/mock. */
  const [erroApiProcessosGrade, setErroApiProcessosGrade] = useState('');
  const [processosGradeCarregando, setProcessosGradeCarregando] = useState(false);
  /** Incrementado a cada entrada na rota Clientes — força releitura de API/localStorage no «Próximo cliente». */
  const [proximoClienteRefreshTick, setProximoClienteRefreshTick] = useState(0);
  /** Atualiza ao trocar de cliente, dados da API e cada acesso ao formulário Clientes. */
  const proximoCliente = useMemo(
    () =>
      obterProximoCodigoClienteSemPessoaAtribuida(
        featureFlags.useApiClientes ? clientesApiIndex : [],
        padCliente8(codigo),
        pessoa
      ),
    [clientesApiIndex, codigo, pessoa, proximoClienteRefreshTick]
  );
  /** Primeira execução do auto-save API: não POSTa snapshot inicial ao montar. */
  const skipInitialPersistApiRef = useRef(true);
  /** Idem para modo local (processos + cadastro em localStorage). */
  const skipInitialPersistLocalRef = useRef(true);
  /** Não persiste mensalista ao carregar dados da API (só após edição do usuário). */
  const skipInitialPersistMensalistaRef = useRef(true);
  const mensalistaPersistidoKeyRef = useRef('');
  const mensalistaRef = useRef(mensalista);
  mensalistaRef.current = mensalista;
  /** Evita sobrescrever nome/CPF ao carregar cliente por código (persistido/mock). */
  const pularSincPorCargaClienteRef = useRef(false);
  const primeiraSincPessoaRef = useRef(true);
  /** Ignora respostas antigas de GET /api/clientes/resolucao se o usuário mudar de código rápido. */
  const resolucaoCodigoReqIdRef = useRef(0);
  /** Evita auto-save com snapshot vazio enquanto há GET /resolucao em voo (vários pedidos = contador). */
  const resolucaoClientePendingRef = useRef(0);
  /** Evita aplicar GET /api/processos antigo ao trocar de cliente rápido. */
  const processosApiReqIdRef = useRef(0);
  /** Cancela GET /api/processos anterior ao trocar de cliente ou re-disparar a grade. */
  const processosFetchAbortRef = useRef(null);
  const codigoRef = useRef(codigo);
  codigoRef.current = codigo;
  const pesquisaProcessoInputDesktopRef = useRef(null);
  const pesquisaProcessoInputMobileRef = useRef(null);
  /** Última função `aplicarDadosCliente` — listeners com `[]` de deps chamam sempre a versão atual. */
  const aplicarDadosClienteRef = useRef(() => {});

  useEffect(() => {
    if (!toastDocCliente?.mensagem) return undefined;
    const t = window.setTimeout(() => setToastDocCliente(null), 4200);
    return () => window.clearTimeout(t);
  }, [toastDocCliente]);

  const processosGradeCodigoRef = useRef('');

  const refreshProcessosGrade = useCallback((padded, baseLista) => {
    const baseLocal = Array.isArray(baseLista) ? baseLista : [];
    if (!featureFlags.useApiProcessos) {
      const enriched = alinharListaProcessosDescricaoComHistorico(
        padded,
        enriquecerListaProcessosComHistoricoLocal(padded, baseLocal)
      );
      setErroApiProcessosGrade('');
      setProcessosGradeCarregando(false);
      processosGradeCodigoRef.current = padded;
      setProcessos(enriched);
      return;
    }

    processosFetchAbortRef.current?.abort();
    const ac = new AbortController();
    processosFetchAbortRef.current = ac;

    const myId = ++processosApiReqIdRef.current;
    const codigoGradeAnterior = processosGradeCodigoRef.current;
    processosGradeCodigoRef.current = padded;
    setErroApiProcessosGrade('');
    // Só limpa a grade ao trocar de cliente — evita piscar entre «Carregando…» e dados já hidratados.
    if (codigoGradeAnterior && codigoGradeAnterior !== padded) {
      setProcessos([]);
    }
    setProcessosGradeCarregando(true);

    const fallbackLocal = () =>
      alinharListaProcessosDescricaoComHistorico(
        padded,
        enriquecerListaProcessosComHistoricoLocal(padded, baseLocal)
      );

    void listarProcessosResumoPorCodigoCliente(padded, { signal: ac.signal })
      .then((apiList) => {
        if (processosApiReqIdRef.current !== myId) return;
        setErroApiProcessosGrade('');
        const merged = mergeCadastroClientesProcessosComApi(padded, [], apiList);
        setProcessos(alinharListaProcessosDescricaoComHistorico(padded, merged));
      })
      .catch((e) => {
        if (processosApiReqIdRef.current !== myId) return;
        if (e?.name === 'AbortError') return;
        setErroApiProcessosGrade(
          String(e?.message || '').trim() || 'Não foi possível carregar os processos deste cliente na API.'
        );
        setProcessos(fallbackLocal());
      })
      .finally(() => {
        if (processosApiReqIdRef.current === myId) setProcessosGradeCarregando(false);
      });
  }, []);

  const persistSnapshotRef = useRef(null);
  persistSnapshotRef.current = {
    codigo,
    pessoa,
    nomeRazao,
    cnpjCpf,
    observacao,
    clienteInativo,
    edicaoDesabilitada,
    processos,
  };

  const atualizarIndiceClienteApi = useCallback((apiRow) => {
    if (!apiRow?.codigo) return;
    setClientesApiIndex((prev) => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const i = list.findIndex((c) => c.codigo === apiRow.codigo);
      if (i >= 0) list[i] = { ...list[i], ...apiRow };
      else list.push(apiRow);
      return list.sort(
        (a, b) =>
          Number(String(a.codigo).replace(/\D/g, '')) - Number(String(b.codigo).replace(/\D/g, ''))
      );
    });
  }, []);

  const persistirClienteAtual = useCallback(
    async (override = {}, options = {}) => {
      const s = persistSnapshotRef.current;
      if (!s?.codigo) return null;
      const payload = {
        codigo: s.codigo,
        pessoa: override.pessoa ?? s.pessoa,
        nomeRazao: override.nomeRazao ?? s.nomeRazao,
        cnpjCpf: override.cnpjCpf ?? s.cnpjCpf,
        observacao: override.observacao ?? s.observacao,
        clienteInativo: override.clienteInativo ?? s.clienteInativo,
      };
      if (!String(payload.pessoa ?? '').trim()) {
        throw new Error('Informe uma pessoa vinculada ao cliente.');
      }
      setStatusSalvamento('saving');
      try {
        const saved = await salvarClienteCadastro(payload, {
          suppressEmit: options.suppressEmit !== false,
        });
        if (saved) atualizarIndiceClienteApi(saved);
        setStatusSalvamento('saved');
        window.setTimeout(() => setStatusSalvamento('idle'), 2500);
        setErroApiCliente('');
        return saved;
      } catch (e) {
        setStatusSalvamento('idle');
        setErroApiCliente(
          String(e?.message ?? '').trim() || 'Não foi possível salvar o cadastro do cliente.'
        );
        throw e;
      }
    },
    [atualizarIndiceClienteApi]
  );

  useEffect(() => {
    if (!emTelaClientes) return undefined;
    let cancelado = false;
    void (async () => {
      if (featureFlags.useApiClientes) {
        const tinhaCache = (clientesApiIndexRef.current || []).length > 0;
        if (!tinhaCache) setClientesApiCarregados(false);
        setIndiceClientesCarregando(true);
        try {
          const data = await listarClientesIndiceCadastro();
          if (!cancelado) {
            setClientesApiIndex(Array.isArray(data) ? data : []);
            setErroApiCliente('');
          }
        } catch (e) {
          if (!cancelado) {
            if (!tinhaCache) setClientesApiIndex([]);
            setErroApiCliente(e?.message || 'Erro ao carregar índice de clientes da API.');
          }
        } finally {
          if (!cancelado) {
            setClientesApiCarregados(true);
            setIndiceClientesCarregando(false);
          }
        }
      }
      if (!cancelado) setProximoClienteRefreshTick((t) => t + 1);
    })();
    return () => {
      cancelado = true;
    };
  }, [emTelaClientes, location.pathname]);

  useEffect(() => {
    const now = Date.now();
    if (now - __ultimoListaClientesLog < 1500) return;
    __ultimoListaClientesLog = now;
    const { usuarioNome } = getContextoAuditoriaUsuario();
    registrarAuditoria({
      modulo: 'Clientes',
      tela: '/pessoas',
      tipoAcao: 'ACESSO_LISTA',
      descricao: `Usuário ${usuarioNome} acessou a tela de cadastro de clientes.`,
    });
  }, []);

  useEffect(() => {
    const c = padCliente8(codigo);
    const t = window.setTimeout(() => {
      const nome = String(persistSnapshotRef.current?.nomeRazao ?? '').trim();
      if (!nome) return;
      const key = `${c}|${nome}`;
      if (key === __ultimoClienteConsultaLog) return;
      __ultimoClienteConsultaLog = key;
      const { usuarioNome } = getContextoAuditoriaUsuario();
      registrarAuditoria({
        modulo: 'Clientes',
        tela: '/pessoas',
        tipoAcao: 'ACESSO_CADASTRO',
        descricao: `Usuário ${usuarioNome} consultou o cadastro do cliente ${nome} (código ${c}).`,
        registroAfetadoId: c,
        registroAfetadoNome: nome,
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [codigo, nomeRazao]);

  const aplicarDadosCliente = useCallback((paddedRaw) => {
    pularSincPorCargaClienteRef.current = true;
    const padded = padCliente8(paddedRaw);
    setClientePkResolvido(null);
    setMensalistaSecaoAberta(false);
    setMensalista(MENSALISTA_ESTADO_VAZIO);
    const idx = clientesApiIndexRef.current;
    const mock = gerarMockClienteEProcessos(padded, idx);
    const persisted = loadCadastroClienteDados(padded);

    const baseListaProcessos = () =>
      mock
        ? mergeProcessosLista(mock.processos, persisted?.processos)
        : Array.isArray(persisted?.processos)
          ? [...persisted.processos]
          : [];

    const aplicarCabecalhoApi = (api) => {
      setCodigo(api.codigo);
      setPessoa(api.pessoa ?? '');
      setNomeRazao(corrigirNomePessoaExibicao(api.nomeRazao ?? ''));
      setCnpjCpf(api.cnpjCpf ?? '');
      setObservacao(api.observacao ?? '');
      setClienteInativo(api.clienteInativo ?? false);
      setEdicaoDesabilitada(true);
      if (api.clienteId != null && Number.isFinite(Number(api.clienteId))) {
        setClientePkResolvido(Number(api.clienteId));
      }
      try {
        saveCadastroClienteDados(api.codigo, { pessoa: api.pessoa ?? '' });
      } catch {
        /* ignore */
      }
    };

    if (featureFlags.useApiClientes) {
      const myId = ++resolucaoCodigoReqIdRef.current;
      const fromList = (idx || []).find((c) => c.codigo === padded);
      setCodigo(padded);

      if (fromList) {
        aplicarCabecalhoApi(fromList);
        refreshProcessosGrade(padded, baseListaProcessos());
      } else if (mock) {
        setCodigo(mock.codigoCliente);
        setPessoa(mock.pessoa ?? '');
        setNomeRazao(corrigirNomePessoaExibicao(persisted?.nomeRazao ?? mock.nomeRazao));
        setCnpjCpf(persisted?.cnpjCpf ?? mock.cnpjCpf);
        setObservacao(persisted?.observacao !== undefined ? persisted.observacao : DEFAULT_CLIENTE_VAZIO.observacao);
        setClienteInativo(persisted?.clienteInativo ?? DEFAULT_CLIENTE_VAZIO.clienteInativo);
        setEdicaoDesabilitada(true);
        refreshProcessosGrade(mock.codigoCliente, baseListaProcessos());
      } else if (persisted) {
        setPessoa(persisted.pessoa ?? '');
        setNomeRazao(corrigirNomePessoaExibicao(persisted.nomeRazao ?? ''));
        setCnpjCpf(persisted.cnpjCpf ?? '');
        setObservacao(persisted.observacao ?? '');
        setClienteInativo(persisted.clienteInativo ?? false);
        setEdicaoDesabilitada(true);
        refreshProcessosGrade(padded, baseListaProcessos());
      } else {
        setEdicaoDesabilitada(true);
        refreshProcessosGrade(padded, []);
      }

      resolucaoClientePendingRef.current += 1;
      void obterContextoClienteCadastro(padded)
        .then((ctx) => {
          if (resolucaoCodigoReqIdRef.current !== myId) return;
          const api = ctx?.cliente ?? fromList;
          if (!api) return;
          aplicarCabecalhoApi(api);
          /** Grade já disparada no branch acima; 2º refresh resetava para mock+histórico e podia perder o merge da API. */
        })
        .finally(() => {
          resolucaoClientePendingRef.current = Math.max(0, resolucaoClientePendingRef.current - 1);
        });
      return;
    }

    if (mock) {
      setCodigo(mock.codigoCliente);
      setPessoa(persisted?.pessoa ?? mock.pessoa ?? '');
      setNomeRazao(persisted?.nomeRazao ?? mock.nomeRazao);
      setCnpjCpf(persisted?.cnpjCpf ?? mock.cnpjCpf);
      setObservacao(persisted?.observacao !== undefined ? persisted.observacao : DEFAULT_CLIENTE_VAZIO.observacao);
      setClienteInativo(persisted?.clienteInativo ?? DEFAULT_CLIENTE_VAZIO.clienteInativo);
      setEdicaoDesabilitada(true);
      refreshProcessosGrade(
        mock.codigoCliente,
        mergeProcessosLista(mock.processos, persisted?.processos)
      );
    } else {
      setCodigo(padded);
      if (persisted) {
        setPessoa(persisted.pessoa ?? '');
        setNomeRazao(corrigirNomePessoaExibicao(persisted.nomeRazao ?? ''));
        setCnpjCpf(persisted.cnpjCpf ?? '');
        setObservacao(persisted.observacao ?? '');
        setClienteInativo(persisted.clienteInativo ?? false);
        setEdicaoDesabilitada(true);
        refreshProcessosGrade(padded, Array.isArray(persisted.processos) ? persisted.processos : []);
      } else {
        setEdicaoDesabilitada(true);
        refreshProcessosGrade(padded, []);
      }
    }
  }, [refreshProcessosGrade]);
  aplicarDadosClienteRef.current = aplicarDadosCliente;

  const resolveClientePkAtual = useCallback(async () => {
    const cod = padCliente8(codigoRef.current);
    const fromList = (clientesApiIndexRef.current || []).find((c) => c.codigo === cod);
    if (fromList?.clienteId != null && Number.isFinite(Number(fromList.clienteId))) {
      return Number(fromList.clienteId);
    }
    if (!featureFlags.useApiClientes) return null;
    const resolved = await resolverClienteCadastroPorCodigo(cod);
    const pk = resolved?.clienteId ?? null;
    return pk != null && Number.isFinite(Number(pk)) ? Number(pk) : null;
  }, []);

  useEffect(() => {
    if (!featureFlags.useApiClientes || !formularioClienteAberto || !codigo || !mensalistaSecaoAberta) {
      return undefined;
    }
    let cancelled = false;
    setMensalista((m) => ({ ...MENSALISTA_ESTADO_VAZIO, carregando: true }));
    void (async () => {
      try {
        let clientePk = clientePkResolvido;
        if (clientePk == null || !Number.isFinite(Number(clientePk))) {
          clientePk = await resolveClientePkAtual();
        }
        if (cancelled) return;
        if (!clientePk) {
          setMensalista(MENSALISTA_ESTADO_VAZIO);
          return;
        }
        const data = await buscarMensalistaPorCliente(clientePk);
        if (cancelled) return;
        if (!data) {
          setMensalista({ ...MENSALISTA_ESTADO_VAZIO, carregando: false });
          mensalistaPersistidoKeyRef.current = mensalistaPersistivelKey(MENSALISTA_ESTADO_VAZIO);
          return;
        }
        const carregado = {
          cadastrado: true,
          ativo: data.ativo !== false,
          valor: data.valor ?? '',
          diaVencimento: String(data.diaVencimento ?? 10),
          dataInicio: data.dataInicio ?? '',
          dataFim: data.dataFim ?? '',
          carregando: false,
          salvando: false,
          erro: '',
        };
        setMensalista(carregado);
        mensalistaPersistidoKeyRef.current = mensalistaPersistivelKey(carregado);
      } catch (err) {
        if (!cancelled) {
          setMensalista((m) => ({
            ...m,
            carregando: false,
            erro: String(err?.message ?? 'Erro ao carregar mensalista'),
          }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [codigo, formularioClienteAberto, mensalistaSecaoAberta, clientePkResolvido, resolveClientePkAtual]);

  const salvarMensalistaAtual = useCallback(async () => {
    if (!featureFlags.useApiClientes || edicaoDesabilitada) return;
    const snapshot = mensalistaRef.current;
    if (snapshot.carregando || snapshot.salvando) return;
    if (!snapshot.ativo && !snapshot.cadastrado) return;
    if (snapshot.ativo) {
      const valorNum = parseValorMonetarioBrUtil(snapshot.valor);
      if (valorNum == null || valorNum < 0.01) return;
    }
    setMensalista((m) => ({ ...m, salvando: true, erro: '' }));
    try {
      const clientePk = await resolveClientePkAtual();
      if (!clientePk) {
        setMensalista((m) => ({
          ...m,
          salvando: false,
          erro: 'Salve o cliente na API antes de cadastrar mensalista.',
        }));
        return;
      }
      const dataInicio = snapshot.dataInicio || hojeIsoLocal();
      const saved = await salvarMensalista({
        clienteId: clientePk,
        valor: snapshot.valor,
        diaVencimento: snapshot.diaVencimento,
        dataInicio,
        dataFim: snapshot.dataFim || null,
        ativo: snapshot.ativo,
      });
      setMensalista({
        cadastrado: true,
        ativo: saved.ativo !== false,
        valor: saved.valor ?? '',
        diaVencimento: String(saved.diaVencimento ?? 10),
        dataInicio: saved.dataInicio ?? dataInicio,
        dataFim: saved.dataFim ?? '',
        carregando: false,
        salvando: false,
        erro: '',
      });
      mensalistaPersistidoKeyRef.current = mensalistaPersistivelKey({
        cadastrado: true,
        ativo: saved.ativo !== false,
        valor: saved.valor ?? '',
        diaVencimento: String(saved.diaVencimento ?? 10),
        dataInicio: saved.dataInicio ?? dataInicio,
        dataFim: saved.dataFim ?? '',
      });
    } catch (err) {
      setMensalista((m) => ({
        ...m,
        salvando: false,
        erro: String(err?.message ?? 'Erro ao salvar mensalista'),
      }));
    }
  }, [edicaoDesabilitada, resolveClientePkAtual]);

  useEffect(() => {
    skipInitialPersistMensalistaRef.current = true;
    mensalistaPersistidoKeyRef.current = '';
  }, [codigo]);

  useEffect(() => {
    if (!featureFlags.useApiClientes || !formularioClienteAberto) return undefined;
    if (skipInitialPersistMensalistaRef.current) {
      skipInitialPersistMensalistaRef.current = false;
      return undefined;
    }
    if (edicaoDesabilitada || mensalista.carregando) return undefined;
    const key = mensalistaPersistivelKey(mensalista);
    if (key === mensalistaPersistidoKeyRef.current) return undefined;
    const t = window.setTimeout(() => {
      void salvarMensalistaAtual();
    }, 250);
    return () => window.clearTimeout(t);
  }, [
    codigo,
    formularioClienteAberto,
    edicaoDesabilitada,
    mensalista.carregando,
    mensalista.ativo,
    mensalista.valor,
    mensalista.diaVencimento,
    mensalista.dataInicio,
    mensalista.dataFim,
    mensalista.cadastrado,
    salvarMensalistaAtual,
  ]);

  /** Após o índice leve carregar, revalida só se o cabeçalho ainda não veio do índice. */
  useEffect(() => {
    if (!featureFlags.useApiClientes || !clientesApiCarregados) return;
    if (!formularioClienteAberto) return;
    const padded = padCliente8(codigoRef.current);
    const noIndice = (clientesApiIndexRef.current || []).some((c) => c.codigo === padded);
    if (!noIndice) aplicarDadosClienteRef.current(padded);
  }, [clientesApiCarregados, formularioClienteAberto]);

  useEffect(() => {
    if (!featureFlags.useApiClientes) return;
    if (!clientesApiCarregados) return;
    if (!formularioClienteAberto) return;
    const id = window.setTimeout(() => {
      saveUltimoCodigoCliente(padCliente8(codigo));
    }, 150);
    return () => window.clearTimeout(id);
  }, [codigo, clientesApiCarregados, formularioClienteAberto]);

  useEffect(() => {
    if (codClienteFromState) {
      setFormularioClienteAberto(true);
      aplicarDadosClienteRef.current(padCliente8(codClienteFromState));
    }
    if (procFromState) setPesquisaProcesso(procFromState);
  }, [codClienteFromState, procFromState, intentRevisionForHydration]);

  /**
   * Restaura o último cliente escolhido ao montar a tela (rota não trouxe cliente).
   * Reaproveita o mesmo caminho de hidratação da seleção manual (API + índice + persistência).
   */
  const restauracaoUltimoClienteFeitaRef = useRef(false);
  useEffect(() => {
    if (restauracaoUltimoClienteFeitaRef.current) return;
    if (isEmbedded || !emTelaClientes) return;
    if (codClienteFromState) return;
    const salvo = loadUltimoCodigoCliente();
    if (!salvo) return;
    restauracaoUltimoClienteFeitaRef.current = true;
    setFormularioClienteAberto(true);
    aplicarDadosClienteRef.current(padCliente8(salvo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!focoCobrancaFromState || !formularioClienteAberto || !cobrancaAutomaticaHabilitada) return undefined;
    const t = window.setTimeout(() => setModalCobrancaAutomaticaAberto(true), 450);
    return () => window.clearTimeout(t);
  }, [
    focoCobrancaFromState,
    formularioClienteAberto,
    cobrancaAutomaticaHabilitada,
    codigo,
    intentRevisionForHydration,
  ]);

  useEffect(() => {
    const realinharGradeComHistoricoLocal = () => {
      const padded = padCliente8(codigoRef.current);
      setProcessos((prev) => alinharListaProcessosDescricaoComHistorico(padded, prev));
    };
    /** Atualização externa (outra aba): não chama `aplicarDadosCliente` — resetava PK/mensalista e re-disparava GET processos em loop. */
    const recarregarClienteExterno = () => {
      const padded = padCliente8(codigoRef.current);
      const fromList = (clientesApiIndexRef.current || []).find((c) => c.codigo === padded);
      if (fromList) {
        pularSincPorCargaClienteRef.current = true;
        setNomeRazao(corrigirNomePessoaExibicao(fromList.nomeRazao ?? ''));
        setCnpjCpf(fromList.cnpjCpf ?? '');
        setPessoa(fromList.pessoa ?? '');
        setObservacao(fromList.observacao ?? '');
        setClienteInativo(fromList.clienteInativo ?? false);
        if (fromList.clienteId != null && Number.isFinite(Number(fromList.clienteId))) {
          setClientePkResolvido(Number(fromList.clienteId));
        }
      }
      refreshProcessosGrade(padded, persistSnapshotRef.current?.processos ?? []);
    };
    window.addEventListener('vilareal:cadastro-clientes-externo-atualizado', recarregarClienteExterno);
    window.addEventListener('vilareal:processos-historico-atualizado', realinharGradeComHistoricoLocal);
    return () => {
      window.removeEventListener('vilareal:cadastro-clientes-externo-atualizado', recarregarClienteExterno);
      window.removeEventListener('vilareal:processos-historico-atualizado', realinharGradeComHistoricoLocal);
      processosFetchAbortRef.current?.abort();
    };
  }, []);

  /** Corrige mojibake residual na exibição (ex.: GONÃ‡ALVES → GONÇALVES). */
  useEffect(() => {
    if (!/Ã|â€|├/u.test(String(nomeRazao ?? ''))) return;
    const fixed = corrigirNomePessoaExibicao(nomeRazao);
    if (fixed && fixed !== nomeRazao) setNomeRazao(fixed);
  }, [nomeRazao]);

  useEffect(() => {
    if (primeiraSincPessoaRef.current) {
      primeiraSincPessoaRef.current = false;
      return;
    }
    if (pularSincPorCargaClienteRef.current) {
      pularSincPorCargaClienteRef.current = false;
      return;
    }
    const nomeAtual = String(persistSnapshotRef.current?.nomeRazao ?? '').trim();
    const docAtual = String(persistSnapshotRef.current?.cnpjCpf ?? '').replace(/\D/g, '');
    if (nomeAtual && docAtual.length >= 11) return;
    const id = Number(String(pessoa ?? '').replace(/\D/g, ''));
    if (!Number.isFinite(id) || id < 1) return;
    let cancelado = false;
    const t = window.setTimeout(() => {
      void (async () => {
        if (cancelado) return;
        try {
          const api = await buscarCliente(id);
          if (cancelado) return;
          if (api) {
            setNomeRazao(
              corrigirNomePessoaExibicao(String(api.nome ?? '').trim()) || `Pessoa nº ${id}`
            );
            setCnpjCpf(formatDocBR(api.cpf));
            return;
          }
        } catch {
          /* API indisponível ou 404 */
        }
        if (!cancelado) {
          setNomeRazao(`Pessoa nº ${id} (não encontrada no cadastro)`);
          setCnpjCpf('—');
        }
      })();
    }, 350);
    return () => {
      cancelado = true;
      window.clearTimeout(t);
    };
  }, [pessoa]);

  /** Com API: não depender de `processos` — cada merge da grade disparava POST + evento + `aplicarDadosCliente` em loop. */
  useEffect(() => {
    if (!featureFlags.useApiClientes) return;
    if (skipInitialPersistApiRef.current) {
      skipInitialPersistApiRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      if (!formularioClienteAberto) return;
      if (resolucaoClientePendingRef.current > 0) return;
      if (edicaoDesabilitada) return;
      void persistirClienteAtual({}, { suppressEmit: true }).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [
    codigo,
    pessoa,
    nomeRazao,
    cnpjCpf,
    observacao,
    clienteInativo,
    edicaoDesabilitada,
    formularioClienteAberto,
    persistirClienteAtual,
  ]);

  useEffect(() => {
    if (featureFlags.useApiClientes) return;
    if (skipInitialPersistLocalRef.current) {
      skipInitialPersistLocalRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      const s = persistSnapshotRef.current;
      if (!s) return;
      if (!formularioClienteAberto) return;
      setStatusSalvamento('saving');
      saveCadastroClienteDados(s.codigo, {
        pessoa: s.pessoa,
        nomeRazao: s.nomeRazao,
        cnpjCpf: s.cnpjCpf,
        observacao: s.observacao,
        clienteInativo: s.clienteInativo,
        edicaoDesabilitada: s.edicaoDesabilitada,
        processos: s.processos,
      });
      setStatusSalvamento('saved');
      window.setTimeout(() => setStatusSalvamento('idle'), 2500);
    }, 250);
    return () => clearTimeout(t);
  }, [codigo, pessoa, nomeRazao, cnpjCpf, observacao, clienteInativo, edicaoDesabilitada, processos, formularioClienteAberto]);

  useEffect(() => {
    return () => {
      const s = persistSnapshotRef.current;
      if (!s) return;
      if (featureFlags.useApiClientes) return;
      saveCadastroClienteDados(s.codigo, {
        pessoa: s.pessoa,
        nomeRazao: s.nomeRazao,
        cnpjCpf: s.cnpjCpf,
        observacao: s.observacao,
        clienteInativo: s.clienteInativo,
        edicaoDesabilitada: true,
        processos: s.processos,
      });
    };
  }, []);

  function aplicarCodigoCliente(value) {
    const padded = padCliente8(value);
    const trocar = () => {
      setFormularioClienteAberto(true);
      aplicarDadosCliente(padded);
    };
    if (featureFlags.useApiClientes && formularioClienteAberto && !edicaoDesabilitada) {
      void persistirClienteAtual({}, { suppressEmit: true }).finally(trocar);
      return;
    }
    trocar();
  }

  function iniciarNovoCliente() {
    const codNovo = proximoCliente || padCliente8('1');
    setFormularioClienteAberto(true);
    setEdicaoDesabilitada(false);
    setBuscaClienteNome('');
    aplicarCodigoCliente(codNovo);
  }

  const atualizarCampoProcesso = useCallback(
    (procId, campo, valor) => {
      if (edicaoDesabilitada) return;
      setProcessos((prev) => {
        const next = prev.map((p) => (p.id === procId ? { ...p, [campo]: valor } : p));
        const row = next.find((p) => p.id === procId);
        if (featureFlags.useApiProcessos && row) {
          void (async () => {
            try {
              const clienteApi = await buscarClientePorCodigo(padCliente8(codigo));
              const clientePk =
                clienteApi?.clienteId != null
                  ? Number(clienteApi.clienteId)
                  : clienteApi?.id != null
                    ? Number(clienteApi.id)
                    : null;
              if (!Number.isFinite(clientePk) || clientePk < 1) return;
              const procNum = Number(row.procNumero);
              const existente = await buscarProcessoPorChaveNatural(padCliente8(codigo), procNum);
              await salvarCabecalhoProcesso({
                clienteId: clientePk,
                codigoCliente: padCliente8(codigo),
                numeroInterno: procNum,
                numeroProcessoNovo: campo === 'processoNovo' ? valor : row.processoNovo,
                numeroProcessoVelho: row.processoVelho,
                naturezaAcao: campo === 'descricao' ? valor : row.descricao,
                competencia: null,
                faseSelecionada: null,
                status: null,
                tramitacao: null,
                dataProtocolo: null,
                prazoFatal: null,
                proximaConsultaData: null,
                observacao,
                valorCausaNumero: parseValorMonetarioBr(null),
                estado: null,
                cidade: null,
                consultaAutomatica: false,
                statusAtivo: true,
                responsavel: null,
                usuarioResponsavelId: null,
                processoId: existente?.id ?? null,
              });
            } catch {
              // fallback local continua funcionando
            }
          })();
        }
        if (campo === 'descricao') {
          const n = Number(row?.procNumero);
          if (Number.isFinite(n) && n >= 1) {
            salvarNaturezaAcaoDoProcesso(padCliente8(codigo), n, valor);
          }
        }
        if (campo === 'parteOposta') {
          const n = Number(row?.procNumero);
          if (Number.isFinite(n) && n >= 1) {
            salvarParteOpostaDaGradeCadastro(padCliente8(codigo), n, valor);
          }
        }
        if (campo === 'processoNovo') {
          const n = Number(row?.procNumero);
          if (Number.isFinite(n) && n >= 1) {
            salvarNumeroProcessoNovoDaGradeCadastro(padCliente8(codigo), n, valor);
          }
        }
        return next;
      });
    },
    [edicaoDesabilitada, codigo]
  );

  function handleCodigoInputChange(value) {
    const digits = apenasDigitos(value);
    // Durante digitação, permite vazio para não “travar” o backspace e
    // não reaplica padding/normalização antes do usuário terminar.
    if (!digits) {
      setCodigo('');
      return;
    }
    setCodigo(digits);
  }

  function handleCodigoInputBlur(value) {
    const digits = apenasDigitos(value);
    aplicarCodigoCliente(digits || '1');
  }

  function focusCampoPesquisaProcesso() {
    const mobile =
      typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
    const el = mobile ? pesquisaProcessoInputMobileRef.current : pesquisaProcessoInputDesktopRef.current;
    el?.focus();
    el?.select?.();
  }

  function handleCodigoClienteKeyDown(e) {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      focusCampoPesquisaProcesso();
    }
  }

  function abrirProcessos(procNumero) {
    navigate('/processos', { state: buildRouterStateChaveClienteProcesso(padCliente8(codigo), procNumero ?? '') });
  }

  /** Abre a Conta Corrente Proc. 0 em overlay, sem sair do cadastro de clientes. */
  function abrirContaCorrenteProcZero() {
    const cod = padCliente8(codigo);
    const n = Number(normalizarCodigoCliente(codigo));
    if (!Number.isFinite(n) || n < 1) {
      window.alert('Informe um código de cliente válido.');
      return;
    }
    setContaCorrenteEmbed({
      revision: Date.now(),
      routerState: buildRouterStateChaveClienteProcesso(cod, 0, { contaCorrenteSomente: true }),
    });
  }

  /** Próximo índice de processo (1…n) para este cliente na lista local. */
  function proximoNumeroProcesso(lista) {
    const nums = (lista || []).map((p) => Number(p.procNumero)).filter((n) => Number.isFinite(n) && n >= 1);
    const max = nums.length ? Math.max(...nums) : 0;
    return max + 1;
  }

  function handleIncluirNovoProcesso() {
    const codN = Number(normalizarCodigoCliente(codigo));
    if (!Number.isFinite(codN) || codN < 1) {
      window.alert('Informe um código de cliente válido antes de incluir um processo.');
      return;
    }
    const next = proximoNumeroProcesso(processos);
    const id = `${codN}-${next}`;
    const novo = {
      id,
      procNumero: next,
      processoVelho: '-',
      processoNovo: '',
      autor: '',
      reu: '',
      parteOposta: '—',
      tipoAcao: 'NOVO PROCESSO',
      descricao: 'Incluído no cadastro — preencha na tela Processos.',
    };
    const merged = [...processos, novo];
    setProcessos(merged);
    setPesquisaProcesso('');
    const paginas = Math.max(1, Math.ceil(merged.length / PROCESSOS_POR_PAGINA));
    setPaginaProcessos(paginas);
    {
      const { usuarioNome } = getContextoAuditoriaUsuario();
      const cod = padCliente8(codigo);
      registrarAuditoria({
        modulo: 'Clientes',
        tela: '/pessoas',
        tipoAcao: 'CRIACAO',
        descricao: `Usuário ${usuarioNome} incluiu o processo nº ${next} no cadastro do cliente ${cod}.`,
        registroAfetadoId: cod,
        registroAfetadoNome: nomeRazao,
      });
    }
    navigate('/processos', { state: buildRouterStateChaveClienteProcesso(padCliente8(codigo), next) });
  }

  const processosFiltrados = useMemo(
    () => filtrarProcessosGradeCliente(processos, pesquisaProcesso),
    [processos, pesquisaProcesso]
  );

  /** Só esconde a grade na carga inicial; recarregar o mesmo cliente mantém os dados visíveis. */
  const processosGradeLoadingInicial = processosGradeCarregando && processos.length === 0;
  const processosGradeVisiveis = useMemo(
    () => (processosGradeLoadingInicial ? [] : processosFiltrados),
    [processosGradeLoadingInicial, processosFiltrados]
  );

  const totalPaginasProcessos = useMemo(() => {
    const n = processosGradeVisiveis.length;
    return Math.max(1, Math.ceil(n / PROCESSOS_POR_PAGINA));
  }, [processosGradeVisiveis.length]);

  const processosPagina = useMemo(() => {
    const inicio = (paginaProcessos - 1) * PROCESSOS_POR_PAGINA;
    return processosGradeVisiveis.slice(inicio, inicio + PROCESSOS_POR_PAGINA);
  }, [processosGradeVisiveis, paginaProcessos]);

  useEffect(() => {
    setPaginaProcessos(1);
  }, [pesquisaProcesso, codigo]);

  useEffect(() => {
    setPaginaProcessos((p) => {
      const cap = Math.max(1, totalPaginasProcessos);
      return p > cap ? cap : p;
    });
  }, [totalPaginasProcessos]);

  const pessoaSelecionada = useMemo(() => {
    const id = Number(String(pessoa ?? '').replace(/\D/g, ''));
    if (!Number.isFinite(id) || id <= 0) return null;
    return { id, nome: nomeRazao, cpf: cnpjCpf };
  }, [pessoa, nomeRazao, cnpjCpf]);

  const textoQualificacao = useMemo(
    () => montarQualificacaoTexto({ nomeRazao, cnpjCpf, pessoaData: pessoaSelecionada }),
    [nomeRazao, cnpjCpf, pessoaSelecionada]
  );

  const pessoasFiltradasModal = useMemo(() => {
    const raw = String(buscaPessoaModal ?? '').trim();
    if (!raw) return { tipo: 'vazio', lista: [], limitado: false, loading: false };
    const soNum = /^[\d.\s/-]+$/.test(raw);
    const t = normalizarTextoBusca(raw);
    const tNum = normalizarNumeroBusca(raw);
    if (!soNum && t.length < 2) return { tipo: 'curto', lista: [], limitado: false, loading: false };
    if (soNum && tNum.length < 1) return { tipo: 'curto', lista: [], limitado: false, loading: false };

    return {
      tipo: 'ok',
      lista: pessoasModalApiLista,
      limitado: false,
      loading: pessoasModalApiLoading,
    };
  }, [buscaPessoaModal, pessoasModalApiLista, pessoasModalApiLoading]);

  useEffect(() => {
    if (!modalEscolherPessoa) {
      setPessoasModalApiLista([]);
      setPessoasModalApiLoading(false);
      setPessoasModalApiErro('');
      return undefined;
    }
    const raw = String(buscaPessoaModal ?? '').trim();
    const soNum = /^[\d.\s/-]+$/.test(raw);
    const t = normalizarTextoBusca(raw);
    const tNum = normalizarNumeroBusca(raw);
    if (!raw) {
      setPessoasModalApiLista([]);
      setPessoasModalApiLoading(false);
      setPessoasModalApiErro('');
      return undefined;
    }
    if (!soNum && t.length < 2) {
      setPessoasModalApiLista([]);
      setPessoasModalApiLoading(false);
      setPessoasModalApiErro('');
      return undefined;
    }
    if (soNum && tNum.length < 1) {
      setPessoasModalApiLista([]);
      setPessoasModalApiLoading(false);
      setPessoasModalApiErro('');
      return undefined;
    }

    let cancelled = false;
    setPessoasModalApiLoading(true);
    setPessoasModalApiErro('');
    const h = window.setTimeout(async () => {
      try {
        const arr = await pesquisarCadastroPessoasPorNomeOuCpf(raw, { apenasAtivos: false, limite: 400 });
        if (cancelled) return;
        const lista = (arr || []).map((p) => ({
          id: Number(p.id),
          nome: String(p.nome ?? ''),
          cpf: String(p.cpf ?? '').replace(/\D/g, '').slice(0, 14),
        }));
        setPessoasModalApiLista(lista);
      } catch (e) {
        if (!cancelled) {
          setPessoasModalApiLista([]);
          setPessoasModalApiErro(
            String(e?.message || '').trim() || 'Não foi possível consultar o cadastro de pessoas (verifique login e API).'
          );
        }
      } finally {
        if (!cancelled) setPessoasModalApiLoading(false);
      }
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(h);
    };
  }, [modalEscolherPessoa, buscaPessoaModal]);

  function aplicarPessoaSelecionada(p) {
    pularSincPorCargaClienteRef.current = true;
    const pessoaIdStr = String(p.id);
    const nomeNovo = corrigirNomePessoaExibicao(p.nome);
    const cpfNovo = formatDocBR(p.cpf);
    setPessoa(pessoaIdStr);
    setNomeRazao(nomeNovo);
    setCnpjCpf(cpfNovo);
    setModalEscolherPessoa(false);
    setBuscaPessoaModal('');
    const { usuarioNome } = getContextoAuditoriaUsuario();
    const cod = padCliente8(codigo);
    registrarAuditoria({
      modulo: 'Clientes',
      tela: '/pessoas',
      tipoAcao: 'VINCULACAO',
      descricao: `Usuário ${usuarioNome} vinculou a pessoa ${p.nome} (id ${p.id}) ao cliente em edição (código ${cod}).`,
      registroAfetadoId: String(p.id),
      registroAfetadoNome: p.nome,
    });
    if (featureFlags.useApiClientes) {
      void persistirClienteAtual({
        pessoa: pessoaIdStr,
        nomeRazao: nomeNovo,
        cnpjCpf: cpfNovo,
      }).catch(() => {});
      void (async () => {
        try {
          const fromList = (clientesApiIndexRef.current || []).find((c) => c.codigo === cod);
          let clientePk = fromList?.clienteId ?? null;
          if (!clientePk) {
            const resolved = await resolverClienteCadastroPorCodigo(cod);
            clientePk = resolved?.clienteId ?? null;
          }
          if (clientePk) {
            await importarWhatsAppDaPessoa(clientePk, Number(p.id), cod);
          }
        } catch {
          /* importação WhatsApp é auxiliar; não bloqueia vínculo */
        }
      })();
    }
  }

  const fecharModalEscolherPessoa = useCallback(() => {
    setModalEscolherPessoa(false);
    setBuscaPessoaModal('');
  }, []);

  useCloseOnEscape(modalEscolherPessoa, fecharModalEscolherPessoa);
  useCloseOnEscape(modalQualificacaoAberto, () => setModalQualificacaoAberto(false));

  const indiceClientesPorNome = useMemo(() => {
    const out = [];
    if (featureFlags.useApiClientes && Array.isArray(clientesApiIndex) && clientesApiIndex.length > 0) {
      for (const c of clientesApiIndex) {
        const codP = String(c.codigo ?? '').trim();
        if (!codP) continue;
        const codigoNum = Number(codP.replace(/\D/g, '')) || 0;
        const nome =
          String(c.nomeRazao ?? '').trim() ||
          (c.pessoa ? `Pessoa nº ${String(c.pessoa).replace(/\D/g, '')}` : `Cliente ${codP}`);
        out.push({
          codigoPadded: codP.length === 8 ? codP : padCliente8(codP),
          codigoNum,
          nome,
        });
      }
      out.sort((a, b) => a.codigoNum - b.codigoNum);
      return out;
    }
    return out;
  }, [clientesApiIndex]);

  const clientesFiltradosPorNome = useMemo(() => {
    const raw = String(buscaClienteNome ?? '').trim();
    if (raw && /^\d+$/.test(raw)) return [];
    const t = normalizarTextoBusca(buscaClienteNome);
    if (t.length < 2) return [];

    if (featureFlags.useApiClientes && clientesBuscaApi.length > 0) {
      return clientesBuscaApi.slice(0, 80).map((c) => {
        const codP = String(c.codigo ?? '').trim();
        const codigoNum = Number(codP.replace(/\D/g, '')) || 0;
        return {
          codigoPadded: codP.length === 8 ? codP : padCliente8(codP),
          codigoNum,
          nome:
            String(c.nomeRazao ?? '').trim() ||
            (c.pessoa ? `Pessoa nº ${String(c.pessoa).replace(/\D/g, '')}` : `Cliente ${codP}`),
          cnpjCpf: String(c.cnpjCpf ?? '').replace(/\D/g, ''),
        };
      });
    }

    const limite = 80;
    const hits = [];
    for (const row of indiceClientesPorNome) {
      if (hits.length >= limite) break;
      if (normalizarTextoBusca(row.nome).includes(t)) hits.push(row);
    }
    return hits;
  }, [indiceClientesPorNome, buscaClienteNome, clientesBuscaApi]);

  useEffect(() => {
    if (!featureFlags.useApiClientes) {
      setClientesBuscaApi([]);
      setClientesBuscaApiCarregando(false);
      return undefined;
    }
    const raw = String(buscaClienteNome ?? '').trim();
    if (!raw || /^\d+$/.test(raw)) {
      setClientesBuscaApi([]);
      setClientesBuscaApiCarregando(false);
      return undefined;
    }
    if (normalizarTextoBusca(buscaClienteNome).length < 2) {
      setClientesBuscaApi([]);
      setClientesBuscaApiCarregando(false);
      return undefined;
    }
    let cancelado = false;
    setClientesBuscaApiCarregando(true);
    const timer = window.setTimeout(() => {
      void buscarClientesCadastroPorTermo(raw, { limite: 80 })
        .then((rows) => {
          if (!cancelado) {
            setClientesBuscaApi(Array.isArray(rows) ? rows : []);
            setClientesBuscaApiCarregando(false);
          }
        })
        .catch(() => {
          if (!cancelado) {
            setClientesBuscaApi([]);
            setClientesBuscaApiCarregando(false);
          }
        });
    }, 300);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [buscaClienteNome]);

  /** Busca por código do cliente (8 dígitos ou parcial numérico, ex.: 491 → 00000491). */
  const clientesFiltradosPorCodigo = useMemo(
    () => filtrarClientesIndicePorCodigo(indiceClientesPorNome, buscaClienteNome, { limite: 80 }),
    [buscaClienteNome, indiceClientesPorNome]
  );

  function selecionarClienteDaBuscaNome(row) {
    setFormularioClienteAberto(true);
    aplicarCodigoCliente(row.codigoPadded);
    setBuscaClienteNome('');
  }

  function selecionarPrimeiroClienteDaBusca() {
    const raw = String(buscaClienteNome ?? '').trim();
    if (!raw) return;
    const soDigitos = /^\d+$/.test(raw);
    const lista = soDigitos ? clientesFiltradosPorCodigo : clientesFiltradosPorNome;
    if (lista.length === 0) return;
    selecionarClienteDaBuscaNome(lista[0]);
  }

  const theadBuscaClass =
    'bg-gradient-to-r from-slate-800 via-indigo-900 to-violet-900 text-white [&_th]:border-b [&_th]:border-white/10';

  return (
    <div
      className={`bg-gradient-to-br from-slate-100 via-indigo-50/35 to-emerald-50/45 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] flex flex-col ${isEmbedded ? 'min-h-0 w-full min-w-0' : 'min-h-full'}`}
    >
      <div className={`max-w-[1400px] mx-auto w-full flex flex-col flex-1 min-h-0 px-3 py-3 ${isEmbedded ? 'min-w-0' : ''}`}>
        {erroApiCliente ? (
          <div className="mb-3 rounded-xl border border-red-200/90 bg-red-50/95 px-4 py-3 text-sm text-red-800 shadow-sm backdrop-blur-sm">
            {erroApiCliente}
          </div>
        ) : null}
        {erroApiProcessosGrade ? (
          <div className="mb-3 rounded-xl border border-amber-200/90 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-sm backdrop-blur-sm">
            {erroApiProcessosGrade}
          </div>
        ) : null}
        <div className="flex-1 min-w-0 min-h-0 overflow-auto pb-6">
          {/* Banner único fixo: título da tela + busca + novo cliente */}
          <div className="sticky top-0 z-30 -mx-3 mb-3 px-3 sm:-mx-0 sm:px-0">
            <div className="relative">
              <section
                className="overflow-hidden rounded-xl border border-emerald-400/50 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 shadow-lg ring-1 ring-emerald-500/30"
                aria-label="Cadastro de Clientes — busca"
              >
                <div className="flex items-start justify-between gap-2 border-b border-white/20 px-3 py-2 sm:px-4">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
                      <Users className="h-4 w-4 text-white" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h1 className="text-base font-bold leading-tight text-white sm:text-lg">
                        Cadastro de Clientes
                      </h1>
                      <p className="truncate text-[11px] text-emerald-50/95">
                        Pessoas, vínculos e processos
                        {formularioClienteAberto && statusSalvamento !== 'idle' ? (
                          <span className="ml-1.5 inline-flex items-center gap-1 font-medium text-white">
                            ·{' '}
                            {statusSalvamento === 'saving' ? (
                              <>
                                <Loader2 className="inline h-3 w-3 animate-spin" aria-hidden />
                                Salvando…
                              </>
                            ) : (
                              <>
                                <Check className="inline h-3 w-3" aria-hidden />
                                Salvo
                              </>
                            )}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (isEmbedded && typeof onFecharEmbed === 'function') onFecharEmbed();
                      else window.history.back();
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-2 sm:px-4 sm:py-3">
                  <label htmlFor="busca-cliente-nome" className="sr-only">
                    Pesquisar cliente por nome ou código
                  </label>
                  <div className="relative min-w-0 flex-1">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden
                    />
                    <input
                      id="busca-cliente-nome"
                      type="text"
                      value={buscaClienteNome}
                      onChange={(e) => setBuscaClienteNome(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          selecionarPrimeiroClienteDaBusca();
                        }
                      }}
                      className="w-full min-w-0 rounded-lg border-0 bg-white py-2 pl-9 pr-3 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:text-sm"
                      placeholder="Buscar por nome ou código (ex.: 491 ou 00000491)…"
                      autoComplete="off"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={iniciarNovoCliente}
                    className={`${btnPrimarioForte} min-h-10 w-full shrink-0 shadow-md ring-1 ring-white/30 sm:w-auto`}
                  >
                    <PlusCircle className="h-4 w-4" aria-hidden />
                    Novo Cliente
                  </button>
                </div>
              </section>

              {(() => {
                const rawBusca = String(buscaClienteNome ?? '').trim();
                const soDigitos = rawBusca.length > 0 && /^\d+$/.test(rawBusca);
                const codigo8 = /^\d{8}$/.test(rawBusca);
                const temPainelInferior =
                  (rawBusca && !soDigitos && normalizarTextoBusca(buscaClienteNome).length < 2) ||
                  soDigitos ||
                  (soDigitos &&
                    clientesFiltradosPorCodigo.length === 0 &&
                    featureFlags.useApiClientes &&
                    clientesApiCarregados) ||
                  (!soDigitos &&
                    normalizarTextoBusca(buscaClienteNome).length >= 2 &&
                    clientesFiltradosPorNome.length === 0) ||
                  clientesFiltradosPorCodigo.length > 0 ||
                  clientesFiltradosPorNome.length > 0;
                if (!temPainelInferior) return null;
                return (
                  <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-[min(18rem,50vh)] overflow-y-auto rounded-xl border border-slate-200/90 bg-white px-3 py-2 shadow-xl ring-1 ring-slate-200/80 sm:px-4">
                    {rawBusca && !soDigitos && normalizarTextoBusca(buscaClienteNome).length < 2 && (
                      <p className="mb-2 text-xs text-slate-500">
                        Digite pelo menos 2 letras para buscar pelo nome (razão social ou nome da pessoa vinculada).
                      </p>
                    )}
                    {soDigitos && (
                      <p className="mb-2 text-xs text-slate-500">
                        Busca pelo <strong>código do cliente</strong>
                        {codigo8 ? ' (8 dígitos)' : ` (ex.: ${rawBusca} → ${padCliente8(rawBusca)})`}.
                      </p>
                    )}
                    {soDigitos &&
                      clientesFiltradosPorCodigo.length === 0 &&
                      featureFlags.useApiClientes &&
                      clientesApiCarregados && (
                        <p className="mb-2 text-sm text-slate-600">Nenhum cliente encontrado com esse código.</p>
                      )}
                    {clientesBuscaApiCarregando &&
                      !soDigitos &&
                      normalizarTextoBusca(buscaClienteNome).length >= 2 && (
                        <p className="mb-2 text-sm text-slate-600 flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          Buscando clientes…
                        </p>
                      )}
                    {!soDigitos &&
                      normalizarTextoBusca(buscaClienteNome).length >= 2 &&
                      clientesFiltradosPorNome.length === 0 &&
                      !clientesBuscaApiCarregando && (
                        <p className="mb-2 text-sm text-slate-600">Nenhum cliente encontrado com esse nome.</p>
                      )}
            {clientesFiltradosPorCodigo.length > 0 && (
              <div className="mb-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200/90 bg-white shadow-inner ring-1 ring-slate-100">
                <div className="space-y-2 p-2 md:hidden">
                  {clientesFiltradosPorCodigo.map((row) => (
                    <button
                      key={row.codigoPadded}
                      type="button"
                      onClick={() => selecionarClienteDaBuscaNome(row)}
                      className="flex w-full min-h-[3.25rem] flex-col gap-0.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left active:bg-emerald-50/80"
                    >
                      <span className="font-mono text-sm font-semibold tabular-nums text-slate-900">{row.codigoPadded}</span>
                      <span className="text-sm text-slate-700">{row.nome}</span>
                    </button>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[480px] border-collapse text-sm">
                    <thead>
                      <tr className={`${theadBuscaClass} sticky top-0`}>
                        <th className="w-28 px-3 py-2.5 text-left font-semibold">Código</th>
                        <th className="px-3 py-2.5 text-left font-semibold">Nome / Razão social</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientesFiltradosPorCodigo.map((row, idx) => (
                        <tr
                          key={row.codigoPadded}
                          role="button"
                          tabIndex={0}
                          onClick={() => selecionarClienteDaBuscaNome(row)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              selecionarClienteDaBuscaNome(row);
                            }
                          }}
                          className={`cursor-pointer transition-colors hover:bg-emerald-50/80 ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                          }`}
                        >
                          <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2 font-mono tabular-nums text-slate-800">
                            {row.codigoPadded}
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 text-slate-800">{row.nome}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {clientesFiltradosPorCodigo.length >= 80 && (
                  <p className="border-t border-slate-100 px-2 py-1.5 text-xs text-slate-500">
                    Mostrando até 80 resultados — refine o código se necessário.
                  </p>
                )}
              </div>
            )}
            {clientesFiltradosPorNome.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200/90 bg-white shadow-inner ring-1 ring-slate-100">
                <div className="space-y-2 p-2 md:hidden">
                  {clientesFiltradosPorNome.map((row) => (
                    <button
                      key={row.codigoPadded}
                      type="button"
                      onClick={() => selecionarClienteDaBuscaNome(row)}
                      className="flex w-full min-h-[3.25rem] flex-col gap-0.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left active:bg-emerald-50/80"
                    >
                      <span className="font-mono text-sm font-semibold tabular-nums text-slate-900">{row.codigoPadded}</span>
                      <span className="text-sm text-slate-700">{row.nome}</span>
                    </button>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[480px] border-collapse text-sm">
                    <thead>
                      <tr className={`${theadBuscaClass} sticky top-0`}>
                        <th className="w-28 px-3 py-2.5 text-left font-semibold">Código</th>
                        <th className="px-3 py-2.5 text-left font-semibold">Nome / Razão social</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientesFiltradosPorNome.map((row, idx) => (
                        <tr
                          key={row.codigoPadded}
                          role="button"
                          tabIndex={0}
                          onClick={() => selecionarClienteDaBuscaNome(row)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              selecionarClienteDaBuscaNome(row);
                            }
                          }}
                          className={`cursor-pointer transition-colors hover:bg-emerald-50/80 ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                          }`}
                        >
                          <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2 font-mono tabular-nums text-slate-800">
                            {row.codigoPadded}
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 text-slate-800">{row.nome}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {clientesFiltradosPorNome.length >= 80 && (
                  <p className="border-t border-slate-100 px-2 py-1.5 text-xs text-slate-500">
                    Mostrando até 80 resultados — refine a busca se necessário.
                  </p>
                )}
              </div>
            )}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="space-y-4">
          {!formularioClienteAberto ? (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white/80 px-6 py-14 text-center shadow-sm">
              <Users className="mx-auto h-12 w-12 text-slate-300" aria-hidden />
              <p className="mt-3 text-base font-medium text-slate-700">Nenhum cliente selecionado</p>
              <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                Use a busca acima para localizar um cliente ou clique em <strong>Novo Cliente</strong> para cadastrar.
              </p>
            </section>
          ) : (
          <>
          <section className="rounded-2xl border border-slate-200/90 bg-white shadow-md overflow-hidden ring-1 ring-indigo-500/5">
            <div className="border-b border-indigo-400/30 bg-gradient-to-br from-indigo-950 via-violet-950 to-slate-900 px-3 py-2 text-white shadow-md ring-1 ring-indigo-500/25 sm:px-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-indigo-200/90">
                    Cliente
                  </span>
                  <span className="hidden h-3.5 w-px shrink-0 bg-white/25 sm:block" aria-hidden />
                  <p
                    className="min-w-0 truncate text-sm font-semibold tracking-tight sm:text-base"
                    title={nomeRazao || undefined}
                  >
                    {String(nomeRazao || '').trim() || '— Sem nome —'}
                  </p>
                  <span className="shrink-0 rounded-full bg-white/12 px-2 py-0.5 text-[11px] font-mono font-semibold text-indigo-50 ring-1 ring-white/20">
                    {padCliente8(codigo)}
                  </span>
                  {clienteInativo ? (
                    <span className="shrink-0 rounded-full bg-amber-400/25 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-100 ring-1 ring-amber-300/40">
                      Inativo
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-100 ring-1 ring-emerald-400/35">
                      Ativo
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const v = !clienteInativo;
                      setClienteInativo(v);
                      const { usuarioNome } = getContextoAuditoriaUsuario();
                      const cod = padCliente8(codigo);
                      registrarAuditoria({
                        modulo: 'Clientes',
                        tela: '/pessoas',
                        tipoAcao: 'EDICAO',
                        descricao: v
                          ? `Usuário ${usuarioNome} marcou o cliente ${nomeRazao} (código ${cod}) como inativo.`
                          : `Usuário ${usuarioNome} reativou o cliente ${nomeRazao} (código ${cod}).`,
                        registroAfetadoId: cod,
                        registroAfetadoNome: nomeRazao,
                      });
                    }}
                    aria-pressed={clienteInativo}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${BTN_TRANSICAO} hover:-translate-y-px hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent ${
                      clienteInativo
                        ? 'border-amber-300/80 bg-amber-500/40 text-amber-50 shadow-sm ring-1 ring-amber-300/50 hover:bg-amber-500/50 focus-visible:ring-amber-300'
                        : 'border-white/20 bg-white/10 text-indigo-100 hover:bg-white/15 focus-visible:ring-white/80'
                    }`}
                    title={
                      clienteInativo
                        ? 'Cliente marcado como inativo — clique para reativar'
                        : 'Marcar cliente como inativo'
                    }
                  >
                    <UserX className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="hidden sm:inline">
                      {clienteInativo ? 'Cliente inativo' : 'Marcar inativo'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEdicaoDesabilitada((v) => !v)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${BTN_TRANSICAO} hover:-translate-y-px hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent ${
                      edicaoDesabilitada
                        ? 'border-amber-300/60 bg-amber-500/20 text-amber-50 hover:bg-amber-500/30 focus-visible:ring-amber-300'
                        : 'border-emerald-300/60 bg-emerald-500/20 text-emerald-50 hover:bg-emerald-500/30 focus-visible:ring-emerald-300'
                    }`}
                    title={edicaoDesabilitada ? 'Permitir alterações no cadastro' : 'Bloquear alterações no cadastro'}
                  >
                    {edicaoDesabilitada ? <Lock className="h-3.5 w-3.5" aria-hidden /> : <Unlock className="h-3.5 w-3.5" aria-hidden />}
                    <span className="hidden sm:inline">
                      {edicaoDesabilitada ? 'Habilitar edição' : 'Edição ativa'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-4 bg-gradient-to-b from-violet-50/30 via-white to-sky-50/20">
          <div className="flex flex-wrap items-end gap-4 border-b border-slate-200/80 pb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-0.5">Próximo cliente:</label>
              <p
                role="button"
                tabIndex={0}
                title="Primeiro cliente sem Pessoa vinculada (API + cadastro local). Duplo clique ou Enter para abrir. Se abrir e não preencher Pessoa, continua sendo este código."
                className="text-sm text-slate-800 px-1 py-1.5 bg-transparent cursor-pointer select-none rounded hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 font-mono tabular-nums"
                onDoubleClick={() => {
                  aplicarCodigoCliente(
                    obterProximoCodigoClienteSemPessoaAtribuida(
                      featureFlags.useApiClientes ? clientesApiIndex : [],
                      padCliente8(codigo),
                      pessoa
                    )
                  );
                  setPaginaProcessos(1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    aplicarCodigoCliente(
                      obterProximoCodigoClienteSemPessoaAtribuida(
                        featureFlags.useApiClientes ? clientesApiIndex : [],
                        padCliente8(codigo),
                        pessoa
                      )
                    );
                    setPaginaProcessos(1);
                  }
                }}
              >
                {proximoCliente}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-0.5">Código do Cliente</label>
              <div className="flex border-2 border-indigo-200/80 rounded-xl overflow-hidden bg-white w-56 shadow-sm ring-1 ring-indigo-500/10">
                <button
                  type="button"
                  className={`${btnNavCodigoSeta} border-r py-2`}
                  onClick={() => {
                    const n = Number(normalizarCodigoCliente(codigo));
                    const next = Math.max(1, n - 1);
                    aplicarCodigoCliente(String(next));
                  }}
                  title="Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  value={codigo}
                  onChange={(e) => handleCodigoInputChange(e.target.value)}
                  onBlur={(e) => handleCodigoInputBlur(e.target.value)}
                  onKeyDown={handleCodigoClienteKeyDown}
                  className="flex-1 px-2 py-2 text-sm font-mono text-center border-0 bg-white text-indigo-950"
                />
                <button
                  type="button"
                  className={`${btnNavCodigoSeta} border-l py-2`}
                  onClick={() => {
                    const n = Number(normalizarCodigoCliente(codigo));
                    const next = n + 1;
                    aplicarCodigoCliente(String(next));
                  }}
                  title="Próximo"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="shrink-0" role="group" aria-label="Pessoa vinculada">
              <div className="mb-0.5 h-5" aria-hidden />
              <div className="flex items-center gap-1.5">
                {String(pessoa ?? '').trim() ? (
                  <span className="whitespace-nowrap text-sm font-medium text-slate-800" title={`Ficha nº ${pessoa}`}>
                    Pessoa nº {String(pessoa).trim()}
                  </span>
                ) : (
                  <span className="whitespace-nowrap text-sm text-amber-700">Sem pessoa</span>
                )}
                <button
                  id="pessoa-vinculada-acao"
                  type="button"
                  disabled={edicaoDesabilitada}
                  className={`${btnUtilDiscreto} !min-h-9 !px-2`}
                  title={
                    edicaoDesabilitada
                      ? 'Habilite a edição para escolher a pessoa'
                      : String(pessoa ?? '').trim()
                        ? 'Alterar pessoa vinculada'
                        : 'Vincular pessoa no cadastro'
                  }
                  onClick={() => {
                    if (edicaoDesabilitada) {
                      window.alert('Clique em "Habilitar edição" para vincular uma pessoa ao cliente.');
                      return;
                    }
                    setBuscaPessoaModal('');
                    setModalEscolherPessoa(true);
                  }}
                >
                  <Search className="h-4 w-4 shrink-0" aria-hidden />
                  {String(pessoa ?? '').trim() ? 'Alterar' : 'Vincular'}
                </button>
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-slate-700 mb-0.5">Nome / Razão Social</label>
              <input type="text" value={nomeRazao} onChange={(e) => setNomeRazao(e.target.value)} disabled={edicaoDesabilitada} className={`${inputClass} ${edicaoDesabilitada ? 'bg-slate-50' : ''}`} />
            </div>
            <div className="w-44">
              <label className="block text-sm font-medium text-slate-700 mb-0.5">CNPJ / CPF</label>
              <input
                type="text"
                value={cnpjCpf}
                onChange={(e) => setCnpjCpf(e.target.value)}
                onBlur={() => {
                  if (edicaoDesabilitada) return;
                  setCnpjCpf((v) => {
                    const r = validarFormatarCpfCnpjAoSair(v);
                    if (r.aviso) {
                      queueMicrotask(() => setToastDocCliente({ mensagem: r.aviso }));
                    }
                    return r.valor;
                  });
                }}
                disabled={edicaoDesabilitada}
                placeholder="CPF ou CNPJ"
                className={`${inputClass} ${edicaoDesabilitada ? 'bg-slate-50' : ''}`}
              />
            </div>
            <div
              className="flex w-full min-w-0 flex-wrap items-center gap-2"
              role="group"
              aria-label="Seções e atalhos do cliente"
            >
              <button
                type="button"
                onClick={() => {
                  const raw = String(pessoa ?? '').trim();
                  let idPessoa = null;
                  if (raw) {
                    const n = Number.parseInt(raw.replace(/\D/g, ''), 10);
                    if (Number.isFinite(n) && n >= 1) idPessoa = n;
                  }
                  if (idPessoa == null) {
                    const fromCod = getIdPessoaPorCodCliente(
                      padCliente8(codigo),
                      featureFlags.useApiClientes ? clientesApiIndex : []
                    );
                    if (fromCod != null) idPessoa = fromCod;
                  }
                  if (idPessoa == null) {
                    window.alert(
                      'Não foi possível identificar a pessoa deste cliente. Informe o número no campo Pessoa ou o vínculo cliente → pessoa no cadastro.'
                    );
                    return;
                  }
                  {
                    const { usuarioNome } = getContextoAuditoriaUsuario();
                    registrarAuditoria({
                      modulo: 'Clientes',
                      tela: '/pessoas',
                      tipoAcao: 'ACESSO_TELA',
                      descricao: `Usuário ${usuarioNome} navegou do cliente para o cadastro da pessoa id ${idPessoa}.`,
                      registroAfetadoId: String(idPessoa),
                    });
                  }
                  navigate(`/clientes/editar/${idPessoa}`);
                }}
                className={classesBotaoSecao('indigo')}
              >
                <Users className={classesIconeSecao('indigo', false)} aria-hidden />
                Cadastro de Pessoas
              </button>
              <button
                type="button"
                onClick={abrirContaCorrenteProcZero}
                className={classesBotaoSecao('emerald')}
                title="Lançamentos do Financeiro com este Cod. Cliente e Proc. 0 (mensalistas / não vinculados a um processo específico)."
              >
                <Wallet className={classesIconeSecao('emerald', false)} aria-hidden />
                Conta Corrente (Proc. 0)
              </button>
              <button
                type="button"
                onClick={() => {
                  const { usuarioNome } = getContextoAuditoriaUsuario();
                  const cod = padCliente8(codigo);
                  registrarAuditoria({
                    modulo: 'Clientes',
                    tela: '/pessoas',
                    tipoAcao: 'DOCUMENTO',
                    descricao: `Usuário ${usuarioNome} abriu a qualificação do cliente ${nomeRazao} (código ${cod}).`,
                    registroAfetadoId: cod,
                    registroAfetadoNome: nomeRazao,
                  });
                  setModalQualificacaoAberto(true);
                }}
                className={classesBotaoSecao('amber', { ativo: modalQualificacaoAberto })}
                aria-pressed={modalQualificacaoAberto}
              >
                <ClipboardList className={classesIconeSecao('amber', modalQualificacaoAberto)} aria-hidden />
                Qualificação
              </button>
              <button
                type="button"
                className={classesBotaoSecao('cyan')}
                title="Documentos do cliente"
              >
                <FolderOpen className={classesIconeSecao('cyan', false)} aria-hidden />
                Documentos
              </button>
              <button
                type="button"
                onClick={() => setModalConfigCalculoAberto(true)}
                className={classesBotaoSecao('violet', { ativo: modalConfigCalculoAberto })}
                aria-pressed={modalConfigCalculoAberto}
                title="Padrões de juros, multa, honorários, índice e periodicidade para os cálculos deste cliente"
              >
                <SlidersHorizontal className={classesIconeSecao('violet', modalConfigCalculoAberto)} aria-hidden />
                Configurações de cálculo
              </button>
              <button
                type="button"
                onClick={() => setModalWhatsAppAberto(true)}
                className={classesBotaoSecao('whatsapp', { ativo: modalWhatsAppAberto })}
                aria-pressed={modalWhatsAppAberto}
                title="Números WhatsApp que recebem comunicações automáticas do escritório"
              >
                <MessageCircle className={classesIconeSecao('whatsapp', modalWhatsAppAberto)} aria-hidden />
                WhatsApp
              </button>
              {cobrancaAutomaticaHabilitada ? (
                <button
                  type="button"
                  onClick={() => setModalCobrancaAutomaticaAberto(true)}
                  className={classesBotaoSecao('sky', { ativo: modalCobrancaAutomaticaAberto })}
                  aria-pressed={modalCobrancaAutomaticaAberto}
                  title="Importar relatório .xls de inadimplência e processar cobrança automática"
                >
                  <FileSpreadsheet
                    className={classesIconeSecao('sky', modalCobrancaAutomaticaAberto)}
                    aria-hidden
                  />
                  Cobrança automática
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setModalImportarContratoAberto(true)}
                className={classesBotaoSecao('indigo', { ativo: modalImportarContratoAberto })}
                aria-pressed={modalImportarContratoAberto}
                title="Importar contratos de honorários já celebrados (censo da carteira)"
              >
                <FileSignature
                  className={classesIconeSecao('indigo', modalImportarContratoAberto)}
                  aria-hidden
                />
                Importar contratos
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 shadow-sm ring-1 ring-slate-100/80">
            <label className="block text-sm font-semibold text-slate-800 mb-1">Observação</label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
              disabled={edicaoDesabilitada}
              placeholder="Ex.: Cliente indicado por Dr. João. Prefere contato por WhatsApp."
              className={`${inputClass} resize-y ${edicaoDesabilitada ? 'bg-slate-50' : ''}`}
            />
          </div>

          {featureFlags.useApiClientes ? (
            <div className="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/30 overflow-hidden shadow-sm ring-1 ring-emerald-500/10">
              <button
                type="button"
                className="w-full border-b border-emerald-200/70 bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 px-4 py-2.5 text-left"
                onClick={() => setMensalistaSecaoAberta((aberta) => !aberta)}
                aria-expanded={mensalistaSecaoAberta}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wide text-white flex items-center gap-2">
                      <Wallet className="h-4 w-4" aria-hidden />
                      Mensalista
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${mensalistaSecaoAberta ? 'rotate-180' : ''}`}
                        aria-hidden
                      />
                    </p>
                    <p className="text-xs text-emerald-100/95 mt-0.5">
                      {mensalistaSecaoAberta
                        ? 'Gera pagamento RECEBER (MENSALIDADE) mensal no quadro /recebiveis'
                        : 'Clique para expandir e carregar dados de mensalista'}
                    </p>
                  </div>
                  {mensalista.salvando ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-50">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      Salvando…
                    </span>
                  ) : null}
                </div>
              </button>
              {mensalistaSecaoAberta ? (
              <div className="p-3 sm:p-4 space-y-3">
                {mensalista.carregando ? (
                  <p className="text-sm text-slate-600 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Carregando mensalista…
                  </p>
                ) : (
                  <>
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                      <input
                        type="checkbox"
                        checked={mensalista.ativo}
                        disabled={edicaoDesabilitada}
                        onChange={(e) => {
                          const ativo = e.target.checked;
                          setMensalista((m) => ({
                            ...m,
                            ativo,
                            dataInicio: m.dataInicio || hojeIsoLocal(),
                          }));
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      Cliente mensalista ativo
                    </label>
                    {mensalista.ativo ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">
                            Valor mensal (R$)
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={mensalista.valor}
                            disabled={edicaoDesabilitada}
                            onChange={(e) =>
                              setMensalista((m) => ({ ...m, valor: editarValorMensalCampo(e.target.value) }))
                            }
                            placeholder="0,00"
                            className={`${inputClass} ${edicaoDesabilitada ? 'bg-slate-50' : ''}`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">
                            Dia vencimento
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={31}
                            value={mensalista.diaVencimento}
                            disabled={edicaoDesabilitada}
                            onChange={(e) => setMensalista((m) => ({ ...m, diaVencimento: e.target.value }))}
                            className={`${inputClass} ${edicaoDesabilitada ? 'bg-slate-50' : ''}`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">
                            Início
                          </label>
                          <input
                            type="date"
                            value={mensalista.dataInicio || hojeIsoLocal()}
                            disabled={edicaoDesabilitada}
                            onChange={(e) => setMensalista((m) => ({ ...m, dataInicio: e.target.value }))}
                            className={`${inputClass} ${edicaoDesabilitada ? 'bg-slate-50' : ''}`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">
                            Fim (opcional)
                          </label>
                          <input
                            type="date"
                            value={mensalista.dataFim}
                            disabled={edicaoDesabilitada}
                            onChange={(e) => setMensalista((m) => ({ ...m, dataFim: e.target.value }))}
                            className={`${inputClass} ${edicaoDesabilitada ? 'bg-slate-50' : ''}`}
                          />
                        </div>
                      </div>
                    ) : mensalista.cadastrado ? (
                      <p className="text-sm text-slate-600">
                        Mensalista cadastrado, porém inativo — não gera recebíveis.
                      </p>
                    ) : (
                      <p className="text-sm text-slate-600">
                        Marque como ativo para configurar valor e vencimento mensal.
                      </p>
                    )}
                    {mensalista.erro ? (
                      <p className="text-sm text-red-600" role="alert">
                        {mensalista.erro}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50/50 via-white to-indigo-50/30 overflow-hidden shadow-sm ring-1 ring-sky-500/10">
            <div className="border-b border-sky-200/70 bg-gradient-to-r from-sky-600 via-cyan-600 to-indigo-600 px-4 py-2.5">
              <p className="text-sm font-bold uppercase tracking-wide text-white">Processos do cliente</p>
              <p className="text-xs text-sky-100/95 mt-0.5">
                {processosGradeLoadingInicial
                  ? 'Carregando processos…'
                  : processos.length === 0
                    ? 'Nenhum processo cadastrado para este cliente — use Incluir processo abaixo'
                    : `${processos.length} processo(s) — duplo clique na linha para abrir`}
              </p>
            </div>
            <div className="p-3 sm:p-4">
            <div className="mb-3 md:hidden">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Pesquisar processos</label>
              <input
                ref={pesquisaProcessoInputMobileRef}
                type="text"
                value={pesquisaProcesso}
                onChange={(e) => setPesquisaProcesso(e.target.value)}
                className={`${inputClass} w-full text-base`}
                placeholder="Proc., CNJ, partes, descrição ou unidade…"
              />
              <button
                type="button"
                className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-[var(--vl-bg-card)] px-3 py-2 text-sm font-semibold text-[var(--vl-text)] shadow-sm"
                aria-expanded={filtrosGradeProcessosAberto}
                onClick={() => setFiltrosGradeProcessosAberto((v) => !v)}
              >
                <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
                {filtrosGradeProcessosAberto ? 'Ocultar filtros e ações' : 'Filtros e ações'}
              </button>
              {filtrosGradeProcessosAberto ? (
                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-sky-200 bg-white shadow-sm"
                      title="Buscar"
                    >
                      <Search className="h-5 w-5 text-sky-700" />
                    </button>
                    <button
                      type="button"
                      className="min-h-11 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm"
                    >
                      Pesquisa
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleIncluirNovoProcesso}
                    className={`${btnPrimarioForte} min-h-11 w-full`}
                    title="Inclui na lista e abre a tela Processos para este número de processo"
                  >
                    <PlusCircle className="h-5 w-5 shrink-0" aria-hidden />
                    Incluir processo
                  </button>
                </div>
              ) : null}
            </div>
            <div className="mb-3 hidden flex-wrap items-center gap-2 md:flex">
              <label className="text-sm font-medium text-slate-700">Pesquisar</label>
              <input
                ref={pesquisaProcessoInputDesktopRef}
                type="text"
                value={pesquisaProcesso}
                onChange={(e) => setPesquisaProcesso(e.target.value)}
                className={`${inputClass} w-64`}
                placeholder="Proc., CNJ, partes, descrição ou unidade…"
              />
              <button type="button" className={`${btnUtilDiscreto} !min-h-9 !px-2`} title="Buscar">
                <Search className="h-4 w-4 text-slate-500" aria-hidden />
              </button>
              <button type="button" className={`${btnUtilDiscreto} !min-h-9`}>
                Pesquisa
              </button>
              <button
                type="button"
                onClick={handleIncluirNovoProcesso}
                className={btnPrimarioForte}
                title="Inclui na lista e abre a tela Processos para este número de processo"
              >
                <PlusCircle className="w-4 h-4 shrink-0" aria-hidden />
                Incluir processo
              </button>
            </div>
            <div className="mb-3 space-y-2 md:hidden">
              {processosGradeLoadingInicial ? (
                <p className="rounded-xl border border-slate-200 bg-white px-3 py-6 text-center text-sm text-slate-500 shadow-sm">
                  A carregar processos…
                </p>
              ) : (
                processosPagina.map((proc, idx) => {
                const n = proc.procNumero ?? idx + 1 + (paginaProcessos - 1) * PROCESSOS_POR_PAGINA;
                const procLabel = String(n).padStart(2, '0');
                const cnj = String(proc.processoNovo ?? '').trim();
                const parteCliente = textoParteClienteGrade(proc);
                const parteOposta = textoParteOpostaGrade(proc);
                const descricao = String(proc.descricao ?? '').trim() || '—';
                return (
                  <button
                    key={proc.id}
                    type="button"
                    className={`w-full rounded-xl border p-3 text-left shadow-sm ${
                      proc.statusAtivo === false
                        ? 'border-slate-300 bg-slate-300/75 text-slate-600 ring-1 ring-slate-300/80 active:bg-slate-400/70'
                        : 'border-slate-200 bg-white ring-1 ring-slate-100/80 active:bg-sky-50/80'
                    }`}
                    onClick={() => abrirProcessos(n)}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <span className="font-mono text-sm font-bold text-indigo-900">Proc. {procLabel}</span>
                      <FolderOpen className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
                    </div>
                    <p className="mt-2 line-clamp-2 break-all text-xs text-slate-600" title={cnj || undefined}>
                      {cnj || '— sem CNJ'}
                    </p>
                    <dl className="mt-2 space-y-1.5 text-sm">
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Parte cliente</dt>
                        <dd className="line-clamp-2 text-slate-800" title={parteCliente !== '—' ? parteCliente : undefined}>
                          {parteCliente}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Réu</dt>
                        <dd className="line-clamp-2 text-slate-800" title={parteOposta !== '—' ? parteOposta : undefined}>
                          {parteOposta}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Ação</dt>
                        <dd className="line-clamp-2 text-slate-600">{descricao}</dd>
                      </div>
                    </dl>
                  </button>
                );
              })
              )}
            </div>
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-inner ring-1 ring-slate-100 md:block">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-indigo-800 via-slate-800 to-violet-900 text-white [&_th]:border-b [&_th]:border-white/10">
                    <th className="px-3 py-2.5 text-left font-semibold w-24 whitespace-nowrap">Proc.</th>
                    <th className="px-3 py-2.5 text-left font-semibold min-w-[180px]">Parte Cliente</th>
                    <th className="px-3 py-2.5 text-left font-semibold min-w-[180px]">N.º Processo Novo</th>
                    <th className="px-3 py-2.5 text-left font-semibold min-w-[180px]">Parte Oposta</th>
                    <th className="px-3 py-2.5 text-left font-semibold min-w-[180px]">Descrição da Ação</th>
                    <th className="px-2 py-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {processosGradeLoadingInicial ? (
                    <tr>
                      <td colSpan={6} className="border border-slate-200 px-3 py-6 text-center text-slate-500">
                        A carregar processos…
                      </td>
                    </tr>
                  ) : null}
                  {!processosGradeLoadingInicial
                    ? processosPagina.map((proc, idx) => {
                    const parteClienteTxt = textoParteClienteGrade(proc);
                    const procLabelNum =
                      proc.procNumero ?? idx + 1 + (paginaProcessos - 1) * PROCESSOS_POR_PAGINA;
                    return (
                    <tr
                      key={proc.id}
                      className={classeGradeProcessoCliente(proc, idx)}
                      title={
                        proc.statusAtivo === false
                          ? 'Processo inativo — duplo clique para abrir'
                          : 'Duplo clique: abrir este processo (fora dos campos editáveis)'
                      }
                      onDoubleClick={(e) => {
                        if (e.target.closest('input, textarea, button')) return;
                        abrirProcessos(procLabelNum);
                      }}
                    >
                      <td className="border border-slate-200 px-2 py-1 text-slate-700 whitespace-nowrap tabular-nums">
                        Proc.{' '}
                        {String(procLabelNum).padStart(2, '0')}:
                      </td>
                      <td className="border border-slate-200 px-3 py-1.5 text-slate-800">
                        <span
                          className="block line-clamp-3 break-words"
                          title={parteClienteTxt !== '—' ? parteClienteTxt : undefined}
                        >
                          {parteClienteTxt}
                        </span>
                      </td>
                      <td className="border border-slate-200 px-1 py-0.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={proc.processoNovo ?? ''}
                          onChange={(e) => atualizarCampoProcesso(proc.id, 'processoNovo', e.target.value)}
                          disabled={edicaoDesabilitada}
                          title="Mesmo dado que «Nº Processo Novo» na tela Processos (localStorage)."
                          className={`w-full min-w-[8rem] px-1 py-0.5 text-sm border border-slate-200 rounded bg-white ${edicaoDesabilitada ? 'bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                        />
                      </td>
                      <td className="border border-slate-200 px-1 py-0.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={proc.parteOposta ?? proc.reu ?? ''}
                          onChange={(e) => atualizarCampoProcesso(proc.id, 'parteOposta', e.target.value)}
                          disabled={edicaoDesabilitada}
                          title="Mesmo dado que «Parte Oposta» na tela Processos (localStorage)."
                          className={`w-full min-w-[8rem] px-1 py-0.5 text-sm border border-slate-200 rounded bg-white ${edicaoDesabilitada ? 'bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                        />
                      </td>
                      <td className="border border-slate-200 px-1 py-0.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={proc.descricao ?? ''}
                          onChange={(e) => atualizarCampoProcesso(proc.id, 'descricao', e.target.value)}
                          disabled={edicaoDesabilitada}
                          title="Mesmo dado que «Natureza da Ação» na tela Processos (localStorage)."
                          className={`w-full min-w-[8rem] px-1 py-0.5 text-sm border border-slate-200 rounded bg-white ${edicaoDesabilitada ? 'bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                        />
                      </td>
                      <td className="border border-slate-200 px-2 py-1">
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-slate-100"
                          title="Abrir processo"
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirProcessos(procLabelNum);
                          }}
                        >
                          <FolderOpen className="w-4 h-4 text-slate-600" />
                        </button>
                      </td>
                    </tr>
                    );
                  })
                    : null}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-col gap-3 px-0.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Página <span className="font-semibold text-slate-800">{paginaProcessos}</span> de{' '}
                <span className="font-semibold text-slate-800">{totalPaginasProcessos}</span>
                {processosGradeLoadingInicial ? (
                  <span className="text-slate-500"> — carregando…</span>
                ) : processosGradeCarregando ? (
                  <span className="text-slate-500"> — a atualizar…</span>
                ) : processosGradeVisiveis.length > 0 ? (
                  <span className="text-slate-500"> — {processosGradeVisiveis.length} processo(s)</span>
                ) : (
                  <span className="text-slate-500"> — nenhum processo</span>
                )}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={paginaProcessos <= 1}
                  onClick={() => setPaginaProcessos((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-white text-indigo-900 text-sm font-medium hover:bg-indigo-50 shadow-sm disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-white"
                  title="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden />
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={paginaProcessos >= totalPaginasProcessos}
                  onClick={() => setPaginaProcessos((p) => Math.min(totalPaginasProcessos, p + 1))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-white text-indigo-900 text-sm font-medium hover:bg-indigo-50 shadow-sm disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-white"
                  title="Próxima página"
                >
                  Próximo
                  <ChevronRight className="w-4 h-4 shrink-0" aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={paginaProcessos >= totalPaginasProcessos}
                  onClick={() => setPaginaProcessos(totalPaginasProcessos)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-white text-indigo-900 text-sm font-medium hover:bg-indigo-50 shadow-sm disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-white"
                  title="Ir para a última página"
                >
                  Última
                  <ChevronsRight className="w-4 h-4 shrink-0" aria-hidden />
                </button>
              </div>
            </div>
            </div>
          </div>
          </div>
          </section>

          <div className="flex justify-center pt-2">
            <button
              type="button"
              className="px-8 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-semibold shadow-sm hover:bg-slate-50 hover:border-slate-400 transition-colors"
              onClick={() => {
                if (isEmbedded && typeof onFecharEmbed === 'function') onFecharEmbed();
                else window.history.back();
              }}
            >
              Fechar
            </button>
          </div>
          </>
          )}

          </div>
        </div>
      </div>

      <ModalConfiguracoesCalculoCliente
        open={modalConfigCalculoAberto}
        codigoCliente={codigo}
        nomeCliente={nomeRazao}
        somenteLeitura={edicaoDesabilitada}
        onClose={() => setModalConfigCalculoAberto(false)}
      />

      <ModalWhatsAppCliente
        open={modalWhatsAppAberto}
        codigoCliente={codigo}
        nomeCliente={nomeRazao}
        pessoaId={pessoa}
        onClose={() => setModalWhatsAppAberto(false)}
      />

      <ModalCobrancaAutomaticaCliente
        open={modalCobrancaAutomaticaAberto}
        codigoCliente={codigo}
        nomeCliente={nomeRazao}
        onClose={() => setModalCobrancaAutomaticaAberto(false)}
      />

      <ModalImportarContratoHonorarios
        open={modalImportarContratoAberto}
        codigoCliente={codigo}
        nomeCliente={nomeRazao}
        onClose={() => setModalImportarContratoAberto(false)}
      />

      {modalEscolherPessoa && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-escolher-pessoa-titulo"
          onClick={() => {
            setModalEscolherPessoa(false);
            setBuscaPessoaModal('');
          }}
        >
          <div
            className="flex h-full w-full max-w-none flex-col overflow-hidden rounded-none border border-slate-300 bg-white shadow-xl md:h-auto md:max-h-[88vh] md:max-w-3xl md:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-3 md:px-4">
              <button
                type="button"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 md:hidden"
                aria-label="Voltar"
                onClick={() => {
                  setModalEscolherPessoa(false);
                  setBuscaPessoaModal('');
                }}
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
              <h2
                id="modal-escolher-pessoa-titulo"
                className="min-w-0 flex-1 text-base font-semibold text-slate-800"
              >
                Escolher pessoa (cliente)
              </h2>
              <button
                type="button"
                onClick={() => {
                  setModalEscolherPessoa(false);
                  setBuscaPessoaModal('');
                }}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="shrink-0 space-y-3 border-b border-slate-100 p-4">
              <label className="block text-sm font-medium text-slate-700">Pesquisar</label>
              <input
                type="text"
                autoFocus
                value={buscaPessoaModal}
                onChange={(e) => setBuscaPessoaModal(e.target.value)}
                placeholder="Nº da pessoa, nome ou CPF/CNPJ…"
                className={`${inputClass} text-base md:text-sm`}
              />
              <p className="text-xs text-slate-500">
                Permite o nº da pessoa no Cadastro de Pessoas, o nome (mínimo 2 letras) ou CPF/CNPJ em dígitos (11 ou 14
                caracteres tratam como documento). A busca inclui pessoas ativas e inativas. Clique numa linha para
                definir esta pessoa como cliente.
              </p>
              {pessoasModalApiErro ? (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-2 py-2">{pessoasModalApiErro}</p>
              ) : null}
            </div>
            <div className="flex-1 min-h-0 overflow-auto px-4 pb-4">
              {pessoasFiltradasModal.tipo === 'vazio' && (
                <p className="text-sm text-slate-500 py-6 text-center">Digite para filtrar o cadastro de pessoas.</p>
              )}
              {pessoasFiltradasModal.tipo === 'curto' && (
                <p className="text-sm text-amber-800 py-6 text-center">
                  Digite pelo menos 2 letras no nome, ou use números para o nº da pessoa no cadastro ou para CPF/CNPJ.
                </p>
              )}
              {pessoasFiltradasModal.tipo === 'ok' && pessoasFiltradasModal.loading && pessoasFiltradasModal.lista.length === 0 && (
                <p className="text-sm text-slate-500 py-6 text-center">Buscando no cadastro…</p>
              )}
              {pessoasFiltradasModal.tipo === 'ok' &&
                !pessoasFiltradasModal.loading &&
                pessoasFiltradasModal.lista.length === 0 && (
                  <p className="text-sm text-slate-600 py-6 text-center">Nenhuma pessoa encontrada.</p>
                )}
              {pessoasFiltradasModal.tipo === 'ok' && pessoasFiltradasModal.lista.length > 0 && (
                <>
                  {pessoasFiltradasModal.loading && (
                    <p className="text-xs text-slate-500 py-2">Atualizando resultados…</p>
                  )}
                  {pessoasFiltradasModal.limitado && (
                    <p className="text-xs text-slate-500 py-2">
                      Mostrando até 400 resultados — refine a busca se necessário.
                    </p>
                  )}
                  <div className="border border-slate-200 rounded overflow-hidden">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-700 w-24">
                            Cód.
                          </th>
                          <th className="border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-700">
                            Nome / Razão social
                          </th>
                          <th className="border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-700 w-44">
                            CPF / CNPJ
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pessoasFiltradasModal.lista.map((row, idx) => (
                          <tr
                            key={row.id}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                aplicarPessoaSelecionada(row);
                              }
                            }}
                            onClick={() => aplicarPessoaSelecionada(row)}
                            className={`cursor-pointer hover:bg-blue-50 ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                            }`}
                          >
                            <td className="border-b border-slate-100 px-2 py-1.5 text-slate-800 tabular-nums">
                              {row.id}
                            </td>
                            <td className="border-b border-slate-100 px-2 py-1.5 text-slate-800">{row.nome}</td>
                            <td className="border-b border-slate-100 px-2 py-1.5 text-slate-700 whitespace-nowrap">
                              {formatDocBR(row.cpf)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {modalQualificacaoAberto && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-qualificacao-titulo"
          onClick={() => setModalQualificacaoAberto(false)}
        >
          <div
            className="flex h-full w-full max-w-none flex-col overflow-hidden rounded-none border border-slate-300 bg-white shadow-xl md:h-auto md:max-h-[85vh] md:max-w-4xl md:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-3 md:px-4">
              <button
                type="button"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 md:hidden"
                aria-label="Voltar"
                onClick={() => setModalQualificacaoAberto(false)}
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
              <h2 id="modal-qualificacao-titulo" className="min-w-0 flex-1 text-base font-semibold text-slate-800">
                Texto
              </h2>
              <button
                type="button"
                onClick={() => setModalQualificacaoAberto(false)}
                className="flex min-h-11 min-w-[5.5rem] items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-4">
              <textarea
                value={textoQualificacao}
                readOnly
                className="min-h-[min(50vh,300px)] w-full flex-1 resize-none rounded border border-slate-300 bg-white px-3 py-2 text-base md:min-h-[300px] md:text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {contaCorrenteEmbed ? (
        <Suspense fallback={null}>
          <ProcessosLazy
            key={contaCorrenteEmbed.revision}
            embedIntent={contaCorrenteEmbed.routerState}
            embedIntentRevision={contaCorrenteEmbed.revision}
            onFecharEmbed={() => setContaCorrenteEmbed(null)}
          />
        </Suspense>
      ) : null}

      {toastDocCliente?.mensagem ? (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-[200] max-w-[min(92vw,24rem)] -translate-x-1/2 px-4 py-3 text-center text-sm font-medium text-rose-50 shadow-xl shadow-black/30 pointer-events-none rounded-xl border border-rose-400/40 bg-rose-950/95 ring-1 ring-white/10"
        >
          {toastDocCliente.mensagem}
        </div>
      ) : null}
    </div>
  );
}
