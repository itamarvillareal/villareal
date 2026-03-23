/** Chave localStorage para persistir modo noturno (1 = ativo). */
export const THEME_DARK_STORAGE_KEY = 'vilareal.theme.dark';

export function getStoredDarkMode() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(THEME_DARK_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setStoredDarkMode(isDark) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_DARK_STORAGE_KEY, isDark ? '1' : '0');
  } catch {
    /* ignore */
  }
}
