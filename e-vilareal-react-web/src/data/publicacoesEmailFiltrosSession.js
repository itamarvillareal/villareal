/**
 * Filtros da tela Publicações por e-mail / Movimentações por e-mail.
 * Persistem na aba ao abrir/fechar processo (/processos) e são limpos ao sair do fluxo.
 */

export const PUBLICACOES_EMAIL_FILTROS_SESSION_KEY_PREFIX =
  'vilareal.publicacoes-email.filtros.session.v1';

export const ROTAS_MANTEM_FILTROS_PUBLICACOES_EMAIL = new Set([
  '/publicacoes-email',
  '/processos/manifestacoes-projudi',
  '/processos',
]);

function storageKey(variant) {
  return `${PUBLICACOES_EMAIL_FILTROS_SESSION_KEY_PREFIX}:${variant || 'jusbrasil'}`;
}

/** @param {'jusbrasil'|'projudi'|string} variant */
export function loadPublicacoesEmailFiltrosSession(variant) {
  try {
    const raw = sessionStorage.getItem(storageKey(variant));
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || p.v !== 1) return null;
    return {
      buscaTexto: typeof p.buscaTexto === 'string' ? p.buscaTexto : '',
      filtroStatus: typeof p.filtroStatus === 'string' ? p.filtroStatus : '',
      filtroVinculo: typeof p.filtroVinculo === 'string' ? p.filtroVinculo : 'todos',
      filtroRecebimentoInicio:
        typeof p.filtroRecebimentoInicio === 'string' ? p.filtroRecebimentoInicio : '',
      filtroRecebimentoFim: typeof p.filtroRecebimentoFim === 'string' ? p.filtroRecebimentoFim : '',
      ordemDataAsc: p.ordemDataAsc === true,
    };
  } catch {
    return null;
  }
}

/** @param {'jusbrasil'|'projudi'|string} variant */
export function savePublicacoesEmailFiltrosSession(variant, filtros) {
  try {
    sessionStorage.setItem(
      storageKey(variant),
      JSON.stringify({
        v: 1,
        buscaTexto: filtros.buscaTexto ?? '',
        filtroStatus: filtros.filtroStatus ?? '',
        filtroVinculo: filtros.filtroVinculo ?? 'todos',
        filtroRecebimentoInicio: filtros.filtroRecebimentoInicio ?? '',
        filtroRecebimentoFim: filtros.filtroRecebimentoFim ?? '',
        ordemDataAsc: filtros.ordemDataAsc === true,
      })
    );
  } catch {
    /* ignore */
  }
}

/** @param {'jusbrasil'|'projudi'|string} variant */
export function clearPublicacoesEmailFiltrosSession(variant) {
  try {
    sessionStorage.removeItem(storageKey(variant));
  } catch {
    /* ignore */
  }
}

export function deveManterFiltrosPublicacoesEmail(pathname) {
  return ROTAS_MANTEM_FILTROS_PUBLICACOES_EMAIL.has(pathname);
}
