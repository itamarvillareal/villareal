import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  getExtratosIniciais,
  getTransacoesConsolidadas,
  cloneExtratos,
  buildNumeroBancoMap,
  parearCompensacaoInterbancaria,
  aplicarUmParCompensacaoInterbancaria,
  reverterUmParCompensacaoInterbancaria,
  somasPorParCompensacao,
  detectarParesCompensacao,
  loadPersistedExtratosFinanceiro,
  loadPersistedExtratosInativosFinanceiro,
  savePersistedExtratosInativosFinanceiro,
  loadPersistedContasExtrasFinanceiro,
  savePersistedContasExtrasFinanceiro,
  validarNovoNomeContaBancaria,
  proximoNumeroContaBanco,
  buildLetraToContaMerge,
  buildContaToLetraMerge,
  buildOrdemLetrasContabeisCompleta,
  loadPersistedContasContabeisExtrasFinanceiro,
  savePersistedContasContabeisExtrasFinanceiro,
  loadPersistedContasContabeisInativasFinanceiro,
  savePersistedContasContabeisInativasFinanceiro,
  validarNovoNomeContaContabil,
  proximaLetraContaContabilExtra,
  getContasContabeisDerivadasExtratos,
  filtrarTransacoesPorClienteProc,
  textoCategoriaObservacao,
  textoDimensaoEq,
  normalizarCodigoClienteFinanceiro,
  normalizarProcFinanceiro,
  normalizarRefFinanceiro,
} from '../data/financeiroData';
import { loadRodadasCalculos } from '../data/calculosRodadasStorage';
import { EVENT_FINANCEIRO_PERSISTENCIA_EXTERNA } from '../services/crossTabLocalStorageSync.js';
import {
  loadConsultasVinculoLog,
  appendConsultaVinculoLogEntry,
  persistConsultasVinculoLog,
  clearConsultasVinculoLog,
  isUsuarioMaster,
} from '../data/consultasVinculoHistoricoStorage.js';
import {
  procurarSugestoesVinculoAutomatico,
  parseRodadaKeyParaDisplay,
} from '../data/buscaParcelamentoFinanceiro';
import { parseOfxToExtrato, mergeExtratoBancario, contarLancamentosNovos } from '../utils/ofx';
import { OFX_ITAU_REAL_EXEMPLO, OFX_CORA_REAL_EXEMPLO } from '../data/ofxItauCoraReal';
import { CheckSquare, ChevronLeft, ChevronRight, Link2, Settings, Trash2, Unlink } from 'lucide-react';
import { ModalVinculoClienteProcFinanceiro } from './ModalVinculoClienteProcFinanceiro.jsx';
import { buscarClientePorCodigo, buscarProcessoPorChaveNatural } from '../repositories/processosRepository.js';
import { featureFlags } from '../config/featureFlags.js';
import {
  carregarExtratosFinanceiroApiFirst,
  removerLancamentoFinanceiroApi,
  persistirFallbackExtratos,
  salvarOuAtualizarLancamentoFinanceiroApi,
} from '../repositories/financeiroRepository.js';
import {
  executarMigracaoAssistidaPhase5Financeiro,
  getStatusMigracaoAssistidaPhase5Financeiro,
  previsualizarMigracaoAssistidaPhase5Financeiro,
} from '../services/financeiroMigrationPhase5.js';

/** Ref. exibida: só N ou R (vazio/legado → N). */
function textoRefLancamento(t) {
  return normalizarRefFinanceiro(t?.ref);
}

const OPCOES_LIMITE_LANCAMENTOS_EXTRATO = [
  { v: 25, label: '25' },
  { v: 50, label: '50' },
  { v: 100, label: '100' },
  { v: 200, label: '200' },
  { v: 500, label: '500' },
  { v: 0, label: 'Todos' },
];
function primeiraContaContabilVisivel(inativasList) {
  const inativas = new Set(inativasList);
  const extras = loadPersistedContasContabeisExtrasFinanceiro();
  const map = buildLetraToContaMerge(extras);
  for (const l of buildOrdemLetrasContabeisCompleta(extras)) {
    const n = map[l];
    if (n && !inativas.has(n)) return n;
  }
  return 'Conta Escritório';
}

/** Conta Escritório quando ativa; senão primeira conta não inativa na ordem do plano. */
function contaEscritorioOuPrimeiraAtiva(inativasSet, ordemNomes) {
  if (!inativasSet.has('Conta Escritório')) return 'Conta Escritório';
  return ordemNomes.find((n) => !inativasSet.has(n)) ?? 'Conta Escritório';
}
function getTransacoesBanco(extratosPorBanco, nomeBanco) {
  return extratosPorBanco[nomeBanco] ?? [];
}

function formatValor(v) {
  if (v === 0) return '0,00';
  const s = Math.abs(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return v < 0 ? `-${s}` : s;
}

/** Exibe data/hora da consulta de vínculo (log). */
function formatarDataHoraConsulta(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    });
  } catch {
    return String(iso);
  }
}

/** Dia civil da consulta (agrupamento ao longo dos dias). */
function formatarDiaLog(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/** Converte data DD/MM/YYYY (com ou sem zeros) para YYYY-MM-DD — ordenação correta. */
function dataParaOrdenar(data) {
  const s = String(data ?? '').trim();
  const parts = s.split('/').map((p) => String(p).trim());
  if (parts.length !== 3) return '';
  const d = parts[0].padStart(2, '0');
  const m = parts[1].padStart(2, '0');
  let a = parts[2].replace(/\D/g, '');
  if (a.length === 2) a = `20${a}`;
  if (a.length !== 4) return '';
  return `${a}-${m}-${d}`;
}

/** { dd, mm, yyyy } ou null se inválida. */
function parseDataBrParts(dataStr) {
  const s = String(dataStr ?? '').trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  let yyyy = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return { dd, mm, yyyy };
}

function coletarAnosDosExtratos(extratosPorBanco) {
  const s = new Set();
  const y0 = new Date().getFullYear();
  s.add(y0);
  for (const list of Object.values(extratosPorBanco)) {
    if (!Array.isArray(list)) continue;
    for (const t of list) {
      const p = parseDataBrParts(t?.data);
      if (p) s.add(p.yyyy);
    }
  }
  return Array.from(s).sort((a, b) => b - a);
}

function valorOrdemDataBrParts(p) {
  return p.yyyy * 10000 + p.mm * 100 + p.dd;
}

/**
 * @param {string} tipo — todos | mes | bimestre | trimestre | semestre | ano | personalizado
 * @param {object|null} sel
 */
function dataLancamentoNoPeriodo(dataStr, tipo, sel) {
  if (tipo === 'todos' || !sel) return true;
  const parts = parseDataBrParts(dataStr);
  if (!parts) return false;
  if (tipo === 'ano') return parts.yyyy === sel.ano;
  if (tipo === 'mes') return parts.yyyy === sel.ano && parts.mm === sel.mes;
  if (tipo === 'trimestre') {
    const q = sel.trimestre;
    const m0 = (q - 1) * 3 + 1;
    return parts.yyyy === sel.ano && parts.mm >= m0 && parts.mm <= m0 + 2;
  }
  if (tipo === 'bimestre') {
    const b = sel.bimestre;
    const m0 = (b - 1) * 2 + 1;
    return parts.yyyy === sel.ano && parts.mm >= m0 && parts.mm <= m0 + 1;
  }
  if (tipo === 'semestre') {
    const s = sel.semestre;
    const m0 = s === 1 ? 1 : 7;
    return parts.yyyy === sel.ano && parts.mm >= m0 && parts.mm <= m0 + 5;
  }
  if (tipo === 'personalizado') {
    const d1 = parseDataBrParts(sel.dataInicio);
    const d2 = parseDataBrParts(sel.dataFim);
    if (!d1 || !d2) return false;
    let o1 = valorOrdemDataBrParts(d1);
    let o2 = valorOrdemDataBrParts(d2);
    if (o1 > o2) {
      const t = o1;
      o1 = o2;
      o2 = t;
    }
    const v = valorOrdemDataBrParts(parts);
    return v >= o1 && v <= o2;
  }
  return true;
}

function filtrarTransacoesPorPeriodo(lista, campoData, tipo, sel) {
  if (tipo === 'todos' || !Array.isArray(lista)) return lista;
  return lista.filter((t) => dataLancamentoNoPeriodo(t[campoData], tipo, sel));
}

const MESES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function pad2MesDia(n) {
  return String(n).padStart(2, '0');
}

/** Primeiro e último dia do mês (dd/mm/aaaa). */
function limitesMesBr(ano, mes) {
  const last = new Date(ano, mes, 0).getDate();
  return {
    ini: `01/${pad2MesDia(mes)}/${ano}`,
    fim: `${pad2MesDia(last)}/${pad2MesDia(mes)}/${ano}`,
  };
}

/** Ordena lista de transações do extrato bancário por coluna e direção. */
function ordenarTransacoesBanco(lista, col, dir) {
  if (!col || !lista.length) return lista;
  const asc = dir === 'asc';
  const cmp = (a, b) => {
    let va = a[col];
    let vb = b[col];
    if (col === 'data') {
      va = dataParaOrdenar(va);
      vb = dataParaOrdenar(vb);
      return va.localeCompare(vb);
    }
    if (col === 'valor' || col === 'saldo') {
      return (Number(va) || 0) - (Number(vb) || 0);
    }
    if (col === 'categoria') {
      va = textoCategoriaObservacao(a);
      vb = textoCategoriaObservacao(b);
    }
    if (col === 'dimensao') {
      va = textoDimensaoEq(a);
      vb = textoDimensaoEq(b);
    }
    if (col === 'ref') {
      va = normalizarRefFinanceiro(a.ref);
      vb = normalizarRefFinanceiro(b.ref);
    }
    const sa = String(va ?? '');
    const sb = String(vb ?? '');
    return sa.localeCompare(sb, 'pt-BR');
  };
  const sorted = [...lista].sort((a, b) => {
    let r = cmp(a, b);
    if (r === 0 && col === 'data') {
      r = String(a.numero ?? '').localeCompare(String(b.numero ?? ''), undefined, { numeric: true });
    }
    return asc ? r : -r;
  });
  return sorted;
}

/** Ordena lista do extrato consolidado por coluna e direção. */
function ordenarTransacoesConsolidado(lista, col, dir) {
  if (!col || !lista.length) return lista;
  const asc = dir === 'asc';
  const cmp = (a, b) => {
    let va = a[col];
    let vb = b[col];
    if (col === 'data') {
      va = dataParaOrdenar(va);
      vb = dataParaOrdenar(vb);
      return va.localeCompare(vb);
    }
    if (col === 'valor') return (Number(va) || 0) - (Number(vb) || 0);
    if (col === 'numeroBanco') return (Number(va) || 0) - (Number(vb) || 0);
    if (col === 'descricaoDetalhada') {
      va = textoCategoriaObservacao(a);
      vb = textoCategoriaObservacao(b);
    }
    if (col === 'eq') {
      va = textoDimensaoEq(a);
      vb = textoDimensaoEq(b);
    }
    if (col === 'ref') {
      va = normalizarRefFinanceiro(a.ref);
      vb = normalizarRefFinanceiro(b.ref);
    }
    const sa = String(va ?? '');
    const sb = String(vb ?? '');
    return sa.localeCompare(sb, 'pt-BR');
  };
  const sorted = [...lista].sort((a, b) => {
    const r = cmp(a, b);
    return asc ? r : -r;
  });
  return sorted;
}

/** Chave estável da linha no modal «Parear compensações» (inclui estado eloAplicado no objeto). */
function chaveModalParCompensacao(p) {
  return `${p.credito.banco}|${p.credito.numero}|${p.debito.banco}|${p.debito.numero}|${p.data}`;
}

const INSTITUICOES_LINHA_1 = [
  'CEF',
  'CEF Poupança',
  'BB',
  'Itaú',
  'Itaú Empresas',
  'CORA',
  'BTG',
  'BTG JA',
  'BTG RACHEL',
  'BTG (2)',
  'BTG Banking',
  'ITI',
  'Itaú Poupança',
];

const INSTITUICOES_LINHA_2 = [
  'Sicoob VRV',
  'Sicoob',
  'Bradesco',
  'Poupança Bradesco',
  'Nubank',
  'PicPay',
  'PicPay Rachel',
];

const TODAS_INSTITUICOES_PREDEF = [...INSTITUICOES_LINHA_1, ...INSTITUICOES_LINHA_2];

function primeiraInstituicaoAtiva(inativos, ordemCompleta) {
  const s = new Set(inativos);
  const ordem = ordemCompleta?.length ? ordemCompleta : TODAS_INSTITUICOES_PREDEF;
  if (!s.has('CEF') && ordem.includes('CEF')) return 'CEF';
  return ordem.find((n) => !s.has(n)) ?? ordem[0] ?? 'CEF';
}

const STORAGE_LAYOUT_FINANCEIRO_KEY = 'vilareal:financeiro:layout-relatorios:v1';
const STORAGE_EXIBICAO_FINANCEIRO_V2 = 'vilareal:financeiro:exibicao-relatorios:v2';

function loadLayoutRelatoriosFinanceiro() {
  if (typeof window === 'undefined') return 'empilhado';
  try {
    const v = window.localStorage.getItem(STORAGE_LAYOUT_FINANCEIRO_KEY);
    if (v === 'lado_a_lado' || v === 'empilhado') return v;
  } catch {
    /* ignore */
  }
  return 'empilhado';
}

/** Disposição (empilhado / lado a lado), quais painéis mostrar e ordem extrato ↔ consolidado. */
function loadExibicaoFinanceiro() {
  if (typeof window === 'undefined') {
    return { disposicao: 'empilhado', paineis: 'ambos', ordem: 'extrato_primeiro' };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_EXIBICAO_FINANCEIRO_V2);
    if (raw) {
      const o = JSON.parse(raw);
      return {
        disposicao: o.disposicao === 'lado_a_lado' ? 'lado_a_lado' : 'empilhado',
        paineis: ['ambos', 'so_extrato', 'so_consolidado'].includes(o.paineis) ? o.paineis : 'ambos',
        ordem: o.ordem === 'consolidado_primeiro' ? 'consolidado_primeiro' : 'extrato_primeiro',
      };
    }
  } catch {
    /* ignore */
  }
  return {
    disposicao: loadLayoutRelatoriosFinanceiro(),
    paineis: 'ambos',
    ordem: 'extrato_primeiro',
  };
}

export function Financeiro() {
  const navigate = useNavigate();
  const location = useLocation();
  const [extratosPorBanco, setExtratosPorBanco] = useState(() => {
    const persisted = loadPersistedExtratosFinanceiro();
    const extrasContas = loadPersistedContasExtrasFinanceiro();
    let merged = persisted ? { ...getExtratosIniciais(), ...persisted } : getExtratosIniciais();
    for (const { nome } of extrasContas) {
      if (!Array.isArray(merged[nome])) merged[nome] = [];
    }
    /* Não parear automaticamente ao carregar: lançamentos OFX permanecem em N até reclassificação ou "Parear compensações". */
    return merged;
  });
  /** Sempre o extrato mais recente ao disparar uma nova busca (evita snapshot “preso” em closure antiga). */
  const extratosPorBancoRef = useRef(extratosPorBanco);
  useEffect(() => {
    extratosPorBancoRef.current = extratosPorBanco;
  }, [extratosPorBanco]);

  const [extratosInativos, setExtratosInativos] = useState(() => loadPersistedExtratosInativosFinanceiro());
  const [contasExtras, setContasExtras] = useState(() => loadPersistedContasExtrasFinanceiro());
  const [nomeNovaContaBancaria, setNomeNovaContaBancaria] = useState('');
  const [msgNovaContaBancaria, setMsgNovaContaBancaria] = useState(null);
  const [instituicaoSelecionada, setInstituicaoSelecionada] = useState(() =>
    primeiraInstituicaoAtiva(loadPersistedExtratosInativosFinanceiro(), [
      ...INSTITUICOES_LINHA_1,
      ...INSTITUICOES_LINHA_2,
      ...loadPersistedContasExtrasFinanceiro().map((c) => c.nome),
    ])
  );
  const [mostrarExtratosInativos, setMostrarExtratosInativos] = useState(false);
  const [contasContabeisExtras, setContasContabeisExtras] = useState(() =>
    loadPersistedContasContabeisExtrasFinanceiro()
  );
  const [contasContabeisInativas, setContasContabeisInativas] = useState(() =>
    loadPersistedContasContabeisInativasFinanceiro()
  );

  useEffect(() => {
    const h = () => {
      const persisted = loadPersistedExtratosFinanceiro();
      const extrasContas = loadPersistedContasExtrasFinanceiro();
      let merged = persisted ? { ...getExtratosIniciais(), ...persisted } : getExtratosIniciais();
      for (const { nome } of extrasContas) {
        if (!Array.isArray(merged[nome])) merged[nome] = [];
      }
      setExtratosPorBanco(merged);
      setExtratosInativos(loadPersistedExtratosInativosFinanceiro());
      setContasExtras(extrasContas);
      setContasContabeisExtras(loadPersistedContasContabeisExtrasFinanceiro());
      setContasContabeisInativas(loadPersistedContasContabeisInativasFinanceiro());
    };
    window.addEventListener(EVENT_FINANCEIRO_PERSISTENCIA_EXTERNA, h);
    return () => window.removeEventListener(EVENT_FINANCEIRO_PERSISTENCIA_EXTERNA, h);
  }, []);

  const [nomeNovaContaContabil, setNomeNovaContaContabil] = useState('');
  const [msgNovaContaContabil, setMsgNovaContaContabil] = useState(null);
  const [mostrarContasContabeisInativas, setMostrarContasContabeisInativas] = useState(false);
  const [contaContabilSelecionada, setContaContabilSelecionada] = useState(() =>
    primeiraContaContabilVisivel(loadPersistedContasContabeisInativasFinanceiro())
  );
  const [linhaConsolidadoFoco, setLinhaConsolidadoFoco] = useState(null);
  const [linhaConsolidadoAlvo, setLinhaConsolidadoAlvo] = useState(null);
  const [linhaBancoAlvo, setLinhaBancoAlvo] = useState(null);
  const [sortExtratoBanco, setSortExtratoBanco] = useState({ col: null, dir: 'asc' });
  const [limiteLancamentosExtratoBanco, setLimiteLancamentosExtratoBanco] = useState(100);
  const [limiteLancamentosConsolidado, setLimiteLancamentosConsolidado] = useState(100);
  const [periodoVisao, setPeriodoVisao] = useState(() => 'todos');
  const [periodoAno, setPeriodoAno] = useState(() => new Date().getFullYear());
  const [periodoMes, setPeriodoMes] = useState(() => new Date().getMonth() + 1);
  const [periodoTrimestre, setPeriodoTrimestre] = useState(
    () => Math.floor(new Date().getMonth() / 3) + 1
  );
  const [periodoBimestre, setPeriodoBimestre] = useState(() => Math.floor(new Date().getMonth() / 2) + 1);
  const [periodoSemestre, setPeriodoSemestre] = useState(() => (new Date().getMonth() < 6 ? 1 : 2));
  const [periodoPersonalInicio, setPeriodoPersonalInicio] = useState('');
  const [periodoPersonalFim, setPeriodoPersonalFim] = useState('');
  const [sortConsolidado, setSortConsolidado] = useState({ col: null, dir: 'asc' });
  /** Só Conta Compensação: filtra o consolidado pelo campo Elo (espelho de proc. no extrato). */
  const [filtroEloConsolidado, setFiltroEloConsolidado] = useState('');
  /** Só Conta Compensação: independente do filtro por Elo — só lançamentos cujo Elo tem soma global ≠ 0. */
  const [filtroConciliacaoEloConsolidado, setFiltroConciliacaoEloConsolidado] = useState('todos');
  const linhaConsolidadoRef = useRef(null);
  const linhaBancoRef = useRef(null);
  const fileInputOfxRef = useRef(null);
  const [ofxStatus, setOfxStatus] = useState({ kind: 'idle', message: '' });
  const [substituirExtratoOfxCompleto, setSubstituirExtratoOfxCompleto] = useState(false);
  const [modalParearCompensacao, setModalParearCompensacao] = useState(null);
  const saveTimerRef = useRef(null);
  const inativosSaveTimerRef = useRef(null);
  const contasExtrasSaveTimerRef = useRef(null);
  const contasContabeisExtrasSaveTimerRef = useRef(null);
  const contasContabeisInativasSaveTimerRef = useRef(null);
  /** Vindo de Cálculos → aba Honorários: filtra consolidado (Conta Escritório) por cliente/proc para conciliação. */
  const [filtroConciliacaoHonorarios, setFiltroConciliacaoHonorarios] = useState(null);
  /** Modal: busca automática extrato não classificado × parcelas de cálculos aceitos; usuário só aprova. */
  const [modalBuscaParcelas, setModalBuscaParcelas] = useState(false);
  /** Cada item: número sequencial da consulta, log ISO, snapshot de sugestões e aprovações. */
  const [consultasVinculoHistorico, setConsultasVinculoHistorico] = useState([]);
  const [indiceConsultaVinculo, setIndiceConsultaVinculo] = useState(0);
  const indiceConsultaVinculoRef = useRef(0);
  /** Evita duplicar a 1ª consulta ao abrir o modal (React Strict Mode em dev). */
  const primeiraConsultaModalRef = useRef(false);
  /** Modal: buscar cliente/proc por nome, réu etc. e gravar no lançamento sem sair do Financeiro. */
  const [modalVinculoLancamento, setModalVinculoLancamento] = useState(null);
  const [modalConfigFinanceiro, setModalConfigFinanceiro] = useState(false);
  const [apiFinanceiroLoading, setApiFinanceiroLoading] = useState(false);
  const [apiFinanceiroErro, setApiFinanceiroErro] = useState('');
  const [importLegadoPreview, setImportLegadoPreview] = useState(null);
  const [importLegadoLoadingPreview, setImportLegadoLoadingPreview] = useState(false);
  const [importLegadoExecutando, setImportLegadoExecutando] = useState(false);
  const [importLegadoResumo, setImportLegadoResumo] = useState(null);
  const [importLegadoStatus, setImportLegadoStatus] = useState(() => getStatusMigracaoAssistidaPhase5Financeiro());
  const [disposicaoRelatorios, setDisposicaoRelatorios] = useState(
    () => loadExibicaoFinanceiro().disposicao
  );
  const [paineisRelatorios, setPaineisRelatorios] = useState(() => loadExibicaoFinanceiro().paineis);
  const [ordemRelatorios, setOrdemRelatorios] = useState(() => loadExibicaoFinanceiro().ordem);

  const recarregarExtratosFinanceiroApi = useCallback(async () => {
    if (!featureFlags.useApiFinanceiro) return;
    setApiFinanceiroLoading(true);
    setApiFinanceiroErro('');
    try {
      const dados = await carregarExtratosFinanceiroApiFirst();
      if (!dados || typeof dados !== 'object') return;
      const base = getExtratosIniciais();
      setExtratosPorBanco({ ...base, ...dados });
    } catch (e) {
      setApiFinanceiroErro(e?.message || 'Falha ao carregar financeiro da API.');
    } finally {
      setApiFinanceiroLoading(false);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    if (!featureFlags.useApiFinanceiro) return;
    void (async () => {
      if (!ativo) return;
      await recarregarExtratosFinanceiroApi();
    })();
    return () => {
      ativo = false;
    };
  }, [recarregarExtratosFinanceiroApi]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_EXIBICAO_FINANCEIRO_V2,
        JSON.stringify({
          disposicao: disposicaoRelatorios,
          paineis: paineisRelatorios,
          ordem: ordemRelatorios,
        })
      );
      window.localStorage.setItem(STORAGE_LAYOUT_FINANCEIRO_KEY, disposicaoRelatorios);
    } catch {
      /* ignore */
    }
  }, [disposicaoRelatorios, paineisRelatorios, ordemRelatorios]);

  const extratosInativosSet = useMemo(() => new Set(extratosInativos), [extratosInativos]);

  const mostrarPainelExtrato = paineisRelatorios !== 'so_consolidado' && Boolean(instituicaoSelecionada);
  const mostrarPainelConsolidado = paineisRelatorios !== 'so_extrato' && Boolean(contaContabilSelecionada);
  const doisPaineisVisiveis = mostrarPainelExtrato && mostrarPainelConsolidado;

  const relatoriosLadoALado = useMemo(
    () =>
      Boolean(
        doisPaineisVisiveis && disposicaoRelatorios === 'lado_a_lado'
      ),
    [doisPaineisVisiveis, disposicaoRelatorios]
  );

  const classOrdemExtrato =
    doisPaineisVisiveis && ordemRelatorios === 'consolidado_primeiro' ? 'order-2' : doisPaineisVisiveis ? 'order-1' : '';
  const classOrdemConsolidado =
    doisPaineisVisiveis && ordemRelatorios === 'consolidado_primeiro' ? 'order-1' : doisPaineisVisiveis ? 'order-2' : '';

  const classeWrapperRelatorios =
    relatoriosLadoALado
      ? 'flex flex-col xl:flex-row gap-4 xl:items-stretch min-h-0 xl:min-h-[280px]'
      : doisPaineisVisiveis && disposicaoRelatorios === 'empilhado'
        ? 'flex flex-col gap-4'
        : 'contents';

  const todasInstituicoesNomes = useMemo(
    () => [...INSTITUICOES_LINHA_1, ...INSTITUICOES_LINHA_2, ...contasExtras.map((c) => c.nome)],
    [contasExtras]
  );

  const numeroBancoMap = useMemo(() => buildNumeroBancoMap(contasExtras), [contasExtras]);

  const letraToContaMerged = useMemo(() => buildLetraToContaMerge(contasContabeisExtras), [contasContabeisExtras]);
  const contaToLetraMerged = useMemo(() => buildContaToLetraMerge(contasContabeisExtras), [contasContabeisExtras]);
  const ordemLetrasCompleta = useMemo(
    () => buildOrdemLetrasContabeisCompleta(contasContabeisExtras),
    [contasContabeisExtras]
  );
  const contasContabeisInativasSet = useMemo(() => new Set(contasContabeisInativas), [contasContabeisInativas]);

  const letrasOrdenadasParaSelect = useMemo(() => {
    const keys = Object.keys(letraToContaMerged);
    return keys.sort((a, b) => {
      const ia = ordemLetrasCompleta.indexOf(a);
      const ib = ordemLetrasCompleta.indexOf(b);
      const xa = ia === -1 ? 999 : ia;
      const xb = ib === -1 ? 999 : ib;
      if (xa !== xb) return xa - xb;
      return a.localeCompare(b);
    });
  }, [letraToContaMerged, ordemLetrasCompleta]);

  const ordemNomesContabeis = useMemo(
    () => ordemLetrasCompleta.map((l) => letraToContaMerged[l]).filter(Boolean),
    [ordemLetrasCompleta, letraToContaMerged]
  );

  useEffect(() => {
    indiceConsultaVinculoRef.current = indiceConsultaVinculo;
  }, [indiceConsultaVinculo]);

  const consultaVinculoAtual = consultasVinculoHistorico[indiceConsultaVinculo] ?? null;
  const sugestoesVinculoAutomatico = consultaVinculoAtual?.sugestoes ?? [];
  const matchIndexPorSugestao = consultaVinculoAtual?.matchIndexPorSugestao ?? {};
  const aprovarSugestao = consultaVinculoAtual?.aprovarSugestao ?? {};

  const transacoesConsolidadas = useMemo(
    () =>
      getTransacoesConsolidadas(
        extratosPorBanco,
        contaContabilSelecionada,
        numeroBancoMap,
        contaToLetraMerged
      ),
    [extratosPorBanco, contaContabilSelecionada, numeroBancoMap, contaToLetraMerged]
  );
  const isContaCompensacao = contaContabilSelecionada === 'Conta Compensação';
  const isContaEscritorio = contaContabilSelecionada === 'Conta Escritório';
  const somasParComp = isContaCompensacao
    ? somasPorParCompensacao(extratosPorBanco, numeroBancoMap, contaToLetraMerged)
    : {};
  const paresCompensacaoDesbalanceados = isContaCompensacao
    ? Object.entries(somasParComp).filter(([proc, somaCent]) => /^\d+$/.test(String(proc)) && somaCent !== 0)
    : [];
  const orfaosCompensacao = isContaCompensacao
    ? Object.keys(somasParComp).filter((p) => String(p).startsWith('?')).length
    : 0;

  const listaExtratoBancoOrdenada = useMemo(() => {
    if (!instituicaoSelecionada) return [];
    return ordenarTransacoesBanco(
      getTransacoesBanco(extratosPorBanco, instituicaoSelecionada),
      sortExtratoBanco.col,
      sortExtratoBanco.dir
    );
  }, [extratosPorBanco, instituicaoSelecionada, sortExtratoBanco.col, sortExtratoBanco.dir]);

  const listaConsolidadaOrdenada = useMemo(
    () => ordenarTransacoesConsolidado(transacoesConsolidadas, sortConsolidado.col, sortConsolidado.dir),
    [transacoesConsolidadas, sortConsolidado.col, sortConsolidado.dir]
  );

  const listaConsolidadaParaExibicao = useMemo(() => {
    if (!filtroConciliacaoHonorarios || contaContabilSelecionada !== 'Conta Escritório') {
      return listaConsolidadaOrdenada;
    }
    return filtrarTransacoesPorClienteProc(
      listaConsolidadaOrdenada,
      filtroConciliacaoHonorarios.codCliente,
      filtroConciliacaoHonorarios.proc
    );
  }, [listaConsolidadaOrdenada, filtroConciliacaoHonorarios, contaContabilSelecionada]);

  const anosDisponiveisFinanceiro = useMemo(
    () => coletarAnosDosExtratos(extratosPorBanco),
    [extratosPorBanco]
  );

  const anosParaSelectPeriodo = useMemo(() => {
    const s = new Set(anosDisponiveisFinanceiro);
    s.add(periodoAno);
    return Array.from(s).sort((a, b) => b - a);
  }, [anosDisponiveisFinanceiro, periodoAno]);

  const selecaoPeriodoAtual = useMemo(() => {
    if (periodoVisao === 'todos') return null;
    if (periodoVisao === 'ano') return { ano: periodoAno };
    if (periodoVisao === 'mes') return { ano: periodoAno, mes: periodoMes };
    if (periodoVisao === 'trimestre') return { ano: periodoAno, trimestre: periodoTrimestre };
    if (periodoVisao === 'bimestre') return { ano: periodoAno, bimestre: periodoBimestre };
    if (periodoVisao === 'semestre') return { ano: periodoAno, semestre: periodoSemestre };
    if (periodoVisao === 'personalizado') {
      return { dataInicio: periodoPersonalInicio, dataFim: periodoPersonalFim };
    }
    return null;
  }, [
    periodoVisao,
    periodoAno,
    periodoMes,
    periodoTrimestre,
    periodoBimestre,
    periodoSemestre,
    periodoPersonalInicio,
    periodoPersonalFim,
  ]);

  const listaExtratoBancoVisivel = useMemo(
    () =>
      filtrarTransacoesPorPeriodo(listaExtratoBancoOrdenada, 'data', periodoVisao, selecaoPeriodoAtual),
    [listaExtratoBancoOrdenada, periodoVisao, selecaoPeriodoAtual]
  );

  const listaConsolidadaAposPeriodo = useMemo(
    () =>
      filtrarTransacoesPorPeriodo(listaConsolidadaParaExibicao, 'data', periodoVisao, selecaoPeriodoAtual),
    [listaConsolidadaParaExibicao, periodoVisao, selecaoPeriodoAtual]
  );

  const elosDisponiveisConsolidado = useMemo(() => {
    if (!isContaCompensacao) return [];
    const set = new Set();
    for (const t of listaConsolidadaAposPeriodo) {
      const p = String(t.proc ?? '').trim();
      if (p) set.add(p);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [isContaCompensacao, listaConsolidadaAposPeriodo]);

  useEffect(() => {
    if (!isContaCompensacao) {
      setFiltroEloConsolidado('');
      setFiltroConciliacaoEloConsolidado('todos');
    }
  }, [isContaCompensacao]);

  useEffect(() => {
    if (!isContaCompensacao || !filtroEloConsolidado) return;
    if (!elosDisponiveisConsolidado.includes(filtroEloConsolidado)) {
      setFiltroEloConsolidado('');
    }
  }, [isContaCompensacao, filtroEloConsolidado, elosDisponiveisConsolidado]);

  const listaConsolidadaAposPeriodoEElo = useMemo(() => {
    if (!isContaCompensacao || !filtroEloConsolidado) return listaConsolidadaAposPeriodo;
    return listaConsolidadaAposPeriodo.filter(
      (t) => String(t.proc ?? '').trim() === filtroEloConsolidado
    );
  }, [listaConsolidadaAposPeriodo, isContaCompensacao, filtroEloConsolidado]);

  const listaConsolidadaVisivel = useMemo(() => {
    let list = listaConsolidadaAposPeriodoEElo;
    if (isContaCompensacao && filtroConciliacaoEloConsolidado === 'nao_conciliados') {
      list = list.filter((t) => {
        const k = String(t.proc ?? '').trim() || '—';
        return (somasParComp[k] ?? 0) !== 0;
      });
    } else if (isContaCompensacao && filtroConciliacaoEloConsolidado === 'conciliados') {
      list = list.filter((t) => {
        const k = String(t.proc ?? '').trim() || '—';
        return (somasParComp[k] ?? 0) === 0;
      });
    }
    return list;
  }, [
    listaConsolidadaAposPeriodoEElo,
    isContaCompensacao,
    filtroConciliacaoEloConsolidado,
    somasParComp,
  ]);

  /** Conta Escritório: quantas linhas (no período/filtro atual) compartilham cada Eq. entre lançamentos Ref. R. */
  const contagemEqRepasseEscritorio = useMemo(() => {
    const m = new Map();
    if (!isContaEscritorio) return m;
    for (const t of listaConsolidadaVisivel) {
      if (normalizarRefFinanceiro(t.ref) !== 'R') continue;
      const eq = String(textoDimensaoEq(t) ?? '').trim();
      if (!eq) continue;
      m.set(eq, (m.get(eq) || 0) + 1);
    }
    return m;
  }, [isContaEscritorio, listaConsolidadaVisivel]);

  const saldoHeaderConsolidado = useMemo(
    () => listaConsolidadaVisivel.reduce((s, t) => s + t.valor, 0),
    [listaConsolidadaVisivel]
  );

  /** Contas ordenadas pelo uso real nos extratos (quantidade e soma dos valores por letra). */
  const contasDerivadasDosExtratos = useMemo(
    () => getContasContabeisDerivadasExtratos(extratosPorBanco, letraToContaMerged, ordemLetrasCompleta),
    [extratosPorBanco, letraToContaMerged, ordemLetrasCompleta]
  );
  const contasContabeisChipsAtivas = useMemo(
    () => contasDerivadasDosExtratos.filter((c) => !contasContabeisInativasSet.has(c.nome)),
    [contasDerivadasDosExtratos, contasContabeisInativasSet]
  );
  const meioContas = Math.ceil(contasContabeisChipsAtivas.length / 2) || 1;
  const contasLinha1 = contasContabeisChipsAtivas.slice(0, meioContas);
  const contasLinha2 = contasContabeisChipsAtivas.slice(meioContas);

  /** Altera a letra (conta contábil) do lançamento; o lançamento sai da conta original e passa para a nova. */
  function updateLetraLancamento(nomeBanco, numero, data, novaLetra) {
    setExtratosPorBanco((prev) => {
      const next = cloneExtratos(prev);
      const list = next[nomeBanco];
      if (!list) return prev;
      const idx = list.findIndex((t) => t.numero === numero && t.data === data);
      if (idx === -1) return prev;
      const L = String(novaLetra ?? '').trim().toUpperCase();
      list[idx] = {
        ...list[idx],
        letra: L,
        ...(L === 'E' ? { codCliente: '', proc: '' } : {}),
      };
      return next;
    });
    if (featureFlags.useApiFinanceiro) {
      void sincronizarLancamentoApi(nomeBanco, numero, data);
    }
  }

  function updateCampoLancamento(nomeBanco, numero, data, field, value) {
    setExtratosPorBanco((prev) => {
      const next = cloneExtratos(prev);
      const list = next[nomeBanco];
      if (!list) return prev;
      const idx = list.findIndex((t) => t.numero === numero && t.data === data);
      if (idx === -1) return prev;
      const v = String(value ?? '');
      if (field === 'categoria' || field === 'descricaoDetalhada') {
        list[idx] = { ...list[idx], categoria: v, descricaoDetalhada: v };
      } else if (field === 'ref') {
        const refN = normalizarRefFinanceiro(v);
        if (refN === 'N') {
          list[idx] = { ...list[idx], ref: 'N', dimensao: '', eq: '' };
        } else {
          list[idx] = { ...list[idx], ref: 'R' };
        }
      } else if (field === 'dimensao' || field === 'eq') {
        list[idx] = { ...list[idx], dimensao: v, eq: v };
      } else {
        list[idx] = { ...list[idx], [field]: value };
      }
      return next;
    });
    if (featureFlags.useApiFinanceiro) {
      void sincronizarLancamentoApi(nomeBanco, numero, data);
    }
  }

  async function sincronizarLancamentoApi(nomeBanco, numero, data) {
    try {
      const list = extratosPorBancoRef.current?.[nomeBanco];
      if (!Array.isArray(list)) return;
      const idx = list.findIndex((t) => t.numero === numero && t.data === data);
      if (idx < 0) return;
      const atual = list[idx];
      const saved = await salvarOuAtualizarLancamentoFinanceiroApi({
        ...atual,
        nomeBanco,
      });
      if (!saved?.id) return;
      setExtratosPorBanco((prev) => {
        const next = cloneExtratos(prev);
        const arr = next[nomeBanco];
        if (!Array.isArray(arr)) return prev;
        const i = arr.findIndex((t) => t.numero === numero && t.data === data);
        if (i < 0) return prev;
        arr[i] = {
          ...arr[i],
          apiId: saved.id,
          _financeiroMeta: {
            ...(arr[i]?._financeiroMeta || {}),
            clienteId: saved.clienteId ?? arr[i]?._financeiroMeta?.clienteId ?? null,
            processoId: saved.processoId ?? arr[i]?._financeiroMeta?.processoId ?? null,
            contaContabilId: saved.contaContabilId ?? arr[i]?._financeiroMeta?.contaContabilId ?? null,
            classificacaoFinanceiraId: saved.classificacaoFinanceiraId ?? arr[i]?._financeiroMeta?.classificacaoFinanceiraId ?? null,
            eloFinanceiroId: saved.eloFinanceiroId ?? arr[i]?._financeiroMeta?.eloFinanceiroId ?? null,
          },
        };
        return next;
      });
    } catch (e) {
      setApiFinanceiroErro(e?.message || 'Falha ao sincronizar lançamento com API.');
    }
  }

  async function excluirLancamentoUi(t) {
    const msg = `Excluir lançamento ${t.numero} de ${t.data}?`;
    if (!window.confirm(msg)) return;
    const removerLocal = () => {
      setExtratosPorBanco((prev) => {
        const next = cloneExtratos(prev);
        const list = next[t.nomeBanco];
        if (!Array.isArray(list)) return prev;
        next[t.nomeBanco] = list.filter((x) => !(x.numero === t.numero && x.data === t.data));
        return next;
      });
    };
    if (!featureFlags.useApiFinanceiro) {
      removerLocal();
      setOfxStatus({ kind: 'success', message: 'Lançamento removido no fallback local.' });
      return;
    }
    try {
      if (!Number(t.apiId)) {
        setOfxStatus({ kind: 'error', message: 'Lançamento sem id de API. Edite/sincronize antes de excluir.' });
        return;
      }
      await removerLancamentoFinanceiroApi(t.apiId);
      removerLocal();
      setOfxStatus({ kind: 'success', message: 'Lançamento excluído na API com sucesso.' });
    } catch (e) {
      setOfxStatus({ kind: 'error', message: e?.message || 'Falha ao excluir lançamento na API.' });
    }
  }

  async function abrirPreviaImportacaoLegadoFinanceiro() {
    setImportLegadoLoadingPreview(true);
    setImportLegadoResumo(null);
    try {
      const previa = await previsualizarMigracaoAssistidaPhase5Financeiro();
      setImportLegadoPreview(previa);
      setImportLegadoStatus(getStatusMigracaoAssistidaPhase5Financeiro());
    } catch (e) {
      setOfxStatus({ kind: 'error', message: e?.message || 'Falha ao gerar prévia da migração assistida.' });
    } finally {
      setImportLegadoLoadingPreview(false);
    }
  }

  async function executarImportacaoLegadoFinanceiroViaUi() {
    if (importLegadoExecutando) return;
    const statusAtual = getStatusMigracaoAssistidaPhase5Financeiro();
    setImportLegadoStatus(statusAtual);
    if (!statusAtual.habilitadaPorFlag || !statusAtual.apiFinanceiroAtiva) {
      setOfxStatus({
        kind: 'error',
        message:
          'Ative VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE5_FINANCEIRO=true e VITE_USE_API_FINANCEIRO=true para importar.',
      });
      return;
    }
    if (statusAtual.jaExecutada) {
      setOfxStatus({
        kind: 'info',
        message: 'Importação já executada anteriormente (marker ativo). Reimportação manual não liberada nesta etapa.',
      });
      return;
    }
    const confirmou = window.confirm(
      'Esta ação tentará gravar lançamentos legados na API financeira com deduplicação. Alguns registros podem ser ignorados e alguns podem ficar sem vínculo resolvido. Deseja continuar?'
    );
    if (!confirmou) return;
    setImportLegadoExecutando(true);
    setOfxStatus({ kind: 'info', message: 'Importação assistida do legado financeiro em andamento...' });
    try {
      const resultado = await executarMigracaoAssistidaPhase5Financeiro();
      if (!resultado) {
        setOfxStatus({
          kind: 'info',
          message: 'Importação não executada (flag, marker ou dados indisponíveis).',
        });
        return;
      }
      setImportLegadoResumo(resultado);
      setImportLegadoStatus(getStatusMigracaoAssistidaPhase5Financeiro());
      await recarregarExtratosFinanceiroApi();
      setOfxStatus({
        kind: 'success',
        message: `Importação concluída: ${resultado.importados} importados, ${resultado.ignorados} ignorados, ${resultado.semVinculo} sem vínculo.`,
      });
    } catch (e) {
      setOfxStatus({ kind: 'error', message: e?.message || 'Falha na importação assistida do legado financeiro.' });
    } finally {
      setImportLegadoExecutando(false);
    }
  }

  function abrirModalBuscaParcelas() {
    setModalBuscaParcelas(true);
  }

  const runNovaConsultaVinculo = useCallback(() => {
    const rodadas = loadRodadasCalculos() || {};
    const sugestoes = procurarSugestoesVinculoAutomatico(extratosPorBancoRef.current, rodadas);
    const { entries: entriesAntes } = loadConsultasVinculoLog();
    const ultimo = entriesAntes.length > 0 ? entriesAntes[entriesAntes.length - 1] : null;
    const snapKey = JSON.stringify(sugestoes);
    const ultimoKey = ultimo ? JSON.stringify(ultimo.sugestoes ?? []) : null;
    if (ultimoKey === snapKey && entriesAntes.length > 0) {
      setConsultasVinculoHistorico(entriesAntes);
      setIndiceConsultaVinculo(entriesAntes.length - 1);
      setOfxStatus({
        kind: 'info',
        message:
          'Busca automática: resultado idêntico à consulta anterior — nenhuma nova entrada no histórico.',
      });
      return;
    }
    const idx = {};
    const ap = {};
    for (const s of sugestoes) {
      const k = `${s.nomeBanco}-${s.numero}-${s.data}`;
      idx[k] = 0;
      ap[k] = false;
    }
    appendConsultaVinculoLogEntry({
      sugestoes,
      matchIndexPorSugestao: idx,
      aprovarSugestao: ap,
      totalSugestoes: sugestoes.length,
    });
    const { entries } = loadConsultasVinculoLog();
    setConsultasVinculoHistorico(entries);
    setIndiceConsultaVinculo(Math.max(0, entries.length - 1));
  }, []);

  const patchConsultaVinculoAtual = useCallback((updater) => {
    setConsultasVinculoHistorico((prev) => {
      const i = indiceConsultaVinculoRef.current;
      if (i < 0 || i >= prev.length) return prev;
      const cur = prev[i];
      const next = typeof updater === 'function' ? updater(cur) : { ...cur, ...updater };
      const copy = [...prev];
      copy[i] = next;
      persistConsultasVinculoLog(copy);
      return copy;
    });
  }, []);

  function excluirHistoricoConsultasVinculoMaster() {
    if (!isUsuarioMaster()) return;
    if (
      !window.confirm(
        'Excluir permanentemente todo o relatório de consultas de vínculo guardado neste navegador? Esta ação não pode ser desfeita.'
      )
    ) {
      return;
    }
    clearConsultasVinculoLog();
    setConsultasVinculoHistorico([]);
    setIndiceConsultaVinculo(0);
    primeiraConsultaModalRef.current = false;
    runNovaConsultaVinculo();
  }

  function fecharModalBuscaVinculo() {
    setModalBuscaParcelas(false);
    setConsultasVinculoHistorico([]);
    setIndiceConsultaVinculo(0);
    primeiraConsultaModalRef.current = false;
  }

  /** Abre o modal: carrega log persistente (eterno); se vazio, cria a 1ª consulta. */
  useEffect(() => {
    if (!modalBuscaParcelas) {
      primeiraConsultaModalRef.current = false;
      return;
    }
    const { entries } = loadConsultasVinculoLog();
    setConsultasVinculoHistorico(entries);
    if (entries.length > 0) {
      setIndiceConsultaVinculo(entries.length - 1);
      primeiraConsultaModalRef.current = true;
      return;
    }
    if (primeiraConsultaModalRef.current) return;
    primeiraConsultaModalRef.current = true;
    runNovaConsultaVinculo();
  }, [modalBuscaParcelas, runNovaConsultaVinculo]);

  /**
   * Só corrige índice fora do intervalo (i ≥ len ou i &lt; 0).
   * Não zera índice quando len === 0 (evita disputa com o efeito que abre o modal e define a última consulta).
   * Não usar Math.min(i, len-1): isso forçava índice 0 e fazia #1 e #2 parecerem o mesmo snapshot.
   */
  useEffect(() => {
    const len = consultasVinculoHistorico.length;
    if (len === 0) return;
    setIndiceConsultaVinculo((i) => (i >= len ? len - 1 : i < 0 ? 0 : i));
  }, [consultasVinculoHistorico.length]);

  function atualizarSugestoesBuscaAutomatica() {
    runNovaConsultaVinculo();
  }

  function confirmarVinculosParcelasSelecionados() {
    const linhas = [];
    for (const s of sugestoesVinculoAutomatico) {
      const k = `${s.nomeBanco}-${s.numero}-${s.data}`;
      if (!aprovarSugestao[k]) continue;
      const mi = matchIndexPorSugestao[k] ?? 0;
      const m = s.matches[mi];
      if (!m) continue;
      const parsed = parseRodadaKeyParaDisplay(m.rodadaKey);
      const cod = normalizarCodigoClienteFinanceiro(parsed.codCliente);
      const proc = normalizarProcFinanceiro(parsed.proc);
      if (!cod || !proc) continue;
      linhas.push({
        nomeBanco: s.nomeBanco,
        numero: s.numero,
        data: s.data,
        codCliente: cod,
        proc,
        parcelaIndice: m.parcelaIndice,
      });
    }
    if (linhas.length === 0) {
      setOfxStatus({
        kind: 'error',
        message: 'Marque ao menos uma linha aprovada com o cálculo correto (se houver mais de uma opção).',
      });
      return;
    }
    const msg = `Confirmar vínculo de ${linhas.length} lançamento(s) aos clientes/processos indicados nas sugestões?`;
    if (!window.confirm(msg)) return;
    setExtratosPorBanco((prev) => {
      const next = cloneExtratos(prev);
      for (const ln of linhas) {
        const list = next[ln.nomeBanco];
        if (!list) continue;
        const i = list.findIndex((t) => t.numero === ln.numero && t.data === ln.data);
        if (i === -1) continue;
        list[i] = {
          ...list[i],
          codCliente: ln.codCliente,
          proc: ln.proc,
          parcela: String(ln.parcelaIndice).padStart(2, '0'),
        };
      }
      return next;
    });
    fecharModalBuscaVinculo();
    if (linhas.length === 1) {
      setFiltroConciliacaoHonorarios({
        codCliente: linhas[0].codCliente,
        proc: linhas[0].proc,
        rotulo: 'Após vínculo automático (Cálculos)',
        valorCentavos: null,
      });
      setContaContabilSelecionada(contaEscritorioOuPrimeiraAtiva(contasContabeisInativasSet, ordemNomesContabeis));
    } else {
      setFiltroConciliacaoHonorarios(null);
    }
    setOfxStatus({
      kind: 'success',
      message: `${linhas.length} lançamento(s) vinculado(s). Revise o extrato e o consolidado.`,
    });
  }

  /** Duplo clique na linha do extrato bancário: abre a conta contábil da letra e posiciona nessa linha no consolidado. */
  function handleDuploCliqueLinhaBanco(transacao) {
    const L = String(transacao.letra ?? '').trim().toUpperCase();
    const conta = letraToContaMerged[L];
    if (!conta) return;
    if (contasContabeisInativasSet.has(conta)) setMostrarContasContabeisInativas(true);
    const rowKey = `${instituicaoSelecionada}-${transacao.numero}-${transacao.data}`;
    setContaContabilSelecionada(conta);
    setLinhaConsolidadoAlvo(rowKey);
    setLinhaConsolidadoFoco(rowKey);
  }

  /** Duplo clique no título da coluna do extrato bancário: ordena por essa coluna (asc ↔ desc). Data: 1.º clique = mais recente primeiro. */
  function handleDuploCliqueTituloExtratoBanco(col) {
    setSortExtratoBanco((prev) => {
      if (prev.col !== col) {
        if (col === 'data') return { col, dir: 'desc' };
        return { col, dir: 'asc' };
      }
      return { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
    });
  }

  /** Duplo clique no título da coluna do extrato consolidado: ordena por essa coluna (asc ↔ desc). */
  function handleDuploCliqueTituloConsolidado(col) {
    setSortConsolidado((prev) => ({
      col,
      dir: prev.col === col ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'asc',
    }));
  }

  async function aplicarVinculoClienteProcNosCampos({ codCliente, proc }) {
    if (!modalVinculoLancamento) return;
    const { nomeBanco, numero, data } = modalVinculoLancamento;
    const cod = normalizarCodigoClienteFinanceiro(codCliente);
    const p = normalizarProcFinanceiro(proc);
    if (!cod) return;
    updateCampoLancamento(nomeBanco, numero, data, 'codCliente', cod);
    updateCampoLancamento(nomeBanco, numero, data, 'proc', p || '');
    setModalVinculoLancamento(null);
    setOfxStatus({
      kind: 'success',
      message: `Vínculo gravado: cliente ${cod}, proc. ${p || '—'} neste lançamento.`,
    });
    if (featureFlags.useApiFinanceiro) {
      try {
        const cliente = await buscarClientePorCodigo(cod);
        const processo = p ? await buscarProcessoPorChaveNatural(cod, p) : null;
        setExtratosPorBanco((prev) => {
          const next = cloneExtratos(prev);
          const arr = next[nomeBanco];
          if (!Array.isArray(arr)) return prev;
          const i = arr.findIndex((t) => t.numero === numero && t.data === data);
          if (i < 0) return prev;
          arr[i] = {
            ...arr[i],
            _financeiroMeta: {
              ...(arr[i]?._financeiroMeta || {}),
              clienteId: cliente?.id ?? null,
              processoId: processo?.id ?? null,
            },
          };
          return next;
        });
        await sincronizarLancamentoApi(nomeBanco, numero, data);
      } catch (e) {
        setApiFinanceiroErro(e?.message || 'Falha ao resolver cliente/processo para vínculo financeiro.');
      }
    }
  }

  /** Duplo clique na coluna Cod. Cliente: abre o cadastro de clientes com esse código e processo. */
  function handleDuploCliqueCodCliente(codCliente, proc) {
    navigate('/pessoas', { state: { codCliente: String(codCliente ?? ''), proc: String(proc ?? '') } });
  }

  /** Duplo clique na coluna Proc.: abre Processos e leva o lançamento da linha para a Conta Corrente. */
  function handleDuploCliqueProc(codCliente, proc, transacao) {
    const t = transacao && typeof transacao === 'object' ? transacao : null;
    navigate('/processos', {
      state: {
        codCliente: String(codCliente ?? ''),
        proc: String(proc ?? ''),
        contaCorrenteLinha: t
          ? {
              data: t.data,
              descricao: t.descricao,
              valor: t.valor,
              numero: t.numero,
              nomeBanco: t.nomeBanco,
              codCliente: String(t.codCliente ?? codCliente ?? ''),
              proc: String(t.proc ?? proc ?? ''),
              descricaoDetalhada: textoCategoriaObservacao(t),
              letra: t.letra,
            }
          : undefined,
      },
    });
  }

  /** Duplo clique no Nº do consolidado: abre o extrato do banco e posiciona na linha desse lançamento. */
  function handleDuploCliqueNºConsolidado(transacao) {
    const nb = transacao.nomeBanco;
    setInstituicaoSelecionada(nb);
    if (extratosInativosSet.has(nb)) setMostrarExtratosInativos(true);
    setLinhaBancoAlvo({ nomeBanco: nb, numero: transacao.numero, data: transacao.data });
  }

  function readFileAsText(file) {
    if (file && typeof file.text === 'function') return file.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.readAsText(file);
    });
  }

  function aplicarExtratoNoBanco(prev, nomeBanco, listaNova, modo) {
    const atual = prev[nomeBanco] ?? [];
    const finalLista =
      modo === 'substituir' ? listaNova : mergeExtratoBancario(atual, listaNova);
    const comNovoExtrato = { ...prev, [nomeBanco]: finalLista };
    /* Novos lançamentos vêm do OFX com letra N; não aplicar pareamento automático (N→E) — use "Parear compensações". */
    return comNovoExtrato;
  }

  function inativarExtratoSelecionado() {
    const nome = instituicaoSelecionada;
    if (!nome || extratosInativosSet.has(nome)) return;
    const next = new Set(extratosInativosSet);
    next.add(nome);
    setExtratosInativos([...next].sort());
    const ordem = [...INSTITUICOES_LINHA_1, ...INSTITUICOES_LINHA_2, ...contasExtras.map((c) => c.nome)];
    const primeiroAtivo = ordem.find((n) => !next.has(n));
    if (primeiroAtivo) setInstituicaoSelecionada(primeiroAtivo);
  }

  function reativarExtratoSelecionado() {
    const nome = instituicaoSelecionada;
    if (!nome || !extratosInativosSet.has(nome)) return;
    setExtratosInativos((prev) => prev.filter((x) => x !== nome));
  }

  function adicionarNovaContaContabil() {
    const v = validarNovoNomeContaContabil(nomeNovaContaContabil, contasContabeisExtras);
    if (!v.ok) {
      setMsgNovaContaContabil({ kind: 'error', text: v.message });
      return;
    }
    const letra = proximaLetraContaContabilExtra(contasContabeisExtras);
    if (!letra) {
      setMsgNovaContaContabil({
        kind: 'error',
        text: 'Limite de contas contábeis adicionais atingido (pool de letras esgotado).',
      });
      return;
    }
    const nome = v.nome;
    setContasContabeisExtras((prev) =>
      [...prev, { letra, nome }].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    );
    setContaContabilSelecionada(nome);
    setNomeNovaContaContabil('');
    setMsgNovaContaContabil({
      kind: 'success',
      text: `Conta contábil "${nome}" criada — letra ${letra} nos extratos e no consolidado.`,
    });
  }

  function inativarContaContabilSelecionada() {
    const nome = contaContabilSelecionada;
    if (!nome || contasContabeisInativasSet.has(nome)) return;
    const nextArr = [...contasContabeisInativas, nome].sort();
    const nextSet = new Set(nextArr);
    setContasContabeisInativas(nextArr);
    const primeiro = ordemNomesContabeis.find((n) => !nextSet.has(n));
    if (primeiro) setContaContabilSelecionada(primeiro);
  }

  function reativarContaContabilSelecionada() {
    const nome = contaContabilSelecionada;
    if (!nome || !contasContabeisInativasSet.has(nome)) return;
    setContasContabeisInativas((prev) => prev.filter((x) => x !== nome));
  }

  function adicionarNovaContaBancaria() {
    const v = validarNovoNomeContaBancaria(nomeNovaContaBancaria, contasExtras);
    if (!v.ok) {
      setMsgNovaContaBancaria({ kind: 'error', text: v.message });
      return;
    }
    const nome = v.nome;
    const numero = proximoNumeroContaBanco(contasExtras);
    setContasExtras((prev) => [...prev, { nome, numero }].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
    setExtratosPorBanco((prev) => ({ ...prev, [nome]: Array.isArray(prev[nome]) ? prev[nome] : [] }));
    setInstituicaoSelecionada(nome);
    setNomeNovaContaBancaria('');
    setMsgNovaContaBancaria({ kind: 'success', text: `Conta "${nome}" criada — identificação Nº ${numero} no consolidado.` });
  }

  async function importarOfxArquivo(file) {
    try {
      if (extratosInativosSet.has(instituicaoSelecionada)) {
        setOfxStatus({
          kind: 'error',
          message: `Extrato ${instituicaoSelecionada} está inativo (conta encerrada). Reative para importar OFX.`,
        });
        return;
      }
      setOfxStatus({ kind: 'loading', message: `Importando OFX para ${instituicaoSelecionada}...` });
      const text = await readFileAsText(file);
      const extrato = parseOfxToExtrato(text, { nomeBanco: instituicaoSelecionada });
      if (!extrato.length) {
        setOfxStatus({ kind: 'error', message: 'Arquivo OFX não contém lançamentos (<STMTTRN>).' });
        return;
      }
      const modo = substituirExtratoOfxCompleto ? 'substituir' : 'mesclar';
      let novosContados = 0;
      setExtratosPorBanco((prev) => {
        const atual = prev[instituicaoSelecionada] ?? [];
        novosContados = modo === 'mesclar' ? contarLancamentosNovos(atual, extrato) : extrato.length;
        return aplicarExtratoNoBanco(prev, instituicaoSelecionada, extrato, modo);
      });
      const base =
        modo === 'mesclar'
          ? `OFX: +${novosContados} lanç. novos em ${instituicaoSelecionada} (${extrato.length - novosContados} duplicados ignorados). Extrato anterior mantido.`
          : `OFX: extrato de ${instituicaoSelecionada} substituído (${extrato.length} lanç.).`;
      setOfxStatus({
        kind: 'success',
        message: `${base} Lançamentos novos na letra N (Conta Não Identificados) até você reclassificar ou usar Parear compensações.`,
      });
    } catch (e) {
      setOfxStatus({ kind: 'error', message: `Falha ao importar OFX: ${e?.message || String(e)}` });
    }
  }

  function carregarOfxExemploItau() {
    if (extratosInativosSet.has('Itaú')) {
      setOfxStatus({
        kind: 'error',
        message: 'Extrato Itaú está inativo. Reative para importar OFX.',
      });
      return;
    }
    const extrato = parseOfxToExtrato(OFX_ITAU_REAL_EXEMPLO, { nomeBanco: 'Itaú' });
    if (!extrato.length) {
      setOfxStatus({ kind: 'error', message: 'OFX exemplo Itaú inválido.' });
      return;
    }
    let novos = 0;
    setInstituicaoSelecionada('Itaú');
    setExtratosPorBanco((prev) => {
      novos = contarLancamentosNovos(prev['Itaú'] ?? [], extrato);
      return aplicarExtratoNoBanco(prev, 'Itaú', extrato, 'mesclar');
    });
    setOfxStatus({
      kind: 'success',
      message: `Itaú: +${novos} lanç. novos (OFX real). Demais bancos preservados. Novos em N até reclassificar.`,
    });
  }

  function carregarOfxExemploCora() {
    if (extratosInativosSet.has('CORA')) {
      setOfxStatus({
        kind: 'error',
        message: 'Extrato CORA está inativo. Reative para importar OFX.',
      });
      return;
    }
    const extrato = parseOfxToExtrato(OFX_CORA_REAL_EXEMPLO, { nomeBanco: 'CORA' });
    if (!extrato.length) {
      setOfxStatus({ kind: 'error', message: 'OFX exemplo Cora inválido.' });
      return;
    }
    let novos = 0;
    setInstituicaoSelecionada('CORA');
    setExtratosPorBanco((prev) => {
      novos = contarLancamentosNovos(prev.CORA ?? [], extrato);
      return aplicarExtratoNoBanco(prev, 'CORA', extrato, 'mesclar');
    });
    setOfxStatus({
      kind: 'success',
      message: `CORA: +${novos} lanç. novos (OFX real). Demais bancos preservados. Novos em N até reclassificar.`,
    });
  }

  // Persistência robusta: salva extratos (incluindo mocks importados e edições) no localStorage.
  useEffect(() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      persistirFallbackExtratos(extratosPorBanco);
    }, 250);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [extratosPorBanco]);

  useEffect(() => {
    if (inativosSaveTimerRef.current) window.clearTimeout(inativosSaveTimerRef.current);
    inativosSaveTimerRef.current = window.setTimeout(() => {
      savePersistedExtratosInativosFinanceiro(extratosInativos);
    }, 250);
    return () => {
      if (inativosSaveTimerRef.current) window.clearTimeout(inativosSaveTimerRef.current);
    };
  }, [extratosInativos]);

  useEffect(() => {
    if (contasExtrasSaveTimerRef.current) window.clearTimeout(contasExtrasSaveTimerRef.current);
    contasExtrasSaveTimerRef.current = window.setTimeout(() => {
      savePersistedContasExtrasFinanceiro(contasExtras);
    }, 250);
    return () => {
      if (contasExtrasSaveTimerRef.current) window.clearTimeout(contasExtrasSaveTimerRef.current);
    };
  }, [contasExtras]);

  useEffect(() => {
    if (contasContabeisExtrasSaveTimerRef.current) window.clearTimeout(contasContabeisExtrasSaveTimerRef.current);
    contasContabeisExtrasSaveTimerRef.current = window.setTimeout(() => {
      savePersistedContasContabeisExtrasFinanceiro(contasContabeisExtras);
    }, 250);
    return () => {
      if (contasContabeisExtrasSaveTimerRef.current) {
        window.clearTimeout(contasContabeisExtrasSaveTimerRef.current);
      }
    };
  }, [contasContabeisExtras]);

  useEffect(() => {
    if (contasContabeisInativasSaveTimerRef.current) {
      window.clearTimeout(contasContabeisInativasSaveTimerRef.current);
    }
    contasContabeisInativasSaveTimerRef.current = window.setTimeout(() => {
      savePersistedContasContabeisInativasFinanceiro(contasContabeisInativas);
    }, 250);
    return () => {
      if (contasContabeisInativasSaveTimerRef.current) {
        window.clearTimeout(contasContabeisInativasSaveTimerRef.current);
      }
    };
  }, [contasContabeisInativas]);

  useEffect(() => {
    if (linhaConsolidadoAlvo && linhaConsolidadoRef.current) {
      linhaConsolidadoRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [linhaConsolidadoAlvo, contaContabilSelecionada]);

  useEffect(() => {
    if (linhaBancoAlvo && linhaBancoRef.current && instituicaoSelecionada === linhaBancoAlvo.nomeBanco) {
      linhaBancoRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [linhaBancoAlvo, instituicaoSelecionada]);

  /** Vindo de Processos (duplo clique na Conta Corrente): abre consolidado + extrato na linha exata. */
  useEffect(() => {
    const alvo = location.state?.financeiroContaCorrenteLinha;
    if (!alvo?.nomeBanco || alvo.numero == null || alvo.numero === '' || !alvo.data) return;
    const nomeBanco = alvo.nomeBanco;
    const numero = String(alvo.numero);
    const data = alvo.data;
    setInstituicaoSelecionada(nomeBanco);
    if (extratosInativos.includes(nomeBanco)) setMostrarExtratosInativos(true);
    setContaContabilSelecionada(contaEscritorioOuPrimeiraAtiva(contasContabeisInativasSet, ordemNomesContabeis));
    const rowKey = `${nomeBanco}-${numero}-${data}`;
    setLinhaConsolidadoAlvo(rowKey);
    setLinhaConsolidadoFoco(rowKey);
    setLinhaBancoAlvo({ nomeBanco, numero, data });
    navigate(location.pathname, { replace: true, state: {} });
  }, [
    location.state,
    location.pathname,
    navigate,
    extratosInativos,
    contasContabeisInativasSet,
    ordemNomesContabeis,
  ]);

  /** Vindo de Cálculos → aba Honorários: conciliação com mesmo cliente/proc na Conta Escritório. */
  useEffect(() => {
    const alvo = location.state?.financeiroConciliacaoHonorarios;
    if (!alvo?.codCliente) return;
    setContaContabilSelecionada(contaEscritorioOuPrimeiraAtiva(contasContabeisInativasSet, ordemNomesContabeis));
    setFiltroConciliacaoHonorarios({
      codCliente: String(alvo.codCliente ?? '').trim(),
      proc: String(alvo.proc ?? '').trim(),
      rotulo: String(alvo.rotulo ?? '').trim(),
      valorCentavos:
        alvo.valorCentavos != null && Number.isFinite(Number(alvo.valorCentavos))
          ? Math.round(Number(alvo.valorCentavos))
          : null,
    });
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate, contasContabeisInativasSet, ordemNomesContabeis]);

  /** Vindo de Cálculos → aba Parcelamento: abre modal de busca automática (sem precisar informar cliente/proc). */
  useEffect(() => {
    const alvo = location.state?.financeiroBuscaParcelas;
    if (!alvo || typeof alvo !== 'object') return;
    setModalBuscaParcelas(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate]);

  const ofxBloqueadoExtratoInativo = extratosInativosSet.has(instituicaoSelecionada);

  function onChangeTipoPeriodo(novo) {
    setPeriodoVisao(novo);
    if (novo === 'personalizado') {
      const { ini, fim } = limitesMesBr(periodoAno, periodoMes);
      setPeriodoPersonalInicio((p) => (String(p ?? '').trim() ? p : ini));
      setPeriodoPersonalFim((p) => (String(p ?? '').trim() ? p : fim));
    }
  }

  function renderBarraFiltroPeriodo(suffix) {
    const mostrarAno =
      periodoVisao === 'mes' ||
      periodoVisao === 'bimestre' ||
      periodoVisao === 'trimestre' ||
      periodoVisao === 'semestre' ||
      periodoVisao === 'ano';
    return (
      <div
        className={`flex flex-wrap items-end gap-x-2 gap-y-1.5 rounded-md border border-slate-200 bg-slate-50/95 px-2 py-1.5 ${
          suffix === 'extrato' ? 'max-w-full' : ''
        }`}
        title={
          suffix === 'extrato'
            ? 'No extrato bancário, a coluna Saldo reflete o extrato completo; só a lista é filtrada por data.'
            : undefined
        }
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <label htmlFor={`periodo-tipo-${suffix}`} className="text-[10px] font-medium text-slate-600 whitespace-nowrap">
            Filtrar por
          </label>
          <select
            id={`periodo-tipo-${suffix}`}
            value={periodoVisao}
            onChange={(e) => onChangeTipoPeriodo(e.target.value)}
            className="text-xs border border-slate-300 rounded-md px-1.5 py-1 bg-white text-slate-800 min-w-[8.5rem] max-w-full shadow-sm"
          >
            <option value="todos">Todos</option>
            <option value="mes">Mês / ano</option>
            <option value="bimestre">Bimestre</option>
            <option value="trimestre">Trimestre</option>
            <option value="semestre">Semestre</option>
            <option value="ano">Ano</option>
            <option value="personalizado">Período personalizado</option>
          </select>
        </div>
        {periodoVisao === 'mes' && (
          <div className="flex flex-col gap-0.5">
            <label htmlFor={`periodo-mes-${suffix}`} className="text-[10px] text-slate-600">
              Mês
            </label>
            <select
              id={`periodo-mes-${suffix}`}
              value={periodoMes}
              onChange={(e) => setPeriodoMes(Number(e.target.value))}
              className="text-xs border border-slate-300 rounded-md px-1.5 py-1 bg-white text-slate-800 min-w-[6.5rem] shadow-sm"
            >
              {MESES_PT.map((nome, i) => (
                <option key={nome} value={i + 1}>
                  {nome}
                </option>
              ))}
            </select>
          </div>
        )}
        {periodoVisao === 'bimestre' && (
          <div className="flex flex-col gap-0.5">
            <label htmlFor={`periodo-bi-${suffix}`} className="text-[10px] text-slate-600">
              Bimestre
            </label>
            <select
              id={`periodo-bi-${suffix}`}
              value={periodoBimestre}
              onChange={(e) => setPeriodoBimestre(Number(e.target.value))}
              className="text-xs border border-slate-300 rounded-md px-1.5 py-1 bg-white text-slate-800 min-w-[7rem] shadow-sm"
            >
              <option value={1}>1º — jan, fev</option>
              <option value={2}>2º — mar, abr</option>
              <option value={3}>3º — mai, jun</option>
              <option value={4}>4º — jul, ago</option>
              <option value={5}>5º — set, out</option>
              <option value={6}>6º — nov, dez</option>
            </select>
          </div>
        )}
        {periodoVisao === 'trimestre' && (
          <div className="flex flex-col gap-0.5">
            <label htmlFor={`periodo-trim-${suffix}`} className="text-[10px] text-slate-600">
              Trim.
            </label>
            <select
              id={`periodo-trim-${suffix}`}
              value={periodoTrimestre}
              onChange={(e) => setPeriodoTrimestre(Number(e.target.value))}
              className="text-xs border border-slate-300 rounded-md px-1.5 py-1 bg-white text-slate-800 min-w-[6.5rem] shadow-sm"
            >
              <option value={1}>1º</option>
              <option value={2}>2º</option>
              <option value={3}>3º</option>
              <option value={4}>4º</option>
            </select>
          </div>
        )}
        {periodoVisao === 'semestre' && (
          <div className="flex flex-col gap-0.5">
            <label htmlFor={`periodo-sem-${suffix}`} className="text-[10px] text-slate-600">
              Sem.
            </label>
            <select
              id={`periodo-sem-${suffix}`}
              value={periodoSemestre}
              onChange={(e) => setPeriodoSemestre(Number(e.target.value))}
              className="text-xs border border-slate-300 rounded-md px-1.5 py-1 bg-white text-slate-800 min-w-[6rem] shadow-sm"
            >
              <option value={1}>1º — jan a jun</option>
              <option value={2}>2º — jul a dez</option>
            </select>
          </div>
        )}
        {mostrarAno && (
          <div className="flex flex-col gap-0.5">
            <label htmlFor={`periodo-ano-${suffix}`} className="text-[10px] text-slate-600">
              Ano
            </label>
            <select
              id={`periodo-ano-${suffix}`}
              value={periodoAno}
              onChange={(e) => setPeriodoAno(Number(e.target.value))}
              className="text-xs border border-slate-300 rounded-md px-1.5 py-1 bg-white text-slate-800 min-w-[4.25rem] shadow-sm"
            >
              {anosParaSelectPeriodo.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        )}
        {periodoVisao === 'personalizado' && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-0.5">
              <label htmlFor={`periodo-de-${suffix}`} className="text-[10px] text-slate-600">
                De
              </label>
              <input
                id={`periodo-de-${suffix}`}
                type="text"
                inputMode="numeric"
                placeholder="dd/mm/aaaa"
                value={periodoPersonalInicio}
                onChange={(e) => setPeriodoPersonalInicio(e.target.value)}
                className="text-xs border border-slate-300 rounded-md px-1.5 py-1 bg-white text-slate-800 w-[6.75rem] shadow-sm"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label htmlFor={`periodo-ate-${suffix}`} className="text-[10px] text-slate-600">
                Até
              </label>
              <input
                id={`periodo-ate-${suffix}`}
                type="text"
                inputMode="numeric"
                placeholder="dd/mm/aaaa"
                value={periodoPersonalFim}
                onChange={(e) => setPeriodoPersonalFim(e.target.value)}
                className="text-xs border border-slate-300 rounded-md px-1.5 py-1 bg-white text-slate-800 w-[6.75rem] shadow-sm"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-100 flex flex-col">
      <header className="px-4 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800">Financeiro</h1>
            <button
              type="button"
              onClick={() => setModalConfigFinanceiro(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 shrink-0"
              title="Adicionar conta bancária ou conta contábil"
            >
              <Settings className="w-4 h-4 text-slate-600" aria-hidden />
              Configurações
            </button>
            <label htmlFor="layout-relatorios-financeiro" className="sr-only">
              Disposição do extrato do banco e do consolidado
            </label>
            <select
              id="layout-relatorios-financeiro"
              value={disposicaoRelatorios}
              onChange={(e) => setDisposicaoRelatorios(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 bg-white text-slate-800 max-w-[min(100%,15rem)] shadow-sm shrink-0"
              title="Empilhados ou lado a lado (quando os dois painéis estão visíveis)"
            >
              <option value="empilhado">Extrato + consolidado: empilhados</option>
              <option value="lado_a_lado">Extrato + consolidado: lado a lado</option>
            </select>
            <label htmlFor="paineis-relatorios-financeiro" className="sr-only">
              Quais painéis exibir
            </label>
            <select
              id="paineis-relatorios-financeiro"
              value={paineisRelatorios}
              onChange={(e) => setPaineisRelatorios(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 bg-white text-slate-800 max-w-[min(100%,16rem)] shadow-sm shrink-0"
              title="Extrato do banco, consolidado das contas contábeis ou ambos"
            >
              <option value="ambos">Mostrar extrato e consolidado</option>
              <option value="so_extrato">Só extrato (banco)</option>
              <option value="so_consolidado">Só contas contábeis (consolidado)</option>
            </select>
            <label htmlFor="ordem-relatorios-financeiro" className="sr-only">
              Ordem do extrato e do consolidado
            </label>
            <select
              id="ordem-relatorios-financeiro"
              value={ordemRelatorios}
              onChange={(e) => setOrdemRelatorios(e.target.value)}
              disabled={paineisRelatorios !== 'ambos'}
              className={`text-sm border border-slate-300 rounded-lg px-2 py-1.5 bg-white text-slate-800 max-w-[min(100%,17rem)] shadow-sm shrink-0 ${
                paineisRelatorios !== 'ambos' ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title={
                paineisRelatorios !== 'ambos'
                  ? 'Disponível quando extrato e consolidado estão visíveis'
                  : 'Na pilha: qual bloco vem primeiro. Lado a lado: qual coluna fica à esquerda (extrato primeiro = extrato à esquerda)'
              }
            >
              <option value="extrato_primeiro">Ordem: extrato primeiro (à esquerda no lado a lado)</option>
              <option value="consolidado_primeiro">Ordem: consolidado primeiro (à esquerda no lado a lado)</option>
            </select>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <button
              type="button"
              disabled={ofxBloqueadoExtratoInativo}
              onClick={() => fileInputOfxRef.current?.click()}
              className={`px-4 py-2 rounded-lg text-sm font-semibold shadow-sm ${
                ofxBloqueadoExtratoInativo
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
              title={
                ofxBloqueadoExtratoInativo
                  ? 'Extrato inativo — reative para importar OFX'
                  : `Importar OFX em ${instituicaoSelecionada} (mescla por padrão)`
              }
            >
              Importar OFX ({instituicaoSelecionada})
            </button>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={substituirExtratoOfxCompleto}
                onChange={(e) => setSubstituirExtratoOfxCompleto(e.target.checked)}
              />
              Substituir todo o extrato deste banco
            </label>
            <button
              type="button"
              disabled={extratosInativosSet.has('Itaú')}
              onClick={carregarOfxExemploItau}
              className={`px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium ${
                extratosInativosSet.has('Itaú')
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-white text-slate-800 hover:bg-slate-50'
              }`}
              title="Mescla OFX de exemplo (estrutura Itaú, anonimizado) ao extrato atual"
            >
              + OFX real Itaú
            </button>
            <button
              type="button"
              disabled={extratosInativosSet.has('CORA')}
              onClick={carregarOfxExemploCora}
              className={`px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium ${
                extratosInativosSet.has('CORA')
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-white text-slate-800 hover:bg-slate-50'
              }`}
              title="Mescla OFX real (estrutura Cora, anonimizado) — não apaga mock"
            >
              + OFX real Cora
            </button>
            <button
              type="button"
              onClick={() => {
                const pares = detectarParesCompensacao(extratosPorBanco);
                setModalParearCompensacao({ pares });
              }}
              className="px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-sm font-medium hover:bg-amber-100"
              title="1) Identifica pares entre extratos; 2) Aplica Elo 0001… na Conta Compensação"
            >
              Parear compensações
            </button>
            <button
              type="button"
              onClick={() => abrirModalBuscaParcelas()}
              className="px-3 py-2 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-900 text-sm font-medium hover:bg-indigo-100"
              title="Compara extratos não classificados com parcelas de cálculos aceitos; você só aprova o vínculo"
            >
              Buscar parcelas (Cálculos)
            </button>
            {featureFlags.useApiFinanceiro ? (
              <button
                type="button"
                onClick={() => void abrirPreviaImportacaoLegadoFinanceiro()}
                disabled={importLegadoLoadingPreview || importLegadoExecutando}
                className={`px-3 py-2 rounded-lg border text-sm font-medium ${
                  importLegadoLoadingPreview || importLegadoExecutando
                    ? 'border-slate-300 bg-slate-100 text-slate-500 cursor-not-allowed'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                }`}
                title="Prévia e importação assistida do legado localStorage para API"
              >
                {importLegadoLoadingPreview ? 'Carregando prévia...' : 'Importar legado financeiro'}
              </button>
            ) : null}
            {ofxStatus.kind !== 'idle' && (
              <span
                className={`text-xs ${
                  ofxStatus.kind === 'error'
                    ? 'text-red-700'
                    : ofxStatus.kind === 'success'
                      ? 'text-green-700'
                      : ofxStatus.kind === 'info'
                        ? 'text-indigo-700'
                        : 'text-slate-600'
                }`}
              >
                {ofxStatus.message}
              </span>
            )}
            {featureFlags.useApiFinanceiro && apiFinanceiroLoading ? (
              <span className="text-xs text-indigo-700">Carregando dados financeiros da API...</span>
            ) : null}
            {featureFlags.useApiFinanceiro && apiFinanceiroErro ? (
              <span className="text-xs text-red-700">{apiFinanceiroErro}</span>
            ) : null}
          </div>
        </div>
        {featureFlags.useApiFinanceiro && importLegadoPreview ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-slate-800 space-y-2">
            <p className="font-semibold text-emerald-900">Prévia: migração assistida do legado financeiro</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>Total legado encontrado: <strong>{importLegadoPreview.totalLegado ?? 0}</strong></span>
              <span>Potencialmente importável (estimado): <strong>{importLegadoPreview.importavelEstimado ?? 0}</strong></span>
              <span>Potenciais duplicados (estimado): <strong>{importLegadoPreview.duplicadoEstimado ?? 0}</strong></span>
              <span>Sem vínculo resolvido (estimado): <strong>{importLegadoPreview.semVinculoEstimado ?? 0}</strong></span>
            </div>
            <p>
              Fontes localStorage consideradas: {(importLegadoPreview.storageKeysLidas || []).join(', ') || 'n/d'}.
            </p>
            <p>
              Marker: <strong>{importLegadoPreview.markerKey}</strong> — status:{' '}
              <strong>{importLegadoStatus.jaExecutada ? 'já executada' : 'ainda não executada'}</strong>.
            </p>
            {importLegadoPreview.observacao ? (
              <p className="text-slate-700">{importLegadoPreview.observacao}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void executarImportacaoLegadoFinanceiroViaUi()}
                disabled={
                  importLegadoExecutando ||
                  importLegadoStatus.jaExecutada ||
                  !importLegadoStatus.habilitadaPorFlag ||
                  !importLegadoStatus.apiFinanceiroAtiva
                }
                className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                  importLegadoExecutando ||
                  importLegadoStatus.jaExecutada ||
                  !importLegadoStatus.habilitadaPorFlag ||
                  !importLegadoStatus.apiFinanceiroAtiva
                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-700 text-white hover:bg-emerald-800'
                }`}
              >
                {importLegadoExecutando ? 'Importando...' : 'Confirmar e importar legado'}
              </button>
              {importLegadoStatus.jaExecutada ? (
                <span className="text-amber-800">Reimportação manual ainda não liberada nesta etapa.</span>
              ) : null}
            </div>
            {importLegadoResumo ? (
              <p className="text-emerald-900">
                Resumo final: importados <strong>{importLegadoResumo.importados}</strong>, ignorados{' '}
                <strong>{importLegadoResumo.ignorados}</strong>, sem vínculo <strong>{importLegadoResumo.semVinculo}</strong>, total
                lido <strong>{importLegadoResumo.totalLidos}</strong>.
              </p>
            ) : null}
          </div>
        ) : null}
      </header>
      {filtroConciliacaoHonorarios && (
        <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-200 text-sm text-indigo-950 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <p>
            <strong>Conciliação (Honorários — Cálculos):</strong> cliente{' '}
            <span className="tabular-nums font-semibold">{filtroConciliacaoHonorarios.codCliente}</span>, proc.{' '}
            <span className="tabular-nums font-semibold">{filtroConciliacaoHonorarios.proc || '—'}</span>
            {filtroConciliacaoHonorarios.rotulo ? (
              <>
                {' '}
                — <span className="text-indigo-800">{filtroConciliacaoHonorarios.rotulo}</span>
              </>
            ) : null}
            . Lista filtrada na <strong>Conta Escritório</strong> (mesmos critérios da Conta Corrente em Processos).
            {filtroConciliacaoHonorarios.valorCentavos != null && (
              <span className="ml-1">
                Destaque em linhas com valor ={' '}
                <strong className="tabular-nums">
                  {formatValor(filtroConciliacaoHonorarios.valorCentavos / 100)}
                </strong>
                .
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={() => setFiltroConciliacaoHonorarios(null)}
            className="px-2 py-1 rounded border border-indigo-300 bg-white text-indigo-900 text-xs font-medium hover:bg-indigo-100 shrink-0"
          >
            Remover filtro
          </button>
        </div>
      )}

      <div className="flex-1 p-6 space-y-8 overflow-auto">
        {/* Extratos bancários (OFX) */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Extratos bancários (OFX)</h2>
          <p className="text-xs text-slate-500 mb-3">
            Por padrão, cada importação <strong>acrescenta</strong> lançamentos (sem apagar mock nem OFX já
            importados). Duplicatas (mesmo FITID + data + valor) são ignoradas. Os dados são salvos no navegador.
            Cada lançamento <strong>novo</strong> importado entra na letra <strong>N</strong> (Conta Não Identificados) e
            permanece nela até você reclassificar no extrato ou usar <strong>Parear compensações</strong> para
            identificar pares entre bancos (mesmo dia, valor oposto exato). Use{' '}
            <strong>Substituir todo o extrato deste banco</strong> só se quiser trocar o extrato inteiro da instituição
            selecionada. Extratos <strong>inativos</strong> indicam conta encerrada: o histórico permanece salvo, mas o
            extrato some da lista principal e não recebe novas importações OFX até você reativar. Use o botão{' '}
            <strong>Configurações</strong> no topo para criar instituições além das padrão: cada uma recebe um{' '}
            <strong>Nº sequencial</strong> no consolidado (após o maior número já cadastrado) e passa a integrar OFX,
            compensações e contas contábeis como as demais.
          </p>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 mb-3 text-xs text-slate-800 space-y-1.5">
            <p>
              <strong className="text-emerald-900">Letra A — Conta Escritório:</strong> todo lançamento que você
              classificar com <strong>A</strong> no extrato entra na conta contábil <strong>Conta Escritório</strong> e
              pode compor a <strong>Conta Corrente</strong> do processo em <strong>Processos</strong>. Para isso,
              preencha <strong>Cod. Cliente</strong> e <strong>Proc.</strong> de forma coerente com o cadastro.
            </p>
            <p>
              <strong className="text-amber-900">Letra E — Conta Compensação:</strong> usada para{' '}
              <strong>anular</strong> pares (mesmo <strong>Elo</strong>, número natural — ex. 0001, 0002…): a{' '}
              <strong>soma dos valores</strong> de cada Elo deve ser <strong>zero</strong>, registrando só a{' '}
              <strong>mudança de numerário</strong> entre bancos, sem efeito líquido nas outras contas contábeis. Use{' '}
              <strong>Parear compensações</strong> no topo para identificar e aplicar Elos.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={mostrarExtratosInativos}
                onChange={(e) => setMostrarExtratosInativos(e.target.checked)}
                disabled={extratosInativos.length === 0}
              />
              Mostrar extratos inativos (arquivados)
            </label>
            {extratosInativosSet.has(instituicaoSelecionada) ? (
              <button
                type="button"
                onClick={reativarExtratoSelecionado}
                className="px-3 py-1.5 rounded-lg border border-green-600 bg-green-50 text-green-900 text-xs font-medium hover:bg-green-100"
              >
                Reativar extrato selecionado
              </button>
            ) : (
              <button
                type="button"
                onClick={inativarExtratoSelecionado}
                className="px-3 py-1.5 rounded-lg border border-slate-400 bg-white text-slate-800 text-xs font-medium hover:bg-slate-50"
              >
                Inativar extrato selecionado
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <button
              type="button"
              disabled={ofxBloqueadoExtratoInativo}
              onClick={() => fileInputOfxRef.current?.click()}
              className={`px-4 py-2 rounded-lg text-sm font-semibold shadow-sm ${
                ofxBloqueadoExtratoInativo
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
              title={
                ofxBloqueadoExtratoInativo
                  ? 'Extrato inativo — reative para importar OFX'
                  : `Importar OFX e atualizar o extrato de ${instituicaoSelecionada}`
              }
            >
              Importar OFX ({instituicaoSelecionada})
            </button>
            <input
              ref={fileInputOfxRef}
              type="file"
              accept=".ofx,application/x-ofx,text/ofx,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) importarOfxArquivo(file);
              }}
            />
            {ofxStatus.kind !== 'idle' && (
              <span
                className={`text-xs ${
                  ofxStatus.kind === 'error'
                    ? 'text-red-700'
                    : ofxStatus.kind === 'success'
                      ? 'text-green-700'
                      : ofxStatus.kind === 'info'
                        ? 'text-indigo-700'
                        : 'text-slate-600'
                }`}
              >
                {ofxStatus.message}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {INSTITUICOES_LINHA_1.filter((nome) => !extratosInativosSet.has(nome)).map((nome) => (
              <button
                key={nome}
                type="button"
                onClick={() => setInstituicaoSelecionada(nome)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  instituicaoSelecionada === nome
                    ? 'bg-slate-200 text-amber-900 border-b-2 border-green-600'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {nome}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {INSTITUICOES_LINHA_2.filter((nome) => !extratosInativosSet.has(nome)).map((nome) => (
              <button
                key={nome}
                type="button"
                onClick={() => setInstituicaoSelecionada(nome)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  instituicaoSelecionada === nome
                    ? 'bg-slate-200 text-amber-900 border-b-2 border-green-600'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {nome}
              </button>
            ))}
            {contasExtras
              .filter((c) => !extratosInativosSet.has(c.nome))
              .map((c) => (
                <button
                  key={c.nome}
                  type="button"
                  onClick={() => setInstituicaoSelecionada(c.nome)}
                  title={`Nº ${c.numero} no consolidado — mesmo fluxo de OFX e contas contábeis`}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    instituicaoSelecionada === c.nome
                      ? 'bg-slate-200 text-amber-900 border-b-2 border-green-600'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {c.nome}{' '}
                  <span className="tabular-nums opacity-90 font-normal">(Nº {c.numero})</span>
                </button>
              ))}
          </div>
          {mostrarExtratosInativos && extratosInativos.length > 0 && (
            <>
              <p className="text-xs text-slate-500 mt-3 mb-1">
                Extratos inativos — histórico preservado; não atualizam por OFX.
              </p>
              <div className="flex flex-wrap gap-2">
                {todasInstituicoesNomes.filter((nome) => extratosInativosSet.has(nome)).map((nome) => (
                  <button
                    key={`inativo-${nome}`}
                    type="button"
                    onClick={() => setInstituicaoSelecionada(nome)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      instituicaoSelecionada === nome
                        ? 'bg-slate-400 text-slate-900 border-b-2 border-slate-600'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    {nome}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Contas contábeis */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Contas contábeis</h2>
          <p className="text-xs text-slate-500 mb-2">
            Lista derivada dos extratos: ordem por lançamentos (mais usadas primeiro). Entre parênteses:
            quantidade e soma dos valores na conta, em todos os bancos. Você pode <strong>inativar</strong> contas que
            não usa no dia a dia (dados preservados) e <strong>criar contas novas</strong> (letra automática G–Z
            disponível) em <strong>Configurações</strong> no topo. Contas inativas continuam no seletor de letra do
            extrato para lançamentos antigos.
          </p>
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm px-3 py-2.5 mb-3 text-xs text-slate-700 space-y-2">
            <p className="font-semibold text-slate-800">Papel de cada conta central</p>
            <ul className="list-disc pl-4 space-y-1.5 text-slate-600">
              <li>
                <strong className="text-slate-800">Conta Escritório (letra A)</strong> — Reúne <strong>todos</strong> os
                lançamentos de extrato com letra <strong>A</strong>. São eles que o sistema considera para a{' '}
                <strong>Conta Corrente</strong> em <strong>Processos</strong>, desde que tenham{' '}
                <strong>Cod. Cliente</strong> e <strong>Proc.</strong> vinculados ao processo em tela.
              </li>
              <li>
                <strong className="text-slate-800">Conta Compensação (letra E)</strong> — Agrupa pares que se{' '}
                <strong>anulam</strong>: cada <strong>Elo</strong> (número natural, ex. 0001) identifica um conjunto
                cuja <strong>soma de valores é zero</strong>. Serve para registrar <strong>só troca de numerário</strong>{' '}
                entre contas bancárias, sem inflar outras contas contábeis com movimentos que não representam receita ou
                despesa do escritório.
              </li>
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={mostrarContasContabeisInativas}
                onChange={(e) => setMostrarContasContabeisInativas(e.target.checked)}
                disabled={contasContabeisInativas.length === 0}
              />
              Mostrar contas contábeis inativas
            </label>
            {contasContabeisInativasSet.has(contaContabilSelecionada) ? (
              <button
                type="button"
                onClick={reativarContaContabilSelecionada}
                className="px-3 py-1.5 rounded-lg border border-green-600 bg-green-50 text-green-900 text-xs font-medium hover:bg-green-100"
              >
                Reativar conta selecionada
              </button>
            ) : (
              <button
                type="button"
                onClick={inativarContaContabilSelecionada}
                className="px-3 py-1.5 rounded-lg border border-slate-400 bg-white text-slate-800 text-xs font-medium hover:bg-slate-50"
              >
                Inativar conta selecionada
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {contasLinha1.map(({ nome, letra, count, saldo }) => {
              const isExtra = contasContabeisExtras.some((c) => c.nome === nome);
              return (
                <button
                  key={nome}
                  type="button"
                  onClick={() => setContaContabilSelecionada(nome)}
                  title={
                    count > 0
                      ? `Letra ${letra}: ${count} lançamento(s) · Σ valores ${formatValor(saldo)}`
                      : `Letra ${letra}: sem lançamentos nos extratos atuais`
                  }
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    contaContabilSelecionada === nome
                      ? isExtra
                        ? 'bg-indigo-400 text-slate-900 font-semibold ring-2 ring-indigo-600'
                        : 'bg-green-400 text-slate-900 font-semibold'
                      : count > 0
                        ? isExtra
                          ? 'bg-indigo-200 text-slate-800 hover:bg-indigo-300'
                          : 'bg-green-200 text-slate-800 hover:bg-green-300'
                        : isExtra
                          ? 'bg-indigo-100 text-slate-600 hover:bg-indigo-200'
                          : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                  }`}
                >
                  <span className="hidden sm:inline">{nome}</span>
                  <span className="sm:hidden" title={nome}>
                    {letra}
                  </span>
                  {count > 0 && (
                    <span className="text-xs opacity-90 ml-1 font-normal">
                      ({count} · {formatValor(saldo)})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {contasLinha2.map(({ nome, letra, count, saldo }) => {
              const isExtra = contasContabeisExtras.some((c) => c.nome === nome);
              return (
                <button
                  key={nome}
                  type="button"
                  onClick={() => setContaContabilSelecionada(nome)}
                  title={
                    count > 0
                      ? `Letra ${letra}: ${count} lançamento(s) · Σ valores ${formatValor(saldo)}`
                      : `Letra ${letra}: sem lançamentos nos extratos atuais`
                  }
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    contaContabilSelecionada === nome
                      ? isExtra
                        ? 'bg-indigo-400 text-slate-900 font-semibold ring-2 ring-indigo-600'
                        : 'bg-green-400 text-slate-900 font-semibold'
                      : count > 0
                        ? isExtra
                          ? 'bg-indigo-200 text-slate-800 hover:bg-indigo-300'
                          : 'bg-green-200 text-slate-800 hover:bg-green-300'
                        : isExtra
                          ? 'bg-indigo-100 text-slate-600 hover:bg-indigo-200'
                          : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                  }`}
                >
                  <span className="hidden sm:inline">{nome}</span>
                  <span className="sm:hidden" title={nome}>
                    {letra}
                  </span>
                  {count > 0 && (
                    <span className="text-xs opacity-90 ml-1 font-normal">
                      ({count} · {formatValor(saldo)})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {mostrarContasContabeisInativas && contasContabeisInativas.length > 0 && (
            <>
              <p className="text-xs text-slate-500 mt-3 mb-1">
                Contas inativas — consolidado e chips principais ocultam; lançamentos e letras preservados.
              </p>
              <div className="flex flex-wrap gap-2">
                {contasDerivadasDosExtratos
                  .filter((c) => contasContabeisInativasSet.has(c.nome))
                  .map(({ nome, letra, count, saldo }) => (
                    <button
                      key={`inativa-cc-${nome}`}
                      type="button"
                      onClick={() => setContaContabilSelecionada(nome)}
                      title={`Letra ${letra}${count > 0 ? ` · ${count} lanç. · ${formatValor(saldo)}` : ''}`}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        contaContabilSelecionada === nome
                          ? 'bg-slate-400 text-slate-900 border-b-2 border-slate-600'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      <span className="hidden sm:inline">{nome}</span>
                      <span className="sm:hidden">{letra}</span>
                      {count > 0 && (
                        <span className="text-xs opacity-90 ml-1 font-normal">
                          ({count} · {formatValor(saldo)})
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            </>
          )}
        </section>

        {/* Extrato do banco + consolidado (disposição alternável) */}
        {(mostrarPainelExtrato || mostrarPainelConsolidado) && (
          <div className={classeWrapperRelatorios}>
        {mostrarPainelExtrato && (
          <section
            className={`bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0 ${classOrdemExtrato} ${
              relatoriosLadoALado ? 'xl:flex-1 xl:min-w-0 xl:max-h-[min(92vh,960px)]' : ''
            }`}
          >
            <div className="px-4 py-3 border-b border-slate-200 shrink-0">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-3 w-full">
                <div className="flex flex-wrap items-end gap-3 min-w-0 shrink-0">
                  <h2 className="text-base font-bold text-slate-800 uppercase shrink-0 leading-none pb-1">
                    Conta Corrente {instituicaoSelecionada}
                  </h2>
                  <div className="flex items-center gap-2">
                    <label htmlFor="limite-lanc-extrato" className="text-xs text-slate-600 whitespace-nowrap">
                      Lançamentos na tela:
                    </label>
                    <select
                      id="limite-lanc-extrato"
                      value={limiteLancamentosExtratoBanco}
                      onChange={(e) => setLimiteLancamentosExtratoBanco(Number(e.target.value))}
                      className="text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white text-slate-800 min-w-[5.5rem] shadow-sm"
                      title="Quantidade máxima de linhas exibidas (ordem atual da tabela)"
                    >
                      {OPCOES_LIMITE_LANCAMENTOS_EXTRATO.map((o) => (
                        <option key={o.v} value={o.v}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="w-full min-[900px]:w-auto min-[900px]:flex-1 min-[900px]:min-w-[12rem] flex justify-center min-w-0">
                  {renderBarraFiltroPeriodo('extrato')}
                </div>
              </div>
            </div>
            <div className={relatoriosLadoALado ? 'flex flex-col flex-1 min-h-0' : ''}>
            <div className={relatoriosLadoALado ? 'flex-1 min-h-0 overflow-auto' : 'overflow-x-auto'}>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-20 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('letra')} title="Duplo clique: ordenar A→Z / Z→A">Letra</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-16 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('numero')} title="Duplo clique: ordenar">Nº</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-24 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('data')} title="Duplo clique: data mais recente primeiro; de novo: mais antiga primeiro">Data</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600 border-r border-slate-200 min-w-[180px] cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('descricao')} title="Duplo clique: ordenar A→Z / Z→A">Descrição</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-28 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('valor')} title="Duplo clique: ordenar crescente ↔ decrescente">Valor</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600 border-r border-slate-200 min-w-[140px] cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('saldo')} title="Duplo clique: ordenar crescente ↔ decrescente">Saldo</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600 border-r border-slate-200 min-w-[120px] cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('categoria')} title="Mesmo texto que Descrição / Contraparte no consolidado. Duplo clique: ordenar A→Z / Z→A">Categoria / Obs.</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-20 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('codCliente')} title="Duplo clique: ordenar">Cod. Cliente</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-16 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('proc')} title="Duplo clique: ordenar">Proc.</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-16 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('ref')} title="Mesmo valor que Ref. no consolidado. Duplo clique: ordenar">Ref.</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-20 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('dimensao')} title="Mesmo texto que Eq. no consolidado. Duplo clique: ordenar">Dimensão</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600 w-20 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('parcela')} title="Duplo clique: ordenar">Parcela</th>
                    <th className="text-center py-2 px-2 font-medium text-slate-600 w-12" title="Buscar cliente e processo por nome/réu e vincular sem sair da tela">
                      Vinc.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const total = listaExtratoBancoVisivel.length;
                    const maxLinhas =
                      limiteLancamentosExtratoBanco === 0 ? total : limiteLancamentosExtratoBanco;
                    return listaExtratoBancoVisivel.slice(0, maxLinhas).map((t) => {
                    const isLinhaBancoAlvo = linhaBancoAlvo?.nomeBanco === instituicaoSelecionada && linhaBancoAlvo?.numero === t.numero && linhaBancoAlvo?.data === t.data;
                    const letraLinha = String(t.letra ?? '').trim().toUpperCase();
                    const letraSemOpcao = letraLinha && !letrasOrdenadasParaSelect.includes(letraLinha);
                    return (
                    <tr
                      key={`${t.letra}-${t.numero}-${t.data}`}
                      ref={isLinhaBancoAlvo ? linhaBancoRef : undefined}
                      className={`border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer ${isLinhaBancoAlvo ? 'ring-1 ring-blue-500 ring-inset bg-blue-50/70' : ''}`}
                      onDoubleClick={() => handleDuploCliqueLinhaBanco(t)}
                      title="Duplo clique para abrir a conta contábil e ir à linha no consolidado"
                    >
                      <td className="py-1.5 px-3 border-r border-slate-100 w-20" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={letraLinha}
                          onChange={(e) => updateLetraLancamento(instituicaoSelecionada, t.numero, t.data, e.target.value)}
                          className="w-full min-w-[6rem] py-0.5 px-1 text-slate-700 text-sm bg-slate-50 border border-slate-200 rounded cursor-pointer text-left"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {letraSemOpcao && (
                            <option value={letraLinha}>
                              {letraLinha} (remapear)
                            </option>
                          )}
                          {letrasOrdenadasParaSelect.map((l) => {
                            const nomeConta = letraToContaMerged[l];
                            const inativa = nomeConta && contasContabeisInativasSet.has(nomeConta);
                            return (
                              <option key={l} value={l}>
                                {l}
                                {inativa ? ' (inativa)' : ''} — {nomeConta ?? l}
                              </option>
                            );
                          })}
                        </select>
                      </td>
                      <td className="py-1.5 px-3 text-slate-500 border-r border-slate-100">{t.numero}</td>
                      <td className="py-1.5 px-3 text-slate-700 border-r border-slate-100">{t.data}</td>
                      <td className="py-1.5 px-3 text-slate-700 border-r border-slate-100">{t.descricao}</td>
                      <td className={`py-1.5 px-3 text-right border-r border-slate-100 font-medium ${t.valor < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {formatValor(t.valor)}
                      </td>
                      <td className={`py-1.5 px-3 text-right border-r border-slate-100 ${t.saldo < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        {formatValor(t.saldo)} {t.saldoDesc}
                      </td>
                      <td className="py-1.5 px-2 text-slate-600 border-r border-slate-100 text-xs min-w-[12rem]" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={textoCategoriaObservacao(t)}
                          onChange={(e) => updateCampoLancamento(instituicaoSelecionada, t.numero, t.data, 'categoria', e.target.value)}
                          className="w-full min-w-[10rem] px-1.5 py-0.5 text-xs bg-white border border-slate-200 rounded"
                          title="Espelha Descrição / Contraparte na conta contábil correspondente"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td
                        className="py-1.5 px-3 text-center text-slate-500 border-r border-slate-100"
                        onDoubleClick={(e) => { e.stopPropagation(); handleDuploCliqueCodCliente(t.codCliente, t.proc); }}
                        title="Duplo clique para abrir o cadastro do cliente e processo"
                      >
                        <input
                          type="text"
                          value={t.codCliente ?? ''}
                          onChange={(e) => updateCampoLancamento(instituicaoSelecionada, t.numero, t.data, 'codCliente', e.target.value)}
                          className="w-16 px-1 py-0.5 text-sm text-center bg-slate-50 border border-slate-200 rounded"
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => { e.stopPropagation(); handleDuploCliqueCodCliente(t.codCliente, t.proc); }}
                        />
                      </td>
                      <td
                        className="py-1.5 px-3 text-center text-slate-500 border-r border-slate-100"
                        onDoubleClick={(e) => { e.stopPropagation(); handleDuploCliqueProc(t.codCliente, t.proc, t); }}
                        title="Duplo clique para abrir Processos (cliente e processo)"
                      >
                        <input
                          type="text"
                          value={t.proc ?? ''}
                          onChange={(e) => updateCampoLancamento(instituicaoSelecionada, t.numero, t.data, 'proc', e.target.value)}
                          className="w-12 px-1 py-0.5 text-sm text-center bg-slate-50 border border-slate-200 rounded"
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => { e.stopPropagation(); handleDuploCliqueProc(t.codCliente, t.proc, t); }}
                        />
                      </td>
                      <td className="py-1.5 px-2 text-center border-r border-slate-100" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={textoRefLancamento(t)}
                          onChange={(e) =>
                            updateCampoLancamento(instituicaoSelecionada, t.numero, t.data, 'ref', e.target.value)
                          }
                          className="w-14 px-0 py-0.5 text-sm text-center bg-slate-50 border border-slate-200 rounded"
                          title="N = único; R = repasse (espelha no consolidado — use Eq. igual em ≥2 linhas)"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="N">N</option>
                          <option value="R">R</option>
                        </select>
                      </td>
                      <td className="py-1.5 px-2 text-center border-r border-slate-100" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={textoDimensaoEq(t)}
                          onChange={(e) => updateCampoLancamento(instituicaoSelecionada, t.numero, t.data, 'dimensao', e.target.value)}
                          className="w-16 px-1 py-0.5 text-sm text-center bg-slate-50 border border-slate-200 rounded"
                          title="Espelha Eq. na conta contábil correspondente"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="py-1.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={t.parcela ?? ''}
                          onChange={(e) => updateCampoLancamento(instituicaoSelecionada, t.numero, t.data, 'parcela', e.target.value)}
                          className="w-16 px-1 py-0.5 text-sm text-center bg-slate-50 border border-slate-200 rounded"
                          title="Espelha Parcela no consolidado"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="py-1.5 px-1 text-center border-l border-slate-100" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalVinculoLancamento({
                              nomeBanco: instituicaoSelecionada,
                              numero: t.numero,
                              data: t.data,
                              resumo: `${instituicaoSelecionada} · ${t.data} · ${formatValor(t.valor)} — ${String(t.descricao ?? '').slice(0, 72)}`,
                            });
                          }}
                          className="p-1.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
                          title="Buscar cliente, autor ou réu e vincular cod. + proc. (sem abrir o cadastro)"
                          aria-label="Vincular cliente e processo"
                        >
                          <Link2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                  });
                  })()}
                </tbody>
              </table>
            </div>
            {(() => {
              const total = listaExtratoBancoVisivel.length;
              const vis =
                limiteLancamentosExtratoBanco === 0
                  ? total
                  : Math.min(limiteLancamentosExtratoBanco, total);
              if (total <= vis && !(periodoVisao !== 'todos' && total === 0)) return null;
              if (periodoVisao !== 'todos' && total === 0) {
                return (
                  <div className="px-4 py-3 text-xs text-slate-600 bg-amber-50/80 border-t border-amber-100">
                    Nenhum lançamento neste período para <strong>{instituicaoSelecionada}</strong>. Ajuste o filtro ou
                    escolha <strong>Todos</strong>.
                  </div>
                );
              }
              if (total <= vis) return null;
              return (
                <div className="px-4 py-2 text-xs text-slate-600 bg-slate-50 border-t border-slate-200">
                  Exibindo <strong>{vis}</strong> de <strong>{total}</strong> lançamentos (após filtro de período).
                  Aumente o limite ou escolha <strong>Todos</strong> para ver mais linhas.
                </div>
              );
            })()}
            </div>
          </section>
        )}

        {mostrarPainelConsolidado && (
          <section
            className={`rounded-lg border border-green-200 shadow-sm overflow-hidden bg-green-50/30 flex flex-col min-h-0 ${classOrdemConsolidado} ${
              relatoriosLadoALado ? 'xl:flex-1 xl:min-w-0 xl:max-h-[min(92vh,960px)]' : ''
            }`}
          >
            <div className="px-4 py-3 border-b border-green-200 bg-white/80 space-y-3 shrink-0">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-3 w-full">
                <div className="flex flex-wrap items-end gap-3 min-w-0 shrink-0">
                  <h2 className="text-base font-bold text-slate-800 min-w-0 max-w-[14rem] sm:max-w-none leading-none pb-1">
                    Extrato consolidado – {contaContabilSelecionada}
                  </h2>
                  <div className="flex items-center gap-2">
                    <label htmlFor="limite-lanc-consolidado" className="text-xs text-slate-600 whitespace-nowrap">
                      Lançamentos na tela:
                    </label>
                    <select
                      id="limite-lanc-consolidado"
                      value={limiteLancamentosConsolidado}
                      onChange={(e) => setLimiteLancamentosConsolidado(Number(e.target.value))}
                      className="text-sm border border-green-300 rounded-md px-2 py-1.5 bg-white text-slate-800 min-w-[5.5rem] shadow-sm"
                      title="Quantidade máxima de linhas no consolidado (ordem atual da tabela)"
                    >
                      {OPCOES_LIMITE_LANCAMENTOS_EXTRATO.map((o) => (
                        <option key={o.v} value={o.v}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="w-full min-[900px]:w-auto min-[900px]:flex-1 min-[900px]:min-w-[12rem] flex justify-center min-w-0">
                  {renderBarraFiltroPeriodo('consolidado')}
                </div>
                {isContaCompensacao && (
                  <div className="flex flex-wrap items-end gap-x-3 gap-y-2 shrink-0 w-full min-[900px]:w-auto justify-center min-[900px]:justify-end">
                    <div className="flex items-center gap-2">
                      <label htmlFor="filtro-elo-consolidado" className="text-xs text-slate-600 whitespace-nowrap">
                        Elo:
                      </label>
                      <select
                        id="filtro-elo-consolidado"
                        value={filtroEloConsolidado}
                        onChange={(e) => setFiltroEloConsolidado(e.target.value)}
                        className="text-sm border border-green-300 rounded-md px-2 py-1.5 bg-white text-slate-800 min-w-[7rem] max-w-[12rem] shadow-sm"
                        title="Mostrar só lançamentos deste Elo (período atual)"
                      >
                        <option value="">Todos</option>
                        {elosDisponiveisConsolidado.map((elo) => (
                          <option key={elo} value={elo}>
                            {elo}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor="filtro-conc-elo-consolidado" className="text-xs text-slate-600 whitespace-nowrap">
                        Conciliação:
                      </label>
                      <select
                        id="filtro-conc-elo-consolidado"
                        value={filtroConciliacaoEloConsolidado}
                        onChange={(e) => setFiltroConciliacaoEloConsolidado(e.target.value)}
                        className="text-sm border border-green-300 rounded-md px-2 py-1.5 bg-white text-slate-800 min-w-[10rem] max-w-[20rem] shadow-sm"
                        title="Independente do filtro Elo: conciliado = soma global do Elo = 0; não conciliado = soma ≠ 0"
                      >
                        <option value="todos">Todos</option>
                        <option value="nao_conciliados">Só não conciliados (soma Elo ≠ 0)</option>
                        <option value="conciliados">Só conciliados (soma Elo = 0)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
              {contaContabilSelecionada === 'Conta Escritório' && (
                <div className="text-xs text-slate-700 rounded-md bg-emerald-50/90 border border-emerald-200 px-3 py-2 space-y-1">
                  <p>
                    <strong>Conta Escritório:</strong> consolidado dos lançamentos com <strong>letra A</strong> nos
                    extratos. A <strong>Conta Corrente</strong> em <strong>Processos</strong> lista aqui apenas as linhas
                    cujo <strong>Cod. Cliente</strong> e <strong>Proc.</strong> coincidem com o processo aberto — por
                    isso o vínculo cliente/processo é essencial nos lançamentos de escritório.
                  </p>
                  <p>
                    <strong>Ref.</strong> só <strong>N</strong> ou <strong>R</strong>: <strong>N</strong> = lançamento
                    único (sem repasse; Eq. pode ficar vazio). <strong>R</strong> = há repasse vinculado — use o{' '}
                    <strong>mesmo Eq.</strong> em <strong>pelo menos duas linhas</strong> para localizar o par (ex. crédito
                    e repasse). Linhas <strong>R</strong> sem par de Eq. aparecem em <strong>vermelho</strong>;{' '}
                    <strong>N</strong> em <strong>verde</strong>.
                  </p>
                </div>
              )}
              {isContaCompensacao && (
                <div className="text-xs text-slate-600 space-y-1 rounded-md bg-amber-50/80 border border-amber-200 px-3 py-2">
                  <p>
                    <strong>Conta Compensação:</strong> cada <strong>Elo</strong> é um <strong>número natural</strong>{' '}
                    (exibido como 0001, 0002…); a <strong>soma dos valores</strong> de todas as linhas com o{' '}
                    <strong>mesmo Elo</strong> deve ser <strong>zero</strong> — assim se anulam lançamentos que só
                    representam <strong>mudança de numerário</strong> entre bancos, sem aparecer como efeito líquido nas
                    outras contas. Identificação de pares: <strong>mesmo dia</strong>, valor oposto{' '}
                    <strong>exato</strong> (centavos), bancos diferentes. <strong>Cod. Cliente</strong> fica vazio; o{' '}
                    <strong>Elo</strong> identifica o par. OFX entra como <strong>N</strong> — use{' '}
                    <strong>Parear compensações</strong> no topo para aplicar os Elos.
                  </p>
                  {paresCompensacaoDesbalanceados.length > 0 && (
                    <p className="text-amber-900 font-medium">
                      Atenção: par(es) com soma ≠ 0 — Elo{' '}
                      {paresCompensacaoDesbalanceados.map(([p]) => p).join(', ')}
                    </p>
                  )}
                  {orfaosCompensacao > 0 && (
                    <p className="text-slate-700">
                      {orfaosCompensacao} lançamento(s) em <strong>Conta Compensação</strong> sem par (Elo ?n) — ajuste
                      manual ou classifique como outra conta até existir contraparte no mesmo dia com valor oposto{' '}
                      <strong>exato</strong>.
                    </p>
                  )}
                  {paresCompensacaoDesbalanceados.length === 0 &&
                    Object.keys(somasParComp).some((p) => /^\d+$/.test(String(p))) && (
                    <p className="text-green-800">
                      Todos os pares numéricos conferem (soma = 0 entre as duas pernas).
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className={relatoriosLadoALado ? 'flex flex-col flex-1 min-h-0' : ''}>
            <div className={relatoriosLadoALado ? 'flex-1 min-h-0 overflow-auto' : 'overflow-x-auto'}>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-14 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('numeroBanco')} title="Duplo clique: ordenar crescente ↔ decrescente">Nº</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-16 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('numero')} title="Duplo clique: ordenar">Id.</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-24 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('data')} title="Duplo clique: ordenar crescente ↔ decrescente">Data</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600 border-r border-slate-200 min-w-[140px] cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('descricao')} title="Duplo clique: ordenar A→Z / Z→A">Descrição</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-28 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('valor')} title="Duplo clique: ordenar crescente ↔ decrescente">
                      Valor <span className="text-slate-400 font-normal">({formatValor(saldoHeaderConsolidado)})</span>
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600 border-r border-slate-200 min-w-[200px] cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('descricaoDetalhada')} title="Mesmo texto que Categoria / Obs. no extrato do banco. Duplo clique: ordenar A→Z / Z→A">Descrição / Contraparte</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-20 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('codCliente')} title="Duplo clique: ordenar">Cod. Cliente</th>
                    <th
                      className="text-center py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-16 cursor-pointer hover:bg-slate-100 select-none"
                      onDoubleClick={() => handleDuploCliqueTituloConsolidado('proc')}
                      title={isContaCompensacao ? 'Duplo clique: ordenar por Elo' : 'Duplo clique: ordenar por Proc.'}
                    >
                      {isContaCompensacao ? 'Elo' : 'Proc.'}
                    </th>
                    <th
                      className="text-center py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-16 cursor-pointer hover:bg-slate-100 select-none"
                      onDoubleClick={() => handleDuploCliqueTituloConsolidado('ref')}
                      title="N = lançamento único (sem repasse). R = repasse — use o mesmo Eq. em pelo menos duas linhas. Mesmo valor no extrato do banco. Duplo clique: ordenar."
                    >
                      Ref.
                    </th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-16 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('eq')} title="Mesmo texto que Dimensão no extrato. Duplo clique: ordenar">Eq.</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600 w-20 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('parcela')} title="Duplo clique: ordenar">Parcela</th>
                    {!isContaCompensacao ? (
                      <th className="text-center py-2 px-2 font-medium text-slate-600 w-12" title="Buscar cliente e processo por nome/réu e vincular sem sair da tela">
                        Vinc.
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const total = listaConsolidadaVisivel.length;
                    const maxLinhas =
                      limiteLancamentosConsolidado === 0 ? total : limiteLancamentosConsolidado;
                    const listaVisivel = listaConsolidadaVisivel.slice(0, maxLinhas);
                    return listaVisivel.map((t, idx) => {
                    const rowKey = `${t.nomeBanco}-${t.numero}-${t.data}`;
                    const isFoco = linhaConsolidadoFoco === rowKey;
                    const isAlvo = linhaConsolidadoAlvo === rowKey;
                    const prev = listaVisivel[idx - 1];
                    const mesmoGrupo = prev && prev.numeroBanco === t.numeroBanco && prev.letra === t.letra;
                    const vc = filtroConciliacaoHonorarios?.valorCentavos;
                    const destaqueValorConciliacao =
                      vc != null && Number.isFinite(Number(t.valor)) && Math.round(Number(t.valor) * 100) === vc;
                    const eloKeyConsolidado = String(t.proc ?? '').trim() || '—';
                    const eloDesbalanceado =
                      isContaCompensacao && (somasParComp[eloKeyConsolidado] ?? 0) !== 0;
                    const refRow = normalizarRefFinanceiro(t.ref);
                    const eqKeyRow = String(textoDimensaoEq(t) ?? '').trim();
                    const repasseRIncompleto =
                      isContaEscritorio &&
                      refRow === 'R' &&
                      (!eqKeyRow || (contagemEqRepasseEscritorio.get(eqKeyRow) ?? 0) < 2);
                    const repasseN = isContaEscritorio && refRow === 'N';
                    const linhaAlerta = eloDesbalanceado || repasseRIncompleto;
                    let rowBgConsolidado;
                    let brElo;
                    let borderBottomTr;
                    if (eloDesbalanceado) {
                      rowBgConsolidado = 'bg-red-100/90 hover:bg-red-200/70';
                      brElo = 'border-red-100/80';
                      borderBottomTr = 'border-red-200/80';
                    } else if (repasseRIncompleto) {
                      rowBgConsolidado = 'bg-red-100/90 hover:bg-red-200/70';
                      brElo = 'border-red-100/80';
                      borderBottomTr = 'border-red-200/80';
                    } else if (repasseN) {
                      rowBgConsolidado = 'bg-green-50/80 hover:bg-green-100/60';
                      brElo = 'border-green-100';
                      borderBottomTr = 'border-green-100/80';
                    } else if (isContaEscritorio) {
                      rowBgConsolidado = mesmoGrupo
                        ? 'bg-sky-100/50 hover:bg-sky-100/70'
                        : 'bg-slate-50/70 hover:bg-slate-100/50';
                      brElo = 'border-slate-100';
                      borderBottomTr = 'border-slate-100/80';
                    } else {
                      rowBgConsolidado = mesmoGrupo
                        ? 'bg-sky-100/50 hover:bg-green-100/50'
                        : 'bg-green-50/50 hover:bg-green-100/50';
                      brElo = 'border-green-100';
                      borderBottomTr = 'border-green-100/80';
                    }
                    const ringFoco = linhaAlerta
                      ? 'ring-red-500'
                      : repasseN
                        ? 'ring-green-500'
                        : isContaEscritorio
                          ? 'ring-slate-400'
                          : 'ring-green-500';
                    const inpB = linhaAlerta
                      ? 'border-red-200'
                      : isContaEscritorio && refRow === 'R'
                        ? 'border-slate-200'
                        : 'border-green-200';
                    const tdHover = linhaAlerta
                      ? 'hover:bg-red-200/50'
                      : repasseN
                        ? 'hover:bg-green-200/50'
                        : isContaEscritorio
                          ? 'hover:bg-slate-200/50'
                          : 'hover:bg-green-200/50';
                    const borderLateralVinc = linhaAlerta
                      ? 'border-red-100'
                      : isContaEscritorio
                        ? 'border-slate-100'
                        : 'border-green-100';
                    return (
                      <tr
                        key={rowKey}
                        ref={isAlvo ? linhaConsolidadoRef : undefined}
                        onClick={() => setLinhaConsolidadoFoco(rowKey)}
                        title={
                          eloDesbalanceado
                            ? 'Elo com soma dos valores ≠ zero (regra Conta Compensação)'
                            : repasseRIncompleto
                              ? 'Ref. R: use o mesmo Eq. em pelo menos duas linhas (ex.: crédito e repasse ao cliente).'
                              : undefined
                        }
                        className={`border-b ${borderBottomTr} ${rowBgConsolidado} ${isFoco ? `ring-1 ring-inset ${ringFoco}` : ''} ${destaqueValorConciliacao && !linhaAlerta ? 'ring-2 ring-amber-400 ring-inset bg-amber-50/90' : ''}`}
                      >
                        <td
                          className={`py-1.5 px-3 text-slate-600 border-r cursor-pointer ${brElo} ${tdHover}`}
                          onDoubleClick={(e) => { e.stopPropagation(); handleDuploCliqueNºConsolidado(t); }}
                          title="Duplo clique para abrir o extrato do banco nesta linha"
                        >
                          {t.numeroBanco}
                        </td>
                        <td className={`py-1.5 px-3 text-slate-600 border-r ${brElo}`}>{t.numero}</td>
                        <td className={`py-1.5 px-3 text-slate-700 border-r ${brElo}`}>{t.data}</td>
                        <td className={`py-1.5 px-3 text-slate-700 border-r ${brElo}`}>{t.descricao}</td>
                        <td className={`py-1.5 px-3 text-right border-r ${brElo} font-medium ${t.valor < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                          {formatValor(t.valor)}
                        </td>
                        <td className={`py-1.5 px-2 text-slate-600 border-r ${brElo} text-xs min-w-[12rem]`} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={textoCategoriaObservacao(t)}
                            onChange={(e) => updateCampoLancamento(t.nomeBanco, t.numero, t.data, 'descricaoDetalhada', e.target.value)}
                            className={`w-full min-w-[10rem] px-1.5 py-0.5 text-xs bg-white border rounded ${
                              inpB
                            }`}
                            title="Espelha Categoria / Obs. no extrato do banco"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td
                          className={`py-1.5 px-2 text-center border-r ${brElo} ${
                            isContaCompensacao && t.letra === 'E' ? 'text-slate-400' : ''
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={t.codCliente ?? ''}
                            disabled={isContaCompensacao && t.letra === 'E'}
                            onChange={(e) => updateCampoLancamento(t.nomeBanco, t.numero, t.data, 'codCliente', e.target.value)}
                            className={`w-16 px-1 py-0.5 text-sm text-center border rounded ${
                              inpB
                            } ${
                              isContaCompensacao && t.letra === 'E' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'
                            }`}
                            title={
                              isContaCompensacao && t.letra === 'E'
                                ? 'Conta Compensação: Cod. não utilizado (igual ao extrato)'
                                : 'Espelha Cod. Cliente no extrato do banco'
                            }
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              if (isContaCompensacao && t.letra === 'E') return;
                              handleDuploCliqueCodCliente(t.codCliente, t.proc);
                            }}
                          />
                        </td>
                        <td className={`py-1.5 px-2 text-center border-r ${brElo}`} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={t.proc ?? ''}
                            onChange={(e) => updateCampoLancamento(t.nomeBanco, t.numero, t.data, 'proc', e.target.value)}
                            className={`w-14 px-1 py-0.5 text-sm text-center bg-white border rounded ${
                              inpB
                            }`}
                            title={
                              isContaCompensacao && t.letra === 'E'
                                ? 'Elo — espelha Proc. no extrato'
                                : 'Espelha Proc. no extrato do banco'
                            }
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              if (isContaCompensacao && t.letra === 'E') return;
                              handleDuploCliqueProc(t.codCliente, t.proc, t);
                            }}
                          />
                        </td>
                        <td className={`py-1.5 px-2 text-center border-r ${brElo}`} onClick={(e) => e.stopPropagation()}>
                          <select
                            value={textoRefLancamento(t)}
                            onChange={(e) => updateCampoLancamento(t.nomeBanco, t.numero, t.data, 'ref', e.target.value)}
                            className={`w-14 px-0 py-0.5 text-sm text-center bg-white border rounded ${
                              inpB
                            }`}
                            title="N = único; R = repasse (mesmo Eq. em ≥2 linhas)"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="N">N</option>
                            <option value="R">R</option>
                          </select>
                        </td>
                        <td className={`py-1.5 px-2 text-center border-r ${brElo}`} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={textoDimensaoEq(t)}
                            onChange={(e) => updateCampoLancamento(t.nomeBanco, t.numero, t.data, 'eq', e.target.value)}
                            className={`w-14 px-1 py-0.5 text-sm text-center bg-white border rounded ${
                              inpB
                            }`}
                            title="Espelha Dimensão no extrato do banco"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={t.parcela ?? ''}
                            onChange={(e) => updateCampoLancamento(t.nomeBanco, t.numero, t.data, 'parcela', e.target.value)}
                            className={`w-16 px-1 py-0.5 text-sm text-center bg-white border rounded ${
                              inpB
                            }`}
                            title="Espelha Parcela no extrato do banco"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        {!isContaCompensacao ? (
                          <td
                            className={`py-1.5 px-1 text-center border-l ${borderLateralVinc}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setModalVinculoLancamento({
                                    nomeBanco: t.nomeBanco,
                                    numero: t.numero,
                                    data: t.data,
                                    resumo: `${t.nomeBanco} · ${t.data} · ${formatValor(t.valor)} — ${String(t.descricao ?? '').slice(0, 72)}`,
                                  });
                                }}
                                className="p-1.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
                                title="Buscar cliente, autor ou réu e vincular cod. + proc. (sem abrir o cadastro)"
                                aria-label="Vincular cliente e processo"
                              >
                                <Link2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void excluirLancamentoUi(t);
                                }}
                                className="p-1.5 rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                title={featureFlags.useApiFinanceiro ? 'Excluir lançamento na API' : 'Excluir lançamento local'}
                                aria-label="Excluir lançamento"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  });
                  })()}
                </tbody>
              </table>
            </div>
            {(() => {
              const total = listaConsolidadaVisivel.length;
              const vis =
                limiteLancamentosConsolidado === 0
                  ? total
                  : Math.min(limiteLancamentosConsolidado, total);
              if (total === 0) {
                if (
                  isContaCompensacao &&
                  filtroConciliacaoEloConsolidado === 'nao_conciliados' &&
                  listaConsolidadaAposPeriodoEElo.length > 0
                ) {
                  return (
                    <p className="py-6 text-center text-slate-500 text-sm">
                      Nenhum lançamento <strong>não conciliado</strong> (soma do Elo ≠ 0) entre os filtros atuais. No
                      período e Elo selecionados, todos os Elos conferem. Ajuste o período, o filtro <strong>Elo</strong>{' '}
                      ou volte a <strong>Todos</strong> em Conciliação.
                    </p>
                  );
                }
                if (
                  isContaCompensacao &&
                  filtroConciliacaoEloConsolidado === 'conciliados' &&
                  listaConsolidadaAposPeriodoEElo.length > 0
                ) {
                  return (
                    <p className="py-6 text-center text-slate-500 text-sm">
                      Nenhum lançamento <strong>conciliado</strong> (soma do Elo = 0) entre os filtros atuais. Ajuste o
                      período, o filtro <strong>Elo</strong> ou volte a <strong>Todos</strong> em Conciliação.
                    </p>
                  );
                }
                if (
                  isContaCompensacao &&
                  filtroEloConsolidado &&
                  listaConsolidadaAposPeriodo.length > 0 &&
                  listaConsolidadaAposPeriodoEElo.length === 0
                ) {
                  return (
                    <p className="py-6 text-center text-slate-500 text-sm">
                      Nenhum lançamento com o Elo <strong>{filtroEloConsolidado}</strong> neste período. Escolha outro Elo
                      ou <strong>Todos</strong>.
                    </p>
                  );
                }
                return (
                  <p className="py-6 text-center text-slate-500 text-sm">
                    {periodoVisao !== 'todos'
                      ? 'Nenhum lançamento desta conta contábil no período selecionado. Ajuste o filtro ou escolha Todos.'
                      : 'Nenhum lançamento com letra desta conta nos extratos bancários.'}
                  </p>
                );
              }
              if (total > vis) {
                let sufixoFiltro = 'período';
                if (isContaCompensacao) {
                  const eloOn = Boolean(filtroEloConsolidado);
                  const concNao = filtroConciliacaoEloConsolidado === 'nao_conciliados';
                  const concSim = filtroConciliacaoEloConsolidado === 'conciliados';
                  if (eloOn && concNao) sufixoFiltro = 'período, Elo e conciliação (soma ≠ 0)';
                  else if (eloOn && concSim) sufixoFiltro = 'período, Elo e conciliação (soma = 0)';
                  else if (eloOn) sufixoFiltro = 'período e Elo';
                  else if (concNao) sufixoFiltro = 'período e conciliação (soma Elo ≠ 0)';
                  else if (concSim) sufixoFiltro = 'período e conciliação (soma Elo = 0)';
                }
                return (
                  <div className="px-4 py-2 text-xs text-slate-600 bg-green-50/80 border-t border-green-200">
                    Exibindo <strong>{vis}</strong> de <strong>{total}</strong> lançamentos no consolidado (após filtro de{' '}
                    {sufixoFiltro}). Aumente o limite ou escolha <strong>Todos</strong>.
                  </div>
                );
              }
              return null;
            })()}
            </div>
          </section>
        )}
          </div>
        )}
      </div>

      {modalParearCompensacao != null && Array.isArray(modalParearCompensacao.pares) && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-parear-comp-titulo"
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-amber-200 w-full max-w-4xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-amber-200 flex items-center justify-between shrink-0">
              <h2 id="modal-parear-comp-titulo" className="text-base font-bold text-slate-800">
                Parear compensações
              </h2>
              <button
                type="button"
                onClick={() => setModalParearCompensacao(null)}
                className="px-2 py-1 text-slate-500 hover:bg-slate-100 rounded text-lg leading-none"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 text-sm space-y-3">
              <p className="text-slate-600">
                <strong>Passo 1 — Identificação:</strong> pares com mesma data, valor oposto exato (centavos) e bancos
                diferentes. <strong>Passo 2 — Aplicar:</strong> classifica como <strong>Conta Compensação (letra E)</strong>{' '}
                e grava o <strong>Elo</strong> (número natural: 0001, 0002…): cada Elo deve ter <strong>soma zero</strong>,
                registrando só a troca de numerário entre contas. Em cada linha use <strong>Vincular</strong> para aplicar
                só aquele par; o botão passa a <strong>Desvincular</strong> (cinza) para desfazer. O Elo gravado é sempre o{' '}
                <strong>próximo livre</strong> (pode diferir do número sugerido na coluna Elo se você já aplicou outros antes).
              </p>
              {modalParearCompensacao.pares.length === 0 ? (
                <p className="py-6 text-center text-amber-800 bg-amber-50 rounded border border-amber-200">
                  Nenhum par encontrado. Os lançamentos devem estar em <strong>N</strong> (ou E órfão), mesma data,
                  crédito e débito de mesmo valor absoluto em <strong>bancos diferentes</strong> (ex.: Itaú +16.068,01 e
                  Cora -16.068,01 em 17/03).
                </p>
              ) : (
                <div className="border border-slate-200 rounded overflow-hidden">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-amber-50 border-b border-slate-200">
                        <th className="text-left py-2 px-2 font-semibold text-slate-700 w-[1%] whitespace-nowrap">
                          Ação
                        </th>
                        <th className="text-left py-2 px-2 font-semibold text-slate-700">Elo</th>
                        <th className="text-left py-2 px-2 font-semibold text-slate-700">Data</th>
                        <th className="text-left py-2 px-2 font-semibold text-slate-700">Crédito</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-700">Valor</th>
                        <th className="text-left py-2 px-2 font-semibold text-slate-700">Débito</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-700">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalParearCompensacao.pares.map((p) => (
                        <tr
                          key={chaveModalParCompensacao(p)}
                          className="border-b border-slate-100 hover:bg-slate-50"
                        >
                          <td className="py-2 px-2 align-middle">
                            {p.eloAplicado ? (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-400 bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 whitespace-nowrap"
                                title="Desfazer: volta letra N e remove o Elo deste par"
                                onClick={() => {
                                  const k = chaveModalParCompensacao(p);
                                  const eloRev = p.eloAplicado;
                                  setExtratosPorBanco((prev) => {
                                    const r = reverterUmParCompensacaoInterbancaria(prev, p, eloRev);
                                    if (!r.ok) {
                                      queueMicrotask(() =>
                                        setOfxStatus({ kind: 'error', message: r.message })
                                      );
                                      return prev;
                                    }
                                    queueMicrotask(() => {
                                      setOfxStatus({
                                        kind: 'success',
                                        message: `Vínculo removido (Elo ${eloRev} — ${p.credito.banco} ↔ ${p.debito.banco}).`,
                                      });
                                      setModalParearCompensacao((mprev) => {
                                        if (!mprev?.pares) return mprev;
                                        return {
                                          pares: mprev.pares.map((row) =>
                                            chaveModalParCompensacao(row) === k
                                              ? { ...row, eloAplicado: undefined }
                                              : row
                                          ),
                                        };
                                      });
                                    });
                                    return r.extratos;
                                  });
                                }}
                              >
                                <Unlink className="w-3.5 h-3.5 shrink-0" aria-hidden />
                                Desvincular
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-600 bg-amber-50 text-amber-900 text-xs font-medium hover:bg-amber-100 whitespace-nowrap"
                                title="Aplicar só este par (letra E, próximo Elo livre — pode diferir do número sugerido na coluna se você já aplicou outros)"
                                onClick={() => {
                                  const k = chaveModalParCompensacao(p);
                                  setExtratosPorBanco((prev) => {
                                    const r = aplicarUmParCompensacaoInterbancaria(prev, p);
                                    if (!r.ok) {
                                      queueMicrotask(() =>
                                        setOfxStatus({ kind: 'error', message: r.message })
                                      );
                                      return prev;
                                    }
                                    const eloNovo = r.elo;
                                    queueMicrotask(() => {
                                      setOfxStatus({
                                        kind: 'success',
                                        message: `Compensação aplicada: Elo ${eloNovo} (${p.credito.banco} ↔ ${p.debito.banco}).`,
                                      });
                                      setModalParearCompensacao((mprev) => {
                                        if (!mprev?.pares) return mprev;
                                        return {
                                          pares: mprev.pares.map((row) =>
                                            chaveModalParCompensacao(row) === k
                                              ? { ...row, eloAplicado: eloNovo }
                                              : row
                                          ),
                                        };
                                      });
                                    });
                                    return r.extratos;
                                  });
                                }}
                              >
                                <Link2 className="w-3.5 h-3.5 shrink-0" aria-hidden />
                                Vincular
                              </button>
                            )}
                          </td>
                          <td className="py-2 px-2 font-mono font-semibold text-amber-900">
                            {p.eloAplicado ?? p.elo}
                          </td>
                          <td className="py-2 px-2 text-slate-700">{p.data}</td>
                          <td className="py-2 px-2 text-slate-700">
                            {p.credito.banco}
                            <span className="block text-xs text-slate-500">{p.credito.descricao}</span>
                          </td>
                          <td className="py-2 px-2 text-right text-slate-900">{formatValor(p.credito.valor)}</td>
                          <td className="py-2 px-2 text-slate-700">
                            {p.debito.banco}
                            <span className="block text-xs text-slate-500">{p.debito.descricao}</span>
                          </td>
                          <td className="py-2 px-2 text-right text-red-600 font-medium">
                            {formatValor(p.debito.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex flex-wrap justify-end gap-2 shrink-0 bg-slate-50">
              <button
                type="button"
                onClick={() => setModalParearCompensacao(null)}
                className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={modalParearCompensacao.pares.filter((row) => !row.eloAplicado).length === 0}
                onClick={() => {
                  const n = modalParearCompensacao.pares.filter((row) => !row.eloAplicado).length;
                  setExtratosPorBanco((prev) => parearCompensacaoInterbancaria(cloneExtratos(prev)));
                  setModalParearCompensacao(null);
                  setOfxStatus({
                    kind: 'success',
                    message: `Compensação aplicada: ${n} par(es) — Elo atribuído (0001, 0002…) na Conta Compensação.`,
                  });
                }}
                className="px-4 py-2 rounded bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aplicar {modalParearCompensacao.pares.filter((row) => !row.eloAplicado).length} compensação(ões)
              </button>
            </div>
          </div>
        </div>
      )}

      {modalConfigFinanceiro && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-config-financeiro-titulo"
          onClick={() => setModalConfigFinanceiro(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h2 id="modal-config-financeiro-titulo" className="text-base font-bold text-slate-800">
                Configurações do Financeiro
              </h2>
              <button
                type="button"
                onClick={() => setModalConfigFinanceiro(false)}
                className="px-2 py-1 text-slate-500 hover:bg-slate-100 rounded text-lg leading-none"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 text-sm space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-1">Nova conta (instituição bancária)</h3>
                <p className="text-xs text-slate-500 mb-3">
                  Cada conta recebe um Nº sequencial no consolidado e integra OFX, compensações e contas contábeis.
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex flex-col gap-0.5 flex-1 min-w-[12rem]">
                    <label htmlFor="modal-nova-conta-bancaria" className="text-xs text-slate-600">
                      Nome da instituição
                    </label>
                    <input
                      id="modal-nova-conta-bancaria"
                      type="text"
                      value={nomeNovaContaBancaria}
                      onChange={(e) => {
                        setNomeNovaContaBancaria(e.target.value);
                        if (msgNovaContaBancaria) setMsgNovaContaBancaria(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          adicionarNovaContaBancaria();
                        }
                      }}
                      placeholder="Ex.: Banco Inter PJ"
                      className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 w-full max-w-md"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={adicionarNovaContaBancaria}
                    className="px-3 py-2 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-800 shrink-0"
                  >
                    Adicionar conta
                  </button>
                </div>
                {msgNovaContaBancaria && (
                  <p
                    className={`text-xs mt-2 ${msgNovaContaBancaria.kind === 'error' ? 'text-red-700' : 'text-green-700'}`}
                  >
                    {msgNovaContaBancaria.text}
                  </p>
                )}
              </div>
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-1">Nova conta contábil</h3>
                <p className="text-xs text-slate-500 mb-3">
                  Letra automática entre G e Z quando disponível; aparece nos extratos e no consolidado.
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex flex-col gap-0.5 flex-1 min-w-[12rem]">
                    <label htmlFor="modal-nova-conta-contabil" className="text-xs text-slate-600">
                      Nome da conta contábil
                    </label>
                    <input
                      id="modal-nova-conta-contabil"
                      type="text"
                      value={nomeNovaContaContabil}
                      onChange={(e) => {
                        setNomeNovaContaContabil(e.target.value);
                        if (msgNovaContaContabil) setMsgNovaContaContabil(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          adicionarNovaContaContabil();
                        }
                      }}
                      placeholder="Ex.: Conta Projeto X"
                      className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 w-full max-w-md"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={adicionarNovaContaContabil}
                    className="px-3 py-2 rounded-lg bg-emerald-800 text-white text-sm font-medium hover:bg-emerald-900 shrink-0"
                  >
                    Adicionar conta contábil
                  </button>
                </div>
                {msgNovaContaContabil && (
                  <p
                    className={`text-xs mt-2 ${msgNovaContaContabil.kind === 'error' ? 'text-red-700' : 'text-green-700'}`}
                  >
                    {msgNovaContaContabil.text}
                  </p>
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end shrink-0 bg-slate-50">
              <button
                type="button"
                onClick={() => setModalConfigFinanceiro(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalBuscaParcelas && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-busca-parcelas-titulo"
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-indigo-200 w-full max-w-4xl max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-indigo-200 flex items-center justify-between shrink-0">
              <h2 id="modal-busca-parcelas-titulo" className="text-base font-bold text-slate-800">
                Sugestões de vínculo (Cálculos + extrato)
              </h2>
              <button
                type="button"
                onClick={fecharModalBuscaVinculo}
                className="px-2 py-1 text-slate-500 hover:bg-slate-100 rounded text-lg leading-none"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 text-sm space-y-4">
              <p className="text-slate-600 text-xs leading-relaxed">
                O sistema compara <strong>todos</strong> os lançamentos <strong>ainda não classificados</strong> (sem cliente e sem
                processo) com as parcelas de <strong>cálculos em que você marcou &quot;Aceitar Pagamento&quot;</strong> no
                módulo Cálculos. O critério é <strong>mesma data</strong> (vencimento da parcela) e{' '}
                <strong>mesmo valor absoluto</strong>. Revise cada linha, ajuste se houver mais de um cálculo possível e
                confirme — o vínculo só é gravado com sua aprovação.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={atualizarSugestoesBuscaAutomatica}
                  className="px-3 py-2 rounded-lg border border-indigo-300 bg-white text-indigo-900 text-sm font-medium hover:bg-indigo-50"
                >
                  Atualizar busca
                </button>
                {isUsuarioMaster() && (
                  <button
                    type="button"
                    onClick={excluirHistoricoConsultasVinculoMaster}
                    className="px-3 py-2 rounded-lg border border-red-300 bg-white text-red-800 text-sm font-medium hover:bg-red-50"
                    title="Remove todo o relatório guardado neste navegador (apenas usuário master)"
                  >
                    Excluir relatório de consultas
                  </button>
                )}
                <span className="text-xs text-slate-500">
                  Rodadas aceitas no Cálculos:{' '}
                  <strong>
                    {Object.values(loadRodadasCalculos() || {}).filter((r) => r?.parcelamentoAceito).length}
                  </strong>
                </span>
              </div>

              {consultasVinculoHistorico.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2">
                  <span className="text-xs font-semibold text-indigo-900">Consultas</span>
                  <button
                    type="button"
                    disabled={indiceConsultaVinculo <= 0}
                    onClick={() => setIndiceConsultaVinculo((i) => Math.max(0, i - 1))}
                    className="p-1 rounded border border-indigo-200 bg-white text-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-100"
                    title="Consulta anterior"
                    aria-label="Consulta anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-slate-800 tabular-nums min-w-[10rem] text-center">
                    <span className="text-slate-500 font-normal text-xs block">
                      Posição no histórico: {indiceConsultaVinculo + 1} de {consultasVinculoHistorico.length}
                    </span>
                    <strong className="text-base">Consulta nº {consultaVinculoAtual?.numero ?? '—'}</strong>
                  </span>
                  <button
                    type="button"
                    disabled={indiceConsultaVinculo >= consultasVinculoHistorico.length - 1}
                    onClick={() =>
                      setIndiceConsultaVinculo((i) =>
                        Math.min(consultasVinculoHistorico.length - 1, i + 1)
                      )
                    }
                    className="p-1 rounded border border-indigo-200 bg-white text-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-100"
                    title="Próxima consulta"
                    aria-label="Próxima consulta"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-slate-600 border-l border-indigo-200 pl-3 ml-1">
                    <span className="font-medium text-slate-700">Dia:</span>{' '}
                    {formatarDiaLog(consultaVinculoAtual?.producedAtISO)}
                    <span className="text-slate-500"> · </span>
                    <span className="font-medium text-slate-700">Produzida em:</span>{' '}
                    {formatarDataHoraConsulta(consultaVinculoAtual?.producedAtISO)}
                    <span className="text-slate-500"> · </span>
                    <span className="font-medium text-slate-700">Nesta busca:</span>{' '}
                    <strong className="text-indigo-900 tabular-nums">
                      {consultaVinculoAtual?.totalSugestoes ?? sugestoesVinculoAutomatico.length}
                    </strong>{' '}
                    sugestão(ões) (dados congelados nesta rodada)
                  </span>
                </div>
              )}

              {(() => {
                const nAceitas = Object.values(loadRodadasCalculos() || {}).filter((r) => r?.parcelamentoAceito).length;
                if (nAceitas === 0) {
                  return (
                    <p className="text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-sm">
                      Nenhuma rodada com <strong>Aceitar Pagamento</strong> marcado no Cálculos. Abra Cálculos, preencha o
                      parcelamento, marque a opção e aguarde a gravação automática.
                    </p>
                  );
                }
                return null;
              })()}

              {sugestoesVinculoAutomatico.length === 0 ? (
                <p className="text-slate-600 bg-slate-50 border border-slate-200 rounded px-3 py-3 text-sm">
                  Nenhuma correspondência automática: não há lançamento sem classificação com mesmo par data/valor que
                  alguma parcela de um cálculo aceito, ou os extratos já estão todos vinculados.
                </p>
              ) : (
                <div className="space-y-3">
                  {sugestoesVinculoAutomatico.map((s) => {
                    const rowKey = `${s.nomeBanco}-${s.numero}-${s.data}`;
                    return (
                      <div
                        key={rowKey}
                        className="border border-slate-200 rounded-lg p-3 bg-slate-50/80 space-y-2"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-800">
                              <strong>{s.nomeBanco}</strong> — Id. {s.numero} — {s.data} —{' '}
                              <span className="tabular-nums">{formatValor(s.valor)}</span>
                            </p>
                            <p className="text-xs text-slate-600 break-words" title={s.descricao || undefined}>
                              <span className="font-medium text-slate-700">Descrição no extrato:</span>{' '}
                              {s.descricao ? (
                                <span>{s.descricao}</span>
                              ) : (
                                <span className="text-slate-400 italic">(sem descrição)</span>
                              )}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              patchConsultaVinculoAtual((c) => ({
                                ...c,
                                aprovarSugestao: {
                                  ...c.aprovarSugestao,
                                  [rowKey]: !c.aprovarSugestao?.[rowKey],
                                },
                              }))
                            }
                            aria-pressed={Boolean(aprovarSugestao[rowKey])}
                            title={
                              aprovarSugestao[rowKey]
                                ? 'Clique para desfazer a aprovação deste vínculo'
                                : 'Clique para aprovar o vínculo sugerido'
                            }
                            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium shrink-0 transition-colors ${
                              aprovarSugestao[rowKey]
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-slate-400 text-white hover:bg-slate-500'
                            }`}
                          >
                            <CheckSquare className="w-4 h-4 shrink-0" aria-hidden />
                            Aprovar vínculo
                          </button>
                        </div>
                        {s.matches.length > 1 ? (
                          <div className="pl-1 space-y-1.5 text-slate-700">
                            <p className="text-xs font-medium text-slate-600">Vários cálculos batem — escolha o correto:</p>
                            {s.matches.map((m, mi) => {
                              const disp = parseRodadaKeyParaDisplay(m.rodadaKey);
                              return (
                                <label
                                  key={`${m.rodadaKey}-${mi}`}
                                  className="flex items-start gap-2 cursor-pointer text-sm"
                                >
                                  <input
                                    type="radio"
                                    className="mt-0.5"
                                    name={`match-${rowKey}`}
                                    checked={(matchIndexPorSugestao[rowKey] ?? 0) === mi}
                                    onChange={() =>
                                      patchConsultaVinculoAtual((c) => ({
                                        ...c,
                                        matchIndexPorSugestao: { ...c.matchIndexPorSugestao, [rowKey]: mi },
                                      }))
                                    }
                                  />
                                  <span>
                                    Cliente <strong className="tabular-nums">{disp.codCliente}</strong>, proc.{' '}
                                    <strong>{disp.proc}</strong>, dim. {disp.dimensao} — parcela{' '}
                                    <strong>{String(m.parcelaIndice).padStart(2, '0')}</strong>
                                    <span className="text-slate-500 text-xs ml-1">({m.rodadaKey})</span>
                                    <span className="block mt-1 text-slate-600">
                                      Autor: <strong className="font-normal">{m.autor ?? '—'}</strong>
                                      {' · '}
                                      Réu: <strong className="font-normal">{m.reu ?? '—'}</strong>
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-700 pl-1">
                            {(() => {
                              const m = s.matches[0];
                              if (!m) return null;
                              const disp = parseRodadaKeyParaDisplay(m.rodadaKey);
                              return (
                                <>
                                  Sugestão: cliente <strong className="tabular-nums">{disp.codCliente}</strong>, proc.{' '}
                                  <strong>{disp.proc}</strong>, dim. {disp.dimensao}, parcela{' '}
                                  <strong>{String(m.parcelaIndice).padStart(2, '0')}</strong>
                                  <span className="block mt-1.5 text-slate-600">
                                    Autor: <strong className="font-normal text-slate-800">{m.autor ?? '—'}</strong>
                                    {' · '}
                                    Réu: <strong className="font-normal text-slate-800">{m.reu ?? '—'}</strong>
                                  </span>
                                </>
                              );
                            })()}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex flex-wrap justify-between gap-2 shrink-0 bg-slate-50">
              <button
                type="button"
                onClick={fecharModalBuscaVinculo}
                className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-100"
              >
                Fechar
              </button>
              <button
                type="button"
                disabled={sugestoesVinculoAutomatico.length === 0}
                onClick={confirmarVinculosParcelasSelecionados}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar vínculos aprovados…
              </button>
            </div>
          </div>
        </div>
      )}

      <ModalVinculoClienteProcFinanceiro
        aberto={Boolean(modalVinculoLancamento)}
        onFechar={() => setModalVinculoLancamento(null)}
        resumoLancamento={modalVinculoLancamento?.resumo ?? ''}
        onAplicar={aplicarVinculoClienteProcNosCampos}
      />
    </div>
  );
}
