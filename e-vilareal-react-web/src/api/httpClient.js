import { API_BASE_URL } from './config.js';
import { buildAuditoriaHeaders } from '../services/auditoriaCliente.js';

function buildUrl(path, query) {
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && String(v) !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
    : '';
  const fullPath = `${API_BASE_URL}${path}`;
  return qs ? `${fullPath}?${qs}` : fullPath;
}

async function parseResponse(response) {
  if (response.status === 204) return null;
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.error || `Erro ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export async function request(path, { method = 'GET', body, query, headers } = {}) {
  const response = await fetch(buildUrl(path, query), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...buildAuditoriaHeaders(),
      ...(headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseResponse(response);
}
