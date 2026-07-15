/**
 * Detecta o sistema operacional do navegador (estação do usuário).
 * @returns {'macos' | 'windows' | 'linux' | 'desconhecido'}
 */
export function detectarSOUsuario() {
  if (typeof navigator === 'undefined') return 'desconhecido';

  const ua = String(navigator.userAgent ?? '');
  const platform = String(navigator.platform ?? '');

  const uaPlatform = navigator.userAgentData?.platform;
  if (uaPlatform) {
    const p = String(uaPlatform).toLowerCase();
    if (p.includes('mac')) return 'macos';
    if (p.includes('win')) return 'windows';
    if (p.includes('linux') || p.includes('android')) return 'linux';
  }

  if (/Win(dows|32|64|16)?/i.test(platform) || /Windows/i.test(ua)) return 'windows';
  if (/Mac/i.test(platform) || /Macintosh|Mac OS X/i.test(ua)) return 'macos';
  if (/Linux/i.test(platform) || /Linux/i.test(ua)) return 'linux';

  return 'desconhecido';
}

export const INSTALADOR_LOCAL_HELPER = {
  macos: {
    href: '/instaladores/vilareal-local-helper-macos.zip',
    arquivo: 'vilareal-local-helper-macos.zip',
    rotulo: 'Baixar instalador para macOS',
    descricao: 'Extraia o zip e dê duplo clique em Instalar-Pasta-Local-VillaReal.command',
    rodape:
      'Requer Node.js (nodejs.org). Se a pasta não for detectada, o instalador pedirá o caminho de clientes/01 - Ativos.',
    tituloSecao: 'Pasta local no Finder',
  },
  windows: {
    href: '/instaladores/vilareal-local-helper-windows.zip',
    arquivo: 'vilareal-local-helper-windows.zip',
    rotulo: 'Baixar instalador para Windows',
    descricao: 'Extraia o zip e execute Instalar-Pasta-Local-VillaReal.bat',
    rodape:
      'Requer Node.js (nodejs.org). Se a pasta não for detectada, o instalador pedirá o caminho de clientes/01 - Ativos.',
    tituloSecao: 'Pasta local no Explorer',
  },
};

/** @returns {typeof INSTALADOR_LOCAL_HELPER.macos | typeof INSTALADOR_LOCAL_HELPER.windows | null} */
export function instaladorLocalHelperParaSO(so = detectarSOUsuario()) {
  if (so === 'macos') return INSTALADOR_LOCAL_HELPER.macos;
  if (so === 'windows') return INSTALADOR_LOCAL_HELPER.windows;
  return null;
}

export function rotuloSOUsuario(so = detectarSOUsuario()) {
  if (so === 'macos') return 'macOS';
  if (so === 'windows') return 'Windows';
  if (so === 'linux') return 'Linux';
  return 'sistema não identificado';
}
