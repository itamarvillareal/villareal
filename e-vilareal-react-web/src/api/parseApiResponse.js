import { emitApiUnauthorized } from './apiAuthHeaders.js';

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
