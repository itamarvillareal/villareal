import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  SlidersHorizontal,
  PlusCircle,
  X,
  Users,
} from 'lucide-react';
import { ModalConfiguracoesCalculoCliente } from './ModalConfiguracoesCalculoCliente.jsx';
import { getDadosProcessoClienteUnificado } from '../data/processoClienteProcUnificado.js';
import { buscarCliente, pesquisarCadastroPessoasPorNomeOuCpf } from '../api/clientesService.js';
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
  obterDescricaoAcaoUnificada,
  obterNumeroProcessoVelhoUnificado,
  obterNumeroProcessoNovoUnificado,
  obterParteOpostaUnificada,
  salvarNaturezaAcaoDoProcesso,
  salvarNumeroProcessoVelhoDoProcesso,
  salvarNumeroProcessoNovoDaGradeCadastro,
  salvarParteOpostaDaGradeCadastro,
  alinharListaProcessosDescricaoComHistorico,
  enriquecerListaProcessosComHistoricoLocal,
  listarRegistrosProcessosHistoricoNormalizados,
} from '../data/processosHistoricoData.js';
import { getContextoAuditoriaUsuario, registrarAuditoria } from '../services/auditoriaCliente.js';
import { featureFlags } from '../config/featureFlags.js';
import {
  buildRouterStateChaveClienteProcesso,
  extrairIntentNavegacaoProcessos,
} from '../domain/camposProcessoCliente.js';
import {
  listarClientesCadastro,
  resolverClienteCadastroPorCodigo,
  salvarClienteCadastro,
} from '../repositories/clientesRepository.js';
import { getIdPessoaPorCodCliente } from '../data/clienteCodigoHelpers.js';
import {
  buscarClientePorCodigo,
  buscarProcessoPorChaveNatural,
  listarProcessosPorCodigoCliente,
  listarProcessosPorNumeroInterno,
  mergeCadastroClientesProcessosComApi,
  salvarCabecalhoProcesso,
} from '../repositories/processosRepository.js';

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

function formatDocBR(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return d || '—';
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

function getInitialEstadoCliente(codPreferido, clientesApiIndex = []) {
  const resolved = resolverCodigoClienteInicial(codPreferido, clientesApiIndex);
  const cod = padCliente8(resolved ?? DEFAULT_CLIENTE_VAZIO.codigo);
  const mock = gerarMockClienteEProcessos(cod, clientesApiIndex);
  const persisted = loadCadastroClienteDados(cod);
  if (!mock) {
    return {
      codigo: cod,
      pessoa: persisted?.pessoa ?? DEFAULT_CLIENTE_VAZIO.pessoa,
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
    pessoa: persisted?.pessoa ?? mock.pessoa ?? '',
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

/** Estado `codigo` = **codigoCliente** (mesmo dado que a tela Processos em `codigoCliente`). Grade: `procNumero` = **numeroInterno**. */
export function CadastroClientes() {
  const location = useLocation();
  const navigate = useNavigate();
  const stateFromFinanceiro = location.state && typeof location.state === 'object' ? location.state : null;
  const navClientes = extrairIntentNavegacaoProcessos(stateFromFinanceiro);
  const codClienteFromState = navClientes?.hasCod ? String(navClientes.codRaw ?? '').trim() : '';
  const procFromState =
    navClientes?.hasProcKey && navClientes.procRaw !== undefined && navClientes.procRaw !== null
      ? String(navClientes.procRaw)
      : '';

  const ini = getInitialEstadoCliente(codClienteFromState || undefined);
  const [codigo, setCodigo] = useState(ini.codigo);
  const [pessoa, setPessoa] = useState(ini.pessoa);
  const [nomeRazao, setNomeRazao] = useState(ini.nomeRazao);
  const [cnpjCpf, setCnpjCpf] = useState(ini.cnpjCpf);
  const [edicaoDesabilitada, setEdicaoDesabilitada] = useState(ini.edicaoDesabilitada);
  const [clienteInativo, setClienteInativo] = useState(ini.clienteInativo);
  const [observacao, setObservacao] = useState(ini.observacao);
  const [pesquisaProcesso, setPesquisaProcesso] = useState('');
  const [buscaClienteNome, setBuscaClienteNome] = useState('');
  /** Resultados da busca só por dígitos: nº interno do processo (API/histórico). */
  const [clientesBuscaPorProcHits, setClientesBuscaPorProcHits] = useState([]);
  const [clientesBuscaPorProcLoading, setClientesBuscaPorProcLoading] = useState(false);
  const [clientesBuscaPorProcErro, setClientesBuscaPorProcErro] = useState('');
  const [paginaProcessos, setPaginaProcessos] = useState(1);
  const [modalQualificacaoAberto, setModalQualificacaoAberto] = useState(false);
  const [modalConfigCalculoAberto, setModalConfigCalculoAberto] = useState(false);
  const [modalEscolherPessoa, setModalEscolherPessoa] = useState(false);
  const [buscaPessoaModal, setBuscaPessoaModal] = useState('');
  const [pessoasModalApiLista, setPessoasModalApiLista] = useState([]);
  const [pessoasModalApiLoading, setPessoasModalApiLoading] = useState(false);
  const [pessoasModalApiErro, setPessoasModalApiErro] = useState('');
  const [processos, setProcessos] = useState(ini.processos);
  const [clientesApiIndex, setClientesApiIndex] = useState([]);
  /** Quando `useApiClientes`, fica `true` após o primeiro GET /api/clientes terminar (mesmo com lista vazia). */
  const [clientesApiCarregados, setClientesApiCarregados] = useState(() => !featureFlags.useApiClientes);
  const [erroApiCliente, setErroApiCliente] = useState('');
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
  const montagemInicialRef = useRef(true);
  /** Evita sobrescrever nome/CPF ao carregar cliente por código (persistido/mock). */
  const pularSincPorCargaClienteRef = useRef(false);
  const primeiraSincPessoaRef = useRef(true);
  /** Ignora respostas antigas de GET /api/clientes/resolucao se o usuário mudar de código rápido. */
  const resolucaoCodigoReqIdRef = useRef(0);
  /** Com API: primeira visita sem último salvo — aplica o maior código da lista uma vez por entrada em /pessoas. */
  const aplicouUltimoClienteApiSemPersistRef = useRef(false);
  /** Evita aplicar GET /api/processos antigo ao trocar de cliente rápido. */
  const processosApiReqIdRef = useRef(0);
  const codigoRef = useRef(codigo);
  codigoRef.current = codigo;

  const refreshProcessosGrade = useCallback((padded, baseLista) => {
    const enriched = enriquecerListaProcessosComHistoricoLocal(padded, baseLista);
    if (!featureFlags.useApiProcessos) {
      setProcessos(enriched);
      return;
    }
    const myId = ++processosApiReqIdRef.current;
    setProcessos(enriched);
    void listarProcessosPorCodigoCliente(padded)
      .then((apiList) => {
        if (processosApiReqIdRef.current !== myId) return;
        setProcessos(mergeCadastroClientesProcessosComApi(padded, enriched, apiList));
      })
      .catch(() => {
        if (processosApiReqIdRef.current !== myId) return;
        setProcessos(enriched);
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

  useEffect(() => {
    if (location.pathname !== '/pessoas') return undefined;
    let cancelado = false;
    void (async () => {
      if (featureFlags.useApiClientes) {
        setClientesApiCarregados(false);
        try {
          const data = await listarClientesCadastro();
          if (!cancelado) {
            setClientesApiIndex(Array.isArray(data) ? data : []);
            setErroApiCliente('');
          }
        } catch (e) {
          if (!cancelado) {
            setClientesApiIndex([]);
            setErroApiCliente(e?.message || 'Erro ao carregar clientes da API.');
          }
        } finally {
          if (!cancelado) setClientesApiCarregados(true);
        }
      }
      if (!cancelado) setProximoClienteRefreshTick((t) => t + 1);
    })();
    return () => {
      cancelado = true;
    };
  }, [location.pathname, location.key]);

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
    const mock = gerarMockClienteEProcessos(padded, clientesApiIndex);
    const persisted = loadCadastroClienteDados(padded);
    const api = featureFlags.useApiClientes
      ? (clientesApiIndex || []).find((c) => c.codigo === padded)
      : null;
    if (api) {
      setCodigo(api.codigo);
      setPessoa(api.pessoa ?? '');
      setNomeRazao(api.nomeRazao ?? '');
      setCnpjCpf(api.cnpjCpf ?? '');
      setObservacao(api.observacao ?? '');
      setClienteInativo(api.clienteInativo ?? false);
      setEdicaoDesabilitada(true);
      const baseLista = mock
        ? mergeProcessosLista(mock.processos, persisted?.processos)
        : Array.isArray(persisted?.processos)
          ? [...persisted.processos]
          : [];
      refreshProcessosGrade(padded, baseLista);
      return;
    }

    if (featureFlags.useApiClientes) {
      const myId = ++resolucaoCodigoReqIdRef.current;
      setCodigo(padded);
      setPessoa('');
      setNomeRazao('');
      setCnpjCpf('');
      setObservacao('');
      setClienteInativo(false);
      setEdicaoDesabilitada(true);

      void resolverClienteCadastroPorCodigo(padded).then((resolved) => {
        if (resolucaoCodigoReqIdRef.current !== myId) return;
        if (resolved) {
          setCodigo(resolved.codigo);
          setPessoa(resolved.pessoa ?? '');
          setNomeRazao(resolved.nomeRazao ?? '');
          setCnpjCpf(resolved.cnpjCpf ?? '');
          setObservacao(resolved.observacao ?? '');
          setClienteInativo(resolved.clienteInativo ?? false);
          setEdicaoDesabilitada(true);
          const baseLista = mock
            ? mergeProcessosLista(mock.processos, persisted?.processos)
            : Array.isArray(persisted?.processos)
              ? [...persisted.processos]
              : [];
          refreshProcessosGrade(padded, baseLista);
          return;
        }
        if (mock) {
          setCodigo(mock.codigoCliente);
          setPessoa(mock.pessoa ?? '');
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
            setPessoa('');
            setNomeRazao(persisted.nomeRazao ?? '');
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
        setNomeRazao(persisted.nomeRazao ?? '');
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
  }, [clientesApiIndex, refreshProcessosGrade]);

  /**
   * Com API: após o GET /api/clientes terminar (lista pode estar vazia), reaplica o código atual (`codigoRef`)
   * para acionar /resolucao quando o cliente não está no índice. Omitir `codigo` nas deps evita /resolucao a cada tecla.
   */
  useEffect(() => {
    if (!featureFlags.useApiClientes) return;
    if (!clientesApiCarregados) return;
    aplicarDadosCliente(padCliente8(codigoRef.current));
  }, [clientesApiCarregados, clientesApiIndex, aplicarDadosCliente]);

  useEffect(() => {
    const path = (location.pathname || '').replace(/\/+$/, '');
    if (path !== '/pessoas') return;
    aplicouUltimoClienteApiSemPersistRef.current = false;
  }, [location.pathname, location.key]);

  useEffect(() => {
    if (!featureFlags.useApiClientes) return;
    if (!clientesApiCarregados) return;
    if (codClienteFromState) return;
    if (loadUltimoCodigoCliente()) return;
    if (aplicouUltimoClienteApiSemPersistRef.current) return;
    const codes = coletarCodigosClienteConhecidos(clientesApiIndex);
    if (codes.length === 0) return;
    aplicouUltimoClienteApiSemPersistRef.current = true;
    const ultimo = codes[codes.length - 1];
    if (padCliente8(codigoRef.current) !== padCliente8(ultimo)) {
      aplicarDadosCliente(ultimo);
    }
  }, [
    clientesApiCarregados,
    clientesApiIndex,
    aplicarDadosCliente,
    codClienteFromState,
  ]);

  useEffect(() => {
    if (!featureFlags.useApiClientes) return;
    if (!clientesApiCarregados) return;
    const id = window.setTimeout(() => {
      saveUltimoCodigoCliente(padCliente8(codigo));
    }, 150);
    return () => window.clearTimeout(id);
  }, [codigo, clientesApiCarregados]);

  useEffect(() => {
    if (codClienteFromState) {
      aplicarDadosCliente(codClienteFromState);
    }
    if (procFromState) setPesquisaProcesso(procFromState);
  }, [codClienteFromState, procFromState, aplicarDadosCliente]);

  useEffect(() => {
    const h = () => aplicarDadosCliente(codigo);
    window.addEventListener('vilareal:cadastro-clientes-externo-atualizado', h);
    window.addEventListener('vilareal:processos-historico-atualizado', h);
    return () => {
      window.removeEventListener('vilareal:cadastro-clientes-externo-atualizado', h);
      window.removeEventListener('vilareal:processos-historico-atualizado', h);
    };
  }, [codigo, aplicarDadosCliente]);

  /** Volta da tela Processos (ou outro fluxo): alinha à grade ao histórico local e inclui Proc. novos gravados em Processos. */
  useEffect(() => {
    if (location.pathname !== '/pessoas') return;
    const padded = padCliente8(codigo);
    setProcessos((prev) => enriquecerListaProcessosComHistoricoLocal(padded, prev));
    if (!featureFlags.useApiProcessos) return;
    const myId = ++processosApiReqIdRef.current;
    void listarProcessosPorCodigoCliente(padded)
      .then((apiList) => {
        if (processosApiReqIdRef.current !== myId) return;
        setProcessos((prev) =>
          mergeCadastroClientesProcessosComApi(
            padded,
            enriquecerListaProcessosComHistoricoLocal(padded, prev),
            apiList
          )
        );
      })
      .catch(() => {});
  }, [location.pathname, location.key, codigo]);

  useEffect(() => {
    if (primeiraSincPessoaRef.current) {
      primeiraSincPessoaRef.current = false;
      return;
    }
    if (pularSincPorCargaClienteRef.current) {
      pularSincPorCargaClienteRef.current = false;
      return;
    }
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
            setNomeRazao(String(api.nome ?? '').trim() || `Pessoa nº ${id}`);
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

  useEffect(() => {
    if (montagemInicialRef.current) {
      montagemInicialRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      const s = persistSnapshotRef.current;
      if (!s) return;
      if (featureFlags.useApiClientes) {
        void salvarClienteCadastro({
          codigo: s.codigo,
          pessoa: s.pessoa,
          nomeRazao: s.nomeRazao,
          cnpjCpf: s.cnpjCpf,
          observacao: s.observacao,
          clienteInativo: s.clienteInativo,
        }).catch(() => {});
        return;
      }
      saveCadastroClienteDados(s.codigo, {
        pessoa: s.pessoa,
        nomeRazao: s.nomeRazao,
        cnpjCpf: s.cnpjCpf,
        observacao: s.observacao,
        clienteInativo: s.clienteInativo,
        edicaoDesabilitada: s.edicaoDesabilitada,
        processos: s.processos,
      });
    }, 250);
    return () => clearTimeout(t);
  }, [codigo, pessoa, nomeRazao, cnpjCpf, observacao, clienteInativo, edicaoDesabilitada, processos]);

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
    aplicarDadosCliente(padded);
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
              if (!clienteApi?.id) return;
              const procNum = Number(row.procNumero);
              const existente = await buscarProcessoPorChaveNatural(padCliente8(codigo), procNum);
              await salvarCabecalhoProcesso({
                clienteId: clienteApi.id,
                codigoCliente: padCliente8(codigo),
                numeroInterno: procNum,
                numeroProcessoNovo: campo === 'processoNovo' ? valor : row.processoNovo,
                numeroProcessoVelho: campo === 'processoVelho' ? valor : row.processoVelho,
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
        if (campo === 'processoVelho') {
          const n = Number(row?.procNumero);
          if (Number.isFinite(n) && n >= 1) {
            salvarNumeroProcessoVelhoDoProcesso(padCliente8(codigo), n, valor);
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

  function abrirProcessos(procNumero) {
    navigate('/processos', { state: buildRouterStateChaveClienteProcesso(padCliente8(codigo), procNumero ?? '') });
  }

  /** Abre Processos com modal Conta Corrente em modo Proc. 0 (mensalista / geral do cliente). */
  function abrirContaCorrenteProcZero() {
    const cod = padCliente8(codigo);
    const n = Number(normalizarCodigoCliente(codigo));
    if (!Number.isFinite(n) || n < 1) {
      window.alert('Informe um código de cliente válido.');
      return;
    }
    navigate('/processos', { state: buildRouterStateChaveClienteProcesso(cod, 0) });
  }

  /** Próximo índice de processo (1…n) para este cliente na lista local. */
  function proximoNumeroProcesso(lista) {
    const nums = (lista || []).map((p) => Number(p.procNumero)).filter((n) => Number.isFinite(n) && n >= 1);
    const max = nums.length ? Math.max(...nums) : 0;
    return max + 1;
  }

  function handleIncluirNovoProcesso() {
    if (edicaoDesabilitada) {
      window.alert(
        'Desmarque "Edição Desabilitada" para incluir um novo processo, ou use o fluxo administrativo adequado.'
      );
      return;
    }
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

  const processosFiltrados = useMemo(() => {
    const termoRaw = String(pesquisaProcesso ?? '');
    const termo = normalizarTextoBusca(termoRaw);
    const termoNumero = normalizarNumeroBusca(termoRaw);
    if (!termo) return processos;

    // Termo numérico curto: busca parcial no “Proc.” (comportamento antigo, ex.: 1–2 dígitos).
    // Com 3+ dígitos, antes só se buscava no nº novo (CNJ), ignorando o nº interno — ex.: “278” não achava Proc. 278.
    const buscaProcCurta = termoNumero.length > 0 && termoNumero.length <= 2;

    return (processos || []).filter((proc) => {
      const procNumeroStr = String(proc.procNumero ?? '');
      const procInternoDigits = apenasDigitos(proc.procNumero);
      const numeroNovo = normalizarNumeroBusca(proc.processoNovo ?? '');

      const numeroMatch = (() => {
        if (!termoNumero) return false;
        if (buscaProcCurta) return procNumeroStr.includes(termoNumero);
        const procN = Number(procInternoDigits);
        const termN = Number(termoNumero);
        const internoExato =
          Number.isFinite(procN) &&
          Number.isFinite(termN) &&
          procN >= 0 &&
          procN === termN;
        return internoExato || numeroNovo.includes(termoNumero);
      })();

      const autorStr = normalizarTextoBusca(proc.autor ?? '');
      const reuStr = normalizarTextoBusca(proc.reu ?? proc.parteOposta ?? '');
      const tipoAcaoStr = normalizarTextoBusca(proc.tipoAcao ?? proc.descricao ?? '');

      return (
        numeroMatch ||
        autorStr.includes(termo) ||
        reuStr.includes(termo) ||
        tipoAcaoStr.includes(termo) ||
        // fallback: procura genérica em campos de texto já visíveis
        normalizarTextoBusca(proc.parteOposta ?? '').includes(termo) ||
        normalizarTextoBusca(proc.descricao ?? '').includes(termo)
      );
    });
  }, [processos, pesquisaProcesso]);

  const totalPaginasProcessos = useMemo(() => {
    const n = processosFiltrados.length;
    return Math.max(1, Math.ceil(n / PROCESSOS_POR_PAGINA));
  }, [processosFiltrados.length]);

  const processosPagina = useMemo(() => {
    const inicio = (paginaProcessos - 1) * PROCESSOS_POR_PAGINA;
    return processosFiltrados.slice(inicio, inicio + PROCESSOS_POR_PAGINA);
  }, [processosFiltrados, paginaProcessos]);

  useEffect(() => {
    setPaginaProcessos(1);
  }, [pesquisaProcesso, codigo]);

  useEffect(() => {
    setPaginaProcessos((p) => Math.min(p, totalPaginasProcessos));
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
    setPessoa(String(p.id));
    setNomeRazao(p.nome);
    setCnpjCpf(formatDocBR(p.cpf));
    setModalEscolherPessoa(false);
    setBuscaPessoaModal('');
    const { usuarioNome } = getContextoAuditoriaUsuario();
    registrarAuditoria({
      modulo: 'Clientes',
      tela: '/pessoas',
      tipoAcao: 'VINCULACAO',
      descricao: `Usuário ${usuarioNome} vinculou a pessoa ${p.nome} (id ${p.id}) ao cliente em edição (código ${padCliente8(codigo)}).`,
      registroAfetadoId: String(p.id),
      registroAfetadoNome: p.nome,
    });
  }

  useEffect(() => {
    if (!modalEscolherPessoa) return;
    const h = (e) => {
      if (e.key === 'Escape') setModalEscolherPessoa(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [modalEscolherPessoa]);

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
    const limite = 80;
    const hits = [];
    for (const row of indiceClientesPorNome) {
      if (hits.length >= limite) break;
      if (normalizarTextoBusca(row.nome).includes(t)) hits.push(row);
    }
    return hits;
  }, [indiceClientesPorNome, buscaClienteNome]);

  /** Busca por código de cliente com exatamente 8 dígitos (sem letras). */
  const clientesFiltradosPorCodigo8 = useMemo(() => {
    const raw = String(buscaClienteNome ?? '').trim();
    if (!/^\d{8}$/.test(raw)) return [];
    const cod8 = padCliente8(raw);
    const hit = indiceClientesPorNome.find((r) => r.codigoPadded === cod8);
    return hit ? [hit] : [];
  }, [buscaClienteNome, indiceClientesPorNome]);

  useEffect(() => {
    const raw = String(buscaClienteNome ?? '').trim();
    if (!raw || !/^\d+$/.test(raw) || /^\d{8}$/.test(raw)) {
      setClientesBuscaPorProcHits([]);
      setClientesBuscaPorProcLoading(false);
      setClientesBuscaPorProcErro('');
      return undefined;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 2_147_483_647) {
      setClientesBuscaPorProcHits([]);
      setClientesBuscaPorProcLoading(false);
      return undefined;
    }
    let cancelled = false;
    setClientesBuscaPorProcLoading(true);
    setClientesBuscaPorProcErro('');
    const h = window.setTimeout(async () => {
      try {
        if (featureFlags.useApiProcessos) {
          const arr = await listarProcessosPorNumeroInterno(n);
          if (cancelled) return;
          const limite = 80;
          const hits = [];
          for (const p of arr || []) {
            if (hits.length >= limite) break;
            const cod8 = padCliente8(p.codigoCliente);
            const idxRow = clientesApiIndex.find((c) => c.codigo === cod8);
            const nomeCli = String(idxRow?.nomeRazao ?? '').trim();
            const cnj = String(p.numeroCnj ?? '').trim();
            const po = String(p.parteOposta ?? '').trim();
            const rotulo = [
              nomeCli || `Cliente ${cod8}`,
              `Proc. ${p.numeroInterno ?? n}`,
              cnj ? `CNJ ${cnj}` : null,
              po ? (po.length > 100 ? `${po.slice(0, 100)}…` : po) : null,
            ]
              .filter(Boolean)
              .join(' · ');
            hits.push({
              codigoPadded: cod8,
              codigoNum: Number(String(cod8).replace(/\D/g, '')) || 0,
              nome: rotulo,
            });
          }
          setClientesBuscaPorProcHits(hits);
        } else {
          const seen = new Set();
          const hits = [];
          for (const reg of listarRegistrosProcessosHistoricoNormalizados()) {
            if (Number(reg.proc) !== n) continue;
            const codJur = String(reg.codCliente ?? '').trim();
            const codNum = Number(String(codJur).replace(/^0+/, '') || 0);
            if (!Number.isFinite(codNum) || codNum < 1) continue;
            const cod8 = padCliente8(codNum);
            if (seen.has(cod8)) continue;
            seen.add(cod8);
            const nomeC = String(reg.cliente ?? '').trim() || `Cliente ${cod8}`;
            hits.push({
              codigoPadded: cod8,
              codigoNum: codNum,
              nome: `${nomeC} · proc. ${n}`,
            });
            if (hits.length >= 80) break;
          }
          hits.sort((a, b) => a.codigoNum - b.codigoNum);
          if (!cancelled) setClientesBuscaPorProcHits(hits);
        }
      } catch (e) {
        if (!cancelled) {
          setClientesBuscaPorProcErro(String(e?.message || '').trim() || 'Falha na busca por nº do processo.');
          setClientesBuscaPorProcHits([]);
        }
      } finally {
        if (!cancelled) setClientesBuscaPorProcLoading(false);
      }
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(h);
    };
  }, [buscaClienteNome, clientesApiIndex]);

  function selecionarClienteDaBuscaNome(row) {
    aplicarCodigoCliente(row.codigoPadded);
    setBuscaClienteNome('');
  }

  const theadBuscaClass =
    'bg-gradient-to-r from-slate-800 via-indigo-900 to-violet-900 text-white [&_th]:border-b [&_th]:border-white/10';

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-indigo-50/35 to-emerald-50/45 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] flex flex-col">
      <div className="max-w-[1400px] mx-auto w-full flex flex-col flex-1 min-h-0 px-3 py-3">
        {erroApiCliente ? (
          <div className="mb-3 rounded-xl border border-red-200/90 bg-red-50/95 px-4 py-3 text-sm text-red-800 shadow-sm backdrop-blur-sm">
            {erroApiCliente}
          </div>
        ) : null}
        <header className="flex items-center justify-between mb-3 gap-2 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md ring-1 ring-emerald-400/40">
              <Users className="w-5 h-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-indigo-900 to-emerald-900 dark:from-slate-100 dark:via-indigo-200 dark:to-emerald-200 bg-clip-text text-transparent">
                Cadastro de Clientes
              </h1>
              <p className="text-xs text-slate-500 truncate">Pessoas, vínculos e processos em um só lugar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="p-2 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 shrink-0 shadow-sm"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 min-w-0 overflow-auto space-y-4 pb-6">
          <section className="rounded-2xl border border-emerald-200/70 bg-white/95 shadow-md overflow-hidden ring-1 ring-emerald-500/10">
            <div className="border-b border-emerald-100/80 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-4 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-white flex items-center gap-2">
                <Search className="w-4 h-4 opacity-95" aria-hidden />
                Buscar cliente
              </h2>
              <p className="text-xs text-emerald-50/95 mt-1 font-medium">
                Por nome, código (8 dígitos) ou nº interno do processo
              </p>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
              <label className="text-sm font-medium text-slate-700 whitespace-nowrap" htmlFor="busca-cliente-nome">
                Pesquisar
              </label>
              <input
                id="busca-cliente-nome"
                type="text"
                value={buscaClienteNome}
                onChange={(e) => setBuscaClienteNome(e.target.value)}
                className={`${inputClass} w-full min-w-[200px] max-w-md`}
                placeholder="Nome, código (8 dígitos) ou nº interno do processo…"
                autoComplete="off"
              />
              </div>
            {(() => {
              const rawBusca = String(buscaClienteNome ?? '').trim();
              const soDigitos = rawBusca.length > 0 && /^\d+$/.test(rawBusca);
              const codigo8 = /^\d{8}$/.test(rawBusca);
              const procInterno = soDigitos && !codigo8;
              return (
                <>
                  {rawBusca && !soDigitos && normalizarTextoBusca(buscaClienteNome).length < 2 && (
                    <p className="text-xs text-slate-500 mb-2">
                      Digite pelo menos 2 letras para buscar pelo nome (razão social ou nome da pessoa vinculada).
                    </p>
                  )}
                  {soDigitos && codigo8 && (
                    <p className="text-xs text-slate-500 mb-2">
                      Busca pelo <strong>código do cliente</strong> (8 dígitos).
                    </p>
                  )}
                  {procInterno && (
                    <p className="text-xs text-slate-500 mb-2">
                      Busca pelo <strong>nº interno do processo</strong> (ex.: 3 ou 12). Clientes que possuem esse
                      processo aparecem abaixo; clique para abrir o cadastro.
                    </p>
                  )}
                  {clientesBuscaPorProcErro ? (
                    <p className="text-sm text-red-600 mb-2">{clientesBuscaPorProcErro}</p>
                  ) : null}
                  {clientesBuscaPorProcLoading && procInterno ? (
                    <p className="text-sm text-slate-500 mb-2">Buscando processos…</p>
                  ) : null}
                  {soDigitos &&
                    codigo8 &&
                    !clientesBuscaPorProcLoading &&
                    clientesFiltradosPorCodigo8.length === 0 &&
                    featureFlags.useApiClientes &&
                    clientesApiCarregados && (
                      <p className="text-sm text-slate-600 mb-2">Nenhum cliente encontrado com esse código.</p>
                    )}
                  {procInterno &&
                    !clientesBuscaPorProcLoading &&
                    !clientesBuscaPorProcErro &&
                    clientesBuscaPorProcHits.length === 0 && (
                      <p className="text-sm text-slate-600 mb-2">
                        Nenhum processo encontrado com o nº interno &quot;{rawBusca}&quot;.
                      </p>
                    )}
                  {!soDigitos &&
                    normalizarTextoBusca(buscaClienteNome).length >= 2 &&
                    clientesFiltradosPorNome.length === 0 && (
                      <p className="text-sm text-slate-600 mb-2">Nenhum cliente encontrado com esse nome.</p>
                    )}
                </>
              );
            })()}
            {clientesFiltradosPorCodigo8.length > 0 && (
              <div className="border border-slate-200/90 rounded-xl bg-white overflow-x-auto max-h-56 overflow-y-auto mb-2 shadow-inner ring-1 ring-slate-100">
                <table className="w-full text-sm border-collapse min-w-[480px]">
                  <thead>
                    <tr className={`${theadBuscaClass} sticky top-0`}>
                      <th className="px-3 py-2.5 text-left font-semibold w-28">
                        Código
                      </th>
                      <th className="px-3 py-2.5 text-left font-semibold">
                        Nome / Razão social
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesFiltradosPorCodigo8.map((row, idx) => (
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
                        className={`cursor-pointer hover:bg-emerald-50/80 transition-colors ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                        }`}
                      >
                        <td className="border-b border-slate-100 px-3 py-2 text-slate-800 font-mono tabular-nums whitespace-nowrap">
                          {row.codigoPadded}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-2 text-slate-800">{row.nome}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(() => {
              const rawBusca = String(buscaClienteNome ?? '').trim();
              const procInterno = rawBusca.length > 0 && /^\d+$/.test(rawBusca) && !/^\d{8}$/.test(rawBusca);
              if (!procInterno || clientesBuscaPorProcHits.length === 0) return null;
              return (
                <div className="border border-slate-200/90 rounded-xl bg-white overflow-x-auto max-h-56 overflow-y-auto mb-2 shadow-inner ring-1 ring-slate-100">
                  <table className="w-full text-sm border-collapse min-w-[480px]">
                    <thead>
                      <tr className={`${theadBuscaClass} sticky top-0`}>
                        <th className="px-3 py-2.5 text-left font-semibold w-28">
                          Código
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold">
                          Cliente / processo
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientesBuscaPorProcHits.map((row, idx) => (
                        <tr
                          key={`${row.codigoPadded}-${idx}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => selecionarClienteDaBuscaNome(row)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              selecionarClienteDaBuscaNome(row);
                            }
                          }}
                          className={`cursor-pointer hover:bg-emerald-50/80 transition-colors ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                          }`}
                        >
                          <td className="border-b border-slate-100 px-3 py-2 text-slate-800 font-mono tabular-nums whitespace-nowrap">
                            {row.codigoPadded}
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 text-slate-800">{row.nome}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {clientesBuscaPorProcHits.length >= 80 && (
                    <p className="text-xs text-slate-500 px-2 py-1.5 border-t border-slate-100">
                      Mostrando até 80 resultados — refine o nº do processo se necessário.
                    </p>
                  )}
                </div>
              );
            })()}
            {clientesFiltradosPorNome.length > 0 && (
              <div className="border border-slate-200/90 rounded-xl bg-white overflow-x-auto max-h-56 overflow-y-auto shadow-inner ring-1 ring-slate-100">
                <table className="w-full text-sm border-collapse min-w-[480px]">
                  <thead>
                    <tr className={`${theadBuscaClass} sticky top-0`}>
                      <th className="px-3 py-2.5 text-left font-semibold w-28">
                        Código
                      </th>
                      <th className="px-3 py-2.5 text-left font-semibold">
                        Nome / Razão social
                      </th>
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
                        className={`cursor-pointer hover:bg-emerald-50/80 transition-colors ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                        }`}
                      >
                        <td className="border-b border-slate-100 px-3 py-2 text-slate-800 font-mono tabular-nums whitespace-nowrap">
                          {row.codigoPadded}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-2 text-slate-800">{row.nome}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {clientesFiltradosPorNome.length >= 80 && (
                  <p className="text-xs text-slate-500 px-2 py-1.5 border-t border-slate-100">
                    Mostrando até 80 resultados — refine a busca se necessário.
                  </p>
                )}
              </div>
            )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/90 bg-white shadow-md overflow-hidden ring-1 ring-indigo-500/5">
            <div className="border-b border-indigo-400/30 bg-gradient-to-br from-indigo-950 via-violet-950 to-slate-900 px-4 py-3 text-white shadow-md ring-1 ring-indigo-500/25">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-200/90 mb-0.5">Cliente selecionado</p>
              <p className="text-lg font-semibold tracking-tight truncate" title={nomeRazao || undefined}>
                {String(nomeRazao || '').trim() || '— Sem nome / razão social —'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/12 px-2.5 py-0.5 text-xs font-mono font-semibold text-indigo-50 ring-1 ring-white/20">
                  Cód. {padCliente8(codigo)}
                </span>
                {clienteInativo ? (
                  <span className="rounded-full bg-amber-400/25 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-100 ring-1 ring-amber-300/40">
                    Inativo
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-100 ring-1 ring-emerald-400/35">
                    Ativo
                  </span>
                )}
                {edicaoDesabilitada ? (
                  <span className="rounded-full bg-slate-600/50 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                    Edição bloqueada
                  </span>
                ) : (
                  <span className="rounded-full bg-sky-400/25 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-100 ring-1 ring-sky-300/40">
                    Editável
                  </span>
                )}
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
                  className="w-9 py-2 border-r border-indigo-100 hover:bg-indigo-50 text-indigo-800 flex items-center justify-center transition-colors"
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
                  className="flex-1 px-2 py-2 text-sm font-mono text-center border-0 bg-white text-indigo-950"
                />
                <button
                  type="button"
                  className="w-9 py-2 border-l border-indigo-100 hover:bg-indigo-50 text-indigo-800 flex items-center justify-center transition-colors"
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
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-0.5">Pessoa:</label>
              <div className="flex gap-1">
                <input type="text" value={pessoa} onChange={(e) => setPessoa(e.target.value)} disabled={edicaoDesabilitada} className={`${inputClass} w-24 bg-slate-50`} />
                <button
                  type="button"
                  disabled={edicaoDesabilitada}
                  className={`p-2 rounded-lg border shadow-sm ${
                    edicaoDesabilitada
                      ? 'border-slate-200 bg-slate-100 cursor-not-allowed opacity-60'
                      : 'border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100'
                  }`}
                  title={
                    edicaoDesabilitada
                      ? 'Habilite a edição para escolher outra pessoa'
                      : 'Buscar pessoa no cadastro'
                  }
                  onClick={() => {
                    if (edicaoDesabilitada) {
                      window.alert(
                        'Desmarque "Edição Desabilitada" para escolher a pessoa do cliente pelo cadastro.'
                      );
                      return;
                    }
                    setBuscaPessoaModal('');
                    setModalEscolherPessoa(true);
                  }}
                >
                  <Search className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-slate-700 mb-0.5">Nome / Razão Social</label>
              <input type="text" value={nomeRazao} onChange={(e) => setNomeRazao(e.target.value)} disabled={edicaoDesabilitada} className={`${inputClass} ${edicaoDesabilitada ? 'bg-slate-50' : ''}`} />
            </div>
            <div className="w-44">
              <label className="block text-sm font-medium text-slate-700 mb-0.5">CNPJ / CPF</label>
              <input type="text" value={cnpjCpf} onChange={(e) => setCnpjCpf(e.target.value)} disabled={edicaoDesabilitada} className={`${inputClass} ${edicaoDesabilitada ? 'bg-slate-50' : ''}`} />
            </div>
            <div className="flex gap-2 items-end">
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
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-medium shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                Cadastro de Pessoas
              </button>
              <button
                type="button"
                onClick={abrirContaCorrenteProcZero}
                className="px-3 py-2 rounded-lg border border-sky-300 bg-gradient-to-r from-sky-50 to-cyan-50 text-sky-950 text-sm font-medium shadow-sm hover:from-sky-100 hover:to-cyan-100"
                title="Lançamentos do Financeiro com este Cod. Cliente e Proc. 0 (mensalistas / não vinculados a um processo específico). Abre a tela Processos com a janela da conta corrente."
              >
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
                className="px-3 py-2 rounded-lg border border-violet-200 bg-violet-50 text-violet-950 text-sm font-medium shadow-sm hover:bg-violet-100"
              >
                Qualificação
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-950 text-sm font-medium shadow-sm hover:from-amber-100 hover:to-yellow-100"
                title="Documentos do cliente"
              >
                <FolderOpen className="w-4 h-4 shrink-0 text-amber-600" aria-hidden />
                Documentos
              </button>
              <button
                type="button"
                onClick={() => setModalConfigCalculoAberto(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-indigo-300 bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700"
                title="Padrões de juros, multa, honorários, índice e periodicidade para os cálculos deste cliente"
              >
                <SlidersHorizontal className="w-4 h-4 shrink-0" aria-hidden />
                Configurações de cálculo
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer text-slate-700">
              <input type="checkbox" checked={edicaoDesabilitada} onChange={(e) => setEdicaoDesabilitada(e.target.checked)} className="rounded border-slate-300 accent-indigo-600" />
              Edição Desabilitada
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={clienteInativo}
                onChange={(e) => {
                  const v = e.target.checked;
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
                className="rounded border-slate-300 accent-indigo-600"
              />
              Cliente Inativo
            </label>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 shadow-sm ring-1 ring-slate-100/80">
            <label className="block text-sm font-semibold text-slate-800 mb-1">Observação</label>
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} className={`${inputClass} resize-y`} />
          </div>

          <div className="rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50/50 via-white to-indigo-50/30 overflow-hidden shadow-sm ring-1 ring-sky-500/10">
            <div className="border-b border-sky-200/70 bg-gradient-to-r from-sky-600 via-cyan-600 to-indigo-600 px-4 py-2.5">
              <p className="text-sm font-bold uppercase tracking-wide text-white">Processos do cliente</p>
              <p className="text-xs text-sky-100/95 mt-0.5">Grade alinhada à tela Processos — duplo clique na linha para abrir</p>
            </div>
            <div className="p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <label className="text-sm font-medium text-slate-700">Pesquisar</label>
              <input type="text" value={pesquisaProcesso} onChange={(e) => setPesquisaProcesso(e.target.value)} className={`${inputClass} w-64`} placeholder="Buscar processo..." />
              <button type="button" className="p-2 rounded-lg border border-sky-200 bg-white hover:bg-sky-50 shadow-sm" title="Buscar"><Search className="w-4 h-4 text-sky-700" /></button>
              <button type="button" className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 shadow-sm">Pesquisa</button>
              <button
                type="button"
                onClick={handleIncluirNovoProcesso}
                disabled={edicaoDesabilitada}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold shadow-sm ${
                  edicaoDesabilitada
                    ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'border-emerald-500 bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700'
                }`}
                title={
                  edicaoDesabilitada
                    ? 'Habilite a edição para incluir um novo processo'
                    : 'Inclui na lista e abre a tela Processos para este número de processo'
                }
              >
                <PlusCircle className="w-4 h-4 shrink-0" aria-hidden />
                Incluir processo
              </button>
            </div>
            <div className="overflow-x-auto border border-slate-200/90 rounded-xl bg-white shadow-inner ring-1 ring-slate-100">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-indigo-800 via-slate-800 to-violet-900 text-white [&_th]:border-b [&_th]:border-white/10">
                    <th className="px-3 py-2.5 text-left font-semibold w-24 whitespace-nowrap">Proc.</th>
                    <th className="px-3 py-2.5 text-left font-semibold min-w-[100px]">N.º Processo Velho</th>
                    <th className="px-3 py-2.5 text-left font-semibold min-w-[180px]">N.º Processo Novo</th>
                    <th className="px-3 py-2.5 text-left font-semibold min-w-[180px]">Parte Oposta</th>
                    <th className="px-3 py-2.5 text-left font-semibold min-w-[180px]">Descrição da Ação</th>
                    <th className="px-2 py-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {processosPagina.map((proc, idx) => (
                    <tr
                      key={proc.id}
                      className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} cursor-pointer hover:bg-indigo-50/60 transition-colors`}
                      title="Duplo clique: abrir este processo (fora dos campos editáveis)"
                      onDoubleClick={(e) => {
                        if (e.target.closest('input, textarea, button')) return;
                        abrirProcessos(proc.procNumero ?? idx + 1 + (paginaProcessos - 1) * PROCESSOS_POR_PAGINA);
                      }}
                    >
                      <td className="border border-slate-200 px-2 py-1 text-slate-700 whitespace-nowrap tabular-nums">
                        Proc.{' '}
                        {String(proc.procNumero ?? idx + 1 + (paginaProcessos - 1) * PROCESSOS_POR_PAGINA).padStart(2, '0')}:
                      </td>
                      <td className="border border-slate-200 px-1 py-0.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={obterNumeroProcessoVelhoUnificado(
                            padCliente8(codigo),
                            proc.procNumero ?? idx + 1 + (paginaProcessos - 1) * PROCESSOS_POR_PAGINA,
                            proc.processoVelho ?? ''
                          )}
                          onChange={(e) => atualizarCampoProcesso(proc.id, 'processoVelho', e.target.value)}
                          disabled={edicaoDesabilitada}
                          title="Mesmo dado que «Nº Processo Velho» na tela Processos (localStorage)."
                          className={`w-full min-w-[4rem] px-1 py-0.5 text-sm border border-slate-200 rounded bg-white ${edicaoDesabilitada ? 'bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                        />
                      </td>
                      <td className="border border-slate-200 px-1 py-0.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={obterNumeroProcessoNovoUnificado(
                            padCliente8(codigo),
                            proc.procNumero ?? idx + 1 + (paginaProcessos - 1) * PROCESSOS_POR_PAGINA,
                            proc.processoNovo ?? ''
                          )}
                          onChange={(e) => atualizarCampoProcesso(proc.id, 'processoNovo', e.target.value)}
                          disabled={edicaoDesabilitada}
                          title="Mesmo dado que «Nº Processo Novo» na tela Processos (localStorage)."
                          className={`w-full min-w-[8rem] px-1 py-0.5 text-sm border border-slate-200 rounded bg-white ${edicaoDesabilitada ? 'bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                        />
                      </td>
                      <td className="border border-slate-200 px-1 py-0.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={obterParteOpostaUnificada(
                            padCliente8(codigo),
                            proc.procNumero ?? idx + 1 + (paginaProcessos - 1) * PROCESSOS_POR_PAGINA,
                            proc.parteOposta ?? ''
                          )}
                          onChange={(e) => atualizarCampoProcesso(proc.id, 'parteOposta', e.target.value)}
                          disabled={edicaoDesabilitada}
                          title="Mesmo dado que «Parte Oposta» na tela Processos (localStorage)."
                          className={`w-full min-w-[8rem] px-1 py-0.5 text-sm border border-slate-200 rounded bg-white ${edicaoDesabilitada ? 'bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
                        />
                      </td>
                      <td className="border border-slate-200 px-1 py-0.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={obterDescricaoAcaoUnificada(
                            padCliente8(codigo),
                            proc.procNumero ?? idx + 1 + (paginaProcessos - 1) * PROCESSOS_POR_PAGINA,
                            proc.descricao ?? ''
                          )}
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
                            abrirProcessos(proc.procNumero ?? idx + 1 + (paginaProcessos - 1) * PROCESSOS_POR_PAGINA);
                          }}
                        >
                          <FolderOpen className="w-4 h-4 text-slate-600" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 mt-3 px-0.5">
              <p className="text-sm text-slate-600">
                Página <span className="font-semibold text-slate-800">{paginaProcessos}</span> de{' '}
                <span className="font-semibold text-slate-800">{totalPaginasProcessos}</span>
                {processosFiltrados.length > 0 ? (
                  <span className="text-slate-500"> — {processosFiltrados.length} processo(s)</span>
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
              onClick={() => window.history.back()}
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      <ModalConfiguracoesCalculoCliente
        open={modalConfigCalculoAberto}
        codigoCliente={codigo}
        nomeCliente={nomeRazao}
        onClose={() => setModalConfigCalculoAberto(false)}
      />

      {modalEscolherPessoa && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-escolher-pessoa-titulo"
          onClick={() => {
            setModalEscolherPessoa(false);
            setBuscaPessoaModal('');
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-3xl max-h-[88vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <h2 id="modal-escolher-pessoa-titulo" className="text-base font-semibold text-slate-800">
                Escolher pessoa (cliente)
              </h2>
              <button
                type="button"
                onClick={() => {
                  setModalEscolherPessoa(false);
                  setBuscaPessoaModal('');
                }}
                className="p-2 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 shrink-0 border-b border-slate-100">
              <label className="block text-sm font-medium text-slate-700">Pesquisar</label>
              <input
                type="text"
                autoFocus
                value={buscaPessoaModal}
                onChange={(e) => setBuscaPessoaModal(e.target.value)}
                placeholder="Nº da pessoa, nome ou CPF/CNPJ…"
                className={inputClass}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-qualificacao-titulo"
          onClick={() => setModalQualificacaoAberto(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-4xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 id="modal-qualificacao-titulo" className="text-base font-semibold text-slate-800">Texto</h2>
              <button
                type="button"
                onClick={() => setModalQualificacaoAberto(false)}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
            <div className="p-4 flex-1 min-h-0">
              <textarea
                value={textoQualificacao}
                readOnly
                className="w-full h-full min-h-[300px] px-3 py-2 border border-slate-300 rounded text-sm bg-white resize-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
