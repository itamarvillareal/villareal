/**
 * @typedef {{ latitude: number, longitude: number, name?: string, address?: string }} LocalizacaoWhatsApp
 */

/**
 * @param {string|undefined|null} content
 * @returns {LocalizacaoWhatsApp|null}
 */
export function parseLocationContent(content) {
  const raw = String(content ?? '').trim();
  if (!raw.startsWith('{')) return null;
  try {
    const data = JSON.parse(raw);
    const loc = data?.localizacao ?? data?.location;
    if (!loc || typeof loc !== 'object') return null;
    const latitude = Number(loc.latitude);
    const longitude = Number(loc.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const name = String(loc.name ?? '').trim();
    const address = String(loc.address ?? '').trim();
    return {
      latitude,
      longitude,
      name: name || undefined,
      address: address || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * @param {string|undefined|null} content
 * @returns {string}
 */
export function resumoLocationContent(content) {
  const loc = parseLocationContent(content);
  if (!loc) return '📍 Localização';
  if (loc.name) return `📍 ${loc.name}`;
  return '📍 Localização';
}

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {string}
 */
export function mapsUrl(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}
