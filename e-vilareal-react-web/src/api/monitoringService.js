import { API_BASE_URL } from './config';
import { buildDefaultApiHeaders } from './apiAuthHeaders.js';
import { parseApiJsonResponse } from './parseApiResponse.js';

const BASE = `${API_BASE_URL}/api/monitoring`;

function opts(method, body = null) {
  const o = {
    method,
    headers: buildDefaultApiHeaders(),
  };
  if (body != null) o.body = JSON.stringify(body);
  return o;
}

async function handle(res) {
  if (res.status === 202) return null;
  return parseApiJsonResponse(res);
}

export async function listarMonitorados() {
  const res = await fetch(`${BASE}/people`, opts('GET'));
  return handle(res);
}

export async function listarCandidatosMonitoramento() {
  const res = await fetch(`${BASE}/people/candidates`, opts('GET'));
  return handle(res);
}

export async function registrarMonitoramento(payload) {
  const res = await fetch(`${BASE}/people`, opts('POST', payload));
  return handle(res);
}

export async function detalheMonitorado(id) {
  const res = await fetch(`${BASE}/people/${id}`, opts('GET'));
  return handle(res);
}

export async function patchMonitorado(id, payload) {
  const res = await fetch(`${BASE}/people/${id}`, opts('PATCH', payload));
  return handle(res);
}

export async function executarMonitoramentoAgora(id) {
  const res = await fetch(`${BASE}/people/${id}/run`, opts('POST'));
  return handle(res);
}

export async function listarRuns(id) {
  const res = await fetch(`${BASE}/people/${id}/runs`, opts('GET'));
  return handle(res);
}

export async function listarHits(id, reviewStatus = null) {
  const q = reviewStatus ? `?reviewStatus=${encodeURIComponent(reviewStatus)}` : '';
  const res = await fetch(`${BASE}/people/${id}/hits${q}`, opts('GET'));
  return handle(res);
}

export async function revisarHit(hitId, payload) {
  const res = await fetch(`${BASE}/hits/${hitId}/review`, opts('PATCH', payload));
  return handle(res);
}

export async function adicionarChaveBusca(monitoredId, payload) {
  const res = await fetch(`${BASE}/people/${monitoredId}/search-keys`, opts('POST', payload));
  return handle(res);
}

export async function obterConfigMonitoramento() {
  const res = await fetch(`${BASE}/settings`, opts('GET'));
  return handle(res);
}

export async function salvarConfigMonitoramento(payload) {
  const res = await fetch(`${BASE}/settings`, opts('PUT', payload));
  return handle(res);
}

export async function listarTribunaisDatajud() {
  const res = await fetch(`${BASE}/tribunals`, opts('GET'));
  return handle(res);
}
