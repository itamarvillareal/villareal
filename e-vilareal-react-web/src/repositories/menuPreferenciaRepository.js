import { request } from '../api/httpClient.js';
import { getAccessToken } from '../api/authTokenStorage.js';
import {
  getApiUsuarioSessao,
  getPerfilAtivoParaPermissoes,
  usuarioEhAdminApi,
} from '../data/usuarioPermissoesStorage.js';
import {
  aplicarPreferenciaApiNoCache,
  getMenuPreferenciaUsuario,
  preferenciaParaApi,
  saveMenuVisivelUsuario,
} from '../data/menuVisivelStorage.js';

function temToken() {
  return Boolean(getAccessToken());
}

/**
 * Preferência própria (JWT) ou de outro usuário (ADMIN: path com id/login).
 * @param {string} [usuarioRef]
 */
export async function obterMenuPreferenciaApi(usuarioRef) {
  const path = usuarioRef
    ? `/api/configuracoes/menu-lateral/${encodeURIComponent(usuarioRef)}`
    : '/api/configuracoes/menu-lateral';
  return request(path);
}

/**
 * @param {{ itens: Array<{ moduloId: string, visivel: boolean, ordem: number }> }} body
 * @param {string} [usuarioRef]
 */
export async function salvarMenuPreferenciaApi(body, usuarioRef) {
  const path = usuarioRef
    ? `/api/configuracoes/menu-lateral/${encodeURIComponent(usuarioRef)}`
    : '/api/configuracoes/menu-lateral';
  return request(path, { method: 'PUT', body });
}

/**
 * Indica se o alvo é o usuário autenticado na API (salvar em `/` em vez de `/{ref}`).
 * @param {string} alvoId
 */
export function menuPreferenciaEhProprioUsuario(alvoId) {
  const api = getApiUsuarioSessao();
  if (!api?.id) {
    return String(alvoId) === String(getPerfilAtivoParaPermissoes());
  }
  const ref = String(alvoId ?? '').trim();
  if (!ref) return false;
  if (ref === String(api.id)) return true;
  return ref.toLowerCase() === String(api.login ?? '').toLowerCase();
}

/**
 * Carrega preferência: API (se houver token) → cache local.
 * @param {string} userId — chave de cache / ref da API
 */
export async function carregarMenuPreferenciaUsuario(userId) {
  const cacheKey = String(userId || getPerfilAtivoParaPermissoes());
  if (temToken()) {
    try {
      const proprio = menuPreferenciaEhProprioUsuario(cacheKey);
      if (!proprio && !usuarioEhAdminApi()) {
        return getMenuPreferenciaUsuario(cacheKey);
      }
      const resp = await obterMenuPreferenciaApi(proprio ? undefined : cacheKey);
      const chaveCache =
        resp?.usuarioId != null ? String(resp.usuarioId) : cacheKey;
      aplicarPreferenciaApiNoCache(chaveCache, resp);
      if (chaveCache !== cacheKey) {
        aplicarPreferenciaApiNoCache(cacheKey, resp);
      }
      return getMenuPreferenciaUsuario(cacheKey);
    } catch {
      /* fallback cache */
    }
  }
  return getMenuPreferenciaUsuario(cacheKey);
}

/**
 * Salva no banco (se autenticado) e no cache local.
 * @param {string} userId
 * @param {{ itens: Array<{ id: string, visivel: boolean, ordem: number }> }} preferencia
 * @returns {Promise<{ persistidoEmBanco: boolean, preferencia: object }>}
 */
export async function persistirMenuPreferenciaUsuario(userId, preferencia) {
  const cacheKey = String(userId || '');
  if (!cacheKey) throw new Error('Usuário inválido.');
  saveMenuVisivelUsuario(cacheKey, preferencia);
  const body = preferenciaParaApi(preferencia);

  if (!temToken()) {
    return { persistidoEmBanco: false, preferencia: getMenuPreferenciaUsuario(cacheKey) };
  }

  const proprio = menuPreferenciaEhProprioUsuario(cacheKey);
  if (!proprio && !usuarioEhAdminApi()) {
    return { persistidoEmBanco: false, preferencia: getMenuPreferenciaUsuario(cacheKey) };
  }
  const resp = await salvarMenuPreferenciaApi(body, proprio ? undefined : cacheKey);
  const chaveApi = resp?.usuarioId != null ? String(resp.usuarioId) : cacheKey;
  aplicarPreferenciaApiNoCache(chaveApi, resp);
  if (chaveApi !== cacheKey) {
    aplicarPreferenciaApiNoCache(cacheKey, resp);
  }
  return { persistidoEmBanco: true, preferencia: getMenuPreferenciaUsuario(cacheKey) };
}
