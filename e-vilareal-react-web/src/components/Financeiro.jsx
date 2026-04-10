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
  detectarSugestoesRecorrenciaMensalNoBanco,
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
  filtrarLancamentosPorCabecalhoCodClienteProc,
  textoCategoriaObservacao,
  textoDimensaoEq,
  normalizarCodigoClienteFinanceiro,
  normalizarProcFinanceiro,
  normalizarRefFinanceiro,
  limparExtratoBancoEElosRelacionados,
  savePersistedExtratosFinanceiro,
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
import { buildRouterStateChaveClienteProcesso } from '../domain/camposProcessoCliente.js';
import {
  parseOfxToExtrato,
  readOfxFileAsText,
  mergeExtratoBancario,
  mergeExtratoApiComLocal,
  contarLancamentosNovos,
  chaveDedupeLancamento,
} from '../utils/ofx';
import { isInstituicaoBtgExtratoPdf, parseBtgPdfExtratoText } from '../utils/btgPdfExtrato';
import { extrairTextoPdfDeArquivo } from '../data/publicacoesPdfExtract.js';
import { OFX_ITAU_REAL_EXEMPLO, OFX_CORA_REAL_EXEMPLO } from '../data/ofxItauCoraReal';
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Link2,
  Repeat,
  Settings,
  Trash2,
  Undo2,
  Unlink,
  Wallet,
} from 'lucide-react';
import { ModalVinculoClienteProcFinanceiro } from './ModalVinculoClienteProcFinanceiro.jsx';
import { buscarClientePorCodigo, buscarProcessoPorChaveNatural } from '../repositories/processosRepository.js';
import { featureFlags } from '../config/featureFlags.js';
import {
  carregarExtratosFinanceiroApiFirst,
  mergeUiLancamentoComRespostaApi,
  removerLancamentoFinanceiroApi,
  persistirFallbackExtratos,
  persistirImportacaoOfxFinanceiroApi,
  salvarOuAtualizarLancamentoFinanceiroApi,
  limparExtratoBancoFinanceiroApi,
} from '../repositories/financeiroRepository.js';
/** Ref. exibida: só N ou R (vazio/legado → N). */
function textoRefLancamento(t) {
  return normalizarRefFinanceiro(t?.ref);
}

/** Cópia profunda da lista de lançamentos de um banco (desfazer importação). */
function clonarListaExtratoBancoParaDesfazer(lista) {
  try {
    return JSON.parse(JSON.stringify(Array.isArray(lista) ? lista : []));
  } catch {
    return Array.isArray(lista) ? [...lista] : [];
  }
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

/** Após POST na API (importação OFX), associa `apiId` e metadados às linhas locais pela chave FITID+data+valor. */
function aplicarSavedPairsOfxNoEstado(prev, nomeBanco, savedPairs) {
  if (!savedPairs?.length) return prev;
  const next = cloneExtratos(prev);
  const arr = next[nomeBanco];
  if (!Array.isArray(arr)) return prev;
  const norm = String(nomeBanco || '').trim();
  for (const { row, saved } of savedPairs) {
    if (!saved?.id) continue;
    const k = chaveDedupeLancamento(row);
    const idx = arr.findIndex((t) => chaveDedupeLancamento(t) === k);
    if (idx < 0) continue;
    arr[idx] = mergeUiLancamentoComRespostaApi({ ...arr[idx], nomeBanco: norm }, saved);
  }
  return next;
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
  if (tipo === 'todos') return true;
  if (!sel) return false;
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

/** Interpreta valor em formato BR (ex.: 1.234,56 ou -50) para número. */
function parseValorExtratoBr(s) {
  const cleaned = String(s ?? '')
    .trim()
    .replace(/R\$\s?/i, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {Array} lista
 * @param {{ kind: 'todos' | 'lt0' | 'gt0' | 'exato', exatoCentavos: number | null }} filtro
 */
function filtrarExtratoPorValorFiltro(lista, filtro) {
  if (!Array.isArray(lista)) return [];
  if (!filtro || filtro.kind === 'todos') return lista;
  if (filtro.kind === 'lt0') return lista.filter((t) => (Number(t.valor) || 0) < 0);
  if (filtro.kind === 'gt0') return lista.filter((t) => (Number(t.valor) || 0) > 0);
  if (filtro.kind === 'exato' && filtro.exatoCentavos != null) {
    const c = filtro.exatoCentavos;
    return lista.filter((t) => Math.round((Number(t.valor) || 0) * 100) === c);
  }
  return lista;
}

/** Normaliza texto para busca: ignora maiúsculas/minúsculas e acentos (como em Processos → conta corrente). */
function normalizarTextoFiltroDescricaoExtrato(s) {
  return String(s ?? '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Filtro por substring na descrição do extrato (sem distinguir maiúsculas/minúsculas nem acentos). */
function filtrarExtratoPorTextoDescricao(lista, textoFiltro) {
  if (!Array.isArray(lista)) return [];
  const q = normalizarTextoFiltroDescricaoExtrato(textoFiltro);
  if (!q) return lista;
  return lista.filter((t) => normalizarTextoFiltroDescricaoExtrato(t.descricao).includes(q));
}

/**
 * @param {string[] | null} letrasPermitidas Letras maiúsculas permitidas; `null` = sem filtro.
 */
function filtrarExtratoPorLetras(lista, letrasPermitidas) {
  if (!Array.isArray(lista)) return [];
  if (!letrasPermitidas || letrasPermitidas.length === 0) return lista;
  const set = new Set(letrasPermitidas.map((l) => String(l).trim().toUpperCase()));
  return lista.filter((t) => set.has(String(t.letra ?? '').trim().toUpperCase()));
}

/** Chave estável de linha do extrato bancário (número + data). */
function extratoBancoRowKey(t) {
  return `${t.numero}::${t.data}`;
}

/**
 * Ordena o extrato por data/nº e recalcula o saldo acumulado.
 * Não colapsa linhas com a mesma chave (nº + data + valor): duplicatas legítimas no mesmo OFX/PDF permanecem visíveis.
 * A deduplicação face ao extrato já existente é feita em `mergeExtratoBancario` e na persistência API.
 */
function ordenarExtratoBancoERecalcularSaldo(lista) {
  if (!Array.isArray(lista) || lista.length === 0) return [];
  const arr = lista.map((t) => ({ ...t }));
  arr.sort((a, b) => {
    const da = dataParaOrdenar(a.data);
    const db = dataParaOrdenar(b.data);
    const c = da.localeCompare(db);
    if (c !== 0) return c;
    return String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true });
  });
  let saldo = 0;
  for (const row of arr) {
    saldo += Number(row.valor) || 0;
    row.saldo = saldo;
  }
  return arr;
}

/**
 * Com lista em ordem cronológica crescente (padrão, `sortCol` nulo), o limite mostra os **últimos** N = mais recentes.
 * Com ordenação por data decrescente, os N primeiros já são os mais recentes.
 */
function aplicarLimiteExtratoBancoMaisRecentes(lista, maxLinhas, sortCol, sortDir) {
  const total = lista.length;
  if (maxLinhas === 0 || total <= maxLinhas) return lista;
  // `col` nulo = ordem original do merge (data crescente) — antes caía no slice(0) e mostrava janeiro em vez de abril
  if (sortCol == null || sortCol === 'data') {
    const recentFirst = sortDir === 'desc';
    return recentFirst ? lista.slice(0, maxLinhas) : lista.slice(total - maxLinhas);
  }
  return lista.slice(0, maxLinhas);
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

function chaveCandidatoRecorrenciaModal(g, c) {
  return `${g.idGrupo}§${c.numero}|${c.data}`;
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

/** PUT a cada tecla em Cód./Proc. gerava corrida: resposta antiga repunha o valor no input. */
const COD_PROC_FINANCEIRO_API_DEBOUNCE_MS = 450;

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

  const codProcDebounceTimersRef = useRef(new Map());
  useEffect(() => {
    return () => {
      for (const tid of codProcDebounceTimersRef.current.values()) {
        window.clearTimeout(tid);
      }
      codProcDebounceTimersRef.current.clear();
    };
  }, []);

  /**
   * Linha mais recente por chave, gravada no updater de setExtratosPorBanco (síncrono).
   * Sem isto, Tab logo após digitar/colar dispara onBlur antes do useEffect atualizar
   * extratosPorBancoRef — o PUT ia com cod./proc. vazios e “apagava” o formulário.
   */
  const ultimaLinhaEdicaoExtratoRef = useRef(new Map());

  /** Última importação em modo mesclar por banco: restaurar lista local e apagar lançamentos criados na API. */
  const desfazerImportacaoExtratoRef = useRef({});
  const [desfazerImportacaoTick, setDesfazerImportacaoTick] = useState(0);

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
  /** Filtro opcional da coluna Valor no extrato do banco (clique no cabeçalho). */
  const [filtroValorExtrato, setFiltroValorExtrato] = useState({
    kind: 'todos',
    exatoCentavos: null,
  });
  const [menuFiltroValorExtratoAberto, setMenuFiltroValorExtratoAberto] = useState(false);
  const [filtroValorExatoRascunho, setFiltroValorExatoRascunho] = useState('');
  const menuFiltroValorExtratoRef = useRef(null);
  const valorExtratoHeaderTimerRef = useRef(null);
  /** Filtro por texto no cabeçalho Descrição do extrato do banco. */
  const [filtroDescricaoExtrato, setFiltroDescricaoExtrato] = useState('');
  const [menuFiltroDescricaoExtratoAberto, setMenuFiltroDescricaoExtratoAberto] = useState(false);
  const [filtroDescricaoExtratoRascunho, setFiltroDescricaoExtratoRascunho] = useState('');
  const menuFiltroDescricaoExtratoRef = useRef(null);
  const descricaoExtratoHeaderTimerRef = useRef(null);
  /** null = todas as letras; caso contrário só linhas cuja letra está na lista. */
  const [filtroLetrasExtrato, setFiltroLetrasExtrato] = useState(null);
  const [menuFiltroLetraExtratoAberto, setMenuFiltroLetraExtratoAberto] = useState(false);
  const [filtroLetrasExtratoRascunho, setFiltroLetrasExtratoRascunho] = useState([]);
  const menuFiltroLetraExtratoRef = useRef(null);
  const letraExtratoHeaderTimerRef = useRef(null);
  /** Filtros nos cabeçalhos Cod. Cliente e Proc. (extrato do banco). */
  const [filtroCodClienteExtrato, setFiltroCodClienteExtrato] = useState('');
  const [filtroCodClienteExtratoRascunho, setFiltroCodClienteExtratoRascunho] = useState('');
  const [menuFiltroCodClienteExtratoAberto, setMenuFiltroCodClienteExtratoAberto] = useState(false);
  const menuFiltroCodClienteExtratoRef = useRef(null);
  const codClienteExtratoHeaderTimerRef = useRef(null);
  const [filtroProcExtrato, setFiltroProcExtrato] = useState('');
  const [filtroProcExtratoRascunho, setFiltroProcExtratoRascunho] = useState('');
  const [menuFiltroProcExtratoAberto, setMenuFiltroProcExtratoAberto] = useState(false);
  const menuFiltroProcExtratoRef = useRef(null);
  const procExtratoHeaderTimerRef = useRef(null);
  /** Cabeçalhos Cod. Cliente e Proc. / Elo no consolidado — devem existir antes dos useEffect que os referenciam (TDZ). */
  const [filtroCodClienteConsolidado, setFiltroCodClienteConsolidado] = useState('');
  const [filtroCodClienteConsolidadoRascunho, setFiltroCodClienteConsolidadoRascunho] = useState('');
  const [menuFiltroCodClienteConsolidadoAberto, setMenuFiltroCodClienteConsolidadoAberto] = useState(false);
  const menuFiltroCodClienteConsolidadoRef = useRef(null);
  const codClienteConsolidadoHeaderTimerRef = useRef(null);
  const [filtroProcConsolidado, setFiltroProcConsolidado] = useState('');
  const [filtroProcConsolidadoRascunho, setFiltroProcConsolidadoRascunho] = useState('');
  const [menuFiltroProcConsolidadoAberto, setMenuFiltroProcConsolidadoAberto] = useState(false);
  const menuFiltroProcConsolidadoRef = useRef(null);
  const procConsolidadoHeaderTimerRef = useRef(null);
  /** Linhas do extrato marcadas para alteração em lote (`extratoBancoRowKey`). */
  const [extratoLinhasSelecionadas, setExtratoLinhasSelecionadas] = useState(() => new Set());
  const [letraLoteExtrato, setLetraLoteExtrato] = useState('');
  const extratoSelectAllHeaderRef = useRef(null);

  useEffect(() => {
    setFiltroValorExtrato({ kind: 'todos', exatoCentavos: null });
    setFiltroValorExatoRascunho('');
    setMenuFiltroValorExtratoAberto(false);
    setFiltroDescricaoExtrato('');
    setFiltroDescricaoExtratoRascunho('');
    setMenuFiltroDescricaoExtratoAberto(false);
    setFiltroLetrasExtrato(null);
    setMenuFiltroLetraExtratoAberto(false);
    setFiltroLetrasExtratoRascunho([]);
    setFiltroCodClienteExtrato('');
    setFiltroCodClienteExtratoRascunho('');
    setMenuFiltroCodClienteExtratoAberto(false);
    setFiltroProcExtrato('');
    setFiltroProcExtratoRascunho('');
    setMenuFiltroProcExtratoAberto(false);
    setExtratoLinhasSelecionadas(new Set());
    setLetraLoteExtrato('');
  }, [instituicaoSelecionada]);

  useEffect(() => {
    if (!menuFiltroValorExtratoAberto) return undefined;
    const fn = (e) => {
      if (menuFiltroValorExtratoRef.current && !menuFiltroValorExtratoRef.current.contains(e.target)) {
        setMenuFiltroValorExtratoAberto(false);
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [menuFiltroValorExtratoAberto]);

  useEffect(() => {
    if (!menuFiltroDescricaoExtratoAberto) return undefined;
    const fn = (e) => {
      if (
        menuFiltroDescricaoExtratoRef.current &&
        !menuFiltroDescricaoExtratoRef.current.contains(e.target)
      ) {
        setMenuFiltroDescricaoExtratoAberto(false);
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [menuFiltroDescricaoExtratoAberto]);

  useEffect(() => {
    if (!menuFiltroLetraExtratoAberto) return undefined;
    const fn = (e) => {
      if (menuFiltroLetraExtratoRef.current && !menuFiltroLetraExtratoRef.current.contains(e.target)) {
        setMenuFiltroLetraExtratoAberto(false);
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [menuFiltroLetraExtratoAberto]);

  useEffect(() => {
    if (!menuFiltroCodClienteExtratoAberto) return undefined;
    const fn = (e) => {
      if (
        menuFiltroCodClienteExtratoRef.current &&
        !menuFiltroCodClienteExtratoRef.current.contains(e.target)
      ) {
        setMenuFiltroCodClienteExtratoAberto(false);
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [menuFiltroCodClienteExtratoAberto]);

  useEffect(() => {
    if (!menuFiltroProcExtratoAberto) return undefined;
    const fn = (e) => {
      if (menuFiltroProcExtratoRef.current && !menuFiltroProcExtratoRef.current.contains(e.target)) {
        setMenuFiltroProcExtratoAberto(false);
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [menuFiltroProcExtratoAberto]);

  useEffect(() => {
    if (!menuFiltroCodClienteConsolidadoAberto) return undefined;
    const fn = (e) => {
      if (
        menuFiltroCodClienteConsolidadoRef.current &&
        !menuFiltroCodClienteConsolidadoRef.current.contains(e.target)
      ) {
        setMenuFiltroCodClienteConsolidadoAberto(false);
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [menuFiltroCodClienteConsolidadoAberto]);

  useEffect(() => {
    if (!menuFiltroProcConsolidadoAberto) return undefined;
    const fn = (e) => {
      if (
        menuFiltroProcConsolidadoRef.current &&
        !menuFiltroProcConsolidadoRef.current.contains(e.target)
      ) {
        setMenuFiltroProcConsolidadoAberto(false);
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [menuFiltroProcConsolidadoAberto]);

  useEffect(
    () => () => {
      if (valorExtratoHeaderTimerRef.current) {
        clearTimeout(valorExtratoHeaderTimerRef.current);
      }
      if (descricaoExtratoHeaderTimerRef.current) {
        clearTimeout(descricaoExtratoHeaderTimerRef.current);
      }
      if (letraExtratoHeaderTimerRef.current) {
        clearTimeout(letraExtratoHeaderTimerRef.current);
      }
      if (codClienteExtratoHeaderTimerRef.current) {
        clearTimeout(codClienteExtratoHeaderTimerRef.current);
      }
      if (procExtratoHeaderTimerRef.current) {
        clearTimeout(procExtratoHeaderTimerRef.current);
      }
      if (codClienteConsolidadoHeaderTimerRef.current) {
        clearTimeout(codClienteConsolidadoHeaderTimerRef.current);
      }
      if (procConsolidadoHeaderTimerRef.current) {
        clearTimeout(procConsolidadoHeaderTimerRef.current);
      }
    },
    []
  );

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
  const fileInputBtgPdfRef = useRef(null);
  const [ofxStatus, setOfxStatus] = useState({ kind: 'idle', message: '' });
  const [substituirExtratoOfxCompleto, setSubstituirExtratoOfxCompleto] = useState(false);
  const [modalParearCompensacao, setModalParearCompensacao] = useState(null);
  /** null | { nomeBanco, grupos, selecionados: Set<string> } — copiar letra A + Cód./Proc. do modelo para outros meses. */
  const [modalRecorrenciaMensal, setModalRecorrenciaMensal] = useState(null);
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
      const cached = loadPersistedExtratosFinanceiro() || {};
      const bankKeys = new Set([...Object.keys(base), ...Object.keys(cached), ...Object.keys(dados)]);
      const merged = { ...base };
      for (const k of bankKeys) {
        const cacheRows = Array.isArray(cached[k]) ? cached[k] : [];
        const baseRows = Array.isArray(base[k]) ? base[k] : [];
        const localFallback = cacheRows.length > 0 ? cacheRows : baseRows;
        if (Object.prototype.hasOwnProperty.call(dados, k)) {
          const apiRows = Array.isArray(dados[k]) ? dados[k] : [];
          merged[k] = mergeExtratoApiComLocal(apiRows, localFallback);
        } else if (cacheRows.length > 0) {
          /* Chave ausente na API = zero lançamentos desse banco no servidor; não reidratar só do cache
           * (senão extrato apagado no BD reaparece). Mantém só linhas ainda não persistidas (sem apiId). */
          merged[k] = mergeExtratoApiComLocal([], cacheRows);
        } else {
          merged[k] = [...baseRows];
        }
      }
      setExtratosPorBanco(merged);
    } catch (e) {
      setApiFinanceiroErro(e?.message || 'Falha ao carregar financeiro da API.');
    } finally {
      setApiFinanceiroLoading(false);
    }
  }, []);

  const zerarExtratoSelecionado = useCallback(async () => {
    const nome = String(instituicaoSelecionada || '').trim();
    if (!nome) {
      setOfxStatus({ kind: 'info', message: 'Selecione um banco / extrato antes de zerar.' });
      return;
    }
    if (
      !window.confirm(
        `Zerar o extrato «${nome}»: remove todos os lançamentos na API (se ativa), limpa a cópia local e desfaz elos de compensação ligados a esse extrato noutros bancos. Continuar?`,
      )
    ) {
      return;
    }
    setOfxStatus({ kind: 'loading', message: `A limpar extrato ${nome}…` });
    try {
      let removidos = 0;
      let desvinc = 0;
      if (featureFlags.useApiFinanceiro) {
        const nb = buildNumeroBancoMap(contasExtras)[nome];
        const r = await limparExtratoBancoFinanceiroApi(nome, nb);
        removidos = Number(r?.lancamentosRemovidos) || 0;
        desvinc = Number(r?.lancamentosDesvinculadosOutrosBancos) || 0;
      }
      const mergedBase = {
        ...getExtratosIniciais(),
        ...(loadPersistedExtratosFinanceiro() || {}),
      };
      const cleaned = limparExtratoBancoEElosRelacionados(mergedBase, nome);
      savePersistedExtratosFinanceiro(cleaned);
      delete desfazerImportacaoExtratoRef.current[nome];
      setDesfazerImportacaoTick((t) => t + 1);
      if (featureFlags.useApiFinanceiro) {
        await recarregarExtratosFinanceiroApi();
      } else {
        setExtratosPorBanco((prev) =>
          limparExtratoBancoEElosRelacionados({ ...getExtratosIniciais(), ...prev }, nome),
        );
      }
      const extra =
        featureFlags.useApiFinanceiro && (removidos > 0 || desvinc > 0)
          ? ` API: ${removidos} lanç. removidos neste banco; ${desvinc} desvinculados noutros bancos.`
          : '';
      setOfxStatus({
        kind: 'success',
        message: `Extrato «${nome}» limpo.${extra} Pode importar de novo do zero.`,
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EVENT_FINANCEIRO_PERSISTENCIA_EXTERNA));
      }
    } catch (e) {
      setOfxStatus({
        kind: 'error',
        message: e?.message || `Não foi possível limpar o extrato «${nome}».`,
      });
    }
  }, [contasExtras, instituicaoSelecionada, recarregarExtratosFinanceiroApi]);

  const registrarDesfazerImportacaoMesclagem = useCallback(
    (nomeBanco, previousRows, savedPairs, modo, houveAlteracao) => {
      const n = String(nomeBanco || '').trim();
      if (!n) return;
      if (modo !== 'mesclar') {
        delete desfazerImportacaoExtratoRef.current[n];
        setDesfazerImportacaoTick((t) => t + 1);
        return;
      }
      if (!houveAlteracao) return;
      const addedApiIds = (savedPairs || [])
        .map((p) => Number(p?.saved?.id))
        .filter((id) => Number.isFinite(id) && id > 0);
      desfazerImportacaoExtratoRef.current[n] = {
        previousRows: clonarListaExtratoBancoParaDesfazer(previousRows),
        addedApiIds,
      };
      setDesfazerImportacaoTick((t) => t + 1);
    },
    [],
  );

  const reverterUltimaImportacaoExtrato = useCallback(async () => {
    const nome = String(instituicaoSelecionada || '').trim();
    const snap = nome ? desfazerImportacaoExtratoRef.current[nome] : null;
    if (!snap) {
      setOfxStatus({
        kind: 'info',
        message:
          'Não há o que reverter neste extrato. Só fica disponível após uma importação em modo mesclar (não vale para «Substituir todo o extrato»).',
      });
      return;
    }
    if (
      !window.confirm(
        `Restaurar o extrato «${nome}» ao estado imediatamente anterior à última importação (OFX/PDF)?${
          featureFlags.useApiFinanceiro
            ? ' Os lançamentos criados na API nessa importação serão excluídos.'
            : ''
        }`,
      )
    ) {
      return;
    }
    setOfxStatus({ kind: 'loading', message: 'A reverter a última importação…' });
    try {
      if (featureFlags.useApiFinanceiro && snap.addedApiIds?.length) {
        for (const id of snap.addedApiIds) {
          try {
            await removerLancamentoFinanceiroApi(id);
          } catch {
            /* já removido ou falha de rede */
          }
        }
      }
      setExtratosPorBanco((prev) => {
        const next = { ...prev, [nome]: clonarListaExtratoBancoParaDesfazer(snap.previousRows) };
        try {
          savePersistedExtratosFinanceiro(next);
        } catch {
          /* ignore */
        }
        return next;
      });
      delete desfazerImportacaoExtratoRef.current[nome];
      setDesfazerImportacaoTick((t) => t + 1);
      if (featureFlags.useApiFinanceiro) {
        await recarregarExtratosFinanceiroApi();
      }
      setOfxStatus({
        kind: 'success',
        message: `Extrato «${nome}» restaurado ao estado anterior à última importação.`,
      });
    } catch (e) {
      setOfxStatus({
        kind: 'error',
        message: e?.message || 'Não foi possível reverter a última importação.',
      });
    }
  }, [instituicaoSelecionada, recarregarExtratosFinanceiroApi]);

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

  const podeReverterUltimaImportacaoExtrato = useMemo(() => {
    const n = String(instituicaoSelecionada || '').trim();
    return Boolean(n && desfazerImportacaoExtratoRef.current[n]);
  }, [instituicaoSelecionada, desfazerImportacaoTick]);

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
    const bruto = getTransacoesBanco(extratosPorBanco, instituicaoSelecionada);
    const normalizado = ordenarExtratoBancoERecalcularSaldo(bruto);
    return ordenarTransacoesBanco(normalizado, sortExtratoBanco.col, sortExtratoBanco.dir);
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

  const listaExtratoAposFiltroLetra = useMemo(
    () =>
      filtrarExtratoPorLetras(
        listaExtratoBancoVisivel,
        filtroLetrasExtrato != null && filtroLetrasExtrato.length > 0 ? filtroLetrasExtrato : null
      ),
    [listaExtratoBancoVisivel, filtroLetrasExtrato]
  );

  const listaExtratoAposFiltroCodClienteProc = useMemo(
    () =>
      filtrarLancamentosPorCabecalhoCodClienteProc(
        listaExtratoAposFiltroLetra,
        filtroCodClienteExtrato,
        filtroProcExtrato
      ),
    [listaExtratoAposFiltroLetra, filtroCodClienteExtrato, filtroProcExtrato]
  );

  const listaExtratoAposFiltroDescricao = useMemo(
    () => filtrarExtratoPorTextoDescricao(listaExtratoAposFiltroCodClienteProc, filtroDescricaoExtrato),
    [listaExtratoAposFiltroCodClienteProc, filtroDescricaoExtrato]
  );

  const listaExtratoAposFiltroValor = useMemo(
    () => filtrarExtratoPorValorFiltro(listaExtratoAposFiltroDescricao, filtroValorExtrato),
    [listaExtratoAposFiltroDescricao, filtroValorExtrato]
  );

  const listaExtratoBancoParaTabela = useMemo(
    () =>
      aplicarLimiteExtratoBancoMaisRecentes(
        listaExtratoAposFiltroValor,
        limiteLancamentosExtratoBanco,
        sortExtratoBanco.col,
        sortExtratoBanco.dir
      ),
    [
      listaExtratoAposFiltroValor,
      limiteLancamentosExtratoBanco,
      sortExtratoBanco.col,
      sortExtratoBanco.dir,
    ]
  );

  const extratoVisRowKeys = useMemo(
    () => listaExtratoBancoParaTabela.map(extratoBancoRowKey),
    [listaExtratoBancoParaTabela]
  );
  const extratoTodasVisiveisSelecionadas =
    extratoVisRowKeys.length > 0 && extratoVisRowKeys.every((k) => extratoLinhasSelecionadas.has(k));
  const extratoAlgumaVisivelSelecionada = extratoVisRowKeys.some((k) => extratoLinhasSelecionadas.has(k));

  useEffect(() => {
    const el = extratoSelectAllHeaderRef.current;
    if (el) {
      el.indeterminate = extratoAlgumaVisivelSelecionada && !extratoTodasVisiveisSelecionadas;
    }
  }, [extratoAlgumaVisivelSelecionada, extratoTodasVisiveisSelecionadas]);

  useEffect(() => {
    const valid = new Set(listaExtratoAposFiltroValor.map(extratoBancoRowKey));
    setExtratoLinhasSelecionadas((prev) => {
      const next = new Set([...prev].filter((k) => valid.has(k)));
      if (next.size === prev.size && [...prev].every((k) => next.has(k))) return prev;
      return next;
    });
  }, [listaExtratoAposFiltroValor]);

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
    setFiltroCodClienteConsolidado('');
    setFiltroCodClienteConsolidadoRascunho('');
    setMenuFiltroCodClienteConsolidadoAberto(false);
    setFiltroProcConsolidado('');
    setFiltroProcConsolidadoRascunho('');
    setMenuFiltroProcConsolidadoAberto(false);
  }, [contaContabilSelecionada]);

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

  const listaConsolidadaAposFiltroCodClienteProc = useMemo(
    () =>
      filtrarLancamentosPorCabecalhoCodClienteProc(
        listaConsolidadaVisivel,
        filtroCodClienteConsolidado,
        filtroProcConsolidado
      ),
    [listaConsolidadaVisivel, filtroCodClienteConsolidado, filtroProcConsolidado]
  );

  /** Conta Escritório: quantas linhas (no período/filtro atual) compartilham cada Eq. entre lançamentos Ref. R. */
  const contagemEqRepasseEscritorio = useMemo(() => {
    const m = new Map();
    if (!isContaEscritorio) return m;
    for (const t of listaConsolidadaAposFiltroCodClienteProc) {
      if (normalizarRefFinanceiro(t.ref) !== 'R') continue;
      const eq = String(textoDimensaoEq(t) ?? '').trim();
      if (!eq) continue;
      m.set(eq, (m.get(eq) || 0) + 1);
    }
    return m;
  }, [isContaEscritorio, listaConsolidadaAposFiltroCodClienteProc]);

  const saldoHeaderConsolidado = useMemo(
    () => listaConsolidadaAposFiltroCodClienteProc.reduce((s, t) => s + t.valor, 0),
    [listaConsolidadaAposFiltroCodClienteProc]
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
    let linhaParaApi = null;
    setExtratosPorBanco((prev) => {
      const next = cloneExtratos(prev);
      const list = next[nomeBanco];
      if (!list) return prev;
      const idx = list.findIndex((t) => t.numero === numero && t.data === data);
      if (idx === -1) return prev;
      const L = String(novaLetra ?? '').trim().toUpperCase();
      const updated = {
        ...list[idx],
        letra: L,
        ...(L === 'E' ? { codCliente: '', proc: '' } : {}),
      };
      list[idx] = updated;
      linhaParaApi = updated;
      ultimaLinhaEdicaoExtratoRef.current.set(`${nomeBanco}|${numero}|${data}`, updated);
      return next;
    });
    if (featureFlags.useApiFinanceiro && linhaParaApi) {
      void sincronizarLancamentoApi(nomeBanco, numero, data, linhaParaApi);
    }
  }

  function updateLetraLancamentosEmLote(nomeBanco, keys, novaLetra) {
    const L = String(novaLetra ?? '').trim().toUpperCase();
    if (!L || !keys.length) return;
    const keySet = new Set(keys);
    const listAtual = extratosPorBancoRef.current?.[nomeBanco];
    const snapshots = [];
    if (Array.isArray(listAtual)) {
      for (const t of listAtual) {
        const k = extratoBancoRowKey(t);
        if (!keySet.has(k)) continue;
        snapshots.push({
          numero: t.numero,
          data: t.data,
          snapshot: {
            ...t,
            letra: L,
            ...(L === 'E' ? { codCliente: '', proc: '' } : {}),
          },
        });
      }
    }
    setExtratosPorBanco((prev) => {
      const next = cloneExtratos(prev);
      const list = next[nomeBanco];
      if (!list) return prev;
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (!keySet.has(extratoBancoRowKey(t))) continue;
        list[i] = {
          ...list[i],
          letra: L,
          ...(L === 'E' ? { codCliente: '', proc: '' } : {}),
        };
      }
      return next;
    });
    if (featureFlags.useApiFinanceiro) {
      for (const { numero, data, snapshot } of snapshots) {
        void sincronizarLancamentoApi(nomeBanco, numero, data, snapshot);
      }
    }
  }

  function updateCampoLancamento(nomeBanco, numero, data, field, value) {
    let linhaParaApi = null;
    setExtratosPorBanco((prev) => {
      const next = cloneExtratos(prev);
      const list = next[nomeBanco];
      if (!list) return prev;
      const idx = list.findIndex((t) => t.numero === numero && t.data === data);
      if (idx === -1) return prev;
      const base = list[idx];
      const v = String(value ?? '');
      let updated;
      if (field === 'categoria' || field === 'descricaoDetalhada') {
        updated = { ...base, categoria: v, descricaoDetalhada: v };
      } else if (field === 'ref') {
        const refN = normalizarRefFinanceiro(v);
        if (refN === 'N') {
          updated = { ...base, ref: 'N', dimensao: '', eq: '' };
        } else {
          updated = { ...base, ref: 'R' };
        }
      } else if (field === 'dimensao' || field === 'eq') {
        updated = { ...base, dimensao: v, eq: v };
      } else {
        updated = { ...base, [field]: value };
      }
      list[idx] = updated;
      linhaParaApi = updated;
      ultimaLinhaEdicaoExtratoRef.current.set(`${nomeBanco}|${numero}|${data}`, updated);
      return next;
    });
    if (featureFlags.useApiFinanceiro && linhaParaApi) {
      if (field === 'codCliente' || field === 'proc') {
        const key = `${nomeBanco}|${numero}|${data}`;
        const prev = codProcDebounceTimersRef.current.get(key);
        if (prev != null) window.clearTimeout(prev);
        const tid = window.setTimeout(() => {
          codProcDebounceTimersRef.current.delete(key);
          void sincronizarLancamentoApi(nomeBanco, numero, data, null);
        }, COD_PROC_FINANCEIRO_API_DEBOUNCE_MS);
        codProcDebounceTimersRef.current.set(key, tid);
      } else {
        void sincronizarLancamentoApi(nomeBanco, numero, data, linhaParaApi);
      }
    }
  }

  /**
   * Grava lançamento na API. `linhaSnapshot` deve ser a linha já editada: o ref `extratosPorBancoRef`
   * só atualiza no useEffect seguinte — sem snapshot, PUT mandava cod./proc. antigos.
   */
  async function sincronizarLancamentoApi(nomeBanco, numero, data, linhaSnapshot = null) {
    try {
      const list = extratosPorBancoRef.current?.[nomeBanco];
      const chaveRow = `${nomeBanco}|${numero}|${data}`;
      const atual =
        linhaSnapshot &&
        String(linhaSnapshot.numero) === String(numero) &&
        linhaSnapshot.data === data
          ? linhaSnapshot
          : (() => {
              const snap = ultimaLinhaEdicaoExtratoRef.current.get(chaveRow);
              if (
                snap &&
                String(snap.numero) === String(numero) &&
                snap.data === data
              ) {
                return snap;
              }
              return Array.isArray(list)
                ? list.find((t) => String(t.numero) === String(numero) && t.data === data)
                : null;
            })();
      if (!atual) return;

      let rowParaApi = { ...atual, nomeBanco };
      const metaIn = atual._financeiroMeta || {};

      if (featureFlags.useApiFinanceiro && featureFlags.useApiProcessos) {
        const cod = normalizarCodigoClienteFinanceiro(atual.codCliente);
        const procStr = normalizarProcFinanceiro(atual.proc);
        try {
          /* Sempre derivar ids do texto atual: antes só resolvia com !clienteId, então o PUT
           * mandava o cliente antigo e a API devolvia o código antigo (ex. 1985), apagando 938 no input. */
          let clienteIdRes = null;
          let processoIdRes = null;
          if (cod) {
            const c = await buscarClientePorCodigo(cod);
            if (c?.id != null && Number.isFinite(Number(c.id))) {
              clienteIdRes = Number(c.id);
              if (procStr) {
                const p = await buscarProcessoPorChaveNatural(cod, procStr);
                if (p?.id != null && Number.isFinite(Number(p.id))) processoIdRes = Number(p.id);
              }
            }
          }
          rowParaApi = {
            ...rowParaApi,
            _financeiroMeta: { ...metaIn, clienteId: clienteIdRes, processoId: processoIdRes },
          };
        } catch {
          /* rede / API processos: mantém meta da linha sem regravar ids inferidos */
        }
      }

      const saved = await salvarOuAtualizarLancamentoFinanceiroApi(rowParaApi);
      if (!saved?.id) return;
      setExtratosPorBanco((prev) => {
        const next = cloneExtratos(prev);
        const arr = next[nomeBanco];
        if (!Array.isArray(arr)) return prev;
        const i = arr.findIndex((t) => t.numero === numero && t.data === data);
        if (i < 0) return prev;
        arr[i] = mergeUiLancamentoComRespostaApi({ ...arr[i], nomeBanco }, saved);
        ultimaLinhaEdicaoExtratoRef.current.delete(`${nomeBanco}|${numero}|${data}`);
        return next;
      });
    } catch (e) {
      setApiFinanceiroErro(e?.message || 'Falha ao sincronizar lançamento com API.');
    }
  }

  function flushSincronizarCodProcDebounced(nomeBanco, numero, data) {
    if (!featureFlags.useApiFinanceiro) return;
    const key = `${nomeBanco}|${numero}|${data}`;
    const prev = codProcDebounceTimersRef.current.get(key);
    if (prev != null) {
      window.clearTimeout(prev);
      codProcDebounceTimersRef.current.delete(key);
    }
    void sincronizarLancamentoApi(nomeBanco, numero, data, null);
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

  function handleClickCabecalhoLetraExtrato() {
    if (letraExtratoHeaderTimerRef.current) {
      clearTimeout(letraExtratoHeaderTimerRef.current);
      letraExtratoHeaderTimerRef.current = null;
      return;
    }
    letraExtratoHeaderTimerRef.current = window.setTimeout(() => {
      letraExtratoHeaderTimerRef.current = null;
      setMenuFiltroLetraExtratoAberto((aberto) => {
        const next = !aberto;
        if (next) {
          setFiltroLetrasExtratoRascunho(
            filtroLetrasExtrato != null && filtroLetrasExtrato.length > 0
              ? [...filtroLetrasExtrato]
              : [...letrasOrdenadasParaSelect]
          );
          setMenuFiltroValorExtratoAberto(false);
          setMenuFiltroDescricaoExtratoAberto(false);
          setMenuFiltroCodClienteExtratoAberto(false);
          setMenuFiltroProcExtratoAberto(false);
        }
        return next;
      });
    }, 280);
  }

  function handleDuploCliqueCabecalhoLetraExtrato(e) {
    e.preventDefault();
    if (letraExtratoHeaderTimerRef.current) {
      clearTimeout(letraExtratoHeaderTimerRef.current);
      letraExtratoHeaderTimerRef.current = null;
    }
    setMenuFiltroLetraExtratoAberto(false);
    handleDuploCliqueTituloExtratoBanco('letra');
  }

  function toggleRascunhoFiltroLetraExtrato(L) {
    const u = String(L).trim().toUpperCase();
    setFiltroLetrasExtratoRascunho((prev) => {
      const set = new Set(prev.map((x) => String(x).trim().toUpperCase()));
      if (set.has(u)) set.delete(u);
      else set.add(u);
      return letrasOrdenadasParaSelect.filter((l) => set.has(l));
    });
  }

  function marcarTodasRascunhoFiltroLetraExtrato() {
    setFiltroLetrasExtratoRascunho([...letrasOrdenadasParaSelect]);
  }

  function desmarcarTodasRascunhoFiltroLetraExtrato() {
    setFiltroLetrasExtratoRascunho([]);
  }

  function aplicarFiltroLetraExtrato() {
    const all = letrasOrdenadasParaSelect;
    const sel = new Set(filtroLetrasExtratoRascunho.map((x) => String(x).trim().toUpperCase()));
    if (sel.size === 0 || (sel.size === all.length && all.every((l) => sel.has(l)))) {
      setFiltroLetrasExtrato(null);
    } else {
      setFiltroLetrasExtrato(all.filter((l) => sel.has(l)));
    }
    setMenuFiltroLetraExtratoAberto(false);
  }

  function limparFiltroLetraExtrato() {
    setFiltroLetrasExtrato(null);
    setFiltroLetrasExtratoRascunho([...letrasOrdenadasParaSelect]);
    setMenuFiltroLetraExtratoAberto(false);
  }

  function handleClickCabecalhoValorExtrato() {
    if (valorExtratoHeaderTimerRef.current) {
      clearTimeout(valorExtratoHeaderTimerRef.current);
      valorExtratoHeaderTimerRef.current = null;
      return;
    }
    valorExtratoHeaderTimerRef.current = window.setTimeout(() => {
      valorExtratoHeaderTimerRef.current = null;
      setMenuFiltroValorExtratoAberto((o) => {
        const next = !o;
        if (next) {
          setMenuFiltroDescricaoExtratoAberto(false);
          setMenuFiltroLetraExtratoAberto(false);
          setMenuFiltroCodClienteExtratoAberto(false);
          setMenuFiltroProcExtratoAberto(false);
        }
        return next;
      });
    }, 280);
  }

  function handleClickCabecalhoDescricaoExtrato() {
    if (descricaoExtratoHeaderTimerRef.current) {
      clearTimeout(descricaoExtratoHeaderTimerRef.current);
      descricaoExtratoHeaderTimerRef.current = null;
      return;
    }
    descricaoExtratoHeaderTimerRef.current = window.setTimeout(() => {
      descricaoExtratoHeaderTimerRef.current = null;
      setMenuFiltroDescricaoExtratoAberto((aberto) => {
        const next = !aberto;
        if (next) {
          setFiltroDescricaoExtratoRascunho(filtroDescricaoExtrato);
          setMenuFiltroValorExtratoAberto(false);
          setMenuFiltroLetraExtratoAberto(false);
          setMenuFiltroCodClienteExtratoAberto(false);
          setMenuFiltroProcExtratoAberto(false);
        }
        return next;
      });
    }, 280);
  }

  function handleDuploCliqueCabecalhoDescricaoExtrato(e) {
    e.preventDefault();
    if (descricaoExtratoHeaderTimerRef.current) {
      clearTimeout(descricaoExtratoHeaderTimerRef.current);
      descricaoExtratoHeaderTimerRef.current = null;
    }
    setMenuFiltroDescricaoExtratoAberto(false);
    handleDuploCliqueTituloExtratoBanco('descricao');
  }

  function aplicarFiltroDescricaoExtrato() {
    setFiltroDescricaoExtrato(filtroDescricaoExtratoRascunho.trim());
    setMenuFiltroDescricaoExtratoAberto(false);
  }

  function limparFiltroDescricaoExtrato() {
    setFiltroDescricaoExtrato('');
    setFiltroDescricaoExtratoRascunho('');
    setMenuFiltroDescricaoExtratoAberto(false);
  }

  function limparFiltrosCodProcExtrato() {
    setFiltroCodClienteExtrato('');
    setFiltroCodClienteExtratoRascunho('');
    setMenuFiltroCodClienteExtratoAberto(false);
    setFiltroProcExtrato('');
    setFiltroProcExtratoRascunho('');
    setMenuFiltroProcExtratoAberto(false);
  }

  function handleClickCabecalhoCodClienteExtrato() {
    if (codClienteExtratoHeaderTimerRef.current) {
      clearTimeout(codClienteExtratoHeaderTimerRef.current);
      codClienteExtratoHeaderTimerRef.current = null;
      return;
    }
    codClienteExtratoHeaderTimerRef.current = window.setTimeout(() => {
      codClienteExtratoHeaderTimerRef.current = null;
      setMenuFiltroCodClienteExtratoAberto((aberto) => {
        const next = !aberto;
        if (next) {
          setFiltroCodClienteExtratoRascunho(filtroCodClienteExtrato);
          setMenuFiltroProcExtratoAberto(false);
          setMenuFiltroValorExtratoAberto(false);
          setMenuFiltroDescricaoExtratoAberto(false);
          setMenuFiltroLetraExtratoAberto(false);
        }
        return next;
      });
    }, 280);
  }

  function handleDuploCliqueCabecalhoCodClienteExtrato(e) {
    e.preventDefault();
    if (codClienteExtratoHeaderTimerRef.current) {
      clearTimeout(codClienteExtratoHeaderTimerRef.current);
      codClienteExtratoHeaderTimerRef.current = null;
    }
    setMenuFiltroCodClienteExtratoAberto(false);
    handleDuploCliqueTituloExtratoBanco('codCliente');
  }

  function aplicarFiltroCodClienteExtrato() {
    setFiltroCodClienteExtrato(filtroCodClienteExtratoRascunho.trim());
    setMenuFiltroCodClienteExtratoAberto(false);
  }

  function limparFiltroCodClienteExtrato() {
    setFiltroCodClienteExtrato('');
    setFiltroCodClienteExtratoRascunho('');
    setMenuFiltroCodClienteExtratoAberto(false);
  }

  function handleClickCabecalhoProcExtrato() {
    if (procExtratoHeaderTimerRef.current) {
      clearTimeout(procExtratoHeaderTimerRef.current);
      procExtratoHeaderTimerRef.current = null;
      return;
    }
    procExtratoHeaderTimerRef.current = window.setTimeout(() => {
      procExtratoHeaderTimerRef.current = null;
      setMenuFiltroProcExtratoAberto((aberto) => {
        const next = !aberto;
        if (next) {
          setFiltroProcExtratoRascunho(filtroProcExtrato);
          setMenuFiltroCodClienteExtratoAberto(false);
          setMenuFiltroValorExtratoAberto(false);
          setMenuFiltroDescricaoExtratoAberto(false);
          setMenuFiltroLetraExtratoAberto(false);
        }
        return next;
      });
    }, 280);
  }

  function handleDuploCliqueCabecalhoProcExtrato(e) {
    e.preventDefault();
    if (procExtratoHeaderTimerRef.current) {
      clearTimeout(procExtratoHeaderTimerRef.current);
      procExtratoHeaderTimerRef.current = null;
    }
    setMenuFiltroProcExtratoAberto(false);
    handleDuploCliqueTituloExtratoBanco('proc');
  }

  function aplicarFiltroProcExtrato() {
    setFiltroProcExtrato(filtroProcExtratoRascunho.trim());
    setMenuFiltroProcExtratoAberto(false);
  }

  function limparFiltroProcExtrato() {
    setFiltroProcExtrato('');
    setFiltroProcExtratoRascunho('');
    setMenuFiltroProcExtratoAberto(false);
  }

  function handleClickCabecalhoCodClienteConsolidado() {
    if (codClienteConsolidadoHeaderTimerRef.current) {
      clearTimeout(codClienteConsolidadoHeaderTimerRef.current);
      codClienteConsolidadoHeaderTimerRef.current = null;
      return;
    }
    codClienteConsolidadoHeaderTimerRef.current = window.setTimeout(() => {
      codClienteConsolidadoHeaderTimerRef.current = null;
      setMenuFiltroCodClienteConsolidadoAberto((aberto) => {
        const next = !aberto;
        if (next) {
          setFiltroCodClienteConsolidadoRascunho(filtroCodClienteConsolidado);
          setMenuFiltroProcConsolidadoAberto(false);
        }
        return next;
      });
    }, 280);
  }

  function handleDuploCliqueCabecalhoCodClienteConsolidado(e) {
    e.preventDefault();
    if (codClienteConsolidadoHeaderTimerRef.current) {
      clearTimeout(codClienteConsolidadoHeaderTimerRef.current);
      codClienteConsolidadoHeaderTimerRef.current = null;
    }
    setMenuFiltroCodClienteConsolidadoAberto(false);
    handleDuploCliqueTituloConsolidado('codCliente');
  }

  function aplicarFiltroCodClienteConsolidado() {
    setFiltroCodClienteConsolidado(filtroCodClienteConsolidadoRascunho.trim());
    setMenuFiltroCodClienteConsolidadoAberto(false);
  }

  function limparFiltroCodClienteConsolidado() {
    setFiltroCodClienteConsolidado('');
    setFiltroCodClienteConsolidadoRascunho('');
    setMenuFiltroCodClienteConsolidadoAberto(false);
  }

  function handleClickCabecalhoProcConsolidado() {
    if (procConsolidadoHeaderTimerRef.current) {
      clearTimeout(procConsolidadoHeaderTimerRef.current);
      procConsolidadoHeaderTimerRef.current = null;
      return;
    }
    procConsolidadoHeaderTimerRef.current = window.setTimeout(() => {
      procConsolidadoHeaderTimerRef.current = null;
      setMenuFiltroProcConsolidadoAberto((aberto) => {
        const next = !aberto;
        if (next) {
          setFiltroProcConsolidadoRascunho(filtroProcConsolidado);
          setMenuFiltroCodClienteConsolidadoAberto(false);
        }
        return next;
      });
    }, 280);
  }

  function handleDuploCliqueCabecalhoProcConsolidado(e) {
    e.preventDefault();
    if (procConsolidadoHeaderTimerRef.current) {
      clearTimeout(procConsolidadoHeaderTimerRef.current);
      procConsolidadoHeaderTimerRef.current = null;
    }
    setMenuFiltroProcConsolidadoAberto(false);
    handleDuploCliqueTituloConsolidado('proc');
  }

  function aplicarFiltroProcConsolidado() {
    setFiltroProcConsolidado(filtroProcConsolidadoRascunho.trim());
    setMenuFiltroProcConsolidadoAberto(false);
  }

  function limparFiltroProcConsolidado() {
    setFiltroProcConsolidado('');
    setFiltroProcConsolidadoRascunho('');
    setMenuFiltroProcConsolidadoAberto(false);
  }

  function limparFiltrosCodProcConsolidado() {
    limparFiltroCodClienteConsolidado();
    limparFiltroProcConsolidado();
  }

  function toggleExtratoLinhaSelecionada(key) {
    setExtratoLinhasSelecionadas((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  function toggleSelecionarTodasVisiveisExtrato() {
    setExtratoLinhasSelecionadas((prev) => {
      const allOn =
        extratoVisRowKeys.length > 0 && extratoVisRowKeys.every((k) => prev.has(k));
      const n = new Set(prev);
      if (allOn) {
        extratoVisRowKeys.forEach((k) => n.delete(k));
      } else {
        extratoVisRowKeys.forEach((k) => n.add(k));
      }
      return n;
    });
  }

  function selecionarTodasLinhasExtratoFiltradas() {
    setExtratoLinhasSelecionadas(new Set(listaExtratoAposFiltroValor.map(extratoBancoRowKey)));
  }

  function limparSelecaoExtratoLinhas() {
    setExtratoLinhasSelecionadas(new Set());
    setLetraLoteExtrato('');
  }

  function aplicarLetraNosSelecionadosExtrato() {
    const L = String(letraLoteExtrato ?? '').trim().toUpperCase();
    if (!L || extratoLinhasSelecionadas.size === 0) return;
    updateLetraLancamentosEmLote(instituicaoSelecionada, [...extratoLinhasSelecionadas], L);
    setExtratoLinhasSelecionadas(new Set());
    setLetraLoteExtrato('');
  }

  function handleDuploCliqueCabecalhoValorExtrato(e) {
    e.preventDefault();
    if (valorExtratoHeaderTimerRef.current) {
      clearTimeout(valorExtratoHeaderTimerRef.current);
      valorExtratoHeaderTimerRef.current = null;
    }
    setMenuFiltroValorExtratoAberto(false);
    handleDuploCliqueTituloExtratoBanco('valor');
  }

  function aplicarFiltroValorExtratoPreset(kind) {
    setFiltroValorExtrato({ kind, exatoCentavos: null });
    setMenuFiltroValorExtratoAberto(false);
  }

  function aplicarFiltroValorExtratoExato() {
    const n = parseValorExtratoBr(filtroValorExatoRascunho);
    if (n == null) return;
    const cent = Math.round(n * 100);
    setFiltroValorExtrato({ kind: 'exato', exatoCentavos: cent });
    setMenuFiltroValorExtratoAberto(false);
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

    setModalVinculoLancamento(null);

    let cliente = null;
    let processo = null;
    if (featureFlags.useApiFinanceiro && featureFlags.useApiProcessos) {
      try {
        cliente = await buscarClientePorCodigo(cod);
        processo = p ? await buscarProcessoPorChaveNatural(cod, p) : null;
      } catch (e) {
        setApiFinanceiroErro(e?.message || 'Falha ao resolver cliente/processo para vínculo financeiro.');
      }
    }

    const list = extratosPorBancoRef.current?.[nomeBanco];
    const idxLinha = Array.isArray(list) ? list.findIndex((t) => t.numero === numero && t.data === data) : -1;
    if (idxLinha < 0 || !list?.[idxLinha]) {
      setOfxStatus({ kind: 'error', message: 'Lançamento não encontrado para vincular.' });
      return;
    }
    const rowBase = list[idxLinha];

    const clienteId =
      cliente?.id != null && Number.isFinite(Number(cliente.id))
        ? Number(cliente.id)
        : rowBase._financeiroMeta?.clienteId ?? null;
    const processoId =
      processo?.id != null && Number.isFinite(Number(processo.id))
        ? Number(processo.id)
        : rowBase._financeiroMeta?.processoId ?? null;

    const patch = {
      codCliente: cod,
      proc: p || '',
      _financeiroMeta: {
        ...(rowBase._financeiroMeta || {}),
        clienteId,
        processoId,
      },
    };

    const mergedForApi = { ...rowBase, ...patch, nomeBanco };

    setExtratosPorBanco((prev) => {
      const next = cloneExtratos(prev);
      const arr = next[nomeBanco];
      if (!Array.isArray(arr)) return prev;
      const i = arr.findIndex((t) => t.numero === numero && t.data === data);
      if (i < 0) return prev;
      const novo = {
        ...arr[i],
        ...patch,
        _financeiroMeta: {
          ...(arr[i]._financeiroMeta || {}),
          ...patch._financeiroMeta,
        },
      };
      arr[i] = novo;
      ultimaLinhaEdicaoExtratoRef.current.set(`${nomeBanco}|${numero}|${data}`, novo);
      return next;
    });

    setOfxStatus({
      kind: 'success',
      message: `Vínculo gravado: cliente ${cod}, proc. ${p || '—'} neste lançamento.`,
    });

    if (featureFlags.useApiFinanceiro) {
      try {
        const saved = await salvarOuAtualizarLancamentoFinanceiroApi(mergedForApi);
        if (saved?.id) {
          setExtratosPorBanco((prev) => {
            const next = cloneExtratos(prev);
            const arr = next[nomeBanco];
            if (!Array.isArray(arr)) return prev;
            const i = arr.findIndex((t) => t.numero === numero && t.data === data);
            if (i < 0) return prev;
            arr[i] = mergeUiLancamentoComRespostaApi(arr[i], saved);
            ultimaLinhaEdicaoExtratoRef.current.delete(`${nomeBanco}|${numero}|${data}`);
            return next;
          });
        } else {
          setApiFinanceiroErro(
            'Não foi possível gravar o vínculo na API (verifique a letra contábil e os dados do lançamento).'
          );
        }
      } catch (e) {
        setApiFinanceiroErro(e?.message || 'Falha ao sincronizar lançamento com API.');
      }
    }
  }

  /** Duplo clique na coluna Cod. Cliente: abre o cadastro de clientes com esse código e processo. */
  function handleDuploCliqueCodCliente(codCliente, proc) {
    navigate('/pessoas', { state: buildRouterStateChaveClienteProcesso(codCliente ?? '', proc ?? '') });
  }

  /** Duplo clique na coluna Proc.: abre Processos e leva o lançamento da linha para a Conta Corrente. */
  function handleDuploCliqueProc(codCliente, proc, transacao) {
    const t = transacao && typeof transacao === 'object' ? transacao : null;
    navigate('/processos', {
      state: buildRouterStateChaveClienteProcesso(codCliente ?? '', proc ?? '', {
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
      }),
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

  async function importarBtgPdfArquivo(file) {
    try {
      if (!isInstituicaoBtgExtratoPdf(instituicaoSelecionada)) return;
      if (extratosInativosSet.has(instituicaoSelecionada)) {
        setOfxStatus({
          kind: 'error',
          message: `Extrato ${instituicaoSelecionada} está inativo (conta encerrada). Reative para importar o PDF.`,
        });
        return;
      }
      const nome = String(file?.name ?? '').toLowerCase();
      const tipo = String(file?.type ?? '');
      if (!nome.endsWith('.pdf') && tipo !== 'application/pdf') {
        setOfxStatus({ kind: 'error', message: 'Selecione um arquivo PDF do extrato de conta corrente BTG.' });
        return;
      }
      setOfxStatus({ kind: 'loading', message: `Lendo PDF do extrato ${instituicaoSelecionada}...` });
      const texto = await extrairTextoPdfDeArquivo(file, { ordenarItensPorPosicao: true });
      const extrato = parseBtgPdfExtratoText(texto);
      if (!extrato.length) {
        setOfxStatus({
          kind: 'error',
          message:
            'Não foi possível extrair lançamentos do PDF. Use o extrato de conta corrente BTG Pactual (texto selecionável), como no app ou PDF oficial.',
        });
        return;
      }
      const modo = substituirExtratoOfxCompleto ? 'substituir' : 'mesclar';
      const atualAntes = extratosPorBancoRef.current[instituicaoSelecionada] ?? [];
      let novosContados = 0;
      setExtratosPorBanco((prev) => {
        const antes = prev[instituicaoSelecionada] ?? [];
        novosContados = modo === 'mesclar' ? contarLancamentosNovos(antes, extrato) : extrato.length;
        return aplicarExtratoNoBanco(prev, instituicaoSelecionada, extrato, modo);
      });
      const base =
        modo === 'mesclar'
          ? `PDF BTG: +${novosContados} lanç. novos em ${instituicaoSelecionada} (${extrato.length - novosContados} já no extrato, ignorados; repetições só no arquivo importam-se). Extrato mantido.`
          : `PDF BTG: extrato de ${instituicaoSelecionada} substituído (${extrato.length} lanç.).`;

      if (featureFlags.useApiFinanceiro) {
        setOfxStatus({ kind: 'loading', message: `Gravando lançamentos de ${instituicaoSelecionada} no servidor...` });
        const numB = numeroBancoMap[instituicaoSelecionada];
        const result = await persistirImportacaoOfxFinanceiroApi({
          nomeBanco: instituicaoSelecionada,
          numeroBanco: numB != null ? Number(numB) : null,
          modo,
          transacoesOfx: extrato,
          transacoesAntesNoBanco: atualAntes,
          origemImportacao: 'PDF',
        });
        setExtratosPorBanco((prev) =>
          aplicarSavedPairsOfxNoEstado(prev, instituicaoSelecionada, result.savedPairs),
        );
        const addedApiIdsPdf = (result.savedPairs || [])
          .map((p) => Number(p?.saved?.id))
          .filter((id) => Number.isFinite(id) && id > 0);
        const houveAlteracaoPdf =
          modo === 'mesclar' && (novosContados > 0 || addedApiIdsPdf.length > 0);
        registrarDesfazerImportacaoMesclagem(
          instituicaoSelecionada,
          atualAntes,
          result.savedPairs,
          modo,
          houveAlteracaoPdf,
        );
        const apiMsg =
          result.criados > 0
            ? `${result.criados} lançamento(s) gravado(s) no banco (origem PDF). `
            : modo === 'mesclar' && novosContados === 0
              ? 'Nenhum lançamento novo (todos já existiam). '
              : '';
        if (result.erros.length) {
          setOfxStatus({
            kind: 'error',
            message: `${base} ${apiMsg}Erros na API (${result.erros.length}): ${result.erros.slice(0, 4).join(' · ')}${result.erros.length > 4 ? '…' : ''}`,
          });
        } else {
          setOfxStatus({
            kind: 'success',
            message: `${base} ${apiMsg}Lançamentos novos na letra N (Conta Não Identificados) até reclassificar ou usar Parear compensações.`,
          });
        }
        return;
      }

      registrarDesfazerImportacaoMesclagem(
        instituicaoSelecionada,
        atualAntes,
        [],
        modo,
        modo === 'mesclar' && novosContados > 0,
      );
      setOfxStatus({
        kind: 'success',
        message: `${base} Lançamentos novos na letra N (Conta Não Identificados) até você reclassificar ou usar Parear compensações.`,
      });
    } catch (e) {
      setOfxStatus({ kind: 'error', message: `Falha ao importar PDF: ${e?.message || String(e)}` });
    }
  }

  async function importarOfxArquivo(file) {
    try {
      if (isInstituicaoBtgExtratoPdf(instituicaoSelecionada)) {
        setOfxStatus({
          kind: 'error',
          message: `Contas BTG importam o extrato por arquivo PDF (botão «Importar PDF»), não por OFX.`,
        });
        return;
      }
      if (extratosInativosSet.has(instituicaoSelecionada)) {
        setOfxStatus({
          kind: 'error',
          message: `Extrato ${instituicaoSelecionada} está inativo (conta encerrada). Reative para importar OFX.`,
        });
        return;
      }
      setOfxStatus({ kind: 'loading', message: `Importando OFX para ${instituicaoSelecionada}...` });
      const text = await readOfxFileAsText(file);
      const extrato = parseOfxToExtrato(text, { nomeBanco: instituicaoSelecionada });
      if (!extrato.length) {
        setOfxStatus({ kind: 'error', message: 'Arquivo OFX não contém lançamentos (<STMTTRN>).' });
        return;
      }
      const modo = substituirExtratoOfxCompleto ? 'substituir' : 'mesclar';
      const atualAntes = extratosPorBancoRef.current[instituicaoSelecionada] ?? [];
      let novosContados = 0;
      setExtratosPorBanco((prev) => {
        const antes = prev[instituicaoSelecionada] ?? [];
        novosContados = modo === 'mesclar' ? contarLancamentosNovos(antes, extrato) : extrato.length;
        return aplicarExtratoNoBanco(prev, instituicaoSelecionada, extrato, modo);
      });
      const base =
        modo === 'mesclar'
          ? `OFX: +${novosContados} lanç. novos em ${instituicaoSelecionada} (${extrato.length - novosContados} já no extrato, ignorados; repetições só no arquivo importam-se). Extrato mantido.`
          : `OFX: extrato de ${instituicaoSelecionada} substituído (${extrato.length} lanç.).`;

      if (featureFlags.useApiFinanceiro) {
        setOfxStatus({ kind: 'loading', message: `Gravando lançamentos de ${instituicaoSelecionada} no servidor...` });
        const numB = numeroBancoMap[instituicaoSelecionada];
        const result = await persistirImportacaoOfxFinanceiroApi({
          nomeBanco: instituicaoSelecionada,
          numeroBanco: numB != null ? Number(numB) : null,
          modo,
          transacoesOfx: extrato,
          transacoesAntesNoBanco: atualAntes,
        });
        setExtratosPorBanco((prev) =>
          aplicarSavedPairsOfxNoEstado(prev, instituicaoSelecionada, result.savedPairs),
        );
        const addedApiIdsOfx = (result.savedPairs || [])
          .map((p) => Number(p?.saved?.id))
          .filter((id) => Number.isFinite(id) && id > 0);
        const houveAlteracaoOfx =
          modo === 'mesclar' && (novosContados > 0 || addedApiIdsOfx.length > 0);
        registrarDesfazerImportacaoMesclagem(
          instituicaoSelecionada,
          atualAntes,
          result.savedPairs,
          modo,
          houveAlteracaoOfx,
        );
        const apiMsg =
          result.criados > 0
            ? `${result.criados} lançamento(s) gravado(s) no banco (origem OFX). `
            : modo === 'mesclar' && novosContados === 0
              ? 'Nenhum lançamento novo (todos já existiam). '
              : '';
        if (result.erros.length) {
          setOfxStatus({
            kind: 'error',
            message: `${base} ${apiMsg}Erros na API (${result.erros.length}): ${result.erros.slice(0, 4).join(' · ')}${result.erros.length > 4 ? '…' : ''}`,
          });
        } else {
          setOfxStatus({
            kind: 'success',
            message: `${base} ${apiMsg}Lançamentos novos na letra N (Conta Não Identificados) até reclassificar ou usar Parear compensações.`,
          });
        }
        return;
      }

      registrarDesfazerImportacaoMesclagem(
        instituicaoSelecionada,
        atualAntes,
        [],
        modo,
        modo === 'mesclar' && novosContados > 0,
      );
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
    const atualAntes = extratosPorBancoRef.current['Itaú'] ?? [];
    let novos = 0;
    setInstituicaoSelecionada('Itaú');
    setExtratosPorBanco((prev) => {
      novos = contarLancamentosNovos(prev['Itaú'] ?? [], extrato);
      return aplicarExtratoNoBanco(prev, 'Itaú', extrato, 'mesclar');
    });
    if (featureFlags.useApiFinanceiro) {
      setOfxStatus({ kind: 'loading', message: 'Gravando OFX Itaú no servidor...' });
      void (async () => {
        const numB = numeroBancoMap['Itaú'];
        const result = await persistirImportacaoOfxFinanceiroApi({
          nomeBanco: 'Itaú',
          numeroBanco: numB != null ? Number(numB) : null,
          modo: 'mesclar',
          transacoesOfx: extrato,
          transacoesAntesNoBanco: atualAntes,
        });
        setExtratosPorBanco((prev) => aplicarSavedPairsOfxNoEstado(prev, 'Itaú', result.savedPairs));
        const addedItau = (result.savedPairs || [])
          .map((p) => Number(p?.saved?.id))
          .filter((id) => Number.isFinite(id) && id > 0);
        registrarDesfazerImportacaoMesclagem(
          'Itaú',
          atualAntes,
          result.savedPairs,
          'mesclar',
          novos > 0 || addedItau.length > 0,
        );
        if (result.erros.length) {
          setOfxStatus({
            kind: 'error',
            message: `Itaú: +${novos} lanç. novos (OFX). Erros API: ${result.erros.slice(0, 3).join(' · ')}`,
          });
        } else {
          setOfxStatus({
            kind: 'success',
            message: `Itaú: +${novos} lanç. novos (OFX). ${result.criados > 0 ? `${result.criados} gravados no banco. ` : ''}Demais bancos preservados.`,
          });
        }
      })();
      return;
    }
    registrarDesfazerImportacaoMesclagem('Itaú', atualAntes, [], 'mesclar', novos > 0);
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
    const atualAntes = extratosPorBancoRef.current.CORA ?? [];
    let novos = 0;
    setInstituicaoSelecionada('CORA');
    setExtratosPorBanco((prev) => {
      novos = contarLancamentosNovos(prev.CORA ?? [], extrato);
      return aplicarExtratoNoBanco(prev, 'CORA', extrato, 'mesclar');
    });
    if (featureFlags.useApiFinanceiro) {
      setOfxStatus({ kind: 'loading', message: 'Gravando OFX CORA no servidor...' });
      void (async () => {
        const numB = numeroBancoMap.CORA;
        const result = await persistirImportacaoOfxFinanceiroApi({
          nomeBanco: 'CORA',
          numeroBanco: numB != null ? Number(numB) : null,
          modo: 'mesclar',
          transacoesOfx: extrato,
          transacoesAntesNoBanco: atualAntes,
        });
        setExtratosPorBanco((prev) => aplicarSavedPairsOfxNoEstado(prev, 'CORA', result.savedPairs));
        const addedCora = (result.savedPairs || [])
          .map((p) => Number(p?.saved?.id))
          .filter((id) => Number.isFinite(id) && id > 0);
        registrarDesfazerImportacaoMesclagem(
          'CORA',
          atualAntes,
          result.savedPairs,
          'mesclar',
          novos > 0 || addedCora.length > 0,
        );
        if (result.erros.length) {
          setOfxStatus({
            kind: 'error',
            message: `CORA: +${novos} lanç. novos (OFX). Erros API: ${result.erros.slice(0, 3).join(' · ')}`,
          });
        } else {
          setOfxStatus({
            kind: 'success',
            message: `CORA: +${novos} lanç. novos (OFX). ${result.criados > 0 ? `${result.criados} gravados no banco. ` : ''}Demais bancos preservados.`,
          });
        }
      })();
      return;
    }
    registrarDesfazerImportacaoMesclagem('CORA', atualAntes, [], 'mesclar', novos > 0);
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
    const codAlvo = alvo?.codigoCliente ?? alvo?.codCliente;
    if (!codAlvo || String(codAlvo).trim() === '') return;
    const procAlvo = alvo?.numeroInterno ?? alvo?.proc;
    setContaContabilSelecionada(contaEscritorioOuPrimeiraAtiva(contasContabeisInativasSet, ordemNomesContabeis));
    setFiltroConciliacaoHonorarios({
      codCliente: String(codAlvo ?? '').trim(),
      proc: procAlvo != null && String(procAlvo).trim() !== '' ? String(procAlvo).trim() : '',
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
  const extratoBtgUsaPdfImport = isInstituicaoBtgExtratoPdf(instituicaoSelecionada);

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
        className={`flex flex-wrap items-end gap-x-2 gap-y-1.5 rounded-xl border border-indigo-200/70 bg-gradient-to-r from-white via-indigo-50/40 to-violet-50/50 px-2.5 py-2 shadow-sm ring-1 ring-indigo-500/5 ${
          suffix === 'extrato' ? 'max-w-full' : ''
        }`}
        title={
          suffix === 'extrato'
            ? 'Saldo = soma dos valores até cada linha (histórico completo do extrato, após remover duplicatas pela chave OFX). Filtro por mês só esconde linhas; o saldo de cada linha continua coerente com o extrato inteiro.'
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
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-indigo-50/35 to-emerald-50/45 flex flex-col">
      <div className="max-w-[2000px] mx-auto w-full flex flex-col flex-1 min-h-0 min-w-0">
      <header className="px-4 py-3 shrink-0 rounded-b-xl border border-slate-200/80 border-t-0 bg-white/90 shadow-sm backdrop-blur-sm mx-2 mt-2 mb-1">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-2.5 min-w-0 flex-wrap">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 text-white shadow-md ring-1 ring-emerald-400/40">
              <Wallet className="w-5 h-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-emerald-900 to-indigo-900 bg-clip-text text-transparent">
                Financeiro
              </h1>
              <p className="text-xs text-slate-500">Extratos, consolidado e vínculos com processos</p>
            </div>
            <button
              type="button"
              onClick={() => setModalConfigFinanceiro(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 shadow-sm shrink-0"
              title="Adicionar conta bancária ou conta contábil"
            >
              <Settings className="w-4 h-4 text-indigo-600" aria-hidden />
              Configurações
            </button>
            <label htmlFor="layout-relatorios-financeiro" className="sr-only">
              Disposição do extrato do banco e do consolidado
            </label>
            <select
              id="layout-relatorios-financeiro"
              value={disposicaoRelatorios}
              onChange={(e) => setDisposicaoRelatorios(e.target.value)}
              className="text-sm border border-indigo-200 rounded-xl px-2.5 py-2 bg-white text-slate-800 max-w-[min(100%,15rem)] shadow-sm shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
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
              className="text-sm border border-indigo-200 rounded-xl px-2.5 py-2 bg-white text-slate-800 max-w-[min(100%,16rem)] shadow-sm shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
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
              className={`text-sm border border-indigo-200 rounded-xl px-2.5 py-2 bg-white text-slate-800 max-w-[min(100%,17rem)] shadow-sm shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 ${
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
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end lg:max-w-[55%] xl:max-w-none">
            <button
              type="button"
              disabled={ofxBloqueadoExtratoInativo}
              onClick={() =>
                extratoBtgUsaPdfImport
                  ? fileInputBtgPdfRef.current?.click()
                  : fileInputOfxRef.current?.click()
              }
              className={`px-4 py-2 rounded-xl text-sm font-semibold shadow-md ${
                ofxBloqueadoExtratoInativo
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 ring-1 ring-indigo-400/30'
              }`}
              title={
                ofxBloqueadoExtratoInativo
                  ? extratoBtgUsaPdfImport
                    ? 'Extrato inativo — reative para importar PDF'
                    : 'Extrato inativo — reative para importar OFX'
                  : extratoBtgUsaPdfImport
                    ? `Importar extrato em PDF (${instituicaoSelecionada}) — modelo BTG Pactual; mescla por padrão`
                    : `Importar OFX em ${instituicaoSelecionada} (mescla por padrão)`
              }
            >
              {extratoBtgUsaPdfImport
                ? `Importar PDF (${instituicaoSelecionada})`
                : `Importar OFX (${instituicaoSelecionada})`}
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
              disabled={!podeReverterUltimaImportacaoExtrato}
              onClick={() => void reverterUltimaImportacaoExtrato()}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium ${
                !podeReverterUltimaImportacaoExtrato
                  ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'border-slate-400 bg-white text-slate-800 hover:bg-slate-50'
              }`}
              title={
                substituirExtratoOfxCompleto
                  ? 'Se a última ação foi «Substituir todo o extrato», não há reversão automática. Com mesclar: restaura o estado antes da última importação neste banco e remove lançamentos criados na API.'
                  : 'Restaura o extrato deste banco ao estado imediatamente anterior à última importação OFX/PDF em modo mesclar; remove na API os lançamentos criados nessa importação.'
              }
            >
              <Undo2 className="w-4 h-4 shrink-0" aria-hidden />
              Reverter última importação
            </button>
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
              disabled={!instituicaoSelecionada || extratosInativosSet.has(instituicaoSelecionada)}
              onClick={() => void zerarExtratoSelecionado()}
              className={`px-3 py-2 rounded-lg border text-sm font-medium ${
                !instituicaoSelecionada || extratosInativosSet.has(instituicaoSelecionada)
                  ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'border-rose-300 bg-rose-50 text-rose-900 hover:bg-rose-100'
              }`}
              title="Apaga todos os lançamentos deste banco na API (se ativa), limpa cache local e desfaz elos de compensação com outros extratos — para importar de novo do zero"
            >
              Zera extrato
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
              disabled={!instituicaoSelecionada}
              onClick={() => {
                const nome = instituicaoSelecionada;
                if (!nome) return;
                const grupos = detectarSugestoesRecorrenciaMensalNoBanco(extratosPorBanco[nome] ?? []);
                const selecionados = new Set();
                for (const g of grupos) {
                  for (const c of g.candidatos) {
                    selecionados.add(chaveCandidatoRecorrenciaModal(g, c));
                  }
                }
                setModalRecorrenciaMensal({ nomeBanco: nome, grupos, selecionados });
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-teal-500 bg-teal-50 text-teal-900 text-sm font-medium ${
                !instituicaoSelecionada
                  ? 'opacity-50 cursor-not-allowed border-teal-200'
                  : 'hover:bg-teal-100'
              }`}
              title="Sugestões em lote: copia letra A + Cód. cliente + Proc. de um lançamento já identificado (Conta Escritório) para outros com a mesma descrição e o mesmo valor (ex.: mensalidades em meses diferentes). Revise e desmarque antes de aplicar."
            >
              <Repeat className="w-3.5 h-3.5 shrink-0" aria-hidden />
              Recorrência mensal
            </button>
            <button
              type="button"
              onClick={() => abrirModalBuscaParcelas()}
              className="px-3 py-2 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-900 text-sm font-medium hover:bg-indigo-100"
              title="Compara extratos não classificados com parcelas de cálculos aceitos; você só aprova o vínculo"
            >
              Buscar parcelas (Cálculos)
            </button>
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
      </header>
      {filtroConciliacaoHonorarios && (
        <div className="mx-3 md:mx-4 mb-2 rounded-xl border border-indigo-200/90 bg-indigo-50/95 px-4 py-3 text-sm text-indigo-950 flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-sm ring-1 ring-indigo-500/10">
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

      <div className="flex-1 px-3 py-5 md:px-5 md:py-6 space-y-6 overflow-auto">
        {/* Extratos bancários (OFX / PDF BTG) */}
        <section className="rounded-2xl border border-emerald-200/80 bg-white/95 shadow-md overflow-hidden ring-1 ring-emerald-500/10">
          <div className="border-b border-emerald-100/80 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">Extratos bancários</h2>
            <p className="text-xs text-emerald-50/95 mt-0.5 font-medium">Importação OFX / PDF e instituições</p>
          </div>
          <div className="p-4 md:p-5 space-y-3">
          <p className="text-xs text-slate-600 mb-1 leading-relaxed">
            Instituições <strong>BTG</strong> importam o extrato por <strong>PDF</strong> (modelo conta corrente BTG
            Pactual, texto selecionável); os outros bancos usam <strong>OFX</strong>. Por padrão, cada importação{' '}
            <strong>acrescenta</strong> lançamentos (sem apagar mock nem extrato já importados). Duplicatas (mesma chave
            data + valor + identificador) são ignoradas.{' '}
            {featureFlags.useApiFinanceiro ? (
              <>
                Com a <strong>API Financeiro</strong> ativa, cada lançamento novo é gravado no{' '}
                <strong>banco de dados</strong> (origem OFX ou PDF, conta «Conta Não Identificados» até você
                reclassificar).
              </>
            ) : (
              <>Os dados são salvos no navegador (localStorage).</>
            )}{' '}
            Cada lançamento <strong>novo</strong> importado entra na letra <strong>N</strong> (Conta Não Identificados) e
            permanece nela até você reclassificar no extrato ou usar <strong>Parear compensações</strong> para
            identificar pares entre bancos (mesmo dia, valor oposto exato). Use{' '}
            <strong>Substituir todo o extrato deste banco</strong> só se quiser trocar o extrato inteiro da instituição
            selecionada (essa operação <strong>não</strong> pode ser desfeita por aqui). O botão{' '}
            <strong>Reverter última importação</strong> restaura o extrato da instituição selecionada ao estado anterior
            à última importação <strong>em modo mesclar</strong> (OFX ou PDF) e, com API ativa, remove os lançamentos
            criados nessa importação — útil se escolheu o ficheiro errado. Use{' '}
            <strong>Recorrência mensal</strong> para sugerir em lote a mesma letra A + Cód./Proc. de um pagamento já
            identificado para outros com a mesma descrição e valor (ex.: mensalidades). Extratos <strong>inativos</strong> indicam conta encerrada: o histórico permanece salvo, mas o
            extrato some da lista principal e não recebe novas importações (OFX ou PDF) até você reativar. Use o botão{' '}
            <strong>Configurações</strong> no topo para criar instituições além das padrão: cada uma recebe um{' '}
            <strong>Nº sequencial</strong> no consolidado (após o maior número já cadastrado) e passa a integrar
            extrato, compensações e contas contábeis como as demais.
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
              onClick={() =>
                extratoBtgUsaPdfImport
                  ? fileInputBtgPdfRef.current?.click()
                  : fileInputOfxRef.current?.click()
              }
              className={`px-4 py-2 rounded-xl text-sm font-semibold shadow-md ${
                ofxBloqueadoExtratoInativo
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 ring-1 ring-indigo-400/30'
              }`}
              title={
                ofxBloqueadoExtratoInativo
                  ? extratoBtgUsaPdfImport
                    ? 'Extrato inativo — reative para importar PDF'
                    : 'Extrato inativo — reative para importar OFX'
                  : extratoBtgUsaPdfImport
                    ? `Importar PDF e atualizar o extrato de ${instituicaoSelecionada} (BTG)`
                    : `Importar OFX e atualizar o extrato de ${instituicaoSelecionada}`
              }
            >
              {extratoBtgUsaPdfImport
                ? `Importar PDF (${instituicaoSelecionada})`
                : `Importar OFX (${instituicaoSelecionada})`}
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
            <input
              ref={fileInputBtgPdfRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) importarBtgPdfArquivo(file);
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
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm ${
                  instituicaoSelecionada === nome
                    ? 'bg-white text-indigo-900 ring-2 ring-emerald-500 shadow-md border border-emerald-400/60'
                    : 'bg-gradient-to-br from-slate-600 to-indigo-800 text-white hover:from-slate-700 hover:to-indigo-900'
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
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm ${
                  instituicaoSelecionada === nome
                    ? 'bg-white text-indigo-900 ring-2 ring-emerald-500 shadow-md border border-emerald-400/60'
                    : 'bg-gradient-to-br from-slate-600 to-indigo-800 text-white hover:from-slate-700 hover:to-indigo-900'
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
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm ${
                    instituicaoSelecionada === c.nome
                      ? 'bg-white text-indigo-900 ring-2 ring-emerald-500 shadow-md border border-emerald-400/60'
                      : 'bg-gradient-to-br from-violet-600 to-indigo-800 text-white hover:from-violet-700 hover:to-indigo-900'
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
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm ${
                      instituicaoSelecionada === nome
                        ? 'bg-slate-600 text-white ring-2 ring-slate-400 shadow-md'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                  >
                    {nome}
                  </button>
                ))}
              </div>
            </>
          )}
          </div>
        </section>

        {/* Contas contábeis */}
        <section className="rounded-2xl border border-violet-200/80 bg-white/95 shadow-md overflow-hidden ring-1 ring-violet-500/10">
          <div className="border-b border-violet-100/80 bg-gradient-to-r from-violet-600 via-indigo-600 to-slate-800 px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">Contas contábeis</h2>
            <p className="text-xs text-violet-100/95 mt-0.5 font-medium">Plano derivado dos extratos e letras</p>
          </div>
          <div className="p-4 md:p-5 space-y-3">
          <p className="text-xs text-slate-600 mb-1 leading-relaxed">
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
          </div>
        </section>

        {/* Extrato do banco + consolidado (disposição alternável) */}
        {(mostrarPainelExtrato || mostrarPainelConsolidado) && (
          <div className={classeWrapperRelatorios}>
        {mostrarPainelExtrato && (
          <section
            className={`bg-white/95 rounded-2xl border border-slate-200/90 shadow-md ring-1 ring-sky-500/10 overflow-hidden flex flex-col min-h-0 ${classOrdemExtrato} ${
              relatoriosLadoALado ? 'xl:flex-1 xl:min-w-0 xl:max-h-[min(92vh,960px)]' : ''
            }`}
          >
            <div className="px-4 py-3 border-b border-sky-200/50 shrink-0 bg-gradient-to-r from-sky-700 via-cyan-700 to-indigo-800 text-white shadow-md">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-3 w-full">
                <div className="flex flex-wrap items-end gap-3 min-w-0 shrink-0">
                  <h2 className="text-base font-bold uppercase shrink-0 leading-none pb-1 tracking-tight drop-shadow-sm">
                    Conta Corrente · {instituicaoSelecionada}
                  </h2>
                  <button
                    type="button"
                    disabled={!instituicaoSelecionada || extratosInativosSet.has(instituicaoSelecionada)}
                    onClick={() => void zerarExtratoSelecionado()}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold shrink-0 ${
                      !instituicaoSelecionada || extratosInativosSet.has(instituicaoSelecionada)
                        ? 'border-white/20 bg-white/10 text-sky-200 cursor-not-allowed'
                        : 'border-rose-200/80 bg-rose-500/90 text-white hover:bg-rose-600 shadow-sm'
                    }`}
                    title="Apaga todos os lançamentos deste banco na API (se ativa), limpa cache local e desfaz elos de compensação com outros extratos"
                  >
                    Zera extrato
                  </button>
                  <div className="flex items-center gap-2">
                    <label htmlFor="limite-lanc-extrato" className="text-xs text-sky-100 whitespace-nowrap">
                      Lançamentos na tela:
                    </label>
                    <select
                      id="limite-lanc-extrato"
                      value={limiteLancamentosExtratoBanco}
                      onChange={(e) => setLimiteLancamentosExtratoBanco(Number(e.target.value))}
                      className="text-sm border border-white/30 rounded-lg px-2 py-1.5 bg-white/95 text-slate-800 min-w-[5.5rem] shadow-sm"
                      title="Quantidade máxima de linhas: por padrão (data crescente) mostra os lançamentos mais recentes; com data ordenada ao contrário, os primeiros da lista"
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
            <div className="px-4 py-2 border-b border-slate-200/80 bg-gradient-to-r from-slate-50 to-indigo-50/40 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs shrink-0">
              <span className="text-slate-600">
                {extratoLinhasSelecionadas.size > 0 ? (
                  <>
                    <strong className="text-slate-800">{extratoLinhasSelecionadas.size}</strong> linha(s) selecionada(s)
                  </>
                ) : (
                  <>
                    Use os checkboxes ou <strong className="text-slate-800">selecionar todas</strong> no cabeçalho da
                    tabela para alterar em lote.
                  </>
                )}
              </span>
              {listaExtratoAposFiltroValor.length > listaExtratoBancoParaTabela.length ? (
                <button
                  type="button"
                  onClick={selecionarTodasLinhasExtratoFiltradas}
                  className="text-indigo-700 hover:text-indigo-900 font-medium underline decoration-indigo-300 underline-offset-2"
                >
                  Selecionar os {listaExtratoAposFiltroValor.length} lançamentos filtrados (inclui fora do limite)
                </button>
              ) : null}
              {extratoLinhasSelecionadas.size > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-slate-700">
                    <span className="whitespace-nowrap">Letra em lote:</span>
                    <select
                      value={letraLoteExtrato}
                      onChange={(e) => setLetraLoteExtrato(e.target.value)}
                      className="text-sm border border-slate-300 rounded-md px-2 py-1 bg-white text-slate-800 min-w-[12rem] max-w-[20rem] shadow-sm"
                    >
                      <option value="">Escolher conta (letra)…</option>
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
                  </label>
                  <button
                    type="button"
                    onClick={aplicarLetraNosSelecionadosExtrato}
                    disabled={!String(letraLoteExtrato ?? '').trim()}
                    className="rounded-md border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-45 disabled:pointer-events-none"
                  >
                    Aplicar letra
                  </button>
                  <button
                    type="button"
                    onClick={limparSelecaoExtratoLinhas}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Limpar seleção
                  </button>
                </div>
              ) : null}
            </div>
            <div className={relatoriosLadoALado ? 'flex-1 min-h-0 overflow-auto' : 'overflow-x-auto'}>
              <table className="table-fixed w-full min-w-[56rem] text-sm border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-sky-100/95 via-indigo-50 to-violet-100/90 border-b border-indigo-200/70 [&_th]:text-slate-800">
                    <th
                      className="w-10 py-2 px-2 text-center border-r border-slate-200 align-middle"
                      title="Selecionar ou desmarcar todas as linhas visíveis na tabela"
                    >
                      <input
                        ref={extratoSelectAllHeaderRef}
                        type="checkbox"
                        checked={extratoTodasVisiveisSelecionadas}
                        onChange={toggleSelecionarTodasVisiveisExtrato}
                        aria-label="Selecionar todas as linhas visíveis"
                        className="rounded border-slate-300"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </th>
                    <th
                      ref={menuFiltroLetraExtratoRef}
                      className={`relative text-left py-2 px-2 font-medium border-r border-slate-200 w-[8.5rem] select-none ${
                        filtroLetrasExtrato != null && filtroLetrasExtrato.length > 0
                          ? 'bg-amber-50/90 text-amber-950'
                          : 'text-slate-600'
                      } cursor-pointer hover:bg-slate-100`}
                      title="Clique: filtrar por letras (contas). Duplo clique: ordenar A→Z / Z→A"
                    >
                      <div
                        className="flex items-center justify-start gap-1"
                        onClick={handleClickCabecalhoLetraExtrato}
                        onDoubleClick={handleDuploCliqueCabecalhoLetraExtrato}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleClickCabecalhoLetraExtrato();
                          }
                        }}
                      >
                        <span>Letra</span>
                        {filtroLetrasExtrato != null && filtroLetrasExtrato.length > 0 ? (
                          <span
                            className="text-[10px] font-semibold uppercase tracking-tight text-amber-800"
                            aria-hidden
                          >
                            filtro
                          </span>
                        ) : null}
                      </div>
                      {menuFiltroLetraExtratoAberto ? (
                        <div
                          className="absolute left-0 top-full z-[80] mt-1 w-[min(20rem,calc(100vw-2rem))] max-h-[min(70vh,22rem)] overflow-y-auto rounded-md border border-slate-200 bg-white py-2 px-2.5 text-left text-xs font-normal text-slate-800 shadow-lg"
                          onClick={(ev) => ev.stopPropagation()}
                          onMouseDown={(ev) => ev.stopPropagation()}
                        >
                          <p className="text-[11px] text-slate-500 mb-2">
                            Exibir só lançamentos das letras marcadas (contas disponíveis).
                          </p>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            <button
                              type="button"
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                              onClick={marcarTodasRascunhoFiltroLetraExtrato}
                            >
                              Marcar todas
                            </button>
                            <button
                              type="button"
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                              onClick={desmarcarTodasRascunhoFiltroLetraExtrato}
                            >
                              Desmarcar todas
                            </button>
                          </div>
                          <ul className="space-y-1 mb-2 border-t border-slate-100 pt-2 max-h-[min(50vh,14rem)] overflow-y-auto">
                            {letrasOrdenadasParaSelect.map((l) => {
                              const nomeConta = letraToContaMerged[l];
                              const inativa = nomeConta && contasContabeisInativasSet.has(nomeConta);
                              const marcada = filtroLetrasExtratoRascunho.some(
                                (x) => String(x).trim().toUpperCase() === l
                              );
                              return (
                                <li key={l}>
                                  <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 hover:bg-slate-50">
                                    <input
                                      type="checkbox"
                                      checked={marcada}
                                      onChange={() => toggleRascunhoFiltroLetraExtrato(l)}
                                      className="mt-0.5 rounded border-slate-300"
                                    />
                                    <span>
                                      <strong>{l}</strong>
                                      {inativa ? (
                                        <span className="text-slate-500"> (inativa)</span>
                                      ) : null}
                                      {nomeConta ? (
                                        <span className="text-slate-600"> — {nomeConta}</span>
                                      ) : null}
                                    </span>
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                            <button
                              type="button"
                              className="rounded border border-indigo-600 bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700"
                              onClick={aplicarFiltroLetraExtrato}
                            >
                              Aplicar
                            </button>
                            <button
                              type="button"
                              className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                              onClick={limparFiltroLetraExtrato}
                            >
                              Limpar filtro
                            </button>
                          </div>
                          {filtroLetrasExtrato != null && filtroLetrasExtrato.length > 0 ? (
                            <p className="mt-2 text-[10px] text-slate-500">
                              Ativo: {filtroLetrasExtrato.join(', ')}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </th>
                    <th className="text-left py-2 px-2 font-medium text-slate-600 border-r border-slate-200 w-[6.5rem] cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('numero')} title="Duplo clique: ordenar">Nº</th>
                    <th className="text-left py-2 px-2 font-medium text-slate-600 border-r border-slate-200 w-[5.5rem] cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('data')} title="Duplo clique: data mais recente primeiro; de novo: mais antiga primeiro">Data</th>
                    <th
                      ref={menuFiltroDescricaoExtratoRef}
                      className={`relative text-left py-2 px-2 font-medium border-r border-slate-200 w-[11rem] overflow-hidden select-none ${
                        filtroDescricaoExtrato.trim()
                          ? 'bg-amber-50/90 text-amber-950'
                          : 'text-slate-600'
                      } cursor-pointer hover:bg-slate-100`}
                      title="Clique: filtrar por texto na descrição. Duplo clique: ordenar A→Z / Z→A"
                    >
                      <div
                        className="flex items-center justify-start gap-1"
                        onClick={handleClickCabecalhoDescricaoExtrato}
                        onDoubleClick={handleDuploCliqueCabecalhoDescricaoExtrato}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleClickCabecalhoDescricaoExtrato();
                          }
                        }}
                      >
                        <span>Descrição</span>
                        {filtroDescricaoExtrato.trim() ? (
                          <span
                            className="text-[10px] font-semibold uppercase tracking-tight text-amber-800"
                            aria-hidden
                          >
                            filtro
                          </span>
                        ) : null}
                      </div>
                      {menuFiltroDescricaoExtratoAberto ? (
                        <div
                          className="absolute left-0 top-full z-[80] mt-1 w-[min(22rem,calc(100vw-2rem))] rounded-md border border-slate-200 bg-white py-2 px-2.5 text-left text-xs font-normal text-slate-800 shadow-lg"
                          onClick={(ev) => ev.stopPropagation()}
                          onMouseDown={(ev) => ev.stopPropagation()}
                        >
                          <p className="text-[11px] text-slate-500 mb-2">
                            Filtrar por texto na descrição (ignora maiúsculas e acentos).
                          </p>
                          <label className="block text-[11px] text-slate-600 mb-1" htmlFor="filtro-descricao-extrato">
                            Contém
                          </label>
                          <input
                            id="filtro-descricao-extrato"
                            type="text"
                            autoFocus
                            placeholder="ex.: PIX TRANSF"
                            value={filtroDescricaoExtratoRascunho}
                            onChange={(e) => setFiltroDescricaoExtratoRascunho(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                aplicarFiltroDescricaoExtrato();
                              }
                            }}
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs mb-2"
                          />
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              className="rounded border border-indigo-600 bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700"
                              onClick={aplicarFiltroDescricaoExtrato}
                            >
                              Aplicar
                            </button>
                            <button
                              type="button"
                              className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                              onClick={limparFiltroDescricaoExtrato}
                            >
                              Limpar
                            </button>
                          </div>
                          {filtroDescricaoExtrato.trim() ? (
                            <p className="mt-2 text-[10px] text-slate-500 border-t border-slate-100 pt-2">
                              Ativo: “{filtroDescricaoExtrato}”
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </th>
                    <th
                      ref={menuFiltroValorExtratoRef}
                      className={`relative text-right py-2 px-2 font-medium border-r border-slate-200 w-[7rem] select-none ${
                        filtroValorExtrato.kind !== 'todos'
                          ? 'bg-amber-50/90 text-amber-950'
                          : 'text-slate-600'
                      } cursor-pointer hover:bg-slate-100`}
                      title="Clique: filtrar por valor. Duplo clique: ordenar crescente ↔ decrescente"
                    >
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={handleClickCabecalhoValorExtrato}
                        onDoubleClick={handleDuploCliqueCabecalhoValorExtrato}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleClickCabecalhoValorExtrato();
                          }
                        }}
                      >
                        <span>Valor</span>
                        {filtroValorExtrato.kind !== 'todos' ? (
                          <span className="text-[10px] font-semibold uppercase tracking-tight text-amber-800" aria-hidden>
                            filtro
                          </span>
                        ) : null}
                      </div>
                      {menuFiltroValorExtratoAberto ? (
                        <div
                          className="absolute right-0 top-full z-[80] mt-1 w-56 rounded-md border border-slate-200 bg-white py-2 px-2.5 text-left text-xs font-normal text-slate-800 shadow-lg"
                          onClick={(ev) => ev.stopPropagation()}
                          onMouseDown={(ev) => ev.stopPropagation()}
                        >
                          <p className="text-[11px] text-slate-500 mb-2">Filtrar lançamentos</p>
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              className={`text-left rounded px-2 py-1.5 hover:bg-slate-100 ${
                                filtroValorExtrato.kind === 'todos' ? 'bg-slate-100 font-medium' : ''
                              }`}
                              onClick={() => aplicarFiltroValorExtratoPreset('todos')}
                            >
                              Todos os valores
                            </button>
                            <button
                              type="button"
                              className={`text-left rounded px-2 py-1.5 hover:bg-slate-100 ${
                                filtroValorExtrato.kind === 'lt0' ? 'bg-slate-100 font-medium' : ''
                              }`}
                              onClick={() => aplicarFiltroValorExtratoPreset('lt0')}
                            >
                              Menor que zero (débitos)
                            </button>
                            <button
                              type="button"
                              className={`text-left rounded px-2 py-1.5 hover:bg-slate-100 ${
                                filtroValorExtrato.kind === 'gt0' ? 'bg-slate-100 font-medium' : ''
                              }`}
                              onClick={() => aplicarFiltroValorExtratoPreset('gt0')}
                            >
                              Maior que zero (créditos)
                            </button>
                          </div>
                          <div className="mt-2 border-t border-slate-100 pt-2">
                            <label className="block text-[11px] text-slate-600 mb-1" htmlFor="filtro-valor-exato-extrato">
                              Valor exato (R$)
                            </label>
                            <div className="flex gap-1">
                              <input
                                id="filtro-valor-exato-extrato"
                                type="text"
                                inputMode="decimal"
                                placeholder="ex.: 1.500,00"
                                value={filtroValorExatoRascunho}
                                onChange={(e) => setFiltroValorExatoRascunho(e.target.value)}
                                className="flex-1 min-w-0 rounded border border-slate-300 px-2 py-1 text-xs"
                              />
                              <button
                                type="button"
                                className="shrink-0 rounded border border-indigo-600 bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-700"
                                onClick={aplicarFiltroValorExtratoExato}
                              >
                                Aplicar
                              </button>
                            </div>
                            {filtroValorExtrato.kind === 'exato' && filtroValorExtrato.exatoCentavos != null ? (
                              <p className="mt-1 text-[10px] text-slate-500">
                                Ativo: {formatValor(filtroValorExtrato.exatoCentavos / 100)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </th>
                    <th className="text-right py-2 px-2 font-medium text-slate-600 border-r border-slate-200 w-[8.5rem] cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('saldo')} title="Duplo clique: ordenar crescente ↔ decrescente">Saldo</th>
                    <th className="text-left py-2 px-2 font-medium text-slate-600 border-r border-slate-200 w-[9.5rem] cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('categoria')} title="Mesmo texto que Descrição / Contraparte no consolidado. Duplo clique: ordenar A→Z / Z→A">Categoria / Obs.</th>
                    <th
                      ref={menuFiltroCodClienteExtratoRef}
                      className={`relative text-center py-2 px-3 font-medium border-r border-slate-200 w-20 select-none ${
                        filtroCodClienteExtrato.trim()
                          ? 'bg-amber-50/90 text-amber-950'
                          : 'text-slate-600'
                      } cursor-pointer hover:bg-slate-100`}
                      title="Clique: filtrar por código de cliente (normalizado). Duplo clique: ordenar"
                    >
                      <div
                        className="flex items-center justify-center gap-1"
                        onClick={handleClickCabecalhoCodClienteExtrato}
                        onDoubleClick={handleDuploCliqueCabecalhoCodClienteExtrato}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleClickCabecalhoCodClienteExtrato();
                          }
                        }}
                      >
                        <span>Cod. Cliente</span>
                        {filtroCodClienteExtrato.trim() ? (
                          <span
                            className="text-[10px] font-semibold uppercase tracking-tight text-amber-800"
                            aria-hidden
                          >
                            filtro
                          </span>
                        ) : null}
                      </div>
                      {menuFiltroCodClienteExtratoAberto ? (
                        <div
                          className="absolute left-1/2 -translate-x-1/2 top-full z-[80] mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-md border border-slate-200 bg-white py-2 px-2.5 text-left text-xs font-normal text-slate-800 shadow-lg"
                          onClick={(ev) => ev.stopPropagation()}
                          onMouseDown={(ev) => ev.stopPropagation()}
                        >
                          <p className="text-[11px] text-slate-500 mb-2">
                            Filtrar por código de cliente (comparação normalizada, como no cadastro).
                          </p>
                          <label className="block text-[11px] text-slate-600 mb-1" htmlFor="filtro-cod-cliente-extrato">
                            Código
                          </label>
                          <input
                            id="filtro-cod-cliente-extrato"
                            type="text"
                            autoFocus
                            placeholder="ex.: 123"
                            value={filtroCodClienteExtratoRascunho}
                            onChange={(e) => setFiltroCodClienteExtratoRascunho(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                aplicarFiltroCodClienteExtrato();
                              }
                            }}
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs mb-2"
                          />
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              className="rounded border border-indigo-600 bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700"
                              onClick={aplicarFiltroCodClienteExtrato}
                            >
                              Aplicar
                            </button>
                            <button
                              type="button"
                              className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                              onClick={limparFiltroCodClienteExtrato}
                            >
                              Limpar
                            </button>
                          </div>
                          {filtroCodClienteExtrato.trim() ? (
                            <p className="mt-2 text-[10px] text-slate-500 border-t border-slate-100 pt-2">
                              Ativo: “{filtroCodClienteExtrato}”
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </th>
                    <th
                      ref={menuFiltroProcExtratoRef}
                      className={`relative text-center py-2 px-3 font-medium border-r border-slate-200 w-16 select-none ${
                        filtroProcExtrato.trim() ? 'bg-amber-50/90 text-amber-950' : 'text-slate-600'
                      } cursor-pointer hover:bg-slate-100`}
                      title="Clique: filtrar por proc. Duplo clique: ordenar"
                    >
                      <div
                        className="flex items-center justify-center gap-1"
                        onClick={handleClickCabecalhoProcExtrato}
                        onDoubleClick={handleDuploCliqueCabecalhoProcExtrato}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleClickCabecalhoProcExtrato();
                          }
                        }}
                      >
                        <span>Proc.</span>
                        {filtroProcExtrato.trim() ? (
                          <span
                            className="text-[10px] font-semibold uppercase tracking-tight text-amber-800"
                            aria-hidden
                          >
                            filtro
                          </span>
                        ) : null}
                      </div>
                      {menuFiltroProcExtratoAberto ? (
                        <div
                          className="absolute left-1/2 -translate-x-1/2 top-full z-[80] mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-md border border-slate-200 bg-white py-2 px-2.5 text-left text-xs font-normal text-slate-800 shadow-lg"
                          onClick={(ev) => ev.stopPropagation()}
                          onMouseDown={(ev) => ev.stopPropagation()}
                        >
                          <p className="text-[11px] text-slate-500 mb-2">
                            Filtrar por processo / identificador (normalizado).
                          </p>
                          <label className="block text-[11px] text-slate-600 mb-1" htmlFor="filtro-proc-extrato">
                            Proc.
                          </label>
                          <input
                            id="filtro-proc-extrato"
                            type="text"
                            autoFocus
                            placeholder="ex.: 0001"
                            value={filtroProcExtratoRascunho}
                            onChange={(e) => setFiltroProcExtratoRascunho(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                aplicarFiltroProcExtrato();
                              }
                            }}
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs mb-2"
                          />
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              className="rounded border border-indigo-600 bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700"
                              onClick={aplicarFiltroProcExtrato}
                            >
                              Aplicar
                            </button>
                            <button
                              type="button"
                              className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                              onClick={limparFiltroProcExtrato}
                            >
                              Limpar
                            </button>
                          </div>
                          {filtroProcExtrato.trim() ? (
                            <p className="mt-2 text-[10px] text-slate-500 border-t border-slate-100 pt-2">
                              Ativo: “{filtroProcExtrato}”
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </th>
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
                    return listaExtratoBancoParaTabela.map((t) => {
                    const isLinhaBancoAlvo = linhaBancoAlvo?.nomeBanco === instituicaoSelecionada && linhaBancoAlvo?.numero === t.numero && linhaBancoAlvo?.data === t.data;
                    const letraLinha = String(t.letra ?? '').trim().toUpperCase();
                    const letraSemOpcao = letraLinha && !letrasOrdenadasParaSelect.includes(letraLinha);
                    const linhaTemCodEProcPreenchidos =
                      Boolean(normalizarCodigoClienteFinanceiro(t.codCliente)) &&
                      Boolean(normalizarProcFinanceiro(t.proc));
                    const mostrarBotaoPesquisaContaEscritorio =
                      letraLinha === 'A' && !linhaTemCodEProcPreenchidos;
                    return (
                    <tr
                      key={`${t.letra}-${t.numero}-${t.data}`}
                      ref={isLinhaBancoAlvo ? linhaBancoRef : undefined}
                      className={`border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer ${isLinhaBancoAlvo ? 'ring-1 ring-blue-500 ring-inset bg-blue-50/70' : ''}`}
                      onDoubleClick={() => handleDuploCliqueLinhaBanco(t)}
                      title="Duplo clique para abrir a conta contábil e ir à linha no consolidado"
                    >
                      <td
                        className="py-1.5 px-2 border-r border-slate-100 w-10 text-center align-top"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={extratoLinhasSelecionadas.has(extratoBancoRowKey(t))}
                          onChange={() => toggleExtratoLinhaSelecionada(extratoBancoRowKey(t))}
                          aria-label={`Selecionar lançamento ${t.numero} de ${t.data}`}
                          className="rounded border-slate-300 mt-1"
                        />
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-100 w-20 align-top" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-1 min-w-[6.75rem]">
                          <select
                            value={letraLinha}
                            onChange={(e) => updateLetraLancamento(instituicaoSelecionada, t.numero, t.data, e.target.value)}
                            className="w-full min-w-[6rem] py-0.5 px-1 text-slate-700 text-sm bg-slate-50 border border-slate-200 rounded cursor-pointer text-left"
                            onClick={(e) => e.stopPropagation()}
                            title={
                              letraLinha === 'A'
                                ? mostrarBotaoPesquisaContaEscritorio
                                  ? 'Letra A = Conta Escritório. Use o botão abaixo para pesquisar cliente e processo.'
                                  : 'Letra A = Conta Escritório (código e processo já preenchidos).'
                                : undefined
                            }
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
                          {mostrarBotaoPesquisaContaEscritorio ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalVinculoLancamento({
                                  nomeBanco: instituicaoSelecionada,
                                  numero: t.numero,
                                  data: t.data,
                                  resumo: `${instituicaoSelecionada} · ${t.data} · ${formatValor(t.valor)} — ${String(t.descricao ?? '').slice(0, 72)}`,
                                  modoContaEscritorio: true,
                                });
                              }}
                              className="w-full text-left text-[10px] leading-tight px-1.5 py-1 rounded border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
                              title="Fluxo em 2 passos: cliente (nome ou código) → processos com partes — vincula Cod. e Proc."
                            >
                              Pesquisar cliente → proc.
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-slate-500 border-r border-slate-100 align-top overflow-hidden">
                        <div className="truncate text-xs tabular-nums" title={String(t.numero ?? '')}>
                          {t.numero}
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-slate-700 border-r border-slate-100 align-top whitespace-nowrap text-xs">
                        {t.data}
                      </td>
                      <td className="py-1.5 px-2 text-slate-700 border-r border-slate-100 align-top overflow-hidden">
                        <div
                          className="truncate text-xs"
                          title={String(t.descricao ?? '')}
                        >
                          {t.descricao}
                        </div>
                      </td>
                      <td className={`py-1.5 px-2 text-right border-r border-slate-100 align-top whitespace-nowrap text-xs font-medium ${t.valor < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {formatValor(t.valor)}
                      </td>
                      <td className={`py-1.5 px-2 text-right border-r border-slate-100 align-top overflow-hidden text-xs ${t.saldo < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        <div
                          className="truncate tabular-nums"
                          title={`${formatValor(t.saldo)} ${t.saldoDesc ?? ''}`.trim()}
                        >
                          {formatValor(t.saldo)} {t.saldoDesc}
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-slate-600 border-r border-slate-100 text-xs align-top overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={textoCategoriaObservacao(t)}
                          onChange={(e) => updateCampoLancamento(instituicaoSelecionada, t.numero, t.data, 'categoria', e.target.value)}
                          className="w-full min-w-0 max-w-full px-1.5 py-0.5 text-xs bg-white border border-slate-200 rounded"
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
                          onBlur={() =>
                            flushSincronizarCodProcDebounced(instituicaoSelecionada, t.numero, t.data)
                          }
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
                          onBlur={() =>
                            flushSincronizarCodProcDebounced(instituicaoSelecionada, t.numero, t.data)
                          }
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
              const noPeriodo = listaExtratoBancoVisivel.length;
              const total = listaExtratoAposFiltroValor.length;
              const vis = listaExtratoBancoParaTabela.length;
              if (periodoVisao !== 'todos' && noPeriodo === 0) {
                return (
                  <div className="px-4 py-3 text-xs text-slate-600 bg-amber-50/80 border-t border-amber-100">
                    Nenhum lançamento neste período para <strong>{instituicaoSelecionada}</strong>. Ajuste o filtro ou
                    escolha <strong>Todos</strong>.
                  </div>
                );
              }
              if (
                noPeriodo > 0 &&
                filtroLetrasExtrato != null &&
                filtroLetrasExtrato.length > 0 &&
                listaExtratoAposFiltroLetra.length === 0
              ) {
                return (
                  <div className="px-4 py-2 text-xs text-amber-900 bg-amber-50 border-t border-amber-100">
                    Nenhum lançamento corresponde às <strong>letras</strong> selecionadas.{' '}
                    <button
                      type="button"
                      className="underline font-medium text-amber-950"
                      onClick={limparFiltroLetraExtrato}
                    >
                      Limpar filtro
                    </button>
                  </div>
                );
              }
              if (
                noPeriodo > 0 &&
                filtroDescricaoExtrato.trim() &&
                listaExtratoAposFiltroLetra.length > 0 &&
                listaExtratoAposFiltroDescricao.length === 0
              ) {
                return (
                  <div className="px-4 py-2 text-xs text-amber-900 bg-amber-50 border-t border-amber-100">
                    Nenhum lançamento corresponde ao texto em <strong>Descrição</strong>.{' '}
                    <button
                      type="button"
                      className="underline font-medium text-amber-950"
                      onClick={limparFiltroDescricaoExtrato}
                    >
                      Limpar filtro
                    </button>
                  </div>
                );
              }
              if (
                noPeriodo > 0 &&
                listaExtratoAposFiltroDescricao.length > 0 &&
                total === 0 &&
                filtroValorExtrato.kind !== 'todos'
              ) {
                return (
                  <div className="px-4 py-2 text-xs text-amber-900 bg-amber-50 border-t border-amber-100">
                    Nenhum lançamento corresponde ao filtro de <strong>Valor</strong>.{' '}
                    <button
                      type="button"
                      className="underline font-medium text-amber-950"
                      onClick={() => setFiltroValorExtrato({ kind: 'todos', exatoCentavos: null })}
                    >
                      Limpar filtro
                    </button>
                  </div>
                );
              }
              if (total <= vis && !(periodoVisao !== 'todos' && noPeriodo === 0)) return null;
              if (total <= vis) return null;
              const ordemRecente =
                sortExtratoBanco.col === 'data' && sortExtratoBanco.dir === 'desc'
                  ? 'primeiros da lista (data mais recente primeiro)'
                  : 'últimos da lista (mais recentes no tempo)';
              const temFiltroLetra = filtroLetrasExtrato != null && filtroLetrasExtrato.length > 0;
              const temFiltroDesc = Boolean(filtroDescricaoExtrato.trim());
              const temFiltroValor = filtroValorExtrato.kind !== 'todos';
              const refBits = [];
              if (temFiltroLetra) refBits.push('letra');
              if (temFiltroDesc) refBits.push('descrição');
              if (temFiltroValor) refBits.push('valor');
              const refFiltros =
                refBits.length === 0
                  ? 'após filtro de período'
                  : refBits.length === 1
                    ? `após filtros de período e ${refBits[0]}`
                    : `após filtros de período, ${refBits.slice(0, -1).join(', ')} e ${refBits[refBits.length - 1]}`;
              return (
                <div className="px-4 py-2 text-xs text-slate-600 bg-slate-50 border-t border-slate-200">
                  Exibindo <strong>{vis}</strong> de <strong>{total}</strong> lançamentos ({refFiltros}) — os{' '}
                  <strong>{ordemRecente}</strong>. Aumente o limite ou escolha <strong>Todos</strong> para ver mais
                  linhas.
                </div>
              );
            })()}
            </div>
          </section>
        )}

        {mostrarPainelConsolidado && (
          <section
            className={`rounded-2xl border border-emerald-200/90 shadow-md ring-1 ring-emerald-500/15 overflow-hidden bg-gradient-to-b from-emerald-50/40 to-white flex flex-col min-h-0 ${classOrdemConsolidado} ${
              relatoriosLadoALado ? 'xl:flex-1 xl:min-w-0 xl:max-h-[min(92vh,960px)]' : ''
            }`}
          >
            <div className="px-4 py-3 border-b border-emerald-200/70 bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 text-white space-y-3 shrink-0 shadow-md">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-3 w-full">
                <div className="flex flex-wrap items-end gap-3 min-w-0 shrink-0">
                  <h2 className="text-base font-bold min-w-0 max-w-[14rem] sm:max-w-none leading-none pb-1 tracking-tight drop-shadow-sm">
                    Extrato consolidado · {contaContabilSelecionada}
                  </h2>
                  <div className="flex items-center gap-2">
                    <label htmlFor="limite-lanc-consolidado" className="text-xs text-emerald-50 whitespace-nowrap">
                      Lançamentos na tela:
                    </label>
                    <select
                      id="limite-lanc-consolidado"
                      value={limiteLancamentosConsolidado}
                      onChange={(e) => setLimiteLancamentosConsolidado(Number(e.target.value))}
                      className="text-sm border border-white/35 rounded-lg px-2 py-1.5 bg-white/95 text-slate-800 min-w-[5.5rem] shadow-sm"
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
                      <label htmlFor="filtro-elo-consolidado" className="text-xs text-emerald-50 whitespace-nowrap">
                        Elo:
                      </label>
                      <select
                        id="filtro-elo-consolidado"
                        value={filtroEloConsolidado}
                        onChange={(e) => setFiltroEloConsolidado(e.target.value)}
                        className="text-sm border border-white/35 rounded-lg px-2 py-1.5 bg-white/95 text-slate-800 min-w-[7rem] max-w-[12rem] shadow-sm"
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
                      <label htmlFor="filtro-conc-elo-consolidado" className="text-xs text-emerald-50 whitespace-nowrap">
                        Conciliação:
                      </label>
                      <select
                        id="filtro-conc-elo-consolidado"
                        value={filtroConciliacaoEloConsolidado}
                        onChange={(e) => setFiltroConciliacaoEloConsolidado(e.target.value)}
                        className="text-sm border border-white/35 rounded-lg px-2 py-1.5 bg-white/95 text-slate-800 min-w-[10rem] max-w-[20rem] shadow-sm"
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
                <div className="text-xs text-emerald-950 rounded-lg bg-white/95 border border-white/40 px-3 py-2 space-y-1 shadow-sm">
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
              <table className="table-fixed w-full min-w-[52rem] text-sm border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-emerald-100/95 via-teal-50 to-cyan-100/80 border-b border-emerald-200/70 [&_th]:text-slate-800">
                    <th className="text-left py-2 px-2 font-medium text-slate-600 border-r border-slate-200 w-[5.5rem] cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('numeroBanco')} title="Duplo clique: ordenar crescente ↔ decrescente">Nº</th>
                    <th className="text-left py-2 px-2 font-medium text-slate-600 border-r border-slate-200 w-[4.5rem] cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('numero')} title="Duplo clique: ordenar">Id.</th>
                    <th className="text-left py-2 px-2 font-medium text-slate-600 border-r border-slate-200 w-[5.5rem] cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('data')} title="Duplo clique: ordenar crescente ↔ decrescente">Data</th>
                    <th className="text-left py-2 px-2 font-medium text-slate-600 border-r border-slate-200 w-[10rem] cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('descricao')} title="Duplo clique: ordenar A→Z / Z→A">Descrição</th>
                    <th className="text-right py-2 px-2 font-medium text-slate-600 border-r border-slate-200 w-[7rem] cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('valor')} title="Duplo clique: ordenar crescente ↔ decrescente">
                      Valor <span className="text-slate-400 font-normal">({formatValor(saldoHeaderConsolidado)})</span>
                    </th>
                    <th className="text-left py-2 px-2 font-medium text-slate-600 border-r border-slate-200 w-[9.5rem] cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('descricaoDetalhada')} title="Mesmo texto que Categoria / Obs. no extrato do banco. Duplo clique: ordenar A→Z / Z→A">Descrição / Contraparte</th>
                    <th className="text-center py-2 px-2 font-medium text-slate-600 border-r border-slate-200 w-[4.5rem] cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('codCliente')} title="Duplo clique: ordenar">Cod. Cliente</th>
                    <th
                      className="text-center py-2 px-2 font-medium text-slate-600 border-r border-slate-200 w-14 cursor-pointer hover:bg-slate-100 select-none"
                      onDoubleClick={() => handleDuploCliqueTituloConsolidado('proc')}
                      title={isContaCompensacao ? 'Duplo clique: ordenar por Elo' : 'Duplo clique: ordenar por Proc.'}
                    >
                      {isContaCompensacao ? 'Elo' : 'Proc.'}
                    </th>
                    <th
                      className="text-center py-2 px-2 font-medium text-slate-600 border-r border-slate-200 w-12 cursor-pointer hover:bg-slate-100 select-none"
                      onDoubleClick={() => handleDuploCliqueTituloConsolidado('ref')}
                      title="N = lançamento único (sem repasse). R = repasse — use o mesmo Eq. em pelo menos duas linhas. Mesmo valor no extrato do banco. Duplo clique: ordenar."
                    >
                      Ref.
                    </th>
                    <th className="text-center py-2 px-2 font-medium text-slate-600 border-r border-slate-200 w-12 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('eq')} title="Mesmo texto que Dimensão no extrato. Duplo clique: ordenar">Eq.</th>
                    <th className="text-center py-2 px-2 font-medium text-slate-600 w-16 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('parcela')} title="Duplo clique: ordenar">Parcela</th>
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
                          className={`py-1.5 px-2 text-slate-600 border-r cursor-pointer overflow-hidden align-top ${brElo} ${tdHover}`}
                          onDoubleClick={(e) => { e.stopPropagation(); handleDuploCliqueNºConsolidado(t); }}
                          title="Duplo clique para abrir o extrato do banco nesta linha"
                        >
                          <div className="truncate text-xs tabular-nums" title={String(t.numeroBanco ?? '')}>
                            {t.numeroBanco}
                          </div>
                        </td>
                        <td className={`py-1.5 px-2 text-slate-600 border-r ${brElo} align-top overflow-hidden`}>
                          <div className="truncate text-xs tabular-nums" title={String(t.numero ?? '')}>
                            {t.numero}
                          </div>
                        </td>
                        <td className={`py-1.5 px-2 text-slate-700 border-r ${brElo} align-top whitespace-nowrap text-xs`}>
                          {t.data}
                        </td>
                        <td className={`py-1.5 px-2 text-slate-700 border-r ${brElo} align-top overflow-hidden`}>
                          <div className="truncate text-xs" title={String(t.descricao ?? '')}>
                            {t.descricao}
                          </div>
                        </td>
                        <td className={`py-1.5 px-2 text-right border-r ${brElo} align-top whitespace-nowrap text-xs font-medium ${t.valor < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                          {formatValor(t.valor)}
                        </td>
                        <td className={`py-1.5 px-2 text-slate-600 border-r ${brElo} text-xs align-top overflow-hidden`} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={textoCategoriaObservacao(t)}
                            onChange={(e) => updateCampoLancamento(t.nomeBanco, t.numero, t.data, 'descricaoDetalhada', e.target.value)}
                            className={`w-full min-w-0 max-w-full px-1.5 py-0.5 text-xs bg-white border rounded ${
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
                            onBlur={() => {
                              if (isContaCompensacao && t.letra === 'E') return;
                              flushSincronizarCodProcDebounced(t.nomeBanco, t.numero, t.data);
                            }}
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
                            onBlur={() => {
                              if (isContaCompensacao && t.letra === 'E') return;
                              flushSincronizarCodProcDebounced(t.nomeBanco, t.numero, t.data);
                            }}
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

      {modalRecorrenciaMensal != null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-recorrencia-mensal-titulo"
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-teal-200 w-full max-w-5xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-teal-200 flex items-center justify-between shrink-0">
              <h2 id="modal-recorrencia-mensal-titulo" className="text-base font-bold text-slate-800">
                Recorrência mensal — {modalRecorrenciaMensal.nomeBanco}
              </h2>
              <button
                type="button"
                onClick={() => setModalRecorrenciaMensal(null)}
                className="px-2 py-1 text-slate-500 hover:bg-slate-100 rounded text-lg leading-none"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 text-sm space-y-4">
              <p className="text-slate-600">
                <strong>Referência:</strong> lançamentos já na letra <strong>A</strong> (Conta Escritório) com{' '}
                <strong>Cód. cliente</strong> preenchido. <strong>Sugestão:</strong> outros lançamentos no mesmo banco
                com a <strong>mesma descrição</strong> (texto normalizado) e o <strong>mesmo valor</strong> (centavos),
                em <strong>datas diferentes</strong>, recebem a mesma letra, Cód. e Proc. do lançamento mais antigo
                desse grupo. <strong>Desmarque</strong> linhas que não devem ser atualizadas antes de aplicar.
              </p>
              {modalRecorrenciaMensal.grupos.length === 0 ? (
                <p className="py-6 text-center text-teal-900 bg-teal-50 rounded border border-teal-200">
                  Nenhuma sugestão neste extrato. É preciso pelo menos um lançamento na letra <strong>A</strong> com{' '}
                  <strong>Cód. cliente</strong> e outros com a mesma descrição e valor ainda não classificados da
                  mesma forma.
                </p>
              ) : (
                modalRecorrenciaMensal.grupos.map((g) => (
                  <div key={g.idGrupo} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-teal-50 px-3 py-2 border-b border-slate-200 text-xs text-slate-800 space-y-1">
                      <div>
                        <span className="font-semibold text-teal-900">Modelo (mais antigo):</span>{' '}
                        <span className="tabular-nums">{g.dataReferencia}</span> ·{' '}
                        <span className="font-medium">{formatValor(g.valor)}</span> · letra{' '}
                        <strong>{g.letraReferencia}</strong> · Cód. <strong className="tabular-nums">{g.codCliente}</strong>
                        {g.proc ? (
                          <>
                            {' '}
                            · Proc. <strong className="tabular-nums">{g.proc}</strong>
                          </>
                        ) : null}
                      </div>
                      <div className="text-slate-600 line-clamp-2" title={g.descricaoExemplo}>
                        {g.descricaoExemplo}
                      </div>
                    </div>
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="w-10 py-2 px-2 text-center font-semibold text-slate-700">✓</th>
                          <th className="text-left py-2 px-2 font-semibold text-slate-700">Data</th>
                          <th className="text-right py-2 px-2 font-semibold text-slate-700">Valor</th>
                          <th className="text-left py-2 px-2 font-semibold text-slate-700">Letra atual</th>
                          <th className="text-left py-2 px-2 font-semibold text-slate-700">Cód. / Proc. atual</th>
                          <th className="text-left py-2 px-2 font-semibold text-slate-700">Descrição</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.candidatos.map((c) => {
                          const k = chaveCandidatoRecorrenciaModal(g, c);
                          const marcado = modalRecorrenciaMensal.selecionados.has(k);
                          return (
                            <tr key={k} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="py-2 px-2 text-center align-top">
                                <input
                                  type="checkbox"
                                  checked={marcado}
                                  onChange={() => {
                                    setModalRecorrenciaMensal((prev) => {
                                      if (!prev) return prev;
                                      const next = new Set(prev.selecionados);
                                      if (next.has(k)) next.delete(k);
                                      else next.add(k);
                                      return { ...prev, selecionados: next };
                                    });
                                  }}
                                  aria-label={`Incluir lançamento de ${c.data}`}
                                />
                              </td>
                              <td className="py-2 px-2 align-top tabular-nums whitespace-nowrap">{c.data}</td>
                              <td className="py-2 px-2 text-right align-top tabular-nums">{formatValor(c.valor)}</td>
                              <td className="py-2 px-2 align-top">{c.letraAtual}</td>
                              <td className="py-2 px-2 align-top tabular-nums text-xs">
                                {c.codAtual} / {c.procAtual}
                              </td>
                              <td className="py-2 px-2 align-top text-slate-700 text-xs line-clamp-2" title={c.descricao}>
                                {c.descricao}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex flex-wrap justify-between items-center gap-2 shrink-0 bg-slate-50">
              <span className="text-xs text-slate-600">
                {modalRecorrenciaMensal.grupos.length > 0
                  ? `${modalRecorrenciaMensal.grupos.reduce((n, gr) => n + gr.candidatos.length, 0)} sugestão(ões) · ${
                      [...modalRecorrenciaMensal.selecionados].length
                    } selecionada(s)`
                  : null}
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setModalRecorrenciaMensal(null)}
                  className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={
                    modalRecorrenciaMensal.grupos.length === 0 ||
                    modalRecorrenciaMensal.selecionados.size === 0
                  }
                  onClick={async () => {
                    const { nomeBanco, grupos, selecionados } = modalRecorrenciaMensal;
                    const toApply = [];
                    for (const g of grupos) {
                      for (const c of g.candidatos) {
                        if (selecionados.has(chaveCandidatoRecorrenciaModal(g, c))) {
                          toApply.push({ g, c });
                        }
                      }
                    }
                    if (toApply.length === 0) return;
                    const baseExtratos = extratosPorBanco;
                    const snaps = [];
                    for (const { g, c } of toApply) {
                      const row0 = baseExtratos[nomeBanco]?.find((t) => t.numero === c.numero && t.data === c.data);
                      if (!row0) continue;
                      snaps.push({
                        ...row0,
                        nomeBanco,
                        letra: g.letraReferencia,
                        codCliente: g.codCliente,
                        proc: g.proc || '',
                        _financeiroMeta: {
                          ...(row0._financeiroMeta || {}),
                          clienteId: g.clienteId ?? row0._financeiroMeta?.clienteId ?? null,
                          processoId: g.processoId ?? row0._financeiroMeta?.processoId ?? null,
                        },
                      });
                    }
                    if (snaps.length === 0) return;
                    setExtratosPorBanco((prev) => {
                      const next = cloneExtratos(prev);
                      const list = next[nomeBanco];
                      if (!Array.isArray(list)) return prev;
                      for (const rc of snaps) {
                        const i = list.findIndex((t) => t.numero === rc.numero && t.data === rc.data);
                        if (i >= 0) {
                          list[i] = {
                            ...list[i],
                            letra: rc.letra,
                            codCliente: rc.codCliente,
                            proc: rc.proc,
                            _financeiroMeta: {
                              ...(list[i]._financeiroMeta || {}),
                              ...rc._financeiroMeta,
                            },
                          };
                        }
                      }
                      return next;
                    });
                    setModalRecorrenciaMensal(null);
                    const letraAplicada = snaps[0]?.letra ?? 'A';
                    if (featureFlags.useApiFinanceiro) {
                      setOfxStatus({
                        kind: 'loading',
                        message: `A gravar ${snaps.length} lançamento(s) na API…`,
                      });
                      try {
                        for (const rc of snaps) {
                          await sincronizarLancamentoApi(nomeBanco, rc.numero, rc.data, rc);
                        }
                        setOfxStatus({
                          kind: 'success',
                          message: `${snaps.length} lançamento(s) classificados (letra ${letraAplicada}, mesmo Cód./Proc. do modelo).`,
                        });
                      } catch (e) {
                        setOfxStatus({
                          kind: 'error',
                          message: e?.message || 'Falha ao sincronizar recorrência com a API.',
                        });
                      }
                    } else {
                      setOfxStatus({
                        kind: 'success',
                        message: `${snaps.length} lançamento(s) atualizados localmente (letra ${letraAplicada}).`,
                      });
                    }
                  }}
                  className="px-4 py-2 rounded bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Aplicar seleção
                </button>
              </div>
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
        modoContaEscritorio={Boolean(modalVinculoLancamento?.modoContaEscritorio)}
      />
    </div>
  );
}
