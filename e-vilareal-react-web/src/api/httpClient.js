import { API_BASE_URL } from './config.js';
import { buildDefaultApiHeaders } from './apiAuthHeaders.js';
import { getAccessToken } from './authTokenStorage.js';
import { buildAuditoriaHeaders } from '../services/auditoriaCliente.js';
import { parseApiJsonResponse } from './parseApiResponse.js';

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

export async function request(path, { method = 'GET', body, query, headers, signal } = {}) {
  const response = await fetch(buildUrl(path, query), {
    method,
    signal,
    headers: {
      ...buildDefaultApiHeaders(),
      ...(headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parseApiJsonResponse(response);
}

/** POST multipart (não define Content-Type — o browser envia boundary). */
export async function postFormData(path, formData, { signal } = {}) {
  const headers = { ...buildAuditoriaHeaders() };
  const t = getAccessToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  const response = await fetch(buildUrl(path), {
    method: 'POST',
    headers,
    body: formData,
    signal,
  });
  return parseApiJsonResponse(response);
}
