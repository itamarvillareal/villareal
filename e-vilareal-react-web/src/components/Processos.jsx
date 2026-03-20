import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getLancamentosContaCorrente, mergeContaCorrenteComLinhaOrigem } from '../data/financeiroData';
import { getMockProcesso10x10 } from '../data/processosMock';
import { getCadastroPessoasMock } from '../data/cadastroPessoasMock';
import {
  getHistoricoDoProcesso,
  getRegistroProcesso,
  normalizarDataBr,
  salvarHistoricoDoProcesso,
  salvarPrazoFatalDoProcesso,
  seedHistoricoDoProcesso,
} from '../data/processosHistoricoData';
import { agendarAudienciaParaTodosUsuarios } from '../data/agendaPersistenciaData';
import {
  X,
  FolderOpen,
  Calendar,
  MapPin,
  Calculator,
  ChevronUp,
  ChevronDown,
  Search,
} from 'lucide-react';

const UFS = [
  { sigla: 'GO', nome: 'GOIÁS' },
  { sigla: 'SP', nome: 'SÃO PAULO' },
  { sigla: 'MG', nome: 'MINAS GERAIS' },
  { sigla: 'RJ', nome: 'RIO DE JANEIRO' },
  { sigla: 'PI', nome: 'PIAUÍ' },
];

const CIDADES_POR_UF = {
  GO: ['RIO VERDE', 'GOIÂNIA', 'ANÁPOLIS', 'APARECIDA DE GOIÂNIA'],
  SP: ['SÃO PAULO', 'CAMPINAS', 'RIBEIRÃO PRETO'],
  MG: ['BELO HORIZONTE', 'UBERLÂNDIA'],
  RJ: ['RIO DE JANEIRO', 'NITERÓI'],
  PI: ['TERESINA', 'PARNÁIBA'],
};

const FASES = [
  'Ag. Documentos',
  'Ag. Peticionar',
  'Ag. Verificação',
  'Protocolo / Movimentação',
  'Aguardando Providência',
  'Procedimento Adm.',
  'Em Andamento',
];

const COMPETENCIAS = [
  '1º JUIZADO ESPECIAL CÍVEL',
  '2º JUIZADO ESPECIAL CÍVEL',
  '3º JUIZADO ESPECIAL CÍVEL',
  'VARA CÍVEL',
];

const HISTORICO_POR_PAGINA = 10;

function gerarHistoricoMock(codigoCliente, processo) {
  const c = Number(normalizarCliente(codigoCliente));
  const p = Number(normalizarProcesso(processo));
  const usuarios = ['KARLA', 'MARIA', 'JOÃO', 'PAULO', 'ANA'];
  const tipos = [
    'DESPACHO',
    'JUNTADA',
    'INTIMAÇÃO',
    'AUDIÊNCIA',
    'CITAÇÃO',
    'PETIÇÃO',
    'DECISÃO',
    'CERTIDÃO',
    'DISTRIBUIÇÃO',
    'PROTOCOLO',
  ];

  // “Seed” determinístico para variar por cliente/processo
  let seed = (c * 1103515245 + p * 12345) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  const total = 18 + ((c + p) % 8); // 18–25 itens
  const baseDia = 1 + ((c + p) % 20);
  const baseMes = 1 + ((c * 3 + p) % 12);
  const baseAno = 2025;

  const rows = [];
  for (let i = 0; i < total; i++) {
    const idx = total - i; // “Inf.” decrescendo
    const dia = String(((baseDia + i) % 28) + 1).padStart(2, '0');
    const mes = String(((baseMes + Math.floor(i / 6)) % 12) + 1).padStart(2, '0');
    const ano = String(baseAno);
    const usuario = usuarios[Math.floor(rand() * usuarios.length)];
    const tipo = tipos[Math.floor(rand() * tipos.length)];
    const num = String(idx).padStart(4, '0');
    const detalhe = `Cliente ${String(c).padStart(3, '0')} / Proc ${String(p).padStart(2, '0')}`;
    rows.push({
      id: Number(`${c}${p}${idx}`),
      inf: String(idx).padStart(2, '0'),
      info: `${tipo}: atualização mock (${detalhe})`,
      data: `${dia}/${mes}/${ano}`,
      usuario,
      numero: num,
    });
  }
  return rows;
}

function normalizarCliente(val) {
  const s = String(val ?? '').trim();
  if (!s) return '1';
  const n = Number(s);
  if (Number.isNaN(n) || n < 1) return '1';
  return String(n);
}

function normalizarProcesso(val) {
  const s = String(val ?? '').trim();
  if (!s) return 1;
  const n = Number(s);
  if (Number.isNaN(n) || n < 1) return 1;
  return Math.floor(n);
}

function padCliente(val) {
  const n = Number(normalizarCliente(val));
  return String(n).padStart(8, '0');
}

function apenasDigitos(val) {
  return String(val ?? '').replace(/\D/g, '');
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

function gerarMockProcesso(codigoCliente, processo) {
  const c = Number(normalizarCliente(codigoCliente));
  const p = Number(normalizarProcesso(processo));
  const mock10 = getMockProcesso10x10(c, p);
  if (mock10) {
    const uf = UFS[(c - 1) % UFS.length]?.sigla ?? 'GO';
    const cidade = (CIDADES_POR_UF[uf] || ['RIO VERDE'])[p % (CIDADES_POR_UF[uf]?.length || 1)] || 'RIO VERDE';
    const fase = FASES[(c + p) % FASES.length] ?? 'Em Andamento';
    const competencia = COMPETENCIAS[(p - 1) % COMPETENCIAS.length] ?? '2º JUIZADO ESPECIAL CÍVEL';
    return {
      codigoCliente: mock10.codigoCliente,
      processo: mock10.processo,
      cliente: mock10.autor,
      parteCliente: mock10.parteCliente,
      parteOposta: mock10.parteOposta,
      estado: uf,
      cidade,
      faseSelecionada: fase,
      competencia,
      numeroProcessoVelho: mock10.numeroProcessoVelho,
      numeroProcessoNovo: mock10.numeroProcessoNovo,
      statusAtivo: (c + p) % 3 !== 0,
      parteRequerente: (c + p) % 3 === 0,
      parteRevel: (c + p) % 3 === 1,
      parteRequerido: (c + p) % 3 === 2,
      dataProtocolo: `${String(((p - 1) % 28) + 1).padStart(2, '0')}/${String(((c - 1) % 12) + 1).padStart(2, '0')}/2025`,
      naturezaAcao: `AÇÃO (MOCK) — Cliente ${c} / Proc ${p}`,
      valorCausa: `${(1000 + c * 37 + p * 41).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      consultaAutomatica: (c + p) % 2 === 0,
      observacao: `Dados mock do Processo.\nCliente: ${c}\nProcesso: ${p}`,
    };
  }
  const uf = UFS[(c - 1) % UFS.length]?.sigla ?? 'GO';
  const cidade = (CIDADES_POR_UF[uf] || ['RIO VERDE'])[p % (CIDADES_POR_UF[uf]?.length || 1)] || 'RIO VERDE';
  const fase = FASES[(c + p) % FASES.length] ?? 'Em Andamento';
  const competencia = COMPETENCIAS[(p - 1) % COMPETENCIAS.length] ?? '2º JUIZADO ESPECIAL CÍVEL';
  const cliente = `CLIENTE ${String(c).padStart(3, '0')} (MOCK)`;
  const parteCliente = `PARTE CLIENTE ${String(c).padStart(3, '0')} — PROC ${String(p).padStart(2, '0')}`;
  const parteOposta = `PARTE OPOSTA ${String((c * 7 + p) % 999).padStart(3, '0')} — PROC ${String(p).padStart(2, '0')}`;
  const numeroProcessoNovo = `${String(5000000 + c * 13 + p).slice(0, 7)}-${String(10 + (p % 90)).padStart(2, '0')}.2025.8.09.${String(1000 + (c % 900)).slice(-4)}`;
  return {
    codigoCliente: padCliente(c),
    processo: p,
    cliente,
    parteCliente,
    parteOposta,
    estado: uf,
    cidade,
    faseSelecionada: fase,
    competencia,
    numeroProcessoVelho: '',
    numeroProcessoNovo,
    statusAtivo: (c + p) % 3 !== 0,
    parteRequerente: (c + p) % 3 === 0,
    parteRevel: (c + p) % 3 === 1,
    parteRequerido: (c + p) % 3 === 2,
    dataProtocolo: `${String(((p - 1) % 28) + 1).padStart(2, '0')}/${String(((c - 1) % 12) + 1).padStart(2, '0')}/2025`,
    naturezaAcao: `AÇÃO (MOCK) — Cliente ${c} / Proc ${p}`,
    valorCausa: `${(1000 + c * 37 + p * 41).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    consultaAutomatica: (c + p) % 2 === 0,
    observacao: `Dados mock do Processo.\nCliente: ${c}\nProcesso: ${p}`,
  };
}

function formatValorContaCorrente(v) {
  const s = Math.abs(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return v < 0 ? `-${s}` : s;
}

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-0.5">{label}</label>
      {children}
    </div>
  );
}

export function Processos() {
  const location = useLocation();
  const navigate = useNavigate();
  const stateFromFinanceiro = location.state && typeof location.state === 'object' ? location.state : null;
  const codClienteFromState = stateFromFinanceiro?.codCliente ?? '';
  const procFromState = stateFromFinanceiro?.proc ?? '';

  const [codigoCliente, setCodigoCliente] = useState('00000001');
  const [cliente, setCliente] = useState('CONDOMINIO sasaf');
  const [processo, setProcesso] = useState(4);
  /** Lançamento do duplo clique no extrato consolidado (Financeiro → Processos). */
  const [linhaOrigemContaCorrente, setLinhaOrigemContaCorrente] = useState(null);

  useEffect(() => {
    if (codClienteFromState) setCodigoCliente(codClienteFromState);
    if (procFromState !== '') {
      const num = parseInt(procFromState, 10);
      setProcesso(Number.isNaN(num) ? 1 : Math.max(1, num));
    }
  }, [codClienteFromState, procFromState]);

  useEffect(() => {
    const s = location.state && typeof location.state === 'object' ? location.state : null;
    setLinhaOrigemContaCorrente(s?.contaCorrenteLinha ?? null);
  }, [location.key, location.pathname, location.state]);
  const [parteCliente, setParteCliente] = useState('MARIANA PERES DE SOUZA ALVES');
  const [edicaoDesabilitada, setEdicaoDesabilitada] = useState(true);
  const [parteOposta, setParteOposta] = useState('CONDOMINIO PORTAL DOS YPES 3 - CASAS FLAMBOYNAT');
  const [pessoasCadastro, setPessoasCadastro] = useState([]);
  const [parteClienteIds, setParteClienteIds] = useState([]);
  const [parteOpostaIds, setParteOpostaIds] = useState([]);
  const [modalVinculoPartes, setModalVinculoPartes] = useState(null); // cliente | oposta | null
  const [buscaPessoaVinculo, setBuscaPessoaVinculo] = useState('');
  const [selecionadasModalIds, setSelecionadasModalIds] = useState([]);
  const [numeroProcessoVelho, setNumeroProcessoVelho] = useState('');
  const [numeroProcessoNovo, setNumeroProcessoNovo] = useState('5602801-26.2025.8.09.0137');
  const [consultaAutomatica, setConsultaAutomatica] = useState(false);
  const [estado, setEstado] = useState('GO');
  const [cidade, setCidade] = useState('RIO VERDE');
  const [dataProtocolo, setDataProtocolo] = useState('30/07/2025');
  const [pastaArquivo, setPastaArquivo] = useState('');
  const [naturezaAcao, setNaturezaAcao] = useState('PEDIDO DE DANO MORAL POR CONSTRIÇÃO');
  const [valorCausa, setValorCausa] = useState('20.000,00');
  const [procedimento, setProcedimento] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [competencia, setCompetencia] = useState('2º JUIZADO ESPECIAL CÍVEL');
  const [observacao, setObservacao] = useState('Bloqueio de valores na conta.\nhttps://us05web.zoom.us/j/5523109318?pwd=K2ZMQlh6TmNobFJUUKRUMIFBZHRZQT09.\nPode contestar 15 dias após a audiência');
  const [periodicidadeConsulta, setPeriodicidadeConsulta] = useState('');
  const [papelParte, setPapelParte] = useState('requerente');
  const [faseSelecionada, setFaseSelecionada] = useState('Em Andamento');
  const [statusAtivo, setStatusAtivo] = useState(true);
  const [faseCampo, setFaseCampo] = useState('');
  const [audienciaData, setAudienciaData] = useState('');
  const [audienciaHora, setAudienciaHora] = useState('');
  const [audienciaTipo, setAudienciaTipo] = useState('');
  const [avisoAudiencia, setAvisoAudiencia] = useState('nao_avisado');
  const [prazoFatal, setPrazoFatal] = useState('');
  const [unidade, setUnidade] = useState('');
  const [unidadeEndereco, setUnidadeEndereco] = useState('Unidade QD.06 LT.06');
  const [tabAtiva, setTabAtiva] = useState('historico');
  const [historico, setHistorico] = useState(() => gerarHistoricoMock('1', 1));
  const [proximaInformacao, setProximaInformacao] = useState('');
  const [dataProximaInformacao, setDataProximaInformacao] = useState('');
  const [paginaHistorico, setPaginaHistorico] = useState(1);
  const [informacaoModal, setInformacaoModal] = useState(null);
  const [modalContaCorrente, setModalContaCorrente] = useState(false);
  const [sortContaCorrente, setSortContaCorrente] = useState({ col: 'data', dir: 'desc' });
  const [buscaContaCorrente, setBuscaContaCorrente] = useState({ campo: 'todos', termo: '' });

  useEffect(() => {
    setPessoasCadastro(getCadastroPessoasMock(true));
  }, []);

  // Mantém Processo sempre >= 1
  useEffect(() => {
    setProcesso((p) => Math.max(1, Number(p) || 1));
  }, []);

  // Atualiza campos com dados mock ao mudar cliente ou processo
  useEffect(() => {
    const procNorm = normalizarProcesso(processo);
    if (procNorm !== processo) setProcesso(procNorm);

    const mock = gerarMockProcesso(codigoCliente, procNorm);
    // Não sobrescreve o código vindo de outras telas; mantém exatamente o código em tela.
    setCliente(mock.cliente);
    setParteCliente(mock.parteCliente);
    setParteOposta(mock.parteOposta);
    const registroPersistido = getRegistroProcesso(mock.codigoCliente, mock.processo);
    setParteClienteIds(registroPersistido?.parteClienteIds ?? []);
    setParteOpostaIds(registroPersistido?.parteOpostaIds ?? []);
    setNumeroProcessoVelho(mock.numeroProcessoVelho);
    setNumeroProcessoNovo(mock.numeroProcessoNovo);
    setStatusAtivo(mock.statusAtivo);
    setPapelParte(mock.parteRequerido ? 'requerido' : 'requerente');
    setCompetencia(mock.competencia);
    const fasePersistida =
      registroPersistido?.faseSelecionada != null && String(registroPersistido.faseSelecionada).trim() !== ''
        ? registroPersistido.faseSelecionada
        : mock.faseSelecionada;
    setFaseSelecionada(fasePersistida);
    setConsultaAutomatica(mock.consultaAutomatica);
    setDataProtocolo(mock.dataProtocolo);
    setNaturezaAcao(mock.naturezaAcao);
    setValorCausa(mock.valorCausa);
    setObservacao(mock.observacao);
    setEstado(mock.estado);
    setCidade(mock.cidade);

    const historicoPersistido = getHistoricoDoProcesso(mock.codigoCliente, mock.processo);
    setPrazoFatal(registroPersistido?.prazoFatal ?? '');
    if (historicoPersistido.length > 0) {
      setHistorico(historicoPersistido);
      if (!String(registroPersistido?.faseSelecionada ?? '').trim()) {
        salvarHistoricoDoProcesso({
          codCliente: mock.codigoCliente,
          proc: mock.processo,
          cliente: mock.cliente,
          parteCliente: mock.parteCliente,
          parteOposta: mock.parteOposta,
          numeroProcessoNovo: mock.numeroProcessoNovo,
          historico: historicoPersistido,
          prazoFatal: registroPersistido?.prazoFatal ?? '',
          parteClienteIds: registroPersistido?.parteClienteIds ?? [],
          parteOpostaIds: registroPersistido?.parteOpostaIds ?? [],
          faseSelecionada: mock.faseSelecionada,
        });
      }
    } else {
      const historicoInicial = gerarHistoricoMock(mock.codigoCliente, mock.processo);
      setHistorico(historicoInicial);
      seedHistoricoDoProcesso({
        codCliente: mock.codigoCliente,
        proc: mock.processo,
        cliente: mock.cliente,
        parteCliente: mock.parteCliente,
        parteOposta: mock.parteOposta,
        numeroProcessoNovo: mock.numeroProcessoNovo,
        historico: historicoInicial,
        prazoFatal: registroPersistido?.prazoFatal ?? '',
        parteClienteIds: registroPersistido?.parteClienteIds ?? [],
        parteOpostaIds: registroPersistido?.parteOpostaIds ?? [],
        faseSelecionada: fasePersistida,
      });
    }
    setPaginaHistorico(1);
    setInformacaoModal(null);
  }, [codigoCliente, processo]);

  useEffect(() => {
    if (modalContaCorrente) setSortContaCorrente({ col: 'data', dir: 'desc' });
  }, [modalContaCorrente, codigoCliente, processo]);

  useEffect(() => {
    if (modalContaCorrente) setBuscaContaCorrente({ campo: 'todos', termo: '' });
  }, [modalContaCorrente, codigoCliente, processo]);

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

  function handleDuploCliqueTituloContaCorrente(col) {
    setSortContaCorrente((prev) => ({
      col,
      dir: prev.col === col ? (prev.dir === 'asc' ? 'desc' : 'asc') : (col === 'data' ? 'asc' : 'asc'),
    }));
  }

  function normalizarTextoBusca(s) {
    return String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  const pessoasPorId = useMemo(() => {
    const m = new Map();
    for (const p of pessoasCadastro || []) {
      m.set(Number(p.id), p);
    }
    return m;
  }, [pessoasCadastro]);

  const textoParteCliente = useMemo(() => {
    if (!parteClienteIds.length) return parteCliente;
    const nomes = parteClienteIds
      .map((id) => pessoasPorId.get(Number(id)))
      .filter(Boolean)
      .map((p) => p.nome);
    return formatarListaComConjuncaoE(nomes);
  }, [parteClienteIds, pessoasPorId, parteCliente]);

  const textoParteOposta = useMemo(() => {
    if (!parteOpostaIds.length) return parteOposta;
    const nomes = parteOpostaIds
      .map((id) => pessoasPorId.get(Number(id)))
      .filter(Boolean)
      .map((p) => p.nome);
    return formatarListaComConjuncaoE(nomes);
  }, [parteOpostaIds, pessoasPorId, parteOposta]);

  const pessoasFiltradasVinculo = useMemo(() => {
    const t = normalizarTextoBusca(buscaPessoaVinculo);
    if (!t) return pessoasCadastro;
    return (pessoasCadastro || []).filter((p) => {
      const id = String(p.id ?? '');
      const nome = normalizarTextoBusca(p.nome);
      const cpf = String(p.cpf ?? '');
      return id.includes(t) || nome.includes(t) || cpf.includes(t);
    });
  }, [pessoasCadastro, buscaPessoaVinculo]);

  function abrirModalVinculoPartes(tipo) {
    setModalVinculoPartes(tipo);
    setBuscaPessoaVinculo('');
    setSelecionadasModalIds(tipo === 'cliente' ? [...parteClienteIds] : [...parteOpostaIds]);
  }

  function alternarSelecaoPessoaModal(id) {
    setSelecionadasModalIds((prev) => {
      const n = Number(id);
      if (prev.includes(n)) return prev.filter((x) => x !== n);
      return [...prev, n];
    });
  }

  function salvarVinculoPartes() {
    const nextClienteIds = modalVinculoPartes === 'cliente' ? [...selecionadasModalIds] : [...parteClienteIds];
    const nextOpostaIds = modalVinculoPartes === 'oposta' ? [...selecionadasModalIds] : [...parteOpostaIds];
    if (modalVinculoPartes === 'cliente') setParteClienteIds(nextClienteIds);
    if (modalVinculoPartes === 'oposta') setParteOpostaIds(nextOpostaIds);
    setModalVinculoPartes(null);

    const pcNome = formatarListaComConjuncaoE(
      nextClienteIds.map((id) => pessoasPorId.get(Number(id))?.nome).filter(Boolean)
    );
    const poNome = formatarListaComConjuncaoE(
      nextOpostaIds.map((id) => pessoasPorId.get(Number(id))?.nome).filter(Boolean)
    );
    const pf = String(prazoFatal ?? '').trim();
    const prazoNorm = pf ? (normalizarDataBr(pf) || pf) : '';
    salvarHistoricoDoProcesso({
      codCliente: codigoCliente,
      proc: processo,
      cliente,
      parteCliente: pcNome || parteCliente,
      parteOposta: poNome || parteOposta,
      numeroProcessoNovo,
      historico,
      prazoFatal: prazoNorm,
      parteClienteIds: nextClienteIds,
      parteOpostaIds: nextOpostaIds,
      faseSelecionada,
    });
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
    if (!info) return;
    const data = String(dataProximaInformacao ?? '').trim() || hojeBr();
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
      usuario: 'USUÁRIO',
      numero: String(novoNumero).padStart(4, '0'),
    };
    const historicoAtualizado = [novoItem, ...historico];
    setHistorico(historicoAtualizado);
    setPaginaHistorico(1);
    setProximaInformacao('');
    setDataProximaInformacao('');
    const pf = String(prazoFatal ?? '').trim();
    const prazoNorm = pf ? (normalizarDataBr(pf) || pf) : '';
    salvarHistoricoDoProcesso({
      codCliente: codigoCliente,
      proc: processo,
      cliente,
      parteCliente: textoParteCliente || parteCliente,
      parteOposta: textoParteOposta || parteOposta,
      numeroProcessoNovo,
      historico: historicoAtualizado,
      prazoFatal: prazoNorm,
      parteClienteIds,
      parteOpostaIds,
      faseSelecionada,
    });
  }

  function persistirPrazoFatalAposEdicao(valorBruto) {
    const t = String(valorBruto ?? '').trim();
    const prazoNorm = t ? (normalizarDataBr(t) || t) : '';
    setPrazoFatal(prazoNorm);
    salvarPrazoFatalDoProcesso(codigoCliente, processo, prazoNorm, {
      cliente,
      parteCliente: textoParteCliente || parteCliente,
      parteOposta: textoParteOposta || parteOposta,
      numeroProcessoNovo,
      parteClienteIds,
      parteOpostaIds,
      faseSelecionada,
    });
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

  const inputClass = "w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white";
  const inputDisabledClass = "w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-slate-50";

  // Agendamento automático na Agenda sempre que o usuário preencher uma data válida
  // no formulário de Audiência.
  useEffect(() => {
    if (!audienciaData) return;
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(audienciaData)) return;
    agendarAudienciaParaTodosUsuarios({
      audienciaData,
      audienciaHora,
      audienciaTipo,
      numeroProcessoNovo,
    });
  }, [audienciaData, audienciaHora, audienciaTipo, numeroProcessoNovo]);

  function formatarDataAudienciaInput(valor) {
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
    // Máscara simples para manter no formato HH:MM
    // Exemplos:
    // - "9"    -> "09"
    // - "930"  -> "09:30"
    // - "0930" -> "09:30"
    const digits = String(valor ?? '').replace(/\D/g, '').slice(0, 4);
    if (!digits) return '';
    if (digits.length === 1) return `0${digits}`;
    if (digits.length === 2) return digits;
    if (digits.length === 3) {
      const hh = `0${digits[0]}`;
      const mm = digits.slice(1, 3);
      return `${hh}:${mm}`;
    }
    const hh = digits.slice(0, 2);
    const mm = digits.slice(2, 4);
    return `${hh}:${mm}`;
  }

  function normalizarHoraAudiencia(valor) {
    const digits = String(valor ?? '').replace(/\D/g, '');
    if (!digits) return '';
    let hhStr = '';
    let mmStr = '';
    if (digits.length <= 2) {
      hhStr = String(digits.padStart(2, '0')).slice(0, 2);
      mmStr = '00';
    } else if (digits.length === 3) {
      hhStr = `0${digits[0]}`;
      mmStr = digits.slice(1, 3);
    } else {
      hhStr = digits.slice(0, 2);
      mmStr = digits.slice(2, 4);
    }
    const hh = Number(hhStr);
    const mm = Number(mmStr);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return '';
    if (hh < 0 || hh > 23) return '';
    if (mm < 0 || mm > 59) return '';
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  return (
    <div className="min-h-full bg-slate-200">
      <div className="max-w-[1400px] mx-auto px-3 py-3">
        {/* Cabeçalho: Processos + X */}
        <header className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-slate-800">Processos</h1>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="p-2 rounded border border-slate-400 bg-white text-slate-600 hover:bg-slate-100"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div
          className={`rounded border shadow-sm overflow-hidden ${
            isProtocoloMovimentacao
              ? 'bg-black border-slate-700 text-slate-100'
              : isAgPeticionar
                ? 'bg-red-200 border-red-400'
                : isAgDocumentos
                  ? 'bg-yellow-200 border-yellow-400'
                  : isAgVerificacao
                    ? 'bg-purple-200 border-purple-400'
                    : 'bg-white border-slate-300'
          }`}
        >
          <div className="p-4 space-y-4">
            {/* Seção superior: 3 colunas - Identificação | Partes/Local | Papel/Fase/Status */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Coluna esquerda: Código + Processo na mesma linha, Cliente, Edição, Nº velho/novo */}
              <div className="space-y-2">
                <div className="flex items-end gap-3">
                  <Field label="Código do Cliente">
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
                        className="w-20 px-1 py-1 text-sm text-center border-0"
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
                  <Field label="Processo">
                    <div className="flex border border-slate-300 rounded overflow-hidden w-20">
                      <button type="button" className="p-1 hover:bg-slate-100" onClick={() => setProcesso((p) => Math.max(1, (Number(p) || 1) - 1))}><ChevronUp className="w-3 h-3" /></button>
                      <input type="number" min={1} step={1} value={processo} onChange={(e) => setProcesso(Math.max(1, Number(e.target.value) || 1))} className="w-10 px-0 py-1 text-sm text-center border-0" />
                      <button type="button" className="p-1 hover:bg-slate-100" onClick={() => setProcesso((p) => p + 1)}><ChevronDown className="w-3 h-3" /></button>
                    </div>
                  </Field>
                </div>
                <Field label="Cliente">
                  <input type="text" value={cliente} onChange={(e) => setCliente(e.target.value)} disabled={edicaoDesabilitada} className={edicaoDesabilitada ? inputDisabledClass : inputClass} />
                </Field>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={edicaoDesabilitada} onChange={(e) => setEdicaoDesabilitada(e.target.checked)} className="rounded border-slate-300" />
                  Edição Desabilitada
                </label>
                <Field label="Nº Processo Velho">
                  <input type="text" value={numeroProcessoVelho} onChange={(e) => setNumeroProcessoVelho(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Nº Processo Novo">
                  <div className="flex gap-1">
                    <input type="text" value={numeroProcessoNovo} onChange={(e) => setNumeroProcessoNovo(e.target.value)} className={`flex-1 ${inputClass}`} />
                    <button type="button" className="p-1.5 rounded border border-slate-300 hover:bg-slate-100" title="Documentos"><FolderOpen className="w-4 h-4 text-slate-600" /></button>
                  </div>
                </Field>
              </div>

              {/* Coluna central: Parte Cliente, Parte Oposta, Consulta, Estado, Cidade */}
              <div className="space-y-2">
                <Field label="Parte Cliente">
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={textoParteCliente}
                      readOnly
                      className={inputDisabledClass}
                      title={textoParteCliente}
                    />
                    <button
                      type="button"
                      onClick={() => abrirModalVinculoPartes('cliente')}
                      disabled={edicaoDesabilitada}
                      className="px-2 py-1.5 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50"
                    >
                      Pessoas
                    </button>
                  </div>
                </Field>
                <Field label="Parte Oposta">
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={textoParteOposta}
                      readOnly
                      className={inputDisabledClass}
                      title={textoParteOposta}
                    />
                    <button
                      type="button"
                      onClick={() => abrirModalVinculoPartes('oposta')}
                      disabled={edicaoDesabilitada}
                      className="px-2 py-1.5 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50"
                    >
                      Pessoas
                    </button>
                  </div>
                </Field>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={consultaAutomatica} onChange={(e) => setConsultaAutomatica(e.target.checked)} className="rounded border-slate-300" />
                  Consulta Automática
                </label>
                <Field label="Estado">
                  <div className="flex gap-1">
                    <select value={estado} onChange={(e) => { setEstado(e.target.value); setCidade((CIDADES_POR_UF[e.target.value] || [])[0] || ''); }} className={`flex-1 ${inputClass}`}>
                      {UFS.map((u) => (<option key={u.sigla} value={u.sigla}>{u.sigla}</option>))}
                    </select>
                    <input type="text" value={ufAtual?.nome ?? ''} readOnly className="w-24 px-2 py-1.5 border border-slate-300 rounded text-sm bg-slate-50" />
                  </div>
                </Field>
                <Field label="Cidade">
                  <select value={cidade} onChange={(e) => setCidade(e.target.value)} className={inputClass}>
                    {cidades.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </Field>
              </div>

              {/* Coluna direita: Papel, Status, Fase (caixa) */}
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Cliente é Requerente ou Requerido?</p>
                  <select
                    value={papelParte}
                    onChange={(e) => setPapelParte(e.target.value)}
                    className={inputClass}
                  >
                    <option value="requerente">Requerente</option>
                    <option value="requerido">Requerido</option>
                  </select>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Status</p>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" name="status" checked={statusAtivo} onChange={() => setStatusAtivo(true)} className="text-slate-600" />
                      Ativo
                    </label>
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="radio" name="status" checked={!statusAtivo} onChange={() => setStatusAtivo(false)} className="text-slate-600" />
                      Inativo
                    </label>
                  </div>
                </div>
                <div className="border border-slate-300 rounded p-2 bg-slate-50/50">
                  <p className="text-sm font-medium text-slate-700 mb-1.5">Fase</p>
                  <div className="space-y-0.5">
                    {FASES.map((f) => (
                      <label key={f} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="fase"
                          checked={faseSelecionada === f}
                          onChange={() => {
                            setFaseSelecionada(f);
                            const pf = String(prazoFatal ?? '').trim();
                            const prazoNorm = pf ? (normalizarDataBr(pf) || pf) : '';
                            salvarHistoricoDoProcesso({
                              codCliente: codigoCliente,
                              proc: processo,
                              cliente,
                              parteCliente: textoParteCliente || parteCliente,
                              parteOposta: textoParteOposta || parteOposta,
                              numeroProcessoNovo,
                              historico,
                              prazoFatal: prazoNorm,
                              parteClienteIds,
                              parteOpostaIds,
                              faseSelecionada: f,
                            });
                          }}
                          className="text-slate-600"
                        />
                        {f}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Seção central: Detalhes do caso - grid compacto */}
            <section className="border-t border-slate-200 pt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                <Field label="Data do Protocolo" className="w-36">
                  <input type="text" value={dataProtocolo} onChange={(e) => setDataProtocolo(e.target.value)} placeholder="dd/mm/aaaa" className={inputClass} />
                </Field>
                <Field label="Pasta do Arquivo">
                  <input type="text" value={pastaArquivo} onChange={(e) => setPastaArquivo(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Responsável">
                  <input type="text" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Valor da Causa">
                  <input type="text" value={valorCausa} onChange={(e) => setValorCausa(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Natureza da Ação" className="col-span-2 md:col-span-4">
                  <input type="text" value={naturezaAcao} onChange={(e) => setNaturezaAcao(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Procedimento">
                  <input type="text" value={procedimento} onChange={(e) => setProcedimento(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Competência" className="col-span-2 md:col-span-2">
                  <div className="flex gap-1">
                    <select value={competencia} onChange={(e) => setCompetencia(e.target.value)} className={`flex-1 ${inputClass}`}>
                      {COMPETENCIAS.map((c) => (<option key={c} value={c}>{c}</option>))}
                    </select>
                    <button type="button" className="p-1.5 rounded border border-slate-300 hover:bg-slate-100 shrink-0"><Search className="w-4 h-4 text-slate-600" /></button>
                  </div>
                </Field>
                <Field label="Fase">
                  <input type="text" value={faseCampo} onChange={(e) => setFaseCampo(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Observação" className="col-span-2 md:col-span-4">
                  <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} className={`${inputClass} resize-y`} />
                </Field>
                <div className="col-span-2 md:col-span-4 flex flex-wrap items-end gap-3">
                  <button type="button" className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50">Link p/ pasta</button>
                  <Field label="Periodicidade Consulta" className="w-36">
                    <select value={periodicidadeConsulta} onChange={(e) => setPeriodicidadeConsulta(e.target.value)} className={inputClass}>
                      <option value="">—</option>
                    </select>
                  </Field>
                  <button type="button" className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50">
                    Tramitação
                  </button>
                </div>
              </div>
            </section>

            {/* Seção Audiência */}
            <section className="border border-slate-300 rounded p-3 bg-slate-50/30 border-t border-slate-200 pt-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Audiência</p>
              <div className="flex flex-wrap items-end gap-4">
                <Field label="Data" className="w-28">
                  <input
                    type="text"
                    value={audienciaData}
                    onChange={(e) => setAudienciaData(formatarDataAudienciaInput(e.target.value))}
                    onDoubleClick={() => {
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
                      // Se ficou completo, normaliza para padrão dd/mm/aaaa.
                      const norm = normalizarDataBr(audienciaData);
                      if (norm) setAudienciaData(norm);
                    }}
                    placeholder="dd/mm/aaaa"
                    className={inputClass}
                  />
                </Field>
                <Field label="Hora" className="w-24">
                  <input
                    type="text"
                    value={audienciaHora}
                    onChange={(e) => setAudienciaHora(formatarHoraAudienciaInput(e.target.value))}
                    onBlur={() => {
                      const norm = normalizarHoraAudiencia(audienciaHora);
                      if (norm) setAudienciaHora(norm);
                    }}
                    placeholder="hh:mm"
                    className={inputClass}
                  />
                </Field>
                <Field label="Tipo" className="w-32">
                  <input type="text" value={audienciaTipo} onChange={(e) => setAudienciaTipo(e.target.value)} className={inputClass} />
                </Field>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-700">Aviso de Audiência</span>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="aviso" checked={avisoAudiencia === 'avisado'} onChange={() => setAvisoAudiencia('avisado')} className="text-slate-600" />
                    Avisado
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="aviso" checked={avisoAudiencia === 'nao_avisado'} onChange={() => setAvisoAudiencia('nao_avisado')} className="text-slate-600" />
                    Não Avisado
                  </label>
                </div>
                <Field label="Prazo Fatal" className="w-36">
                  <input
                    type="text"
                    value={prazoFatal}
                    onChange={(e) => setPrazoFatal(e.target.value)}
                    onBlur={(e) => persistirPrazoFatalAposEdicao(e.target.value)}
                    placeholder="dd/mm/aaaa"
                    title="Data vinculada ao processo (gravada automaticamente)"
                    className={inputClass}
                  />
                </Field>
              </div>
            </section>

            {/* Ações e Unidade: Pagamentos, Agenda Em lote, Abrir Imóvel, Unidade, Cálculos */}
            <section className="flex flex-wrap items-end gap-4 border-t border-slate-200 pt-4">
              <button type="button" className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50">Pagamentos</button>
              <button type="button" className="inline-flex items-center gap-2 px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50">
                <Calendar className="w-4 h-4" /> Agenda Em lote
              </button>
              <button type="button" className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"><MapPin className="w-4 h-4" /> Abrir Imóvel</button>
              <Field label="Unidade" className="w-40">
                <input type="text" value={unidade} onChange={(e) => setUnidade(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Unidade" className="flex-1 min-w-[200px]">
                <input type="text" value={unidadeEndereco} onChange={(e) => setUnidadeEndereco(e.target.value)} className={inputClass} />
              </Field>
              <button
                type="button"
                onClick={() => {
                  navigate('/calculos', { state: { codCliente: String(codigoCliente ?? ''), proc: String(processo ?? '') } });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
              >
                <Calculator className="w-4 h-4" /> Cálculos
              </button>
            </section>

            {/* Abas: Histórico do Processo | Observações | Execução */}
            <section className="border-t border-slate-200 pt-4">
              <div className="flex items-center gap-0 mb-0">
                <button type="button" onClick={() => setTabAtiva('historico')} className={`px-4 py-2 text-sm font-medium border border-slate-300 border-b-0 rounded-t ${tabAtiva === 'historico' ? 'bg-white text-slate-800 -mb-px' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  Histórico do Processo
                </button>
                <button type="button" onClick={() => setTabAtiva('observacoes')} className={`px-4 py-2 text-sm font-medium border border-slate-300 border-b-0 rounded-t ${tabAtiva === 'observacoes' ? 'bg-white text-slate-800 -mb-px' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  Observações
                </button>
                <button type="button" onClick={() => setTabAtiva('execucao')} className={`px-4 py-2 text-sm font-medium border border-slate-300 border-b-0 rounded-t ${tabAtiva === 'execucao' ? 'bg-white text-slate-800 -mb-px' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  Execução
                </button>
              </div>
              {tabAtiva === 'historico' && (
                <div className="border border-slate-300 rounded-b overflow-hidden bg-white">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-sm font-medium text-slate-700 mb-0.5">Próxima informação</label>
                      <input
                        type="text"
                        value={proximaInformacao}
                        onChange={(e) => setProximaInformacao(e.target.value)}
                        placeholder="Digite a próxima informação a ser inserida..."
                        className={inputClass}
                      />
                    </div>
                    <div className="w-36">
                      <label className="block text-sm font-medium text-slate-700 mb-0.5">Data</label>
                      <input
                        type="text"
                        value={dataProximaInformacao}
                        onChange={(e) => setDataProximaInformacao(e.target.value)}
                        placeholder="dd/mm/aaaa"
                        className={inputClass}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={manterInformacaoNoHistorico}
                      className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50 whitespace-nowrap"
                    >
                      Manter Inf.
                    </button>
                  </div>
                  <div className="overflow-x-auto overflow-y-auto min-h-[10.5rem]" style={{ minHeight: 'calc(2.5rem * 11)' }}>
                    <table className="w-full text-sm border-collapse table-fixed">
                      <thead className="bg-slate-100 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-1.5 font-semibold text-slate-700 w-14">Inf.</th>
                          <th className="text-left px-3 py-1.5 font-semibold text-slate-700 w-[40%]">Informação</th>
                          <th className="text-left px-3 py-1.5 font-semibold text-slate-700 w-24">Data</th>
                          <th className="text-left px-3 py-1.5 font-semibold text-slate-700 w-20">Usuário</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historicoPaginado.length === 0 ? (
                          <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-500">Nenhum registro.</td></tr>
                        ) : (
                          <>
                            {historicoPaginado.map((h) => (
                              <tr
                                key={h.id}
                                className="border-t border-slate-200 hover:bg-slate-50/50 cursor-pointer"
                                onDoubleClick={() => setInformacaoModal({ info: h.info, inf: h.inf, data: h.data, usuario: h.usuario })}
                                title="Duplo clique para ver o texto completo"
                              >
                                <td className="px-3 py-1.5 text-slate-700">Inf.: {h.inf}</td>
                                <td className="px-3 py-1.5 text-slate-800 overflow-hidden">
                                  <div className="truncate" title={h.info}>{h.info}</div>
                                </td>
                                <td className="px-3 py-1.5 text-slate-600">{h.data}</td>
                                <td className="px-3 py-1.5 text-slate-700">{h.usuario}</td>
                              </tr>
                            ))}
                            {historicoPaginado.length < HISTORICO_POR_PAGINA && Array.from({ length: HISTORICO_POR_PAGINA - historicoPaginado.length }).map((_, i) => (
                              <tr key={`empty-${i}`} className="border-t border-slate-100"><td colSpan={4} className="px-3 py-1.5">&nbsp;</td></tr>
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
                <div className="border border-slate-300 border-t-0 rounded-b p-4 bg-white">
                  <p className="text-sm text-slate-500">Conteúdo da aba Observações.</p>
                </div>
              )}
              {tabAtiva === 'execucao' && (
                <div className="border border-slate-300 border-t-0 rounded-b p-4 bg-white">
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
                onClick={() => setModalContaCorrente(true)}
              >
                Conta Corrente
              </button>
            </footer>
          </div>
        </div>
      </div>

      {modalVinculoPartes && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-vinculo-partes-titulo"
          onClick={() => setModalVinculoPartes(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h2 id="modal-vinculo-partes-titulo" className="text-base font-semibold text-slate-800">
                {modalVinculoPartes === 'cliente' ? 'Vincular pessoas - Parte Cliente' : 'Vincular pessoas - Parte Oposta'}
              </h2>
              <button
                type="button"
                className="p-2 rounded text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
                onClick={() => setModalVinculoPartes(null)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex-1 min-h-0 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={buscaPessoaVinculo}
                  onChange={(e) => setBuscaPessoaVinculo(e.target.value)}
                  placeholder="Buscar por código, nome ou CPF/CNPJ"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                />
              </div>
              <div className="border border-slate-300 rounded overflow-auto flex-1 min-h-[280px]">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr>
                      <th className="border-b border-slate-300 px-3 py-2 text-left w-16">Sel.</th>
                      <th className="border-b border-slate-300 px-3 py-2 text-left w-24">Código</th>
                      <th className="border-b border-slate-300 px-3 py-2 text-left">Nome</th>
                      <th className="border-b border-slate-300 px-3 py-2 text-left w-44">CPF/CNPJ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pessoasFiltradasVinculo.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                          Nenhuma pessoa encontrada para o filtro informado.
                        </td>
                      </tr>
                    ) : (
                      pessoasFiltradasVinculo.map((p, idx) => {
                        const id = Number(p.id);
                        const checked = selecionadasModalIds.includes(id);
                        return (
                          <tr
                            key={id}
                            className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} cursor-pointer hover:bg-blue-50`}
                            onClick={() => alternarSelecaoPessoaModal(id)}
                          >
                            <td className="border-t border-slate-200 px-3 py-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => alternarSelecaoPessoaModal(id)}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded border-slate-300"
                              />
                            </td>
                            <td className="border-t border-slate-200 px-3 py-2 text-slate-700">{id}</td>
                            <td className="border-t border-slate-200 px-3 py-2 text-slate-800">{p.nome}</td>
                            <td className="border-t border-slate-200 px-3 py-2 text-slate-700">{p.cpf || '—'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
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
                type="button"
                onClick={salvarVinculoPartes}
                className="px-4 py-2 rounded border border-blue-600 bg-blue-600 text-white text-sm hover:bg-blue-700"
              >
                Salvar vínculos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Janela Conta Corrente: lançamentos da Conta Contábil Conta Escritório (Financeiro) do cliente em tela */}
      {modalContaCorrente && (() => {
        const base = getLancamentosContaCorrente(codigoCliente, processo);
        const { lancamentos, soma } = mergeContaCorrenteComLinhaOrigem(
          base.lancamentos,
          base.soma,
          linhaOrigemContaCorrente,
          codigoCliente,
          processo
        );
        const somaFormatada = formatValorContaCorrente(soma);
        const listaBase = lancamentos.map((l, idx) => ({ ...l, numero: l.numero ?? (idx + 1) }));
        const listaFiltrada = filtrarLancamentosContaCorrente(listaBase, buscaContaCorrente.campo, buscaContaCorrente.termo);
        const listaOrdenada = ordenarLancamentosContaCorrente(listaFiltrada, sortContaCorrente.col, sortContaCorrente.dir);
        return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-conta-corrente-titulo"
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 shrink-0">
              <h2 id="modal-conta-corrente-titulo" className="text-base font-semibold text-slate-800">
                Conta Corrente (Conta Escritório – Cliente {codigoCliente}{processo ? `, Processo ${processo}` : ''})
              </h2>
              <button
                type="button"
                onClick={() => setModalContaCorrente(false)}
                className="p-2 rounded text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
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
                      className="flex-1 min-w-[220px] px-2 py-1 border border-slate-300 rounded text-xs bg-white"
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
                    </span>
                  </div>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 w-24 cursor-pointer hover:bg-slate-200 select-none" onDoubleClick={() => handleDuploCliqueTituloContaCorrente('data')} title="Duplo clique: ordenar">Data</th>
                        <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[180px] cursor-pointer hover:bg-slate-200 select-none" onDoubleClick={() => handleDuploCliqueTituloContaCorrente('descricao')} title="Duplo clique: ordenar">Descrição</th>
                        <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 w-24 cursor-pointer hover:bg-slate-200 select-none" onDoubleClick={() => handleDuploCliqueTituloContaCorrente('dataOuId')} title="Duplo clique: ordenar">Proc.</th>
                        <th className="border border-slate-300 px-2 py-1.5 text-right font-semibold text-slate-700 w-28 cursor-pointer hover:bg-slate-200 select-none" onDoubleClick={() => handleDuploCliqueTituloContaCorrente('valor')} title="Duplo clique: ordenar">Valor</th>
                        <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[120px] cursor-pointer hover:bg-slate-200 select-none" onDoubleClick={() => handleDuploCliqueTituloContaCorrente('nome')} title="Duplo clique: ordenar">Nome</th>
                        <th className="border border-slate-300 px-2 py-1.5 text-center font-semibold text-slate-700 w-12 cursor-pointer hover:bg-slate-200 select-none" onDoubleClick={() => handleDuploCliqueTituloContaCorrente('numero')} title="Duplo clique: ordenar">Nº</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listaOrdenada.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="border border-slate-200 px-2 py-4 text-center text-slate-500">
                            Nenhum lançamento da Conta Escritório para o cliente {codigoCliente}{processo ? ` e processo ${processo}` : ''}.
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
                </div>
              </div>
              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={() => setModalContaCorrente(false)}
                  className="px-8 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setInformacaoModal(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-informacao-titulo"
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-2xl w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h2 id="modal-informacao-titulo" className="text-sm font-semibold text-slate-800">
                Inf.: {informacaoModal.inf} — {informacaoModal.data} — {informacaoModal.usuario}
              </h2>
              <button
                type="button"
                onClick={() => setInformacaoModal(null)}
                className="p-2 rounded text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-4 overflow-y-auto flex-1">
              <p className="text-slate-800 whitespace-pre-wrap break-words">{informacaoModal.info}</p>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setInformacaoModal(null)}
                className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
