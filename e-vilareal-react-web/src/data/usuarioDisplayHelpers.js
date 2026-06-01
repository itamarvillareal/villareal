/**
 * Sempre o apelido do usuário nas telas (nunca o nome civil completo).
 * Fallbacks: login, depois id; por último «—».
 * @param {{ apelido?: string, login?: string, id?: string|number, nome?: string, tipo?: string } | null | undefined} u
 */
export function getNomeExibicaoUsuario(u) {
  if (!u) return '—';
  const ap = String(u.apelido ?? '').trim();
  if (ap) return ap;
  const lg = String(u.login ?? '').trim();
  if (lg) return lg;
  const id = u.id != null ? String(u.id).trim() : '';
  if (id) return id;
  return '—';
}

/** Usuário do sistema cadastrado como assistente de IA (ex.: Júlia). */
export function isAssistenteIaUsuario(u) {
  if (!u) return false;
  return String(u.tipo ?? 'HUMANO').trim().toUpperCase() === 'ASSISTENTE_IA';
}

/** Rótulo para `<option>` — inclui sufixo textual quando IA (options não aceitam JSX). */
export function rotuloUsuarioSelectComTipo(u) {
  const base = getNomeExibicaoUsuario(u);
  if (base === '—') return base;
  return isAssistenteIaUsuario(u) ? `${base} · IA` : base;
}
