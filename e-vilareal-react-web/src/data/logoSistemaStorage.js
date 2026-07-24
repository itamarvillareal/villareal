/** Logo customizada do portal (sidebar / topo mobile), por estação. */
const STORAGE_KEY = 'vilareal.logoSistema.v1';
export const LOGO_SISTEMA_DEFAULT = '/logo-villareal.png';
export const LOGO_SISTEMA_EVENT = 'vilareal:logo-sistema-atualizada';

/** @returns {string | null} data URL ou null se usar o padrão */
export function getLogoSistemaCustomizada() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || typeof raw !== 'string') return null;
    if (!raw.startsWith('data:image/')) return null;
    return raw;
  } catch {
    return null;
  }
}

/** @returns {string} URL exibida (custom ou padrão) */
export function getLogoSistemaSrc() {
  return getLogoSistemaCustomizada() || LOGO_SISTEMA_DEFAULT;
}

/** @param {string} dataUrl */
export function setLogoSistemaCustomizada(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    throw new Error('Imagem inválida.');
  }
  // ~1,2 MB em base64 — evita estourar cota do localStorage
  if (dataUrl.length > 1_600_000) {
    throw new Error('Imagem muito grande. Use um arquivo de até cerca de 1 MB.');
  }
  localStorage.setItem(STORAGE_KEY, dataUrl);
  window.dispatchEvent(new CustomEvent(LOGO_SISTEMA_EVENT));
}

export function limparLogoSistemaCustomizada() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(LOGO_SISTEMA_EVENT));
}

/**
 * Lê um File de imagem e devolve data URL.
 * @param {File} file
 * @returns {Promise<string>}
 */
export function lerArquivoLogoComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('Selecione um arquivo de imagem (PNG, JPG, WEBP ou SVG).'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string' || !result.startsWith('data:image/')) {
        reject(new Error('Não foi possível ler a imagem.'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}
