import { agendaUsuarios as agendaUsuariosBase, getMockEventosAgendaPorData } from './mockData';
import { getPessoaPorId } from './cadastroPessoasMock.js';

const STORAGE_KEY = 'vilareal:agenda-eventos:v1';
const STORAGE_USUARIOS_KEY = 'vilareal:agenda-usuarios:v1';
/** Inclui vínculo a Pessoas, apelido, login e hash de senha. */
const STORAGE_USUARIOS_KEY_V2 = 'vilareal:agenda-usuarios:v2';

function enriquecerNomeComCadastroPessoa(u) {
  if (!u) return u;
  const num = u.numeroPessoa != null ? Number(u.numeroPessoa) : null;
  if (num == null || !Number.isFinite(num)) return { ...u };
  const p = getPessoaPorId(num);
  if (!p?.nome) return { ...u };
  return { ...u, nome: p.nome };
}

/**
 * @param {object} u
 * @returns {{ id: string, nome: string, numeroPessoa: number|null, apelido: string, login: string, senhaHash: string } | null}
 */
function normalizarUsuarioPersistido(u) {
  const id = u?.id != null ? String(u.id) : '';
  const nome = u?.nome != null ? String(u.nome) : '';
  if (!id || !nome) return null;
  let numeroPessoa = null;
  if (u.numeroPessoa != null && u.numeroPessoa !== '') {
    const n = Number(u.numeroPessoa);
    if (Number.isFinite(n)) numeroPessoa = n;
  }
  return {
    id,
    nome,
    numeroPessoa,
    apelido: u.apelido != null ? String(u.apelido).trim() : '',
    login: u.login != null ? String(u.login).trim().toLowerCase() : '',
    senhaHash: u.senhaHash != null ? String(u.senhaHash) : '',
  };
}

function validarUsuariosLista(usuarios) {
  const logins = new Map();
  const pessoas = new Map();
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
  }
  return { ok: true };
}

function saveUsuariosAtivosInterno(usuarios) {
  try {
    window.localStorage.setItem(STORAGE_USUARIOS_KEY_V2, JSON.stringify(usuarios));
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
  } catch {
    // ignora
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

function parsePeriodicidade(periodicidadeRaw) {
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
  if (p.includes('todo dia')) return { tipo: 'meses', passo: 1, fixarDiaMes: true };
  return { tipo: 'unico' };
}

function addDias(parsed, dias) {
  const dt = new Date(parsed.yyyy, parsed.mm - 1, parsed.dd);
  dt.setDate(dt.getDate() + dias);
  return { dd: dt.getDate(), mm: dt.getMonth() + 1, yyyy: dt.getFullYear() };
}

function addMesesPreservandoDia(parsed, meses, fixarDia = false) {
  const baseDia = parsed.dd;
  const dt = new Date(parsed.yyyy, parsed.mm - 1, 1);
  dt.setMonth(dt.getMonth() + meses);
  const maxDia = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  const dia = fixarDia ? Math.min(baseDia, maxDia) : Math.min(parsed.dd, maxDia);
  return { dd: dia, mm: dt.getMonth() + 1, yyyy: dt.getFullYear() };
}

function gerarOcorrencias({ dataBaseBr, periodicidade }) {
  const parsed = parseDataBrCompleta(dataBaseBr);
  if (!parsed) return [];
  const regra = parsePeriodicidade(periodicidade);
  if (regra.tipo === 'unico') return [dataStr(parsed)];

  const out = [];
  const limite = regra.tipo === 'dias' ? 60 : 24; // horizonte suficiente para uso prático
  for (let i = 0; i < limite; i++) {
    let dataParsed = parsed;
    if (i > 0) {
      if (regra.tipo === 'dias') dataParsed = addDias(parsed, regra.passo * i);
      if (regra.tipo === 'meses') dataParsed = addMesesPreservandoDia(parsed, regra.passo * i, !!regra.fixarDiaMes);
    }
    out.push(dataStr(dataParsed));
  }
  return out;
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
  const criadoIso = new Date().toISOString();
  const novos = usuarios.map((u) => {
    const usuarioId = u?.id ? String(u.id) : '';
    return {
      id: keyEvento({ data, hora, descricao, usuarioId, numeroProcessoNovo }),
      usuarioId,
      hora,
      descricao,
      statusCurto: '',
      status: 'Agendado',
      criadoEm: criadoIso,
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
 * Lista todos os dias do mês que têm compromissos (mock + persistido), para um usuário da agenda.
 * Mesma regra de merge da tela Agenda (por data).
 */
export function listarTodosCompromissosAgendaMes({ ano, mes, usuarioId }) {
  const y = Number(ano);
  const m = Number(mes);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return { ano: y, mes: m, usuarioId: String(usuarioId ?? ''), diasComEventos: [] };
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

  return { ano: y, mes: m, usuarioId: uid, diasComEventos };
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
  const ocorrencias = gerarOcorrencias({ dataBaseBr: dataBaseBr, periodicidade });
  if (ocorrencias.length === 0) return { ok: false, reason: 'sem-ocorrencias' };

  const usuariosValidos = (Array.isArray(usuarios) ? usuarios : [])
    .map((u) => ({ id: String(u?.id ?? '').trim(), nome: String(u?.nome ?? '').trim() }))
    .filter((u) => u.id && u.nome);
  if (usuariosValidos.length === 0) return { ok: false, reason: 'usuarios-vazios' };

  const store = loadStore();
  let inseridos = 0;
  let atualizados = 0;

  for (const data of ocorrencias) {
    const lista = Array.isArray(store[data]) ? store[data] : [];
    const byId = new Map(lista.map((ev) => [String(ev?.id ?? ''), ev]));

    for (const u of usuariosValidos) {
      const id = `lote-${data}-${horaNorm || ''}-${u.id}-${numeroProcessoNovo || ''}-${descricao}`.replace(/\s+/g, ' ').trim();
      const evento = {
        id,
        usuarioId: u.id,
        usuarioNome: u.nome,
        hora: horaNorm,
        descricao,
        titulo: descricao,
        statusCurto: '',
        status: 'Agendado',
        origem: 'agenda-em-lote',
        periodicidade: String(periodicidade ?? 'Agendamento único'),
        recorrente: String(periodicidade ?? '').trim().toLowerCase() !== 'agendamento único',
        dataBase: dataStr(parsedBase),
        processoId: String(processoId ?? ''),
        clienteId: String(clienteId ?? ''),
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

function loadUsuariosAtivos() {
  try {
    const raw2 = window.localStorage.getItem(STORAGE_USUARIOS_KEY_V2);
    if (raw2) {
      const parsed = JSON.parse(raw2);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizarUsuarioPersistido).filter(Boolean);
      }
    }
    const raw = window.localStorage.getItem(STORAGE_USUARIOS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const migrated = parsed
      .map((u) =>
        normalizarUsuarioPersistido({
          id: u.id,
          nome: u.nome,
          numeroPessoa: null,
          apelido: '',
          login: '',
          senhaHash: '',
        })
      )
      .filter(Boolean);
    saveUsuariosAtivosInterno(migrated);
    return migrated;
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
  });
  return n;
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
  });
}

export function getUsuariosAtivos() {
  const fromStore = loadUsuariosAtivos();
  const base = Array.isArray(agendaUsuariosBase) ? agendaUsuariosBase : [];
  const lista = fromStore && fromStore.length > 0 ? fromStore : base;
  const basePrimeiro = base[0];
  let merged = lista;
  if (basePrimeiro && Array.isArray(lista) && !lista.some((u) => String(u?.id || '') === String(basePrimeiro.id))) {
    merged = [basePrimeiro, ...lista];
  }
  return merged
    .map((u) => enriquecerNomeComCadastroPessoa(usuarioComCamposPadrao(u)))
    .filter(Boolean);
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
    saveUsuariosAtivosInterno(comBase);
    return { ok: true };
  }

  saveUsuariosAtivosInterno(filtrados);
  return { ok: true };
}

