/** Espelho em sessionStorage da lista da API — usado por getUsuariosAtivos quando VITE_USE_API_USUARIOS. */

const KEY = 'vilareal.api.usuariosAtivos.snapshot.v1';

export function gravarSnapshotUsuariosApi(lista) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(Array.isArray(lista) ? lista : []));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vilareal:usuarios-agenda-atualizados'));
    }
  } catch {
    /* ignore */
  }
}

export function lerSnapshotUsuariosApi() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}
