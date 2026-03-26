import { API_BASE_URL } from './config.js';
import { request } from './httpClient.js';

/**
 * Usuário atual (JWT). Requer token em sessionStorage.
 * @returns {Promise<{ id?: number, nome?: string, login?: string, perfilIds?: number[] }>}
 */
export async function fetchAuthMe() {
  return request('/api/auth/me');
}

/**
 * Login público — não envia Authorization.
 * @returns {Promise<{ accessToken?: string, usuario?: object, tokenType?: string }>}
 */
export async function fetchAuthLogin(login, senha) {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: String(login ?? '').trim(), senha: String(senha ?? '') }),
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }
  if (!res.ok) {
    const msg = data?.message || data?.error || `Erro ${res.status}`;
    throw new Error(msg);
  }
  return data || {};
}
