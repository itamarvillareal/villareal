import { agendaUsuarios as agendaUsuariosBase } from './mockData';

const STORAGE_KEY = 'vilareal:agenda-eventos:v1';
const STORAGE_USUARIOS_KEY = 'vilareal:agenda-usuarios:v1';

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

function loadStore() {
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
  } catch {
    // ignora
  }
}

function keyEvento({ data, hora, descricao, usuarioId, numeroProcessoNovo }) {
  // id determinístico pra evitar duplicar quando o usuário ajusta campos.
  return `aud-${data}-${hora || ''}-${numeroProcessoNovo || ''}-${usuarioId || ''}-${descricao || ''}`.replace(/\s+/g, ' ').trim();
}

function normalizarDescricao({ audienciaTipo, numeroProcessoNovo }) {
  const t = String(audienciaTipo ?? '').trim();
  const num = String(numeroProcessoNovo ?? '').trim();
  if (!t && !num) return 'Audiência';
  if (t && num) return `${t} — Proc. ${num}`;
  return t || num || 'Audiência';
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
}) {
  const parsedData = parseDataBrCompleta(audienciaData);
  if (!parsedData) return { ok: false, reason: 'data-invalida' };
  const data = dataStr(parsedData);
  const hora = normalizarHora(audienciaHora);
  const descricao = normalizarDescricao({ audienciaTipo, numeroProcessoNovo });

  const store = loadStore();
  const lista = Array.isArray(store[data]) ? store[data] : [];

  let inseridos = 0;
  let atualizados = 0;

  const usuarios = getUsuariosAtivos();
  const novos = usuarios.map((u) => {
    const usuarioId = u?.id ? String(u.id) : '';
    return {
      id: keyEvento({ data, hora, descricao, usuarioId, numeroProcessoNovo }),
      usuarioId,
      hora,
      descricao,
      status: 'Agendado',
    };
  });

  const byId = new Map(lista.map((ev) => [ev.id, ev]));
  for (const ev of novos) {
    const prev = byId.get(ev.id);
    if (prev) {
      byId.set(ev.id, { ...prev, ...ev });
      atualizados += 1;
    } else {
      byId.set(ev.id, ev);
      inseridos += 1;
    }
  }

  const ordenado = Array.from(byId.values()).sort((a, b) => {
    const ha = String(a.hora ?? '');
    const hb = String(b.hora ?? '');
    if (!ha && hb) return 1;
    if (ha && !hb) return -1;
    return ha.localeCompare(hb);
  });

  store[data] = ordenado;
  saveStore(store);
  return { ok: true, inseridos, atualizados };
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

function loadUsuariosAtivos() {
  try {
    const raw = window.localStorage.getItem(STORAGE_USUARIOS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    // valida shape mínima
    const filtrados = parsed
      .map((u) => ({ id: u?.id != null ? String(u.id) : '', nome: u?.nome != null ? String(u.nome) : '' }))
      .filter((u) => u.id && u.nome);
    return filtrados;
  } catch {
    return null;
  }
}

function saveUsuariosAtivos(usuarios) {
  try {
    window.localStorage.setItem(STORAGE_USUARIOS_KEY, JSON.stringify(usuarios));
  } catch {
    // ignora
  }
}

export function getUsuariosAtivos() {
  const fromStore = loadUsuariosAtivos();
  const base = Array.isArray(agendaUsuariosBase) ? agendaUsuariosBase : [];
  const lista = fromStore && fromStore.length > 0 ? fromStore : base;
  const basePrimeiro = base[0];
  if (basePrimeiro && Array.isArray(lista) && !lista.some((u) => String(u?.id || '') === String(basePrimeiro.id))) {
    return [basePrimeiro, ...lista];
  }
  return lista;
}

export function setUsuariosAtivos(usuarios) {
  if (!Array.isArray(usuarios)) return;
  const filtrados = usuarios
    .map((u) => ({ id: u?.id != null ? String(u.id) : '', nome: u?.nome != null ? String(u.nome) : '' }))
    .filter((u) => u.id && u.nome);
  if (filtrados.length === 0) return;

  const base = Array.isArray(agendaUsuariosBase) ? agendaUsuariosBase : [];
  const basePrimeiro = base[0];
  const jaTemBasePrimeiro =
    basePrimeiro && filtrados.some((u) => String(u.id) === String(basePrimeiro.id));
  if (basePrimeiro && !jaTemBasePrimeiro) {
    saveUsuariosAtivos([basePrimeiro, ...filtrados]);
    return;
  }

  saveUsuariosAtivos(filtrados);
}

