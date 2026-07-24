/** Logo da instância portal1 (FFM Advogados). */
export const LOGO_PORTAL1 = '/logo-ffm-advogados.png';

/** @deprecated use LOGO_PORTAL1 */
export const LOGO_LOGIN_PORTAL1 = LOGO_PORTAL1;

/** Detecta portal1 pelo hostname (mesmo build compartilhado entre instâncias). */
export function isPortal1Instancia() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host === 'portal1.villarealadvocacia.adv.br' || host.startsWith('portal1.');
}
