import { emitApiUnauthorized } from './apiAuthHeaders.js';

/**
 * Lê corpo JSON de Response; em 401 dispara sessão expirada; em erro lança Error.
 */
export async function parseApiJsonResponse(response) {
  if (response.status === 401) {
    emitApiUnauthorized();
  }
  if (response.status === 204) return null;
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }
  if (!response.ok) {
    const message = data?.message || data?.error || `Erro ${response.status}`;
    throw new Error(message);
  }
  return data;
}
