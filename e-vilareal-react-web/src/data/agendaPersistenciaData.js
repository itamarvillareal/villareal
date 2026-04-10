import { agendaUsuarios as agendaUsuariosBase, getMockEventosAgendaPorData } from './mockData';
import { featureFlags } from '../config/featureFlags.js';
import { lerSnapshotUsuariosApi } from '../services/syncApiUsuariosSnapshot.js';
import { montarProcessoRefAgenda } from '../domain/agendaProcessoRef.js';
import { montarDescricaoAgendaAudienciaProcesso } from '../domain/descricaoAgendaAudiencia.js';
import { normalizarProcesso, padCliente } from './processosDadosRelatorio.js';
import { getNomeExibicaoUsuario } from './usuarioDisplayHelpers.js';

const STORAGE_KEY_EVENTOS_LEGACY = 'vilareal:agenda-eventos:v1';
const STORAGE_KEY = 'vilareal:agenda-eventos:v2';
const STORAGE_USUARIOS_KEY = 'vilareal:agenda-usuarios:v1';
const STORAGE_USUARIOS_KEY_V2 = 'vilareal:agenda-usuarios:v2';
/** Nova base: seed alinhado à agenda mock + slotAgendaId; substitui v1/v2 na primeira carga. */
const STORAGE_USUARIOS_KEY_V3 = 'vilareal:agenda-usuarios:v3';

/** kari/isabelia/ana → ids unificados com Board / agendaUsuarios. */
const LEGACY_USUARIO_ID_AGENDA_MOCK = {
  kari: 'karla',
  isabelia: 'isabella',
  ana: 'thalita',
};

const FLAG_EVENTOS_USUARIO_ID_REMAPEADO = 'vilareal:agenda-eventos:ids-remap-legado:v1';
const FLAG_MIGRA_PERMS_PENDENCIAS_LEGADO = 'vilareal:legacy-ids-mock-agenda:v2';

let __migracaoPermPendenciasAgendada = false;

function enriquecerNomeComCadastroPessoa(u) {
  if (!u) return u;
  return { ...u };
}

/**
 * @param {object} u
 * @returns {{ id: string, nome: string, numeroPessoa: number|null, apelido: string, login: string, senhaHash: string, slotAgendaId?: string } | null}
 */
function normalizarUsuarioPersistido(u) {
  const id = u?.id != null ? String(u.id).trim() : '';
  const nome = (u?.nome != null ? String(u.nome) : '').trim();
  if (!id || !nome) return null;
  let numeroPessoa = null;
  if (u.numeroPessoa != null && u.numeroPessoa !== '') {
    const n = Number(u.numeroPessoa);
    if (Number.isFinite(n)) numeroPessoa = n;
  }
  let slotAgendaId = '';
  if (u?.slotAgendaId != null && String(u.slotAgendaId).trim() !== '') {
    slotAgendaId = String(u.slotAgendaId).trim();
  }
  const out = {
    id,
    nome,
    numeroPessoa,
    apelido: u.apelido != null ? String(u.apelido).trim() : '',
    login: u.login != null ? String(u.login).trim().toLowerCase() : '',
    senhaHash: u.senhaHash != null ? String(u.senhaHash) : '',
  };
  if (slotAgendaId) out.slotAgendaId = slotAgendaId;
  return out;
}

function validarUsuariosLista(usuarios) {
  const logins = new Map();
  const pessoas = new Map();
  const slots = new Map();
  for (const u of usuarios) {
    const login = String(u.login || '').trim().toLowerCase();
    if (login) {
      if (logins.has(login) && String(logins.get(login)) !== String(u.id)) {
        return { ok: false, error: `Login "${login}" já está em uso por outro usuário.` };
      }
      logins.set(login, u.id);
    }
    const np = u.numeroPessoa;
    if (np != null && Number.isFinite(Number(np))) {
      const n = Number(np);
      if (pessoas.has(n) && String(pessoas.get(n)) !== String(u.id)) {
        return { ok: false, error: `O nº de pessoa ${n} já está vinculado a outro usuário do sistema.` };
      }
      pessoas.set(n, u.id);
    }
    const slot = u.slotAgendaId != null ? String(u.slotAgendaId).trim() : '';
    if (slot) {
      if (slots.has(slot) && String(slots.get(slot)) !== String(u.id)) {
        return { ok: false, error: `Mais de um usuário na mesma coluna da agenda (${slot}).` };
      }
      slots.set(slot, u.id);
    }
  }
  return { ok: true };
}

/** @returns {boolean} */
function saveUsuariosAtivosInterno(usuarios) {
  try {
    window.localStorage.setItem(STORAGE_USUARIOS_KEY_V3, JSON.stringify(usuarios));
    try {
      window.localStorage.removeItem(STORAGE_USUARIOS_KEY_V2);
    } catch {
      /* ignore */
    }
    try {
      window.localStorage.removeItem(STORAGE_USUARIOS_KEY);
    } catch {
      /* ignore */
    }
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('vilareal:usuarios-agenda-atualizados'));
      } catch {
        // ignora
      }
    }
    return true;
  } catch {
    return false;
  }
}

function apenasDigitos(v) {
  return String(v ?? '').replace(/\D/g, '');
}

function parseDataBrCompleta(str) {
  const s = String(str ?? '').trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
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

function dataStr({ dd, mm, yyyy }) {
  return `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yyyy}`;
}

function parsedToDate(parsed) {
  return new Date(parsed.yyyy, parsed.mm - 1, parsed.dd);
}

function dateToParsed(dateObj) {
  return {
    dd: dateObj.getDate(),
    mm: dateObj.getMonth() + 1,
    yyyy: dateObj.getFullYear(),
  };
}

function calcularPascoa(ano) {
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

function getFeriadosNacionais(ano) {
  const fixos = new Set([
    `01/01/${ano}`,
    `21/04/${ano}`,
    `01/05/${ano}`,
    `07/09/${ano}`,
    `12/10/${ano}`,
    `02/11/${ano}`,
    `15/11/${ano}`,
    `25/12/${ano}`,
  ]);
  const pascoa = calcularPascoa(ano);
  const sextaSanta = new Date(pascoa.getFullYear(), pascoa.getMonth(), pascoa.getDate() - 2);
  const carnavalSeg = new Date(pascoa.getFullYear(), pascoa.getMonth(), pascoa.getDate() - 48);
  const carnavalTer = new Date(pascoa.getFullYear(), pascoa.getMonth(), pascoa.getDate() - 47);
  const corpusChristi = new Date(pascoa.getFullYear(), pascoa.getMonth(), pascoa.getDate() + 60);
  const moveis = [sextaSanta, carnavalSeg, carnavalTer, corpusChristi].map((d) => dataStr(dateToParsed(d)));
  return { fixos, moveis: new Set(moveis) };
}

function normalizarEntradaData(dataInput) {
  if (dataInput instanceof Date) {
    return new Date(dataInput.getFullYear(), dataInput.getMonth(), dataInput.getDate());
  }
  if (typeof dataInput === 'string') {
    const parsed = parseDataBrCompleta(dataInput);
    if (!parsed) return null;
    return parsedToDate(parsed);
  }
  if (dataInput && typeof dataInput === 'object') {
    const parsed = {
      dd: Number(dataInput.dd),
      mm: Number(dataInput.mm),
      yyyy: Number(dataInput.yyyy),
    };
    if (!Number.isFinite(parsed.dd) || !Number.isFinite(parsed.mm) || !Number.isFinite(parsed.yyyy)) return null;
    if (parsed.mm < 1 || parsed.mm > 12) return null;
    const maxDia = new Date(parsed.yyyy, parsed.mm, 0).getDate();
    if (parsed.dd < 1 || parsed.dd > maxDia) return null;
    return parsedToDate(parsed);
  }
  return null;
}

export function isDiaUtil(dataInput) {
  const dateObj = normalizarEntradaData(dataInput);
  if (!dateObj) return false;
  const dow = dateObj.getDay();
  if (dow === 0 || dow === 6) return false;
  const ano = dateObj.getFullYear();
  const { fixos, moveis } = getFeriadosNacionais(ano);
  const key = dataStr(dateToParsed(dateObj));
  return !fixos.has(key) && !moveis.has(key);
}

export function ajustarParaProximoDiaUtil(dataInput) {
  const dateObj = normalizarEntradaData(dataInput);
  if (!dateObj) return null;
  const out = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  while (!isDiaUtil(out)) {
    out.setDate(out.getDate() + 1);
  }
  return out;
}

function normalizarHora(valor) {
  const digits = apenasDigitos(valor);
  if (!digits) return '';
  const d = digits.slice(0, 4);
  if (d.length <= 2) {
    const hh = Number(String(d).padStart(2, '0'));
    if (!Number.isFinite(hh) || hh < 0 || hh > 23) return '';
    return `${String(hh).padStart(2, '0')}:00`;
  }
  const hh = Number(d.slice(0, 2));
  const mm = Number(d.slice(2, 4));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return '';
  if (hh < 0 || hh > 23) return '';
  if (mm < 0 || mm > 59) return '';
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function remapUsuarioIdEventoAgendaMock(uid) {
  const s = String(uid ?? '').trim();
  return LEGACY_USUARIO_ID_AGENDA_MOCK[s] ?? s;
}

function aplicarRemapUsuarioIdsNoObjetoStore(store) {
  const out = {};
  for (const [data, lista] of Object.entries(store)) {
    if (!Array.isArray(lista)) continue;
    out[data] = lista.map((ev) =>
      ev && typeof ev === 'object'
        ? { ...ev, usuarioId: remapUsuarioIdEventoAgendaMock(ev.usuarioId) }
        : ev
    );
  }
  return out;
}

/** Copia v1 → v2 (se v2 ainda não existir) e remove v1. */
function ensureAgendaEventosMigradosParaV2() {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage.getItem(STORAGE_KEY)) return;
    const rawLeg = window.localStorage.getItem(STORAGE_KEY_EVENTOS_LEGACY);
    if (!rawLeg) return;
    const parsed = JSON.parse(rawLeg);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    const remapped = aplicarRemapUsuarioIdsNoObjetoStore(parsed);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(remapped));
    window.localStorage.removeItem(STORAGE_KEY_EVENTOS_LEGACY);
  } catch {
    /* ignore */
  }
}

/** Uma vez: ajusta usuarioId dentro do store v2 (dados já em v2 com ids antigos). */
function ensureUsuarioIdsRemapadosNoStoreV2() {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(FLAG_EVENTOS_USUARIO_ID_REMAPEADO) === '1') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(FLAG_EVENTOS_USUARIO_ID_REMAPEADO, '1');
      return;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      window.localStorage.setItem(FLAG_EVENTOS_USUARIO_ID_REMAPEADO, '1');
      return;
    }
    const next = aplicarRemapUsuarioIdsNoObjetoStore(parsed);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.localStorage.setItem(FLAG_EVENTOS_USUARIO_ID_REMAPEADO, '1');
  } catch {
    /* ignore */
  }
}

function agendarMigracaoPermissoesPendenciasIdsLegados() {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(FLAG_MIGRA_PERMS_PENDENCIAS_LEGADO) === '1') return;
  if (__migracaoPermPendenciasAgendada) return;
  __migracaoPermPendenciasAgendada = true;
  queueMicrotask(() => {
    import('../services/migrarUsuarioIdLocal.js')
      .then(({ migrarUsuarioIdLocal }) => {
        if (window.localStorage.getItem(FLAG_MIGRA_PERMS_PENDENCIAS_LEGADO) === '1') return;
        for (const [antigo, novo] of Object.entries(LEGACY_USUARIO_ID_AGENDA_MOCK)) {
          migrarUsuarioIdLocal(antigo, novo);
        }
        window.localStorage.setItem(FLAG_MIGRA_PERMS_PENDENCIAS_LEGADO, '1');
      })
      .catch(() => {});
  });
}

function loadStore() {
  ensureAgendaEventosMigradosParaV2();
  ensureUsuarioIdsRemapadosNoStoreV2();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveStore(store) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    try {
      window.dispatchEvent(new CustomEvent('vilareal:agenda-persistencia-atualizada'));
    } catch {
      /* ignore */
    }
  } catch {
    // ignora
  }
}

/**
 * Copia todos os compromissos persistidos vinculados a `origemUsuarioId` para `destinoUsuarioId`
 * (novas entradas com novos ids), em todas as datas do armazenamento.
 * @returns {{ ok: boolean, clonados?: number, reason?: string }}
 */
export function clonarAgendaEntreUsuarios({ origemUsuarioId, destinoUsuarioId }) {
  const origem = String(origemUsuarioId ?? '').trim();
  const destino = String(destinoUsuarioId ?? '').trim();
  if (!origem || !destino) return { ok: false, reason: 'ids-vazios' };
  if (origem === destino) return { ok: false, reason: 'origem-igual-destino' };

  const store = loadStore();
  const datas = Object.keys(store);
  if (datas.length === 0) return { ok: true, clonados: 0 };

  let clonados = 0;
  const baseStamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  for (const data of datas) {
    const lista = Array.isArray(store[data]) ? [...store[data]] : [];
    const candidatos = lista.filter((ev) => ev && String(ev.usuarioId ?? '').trim() === origem);
    if (candidatos.length === 0) continue;

    for (let i = 0; i < candidatos.length; i++) {
      const ev = candidatos[i];
      const novoId = `clone-${destino}-${baseStamp}-${clonados}-${i}`;
      const clone = {
        ...ev,
        id: novoId,
        usuarioId: destino,
        criadoEm: new Date().toISOString(),
      };
      lista.push(clone);
      clonados += 1;
    }
    store[data] = ordenarListaEventosAgenda(lista);
  }

  if (clonados > 0) {
    saveStore(store);
  }
  return { ok: true, clonados };
}

/**
 * Atualiza `usuarioId` nos compromissos já persistidos (mesmo evento, novo id de usuário).
 * @returns {{ ok: true, alterados: number }}
 */
export function substituirUsuarioIdNaAgendaPersistida(antigoUsuarioId, novoUsuarioId) {
  const antigo = String(antigoUsuarioId ?? '').trim();
  const novo = String(novoUsuarioId ?? '').trim();
  if (!antigo || !novo || antigo === novo) return { ok: true, alterados: 0 };
  const store = loadStore();
  let alterados = 0;
  for (const data of Object.keys(store)) {
    const lista = Array.isArray(store[data]) ? store[data] : [];
    let mudou = false;
    const next = lista.map((ev) => {
      if (!ev || String(ev.usuarioId ?? '').trim() !== antigo) return ev;
      alterados += 1;
      mudou = true;
      return { ...ev, usuarioId: novo };
    });
    if (mudou) store[data] = ordenarListaEventosAgenda(next);
  }
  if (alterados > 0) saveStore(store);
  return { ok: true, alterados };
}

function keyEvento({ data, hora, usuarioId, numeroProcessoNovo, codClientePad, procNum }) {
  const cod = String(codClientePad ?? '').trim();
  const p =
    procNum != null && Number.isFinite(Number(procNum)) && Number(procNum) >= 1
      ? String(Math.floor(Number(procNum)))
      : '';
  const num = String(numeroProcessoNovo ?? '').trim();
  return `aud-${data}-${hora || ''}-${cod}|${p}|${num}-${usuarioId || ''}`.replace(/\s+/g, ' ').trim();
}

function normalizarDescricao({ audienciaTipo, numeroProcessoNovo }) {
  const t = String(audienciaTipo ?? '').trim();
  const num = String(numeroProcessoNovo ?? '').trim();
  if (!t && !num) return 'Audiência';
  if (t && num) return `${t} — Proc. ${num}`;
  return t || num || 'Audiência';
}

/** Texto do compromisso na Agenda alinhado ao formulário Processos (audiência). */
export function descricaoAudienciaParaAgendaCampos(campos) {
  return montarDescricaoAgendaAudienciaProcesso({
    audienciaTipo: campos?.audienciaTipo,
    numeroProcessoNovo: campos?.numeroProcessoNovo,
    parteCliente: campos?.parteCliente,
    parteOposta: campos?.parteOposta,
    competencia: campos?.competencia,
  });
}

function parsePeriodicidade(periodicidadeRaw, diaDoMesRaw) {
  const p = String(periodicidadeRaw ?? '').trim().toLowerCase();
  if (!p || p === 'agendamento único' || p === 'agendamento unico' || p === 'unico' || p === 'único') {
    return { tipo: 'unico' };
  }
  if (p === 'diariamente' || p === 'diario' || p === 'diária' || p === 'diaria') return { tipo: 'dias', passo: 1 };
  if (p === 'semanalmente' || p === 'semanal') return { tipo: 'dias', passo: 7 };
  if (p === 'quinzenalmente' || p === 'quinzenal') return { tipo: 'dias', passo: 15 };
  if (p === 'mensalmente' || p === 'mensal') return { tipo: 'meses', passo: 1 };
  if (p === 'bimestralmente' || p === 'bimestral') return { tipo: 'meses', passo: 2 };
  if (p === 'trimestralmente' || p === 'trimestral') return { tipo: 'meses', passo: 3 };
  if (p === 'semestralmente' || p === 'semestral') return { tipo: 'meses', passo: 6 };
  if (p.includes('todo dia')) {
    const diaDoMesNum = Number(diaDoMesRaw);
    const diaDoMes =
      Number.isFinite(diaDoMesNum) && Number.isInteger(diaDoMesNum) && diaDoMesNum >= 1 && diaDoMesNum <= 31
        ? diaDoMesNum
        : null;
    return { tipo: 'meses', passo: 1, fixarDiaMes: true, diaDoMes };
  }
  return { tipo: 'unico' };
}

function addDias(parsed, dias) {
  const dt = new Date(parsed.yyyy, parsed.mm - 1, parsed.dd);
  dt.setDate(dt.getDate() + dias);
  return { dd: dt.getDate(), mm: dt.getMonth() + 1, yyyy: dt.getFullYear() };
}

function addMesesPreservandoDia(parsed, meses, fixarDia = false, diaDoMes = null) {
  const baseDia = Number.isFinite(Number(diaDoMes)) ? Number(diaDoMes) : parsed.dd;
  const dt = new Date(parsed.yyyy, parsed.mm - 1, 1);
  dt.setMonth(dt.getMonth() + meses);
  const maxDia = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  const dia = fixarDia ? Math.min(baseDia, maxDia) : Math.min(parsed.dd, maxDia);
  return { dd: dia, mm: dt.getMonth() + 1, yyyy: dt.getFullYear() };
}

function gerarOcorrencias({ dataBaseBr, periodicidade, diaDoMes = null, ajustarParaDiaUtil = true }) {
  const parsed = parseDataBrCompleta(dataBaseBr);
  if (!parsed) return [];
  const regra = parsePeriodicidade(periodicidade, diaDoMes);
  const dataBaseOriginal = parsedToDate(parsed);
  const dataBaseAjustada = ajustarParaDiaUtil ? ajustarParaProximoDiaUtil(dataBaseOriginal) : dataBaseOriginal;
  if (!dataBaseAjustada) return [];
  if (regra.tipo === 'unico') return [dataStr(dateToParsed(dataBaseAjustada))];

  if (regra.fixarDiaMes && !regra.diaDoMes) return [];

  const out = [];
  const limite = regra.tipo === 'dias' ? 60 : 24; // horizonte suficiente para uso prático
  for (let i = 0; i < limite; i++) {
    let dataParsed = parsed;
    if (i > 0) {
      if (regra.tipo === 'dias') dataParsed = addDias(parsed, regra.passo * i);
      if (regra.tipo === 'meses') {
        dataParsed = addMesesPreservandoDia(
          parsed,
          regra.passo * i,
          !!regra.fixarDiaMes,
          regra.diaDoMes
        );
      }
    }
    const dataAjustada = ajustarParaDiaUtil ? ajustarParaProximoDiaUtil(parsedToDate(dataParsed)) : parsedToDate(dataParsed);
    if (!dataAjustada) continue;
    out.push(dataStr(dateToParsed(dataAjustada)));
  }
  return out;
}

export function calcularPrimeiraOcorrenciaAgendaLote({
  dataBaseBr,
  periodicidade,
  diaDoMes = null,
  ajustarParaDiaUtil = true,
}) {
  const ocorrencias = gerarOcorrencias({
    dataBaseBr,
    periodicidade,
    diaDoMes,
    ajustarParaDiaUtil,
  });
  return ocorrencias[0] || '';
}

/** Datas `yyyy-mm-dd` (chaves do store) para materializar agendamento em lote — reutilizado pelo modo API. */
export function listarDatasOcorrenciasAgendamentoLote({
  dataBaseBr,
  periodicidade,
  diaDoMes = null,
  ajustarParaDiaUtil = true,
}) {
  const parsedBase = parseDataBrCompleta(dataBaseBr);
  if (!parsedBase) return [];
  const regraPeriodicidade = parsePeriodicidade(periodicidade, diaDoMes);
  if (regraPeriodicidade.fixarDiaMes && !regraPeriodicidade.diaDoMes) return [];
  return gerarOcorrencias({
    dataBaseBr,
    periodicidade,
    diaDoMes: regraPeriodicidade.diaDoMes,
    ajustarParaDiaUtil,
  });
}

/**
 * Salva na agenda (localStorage) um evento para todos os usuários,
 * quando o usuário preencher a Data da Audiência em Processos.
 */
export function agendarAudienciaParaTodosUsuarios({
  audienciaData,
  audienciaHora,
  audienciaTipo,
  numeroProcessoNovo,
  codigoCliente,
  numeroInterno,
  parteCliente,
  parteOposta,
  competencia,
}) {
  const parsedData = parseDataBrCompleta(audienciaData);
  if (!parsedData) return { ok: false, reason: 'data-invalida' };
  const data = dataStr(parsedData);
  const hora = normalizarHora(audienciaHora);
  const descricao = montarDescricaoAgendaAudienciaProcesso({
    audienciaTipo,
    numeroProcessoNovo,
    parteCliente,
    parteOposta,
    competencia,
  });
  const codPad = padCliente(codigoCliente ?? '1');
  const procNorm = Math.max(1, Math.floor(Number(normalizarProcesso(numeroInterno ?? 1))));
  const processoRef = montarProcessoRefAgenda(codPad, procNorm);

  const store = loadStore();
  const lista = Array.isArray(store[data]) ? store[data] : [];

  let inseridos = 0;
  let atualizados = 0;

  const usuarios = getUsuariosAtivos();
  const criadoIso = new Date().toISOString();
  const novos = usuarios.map((u) => {
    const usuarioId = u?.id ? String(u.id) : '';
    return {
      id: keyEvento({
        data,
        hora,
        usuarioId,
        numeroProcessoNovo,
        codClientePad: codPad,
        procNum: procNorm,
      }),
      usuarioId,
      hora,
      descricao,
      statusCurto: '',
      status: 'Agendado',
      criadoEm: criadoIso,
      origem: 'processos-audiencia',
      codCliente: codPad,
      proc: procNorm,
      clienteId: codPad,
      processoId: String(procNorm),
      processoRef,
    };
  });

  const byId = new Map(lista.map((ev) => [ev.id, ev]));
  for (const ev of novos) {
    const prev = byId.get(ev.id);
    if (prev) {
      byId.set(ev.id, { ...prev, ...ev, criadoEm: prev.criadoEm || ev.criadoEm });
      atualizados += 1;
    } else {
      byId.set(ev.id, ev);
      inseridos += 1;
    }
  }

  store[data] = ordenarListaEventosAgenda(Array.from(byId.values()));
  saveStore(store);
  return { ok: true, inseridos, atualizados };
}

/** Coluna Status da Agenda: apenas vazio ou "OK". Qualquer outro valor vira em branco. */
export function normalizarStatusCurtoAgenda(valor) {
  const t = String(valor ?? '').trim();
  if (!t) return '';
  if (t.toUpperCase() === 'OK') return 'OK';
  return '';
}

/** Ordem de criação estável para empate (sem hora ou mesma hora). */
function chaveOrdemCriacao(ev) {
  const c = ev?.criadoEm;
  if (c != null && String(c).trim() !== '') return String(c);
  const id = ev?.id;
  if (id != null && id !== '') {
    const n = Number(id);
    if (Number.isFinite(n)) return String(n).padStart(16, '0');
    return String(id);
  }
  return '';
}

/**
 * Ordem de exibição: primeiro status OK; depois demais. Em cada grupo: por hora;
 * sem hora: por ordem de criação (criadoEm ou id).
 */
export function ordenarListaEventosAgenda(lista) {
  if (!Array.isArray(lista)) return [];
  return [...lista].sort((a, b) => {
    const okA = normalizarStatusCurtoAgenda(a?.statusCurto) === 'OK' ? 0 : 1;
    const okB = normalizarStatusCurtoAgenda(b?.statusCurto) === 'OK' ? 0 : 1;
    if (okA !== okB) return okA - okB;

    const ha = String(a?.hora ?? '').trim();
    const hb = String(b?.hora ?? '').trim();
    if (ha && !hb) return -1;
    if (!ha && hb) return 1;
    if (ha && hb) {
      const cmp = ha.localeCompare(hb);
      if (cmp !== 0) return cmp;
    }
    return chaveOrdemCriacao(a).localeCompare(chaveOrdemCriacao(b), undefined, { numeric: true });
  });
}

export function getEventosAgendaPersistidosPorData(dataBr) {
  const parsedData = parseDataBrCompleta(dataBr);
  if (!parsedData) return [];
  const data = dataStr(parsedData);
  const store = loadStore();
  const lista = store[data];
  if (!Array.isArray(lista)) return [];
  return lista;
}

/**
 * @param {number} mes 1–12
 * @param {number} ano ex. 2026
 * @returns {Array<[string, object[]]>} pares [dataBr, eventos]
 */
export function listarEntradasAgendaPorMesAnoPersistida(mes, ano) {
  const m = Number(mes);
  const y = Number(ano);
  if (!Number.isFinite(m) || m < 1 || m > 12 || !Number.isFinite(y)) return [];
  const store = loadStore();
  const mm = String(m).padStart(2, '0');
  const out = [];
  for (const dataBr of Object.keys(store)) {
    const p = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataBr);
    if (!p) continue;
    if (p[2] !== mm || Number(p[3]) !== y) continue;
    out.push([dataBr, Array.isArray(store[dataBr]) ? store[dataBr] : []]);
  }
  out.sort((a, b) => a[0].localeCompare(b[0]));
  return out;
}

/**
 * Todas as datas com compromissos na agenda persistida (localStorage), ordenadas.
 * @returns {Array<[string, object[]]>} pares [dataBr, eventos]
 */
export function listarTodasEntradasAgendaPersistida() {
  if (typeof window === 'undefined') return [];
  const store = loadStore();
  const out = [];
  for (const dataBr of Object.keys(store)) {
    if (!/^(\d{2})\/(\d{2})\/(\d{4})$/.test(dataBr)) continue;
    out.push([dataBr, Array.isArray(store[dataBr]) ? store[dataBr] : []]);
  }
  out.sort((a, b) => a[0].localeCompare(b[0]));
  return out;
}

/**
 * Lista todos os dias do mês que têm compromissos (mock + persistido), para um usuário da agenda.
 * Mesma regra de merge da tela Agenda (por data).
 */
export function listarTodosCompromissosAgendaMes({ ano, mes, usuarioId }) {
  const y = Number(ano);
  const m = Number(mes);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    const uidBad = usuarioId != null ? String(usuarioId) : '';
    return {
      ano: y,
      mes: m,
      usuarioId: uidBad,
      todosUsuarios: false,
      diasComEventos: [],
    };
  }
  const uid = usuarioId != null ? String(usuarioId) : '';
  const maxDia = new Date(y, m, 0).getDate();
  const diasComEventos = [];

  for (let d = 1; d <= maxDia; d++) {
    const dataBr = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    const base = getMockEventosAgendaPorData(dataBr);
    const persisted = getEventosAgendaPersistidosPorData(dataBr).filter((ev) => {
      if (!ev) return false;
      if (ev.usuarioId == null || String(ev.usuarioId) === '') return true;
      return String(ev.usuarioId) === uid;
    });

    const merged = new Map();
    for (const ev of base) {
      merged.set(String(ev.id), { ...ev, statusCurto: normalizarStatusCurtoAgenda(ev.statusCurto) });
    }
    for (const ev of persisted) {
      const key = String(ev.id);
      const prev = merged.get(key) || {};
      merged.set(key, {
        ...prev,
        ...ev,
        statusCurto: normalizarStatusCurtoAgenda(ev.statusCurto ?? prev.statusCurto ?? ''),
      });
    }
    const lista = ordenarListaEventosAgenda(Array.from(merged.values()));
    if (lista.length > 0) diasComEventos.push({ dataBr, eventos: lista });
  }

  return { ano: y, mes: m, usuarioId: uid, todosUsuarios: false, diasComEventos };
}

export function salvarStatusCurtoEventoPersistido({ dataBr, evento, statusCurto }) {
  const parsedData = parseDataBrCompleta(dataBr);
  if (!parsedData) return { ok: false, reason: 'data-invalida' };
  const data = dataStr(parsedData);

  const store = loadStore();
  const lista = Array.isArray(store[data]) ? store[data] : [];

  const eventoId = evento?.id != null ? String(evento.id) : '';
  const usuarioId = evento?.usuarioId != null ? String(evento.usuarioId) : '';
  const novoStatus = normalizarStatusCurtoAgenda(statusCurto);

  if (!eventoId) return { ok: false, reason: 'evento-id-invalido' };

  const idx = lista.findIndex((ev) => {
    const idA = ev?.id != null ? String(ev.id) : '';
    const uidA = ev?.usuarioId != null ? String(ev.usuarioId) : '';
    return idA === eventoId && uidA === usuarioId;
  });

  if (idx >= 0) {
    lista[idx] = { ...lista[idx], statusCurto: novoStatus };
  } else {
    const novoEvento = {
      ...(evento || {}),
      id: eventoId,
      usuarioId,
      statusCurto: novoStatus,
      criadoEm: (evento || {}).criadoEm || new Date().toISOString(),
    };
    lista.push(novoEvento);
  }

  store[data] = ordenarListaEventosAgenda(lista);
  saveStore(store);
  return { ok: true };
}

/**
 * Atualiza hora, descrição e/ou status (statusCurto) de um compromisso na agenda persistida.
 * Para eventos que existem só no mock (sem registro no storage), cria entrada mesclada ao mock.
 */
export function salvarCamposEventoAgendaPersistido({ dataBr, evento, patch }) {
  const parsedData = parseDataBrCompleta(dataBr);
  if (!parsedData) return { ok: false, reason: 'data-invalida' };
  const data = dataStr(parsedData);
  if (!patch || typeof patch !== 'object') return { ok: false, reason: 'patch-invalido' };

  const store = loadStore();
  const lista = Array.isArray(store[data]) ? store[data] : [];

  const eventoId = evento?.id != null ? String(evento.id) : '';
  const usuarioIdEv = evento?.usuarioId != null ? String(evento.usuarioId) : '';
  if (!eventoId) return { ok: false, reason: 'evento-id-invalido' };

  const idx = lista.findIndex((ev) => {
    const idA = ev?.id != null ? String(ev.id) : '';
    const uidA = ev?.usuarioId != null ? String(ev.usuarioId) : '';
    return idA === eventoId && uidA === usuarioIdEv;
  });

  const base = idx >= 0 ? { ...lista[idx] } : { ...(evento || {}), id: eventoId, usuarioId: usuarioIdEv };

  if (patch.hora !== undefined) base.hora = normalizarHora(patch.hora);
  if (patch.descricao !== undefined) base.descricao = String(patch.descricao ?? '');
  if (patch.statusCurto !== undefined) base.statusCurto = normalizarStatusCurtoAgenda(patch.statusCurto);
  if (patch.status !== undefined) base.status = String(patch.status ?? '').trim();
  if (patch.destaque !== undefined) base.destaque = !!patch.destaque;
  if (patch.processoRef !== undefined) {
    const pr = String(patch.processoRef ?? '').trim();
    base.processoRef = pr ? pr.slice(0, 120) : '';
  }
  if (patch.codCliente !== undefined && String(patch.codCliente).trim() !== '') {
    base.codCliente = padCliente(patch.codCliente);
    base.clienteId = base.codCliente;
  }
  if (patch.proc !== undefined && Number.isFinite(Number(patch.proc)) && Number(patch.proc) >= 1) {
    const pn = Math.floor(Number(patch.proc));
    base.proc = pn;
    base.processoId = String(pn);
  }

  if (idx >= 0) {
    lista[idx] = base;
  } else {
    if (!base.criadoEm) base.criadoEm = new Date().toISOString();
    lista.push(base);
  }

  store[data] = ordenarListaEventosAgenda(lista);
  saveStore(store);
  return { ok: true };
}

/**
 * Cria um compromisso novo na data (linha vazia da grade), vinculado ao usuário da agenda.
 */
export function criarNovoCompromissoAgendaPersistido({ dataBr, usuarioId, patch }) {
  const parsedData = parseDataBrCompleta(dataBr);
  if (!parsedData) return { ok: false, reason: 'data-invalida' };
  const data = dataStr(parsedData);
  if (!patch || typeof patch !== 'object') return { ok: false, reason: 'patch-invalido' };

  const horaRaw = patch.hora !== undefined ? normalizarHora(patch.hora) : '';
  const descricao = patch.descricao !== undefined ? String(patch.descricao ?? '') : '';
  const statusCurto =
    patch.statusCurto !== undefined ? normalizarStatusCurtoAgenda(patch.statusCurto) : '';

  const temHora = String(horaRaw ?? '').trim() !== '';
  const temDesc = String(descricao ?? '').trim() !== '';
  const temStatus = statusCurto === 'OK';
  if (!temHora && !temDesc && !temStatus) {
    return { ok: false, reason: 'vazio' };
  }

  const uid = usuarioId != null ? String(usuarioId) : '';
  const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const criadoIso = new Date().toISOString();
  const ev = {
    id,
    usuarioId: uid,
    hora: horaRaw,
    descricao,
    statusCurto,
    status: patch.status !== undefined ? String(patch.status ?? '').trim() : '',
    criadoEm: criadoIso,
  };

  const store = loadStore();
  const lista = Array.isArray(store[data]) ? store[data] : [];
  lista.push(ev);
  store[data] = ordenarListaEventosAgenda(lista);
  saveStore(store);
  return { ok: true, id, evento: ev };
}

/**
 * Agenda em lote para múltiplos usuários com suporte a recorrência.
 * Os registros são materializados no storage em cada data de ocorrência.
 */
export function agendarEmLoteParaUsuarios({
  textoCompromisso,
  dataBaseBr,
  hora,
  periodicidade,
  diaDoMes = null,
  ajustarParaDiaUtil = true,
  usuarios = [],
  processoId = '',
  clienteId = '',
  numeroProcessoNovo = '',
}) {
  const descricao = String(textoCompromisso ?? '').trim();
  if (!descricao) return { ok: false, reason: 'descricao-vazia' };
  const parsedBase = parseDataBrCompleta(dataBaseBr);
  if (!parsedBase) return { ok: false, reason: 'data-invalida' };

  const horaNorm = normalizarHora(hora);
  const regraPeriodicidade = parsePeriodicidade(periodicidade, diaDoMes);
  if (regraPeriodicidade.fixarDiaMes && !regraPeriodicidade.diaDoMes) {
    return { ok: false, reason: 'dia-do-mes-invalido' };
  }
  const ocorrencias = listarDatasOcorrenciasAgendamentoLote({
    dataBaseBr,
    periodicidade,
    diaDoMes,
    ajustarParaDiaUtil,
  });
  if (ocorrencias.length === 0) return { ok: false, reason: 'sem-ocorrencias' };

  const codPadLote = padCliente(clienteId || '1');
  const procLoteNum = Number(String(processoId ?? '').replace(/\D/g, ''));
  const procLote = Number.isFinite(procLoteNum) && procLoteNum >= 1 ? Math.floor(procLoteNum) : 0;
  const processoRefLote = procLote >= 1 ? montarProcessoRefAgenda(codPadLote, procLote) : '';

  const usuariosValidos = (Array.isArray(usuarios) ? usuarios : [])
    .map((u) => ({ id: String(u?.id ?? '').trim(), u }))
    .filter((x) => x.id && x.u);
  if (usuariosValidos.length === 0) return { ok: false, reason: 'usuarios-vazios' };

  const store = loadStore();
  let inseridos = 0;
  let atualizados = 0;

  for (const data of ocorrencias) {
    const lista = Array.isArray(store[data]) ? store[data] : [];
    const byId = new Map(lista.map((ev) => [String(ev?.id ?? ''), ev]));

    for (const { id: uid, u } of usuariosValidos) {
      const id = `lote-${data}-${horaNorm || ''}-${uid}-${numeroProcessoNovo || ''}-${descricao}`.replace(/\s+/g, ' ').trim();
      const evento = {
        id,
        usuarioId: uid,
        usuarioNome: getNomeExibicaoUsuario(u),
        hora: horaNorm,
        descricao,
        titulo: descricao,
        statusCurto: '',
        status: 'Agendado',
        origem: 'agenda-em-lote',
        periodicidade: String(periodicidade ?? 'Agendamento único'),
        recorrente: String(periodicidade ?? '').trim().toLowerCase() !== 'agendamento único',
        ajustarParaDiaUtil: !!ajustarParaDiaUtil,
        recorrenciaRegra: regraPeriodicidade.fixarDiaMes
          ? {
              periodicidade: 'todo_dia_x_do_mes',
              diaDoMes: regraPeriodicidade.diaDoMes,
              ajustarParaDiaUtil: !!ajustarParaDiaUtil,
            }
          : null,
        dataBase: dataStr(parsedBase),
        processoId: String(processoId ?? ''),
        clienteId: String(clienteId ?? ''),
        codCliente: codPadLote,
        proc: procLote >= 1 ? procLote : undefined,
        processoRef: processoRefLote,
        numeroProcessoNovo: String(numeroProcessoNovo ?? ''),
        criadoEm: new Date().toISOString(),
      };

      const prev = byId.get(id);
      if (prev) {
        byId.set(id, { ...prev, ...evento, criadoEm: prev.criadoEm || evento.criadoEm });
        atualizados += 1;
      } else {
        byId.set(id, evento);
        inseridos += 1;
      }
    }

    store[data] = ordenarListaEventosAgenda(Array.from(byId.values()));
  }

  saveStore(store);
  return { ok: true, inseridos, atualizados, ocorrencias: ocorrencias.length, usuarios: usuariosValidos.length };
}

function semearUsuariosAgendaAlinhadoMock() {
  const base = Array.isArray(agendaUsuariosBase) ? agendaUsuariosBase : [];
  return base
    .map((ag) =>
      normalizarUsuarioPersistido({
        id: String(ag.id),
        nome: String(ag.nome ?? '').trim() || String(ag.id),
        numeroPessoa: null,
        apelido: '',
        login: '',
        senhaHash: '',
        slotAgendaId: String(ag.id),
      })
    )
    .filter(Boolean);
}

function loadUsuariosAtivos() {
  try {
    const raw3 = window.localStorage.getItem(STORAGE_USUARIOS_KEY_V3);
    if (raw3) {
      const parsed = JSON.parse(raw3);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizarUsuarioPersistido).filter(Boolean);
      }
    }
    try {
      window.localStorage.removeItem(STORAGE_USUARIOS_KEY_V2);
    } catch {
      /* ignore */
    }
    try {
      window.localStorage.removeItem(STORAGE_USUARIOS_KEY);
    } catch {
      /* ignore */
    }
    const seed = semearUsuariosAgendaAlinhadoMock();
    if (seed.length) saveUsuariosAtivosInterno(seed);
    return seed.length ? seed : null;
  } catch {
    return null;
  }
}

function usuarioComCamposPadrao(u) {
  const n = normalizarUsuarioPersistido({
    id: u.id,
    nome: u.nome,
    numeroPessoa: u.numeroPessoa,
    apelido: u.apelido,
    login: u.login,
    senhaHash: u.senhaHash,
    slotAgendaId: u.slotAgendaId,
  });
  return n;
}

/** Id só dígitos (ex.: API) — não recebe inferência de coluna da agenda mock. */
function idUsuarioSoDigitos(id) {
  return /^\d+$/.test(String(id ?? '').trim());
}

/**
 * Liga usuário com id alterado (ex.: KARKAR) à coluna fixa da agenda (ex.: karla) quando há um único órfão e slot livre.
 */
function aplicarInferenciaSlotAgenda(usuarios) {
  const base = Array.isArray(agendaUsuariosBase) ? agendaUsuariosBase : [];
  if (!usuarios?.length || !base.length) return usuarios;
  const baseIds = new Set(base.map((a) => String(a.id)));
  const used = new Set();
  for (const u of usuarios) {
    const s = u.slotAgendaId != null ? String(u.slotAgendaId).trim() : '';
    if (s) used.add(s);
    if (baseIds.has(String(u.id))) used.add(String(u.id));
  }
  const candidatos = usuarios.filter((u) => {
    const idStr = String(u.id ?? '').trim();
    if (!idStr) return false;
    if (u.slotAgendaId != null && String(u.slotAgendaId).trim() !== '') return false;
    if (baseIds.has(idStr)) return false;
    if (idUsuarioSoDigitos(idStr)) return false;
    return true;
  });
  if (candidatos.length !== 1) return usuarios;
  const livre = base.find((ag) => !used.has(String(ag.id)));
  if (!livre) return usuarios;
  const alvoId = String(candidatos[0].id);
  return usuarios.map((u) =>
    String(u.id) === alvoId ? { ...u, slotAgendaId: String(livre.id) } : u
  );
}

/** Registro mínimo a partir da lista base (Agenda / mock). */
export function criarUsuarioRegistroMinimo(ag) {
  return normalizarUsuarioPersistido({
    id: ag.id,
    nome: ag.nome,
    numeroPessoa: null,
    apelido: '',
    login: '',
    senhaHash: '',
    slotAgendaId: String(ag.id),
  });
}

export function getUsuariosAtivos() {
  if (featureFlags.useApiUsuarios) {
    const snap = lerSnapshotUsuariosApi();
    if (Array.isArray(snap) && snap.length > 0) {
      const out = snap
        .map((u) => enriquecerNomeComCadastroPessoa(usuarioComCamposPadrao(u)))
        .filter(Boolean);
      agendarMigracaoPermissoesPendenciasIdsLegados();
      return out;
    }
  }
  const fromStore = loadUsuariosAtivos();
  const base = Array.isArray(agendaUsuariosBase) ? agendaUsuariosBase : [];
  const lista = fromStore && fromStore.length > 0 ? fromStore : base;
  const basePrimeiro = base[0];
  let merged = lista;
  if (basePrimeiro && Array.isArray(lista) && !lista.some((u) => String(u?.id || '') === String(basePrimeiro.id))) {
    merged = [basePrimeiro, ...lista];
  }
  let out = merged
    .map((u) => enriquecerNomeComCadastroPessoa(usuarioComCamposPadrao(u)))
    .filter(Boolean);
  if (!featureFlags.useApiUsuarios) {
    out = aplicarInferenciaSlotAgenda(out);
  }
  agendarMigracaoPermissoesPendenciasIdsLegados();
  return out;
}

/**
 * @returns {{ ok: boolean, error?: string }}
 */
export function setUsuariosAtivos(usuarios) {
  if (!Array.isArray(usuarios)) return { ok: false, error: 'Lista inválida.' };
  const filtrados = usuarios.map(normalizarUsuarioPersistido).filter(Boolean);
  if (filtrados.length === 0) return { ok: false, error: 'Nenhum usuário válido.' };
  let valid = validarUsuariosLista(filtrados);
  if (!valid.ok) return valid;

  const base = Array.isArray(agendaUsuariosBase) ? agendaUsuariosBase : [];
  const basePrimeiro = base[0];
  const jaTemBasePrimeiro =
    basePrimeiro && filtrados.some((u) => String(u.id) === String(basePrimeiro.id));
  if (basePrimeiro && !jaTemBasePrimeiro) {
    const min = criarUsuarioRegistroMinimo(basePrimeiro);
    const comBase = [min, ...filtrados].filter(Boolean);
    valid = validarUsuariosLista(comBase);
    if (!valid.ok) return valid;
    if (!saveUsuariosAtivosInterno(comBase)) {
      return { ok: false, error: 'Não foi possível gravar os usuários (armazenamento do navegador).' };
    }
    return { ok: true };
  }

  if (!saveUsuariosAtivosInterno(filtrados)) {
    return { ok: false, error: 'Não foi possível gravar os usuários (armazenamento do navegador).' };
  }
  return { ok: true };
}

