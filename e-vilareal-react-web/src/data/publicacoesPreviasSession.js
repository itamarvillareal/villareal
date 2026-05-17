/**
 * Persiste a prévia da importação de PDF (Publicações) na mesma aba/navegação até novo PDF,
 * «Cancelar prévia» ou fim de sessão (logout / 401 / login / inatividade).
 * sessionStorage sobrevive a trocas de rota; não sobrevive ao fechar o separador.
 */

export const PUBLICACOES_PREVIA_SESSION_STORAGE_KEY = 'vilareal.publicacoes.previaPdf.session.v1';

const MAX_PAYLOAD_CHARS = 4 * 1024 * 1024;

export function clearPublicacoesPreviasSession() {
  try {
    sessionStorage.removeItem(PUBLICACOES_PREVIA_SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @param {{ preview: object | null, arquivoNome: string, selecionados: number[], logImportacao: object | null }} state
 */
export function savePublicacoesPreviasSession(state) {
  try {
    if (!state.preview) {
      clearPublicacoesPreviasSession();
      return true;
    }
    const payload = {
      v: 1,
      preview: state.preview,
      arquivoNome: state.arquivoNome,
      selecionados: state.selecionados,
      logImportacao: state.logImportacao,
    };
    const s = JSON.stringify(payload);
    if (s.length > MAX_PAYLOAD_CHARS) {
      console.warn(
        '[Publicações] Prévia demasiado grande para sessionStorage; não será reposta ao voltar ao menu.'
      );
      return false;
    }
    sessionStorage.setItem(PUBLICACOES_PREVIA_SESSION_STORAGE_KEY, s);
    return true;
  } catch (e) {
    if (e?.name === 'QuotaExceededError') {
      console.warn('[Publicações] sessionStorage cheio; prévia não persistida.');
    }
    return false;
  }
}

/** @returns {{ preview: object, arquivoNome: string, selecionados: number[], logImportacao: object | null } | null} */
export function loadPublicacoesPreviasSession() {
  try {
    const raw = sessionStorage.getItem(PUBLICACOES_PREVIA_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || p.v !== 1 || !p.preview) return null;
    return {
      preview: p.preview,
      arquivoNome: typeof p.arquivoNome === 'string' ? p.arquivoNome : '',
      selecionados: Array.isArray(p.selecionados) ? p.selecionados : [],
      logImportacao: p.logImportacao ?? null,
    };
  } catch {
    return null;
  }
}
