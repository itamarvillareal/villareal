/** Logo da instância portal1 (FFM Advogados) na tela de login. */
export const LOGO_LOGIN_PORTAL1 = '/logo-ffm-advogados.png';

/** Detecta portal1 pelo hostname (mesmo build compartilhado entre instâncias). */
export function isPortal1Instancia() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host === 'portal1.villarealadvocacia.adv.br' || host.startsWith('portal1.');
}
