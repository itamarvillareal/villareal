import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, FolderOpen, ChevronLeft, ChevronRight, Settings, SlidersHorizontal, PlusCircle, X } from 'lucide-react';
import { ModalConfiguracoesCalculoCliente } from './ModalConfiguracoesCalculoCliente.jsx';
import { clienteMock, processosClienteMock } from '../data/mockData';
import { getDadosProcessoClienteUnificado } from '../data/processoClienteProcUnificado.js';
import { getIdPessoaPorCodCliente, CLIENTE_PARA_PESSOA } from '../data/clientesCadastradosMock';
import { buscarCliente } from '../api/clientesService.js';
import {
  getCadastroPessoasMockComNovosLocais,
  getPessoaPorIdIncluindoNovosLocais,
} from '../data/cadastroPessoasMockNovosLocal.js';
import {
  loadCadastroClienteDados,
  saveCadastroClienteDados,
  mergeProcessosLista,
  loadUltimoCodigoCliente,
  obterProximoCodigoClienteSugerido,
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
} from '../data/processosHistoricoData.js';
import { getContextoAuditoriaUsuario, registrarAuditoria } from '../services/auditoriaCliente.js';
import { featureFlags } from '../config/featureFlags.js';
import {
  listarClientesCadastro,
  salvarClienteCadastro,
} from '../repositories/clientesRepository.js';
import {
  buscarClientePorCodigo,
  buscarProcessoPorChaveNatural,
  salvarCabecalhoProcesso,
} from '../repositories/processosRepository.js';

let __ultimoListaClientesLog = 0;
let __ultimoClienteConsultaLog = '';

function formatDocBR(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return d || '—';
}

function dadosClientePorCodigo(n) {
  const idPessoa = getIdPessoaPorCodCliente(n);
  const pes = idPessoa != null ? getPessoaPorIdIncluindoNovosLocais(idPessoa) : null;
  if (pes) {
    return {
      pessoa: String(idPessoa),
      nomeRazao: pes.nome,
      cnpjCpf: formatDocBR(pes.cpf),
    };
  }
  if (idPessoa != null) {
    return {
      pessoa: String(idPessoa),
      nomeRazao: `Pessoa nº ${idPessoa} (fora do cadastro local)`,
      cnpjCpf: '—',
    };
  }
  return {
    pessoa: '',
    nomeRazao: `CLIENTE ${String(n).padStart(4, '0')}`,
    cnpjCpf: '—',
  };
}

const inputClass = 'w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white';

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

/** Exportado para o mesmo mock de processos do cadastro (busca no Financeiro). */
export function gerarMockClienteEProcessos(codigo) {
  const n = Number(normalizarCodigoCliente(codigo));
  if (!Number.isFinite(n) || n < 1 || n > 1000) return null;
  const codigoCliente = padCliente8(n);
  const base = dadosClientePorCodigo(n);
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

  if (n >= 1 && n <= 10) {
    const cnpjCpf =
      base.cnpjCpf !== '—'
        ? base.cnpjCpf
        : `00.${String(n).padStart(3, '0')}.000/0001-00`;
    return {
      codigoCliente,
      pessoa: base.pessoa,
      nomeRazao: base.nomeRazao,
      cnpjCpf,
      processos: procRows,
    };
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

function getInitialEstadoCliente(codPreferido) {
  const cod = padCliente8(codPreferido ?? loadUltimoCodigoCliente() ?? clienteMock.codigo);
  const mock = gerarMockClienteEProcessos(cod);
  const persisted = loadCadastroClienteDados(cod);
  if (!mock) {
    return {
      codigo: cod,
      pessoa: persisted?.pessoa ?? clienteMock.pessoa,
      nomeRazao: persisted?.nomeRazao ?? clienteMock.nomeRazao,
      cnpjCpf: persisted?.cnpjCpf ?? clienteMock.cnpjCpf,
      observacao: persisted?.observacao !== undefined ? persisted.observacao : clienteMock.observacao,
      clienteInativo: persisted?.clienteInativo ?? clienteMock.clienteInativo,
      edicaoDesabilitada: persisted?.edicaoDesabilitada ?? clienteMock.edicaoDesabilitada,
      processos: alinharListaProcessosDescricaoComHistorico(
        cod,
        mergeProcessosLista(processosClienteMock.slice(0, 10), persisted?.processos)
      ),
    };
  }
  return {
    codigo: mock.codigoCliente,
    pessoa: persisted?.pessoa ?? mock.pessoa ?? '',
    nomeRazao: persisted?.nomeRazao ?? mock.nomeRazao,
    cnpjCpf: persisted?.cnpjCpf ?? mock.cnpjCpf,
    observacao: persisted?.observacao !== undefined ? persisted.observacao : clienteMock.observacao,
    clienteInativo: persisted?.clienteInativo ?? clienteMock.clienteInativo,
    edicaoDesabilitada: persisted?.edicaoDesabilitada ?? clienteMock.edicaoDesabilitada,
    processos: alinharListaProcessosDescricaoComHistorico(
      mock.codigoCliente,
      mergeProcessosLista(mock.processos, persisted?.processos)
    ),
  };
}

export function CadastroClientes() {
  const location = useLocation();
  const navigate = useNavigate();
  const stateFromFinanceiro = location.state && typeof location.state === 'object' ? location.state : null;
  const codClienteFromState = stateFromFinanceiro?.codCliente ?? '';
  const procFromState = stateFromFinanceiro?.proc ?? '';

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
  const [paginaProcessos, setPaginaProcessos] = useState(1);
  const [modalQualificacaoAberto, setModalQualificacaoAberto] = useState(false);
  const [modalConfigCalculoAberto, setModalConfigCalculoAberto] = useState(false);
  const [modalEscolherPessoa, setModalEscolherPessoa] = useState(false);
  const [buscaPessoaModal, setBuscaPessoaModal] = useState('');
  const [processos, setProcessos] = useState(ini.processos);
  const [clientesApiIndex, setClientesApiIndex] = useState([]);
  const [erroApiCliente, setErroApiCliente] = useState('');
  /** Atualiza ao trocar de cliente para refletir persistência e mapa de códigos. */
  const proximoCliente = useMemo(() => obterProximoCodigoClienteSugerido(), [codigo]);
  const montagemInicialRef = useRef(true);
  /** Evita sobrescrever nome/CPF ao carregar cliente por código (persistido/mock). */
  const pularSincPorCargaClienteRef = useRef(false);
  const primeiraSincPessoaRef = useRef(true);

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
    if (!featureFlags.useApiClientes) return;
    let cancelado = false;
    (async () => {
      try {
        const data = await listarClientesCadastro();
        if (!cancelado) setClientesApiIndex(data);
      } catch (e) {
        if (!cancelado) setErroApiCliente(e?.message || 'Erro ao carregar clientes da API.');
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

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
    const mock = gerarMockClienteEProcessos(padded);
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
      setEdicaoDesabilitada(false);
      return;
    }
    if (mock) {
      setCodigo(mock.codigoCliente);
      setPessoa(persisted?.pessoa ?? mock.pessoa ?? '');
      setNomeRazao(persisted?.nomeRazao ?? mock.nomeRazao);
      setCnpjCpf(persisted?.cnpjCpf ?? mock.cnpjCpf);
      setObservacao(persisted?.observacao !== undefined ? persisted.observacao : clienteMock.observacao);
      setClienteInativo(persisted?.clienteInativo ?? clienteMock.clienteInativo);
      setEdicaoDesabilitada(persisted?.edicaoDesabilitada ?? clienteMock.edicaoDesabilitada);
      setProcessos(
        alinharListaProcessosDescricaoComHistorico(
          mock.codigoCliente,
          mergeProcessosLista(mock.processos, persisted?.processos)
        )
      );
    } else {
      setCodigo(padded);
      if (persisted) {
        setPessoa(persisted.pessoa ?? '');
        setNomeRazao(persisted.nomeRazao ?? '');
        setCnpjCpf(persisted.cnpjCpf ?? '');
        setObservacao(persisted.observacao ?? '');
        setClienteInativo(persisted.clienteInativo ?? false);
        setEdicaoDesabilitada(persisted.edicaoDesabilitada ?? false);
        setProcessos(
          alinharListaProcessosDescricaoComHistorico(
            padded,
            Array.isArray(persisted.processos) ? persisted.processos : []
          )
        );
      }
    }
  }, [clientesApiIndex]);

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

  /** Volta da tela Processos (ou outro fluxo): alinha «Descrição da Ação» ao mesmo `naturezaAcao` do histórico. */
  useEffect(() => {
    if (location.pathname !== '/pessoas') return;
    setProcessos((prev) => alinharListaProcessosDescricaoComHistorico(padCliente8(codigo), prev));
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
        const pesLocal = getPessoaPorIdIncluindoNovosLocais(id);
        if (pesLocal) {
          if (!cancelado) {
            setNomeRazao(pesLocal.nome);
            setCnpjCpf(formatDocBR(pesLocal.cpf));
          }
          return;
        }
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
    navigate('/processos', { state: { codCliente: padCliente8(codigo), proc: String(procNumero ?? '') } });
  }

  /** Abre Processos com modal Conta Corrente em modo Proc. 0 (mensalista / geral do cliente). */
  function abrirContaCorrenteProcZero() {
    const cod = padCliente8(codigo);
    const n = Number(normalizarCodigoCliente(codigo));
    if (!Number.isFinite(n) || n < 1) {
      window.alert('Informe um código de cliente válido.');
      return;
    }
    navigate('/processos', { state: { codCliente: cod, proc: 0 } });
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
    navigate('/processos', { state: { codCliente: padCliente8(codigo), proc: String(next) } });
  }

  const processosFiltrados = useMemo(() => {
    const termoRaw = String(pesquisaProcesso ?? '');
    const termo = normalizarTextoBusca(termoRaw);
    const termoNumero = normalizarNumeroBusca(termoRaw);
    if (!termo) return processos;

    // Se o usuário digitou algo curto e numérico, tratamos como busca pelo “Proc.” (1–10).
    const buscaProcCurta = termoNumero.length > 0 && termoNumero.length <= 2;

    return (processos || []).filter((proc) => {
      const procNumeroStr = String(proc.procNumero ?? '');
      const numeroNovo = normalizarNumeroBusca(proc.processoNovo ?? '');

      const numeroMatch = (() => {
        if (!termoNumero) return false;
        if (buscaProcCurta) return procNumeroStr.includes(termoNumero);
        return numeroNovo.includes(termoNumero);
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
    return getPessoaPorIdIncluindoNovosLocais(id);
  }, [pessoa]);

  const textoQualificacao = useMemo(
    () => montarQualificacaoTexto({ nomeRazao, cnpjCpf, pessoaData: pessoaSelecionada }),
    [nomeRazao, cnpjCpf, pessoaSelecionada]
  );

  const todasPessoasCadastro = useMemo(() => getCadastroPessoasMockComNovosLocais(true), []);

  const pessoasFiltradasModal = useMemo(() => {
    const raw = String(buscaPessoaModal ?? '').trim();
    if (!raw) return { tipo: 'vazio', lista: [], limitado: false };
    const soNum = /^[\d.\s/-]+$/.test(raw);
    const t = normalizarTextoBusca(raw);
    const tNum = normalizarNumeroBusca(raw);
    if (!soNum && t.length < 2) return { tipo: 'curto', lista: [], limitado: false };
    if (soNum && tNum.length < 1) return { tipo: 'curto', lista: [], limitado: false };

    const out = [];
    const limite = 400;
    for (const p of todasPessoasCadastro) {
      if (out.length >= limite) break;
      const idStr = String(p.id);
      const nome = normalizarTextoBusca(p.nome ?? '');
      const cpfD = normalizarNumeroBusca(p.cpf ?? '');
      let ok = false;
      if (soNum) {
        ok = idStr.startsWith(tNum) || cpfD.includes(tNum);
      } else {
        ok = nome.includes(t) || idStr.includes(tNum) || cpfD.includes(tNum);
      }
      if (ok) out.push(p);
    }
    return { tipo: 'ok', lista: out, limitado: out.length >= limite };
  }, [todasPessoasCadastro, buscaPessoaModal]);

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
    for (const [codStr, idPessoa] of Object.entries(CLIENTE_PARA_PESSOA)) {
      const pes = getPessoaPorIdIncluindoNovosLocais(idPessoa);
      const nome =
        pes?.nome?.trim() || `Pessoa nº ${idPessoa} (sem nome no cadastro)`;
      out.push({
        codigoPadded: padCliente8(codStr),
        codigoNum: Number(codStr),
        nome,
      });
    }
    out.sort((a, b) => a.codigoNum - b.codigoNum);
    return out;
  }, []);

  const clientesFiltradosPorNome = useMemo(() => {
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

  function selecionarClienteDaBuscaNome(row) {
    aplicarCodigoCliente(row.codigoPadded);
    setBuscaClienteNome('');
  }

  return (
    <div className="min-h-full bg-slate-200 flex flex-col">
      {erroApiCliente ? (
        <div className="mx-4 mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {erroApiCliente}
        </div>
      ) : null}
      <header className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-300 shrink-0">
        <h1 className="text-lg font-bold text-slate-800">Cadastro de Clientes</h1>
      </header>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-auto p-4 space-y-4">
          <section>
            <p className="text-sm font-medium text-slate-700 mb-2">Buscar cliente por nome</p>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <label className="text-sm text-slate-700 whitespace-nowrap" htmlFor="busca-cliente-nome">
                Pesquisar:
              </label>
              <input
                id="busca-cliente-nome"
                type="text"
                value={buscaClienteNome}
                onChange={(e) => setBuscaClienteNome(e.target.value)}
                className={`${inputClass} w-full min-w-[200px] max-w-md`}
                placeholder="Nome ou parte do nome do cliente…"
                autoComplete="off"
              />
            </div>
            {String(buscaClienteNome ?? '').trim() && normalizarTextoBusca(buscaClienteNome).length < 2 && (
              <p className="text-xs text-slate-500 mb-2">
                Digite pelo menos 2 letras para buscar pelo nome (razão social ou nome da pessoa vinculada).
              </p>
            )}
            {normalizarTextoBusca(buscaClienteNome).length >= 2 && clientesFiltradosPorNome.length === 0 && (
              <p className="text-sm text-slate-600 mb-2">Nenhum cliente encontrado com esse nome.</p>
            )}
            {clientesFiltradosPorNome.length > 0 && (
              <div className="border border-slate-300 rounded bg-white overflow-x-auto max-h-56 overflow-y-auto">
                <table className="w-full text-sm border-collapse min-w-[480px]">
                  <thead>
                    <tr className="bg-slate-100 sticky top-0">
                      <th className="border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-700 w-28">
                        Código
                      </th>
                      <th className="border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-700">
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
                        className={`cursor-pointer hover:bg-blue-50 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                        }`}
                      >
                        <td className="border-b border-slate-100 px-2 py-1.5 text-slate-800 font-mono tabular-nums whitespace-nowrap">
                          {row.codigoPadded}
                        </td>
                        <td className="border-b border-slate-100 px-2 py-1.5 text-slate-800">{row.nome}</td>
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
          </section>

          <section className="flex flex-wrap items-end gap-4 border-t border-slate-200 pt-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-0.5">Próximo cliente:</label>
              <p
                role="button"
                tabIndex={0}
                title="Duplo clique para carregar o formulário com este número de cliente"
                className="text-sm text-slate-800 px-1 py-1.5 bg-transparent cursor-pointer select-none rounded hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 font-mono tabular-nums"
                onDoubleClick={() => {
                  aplicarCodigoCliente(obterProximoCodigoClienteSugerido());
                  setPaginaProcessos(1);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    aplicarCodigoCliente(obterProximoCodigoClienteSugerido());
                    setPaginaProcessos(1);
                  }
                }}
              >
                {proximoCliente}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-0.5">Código:</label>
              <div className="flex border border-slate-300 rounded overflow-hidden bg-white w-56">
                <button
                  type="button"
                  className="w-8 py-1.5 border-r border-slate-300 hover:bg-slate-100 text-slate-700 flex items-center justify-center"
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
                  className="flex-1 px-2 py-1.5 text-sm font-mono text-center border-0 bg-white"
                />
                <button
                  type="button"
                  className="w-8 py-1.5 border-l border-slate-300 hover:bg-slate-100 text-slate-700 flex items-center justify-center"
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
                  className={`p-2 rounded border ${
                    edicaoDesabilitada
                      ? 'border-slate-200 bg-slate-100 cursor-not-allowed opacity-60'
                      : 'border-slate-300 bg-white hover:bg-slate-50'
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
                    const fromCod = getIdPessoaPorCodCliente(padCliente8(codigo));
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
                className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
              >
                Cadastro de Pessoas
              </button>
              <button
                type="button"
                onClick={abrirContaCorrenteProcZero}
                className="px-3 py-2 rounded border border-sky-300 bg-white text-slate-800 text-sm hover:bg-sky-50"
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
                className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
              >
                Qualificação
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
                title="Documentos do cliente"
              >
                <FolderOpen className="w-4 h-4 shrink-0 text-slate-600" aria-hidden />
                Documentos
              </button>
              <button
                type="button"
                onClick={() => setModalConfigCalculoAberto(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded border border-indigo-200 bg-indigo-50 text-indigo-900 text-sm hover:bg-indigo-100"
                title="Padrões de juros, multa, honorários, índice e periodicidade para os cálculos deste cliente"
              >
                <SlidersHorizontal className="w-4 h-4 shrink-0" aria-hidden />
                Configurações de cálculo
              </button>
              <button
                type="button"
                onClick={() => navigate('/configuracoes')}
                className="inline-flex items-center gap-2 px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
                title="Preferências gerais do aplicativo"
              >
                <Settings className="w-4 h-4 text-slate-600 shrink-0" aria-hidden />
                Config. aplicativo
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={edicaoDesabilitada} onChange={(e) => setEdicaoDesabilitada(e.target.checked)} className="rounded border-slate-300" />
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
                className="rounded border-slate-300"
              />
              Cliente Inativo
            </label>
          </section>

          <section>
            <label className="block text-sm font-medium text-slate-700 mb-0.5">Observação:</label>
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} className={`${inputClass} resize-y`} />
          </section>

          <section className="border-t border-slate-200 pt-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Processo:</p>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <label className="text-sm text-slate-700">Pesquisar:</label>
              <input type="text" value={pesquisaProcesso} onChange={(e) => setPesquisaProcesso(e.target.value)} className={`${inputClass} w-64`} placeholder="Buscar processo..." />
              <button type="button" className="p-2 rounded border border-slate-300 bg-white hover:bg-slate-50"><Search className="w-4 h-4 text-slate-600" /></button>
              <button type="button" className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50">Pesquisa</button>
              <button
                type="button"
                onClick={handleIncluirNovoProcesso}
                disabled={edicaoDesabilitada}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded border text-sm font-medium ${
                  edicaoDesabilitada
                    ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'border-emerald-600 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
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
            <div className="overflow-x-auto border border-slate-300 rounded bg-white">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 w-24 whitespace-nowrap">Proc.</th>
                    <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[100px]">N.º Processo Velho:</th>
                    <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[180px]">N.º Processo Novo:</th>
                    <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[180px]">Parte Oposta:</th>
                    <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[180px]">Descrição da Ação:</th>
                    <th className="border border-slate-300 px-2 py-1.5 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {processosPagina.map((proc, idx) => (
                    <tr
                      key={proc.id}
                      className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} cursor-pointer hover:bg-blue-50`}
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-white"
                  title="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden />
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={paginaProcessos >= totalPaginasProcessos}
                  onClick={() => setPaginaProcessos((p) => Math.min(totalPaginasProcessos, p + 1))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-white"
                  title="Próxima página"
                >
                  Próximo
                  <ChevronRight className="w-4 h-4 shrink-0" aria-hidden />
                </button>
              </div>
            </div>
          </section>

          <div className="flex justify-center pt-2">
            <button type="button" className="px-6 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50" onClick={() => window.history.back()}>
              Fechar
            </button>
          </div>
        </div>

        {/* Seção “Controle” removida para eliminar o painel lateral solicitado. */}
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
                placeholder="Nome, código ou CPF/CNPJ…"
                className={inputClass}
              />
              <p className="text-xs text-slate-500">
                Digite pelo menos 2 letras no nome, ou use apenas números para código ou documento. Clique numa linha
                para definir esta pessoa como cliente.
              </p>
            </div>
            <div className="flex-1 min-h-0 overflow-auto px-4 pb-4">
              {pessoasFiltradasModal.tipo === 'vazio' && (
                <p className="text-sm text-slate-500 py-6 text-center">Digite para filtrar o cadastro de pessoas.</p>
              )}
              {pessoasFiltradasModal.tipo === 'curto' && (
                <p className="text-sm text-amber-800 py-6 text-center">
                  Digite pelo menos 2 letras no nome, ou busque por números (código da pessoa ou CPF/CNPJ).
                </p>
              )}
              {pessoasFiltradasModal.tipo === 'ok' && pessoasFiltradasModal.lista.length === 0 && (
                <p className="text-sm text-slate-600 py-6 text-center">Nenhuma pessoa encontrada.</p>
              )}
              {pessoasFiltradasModal.tipo === 'ok' && pessoasFiltradasModal.lista.length > 0 && (
                <>
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
