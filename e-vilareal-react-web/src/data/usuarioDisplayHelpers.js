/**
 * Nome curto (apelido) nas telas; fallback para o nome completo do cadastro.
 * @param {{ nome?: string, apelido?: string } | null | undefined} u
 */
export function getNomeExibicaoUsuario(u) {
  if (!u) return '—';
  const ap = String(u.apelido ?? '').trim();
  if (ap) return ap;
  return String(u.nome ?? '').trim() || '—';
}
