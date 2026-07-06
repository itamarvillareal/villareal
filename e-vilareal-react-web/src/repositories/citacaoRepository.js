import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';

function requireCitacaoApi() {
  if (!featureFlags.useApiCitacao) {
    throw new Error('Ative VITE_USE_API_CITACAO para usar o painel de citação.');
  }
}

export async function carregarPainelCitacaoReu(processoId, processoParteId) {
  requireCitacaoApi();
  const pid = Number(processoId);
  const ppid = Number(processoParteId);
  if (!Number.isFinite(pid) || pid < 1 || !Number.isFinite(ppid) || ppid < 1) {
    throw new Error('Processo ou parte inválidos.');
  }
  return request(`/api/processos/${pid}/citacao/rea/${ppid}`);
}

export async function solicitarCitacao(processoId, body) {
  requireCitacaoApi();
  return request(`/api/processos/${Number(processoId)}/citacao/solicitar`, {
    method: 'POST',
    body,
  });
}

export async function registrarRetornoCitacao(processoId, body) {
  requireCitacaoApi();
  return request(`/api/processos/${Number(processoId)}/citacao/registrar-retorno`, {
    method: 'POST',
    body,
  });
}

export async function registrarPositivoCitacao(processoId, body) {
  requireCitacaoApi();
  return request(`/api/processos/${Number(processoId)}/citacao/registrar-positivo`, {
    method: 'POST',
    body,
  });
}

export async function excluirTentativaCitacao(processoId, tentativaId) {
  requireCitacaoApi();
  return request(`/api/processos/${Number(processoId)}/citacao/${Number(tentativaId)}`, {
    method: 'DELETE',
  });
}
