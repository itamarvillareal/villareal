import { API_BASE_URL } from './config.js';
import { buildDefaultApiHeaders } from './apiAuthHeaders.js';
import { getAccessToken } from './authTokenStorage.js';
import { buildAuditoriaHeaders } from '../services/auditoriaCliente.js';
import { parseApiJsonResponse } from './parseApiResponse.js';
import { salvarResponseComoArquivo } from '../utils/streamFileDownload.js';

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

/**
 * Download binário (PDF, ZIP, etc.) com JWT. Por padrão **não** desloga em 401 — evita perder
 * a sessão por falha pontual de download mantendo o contexto da tela.
 */
export async function requestBlob(
  path,
  {
    method = 'GET',
    body,
    query,
    accept = 'application/pdf',
    fallbackFilename = 'download.bin',
    logoutOn401 = false,
    signal,
    streamToDisk = false,
  } = {},
) {
  const authTokenSnapshotAtRequest = getAccessToken();
  const headers = { ...buildAuditoriaHeaders(), Accept: accept };
  if (authTokenSnapshotAtRequest) headers.Authorization = `Bearer ${authTokenSnapshotAtRequest}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      signal,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (msg === 'Failed to fetch' || err instanceof TypeError) {
      throw new Error(
        'API indisponível. Verifique se o backend Java está rodando e tente novamente.',
      );
    }
    throw err;
  }

  if (response.status === 401) {
    if (
      logoutOn401 &&
      authTokenSnapshotAtRequest &&
      getAccessToken() === authTokenSnapshotAtRequest
    ) {
      const { emitApiUnauthorized } = await import('./apiAuthHeaders.js');
      emitApiUnauthorized();
    }
    throw new Error('Não autenticado ao baixar o arquivo. Verifique a sessão e tente novamente.');
  }

  if (!response.ok) {
    const text = await response.text();
    let message = `Erro ${response.status}`;
    if (text) {
      try {
        const data = JSON.parse(text);
        message = data.message || data.error || message;
      } catch {
        message = text.length > 300 ? `${text.slice(0, 300)}…` : text;
      }
    }
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  if (streamToDisk) {
    const saved = await salvarResponseComoArquivo(response, { fallbackFilename });
    return { ...saved, responseHeaders: response.headers };
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/i.exec(disposition);
  const filename = match?.[1] || fallbackFilename;
  return { blob, filename, responseHeaders: response.headers };
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
