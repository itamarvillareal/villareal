import { emitApiUnauthorized } from './apiAuthHeaders.js';
import { getAccessToken } from './authTokenStorage.js';

/**
 * Lê corpo JSON de Response; em 401 dispara sessão expirada; em erro lança Error.
 *
 * Contrato HTTP com o backend (alinhamento recomendado):
 * - **401 Unauthorized** — credencial inválida ou JWT ausente/expirado. O cliente limpa o token
 *   (`emitApiUnauthorized`). O backend deve usar 401 só para autenticação, não para regra de negócio.
 * - **403 Forbidden** — autenticado mas sem permissão; o cliente **não** desloga automaticamente.
 * - **422** — regras de negócio (`BusinessRuleException`); mensagem no corpo JSON.
 * - **400** — validação de bean (`MethodArgumentNotValidException`, etc.).
 * - **500** — erro interno; mensagem genérica ao utilizador.
 *
 * @param {{ authTokenSnapshotAtRequest?: string }} [options]
 *   Quando `authTokenSnapshotAtRequest` vem de `httpClient.request` (valor de `getAccessToken()` no início do fetch),
 *   em 401 só se chama `emitApiUnauthorized` se o token atual ainda for o mesmo — evita apagar um JWT **novo**
 *   quando um pedido antigo (ex.: `GET /api/auth/me` ao abrir a app) completa 401 depois do login.
 */
/** Heurística simples para detectar corpo HTML (páginas de erro de proxy/gateway). */
function isHtmlBody(text) {
  const inicio = String(text).trimStart().slice(0, 200).toLowerCase();
  return inicio.startsWith('<!doctype html') || inicio.startsWith('<html') || /<html[\s>]/.test(inicio);
}

export async function parseApiJsonResponse(response, options = {}) {
  const { authTokenSnapshotAtRequest } = options;
  if (response.status === 401) {
    if (authTokenSnapshotAtRequest === undefined) {
      emitApiUnauthorized();
    } else if (getAccessToken() === authTokenSnapshotAtRequest) {
      emitApiUnauthorized();
    }
  }
  if (response.status === 204) return null;
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Corpo não-JSON (ex.: página HTML de erro de proxy/gateway como nginx 502/504).
      // Não expor o HTML cru na UI; manter apenas o status.
      data = isHtmlBody(text) ? null : { message: text };
    }
  }
  if (!response.ok) {
    if (response.status === 413) {
      throw new Error(
        data?.message
          || 'Os arquivos enviados são grandes demais (limite: 250 MB por lote). '
            + 'Envie menos arquivos .p7s por vez ou divida em lotes menores.',
      );
    }
    let message = data?.message || data?.error || `Erro ${response.status}`;
    if (data?.path && typeof data.path === 'string') {
      message = `${message} — ${data.path}`;
    }
    throw new Error(message);
  }
  return data;
}
