import { hojeDdMmYyyy } from '../services/hjDateAliasService.js';
import {
  listarEntradasAgendaPorMesAnoPersistida,
  listarTodasEntradasAgendaPersistida,
  salvarCamposEventoAgendaPersistido,
} from './agendaPersistenciaData.js';
import { extrairChaveProcessoEventoAgenda, montarProcessoRefAgenda } from '../domain/agendaProcessoRef.js';
import {
  encontrarProcessosHistoricoPorTextoAgenda,
  extrairTipoAudienciaDaDescricaoAgenda,
  extrairChavesCandidatasCnjDoTextoAgenda,
} from '../domain/cnjAgendaResolucao.js';
import { padCliente } from './processosDadosRelatorio.js';
import { chaveNumeroProcessoBuscaDiagnostico } from '../domain/normalizarNumeroProcessoBuscaDiagnostico.js';

/**
 * Histórico local por processo — chaves JSON legadas (equivalentes canônicas):
 * - `codCliente` = **codigoCliente** (8 dígitos), mesmo que «Código do Cliente» em Clientes ou Processos.
 * - `proc` = **numeroInterno** (inteiro ≥ 1), mesmo que «Proc.» na grade de Clientes ou «Processo» em Processos.
 * Ver `src/domain/camposProcessoCliente.js` para o mapa completo de aliases.
 */
const STORAGE_KEY = 'vilareal:processos-historico:v1';

/**
 * Incremente para limpar uma vez no navegador persistências antigas de demonstração
 * (histórico de processos, seed demo, cadastro de clientes local, contas contábeis extras no Financeiro).
 */
const LS_DEMO_PURGE_SCHEMA_KEY = 'vilareal:demo-persistence:schema';
const LS_DEMO_PURGE_SCHEMA = 3;

function maybePurgeDemoPersistenceOnce() {
  if (typeof window === 'undefined') return;
  try {
    const cur = Number(window.localStorage.getItem(LS_DEMO_PURGE_SCHEMA_KEY) || '0');
    if (cur >= LS_DEMO_PURGE_SCHEMA) return;
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(DEMO_SEED_VERSION_KEY);
    window.localStorage.removeItem('vilareal:demo-integrado:version');
    window.localStorage.removeItem('vilareal:cadastro-clientes-dados:v1');
    window.localStorage.removeItem('vilareal:cadastro-clientes-ultimo-cod:v1');
    window.localStorage.removeItem('vilareal.financeiro.contasExtras.v1');
    window.localStorage.removeItem('vilareal.financeiro.contasContabeis.extras.v1');
    window.localStorage.removeItem('vilareal.financeiro.contasContabeis.inativas.v1');
    window.localStorage.setItem(LS_DEMO_PURGE_SCHEMA_KEY, String(LS_DEMO_PURGE_SCHEMA));
  } catch {
    /* ignore */
  }
}

/** Versão do pacote de dados demo (incremente para reaplicar chaves novas em quem já rodou seed). */
export const DEMO_SEED_VERSION = 3;
const DEMO_SEED_VERSION_KEY = 'vilareal:processos-historico:demo-seed-version';

/** Constantes legadas (telas não usam mais seed automático). */
export const DEMO_DATA_CONSULTA_BR = '19/03/2026';
export const DEMO_DATA_PRAZO_FATAL_BR = '19/03/2026';
export const DEMO_PESSOA_ID_EXEMPLO = 1;

function apenasDigitos(v) {
  return String(v ?? '').replace(/\D/g, '');
}

function normalizarCodCliente(codCliente) {
  const digits = apenasDigitos(codCliente);
  const n = Number(digits || '1');
  return String(Number.isFinite(n) && n > 0 ? n : 1).padStart(8, '0');
}

function normalizarProc(proc) {
  const n = Number(String(proc ?? '').replace(/\D/g, ''));
  return String(Number.isFinite(n) && n > 0 ? Math.floor(n) : 1);
}

function makeKey(codCliente, proc) {
  return `${normalizarCodCliente(codCliente)}:${normalizarProc(proc)}`;
}

function normalizarIdsPartes(val) {
  if (val == null) return [];
  if (!Array.isArray(val)) return [];
  const s = new Set();
  for (const x of val) {
    const n = Number(x);
    if (Number.isFinite(n) && n > 0) s.add(Math.floor(n));
  }
  return Array.from(s).sort((a, b) => a - b);
}

/** Linhas parte + advogados persistidas no registro (mesma forma que o formulário Processos). */
function normalizarEntradasParteSalvas(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l) => ({
      pessoaId: Number(l.pessoaId),
      advogadoPessoaIds: Array.isArray(l.advogadoPessoaIds)
        ? [...new Set(l.advogadoPessoaIds.map(Number).filter((x) => Number.isFinite(x) && x > 0))].sort((a, b) => a - b)
        : [],
    }))
    .filter((l) => Number.isFinite(l.pessoaId) && l.pessoaId > 0);
}

/** IDs de parte na ordem das entradas; se vazio, usa legado ordenado. */
function idsParteFromEntradasOuLegado(entradas, idsLegado) {
  if (entradas.length) {
    const seen = new Set();
    const out = [];
    for (const e of entradas) {
      const id = Number(e.pessoaId);
      if (!Number.isFinite(id) || id < 1 || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }
  return normalizarIdsPartes(idsLegado);
}

function normalizarTextoPessoa(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Normaliza data dd/mm/aaaa (aceita 1 ou 2 dígitos em dia/mês) para comparação e exibição. */
export function normalizarDataBr(s) {
  const t = String(s ?? '').trim();
  if (!t) return '';
  if (/^hj$/i.test(t)) return hojeDdMmYyyy();
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return t;
  const dd = String(Number(m[1])).padStart(2, '0');
  const mm = String(Number(m[2])).padStart(2, '0');
  const yyyy = m[3];
  return `${dd}/${mm}/${yyyy}`;
}

function parseDataBrCompleta(s) {
  const t = normalizarDataBr(s);
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
  if (mm < 1 || mm > 12) return null;
  const maxDia = new Date(yyyy, mm, 0).getDate();
  if (dd < 1 || dd > maxDia) return null;
  return { dd, mm, yyyy };
}

function dataBr({ dd, mm, yyyy }) {
  return `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yyyy}`;
}

function dataToDate(parsed) {
  return new Date(parsed.yyyy, parsed.mm - 1, parsed.dd);
}

function dateToDataBr(d) {
  return dataBr({ dd: d.getDate(), mm: d.getMonth() + 1, yyyy: d.getFullYear() });
}

function normalizarPeriodicidadeConsulta(v) {
  const p = String(v ?? '').trim().toLowerCase();
  if (!p) return '';
  if (p.includes('diar')) return 'Diária';
  if (p.includes('seman')) return 'Semanal';
  if (p.includes('quinz')) return 'Quinzenal';
  if (p.includes('bimes')) return 'Bimestral';
  if (p.includes('trimes') || p.includes('trimens')) return 'Trimensal';
  if (p.includes('semes')) return 'Semestral';
  if (p.includes('anual') || p.includes('ano')) return 'Anual';
  if (p.includes('mens')) return 'Mensal';
  return '';
}

function calcularPascoa(ano) {
  // Algoritmo de Meeus/Jones/Butcher (calendário gregoriano)
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function isFeriadoNacional(dateObj) {
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const yyyy = d.getFullYear();
  const mm = d.getMonth() + 1;
  const dd = d.getDate();

  const fixos = new Set([
    `01/01/${yyyy}`, // Confraternização
    `21/04/${yyyy}`, // Tiradentes
    `01/05/${yyyy}`, // Dia do Trabalho
    `07/09/${yyyy}`, // Independência
    `12/10/${yyyy}`, // Nossa Senhora Aparecida
    `02/11/${yyyy}`, // Finados
    `15/11/${yyyy}`, // Proclamação da República
    `20/11/${yyyy}`, // Consciência Negra (nacional)
    `25/12/${yyyy}`, // Natal
  ]);
  const key = `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yyyy}`;
  if (fixos.has(key)) return true;

  const pascoa = calcularPascoa(yyyy);
  const sextaSanta = new Date(pascoa);
  sextaSanta.setDate(sextaSanta.getDate() - 2);
  const carnavalSeg = new Date(pascoa);
  carnavalSeg.setDate(carnavalSeg.getDate() - 48);
  const carnavalTer = new Date(pascoa);
  carnavalTer.setDate(carnavalTer.getDate() - 47);
  const corpusChristi = new Date(pascoa);
  corpusChristi.setDate(corpusChristi.getDate() + 60);

  const moveis = [
    dateToDataBr(sextaSanta),
    dateToDataBr(carnavalSeg),
    dateToDataBr(carnavalTer),
    dateToDataBr(corpusChristi),
  ];
  return moveis.includes(key);
}

function anteciparParaDiaUtil(dateObj) {
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  while (true) {
    const dow = d.getDay();
    const fimDeSemana = dow === 0 || dow === 6;
    if (!fimDeSemana && !isFeriadoNacional(d)) return d;
    d.setDate(d.getDate() - 1); // antecipar para dia útil anterior
  }
}

function adicionarMesesComDia(baseDate, meses) {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  d.setMonth(d.getMonth() + meses);
  const maxDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(baseDate.getDate(), maxDia));
  return d;
}

function calcularProximaConsultaBr({ dataHistoricoBr, periodicidadeConsulta }) {
  const periodicidade = normalizarPeriodicidadeConsulta(periodicidadeConsulta);
  const parsed = parseDataBrCompleta(dataHistoricoBr);
  if (!periodicidade || !parsed) return '';

  const base = dataToDate(parsed);
  let proxima = null;
  if (periodicidade === 'Diária') proxima = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
  if (periodicidade === 'Semanal') proxima = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7);
  if (periodicidade === 'Quinzenal') proxima = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 15);
  if (periodicidade === 'Mensal') proxima = adicionarMesesComDia(base, 1);
  if (periodicidade === 'Bimestral') proxima = adicionarMesesComDia(base, 2);
  if (periodicidade === 'Trimensal') proxima = adicionarMesesComDia(base, 3);
  if (periodicidade === 'Semestral') proxima = adicionarMesesComDia(base, 6);
  if (periodicidade === 'Anual') proxima = adicionarMesesComDia(base, 12);
  if (!proxima) return '';
  return dateToDataBr(anteciparParaDiaUtil(proxima));
}

function ultimaDataHistoricoBr(historico) {
  const lista = Array.isArray(historico) ? historico : [];
  let best = null;
  for (const h of lista) {
    const p = parseDataBrCompleta(h?.data);
    if (!p) continue;
    const d = dataToDate(p);
    if (!best || d.getTime() > best.getTime()) best = d;
  }
  return best ? dateToDataBr(best) : '';
}

/** Cache em memória do objeto da store (evita JSON.parse a cada getRegistroProcesso — crítico no Relatório com milhares de linhas). */
let _storeCache = null;

function loadStore() {
  if (_storeCache !== null) return _storeCache;
  maybePurgeDemoPersistenceOnce();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      _storeCache = {};
      return _storeCache;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      _storeCache = {};
      return _storeCache;
    }
    _storeCache = parsed;
    return _storeCache;
  } catch {
    _storeCache = {};
    return _storeCache;
  }
}

function saveStore(store) {
  _storeCache = store;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignora erro de persistência para não quebrar UI.
  }
}

/** Outras abas não compartilham o cache em memória; invalidar ao receber `storage` (cross-tab). */
export function invalidateProcessosHistoricoStoreCache() {
  _storeCache = null;
}

function normalizarHistoricoItem(item) {
  if (!item || typeof item !== 'object') return null;
  const info = String(item.info ?? '').trim();
  if (!info) return null;
  return {
    id: Number(item.id) || Date.now(),
    inf: String(item.inf ?? ''),
    info,
    data: String(item.data ?? ''),
    usuario: String(item.usuario ?? ''),
    numero: String(item.numero ?? ''),
  };
}

function normalizarRegistroProcesso(reg) {
  if (!reg || typeof reg !== 'object') return null;
  const codCliente = normalizarCodCliente(reg.codCliente);
  const proc = normalizarProc(reg.proc);
  const historico = Array.isArray(reg.historico)
    ? reg.historico.map(normalizarHistoricoItem).filter(Boolean)
    : [];

  const prazoRaw = String(reg.prazoFatal ?? '').trim();
  const prazoFatal = prazoRaw ? (normalizarDataBr(prazoRaw) || prazoRaw) : '';

  const consultaAutomatica =
    !('consultaAutomatica' in reg) || reg.consultaAutomatica === null
      ? null
      : reg.consultaAutomatica === true || reg.consultaAutomatica === 'true';
  const statusAtivo =
    !('statusAtivo' in reg) || reg.statusAtivo === null
      ? null
      : reg.statusAtivo !== false && reg.statusAtivo !== 'false';

  const entCliRaw = normalizarEntradasParteSalvas(reg.parteClienteEntradas);
  const entOpRaw = normalizarEntradasParteSalvas(reg.parteOpostaEntradas);
  const idsCliLegado = normalizarIdsPartes(reg.parteClienteIds);
  const idsOpLegado = normalizarIdsPartes(reg.parteOpostaIds);
  const parteClienteEntradas = entCliRaw.length
    ? entCliRaw
    : idsCliLegado.map((id) => ({ pessoaId: id, advogadoPessoaIds: [] }));
  const parteOpostaEntradas = entOpRaw.length
    ? entOpRaw
    : idsOpLegado.map((id) => ({ pessoaId: id, advogadoPessoaIds: [] }));
  const parteClienteIds = idsParteFromEntradasOuLegado(parteClienteEntradas, reg.parteClienteIds);
  const parteOpostaIds = idsParteFromEntradasOuLegado(parteOpostaEntradas, reg.parteOpostaIds);

  return {
    codCliente,
    proc,
    cliente: String(reg.cliente ?? ''),
    parteCliente: String(reg.parteCliente ?? ''),
    parteOposta: String(reg.parteOposta ?? ''),
    numeroProcessoNovo: String(reg.numeroProcessoNovo ?? ''),
    numeroProcessoVelho: String(reg.numeroProcessoVelho ?? ''),
    prazoFatal,
    periodicidadeConsulta: normalizarPeriodicidadeConsulta(reg.periodicidadeConsulta),
    proximaConsultaData: normalizarDataBr(reg.proximaConsultaData),
    tramitacao: String(reg.tramitacao ?? '').trim(),
    naturezaAcao: String(reg.naturezaAcao ?? '').trim(),
    faseSelecionada: String(reg.faseSelecionada ?? '').trim(),
    consultaAutomatica,
    statusAtivo,
    estado: String(reg.estado ?? ''),
    cidade: String(reg.cidade ?? ''),
    dataProtocolo: String(reg.dataProtocolo ?? ''),
    pastaArquivo: String(reg.pastaArquivo ?? ''),
    valorCausa: String(reg.valorCausa ?? ''),
    procedimento: String(reg.procedimento ?? ''),
    responsavel: String(reg.responsavel ?? ''),
    competencia: String(reg.competencia ?? ''),
    observacao: String(reg.observacao ?? ''),
    papelParte: String(reg.papelParte ?? '').trim(),
    faseCampo: String(reg.faseCampo ?? ''),
    audienciaData: String(reg.audienciaData ?? ''),
    audienciaHora: String(reg.audienciaHora ?? ''),
    audienciaTipo: String(reg.audienciaTipo ?? ''),
    avisoAudiencia: String(reg.avisoAudiencia ?? ''),
    imovelId: String(reg.imovelId ?? ''),
    unidade: String(reg.unidade ?? ''),
    unidadeEndereco: String(reg.unidadeEndereco ?? ''),
    proximaInformacao: String(reg.proximaInformacao ?? ''),
    dataProximaInformacao: String(reg.dataProximaInformacao ?? ''),
    parteClienteIds,
    parteOpostaIds,
    parteClienteEntradas,
    parteOpostaEntradas,
    historico,
  };
}

function upsertRegistroProcesso(payload) {
  const current = loadStore();
  const key = makeKey(payload.codCliente, payload.proc);
  const prev = current[key] || {};
  const mergedRaw = {
    ...prev,
    ...payload,
    codCliente: payload.codCliente ?? prev.codCliente,
    proc: payload.proc ?? prev.proc,
    historico: payload.historico !== undefined ? payload.historico : (prev.historico ?? []),
    prazoFatal: payload.prazoFatal !== undefined ? payload.prazoFatal : prev.prazoFatal,
    parteClienteIds: payload.parteClienteIds !== undefined ? payload.parteClienteIds : prev.parteClienteIds,
    parteOpostaIds: payload.parteOpostaIds !== undefined ? payload.parteOpostaIds : prev.parteOpostaIds,
    faseSelecionada: payload.faseSelecionada !== undefined ? payload.faseSelecionada : prev.faseSelecionada,
    tramitacao: payload.tramitacao !== undefined ? payload.tramitacao : prev.tramitacao,
    naturezaAcao: payload.naturezaAcao !== undefined ? payload.naturezaAcao : prev.naturezaAcao,
    numeroProcessoVelho: payload.numeroProcessoVelho !== undefined ? payload.numeroProcessoVelho : prev.numeroProcessoVelho,
    cliente: payload.cliente !== undefined ? payload.cliente : prev.cliente,
    parteCliente: payload.parteCliente !== undefined ? payload.parteCliente : prev.parteCliente,
    parteOposta: payload.parteOposta !== undefined ? payload.parteOposta : prev.parteOposta,
    numeroProcessoNovo: payload.numeroProcessoNovo !== undefined ? payload.numeroProcessoNovo : prev.numeroProcessoNovo,
    consultaAutomatica: payload.consultaAutomatica !== undefined ? payload.consultaAutomatica : prev.consultaAutomatica,
    statusAtivo: payload.statusAtivo !== undefined ? payload.statusAtivo : prev.statusAtivo,
    estado: payload.estado !== undefined ? payload.estado : prev.estado,
    cidade: payload.cidade !== undefined ? payload.cidade : prev.cidade,
    dataProtocolo: payload.dataProtocolo !== undefined ? payload.dataProtocolo : prev.dataProtocolo,
    pastaArquivo: payload.pastaArquivo !== undefined ? payload.pastaArquivo : prev.pastaArquivo,
    valorCausa: payload.valorCausa !== undefined ? payload.valorCausa : prev.valorCausa,
    procedimento: payload.procedimento !== undefined ? payload.procedimento : prev.procedimento,
    responsavel: payload.responsavel !== undefined ? payload.responsavel : prev.responsavel,
    competencia: payload.competencia !== undefined ? payload.competencia : prev.competencia,
    observacao: payload.observacao !== undefined ? payload.observacao : prev.observacao,
    papelParte: payload.papelParte !== undefined ? payload.papelParte : prev.papelParte,
    faseCampo: payload.faseCampo !== undefined ? payload.faseCampo : prev.faseCampo,
    audienciaData: payload.audienciaData !== undefined ? payload.audienciaData : prev.audienciaData,
    audienciaHora: payload.audienciaHora !== undefined ? payload.audienciaHora : prev.audienciaHora,
    audienciaTipo: payload.audienciaTipo !== undefined ? payload.audienciaTipo : prev.audienciaTipo,
    avisoAudiencia: payload.avisoAudiencia !== undefined ? payload.avisoAudiencia : prev.avisoAudiencia,
    imovelId: payload.imovelId !== undefined ? payload.imovelId : prev.imovelId,
    unidade: payload.unidade !== undefined ? payload.unidade : prev.unidade,
    unidadeEndereco: payload.unidadeEndereco !== undefined ? payload.unidadeEndereco : prev.unidadeEndereco,
    proximaInformacao: payload.proximaInformacao !== undefined ? payload.proximaInformacao : prev.proximaInformacao,
    dataProximaInformacao: payload.dataProximaInformacao !== undefined ? payload.dataProximaInformacao : prev.dataProximaInformacao,
    parteClienteEntradas:
      payload.parteClienteEntradas !== undefined ? payload.parteClienteEntradas : prev.parteClienteEntradas,
    parteOpostaEntradas:
      payload.parteOpostaEntradas !== undefined ? payload.parteOpostaEntradas : prev.parteOpostaEntradas,
  };
  const periodicidadeNorm = normalizarPeriodicidadeConsulta(
    payload.periodicidadeConsulta !== undefined ? payload.periodicidadeConsulta : mergedRaw.periodicidadeConsulta
  );
  const dataBaseConsulta = ultimaDataHistoricoBr(mergedRaw.historico);
  const proximaConsultaDataCalculada = calcularProximaConsultaBr({
    dataHistoricoBr: dataBaseConsulta,
    periodicidadeConsulta: periodicidadeNorm,
  });
  mergedRaw.periodicidadeConsulta = periodicidadeNorm;
  mergedRaw.proximaConsultaData = proximaConsultaDataCalculada;

  const merged = normalizarRegistroProcesso(mergedRaw);
  if (!merged) return null;
  current[key] = merged;
  saveStore(current);
  return merged;
}

export function getRegistroProcesso(codCliente, proc) {
  const current = loadStore();
  const key = makeKey(codCliente, proc);
  return normalizarRegistroProcesso(current[key]);
}

/** Processos persistidos em `vilareal:processos-historico:v1` (sem cadastro sintético). */
export function listarRegistrosProcessosHistoricoNormalizados() {
  if (typeof window === 'undefined') return [];
  const current = loadStore();
  const out = [];
  for (const raw of Object.values(current)) {
    const reg = normalizarRegistroProcesso(raw);
    if (reg) out.push(reg);
  }
  return out;
}

/**
 * Mesma informação que "Natureza da Ação" (Processos) e "Descrição da Ação" (Cadastro de Clientes).
 * Prioriza `naturezaAcao` persistida em `vilareal:processos-historico:v1`; senão usa o texto de fallback (ex.: mock/lista do cadastro).
 */
export function obterDescricaoAcaoUnificada(codCliente, procNumero, fallbackDescricao = '') {
  const nz = String(getRegistroProcesso(codCliente, procNumero)?.naturezaAcao ?? '').trim();
  if (nz) return nz;
  return String(fallbackDescricao ?? '').trim();
}

/**
 * Mesmo dado que «Nº Processo Velho» (Processos) e «N.º Processo Velho» na grade do cadastro (`processoVelho`).
 */
export function obterNumeroProcessoVelhoUnificado(codCliente, procNumero, fallbackProcessoVelho = '') {
  const v = String(getRegistroProcesso(codCliente, procNumero)?.numeroProcessoVelho ?? '').trim();
  if (v !== '') return v;
  return String(fallbackProcessoVelho ?? '').trim();
}

/**
 * Mesmo dado que «Nº Processo Novo» (Processos) e «N.º Processo Novo» na grade (`processoNovo`).
 */
export function obterNumeroProcessoNovoUnificado(codCliente, procNumero, fallbackProcessoNovo = '') {
  const v = String(getRegistroProcesso(codCliente, procNumero)?.numeroProcessoNovo ?? '').trim();
  if (v !== '') return v;
  return String(fallbackProcessoNovo ?? '').trim();
}

/**
 * Mesmo texto que «Parte Oposta» na tela Processos (`parteOposta` no histórico) e na grade do cadastro.
 */
export function obterParteOpostaUnificada(codCliente, procNumero, fallbackParteOposta = '') {
  const po = String(getRegistroProcesso(codCliente, procNumero)?.parteOposta ?? '').trim();
  if (po) return po;
  return String(fallbackParteOposta ?? '').trim();
}

/**
 * Grava o texto da parte oposta a partir da grade do cadastro; zera `parteOpostaIds` para o formulário
 * Processos exibir exatamente esse texto (até o usuário vincular de novo em «Pessoas»).
 */
export function salvarParteOpostaDaGradeCadastro(codCliente, proc, parteOpostaTexto) {
  const prev = getRegistroProcesso(codCliente, proc);
  const t = String(parteOpostaTexto ?? '');
  if (prev) {
    return salvarHistoricoDoProcesso({ ...prev, parteOposta: t, parteOpostaIds: [] });
  }
  return salvarHistoricoDoProcesso({
    codCliente: normalizarCodCliente(codCliente),
    proc: normalizarProc(proc),
    cliente: '',
    parteCliente: '',
    parteOposta: t,
    parteOpostaIds: [],
    numeroProcessoNovo: '',
    numeroProcessoVelho: '',
    historico: [],
    prazoFatal: '',
    parteClienteIds: [],
    faseSelecionada: '',
    periodicidadeConsulta: '',
    tramitacao: '',
    naturezaAcao: '',
  });
}

/** Grava só `numeroProcessoNovo` (CNJ / número novo), preservando o restante do registro. */
export function salvarNumeroProcessoNovoDaGradeCadastro(codCliente, proc, numeroProcessoNovo) {
  const prev = getRegistroProcesso(codCliente, proc);
  const val = String(numeroProcessoNovo ?? '');
  if (prev) {
    return salvarHistoricoDoProcesso({ ...prev, numeroProcessoNovo: val });
  }
  return salvarHistoricoDoProcesso({
    codCliente: normalizarCodCliente(codCliente),
    proc: normalizarProc(proc),
    cliente: '',
    parteCliente: '',
    parteOposta: '',
    numeroProcessoNovo: val,
    numeroProcessoVelho: '',
    historico: [],
    prazoFatal: '',
    parteClienteIds: [],
    parteOpostaIds: [],
    faseSelecionada: '',
    periodicidadeConsulta: '',
    tramitacao: '',
    naturezaAcao: '',
  });
}

/** Grava só `naturezaAcao`, preservando o restante do registro do processo (merge com histórico existente). */
export function salvarNaturezaAcaoDoProcesso(codCliente, proc, naturezaAcao) {
  const prev = getRegistroProcesso(codCliente, proc);
  const nz = String(naturezaAcao ?? '').trim();
  if (prev) {
    return salvarHistoricoDoProcesso({ ...prev, naturezaAcao: nz });
  }
  return salvarHistoricoDoProcesso({
    codCliente: normalizarCodCliente(codCliente),
    proc: normalizarProc(proc),
    cliente: '',
    parteCliente: '',
    parteOposta: '',
    numeroProcessoNovo: '',
    historico: [],
    prazoFatal: '',
    parteClienteIds: [],
    parteOpostaIds: [],
    faseSelecionada: '',
    periodicidadeConsulta: '',
    tramitacao: '',
    naturezaAcao: nz,
  });
}

/** Grava só `numeroProcessoVelho`, preservando o restante do registro do processo. */
export function salvarNumeroProcessoVelhoDoProcesso(codCliente, proc, numeroProcessoVelho) {
  const prev = getRegistroProcesso(codCliente, proc);
  const val = String(numeroProcessoVelho ?? '');
  if (prev) {
    return salvarHistoricoDoProcesso({ ...prev, numeroProcessoVelho: val });
  }
  return salvarHistoricoDoProcesso({
    codCliente: normalizarCodCliente(codCliente),
    proc: normalizarProc(proc),
    cliente: '',
    parteCliente: '',
    parteOposta: '',
    numeroProcessoNovo: '',
    numeroProcessoVelho: val,
    historico: [],
    prazoFatal: '',
    parteClienteIds: [],
    parteOpostaIds: [],
    faseSelecionada: '',
    periodicidadeConsulta: '',
    tramitacao: '',
    naturezaAcao: '',
  });
}

/**
 * Alinha campos da grade ao histórico do processo (`vilareal:processos-historico:v1`):
 * descrição da ação, nº processo velho/novo e parte oposta (texto).
 */
export function alinharListaProcessosDescricaoComHistorico(codClientePadded8, listaProcessos) {
  if (!Array.isArray(listaProcessos)) return listaProcessos;
  const cod = normalizarCodCliente(codClientePadded8);
  let changed = false;
  const out = listaProcessos.map((p) => {
    const n = Number(p?.procNumero);
    if (!Number.isFinite(n) || n < 1) return p;
    const descUnif = obterDescricaoAcaoUnificada(cod, n, p.descricao ?? '');
    const velhoUnif = obterNumeroProcessoVelhoUnificado(cod, n, p.processoVelho ?? '');
    const novoUnif = obterNumeroProcessoNovoUnificado(cod, n, p.processoNovo ?? '');
    const opostaUnif = obterParteOpostaUnificada(cod, n, p.parteOposta ?? '');
    const sameDesc = (p.descricao ?? '') === descUnif;
    const sameVelho = (p.processoVelho ?? '') === velhoUnif;
    const sameNovo = (p.processoNovo ?? '') === novoUnif;
    const sameOposta = (p.parteOposta ?? '') === opostaUnif;
    if (sameDesc && sameVelho && sameNovo && sameOposta) return p;
    changed = true;
    return { ...p, descricao: descUnif, processoVelho: velhoUnif, processoNovo: novoUnif, parteOposta: opostaUnif };
  });
  return changed ? out : listaProcessos;
}

/**
 * Números internos de processo (Proc. 1, 2…) que já têm registro no histórico local para o cliente.
 */
export function listarProcInternosComHistoricoLocal(codClienteRaw) {
  if (typeof window === 'undefined') return [];
  const cod = normalizarCodCliente(codClienteRaw);
  const current = loadStore();
  const procs = new Set();
  for (const rawReg of Object.values(current)) {
    const reg = normalizarRegistroProcesso(rawReg);
    if (!reg) continue;
    if (normalizarCodCliente(reg.codCliente) !== cod) continue;
    const n = Number(normalizarProc(reg.proc));
    if (Number.isFinite(n) && n >= 1) procs.add(n);
  }
  return Array.from(procs).sort((a, b) => a - b);
}

/**
 * Garante linhas na grade do Cadastro de Clientes para todo processo existente no histórico local
 * (tela Processos grava em `vilareal:processos-historico:v1` mesmo com cliente vindo da API).
 */
export function enriquecerListaProcessosComHistoricoLocal(codClientePadded8, listaProcessos) {
  const base = Array.isArray(listaProcessos) ? listaProcessos : [];
  const codPadded = normalizarCodCliente(codClientePadded8);
  const codN = Number(apenasDigitos(codPadded)) || 1;
  const procsHistorico = listarProcInternosComHistoricoLocal(codPadded);
  const seen = new Set();
  for (const p of base) {
    const pn = Number(p?.procNumero);
    if (Number.isFinite(pn) && pn >= 1) seen.add(pn);
  }
  const extraRows = [];
  for (const proc of procsHistorico) {
    if (seen.has(proc)) continue;
    seen.add(proc);
    extraRows.push({
      id: `${codN}-${proc}`,
      procNumero: proc,
      processoVelho: '',
      processoNovo: '',
      autor: '',
      reu: '',
      parteOposta: '',
      tipoAcao: '',
      descricao: '',
    });
  }
  if (extraRows.length === 0) {
    return alinharListaProcessosDescricaoComHistorico(codPadded, base);
  }
  const merged = [...base, ...extraRows].sort(
    (a, b) => (Number(a.procNumero) || 0) - (Number(b.procNumero) || 0)
  );
  return alinharListaProcessosDescricaoComHistorico(codPadded, merged);
}

/**
 * Se o texto do compromisso contiver número(s) de processo e **apenas um** processo
 * distinto da base (localStorage) for identificado, retorna `{ codCliente, proc }`.
 * Aceita CNJ completo, 20 dígitos ou resumo (ex.: 5717034.38.2025).
 * Caso contrário (nenhum match, ou mais de um processo distinto) retorna `null`.
 */
export function buscarProcessoUnicoNaBasePorTextoAgenda(texto) {
  const store = loadStore();
  const lista = encontrarProcessosHistoricoPorTextoAgenda(texto, store);
  if (lista.length !== 1) return null;
  const m = lista[0];
  return {
    codCliente: normalizarCodCliente(m.codCliente),
    proc: Number(normalizarProc(m.proc)),
  };
}

function statsSincAgendaVazio() {
  return {
    ok: true,
    processosAtualizados: 0,
    eventosAgendaEnriquecidos: 0,
    ignoradosSemPadraoCnj: 0,
    ignoradosSemMatchNaBase: 0,
    ignoradosAmbiguos: 0,
    ignoradosSemRegistro: 0,
  };
}

/**
 * @param {Array<[string, object[]]>} entradas pares [dataBr, eventos]
 * @param {{
 *   persistirPatchNaAgendaLocal?: boolean,
 *   storeHistoricoParaMatch?: Record<string, unknown>|null,
 *   criarRegistroSeAusente?: boolean,
 * }} [options]
 */
export function sincronizarAudienciasAgendaEntradas(entradas, options = {}) {
  const persistirPatchNaAgendaLocal = options.persistirPatchNaAgendaLocal !== false;
  const storeHistoricoParaMatch =
    options.storeHistoricoParaMatch != null && typeof options.storeHistoricoParaMatch === 'object'
      ? options.storeHistoricoParaMatch
      : null;
  const criarRegistroSeAusente = options.criarRegistroSeAusente !== false;

  const base = statsSincAgendaVazio();
  if (typeof window === 'undefined') {
    return { ...base, ok: false, reason: 'no-window' };
  }

  const storeParaMatch = storeHistoricoParaMatch || loadStore();
  const chavesProcAtualizadas = new Set();
  let eventosAgendaEnriquecidos = 0;

  for (const [dataBr, eventos] of entradas) {
    for (const ev of eventos) {
      const desc = [String(ev?.descricao ?? '').trim(), String(ev?.titulo ?? '').trim()]
        .filter(Boolean)
        .join('\n')
        .trim();

      let matches = [];
      const chaveEv = extrairChaveProcessoEventoAgenda(ev);
      if (chaveEv) {
        const prevV = getRegistroProcesso(chaveEv.codCliente, chaveEv.proc);
        if (prevV) {
          matches = [{ codCliente: prevV.codCliente, proc: Number(normalizarProc(prevV.proc)) }];
        } else if (criarRegistroSeAusente) {
          matches = [{ codCliente: chaveEv.codCliente, proc: chaveEv.proc }];
        }
      }

      if (matches.length === 0) {
        if (!desc) {
          base.ignoradosSemPadraoCnj += 1;
          continue;
        }
        if (extrairChavesCandidatasCnjDoTextoAgenda(desc).length === 0) {
          base.ignoradosSemPadraoCnj += 1;
          continue;
        }
        matches = encontrarProcessosHistoricoPorTextoAgenda(desc, storeParaMatch);
      }

      if (matches.length === 0) {
        base.ignoradosSemMatchNaBase += 1;
        continue;
      }
      if (matches.length > 1) {
        base.ignoradosAmbiguos += 1;
        continue;
      }

      const { codCliente: codM, proc: procM } = matches[0];
      const prev = getRegistroProcesso(codM, procM);
      const tipo = extrairTipoAudienciaDaDescricaoAgenda(desc);
      const hora = String(ev?.hora ?? '').trim().slice(0, 5);

      if (!prev) {
        if (!criarRegistroSeAusente) {
          base.ignoradosSemRegistro += 1;
          continue;
        }
        const procInt = Math.floor(Number(procM)) || 1;
        const lookupKey = `${padCliente(codM)}:${procInt}`;
        const stub =
          storeHistoricoParaMatch && typeof storeHistoricoParaMatch === 'object'
            ? storeHistoricoParaMatch[lookupKey]
            : null;
        const nStub = stub && typeof stub === 'object' ? stub : null;
        upsertRegistroProcesso({
          codCliente: codM,
          proc: procM,
          cliente: '',
          parteCliente: '',
          parteOposta: '',
          numeroProcessoNovo: String(nStub?.numeroProcessoNovo ?? '').trim(),
          numeroProcessoVelho: String(nStub?.numeroProcessoVelho ?? '').trim(),
          historico: [],
          audienciaData: dataBr,
          audienciaHora: hora,
          audienciaTipo: tipo || 'Audiência',
        });
      } else {
        upsertRegistroProcesso({
          ...prev,
          codCliente: prev.codCliente,
          proc: prev.proc,
          historico: prev.historico,
          audienciaData: dataBr,
          audienciaHora: hora,
          audienciaTipo: tipo || prev.audienciaTipo,
        });
      }

      const prevPos = getRegistroProcesso(codM, procM);
      if (!prevPos) continue;

      const kProc = `${prevPos.codCliente}:${prevPos.proc}`;
      if (!chavesProcAtualizadas.has(kProc)) {
        chavesProcAtualizadas.add(kProc);
        base.processosAtualizados += 1;
      }

      if (persistirPatchNaAgendaLocal) {
        const codPad = padCliente(prevPos.codCliente);
        const procNum = Math.floor(Number(prevPos.proc)) || 1;
        const procRef = montarProcessoRefAgenda(codPad, procNum) || '';
        const r = salvarCamposEventoAgendaPersistido({
          dataBr,
          evento: ev,
          patch: {
            processoRef: procRef,
            codCliente: codPad,
            proc: procNum,
          },
        });
        if (r.ok) eventosAgendaEnriquecidos += 1;
      }
    }
  }

  base.eventosAgendaEnriquecidos = eventosAgendaEnriquecidos;

  if (base.processosAtualizados > 0) {
    try {
      window.dispatchEvent(new CustomEvent('vilareal:processos-historico-atualizado'));
    } catch {
      /* ignore */
    }
  }
  if (eventosAgendaEnriquecidos > 0) {
    try {
      window.dispatchEvent(new CustomEvent('vilareal:agenda-persistencia-atualizada'));
    } catch {
      /* ignore */
    }
  }

  return base;
}

function sincronizarAudienciasListaEntradasAgendaInterno(entradas) {
  return sincronizarAudienciasAgendaEntradas(entradas, {
    persistirPatchNaAgendaLocal: true,
    storeHistoricoParaMatch: null,
    criarRegistroSeAusente: true,
  });
}

/**
 * Percorre **toda** a agenda persistida (localStorage), igual ao fluxo por mês.
 */
export function sincronizarTodaAgendaPersistidaComProcessosHistorico() {
  const entradas = listarTodasEntradasAgendaPersistida();
  return sincronizarAudienciasListaEntradasAgendaInterno(entradas);
}

/**
 * Percorre a agenda persistida (localStorage) do mês/ano, identifica compromissos cujo texto
 * contenha CNJ (completo ou resumido) e, quando houver um único processo correspondente no
 * histórico local, grava data/hora/tipo da audiência no histórico do processo e enriquece o
 * evento com codCliente, proc e processoRef.
 */
export function sincronizarAudienciasAgendaMesComProcessosHistorico(mes, ano) {
  const base = statsSincAgendaVazio();
  if (typeof window === 'undefined') {
    return { ...base, ok: false, reason: 'no-window' };
  }
  const m = Number(mes);
  const y = Number(ano);
  if (!Number.isFinite(m) || m < 1 || m > 12 || !Number.isFinite(y)) {
    return { ...base, ok: false, reason: 'mes-ano-invalido' };
  }
  const entradas = listarEntradasAgendaPorMesAnoPersistida(m, y);
  return sincronizarAudienciasListaEntradasAgendaInterno(entradas);
}

export function getHistoricoDoProcesso(codCliente, proc) {
  const reg = getRegistroProcesso(codCliente, proc);
  return reg?.historico || [];
}

export function seedHistoricoDoProcesso(payload) {
  const existing = getHistoricoDoProcesso(payload.codCliente, payload.proc);
  if (existing.length > 0) return existing;
  const merged = upsertRegistroProcesso(payload);
  return merged?.historico || [];
}

export function salvarHistoricoDoProcesso(payload) {
  const merged = upsertRegistroProcesso(payload);
  return merged?.historico || [];
}

/**
 * Persiste apenas o Prazo Fatal (dd/mm/aaaa) vinculado ao processo, preservando histórico existente.
 */
export function salvarPrazoFatalDoProcesso(codCliente, proc, prazoFatalBr, dadosExtras = {}) {
  const current = loadStore();
  const key = makeKey(codCliente, proc);
  const prevRaw = current[key];
  const prev = normalizarRegistroProcesso(prevRaw) || {
    codCliente: normalizarCodCliente(codCliente),
    proc: normalizarProc(proc),
    cliente: '',
    parteCliente: '',
    parteOposta: '',
    numeroProcessoNovo: '',
    numeroProcessoVelho: '',
    prazoFatal: '',
    parteClienteIds: [],
    parteOpostaIds: [],
    faseSelecionada: '',
    periodicidadeConsulta: '',
    proximaConsultaData: '',
    tramitacao: '',
    naturezaAcao: '',
    consultaAutomatica: null,
    statusAtivo: null,
    estado: '',
    cidade: '',
    dataProtocolo: '',
    pastaArquivo: '',
    valorCausa: '',
    procedimento: '',
    responsavel: '',
    competencia: '',
    observacao: '',
    papelParte: '',
    faseCampo: '',
    audienciaData: '',
    audienciaHora: '',
    audienciaTipo: '',
    avisoAudiencia: '',
    imovelId: '',
    unidade: '',
    unidadeEndereco: '',
    proximaInformacao: '',
    dataProximaInformacao: '',
    historico: [],
  };
  const pf = String(prazoFatalBr ?? '').trim();
  const prazoNorm = pf ? (normalizarDataBr(pf) || pf) : '';
  return upsertRegistroProcesso({
    ...prev,
    ...dadosExtras,
    codCliente: prev.codCliente,
    proc: prev.proc,
    cliente: dadosExtras.cliente != null ? dadosExtras.cliente : prev.cliente,
    parteCliente: dadosExtras.parteCliente != null ? dadosExtras.parteCliente : prev.parteCliente,
    parteOposta: dadosExtras.parteOposta != null ? dadosExtras.parteOposta : prev.parteOposta,
    numeroProcessoNovo: dadosExtras.numeroProcessoNovo != null ? dadosExtras.numeroProcessoNovo : prev.numeroProcessoNovo,
    historico: prev.historico || [],
    prazoFatal: prazoNorm,
    periodicidadeConsulta: dadosExtras.periodicidadeConsulta != null ? dadosExtras.periodicidadeConsulta : prev.periodicidadeConsulta,
    proximaConsultaData: prev.proximaConsultaData || '',
    tramitacao: dadosExtras.tramitacao != null ? dadosExtras.tramitacao : prev.tramitacao,
    naturezaAcao: dadosExtras.naturezaAcao != null ? dadosExtras.naturezaAcao : prev.naturezaAcao,
  });
}

export function listarHistoricoPorData(dataBr) {
  const target = String(dataBr ?? '').trim();
  if (!target) return [];
  const out = [];
  const current = loadStore();
  Object.values(current).forEach((rawReg) => {
    const reg = normalizarRegistroProcesso(rawReg);
    if (!reg) return;
    reg.historico.forEach((h) => {
      if (String(h.data ?? '').trim() !== target) return;
      out.push({
        codCliente: reg.codCliente,
        proc: reg.proc,
        cliente: reg.cliente,
        parteCliente: reg.parteCliente,
        parteOposta: reg.parteOposta,
        numeroProcessoNovo: reg.numeroProcessoNovo,
        ...h,
      });
    });
  });
  out.sort((a, b) => (Number(b.numero) || 0) - (Number(a.numero) || 0));
  return out;
}

export function listarConsultasARealizarPorData(dataBr) {
  const target = normalizarDataBr(String(dataBr ?? '').trim());
  if (!target) return [];
  const out = [];
  const current = loadStore();
  Object.values(current).forEach((rawReg) => {
    const reg = normalizarRegistroProcesso(rawReg);
    if (!reg) return;
    if (normalizarDataBr(reg.proximaConsultaData) !== target) return;
    out.push({
      codCliente: reg.codCliente,
      proc: reg.proc,
      cliente: reg.cliente,
      parteCliente: reg.parteCliente,
      parteOposta: reg.parteOposta,
      numeroProcessoNovo: reg.numeroProcessoNovo,
      info: `Periodicidade ${reg.periodicidadeConsulta || '—'} (próxima consulta em ${reg.proximaConsultaData || '—'})`,
      data: reg.proximaConsultaData || '',
      usuario: '',
      numero: '',
    });
  });
  out.sort((a, b) => {
    const ca = Number(String(a.codCliente || '').replace(/\D/g, '')) || 0;
    const cb = Number(String(b.codCliente || '').replace(/\D/g, '')) || 0;
    if (ca !== cb) return ca - cb;
    return (Number(a.proc) || 0) - (Number(b.proc) || 0);
  });
  return out;
}

/** IDs de advogados vinculados às partes (`parte*Entradas` no registro normalizado). */
function coletarIdsAdvogadosDoRegistro(reg) {
  const ids = new Set();
  for (const key of ['parteClienteEntradas', 'parteOpostaEntradas']) {
    const arr = reg[key];
    if (!Array.isArray(arr)) continue;
    for (const row of arr) {
      if (!row || typeof row !== 'object') continue;
      for (const a of row.advogadoPessoaIds || []) {
        const n = Number(a);
        if (Number.isFinite(n) && n >= 1) ids.add(n);
      }
    }
  }
  return ids;
}

/**
 * Agrega advogados (cadastro pessoa) que aparecem em `advogadoPessoaIds` nas partes do histórico local.
 * @returns {Array<{ idPessoa: number, processos: Array<{ codCliente: string, proc: string, numeroProcessoNovo: string, parteCliente: string, parteOposta: string }> }>}
 */
export function listarAdvogadosAgregadosNoHistoricoLocal() {
  const current = loadStore();
  /** @type {Map<number, Array<{ codCliente: string, proc: string, numeroProcessoNovo: string, parteCliente: string, parteOposta: string }>>} */
  const mapa = new Map();
  for (const rawReg of Object.values(current)) {
    const reg = normalizarRegistroProcesso(rawReg);
    if (!reg) continue;
    const snap = {
      codCliente: reg.codCliente,
      proc: reg.proc,
      numeroProcessoNovo: reg.numeroProcessoNovo || '',
      parteCliente: reg.parteCliente || '',
      parteOposta: reg.parteOposta || '',
    };
    for (const aid of coletarIdsAdvogadosDoRegistro(reg)) {
      if (!mapa.has(aid)) mapa.set(aid, []);
      mapa.get(aid).push(snap);
    }
  }
  return Array.from(mapa.entries())
    .map(([idPessoa, processos]) => ({
      idPessoa,
      processos,
    }))
    .sort((a, b) => a.idPessoa - b.idPessoa);
}

/**
 * Lista processos em que a pessoa (cadastro) participa — por ID nas partes vinculadas
 * e/ou pelo nome quando informado (fallback para texto em Parte Cliente / Oposta),
 * e como advogado(a) quando `parte*Entradas` com `advogadoPessoaIds` estiver persistido.
 */
export function listarProcessosPorIdPessoa(idPessoa, nomeCadastro) {
  const idStr = String(idPessoa ?? '').trim().replace(/\D/g, '');
  const idNum = Number(idStr);
  const temId = Number.isFinite(idNum) && idNum >= 1;
  const nomeN = normalizarTextoPessoa(nomeCadastro);
  const temNome = nomeN.length > 0;
  if (!temId && !temNome) return [];

  const out = [];
  const current = loadStore();
  Object.values(current).forEach((rawReg) => {
    const reg = normalizarRegistroProcesso(rawReg);
    if (!reg) return;
    const matchIdCliente = temId && reg.parteClienteIds.includes(idNum);
    const matchIdOposta = temId && reg.parteOpostaIds.includes(idNum);
    const matchNomeCliente = temNome && normalizarTextoPessoa(reg.parteCliente).includes(nomeN);
    const matchNomeOposta = temNome && normalizarTextoPessoa(reg.parteOposta).includes(nomeN);
    const advIds = coletarIdsAdvogadosDoRegistro(reg);
    const matchAdvogado = temId && advIds.has(idNum);
    if (
      !matchIdCliente &&
      !matchIdOposta &&
      !matchNomeCliente &&
      !matchNomeOposta &&
      !matchAdvogado
    ) {
      return;
    }
    const papeis = [];
    if (matchIdCliente || matchNomeCliente) papeis.push('Parte Cliente');
    if (matchIdOposta || matchNomeOposta) papeis.push('Parte Oposta');
    if (matchAdvogado) papeis.push('Advogado(a)');
    out.push({
      codCliente: reg.codCliente,
      proc: reg.proc,
      cliente: reg.cliente,
      parteCliente: reg.parteCliente,
      parteOposta: reg.parteOposta,
      numeroProcessoNovo: reg.numeroProcessoNovo,
      papeis: [...new Set(papeis)].join(' · '),
    });
  });
  out.sort((a, b) => {
    const ka = `${a.codCliente}-${String(a.proc).padStart(4, '0')}`;
    const kb = `${b.codCliente}-${String(b.proc).padStart(4, '0')}`;
    return ka.localeCompare(kb);
  });
  return out;
}

/**
 * Diagnósticos «Busca por número»: processos no histórico local cujo CNJ (novo ou velho) coincide após normalização.
 * @param {string} numeroBruto
 * @returns {Array<{ codCliente: string, proc: string, cliente: string, parteCliente: string, parteOposta: string, numeroProcessoNovo: string, papeis: string }>}
 */
export function listarProcessosHistoricoLocalPorChaveNumeroProcesso(numeroBruto) {
  const chave = chaveNumeroProcessoBuscaDiagnostico(numeroBruto);
  if (!chave || chave.length < 7) return [];
  const all = listarRegistrosProcessosHistoricoNormalizados();
  const out = [];
  const seen = new Set();
  for (const reg of all) {
    const kNovo = chaveNumeroProcessoBuscaDiagnostico(reg.numeroProcessoNovo);
    const kVelho = chaveNumeroProcessoBuscaDiagnostico(reg.numeroProcessoVelho);
    if (kNovo !== chave && kVelho !== chave) continue;
    const mk = `${reg.codCliente}-${reg.proc}`;
    if (seen.has(mk)) continue;
    seen.add(mk);
    out.push({
      codCliente: reg.codCliente,
      proc: reg.proc,
      cliente: reg.cliente,
      parteCliente: reg.parteCliente,
      parteOposta: reg.parteOposta,
      numeroProcessoNovo: reg.numeroProcessoNovo,
      papeis: 'Histórico local',
    });
  }
  out.sort((a, b) => `${a.codCliente}-${String(a.proc).padStart(4, '0')}`.localeCompare(`${b.codCliente}-${String(b.proc).padStart(4, '0')}`));
  return out;
}

/** Indica se a fase gravada corresponde a “Aguardando / Ag. Documentos” (alinha rótulo do Diagnóstico e da tela Processos). */
export function registroEmFaseAguardandoDocumentos(fase) {
  const s = String(fase ?? '').trim();
  if (!s) return false;
  if (s === 'Ag. Documentos') return true;
  const t = normalizarTextoPessoa(s);
  if (t.includes('aguardando') && t.includes('document')) return true;
  const c = t.replace(/[^a-z0-9]/g, '');
  return c.startsWith('ag') && c.includes('docu') && (c.includes('ment') || c.includes('met'));
}

/** Todos os processos persistidos cuja fase é “Aguardando Documentos” / “Ag. Documentos”. */
export function listarProcessosFaseAguardandoDocumentos() {
  const out = [];
  const current = loadStore();
  Object.values(current).forEach((rawReg) => {
    const reg = normalizarRegistroProcesso(rawReg);
    if (!reg) return;
    if (!registroEmFaseAguardandoDocumentos(reg.faseSelecionada)) return;
    out.push({
      codCliente: reg.codCliente,
      proc: reg.proc,
      cliente: reg.cliente,
      parteCliente: reg.parteCliente,
      parteOposta: reg.parteOposta,
      numeroProcessoNovo: reg.numeroProcessoNovo,
      faseSelecionada: reg.faseSelecionada,
    });
  });
  out.sort((a, b) => {
    const ka = `${a.codCliente}-${String(a.proc).padStart(4, '0')}`;
    const kb = `${b.codCliente}-${String(b.proc).padStart(4, '0')}`;
    return ka.localeCompare(kb);
  });
  return out;
}

/** Indica se a fase gravada corresponde a “Aguardando Peticionar” / “Ag. Peticionar” (alinha Processos.jsx). */
export function registroEmFaseAguardandoPeticionar(fase) {
  const s = String(fase ?? '').trim();
  if (!s) return false;
  if (s === 'Ag. Peticionar') return true;
  const t = normalizarTextoPessoa(s);
  if (t.includes('aguardando') && t.includes('petic')) return true;
  const c = t.replace(/[^a-z0-9]/g, '');
  return (
    c.startsWith('ag') &&
    c.includes('petic') &&
    (c.includes('ar') || c.includes('ionar') || c.includes('icion'))
  );
}

/** Todos os processos persistidos cuja fase é Aguardando Peticionar / Ag. Peticionar. */
export function listarProcessosFaseAguardandoPeticionar() {
  const out = [];
  const current = loadStore();
  Object.values(current).forEach((rawReg) => {
    const reg = normalizarRegistroProcesso(rawReg);
    if (!reg) return;
    if (!registroEmFaseAguardandoPeticionar(reg.faseSelecionada)) return;
    out.push({
      codCliente: reg.codCliente,
      proc: reg.proc,
      cliente: reg.cliente,
      parteCliente: reg.parteCliente,
      parteOposta: reg.parteOposta,
      numeroProcessoNovo: reg.numeroProcessoNovo,
      faseSelecionada: reg.faseSelecionada,
    });
  });
  out.sort((a, b) => {
    const ka = `${a.codCliente}-${String(a.proc).padStart(4, '0')}`;
    const kb = `${b.codCliente}-${String(b.proc).padStart(4, '0')}`;
    return ka.localeCompare(kb);
  });
  return out;
}

/** Indica se a fase gravada corresponde a “Aguardando Verificação” / “Ag. Verificação” (alinha Processos.jsx). */
export function registroEmFaseAguardandoVerificacao(fase) {
  const s = String(fase ?? '').trim();
  if (!s) return false;
  if (s === 'Ag. Verificação') return true;
  const t = normalizarTextoPessoa(s);
  if (t.includes('aguardando') && t.includes('verif')) return true;
  const c = t.replace(/[^a-z0-9]/g, '');
  return c.startsWith('ag') && (c.includes('verif') || c.includes('verificacao'));
}

/** Todos os processos persistidos cuja fase é Aguardando Verificação / Ag. Verificação. */
export function listarProcessosFaseAguardandoVerificacao() {
  const out = [];
  const current = loadStore();
  Object.values(current).forEach((rawReg) => {
    const reg = normalizarRegistroProcesso(rawReg);
    if (!reg) return;
    if (!registroEmFaseAguardandoVerificacao(reg.faseSelecionada)) return;
    out.push({
      codCliente: reg.codCliente,
      proc: reg.proc,
      cliente: reg.cliente,
      parteCliente: reg.parteCliente,
      parteOposta: reg.parteOposta,
      numeroProcessoNovo: reg.numeroProcessoNovo,
      faseSelecionada: reg.faseSelecionada,
    });
  });
  out.sort((a, b) => {
    const ka = `${a.codCliente}-${String(a.proc).padStart(4, '0')}`;
    const kb = `${b.codCliente}-${String(b.proc).padStart(4, '0')}`;
    return ka.localeCompare(kb);
  });
  return out;
}

/**
 * Fase “Aguardando Protocolo” no Diagnóstico ↔ rádio “Protocolo / Movimentação” em Processos.jsx
 * (detecção compacta: protoc + moviment).
 */
export function registroEmFaseAguardandoProtocolo(fase) {
  const s = String(fase ?? '').trim();
  if (!s) return false;
  if (s === 'Protocolo / Movimentação') return true;
  const t = normalizarTextoPessoa(s);
  if (t.includes('aguardando') && t.includes('protoc')) return true;
  const c = t.replace(/[^a-z0-9]/g, '');
  return c.includes('protoc') && c.includes('moviment');
}

/** Processos na fase de protocolo / movimentação (ou “Aguardando Protocolo”). */
export function listarProcessosFaseAguardandoProtocolo() {
  const out = [];
  const current = loadStore();
  Object.values(current).forEach((rawReg) => {
    const reg = normalizarRegistroProcesso(rawReg);
    if (!reg) return;
    if (!registroEmFaseAguardandoProtocolo(reg.faseSelecionada)) return;
    out.push({
      codCliente: reg.codCliente,
      proc: reg.proc,
      cliente: reg.cliente,
      parteCliente: reg.parteCliente,
      parteOposta: reg.parteOposta,
      numeroProcessoNovo: reg.numeroProcessoNovo,
      faseSelecionada: reg.faseSelecionada,
    });
  });
  out.sort((a, b) => {
    const ka = `${a.codCliente}-${String(a.proc).padStart(4, '0')}`;
    const kb = `${b.codCliente}-${String(b.proc).padStart(4, '0')}`;
    return ka.localeCompare(kb);
  });
  return out;
}

/** Fase “Aguardando Providência” (mesmo rótulo em Processos.jsx). */
export function registroEmFaseAguardandoProvidencia(fase) {
  const s = String(fase ?? '').trim();
  if (!s) return false;
  if (s === 'Aguardando Providência') return true;
  const t = normalizarTextoPessoa(s);
  if (t.includes('aguardando') && t.includes('provid')) return true;
  const c = t.replace(/[^a-z0-9]/g, '');
  return c.startsWith('ag') && c.includes('provid');
}

/** Processos na fase Aguardando Providência. */
export function listarProcessosFaseAguardandoProvidencia() {
  const out = [];
  const current = loadStore();
  Object.values(current).forEach((rawReg) => {
    const reg = normalizarRegistroProcesso(rawReg);
    if (!reg) return;
    if (!registroEmFaseAguardandoProvidencia(reg.faseSelecionada)) return;
    out.push({
      codCliente: reg.codCliente,
      proc: reg.proc,
      cliente: reg.cliente,
      parteCliente: reg.parteCliente,
      parteOposta: reg.parteOposta,
      numeroProcessoNovo: reg.numeroProcessoNovo,
      faseSelecionada: reg.faseSelecionada,
    });
  });
  out.sort((a, b) => {
    const ka = `${a.codCliente}-${String(a.proc).padStart(4, '0')}`;
    const kb = `${b.codCliente}-${String(b.proc).padStart(4, '0')}`;
    return ka.localeCompare(kb);
  });
  return out;
}

/**
 * Fase “Proc. Administrativo” no Diagnóstico ↔ “Procedimento Adm.” em Processos.jsx.
 * Evita coincidir com “Protocolo / Movimentação” (ex.: compacto com “proc” + “administr” mas sem “protocolo”).
 */
export function registroEmFaseProcedimentoAdministrativo(fase) {
  const s = String(fase ?? '').trim();
  if (!s) return false;
  if (s === 'Procedimento Adm.') return true;
  const t = normalizarTextoPessoa(s);
  const c = t.replace(/[^a-z0-9]/g, '');
  if (c.includes('proced') && (c.includes('adm') || c.includes('administr'))) return true;
  if (c.includes('administr') && c.includes('proc') && !c.includes('protocolo')) return true;
  return false;
}

/** Processos na fase Procedimento Adm. / administrativo. */
export function listarProcessosFaseProcedimentoAdministrativo() {
  const out = [];
  const current = loadStore();
  Object.values(current).forEach((rawReg) => {
    const reg = normalizarRegistroProcesso(rawReg);
    if (!reg) return;
    if (!registroEmFaseProcedimentoAdministrativo(reg.faseSelecionada)) return;
    out.push({
      codCliente: reg.codCliente,
      proc: reg.proc,
      cliente: reg.cliente,
      parteCliente: reg.parteCliente,
      parteOposta: reg.parteOposta,
      numeroProcessoNovo: reg.numeroProcessoNovo,
      faseSelecionada: reg.faseSelecionada,
    });
  });
  out.sort((a, b) => {
    const ka = `${a.codCliente}-${String(a.proc).padStart(4, '0')}`;
    const kb = `${b.codCliente}-${String(b.proc).padStart(4, '0')}`;
    return ka.localeCompare(kb);
  });
  return out;
}

/** Processos com Prazo Fatal na data informada (dd/mm/aaaa). */
export function listarProcessosPorPrazoFatal(dataBr) {
  const target = normalizarDataBr(String(dataBr ?? '').trim());
  if (!target) return [];
  const out = [];
  const current = loadStore();
  Object.values(current).forEach((rawReg) => {
    const reg = normalizarRegistroProcesso(rawReg);
    if (!reg) return;
    const pf = String(reg.prazoFatal ?? '').trim();
    if (!pf) return;
    const pfNorm = normalizarDataBr(pf) || pf;
    if (pfNorm !== target) return;
    out.push({
      codCliente: reg.codCliente,
      proc: reg.proc,
      cliente: reg.cliente,
      parteCliente: reg.parteCliente,
      parteOposta: reg.parteOposta,
      numeroProcessoNovo: reg.numeroProcessoNovo,
      prazoFatal: pfNorm,
    });
  });
  out.sort((a, b) => {
    const ka = `${a.codCliente}-${String(a.proc).padStart(4, '0')}`;
    const kb = `${b.codCliente}-${String(b.proc).padStart(4, '0')}`;
    return ka.localeCompare(kb);
  });
  return out;
}

/**
 * Processos com data de audiência informada (formulário Processos) em **hoje ou no futuro** (horário local).
 * Datas passadas ou inválidas não entram — use a tela Processos para limpar ou alterar a data.
 */
export function listarAudienciasPendentes() {
  const out = [];
  const current = loadStore();
  const agora = new Date();
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();

  Object.values(current).forEach((rawReg) => {
    const reg = normalizarRegistroProcesso(rawReg);
    if (!reg) return;
    const audRaw = String(reg.audienciaData ?? '').trim();
    if (!audRaw) return;
    const parsed = parseDataBrCompleta(audRaw);
    if (!parsed) return;
    const inicioAud = new Date(parsed.yyyy, parsed.mm - 1, parsed.dd).getTime();
    if (inicioAud < inicioHoje) return;

    out.push({
      codCliente: reg.codCliente,
      proc: reg.proc,
      cliente: reg.cliente,
      parteCliente: reg.parteCliente,
      parteOposta: reg.parteOposta,
      numeroProcessoNovo: reg.numeroProcessoNovo,
      audienciaData: dataBr(parsed),
      audienciaHora: String(reg.audienciaHora ?? '').trim(),
      audienciaTipo: String(reg.audienciaTipo ?? '').trim(),
      avisoAudiencia: String(reg.avisoAudiencia ?? '').trim(),
    });
  });

  out.sort((a, b) => {
    const pa = parseDataBrCompleta(a.audienciaData);
    const pb = parseDataBrCompleta(b.audienciaData);
    const ta = pa ? new Date(pa.yyyy, pa.mm - 1, pa.dd).getTime() : 0;
    const tb = pb ? new Date(pb.yyyy, pb.mm - 1, pb.dd).getTime() : 0;
    if (ta !== tb) return ta - tb;
    const ha = String(a.audienciaHora ?? '');
    const hb = String(b.audienciaHora ?? '');
    if (ha !== hb) return ha.localeCompare(hb);
    const ka = `${a.codCliente}-${String(a.proc).padStart(4, '0')}`;
    const kb = `${b.codCliente}-${String(b.proc).padStart(4, '0')}`;
    return ka.localeCompare(kb);
  });
  return out;
}

/**
 * Mantido por compatibilidade; não grava mais dados de demonstração no navegador.
 */
export function ensureHistoricoDemonstracaoDiagnostico() {
  if (typeof window === 'undefined') return { ok: false, reason: 'no-window' };
  return { ok: true, skipped: true, inseridos: 0, atualizados: 0 };
}

/** Remove a marca de versão do seed antigo (não reinsere dados de demonstração). */
export function reaplicarDemonstracaoDiagnostico() {
  if (typeof window === 'undefined') return { ok: false, reason: 'no-window' };
  try {
    window.localStorage.removeItem(DEMO_SEED_VERSION_KEY);
  } catch {
    /* ignora */
  }
  return ensureHistoricoDemonstracaoDiagnostico();
}
