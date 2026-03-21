/**
 * Hash de senha para armazenamento local (SHA-256). Futura troca para backend / bcrypt.
 */

const PREFIX = 'vilareal.sha256.v1|';

export async function hashSenha(plain) {
  if (plain == null || String(plain) === '') return '';
  const enc = new TextEncoder().encode(PREFIX + String(plain));
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verificarSenha(plain, hashArmazenado) {
  if (!plain || !hashArmazenado) return false;
  const h = await hashSenha(plain);
  return h === hashArmazenado;
}
