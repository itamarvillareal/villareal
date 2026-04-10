import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';
import {
  getEventosAgendaPersistidosPorData,
  salvarCamposEventoAgendaPersistido,
  criarNovoCompromissoAgendaPersistido,
  listarTodosCompromissosAgendaMes,
  ordenarListaEventosAgenda,
  descricaoAudienciaParaAgendaCampos,
  listarDatasOcorrenciasAgendamentoLote,
} from '../data/agendaPersistenciaData.js';
import { montarProcessoRefAgenda } from '../domain/agendaProcessoRef.js';
import { normalizarProcesso, padCliente } from '../data/processosDadosRelatorio.js';
import { listarUsuarios } from './usuariosRepository.js';

function parseBrDate(dateBr) {
  const [dd, mm, yyyy] = String(dateBr).split('/');
  return `${yyyy}-${mm}-${dd}`;
}

function mapApiEventoToFront(e) {
  const data = String(e.dataEvento || '');
  const [yyyy, mm, dd] = data.split('-');
  const processoRef = e.processoRef != null ? String(e.processoRef).trim() : '';
  return {
    id: String(e.id),
    usuarioId: String(e.usuarioId),
    usuarioNome: e.usuarioNome ?? '',
    hora: e.horaEvento ? String(e.horaEvento).slice(0, 5) : '',
    descricao: e.descricao ?? '',
    statusCurto: e.statusCurto ?? '',
    origem: e.origem ?? '',
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
    return;
  }
  await request('/api/agenda/eventos', { method: 'POST', body });
}

export async function criarEvento(dataBr, usuarioId, patch) {
  if (!featureFlags.useApiAgenda) {
    return criarNovoCompromissoAgendaPersistido({ dataBr, usuarioId, patch });
  }
  await salvarCamposEvento(
    dataBr,
    { id: null, usuarioId, hora: '', descricao: '', statusCurto: '', origem: 'frontend-agenda' },
    patch
  );
  return { ok: true };
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
    lista = await listarUsuarios();
  } catch {
    return { ok: false, reason: 'usuarios-falha' };
  }
  const ativos = (Array.isArray(lista) ? lista : []).filter((u) => u && u.ativo !== false);
  let criados = 0;
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
          origem: 'processos-audiencia',
        },
      });
      criados += 1;
    } catch {
      /* continua demais usuários */
    }
  }
  dispararAgendaAtualizada();
  return { ok: true, criados };
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
  codigoCliente,
  numeroInterno,
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

  const codPad = padCliente(codigoCliente ?? '1');
  const procNorm = Math.max(1, Math.floor(Number(normalizarProcesso(numeroInterno ?? 1))));
  const processoRef = montarProcessoRefAgenda(codPad, procNorm) || null;
  const horaEv = String(hora ?? '')
    .trim()
    .slice(0, 5);

  let lista = [];
  try {
    lista = await listarUsuarios();
  } catch {
    return { ok: false, reason: 'usuarios-falha' };
  }
  const ativos = (Array.isArray(lista) ? lista : []).filter((u) => u && u.ativo !== false);

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
            origem: 'processos-agenda-lote',
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
