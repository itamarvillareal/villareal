/**
 * @typedef {{ origem?: string, id?: string, title?: string, description?: string, payload?: string }} RespostaInterativaWhatsApp
 */

/**
 * @param {string|undefined|null} content
 * @returns {RespostaInterativaWhatsApp|null}
 */
export function parseInteractiveReplyContent(content) {
  const raw = String(content ?? '').trim();
  if (!raw.startsWith('{')) return null;
  try {
    const data = JSON.parse(raw);
    const reply = data?.respostaInterativa ?? data?.interactiveReply;
    if (!reply || typeof reply !== 'object') return null;
    const title = String(reply.title ?? '').trim();
    const id = String(reply.id ?? '').trim();
    const payload = String(reply.payload ?? '').trim();
    const description = String(reply.description ?? '').trim();
    const origem = String(reply.origem ?? reply.origin ?? '').trim();
    if (!title && !id && !payload) return null;
    return {
      origem: origem || undefined,
      id: id || undefined,
      title: title || undefined,
      description: description || undefined,
      payload: payload || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * @param {string|undefined|null} content
 * @returns {string}
 */
export function resumoInteractiveReplyContent(content) {
  const reply = parseInteractiveReplyContent(content);
  if (!reply?.title) return '↩️ Resposta';
  return `↩️ ${reply.title}`;
}
