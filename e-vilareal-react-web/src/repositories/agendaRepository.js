import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';
import {
  getEventosAgendaPersistidosPorData,
  salvarCamposEventoAgendaPersistido,
  excluirEventoAgendaPersistido,
  criarNovoCompromissoAgendaPersistido,
  listarTodosCompromissosAgendaMes,
  ordenarListaEventosAgenda,
  descricaoAudienciaParaAgendaCampos,
  listarDatasOcorrenciasAgendamentoLote,
  agendarLinhasLoteParaUsuarios,
  removerEventosAgendaPorLoteRef,
} from '../data/agendaPersistenciaData.js';
import { montarProcessoRefAgenda } from '../domain/agendaProcessoRef.js';
import { montarOrigemAgendaLote, criarLoteRefAgenda, extrairLoteRefDaOrigem } from '../domain/agendaLoteRef.js';
import {
  listarLotesAgendaRegistry,
  obterLoteAgendaRegistry,
  upsertLoteAgendaRegistry,
  removerLoteAgendaRegistry,
  novoRegistroLoteAgenda,
  textoBaseFromLinhas,
} from '../data/agendaLotesRegistry.js';
import { normalizarProcesso, padCliente } from '../data/processosDadosRelatorio.js';
import { filtrarLinhasAgendaFuturas } from '../utils/agendaLoteSequencia.js';
import { listarColaboradoresHumanos, isColaboradorHumanoAtivo } from './usuariosRepository.js';

function parseBrDate(dateBr) {
  const [dd, mm, yyyy] = String(dateBr).split('/');
  return `${yyyy}-${mm}-${dd}`;
}

function mapApiEventoToFront(e) {
  const data = String(e.dataEvento || '');
  const [yyyy, mm, dd] = data.split('-');
  const processoRef = e.processoRef != null ? String(e.processoRef).trim() : '';
  const origem = e.origem ?? '';
  const loteRef = extrairLoteRefDaOrigem(origem);
  return {
    id: String(e.id),
    usuarioId: String(e.usuarioId),
    usuarioNome: e.usuarioNome ?? '',
    hora: e.horaEvento ? String(e.horaEvento).slice(0, 5) : '',
    descricao: e.descricao ?? '',
    statusCurto: e.statusCurto ?? '',
    origem,
    loteRef,
    processoRef,
    dataBr: `${dd}/${mm}/${yyyy}`,
  };
}

/**
 * Todos os compromissos no intervalo [dataInicio, dataFim] (ISO yyyy-mm-dd), todas as usuárias/os.
 * Usado para sincronizar audiências quando a agenda está só na API.
 */
export async function listarEventosAgendaPeriodoTodosUsuariosApi(dataInicioIso, dataFimIso) {
  if (!featureFlags.useApiAgenda) return [];
  const di = String(dataInicioIso ?? '').trim();
  const df = String(dataFimIso ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(di) || !/^\d{4}-\d{2}-\d{2}$/.test(df)) return [];
  const data = await request('/api/agenda/eventos', {
    query: { dataInicio: di, dataFim: df, todosUsuarios: 'true' },
  });
  return Array.isArray(data) ? data : [];
}

export async function listarEventosPorDataUsuario(dataBr, usuarioId) {
  const dataIso = parseBrDate(dataBr);
  if (!featureFlags.useApiAgenda) {
    const todos = getEventosAgendaPersistidosPorData(dataBr).filter(Boolean);
    return ordenarListaEventosAgenda(
      todos.filter((ev) => {
        if (ev.usuarioId == null || String(ev.usuarioId) === '') return true;
        return String(ev.usuarioId) === String(usuarioId);
      })
    );
  }
  const idNum = Number(usuarioId);
  if (!Number.isFinite(idNum) || idNum < 1) return [];
  const data = await request('/api/agenda/eventos', {
    query: { usuarioId: idNum, dataInicio: dataIso, dataFim: dataIso },
  });
  return Array.isArray(data) ? data.map(mapApiEventoToFront) : [];
}

export async function salvarCamposEvento(dataBr, evento, patch) {
  if (!featureFlags.useApiAgenda) {
    salvarCamposEventoAgendaPersistido({ dataBr, evento, patch });
    return;
  }
  const idNum = Number(evento?.id);
  const userNum = Number(evento?.usuarioId);
  if (!Number.isFinite(userNum) || userNum < 1) return;
  const [dd, mm, yyyy] = String(dataBr).split('/');
  const refRaw = patch?.processoRef ?? evento?.processoRef;
  const processoRef =
    refRaw != null && String(refRaw).trim() !== '' ? String(refRaw).trim().slice(0, 120) : null;
  const body = {
    usuarioId: userNum,
    dataEvento: `${yyyy}-${mm}-${dd}`,
    horaEvento: String(patch?.hora ?? evento?.hora ?? '').trim() || null,
    descricao: String(patch?.descricao ?? evento?.descricao ?? '').trim() || 'Compromisso',
    statusCurto: String(patch?.statusCurto ?? evento?.statusCurto ?? '').trim() || null,
    processoRef,
    origem: String(patch?.origem ?? evento?.origem ?? 'frontend-agenda'),
  };
  if (Number.isFinite(idNum) && idNum > 0) {
    await request(`/api/agenda/eventos/${idNum}`, { method: 'PUT', body });
    return { ok: true, id: String(idNum) };
  }
  const created = await request('/api/agenda/eventos', { method: 'POST', body });
  const mapped = created && typeof created === 'object' ? mapApiEventoToFront(created) : null;
  return { ok: true, id: mapped?.id ?? null, evento: mapped };
}

/**
 * Elimina o compromisso (API ou localStorage).
 * No modo API usa só o id numérico do evento.
 */
export async function excluirEvento(dataBr, evento) {
  if (!featureFlags.useApiAgenda) {
    return excluirEventoAgendaPersistido({ dataBr, evento });
  }
  const idNum = Number(evento?.id);
  if (!Number.isFinite(idNum) || idNum < 1) return { ok: false, reason: 'id-invalido' };
  await request(`/api/agenda/eventos/${idNum}`, { method: 'DELETE' });
  dispararAgendaAtualizada();
  return { ok: true };
}

export async function criarEvento(dataBr, usuarioId, patch) {
  if (!featureFlags.useApiAgenda) {
    return criarNovoCompromissoAgendaPersistido({ dataBr, usuarioId, patch });
  }
  const r = await salvarCamposEvento(
    dataBr,
    { id: null, usuarioId, hora: '', descricao: '', statusCurto: '', origem: 'frontend-agenda' },
    patch
  );
  if (!r?.id) return { ok: false, reason: 'sem-id' };
  return { ok: true, id: r.id, evento: r.evento ?? null };
}

/** Modal «Agenda mensal»: mesma forma que `listarTodosCompromissosAgendaMes` no modo local. */
export async function listarAgendaMensal(ano, mes, usuarioId) {
  if (!featureFlags.useApiAgenda) {
    return listarTodosCompromissosAgendaMes({ ano, mes, usuarioId });
  }
  const idNum = Number(usuarioId);
  if (!Number.isFinite(idNum) || idNum < 1) {
    return {
      ano: Number(ano),
      mes: Number(mes),
      usuarioId: String(usuarioId ?? ''),
      todosUsuarios: false,
      diasComEventos: [],
    };
  }
  return request('/api/agenda/eventos/mensal', {
    query: { usuarioId: idNum, ano: Number(ano), mes: Number(mes) },
  });
}

function dispararAgendaAtualizada() {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('vilareal:agenda-persistencia-atualizada'));
  } catch {
    /* ignore */
  }
}

/**
 * Replica audiência de processo para todos os colaboradores com id numérico (API usuários).
 * Ignora usuários só locais (id não numérico) quando `useApiUsuarios` estiver desligado.
 */
export async function replicarAudienciaProcessoTodosColaboradoresApi({
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
  if (!featureFlags.useApiAgenda) return { ok: false, reason: 'api-off' };
  const [dd, mm, yyyy] = String(audienciaData || '').split('/');
  if (!dd || !mm || !yyyy || dd.length !== 2 || mm.length !== 2 || yyyy.length !== 4) {
    return { ok: false, reason: 'data-invalida' };
  }
  const dataEvento = `${yyyy}-${mm}-${dd}`;
  const horaEv = String(audienciaHora ?? '')
    .trim()
    .slice(0, 5);
  const descricao = descricaoAudienciaParaAgendaCampos({
    audienciaTipo,
    numeroProcessoNovo,
    parteCliente,
    parteOposta,
    competencia,
  });
  const codPad = padCliente(codigoCliente ?? '1');
  const procNorm = Math.max(1, Math.floor(Number(normalizarProcesso(numeroInterno ?? 1))));
  const processoRef = montarProcessoRefAgenda(codPad, procNorm) || null;

  let lista = [];
  try {
    lista = await listarColaboradoresHumanos();
  } catch {
    return { ok: false, reason: 'usuarios-falha' };
  }
  const ativos = (Array.isArray(lista) ? lista : []).filter((u) => u && isColaboradorHumanoAtivo(u));
  let sincronizados = 0;
  for (const u of ativos) {
    const idNum = Number(u.id);
    if (!Number.isFinite(idNum) || idNum < 1) continue;
    try {
      await request('/api/agenda/eventos/upsert-audiencia', {
        method: 'PUT',
        body: {
          usuarioId: idNum,
          dataEvento,
          horaEvento: horaEv || null,
          descricao,
          statusCurto: null,
          processoRef,
          origem: 'processos-audiencia',
        },
      });
      sincronizados += 1;
    } catch {
      /* continua demais usuários */
    }
  }
  dispararAgendaAtualizada();
  return { ok: true, criados: sincronizados, sincronizados };
}

/**
 * Remove da API os compromissos de audiência vinculados a um processo
 * (quando a data de audiência é apagada no formulário Processos).
 */
export async function removerAudienciaProcessoAgendaApi({ codigoCliente, numeroInterno }) {
  if (!featureFlags.useApiAgenda) return { ok: false, reason: 'api-off' };
  const codPad = padCliente(codigoCliente ?? '1');
  const procNorm = Math.max(1, Math.floor(Number(normalizarProcesso(numeroInterno ?? 1))));
  const processoRef = montarProcessoRefAgenda(codPad, procNorm);
  if (!processoRef) return { ok: false, reason: 'processo-ref-invalido' };
  try {
    await request('/api/agenda/eventos/por-processo', {
      method: 'DELETE',
      query: { processoRef, origem: 'processos-audiencia' },
    });
  } catch {
    return { ok: false, reason: 'delete-falha' };
  }
  dispararAgendaAtualizada();
  return { ok: true };
}

/** Espelha audiência do processo na agenda via API (fonte canônica: processo.audiencia_*). */
export async function sincronizarAudienciaProcessoAgendaApi(processoId) {
  if (!featureFlags.useApiAgenda) return { ok: false, reason: 'api-off' };
  const id = Number(processoId);
  if (!Number.isFinite(id) || id < 1) return { ok: false, reason: 'processo-id-invalido' };
  try {
    const data = await request(`/api/agenda/eventos/sincronizar-audiencia-processo/${id}`, { method: 'POST' });
    dispararAgendaAtualizada();
    return { ok: true, ...(data && typeof data === 'object' ? data : {}) };
  } catch {
    return { ok: false, reason: 'sync-falha' };
  }
}

/** Backfill: espelha audiências dos processos na agenda (todos ou intervalo). */
export async function backfillAudienciasProcessosAgendaApi({ dataInicio = null, dataFim = null, todos = false } = {}) {
  if (!featureFlags.useApiAgenda) return { ok: false, reason: 'api-off' };
  const q = { todos: todos ? 'true' : 'false' };
  if (dataInicio) q.dataInicio = String(dataInicio).slice(0, 10);
  if (dataFim) q.dataFim = String(dataFim).slice(0, 10);
  try {
    const data = await request('/api/agenda/eventos/sincronizar-audiencias-processos', {
      method: 'POST',
      query: q,
    });
    dispararAgendaAtualizada();
    return { ok: true, ...(data && typeof data === 'object' ? data : {}) };
  } catch {
    return { ok: false, reason: 'backfill-falha' };
  }
}

/**
 * Agenda em lote (texto + recorrência) replicada na API para todos os colaboradores com id numérico.
 */
export async function replicarCompromissoLoteTodosColaboradoresApi({
  textoCompromisso,
  dataBaseBr,
  hora,
  periodicidade,
  diaDoMes = null,
  ajustarParaDiaUtil = true,
  codigoCliente = null,
  numeroInterno = null,
  origem = 'processos-agenda-lote',
}) {
  if (!featureFlags.useApiAgenda) return { ok: false, reason: 'api-off' };
  const descricao = String(textoCompromisso ?? '').trim();
  if (!descricao) return { ok: false, reason: 'descricao-vazia' };

  const datas = listarDatasOcorrenciasAgendamentoLote({
    dataBaseBr,
    periodicidade,
    diaDoMes,
    ajustarParaDiaUtil,
  });
  if (datas.length === 0) return { ok: false, reason: 'sem-ocorrencias' };

  const temProcesso =
    codigoCliente != null &&
    numeroInterno != null &&
    String(codigoCliente).trim() !== '' &&
    String(numeroInterno).trim() !== '';
  let processoRef = null;
  if (temProcesso) {
    const codPad = padCliente(codigoCliente);
    const procNorm = Math.max(1, Math.floor(Number(normalizarProcesso(numeroInterno))));
    processoRef = montarProcessoRefAgenda(codPad, procNorm) || null;
  }
  const horaEv = String(hora ?? '')
    .trim()
    .slice(0, 5);

  let lista = [];
  try {
    lista = await listarColaboradoresHumanos();
  } catch {
    return { ok: false, reason: 'usuarios-falha' };
  }
  const ativos = (Array.isArray(lista) ? lista : []).filter((u) => u && isColaboradorHumanoAtivo(u));

  let criados = 0;
  for (const dataKey of datas) {
    const parts = String(dataKey).split('/');
    if (parts.length !== 3) continue;
    const [dd, mm, yyyy] = parts;
    if (!dd || !mm || !yyyy) continue;
    const dataEvento = `${yyyy}-${mm}-${dd}`;
    for (const u of ativos) {
      const idNum = Number(u.id);
      if (!Number.isFinite(idNum) || idNum < 1) continue;
      try {
        await request('/api/agenda/eventos', {
          method: 'POST',
          body: {
            usuarioId: idNum,
            dataEvento,
            horaEvento: horaEv || null,
            descricao,
            statusCurto: null,
            processoRef,
            origem,
          },
        });
        criados += 1;
      } catch {
        /* próximo */
      }
    }
  }
  dispararAgendaAtualizada();
  return { ok: true, criados, ocorrencias: datas.length, usuarios: ativos.length };
}

/**
 * Salva linhas explícitas do modal «Agendar em Lote» para colaboradores selecionados.
 */
export async function salvarAgendamentoLoteLinhas({
  linhas = [],
  usuarioIds = [],
  codigoCliente = null,
  numeroInterno = null,
  loteRef = null,
  textoBase = '',
  horaPadrao = '',
  substituirLoteExistente = false,
}) {
  const linhasValidas = (Array.isArray(linhas) ? linhas : [])
    .map((l) => ({
      dataBr: String(l?.dataBr ?? '').trim(),
      hora: String(l?.hora ?? '').trim().slice(0, 5),
      informacao: String(l?.informacao ?? '').trim(),
    }))
    .filter((l) => l.dataBr && l.informacao);

  if (linhasValidas.length === 0) return { ok: false, reason: 'sem-linhas' };

  const ids = (Array.isArray(usuarioIds) ? usuarioIds : [])
    .map((id) => Number(id))
    .filter((n) => Number.isFinite(n) && n >= 1);
  if (ids.length === 0) return { ok: false, reason: 'usuarios-vazios' };

  const loteId = String(loteRef ?? '').trim() || criarLoteRefAgenda();
  let linhasParaGravar = linhasValidas;
  if (substituirLoteExistente && loteRef) {
    await cancelarLoteAgenda(loteId, { manterRegistro: true });
    linhasParaGravar = filtrarLinhasAgendaFuturas(linhasValidas);
    if (linhasParaGravar.length === 0) return { ok: false, reason: 'sem-linhas-futuras' };
  }

  const temProcesso =
    codigoCliente != null &&
    numeroInterno != null &&
    String(codigoCliente).trim() !== '' &&
    String(numeroInterno).trim() !== '';
  let processoRef = null;
  if (temProcesso) {
    const codPad = padCliente(codigoCliente);
    const procNorm = Math.max(1, Math.floor(Number(normalizarProcesso(numeroInterno))));
    processoRef = montarProcessoRefAgenda(codPad, procNorm) || null;
  }
  const origem = montarOrigemAgendaLote(loteId);

  if (!featureFlags.useApiAgenda) {
    return { ok: false, reason: 'api-off' };
  }

  const eventosCriados = [];
  let criados = 0;
  for (const linha of linhasParaGravar) {
    const parts = String(linha.dataBr).split('/');
    if (parts.length !== 3) continue;
    const [dd, mm, yyyy] = parts;
    if (!dd || !mm || !yyyy) continue;
    const dataEvento = `${yyyy}-${mm}-${dd}`;
    for (const idNum of ids) {
      try {
        const resp = await request('/api/agenda/eventos', {
          method: 'POST',
          body: {
            usuarioId: idNum,
            dataEvento,
            horaEvento: linha.hora || null,
            descricao: linha.informacao,
            statusCurto: null,
            processoRef,
            origem,
          },
        });
        criados += 1;
        if (resp?.id) {
          eventosCriados.push({
            id: String(resp.id),
            usuarioId: String(idNum),
            dataBr: linha.dataBr,
          });
        }
      } catch {
        /* próximo */
      }
    }
  }

  upsertLoteAgendaRegistry(
    novoRegistroLoteAgenda({
      loteRef: loteId,
      textoBase: String(textoBase ?? '').trim() || textoBaseFromLinhas(linhasParaGravar),
      horaPadrao: String(horaPadrao ?? '').trim(),
      processo: temProcesso ? { codigoCliente, numeroInterno } : null,
      usuarioIds: ids.map(String),
      linhas: linhasParaGravar,
      eventos: eventosCriados,
    })
  );

  dispararAgendaAtualizada();
  return { ok: true, loteRef: loteId, criados, ocorrencias: linhasParaGravar.length, usuarios: ids.length, eventos: eventosCriados };
}

export async function listarLotesAgendaApi() {
  if (!featureFlags.useApiAgenda) return [];
  try {
    const data = await request('/api/agenda/lotes');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function obterLoteAgendaApi(loteRef) {
  const id = String(loteRef ?? '').trim();
  if (!id) return null;
  if (!featureFlags.useApiAgenda) return null;
  try {
    return await request(`/api/agenda/lotes/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

export async function listarLotesAgenda() {
  if (featureFlags.useApiAgenda) {
    const api = await listarLotesAgendaApi();
    if (api.length > 0) return api;
  }
  return listarLotesAgendaRegistry().map((l) => ({
    loteRef: l.loteRef,
    textoBase: l.textoBase || textoBaseFromLinhas(l.linhas),
    primeiraData: l.linhas?.[0]?.dataBr?.split('/')?.reverse()?.join('-') ?? null,
    ultimaData: l.linhas?.[l.linhas.length - 1]?.dataBr?.split('/')?.reverse()?.join('-') ?? null,
    qtdLinhas: (l.linhas || []).filter((x) => x?.dataBr).length,
    qtdEventos: (l.eventos || []).length,
    usuarioIds: (l.usuarioIds || []).map(Number).filter((n) => Number.isFinite(n)),
  }));
}

export async function obterLoteAgenda(loteRef) {
  const id = String(loteRef ?? '').trim();
  if (!id) return null;
  if (featureFlags.useApiAgenda) {
    const api = await obterLoteAgendaApi(id);
    if (api) return api;
  }
  const reg = obterLoteAgendaRegistry(id);
  if (!reg) return null;
  return {
    loteRef: reg.loteRef,
    textoBase: reg.textoBase,
    horaPadrao: reg.horaPadrao,
    processoRef: null,
    usuarioIds: (reg.usuarioIds || []).map(Number).filter((n) => Number.isFinite(n)),
    linhas: reg.linhas || [],
    eventos: reg.eventos || [],
    processo: reg.processo || null,
  };
}

export async function cancelarLoteAgenda(loteRef, { manterRegistro = false } = {}) {
  const id = String(loteRef ?? '').trim();
  if (!id) return { ok: false, reason: 'lote-ref-vazio' };

  if (featureFlags.useApiAgenda) {
    try {
      const resp = await request(`/api/agenda/lotes/${encodeURIComponent(id)}/contagem`, { method: 'DELETE' });
      if (!manterRegistro) {
        const aindaExiste = await obterLoteAgendaApi(id);
        if (!aindaExiste) removerLoteAgendaRegistry(id);
      }
      dispararAgendaAtualizada();
      return { ok: true, removidos: Number(resp?.removidos ?? 0) };
    } catch {
      return { ok: false, reason: 'api-falha' };
    }
  }

  const r = removerEventosAgendaPorLoteRef(id, { apenasFuturos: true });
  if (!manterRegistro && (r.restantes ?? 0) === 0) removerLoteAgendaRegistry(id);
  dispararAgendaAtualizada();
  return { ok: r.ok, removidos: r.removidos ?? 0, restantes: r.restantes ?? 0 };
}

export async function salvarAgendamentoLoteLinhasLocal({
  linhas = [],
  usuarios = [],
  processoId = '',
  clienteId = '',
  numeroProcessoNovo = '',
  loteRef = null,
  textoBase = '',
  horaPadrao = '',
  substituirLoteExistente = false,
}) {
  const loteId = String(loteRef ?? '').trim() || criarLoteRefAgenda();
  let linhasParaGravar = Array.isArray(linhas) ? linhas : [];
  if (substituirLoteExistente && loteRef) {
    await cancelarLoteAgenda(loteId, { manterRegistro: true });
    linhasParaGravar = filtrarLinhasAgendaFuturas(linhasParaGravar);
    if (linhasParaGravar.length === 0) return { ok: false, reason: 'sem-linhas-futuras' };
  }
  const resultado = agendarLinhasLoteParaUsuarios({
    linhas: linhasParaGravar,
    usuarios,
    processoId,
    clienteId,
    numeroProcessoNovo,
    loteRef: loteId,
  });
  if (!resultado?.ok) return resultado;
  upsertLoteAgendaRegistry(
    novoRegistroLoteAgenda({
      loteRef: loteId,
      textoBase: String(textoBase ?? '').trim() || textoBaseFromLinhas(linhasParaGravar),
      horaPadrao: String(horaPadrao ?? '').trim(),
      processo:
        String(clienteId ?? '').trim() && String(processoId ?? '').trim()
          ? { codigoCliente: clienteId, numeroInterno: processoId }
          : null,
      usuarioIds: (usuarios || []).map((u) => String(u.id)),
      linhas: linhasParaGravar,
      eventos: resultado.eventos || [],
    })
  );
  dispararAgendaAtualizada();
  return { ...resultado, loteRef: loteId };
}
