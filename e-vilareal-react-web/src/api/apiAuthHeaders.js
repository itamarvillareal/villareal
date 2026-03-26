import { buildAuditoriaHeaders } from '../services/auditoriaCliente.js';
import { clearAccessToken, getAccessToken } from './authTokenStorage.js';

/**
 * Cabeçalhos padrão para chamadas ao backend Java (JWT + auditoria).
 */
export function buildDefaultApiHeaders(extra = {}) {
  const h = {
    'Content-Type': 'application/json',
    ...buildAuditoriaHeaders(),
    ...extra,
  };
  const t = getAccessToken();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

export function emitApiUnauthorized() {
  clearAccessToken();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vilareal:api-unauthorized'));
  }
}
