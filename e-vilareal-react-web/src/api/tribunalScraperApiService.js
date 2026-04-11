/**
 * Cliente da API .NET Vilareal.TribunalScraper.Api (busca por OAB — linha isolada).
 *
 * Base URL:
 * - Se `VITE_TRIBUNAL_SCRAPER_URL` estiver definida → usa esse host (ex.: produção).
 * - Senão → prefixo relativo `/tribunal-scraper-api` (proxy Vite em dev → localhost:5288).
 */

function getBaseUrl() {
  const raw = import.meta.env.VITE_TRIBUNAL_SCRAPER_URL;
  if (raw != null && String(raw).trim() !== '') {
    return String(raw).replace(/\/$/, '');
  }
  return '/tribunal-scraper-api';
}

async function parseJsonResponse(res) {
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
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data;
}

/**
 * @param {{ lawyerName: string, oabNumber: string, spheres?: string[] }} payload
 * @returns {Promise<{ count: number, processos: object[] }>}
 */
export async function buscaAdvogadoTribunalScraper(payload) {
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/scraper/busca-advogado`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      lawyerName: payload.lawyerName ?? '',
      oabNumber: payload.oabNumber ?? '',
      spheres: Array.isArray(payload.spheres) ? payload.spheres : [],
    }),
  });
  return parseJsonResponse(res);
}

/** @returns {Promise<Array<{ code: string, name: string, sphere: string, family: string, active: boolean }>>} */
export async function listarTribunaisScraperConfig() {
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/scraper/tribunais`, { headers: { Accept: 'application/json' } });
  return parseJsonResponse(res);
}

/** @returns {Promise<object[]>} */
export async function healthTribunalScraper() {
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/scraper/health`, { headers: { Accept: 'application/json' } });
  return parseJsonResponse(res);
}

export function getTribunalScraperBaseUrlForDebug() {
  return getBaseUrl();
}
