/**
 * Sempre o apelido do usuário nas telas (nunca o nome civil completo).
 * Fallbacks: login, depois id; por último «—».
 * @param {{ apelido?: string, login?: string, id?: string|number, nome?: string } | null | undefined} u
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
