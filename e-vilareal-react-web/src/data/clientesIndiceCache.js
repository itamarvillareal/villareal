const STORAGE_KEY = 'vilareal:clientes-indice-cache';
const TTL_MS = 15 * 60 * 1000;

export function readIndiceClientesCache() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const fetchedAt = Number(parsed.fetchedAt);
    if (!Number.isFinite(fetchedAt) || Date.now() - fetchedAt > TTL_MS) return null;
    if (!Array.isArray(parsed.data)) return null;
    return {
      data: parsed.data,
      etag: typeof parsed.etag === 'string' ? parsed.etag : null,
      fetchedAt,
    };
  } catch {
    return null;
  }
}

export function writeIndiceClientesCache(data, etag) {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        data: Array.isArray(data) ? data : [],
        etag: etag || null,
        fetchedAt: Date.now(),
      })
    );
  } catch {
    /* quota / modo privado */
  }
}

export function clearIndiceClientesCache() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
