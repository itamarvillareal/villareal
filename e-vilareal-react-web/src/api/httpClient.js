import { API_BASE_URL } from './config.js';
import { buildDefaultApiHeaders } from './apiAuthHeaders.js';
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
