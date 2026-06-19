/** Compartilhado entre abas do mesmo origin (localStorage). */
export const ACCESS_TOKEN_STORAGE_KEY = 'vilareal.accessToken';
export const LAST_ACTIVITY_STORAGE_KEY = 'vilareal.auth.lastActivity.v1';

const LEGACY_SESSION_TOKEN_KEY = ACCESS_TOKEN_STORAGE_KEY;

function readTokenFromSessionStorageLegacy() {
  try {
    return sessionStorage.getItem(LEGACY_SESSION_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function getAccessToken() {
  try {
    const fromLocal = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || '';
    if (fromLocal) return fromLocal;
    const legacy = readTokenFromSessionStorageLegacy();
    if (legacy) {
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, legacy);
      sessionStorage.removeItem(LEGACY_SESSION_TOKEN_KEY);
      return legacy;
    }
    return '';
  } catch {
    return '';
  }
}

export function setAccessToken(token) {
  try {
    if (token) localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(LEGACY_SESSION_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function clearAccessToken() {
  setAccessToken('');
  clearLastAuthActivity();
}

export function getLastAuthActivityMs() {
  try {
    const n = parseInt(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY) ?? '', 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function touchLastAuthActivity(at = Date.now()) {
  try {
    localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(at));
  } catch {
    /* ignore */
  }
}

export function clearLastAuthActivity() {
  try {
    localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
