import { buscarWhatsAppMediaBlob } from '../../../repositories/whatsappRepository.js';

/** @typedef {{ objectUrl: string, blob: Blob, refs: number, inflight?: Promise<{ url: string, blob: Blob }>, abortController?: AbortController }} CacheEntry */

/** @type {Map<string, CacheEntry>} */
const cache = new Map();

/**
 * Obtém (ou carrega) object URL autenticada para foto de contato WhatsApp.
 * Reutiliza o fetch autenticado do proxy de mídia.
 */
export async function acquireWhatsAppContactPhotoObjectUrl(phone, contactPhotoUrl) {
  const key = String(phone ?? '').trim();
  if (!key || !contactPhotoUrl) {
    throw new Error('Foto de contato ausente.');
  }

  const existing = cache.get(key);
  if (existing?.objectUrl) {
    existing.refs += 1;
    return { url: existing.objectUrl, blob: existing.blob };
  }
  if (existing?.inflight) {
    existing.refs += 1;
    return existing.inflight;
  }

  const abortController = new AbortController();
  const inflight = (async () => {
    const blob = await buscarWhatsAppMediaBlob(contactPhotoUrl, { signal: abortController.signal });
    const objectUrl = URL.createObjectURL(blob);
    const entry = cache.get(key);
    if (!entry || entry.refs <= 0) {
      URL.revokeObjectURL(objectUrl);
      throw new DOMException('Foto descartada', 'AbortError');
    }
    entry.objectUrl = objectUrl;
    entry.blob = blob;
    delete entry.inflight;
    delete entry.abortController;
    return { url: objectUrl, blob };
  })();

  cache.set(key, { objectUrl: '', blob: null, refs: 1, inflight, abortController });

  try {
    return await inflight;
  } catch (err) {
    const entry = cache.get(key);
    if (entry && !entry.objectUrl) {
      cache.delete(key);
    }
    throw err;
  }
}

/** Libera referência; revoga object URL quando refs chega a zero. */
export function releaseWhatsAppContactPhotoObjectUrl(phone) {
  const key = String(phone ?? '').trim();
  const entry = cache.get(key);
  if (!entry) return;

  entry.refs -= 1;
  if (entry.refs > 0) return;

  if (entry.abortController) {
    entry.abortController.abort();
  }
  if (entry.objectUrl) {
    URL.revokeObjectURL(entry.objectUrl);
  }
  cache.delete(key);
}

/** Invalida cache após upload/remoção (mesmo path, bytes novos). */
export function invalidateWhatsAppContactPhotoObjectUrl(phone) {
  const key = String(phone ?? '').trim();
  const entry = cache.get(key);
  if (!entry) return;

  if (entry.abortController) {
    entry.abortController.abort();
  }
  if (entry.objectUrl) {
    URL.revokeObjectURL(entry.objectUrl);
  }
  cache.delete(key);
}

/** Apenas para testes. */
export function clearWhatsAppContactPhotoUrlCacheForTests() {
  for (const entry of cache.values()) {
    if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl);
    entry.abortController?.abort();
  }
  cache.clear();
}
