import { API_BASE_URL } from './config.js';
import { request } from './httpClient.js';

/**
 * Usuário atual (JWT). Requer token em sessionStorage.
 * @returns {Promise<{ id?: number, nome?: string, login?: string, perfilId?: number }>}
 */
export async function fetchAuthMe() {
  return request('/api/auth/me');
}

/**
 * Login público — não envia Authorization.
 * @returns {Promise<{ accessToken?: string, usuario?: object, tokenType?: string }>}
 */
export async function fetchAuthLogin(login, senha) {
  const url = `${API_BASE_URL}/api/auth/login`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: String(login ?? '').trim(), senha: String(senha ?? '') }),
    });
  } catch (e) {
    const msg = typeof e?.message === 'string' ? e.message : '';
    const rede =
      e instanceof TypeError ||
      /failed to fetch|networkerror|load failed|aborted|fetch/i.test(msg);
    if (rede) {
      throw new Error(
        'Sem ligação ao servidor. Inicie o backend Java (ex.: porta 8080), abra a app em http://localhost:5173 e, no .env, deixe VITE_API_URL vazio para o Vite fazer proxy de /api. ' +
          (msg ? `(${msg})` : '')
      );
    }
    throw e;
  }
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
    let errMsg = data?.message || data?.error || `Erro ${res.status}`;
    if (data?.path && typeof data.path === 'string') {
      errMsg = `${errMsg} — ${data.path}`;
    }
    throw new Error(errMsg);
  }
  return data || {};
}
