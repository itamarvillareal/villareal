import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getLancamentosContaCorrente, mergeContaCorrenteComLinhaOrigem } from '../data/financeiroData';
import { carregarResumoContaCorrenteProcesso } from '../repositories/financeiroRepository.js';
import {
  UFS,
  CIDADES_POR_UF,
  FASES,
  COMPETENCIAS,
  TRAMITACAO_OPCOES,
  gerarMockProcesso,
  normalizarCliente,
  normalizarProcesso,
  padCliente,
} from '../data/processosDadosRelatorio';
import { getCadastroPessoasMock } from '../data/cadastroPessoasMock';
import { getIdPessoaPorCodCliente } from '../data/clientesCadastradosMock';
import { getImovelMock, getImoveisMockTotal } from '../data/imoveisMockData';
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
import { getPerfilAtivoParaPermissoes } from '../data/usuarioPermissoesStorage.js';
import { getNomeExibicaoUsuario } from '../data/usuarioDisplayHelpers.js';
import {
  X,
  FolderOpen,
  Calendar,
  MapPin,
  Calculator,
  ChevronUp,
  ChevronDown,
  Search,
  Newspaper,
  ListTodo,
  Hand,
  PenLine,
} from 'lucide-react';
import { ModalRelatorioPublicacoesProcesso } from './ModalRelatorioPublicacoesProcesso.jsx';
import { ModalCriarTarefaContextual } from './ModalCriarTarefaContextual.jsx';
import { buildContextFromProcesso, buildContextFromProcessoComPrazoFatal } from '../data/tarefasContextualPayload.js';
import { featureFlags } from '../config/featureFlags.js';
import {
  buscarClientePorCodigo,
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
  upsertPrazoFatalProcesso,
  alterarAtivoProcesso,
} from '../repositories/processosRepository.js';

const HISTORICO_POR_PAGINA = 10;

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
function buscarVinculoImovelMock(codigoCliente, processo) {
  const codNum = Number(String(codigoCliente ?? '').replace(/\D/g, ''));
  const procNum = Number(processo ?? 0);
  if (!Number.isFinite(codNum) || !Number.isFinite(procNum) || codNum <= 0 || procNum <= 0) return null;
  const total = Number(getImoveisMockTotal?.() ?? 45);
  for (let id = 1; id <= total; id++) {
    const m = getImovelMock(id);
    if (!m) continue;
    const codMock = Number(String(m.codigo ?? '').replace(/\D/g, ''));
    const procMock = Number(m.proc ?? 0);
    if (codMock === codNum && procMock === procNum) {
      return { imovelId: id, unidade: String(m.unidade ?? '') };
    }
  }
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

function Field({ label, children, className = '', title }) {
  return (
    <div className={className} title={title}>
      <label className="block text-sm font-medium text-slate-700 mb-0.5">{label}</label>
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
  /** Abre Conta Corrente em modo Proc. 0 quando o Financeiro envia proc 0 (mensalista). Declarado cedo para o efeito abaixo. */
  const [contaCorrenteModo, setContaCorrenteModo] = useState('processo');
  const [modalContaCorrente, setModalContaCorrente] = useState(false);
  const [resumoContaCorrenteApi, setResumoContaCorrenteApi] = useState(null);
  const [resumoContaCorrenteApiErro, setResumoContaCorrenteApiErro] = useState('');
  const [modalRelatorioPublicacoes, setModalRelatorioPublicacoes] = useState(false);
  const [modalTarefaContextual, setModalTarefaContextual] = useState(null);

  useEffect(() => {
    if (codClienteFromState) setCodigoCliente(codClienteFromState);
    if (procFromState !== '') {
      const num = parseInt(String(procFromState), 10);
      if (!Number.isNaN(num) && num === 0) {
        setContaCorrenteModo('proc0');
        setModalContaCorrente(true);
      } else {
        setProcesso(Number.isNaN(num) ? 1 : Math.max(1, num));
      }
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
  const audienciaHoraInputRef = useRef(null);
  const [avisoAudiencia, setAvisoAudiencia] = useState('nao_avisado');
  const [prazoFatal, setPrazoFatal] = useState('');
  const [unidadeEndereco, setUnidadeEndereco] = useState('Unidade QD.06 LT.06');
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
  const [historico, setHistorico] = useState(() => gerarHistoricoMock('1', 1));
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
  const [apiLoading, setApiLoading] = useState(false);
  const [apiSaving, setApiSaving] = useState(false);
  const [apiError, setApiError] = useState('');
  const [historicoExternoTick, setHistoricoExternoTick] = useState(0);

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
    setPessoasCadastro(getCadastroPessoasMock(true));
  }, []);

  useEffect(() => {
    return () => {
      try {
        window.localStorage.setItem('vilareal:processos:edicao-desabilitada-ao-sair:v1', 'true');
      } catch (_) {
        /* ignore */
      }
    };
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
    const registroPersistido = getRegistroProcesso(mock.codigoCliente, mock.processo);
    const r = registroPersistido;
    const papelDefault = mock.parteRequerido ? 'requerido' : 'requerente';
    const papelSalvo = pickCampoStrSalvo(r, 'papelParte', '');
    const papelFinal = papelSalvo === 'requerente' || papelSalvo === 'requerido' ? papelSalvo : papelDefault;

    setCliente(pickCampoStrSalvo(r, 'cliente', mock.cliente));
    setParteCliente(pickCampoStrSalvo(r, 'parteCliente', mock.parteCliente));
    setParteClienteIds(registroPersistido?.parteClienteIds ?? []);
    setParteOpostaIds(registroPersistido?.parteOpostaIds ?? []);
    setStatusAtivo(pickCampoBoolSalvo(r, 'statusAtivo', mock.statusAtivo));
    setPapelParte(papelFinal);
    setCompetencia(pickCampoStrSalvo(r, 'competencia', mock.competencia));
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
    setPastaArquivo(pickCampoStrSalvo(r, 'pastaArquivo', ''));
    setResponsavel(pickCampoStrSalvo(r, 'responsavel', ''));
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

    const nav = typeof location.state === 'object' && location.state ? location.state : null;
    const navImovelNum =
      nav?.imovelId != null && String(nav.imovelId).trim() !== ''
        ? Number(String(nav.imovelId).replace(/\D/g, ''))
        : NaN;
    const codNavPad =
      nav?.codCliente != null && String(nav.codCliente).trim() !== '' ? padCliente(nav.codCliente) : '';
    const procNavStr =
      nav?.proc !== undefined && nav?.proc !== null && String(nav.proc).trim() !== ''
        ? String(normalizarProcesso(nav.proc))
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

    const idImovelNum = Number(String(nextImovelIdStr).replace(/\D/g, ''));
    const mockDoImovel =
      Number.isFinite(idImovelNum) && idImovelNum > 0 ? getImovelMock(idImovelNum) : null;

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
              : 'Unidade QD.06 LT.06';
    setUnidadeEndereco(mergedUnidade);

    const historicoPersistido = getHistoricoDoProcesso(mock.codigoCliente, mock.processo);
    setPrazoFatal(registroPersistido?.prazoFatal ?? '');
    const payloadFormBase = {
      codCliente: mock.codigoCliente,
      proc: mock.processo,
      cliente: pickCampoStrSalvo(r, 'cliente', mock.cliente),
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
      parteClienteIds: registroPersistido?.parteClienteIds ?? [],
      parteOpostaIds: registroPersistido?.parteOpostaIds ?? [],
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
          faseSelecionada: mock.faseSelecionada,
        });
      }
    } else {
      const historicoInicial = gerarHistoricoMock(mock.codigoCliente, mock.processo);
      setHistorico(historicoInicial);
      seedHistoricoDoProcesso({
        ...payloadFormBase,
        historico: historicoInicial,
        faseSelecionada: fasePersistida,
      });
    }
    setPaginaHistorico(1);
    setInformacaoModal(null);
  }, [codigoCliente, processo, location.key, location.state, historicoExternoTick]);

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

  const vinculoImovelMock = useMemo(() => {
    const codNum = Number(String(codigoCliente ?? '').replace(/\D/g, ''));
    const procNum = Number(processo ?? 0);
    if (!Number.isFinite(codNum) || !Number.isFinite(procNum) || codNum <= 0 || procNum <= 0) return null;

    const total = Number(getImoveisMockTotal?.() ?? 45);
    for (let id = 1; id <= total; id++) {
      const mock = getImovelMock(id);
      if (!mock) continue;
      const codMock = Number(String(mock.codigo ?? '').replace(/\D/g, ''));
      const procMock = Number(mock.proc ?? 0);
      if (codMock === codNum && procMock === procNum) {
        return { imovelId: id, unidade: String(mock.unidade ?? '') };
      }
    }
    return null;
  }, [codigoCliente, processo]);

  useEffect(() => {
    if (vinculoImovelMock) {
      if (!imovelManual && !String(imovelId ?? '').trim()) setImovelId(String(vinculoImovelMock.imovelId));
      if (!unidadeEnderecoManual && !String(unidadeEndereco ?? '').trim()) {
        setUnidadeEndereco(String(vinculoImovelMock.unidade ?? ''));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vinculoImovelMock]);

  function handleImovelIdBlur(e) {
    const idNum = Number(String(e.target.value ?? '').replace(/\D/g, ''));
    if (!Number.isFinite(idNum) || idNum <= 0) return;
    const m = getImovelMock(idNum);
    if (!m || unidadeEnderecoManual) return;
    setUnidadeEndereco(String(m.unidade ?? ''));
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
      window.alert('Informe o nº do imóvel (cadastro Administração de Imóveis → Imóveis) ou vincule cliente/proc. a um imóvel no mock.');
      return;
    }

    const mock = getImovelMock(idNum);
    let unidadeTrim = String(unidadeEndereco ?? '').trim();
    if (!unidadeTrim && mock) {
      unidadeTrim = String(mock.unidade ?? '').trim();
      if (unidadeTrim) setUnidadeEndereco(unidadeTrim);
    }

    /** Abre sempre a rota Imóveis com o id; a tela carrega o mock ou formulário vazio. */
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

  function salvarAgendaEmLote() {
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
    const usuariosAlvo = [
      { id: 'itamar', nome: 'Dr. Itamar' },
      { id: 'karla', nome: 'Karla' },
      { id: 'isabella', nome: 'Isabella' },
      { id: 'thalita', nome: 'Thalita' },
    ];

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
    // fecha após pequeno feedback visual.
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

  async function carregarProcessoApiAtual() {
    if (!featureFlags.useApiProcessos) return;
    setApiLoading(true);
    setApiError('');
    try {
      const resolvedId = await resolverProcessoId({
        processoId: processoApiId,
        codigoCliente,
        numeroInterno: processo,
      });
      const procApi = resolvedId ? await buscarProcessoPorId(resolvedId) : await buscarProcessoPorChaveNatural(codigoCliente, processo);
      if (!procApi) {
        setProcessoApiId(null);
        setClienteProcessoApiId(null);
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
      setNumeroProcessoNovo(mapped.numeroProcessoNovo || numeroProcessoNovo);
      setNumeroProcessoVelho(mapped.numeroProcessoVelho || numeroProcessoVelho);
      setNaturezaAcao(mapped.naturezaAcao || naturezaAcao);
      setCompetencia(mapped.competencia || competencia);
      setFaseSelecionada(mapped.faseSelecionada || faseSelecionada);
      setStatusAtivo(mapped.statusAtivo);
      setPrazoFatal(mapped.prazoFatal || prazoFatal);
      setObservacao(mapped.observacao || observacao);
      setDataProtocolo(mapped.dataProtocolo || dataProtocolo);
      setEstado(mapped.estado || estado);
      setCidade(mapped.cidade || cidade);
      setConsultaAutomatica(mapped.consultaAutomatica);
      setTramitacao(mapped.tramitacao || tramitacao);
      setResponsavel(mapped.responsavel || responsavel);

      const partes = await listarPartesProcesso(procApi.id);
      const idsCliente = [];
      const idsOposta = [];
      const nomesCliente = [];
      const nomesOposta = [];
      for (const p of partes || []) {
        const polo = String(p.polo || '').toUpperCase();
        const alvoCliente = polo.includes('AUTOR') || polo.includes('REQUERENTE') || polo.includes('CLIENTE');
        const alvoOposta = !alvoCliente;
        const nome = p.nomeExibicao || p.nomeLivre || '';
        if (alvoCliente) {
          if (p.pessoaId) idsCliente.push(Number(p.pessoaId));
          if (nome) nomesCliente.push(nome);
        }
        if (alvoOposta) {
          if (p.pessoaId) idsOposta.push(Number(p.pessoaId));
          if (nome) nomesOposta.push(nome);
        }
      }
      if (idsCliente.length) setParteClienteIds(idsCliente);
      if (idsOposta.length) setParteOpostaIds(idsOposta);
      if (nomesCliente.length) setParteCliente(formatarListaComConjuncaoE(nomesCliente));
      if (nomesOposta.length) setParteOposta(formatarListaComConjuncaoE(nomesOposta));

      const andamentos = await listarAndamentosProcesso(procApi.id);
      if (Array.isArray(andamentos) && andamentos.length > 0) {
        const hist = andamentos.map((a, idx) => mapApiAndamentoToHistoricoItem(a, idx, andamentos.length));
        setHistorico(hist);
      }
    } catch (e) {
      setApiError(e?.message || 'Falha ao carregar processo da API.');
    } finally {
      setApiLoading(false);
    }
  }

  async function sincronizarApiProcessoAtual(
    overrides = {},
    options = { syncPartes: false, syncAndamentos: false, syncPrazoFatal: true }
  ) {
    if (!featureFlags.useApiProcessos || edicaoDesabilitada) return;
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
      if (pid && options.syncPartes) {
        await sincronizarPartesIncremental(pid, [
          ...((snapshot.parteClienteIds || []).map((id, ordem) => ({
            pessoaId: Number(id),
            nomeLivre: null,
            polo: 'AUTOR',
            qualificacao: 'Parte cliente',
            ordem,
          }))),
          ...((snapshot.parteOpostaIds || []).map((id, ordem) => ({
            pessoaId: Number(id),
            nomeLivre: null,
            polo: 'REU',
            qualificacao: 'Parte oposta',
            ordem,
          }))),
          ...(snapshot.parteClienteIds?.length ? [] : [{
            pessoaId: null,
            nomeLivre: snapshot.parteCliente || null,
            polo: 'AUTOR',
            qualificacao: 'Parte cliente',
            ordem: 0,
          }]),
          ...(snapshot.parteOpostaIds?.length ? [] : [{
            pessoaId: null,
            nomeLivre: snapshot.parteOposta || null,
            polo: 'REU',
            qualificacao: 'Parte oposta',
            ordem: 0,
          }]),
        ]);
      }
      if (pid && options.syncAndamentos) {
        await sincronizarAndamentosIncremental(pid, snapshot.historico || []);
      }
      if (pid && options.syncPrazoFatal) {
        await upsertPrazoFatalProcesso(pid, snapshot.prazoFatal);
      }
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
    imovelId,
    unidadeEndereco,
    proximaInformacao,
    dataProximaInformacao,
  ]);

  useEffect(() => {
    if (edicaoDesabilitadaAnteriorRef.current === false && edicaoDesabilitada === true) {
      if (featureFlags.useApiProcessos) {
        void sincronizarApiProcessoAtual();
      } else {
        salvarHistoricoDoProcesso(montarPayloadRegistroProcesso());
      }
    }
    edicaoDesabilitadaAnteriorRef.current = edicaoDesabilitada;
  }, [edicaoDesabilitada]);

  /** Nº da pessoa no Cadastro de Pessoas (vínculo código cliente → pessoa); senão, IDs vinculados em Parte Cliente. */
  const textoNumeroPessoaCliente = useMemo(() => {
    const idCadastro = getIdPessoaPorCodCliente(codigoCliente);
    if (idCadastro != null) return String(idCadastro);
    const ids = Array.isArray(parteClienteIds)
      ? parteClienteIds.filter((x) => x != null && Number(x) > 0)
      : [];
    if (ids.length) return ids.map(String).join(', ');
    return '—';
  }, [codigoCliente, parteClienteIds]);

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
    if (featureFlags.useApiProcessos) {
      void sincronizarApiProcessoAtual({
        parteCliente: pcNome || parteCliente,
        parteOposta: poNome || parteOposta,
        parteClienteIds: nextClienteIds,
        parteOpostaIds: nextOpostaIds,
      }, { syncPartes: true, syncAndamentos: false, syncPrazoFatal: false });
    } else {
      salvarHistoricoDoProcesso(
        montarPayloadRegistroProcesso({
          parteCliente: pcNome || parteCliente,
          parteOposta: poNome || parteOposta,
          parteClienteIds: nextClienteIds,
          parteOpostaIds: nextOpostaIds,
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

  // Agendamento automático na Agenda sempre que o usuário preencher uma data válida
  // no formulário de Audiência (somente com edição habilitada).
  useEffect(() => {
    if (edicaoDesabilitada) return;
    if (!audienciaData) return;
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(audienciaData)) return;
    agendarAudienciaParaTodosUsuarios({
      audienciaData,
      audienciaHora,
      audienciaTipo,
      numeroProcessoNovo,
    });
  }, [audienciaData, audienciaHora, audienciaTipo, numeroProcessoNovo, edicaoDesabilitada]);

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

  return (
    <div className="min-h-full bg-slate-200">
      <div className="max-w-[1400px] mx-auto px-3 py-3">
        {/* Cabeçalho: Processos + X */}
        <header className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h1 className="text-xl font-bold text-slate-800">Processos</h1>
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
            onClick={() => window.history.back()}
            className="p-2 rounded border border-slate-400 bg-white text-slate-600 hover:bg-slate-100 shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </header>
        {featureFlags.useApiProcessos && apiLoading ? (
          <div className="mb-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Carregando processo pela API...
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

        <div
          className={`rounded border shadow-sm overflow-hidden ${
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
          <div className="p-4 space-y-4">
            {/* Seção superior: 3 colunas - Identificação | Partes/Local | Papel/Fase/Status */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Coluna esquerda: Código + Processo na mesma linha, Cliente, Edição, Nº velho/novo */}
              <div className="space-y-2">
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
                  <Field label="Nº pessoa (cliente)">
                    <div
                      className="min-w-[4.75rem] px-2 py-1.5 text-sm font-mono tabular-nums text-center border border-slate-300 rounded bg-slate-50 text-slate-800"
                      title="Identificação no Cadastro de Pessoas vinculada a este código de cliente; se não houver mapeamento, exibe o(s) ID(s) da Parte Cliente."
                    >
                      {textoNumeroPessoaCliente}
                    </div>
                  </Field>
                </div>
                <Field label="Cliente">
                  <input
                    type="text"
                    value={cliente}
                    readOnly={camposBloqueados}
                    onChange={(e) => setCliente(e.target.value)}
                    className={clsCampo}
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={edicaoDesabilitada} onChange={(e) => setEdicaoDesabilitada(e.target.checked)} className="rounded border-slate-300" />
                  Edição Desabilitada
                </label>
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
                      disabled={camposBloqueados}
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
                      disabled={camposBloqueados}
                      className="px-2 py-1.5 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50"
                    >
                      Pessoas
                    </button>
                  </div>
                </Field>
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
                <Field label="Estado">
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
                <Field label="Cidade">
                  {camposBloqueados ? (
                    <input type="text" readOnly value={cidade} className={clsCampo} title={cidade} />
                  ) : (
                    <select value={cidade} onChange={(e) => setCidade(e.target.value)} className={inputClass}>
                      {cidades.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>

              {/* Coluna direita: Papel, Status, Fase (caixa) */}
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Cliente é Requerente ou Requerido?</p>
                  {camposBloqueados ? (
                    <input
                      type="text"
                      readOnly
                      value={papelParte === 'requerente' ? 'Requerente' : 'Requerido'}
                      className={clsCampo}
                    />
                  ) : (
                    <select value={papelParte} onChange={(e) => setPapelParte(e.target.value)} className={inputClass}>
                      <option value="requerente">Requerente</option>
                      <option value="requerido">Requerido</option>
                    </select>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Status</p>
                  <div className="flex gap-4">
                    <label className={`flex items-center gap-1.5 text-sm ${camposBloqueados ? 'cursor-default' : 'cursor-pointer'}`}>
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
                    <label className={`flex items-center gap-1.5 text-sm ${camposBloqueados ? 'cursor-default' : 'cursor-pointer'}`}>
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
                <div className="border border-slate-300 rounded p-2 bg-slate-50/50">
                  <p className="text-sm font-medium text-slate-700 mb-1.5">Fase</p>
                  <div className="space-y-0.5">
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
                  <input
                    type="text"
                    value={dataProtocolo}
                    readOnly={camposBloqueados}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDataProtocolo(resolverAliasHojeEmTexto(v, 'br') ?? v);
                    }}
                    placeholder="dd/mm/aaaa ou hj"
                    className={clsCampo}
                  />
                </Field>
                <Field label="Pasta do Arquivo">
                  <input
                    type="text"
                    value={pastaArquivo}
                    readOnly={camposBloqueados}
                    onChange={(e) => setPastaArquivo(e.target.value)}
                    className={clsCampo}
                  />
                </Field>
                <Field label="Responsável">
                  <input
                    type="text"
                    value={responsavel}
                    readOnly={camposBloqueados}
                    onChange={(e) => setResponsavel(e.target.value)}
                    className={clsCampo}
                  />
                </Field>
                <Field label="Valor da Causa">
                  <input
                    type="text"
                    value={valorCausa}
                    readOnly={camposBloqueados}
                    onChange={(e) => setValorCausa(e.target.value)}
                    className={clsCampo}
                  />
                </Field>
                <Field label="Natureza da Ação" className="col-span-2 md:col-span-4">
                  <input
                    type="text"
                    value={naturezaAcao}
                    readOnly={camposBloqueados}
                    onChange={(e) => setNaturezaAcao(e.target.value)}
                    className={clsCampo}
                  />
                </Field>
                <Field label="Procedimento">
                  <input
                    type="text"
                    value={procedimento}
                    readOnly={camposBloqueados}
                    onChange={(e) => setProcedimento(e.target.value)}
                    className={clsCampo}
                  />
                </Field>
                <Field label="Competência" className="col-span-2 md:col-span-2">
                  <div className="flex gap-1">
                    {camposBloqueados ? (
                      <input type="text" readOnly value={competencia} className={`flex-1 ${clsCampo}`} title={competencia} />
                    ) : (
                      <select value={competencia} onChange={(e) => setCompetencia(e.target.value)} className={`flex-1 ${inputClass}`}>
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
                      className="p-1.5 rounded border border-slate-300 hover:bg-slate-100 shrink-0 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <Search className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                </Field>
                <Field label="Fase">
                  <input
                    type="text"
                    value={faseCampo}
                    readOnly={camposBloqueados}
                    onChange={(e) => setFaseCampo(e.target.value)}
                    className={clsCampo}
                  />
                </Field>
                <Field label="Observação" className="col-span-2 md:col-span-4">
                  <textarea
                    value={observacao}
                    readOnly={camposBloqueados}
                    onChange={(e) => setObservacao(e.target.value)}
                    rows={3}
                    className={`${clsCampo} resize-y`}
                  />
                </Field>
                <div className="col-span-2 md:col-span-4 flex flex-wrap items-end gap-3">
                  <button
                    type="button"
                    onClick={abrirLinkPastaArquivo}
                    className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
                  >
                    Link p/ pasta
                  </button>
                  <Field label="Periodicidade Consulta" className="w-36">
                    {camposBloqueados ? (
                      <input type="text" readOnly value={periodicidadeConsulta || '—'} className={clsCampo} title={periodicidadeConsulta} />
                    ) : (
                      <select value={periodicidadeConsulta} onChange={(e) => setPeriodicidadeConsulta(e.target.value)} className={inputClass}>
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
                    className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
                  >
                    Tramitação
                  </button>
                  <span className="text-xs text-slate-600">
                    Tramitação: {tramitacao || '—'}
                  </span>
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
                      // Se ficou completo, normaliza para padrão dd/mm/aaaa.
                      const norm = normalizarDataBr(audienciaData);
                      if (norm) setAudienciaData(norm);
                    }}
                    placeholder="dd/mm/aaaa ou hj"
                    className={clsCampo}
                  />
                </Field>
                <Field label="Hora" className="w-24">
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
                <Field label="Tipo" className="w-32">
                  <input
                    type="text"
                    value={audienciaTipo}
                    readOnly={camposBloqueados}
                    onChange={(e) => setAudienciaTipo(e.target.value)}
                    className={clsCampo}
                  />
                </Field>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-700">Aviso de Audiência</span>
                  <label className={`flex items-center gap-1.5 text-sm ${camposBloqueados ? 'cursor-default' : 'cursor-pointer'}`}>
                    <input
                      type="radio"
                      name="aviso"
                      checked={avisoAudiencia === 'avisado'}
                      disabled={camposBloqueados}
                      onChange={() => setAvisoAudiencia('avisado')}
                      className="text-slate-600"
                    />
                    Avisado
                  </label>
                  <label className={`flex items-center gap-1.5 text-sm ${camposBloqueados ? 'cursor-default' : 'cursor-pointer'}`}>
                    <input
                      type="radio"
                      name="aviso"
                      checked={avisoAudiencia === 'nao_avisado'}
                      disabled={camposBloqueados}
                      onChange={() => setAvisoAudiencia('nao_avisado')}
                      className="text-slate-600"
                    />
                    Não Avisado
                  </label>
                </div>
                <div className="w-36 space-y-1">
                  <Field label="Prazo Fatal" className="w-full">
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
                      className={clsCampo}
                    />
                  </Field>
                  {featureFlags.useApiTarefas && String(prazoFatal ?? '').trim() ? (
                    <button
                      type="button"
                      onClick={abrirModalTarefaComPrazoFatal}
                      className="text-[11px] text-emerald-800 hover:underline text-left w-full"
                      title="Abre criação de tarefa com data limite sugerida a partir do prazo fatal"
                    >
                      Criar tarefa com esta data
                    </button>
                  ) : null}
                </div>
              </div>
            </section>

            {/* Ações: Pagamentos, Agenda Em lote, Abrir Imóvel, Unidade (único campo), Cálculos */}
            <section className="flex flex-wrap items-end gap-4 border-t border-slate-200 pt-4">
              <p className="w-full text-[11px] text-slate-500 leading-snug -mb-1">
                O <strong>nº Imóvel</strong> e a <strong>Unidade</strong> são os mesmos dados do cadastro <strong>Imóveis</strong> no menu
                lateral. Ao sair do campo Imóvel, a unidade é preenchida automaticamente pelo cadastro quando estiver vazia.
              </p>
              <button
                type="button"
                onClick={() =>
                  navigate('/calculos', {
                    state: {
                      codCliente: String(codigoCliente ?? ''),
                      proc: String(processo ?? ''),
                      abaCalculos: 'Pagamento',
                    },
                  })
                }
                className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
              >
                Pagamentos
              </button>
              <button
                type="button"
                disabled={camposBloqueados}
                onClick={abrirAgendaEmLote}
                className="inline-flex items-center gap-2 px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
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
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
              >
                <MapPin className="w-4 h-4" /> Abrir Imóvel
              </button>
              <Field
                label="Unidade"
                className="flex-1 min-w-[200px]"
                title="Descrição da unidade no cadastro de Imóveis (preenchida automaticamente pelo nº do imóvel, se vazia)."
              >
                <input
                  type="text"
                  value={unidadeEndereco}
                  readOnly={camposBloqueados}
                  onChange={(e) => {
                    setUnidadeEndereco(e.target.value);
                    setUnidadeEnderecoManual(true);
                  }}
                  className={clsCampo}
                  placeholder="(vazio)"
                />
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
            <section ref={abasProcessoRef} className="border-t border-slate-200 pt-4">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-tramitacao-titulo"
          onClick={() => setModalTramitacaoAberto(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h2 id="modal-tramitacao-titulo" className="text-base font-semibold text-slate-800">
                Tramitação dos Autos
              </h2>
              <button
                type="button"
                onClick={() => setModalTramitacaoAberto(false)}
                className="p-2 rounded text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-acoes-redacao-titulo"
          onClick={() => setModalAcoesRedacaoAberto(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md flex flex-col max-h-[min(90vh,28rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
              <h2 id="modal-acoes-redacao-titulo" className="text-base font-semibold text-slate-800 pr-2">
                Tipo de ação
              </h2>
              <button
                type="button"
                onClick={() => setModalAcoesRedacaoAberto(false)}
                className="p-2 rounded text-slate-500 hover:bg-slate-100 shrink-0"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-agenda-lote-titulo"
          onClick={() => setModalAgendaLoteAberto(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h2 id="modal-agenda-lote-titulo" className="text-base font-semibold text-slate-800">
                Agendamento em lote
              </h2>
              <button
                type="button"
                className="p-2 rounded text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
                onClick={() => setModalAgendaLoteAberto(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="text-sm text-slate-600">
                Este compromisso será lançado para <strong>Dr. Itamar</strong>, <strong>Karla</strong> e <strong>Ana Luisa</strong>.
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Texto do compromisso</label>
                <textarea
                  value={agendaLoteTexto}
                  onChange={(e) => setAgendaLoteTexto(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
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
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
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
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
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
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
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
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalAgendaLoteAberto(false)}
                className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarAgendaEmLote}
                className="px-4 py-2 rounded border border-blue-600 bg-blue-600 text-white text-sm hover:bg-blue-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Janela Conta Corrente: lançamentos dos extratos vinculados a cliente + proc. (Financeiro) */}
      {modalContaCorrente && (() => {
        const processoContaCorrenteEfetivo = contaCorrenteModo === 'proc0' ? 0 : processo;
        const base = getLancamentosContaCorrente(codigoCliente, processoContaCorrenteEfetivo);
        const { lancamentos, soma } = mergeContaCorrenteComLinhaOrigem(
          base.lancamentos,
          base.soma,
          linhaOrigemContaCorrente,
          codigoCliente,
          processoContaCorrenteEfetivo
        );
        const somaApi = featureFlags.useApiFinanceiro && Number(processoApiId)
          ? Number(resumoContaCorrenteApi?.saldo ?? soma)
          : soma;
        const somaFormatada = formatValorContaCorrente(somaApi);
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
                Conta Corrente – Cliente {codigoCliente}
                {contaCorrenteModo === 'proc0' ? ', Processo 0 (mensalista / geral)' : processo ? `, Processo ${processo}` : ''}
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
            <p className="text-xs text-slate-600 px-4 py-2 border-b border-slate-200 bg-emerald-50/50 shrink-0">
              Origem: lançamentos dos <strong>extratos bancários</strong> no Financeiro com os mesmos{' '}
              <strong>Cod. Cliente</strong> e <strong>Proc.</strong> deste processo (inclui qualquer letra contábil, ex.: A, N),
              como após vincular pelo número do processo ou editar o extrato.
            </p>
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
    </div>
  );
}
