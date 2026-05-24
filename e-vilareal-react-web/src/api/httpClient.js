import { API_BASE_URL } from './config.js';
import { buildDefaultApiHeaders } from './apiAuthHeaders.js';
import { getAccessToken } from './authTokenStorage.js';
import { buildAuditoriaHeaders } from '../services/auditoriaCliente.js';
import { parseApiJsonResponse } from './parseApiResponse.js';

function buildUrl(path, query) {
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && String(v) !== '')
        .flatMap(([k, v]) =>
          Array.isArray(v)
            ? v
                .filter((item) => item !== undefined && item !== null && String(item) !== '')
                .map((item) => `${encodeURIComponent(k)}=${encodeURIComponent(item)}`)
            : [`${encodeURIComponent(k)}=${encodeURIComponent(v)}`]
        )
        .join('&')
    : '';
  const fullPath = `${API_BASE_URL}${path}`;
  return qs ? `${fullPath}?${qs}` : fullPath;
}

export async function request(path, { method = 'GET', body, query, headers, signal } = {}) {
  const authTokenSnapshotAtRequest = getAccessToken();
  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      signal,
      headers: {
        ...buildDefaultApiHeaders(),
        ...(headers || {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (msg === 'Failed to fetch' || err instanceof TypeError) {
      throw new Error(
        'API indisponível. Verifique se o backend Java está rodando (porta 8080) e reinicie o Vite se necessário.',
      );
    }
    throw err;
  }
  return parseApiJsonResponse(response, { authTokenSnapshotAtRequest });
}

/** POST multipart (não define Content-Type — o browser envia boundary). */
export async function postFormData(path, formData, { signal } = {}) {
  const authTokenSnapshotAtRequest = getAccessToken();
  const headers = { ...buildAuditoriaHeaders() };
  const t = getAccessToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  const response = await fetch(buildUrl(path), {
    method: 'POST',
    headers,
    body: formData,
    signal,
  });
  return parseApiJsonResponse(response, { authTokenSnapshotAtRequest });
}
