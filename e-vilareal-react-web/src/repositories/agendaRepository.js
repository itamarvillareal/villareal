import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';
import {
  getEventosAgendaPersistidosPorData,
  salvarCamposEventoAgendaPersistido,
  criarNovoCompromissoAgendaPersistido,
} from '../data/agendaPersistenciaData.js';

function parseBrDate(dateBr) {
  const [dd, mm, yyyy] = String(dateBr).split('/');
  return `${yyyy}-${mm}-${dd}`;
}

function mapApiEventoToFront(e) {
  const data = String(e.dataEvento || '');
  const [yyyy, mm, dd] = data.split('-');
  return {
    id: String(e.id),
    usuarioId: String(e.usuarioId),
    usuarioNome: e.usuarioNome ?? '',
    hora: e.horaEvento ? String(e.horaEvento).slice(0, 5) : '',
    descricao: e.descricao ?? '',
    statusCurto: e.statusCurto ?? '',
    origem: e.origem ?? '',
    dataBr: `${dd}/${mm}/${yyyy}`,
  };
}

export async function listarEventosPorDataUsuario(dataBr, usuarioId) {
  if (!featureFlags.useApiAgenda) return getEventosAgendaPersistidosPorData(dataBr);
  const idNum = Number(usuarioId);
  if (!Number.isFinite(idNum) || idNum < 1) return [];
  const dataIso = parseBrDate(dataBr);
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
  const body = {
    usuarioId: userNum,
    dataEvento: `${yyyy}-${mm}-${dd}`,
    horaEvento: String(patch?.hora ?? evento?.hora ?? '').trim() || null,
    descricao: String(patch?.descricao ?? evento?.descricao ?? '').trim() || 'Compromisso',
    statusCurto: String(patch?.statusCurto ?? evento?.statusCurto ?? '').trim() || null,
    processoRef: null,
    origem: String(evento?.origem ?? 'frontend-agenda'),
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
