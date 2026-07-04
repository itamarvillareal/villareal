/**
 * Paleta fixa para avatares de iniciais. Mesma chave → mesma entrada sempre.
 * A chave deve ser o telefone normalizado (não o nome), para a cor permanecer estável
 * quando o nome exibido muda (ex.: perfil Meta → cadastro).
 */
const PALETA_AVATAR = [
  'bg-emerald-500 text-white',
  'bg-blue-500 text-white',
  'bg-violet-500 text-white',
  'bg-amber-400 text-slate-900',
  'bg-rose-500 text-white',
  'bg-teal-600 text-white',
  'bg-indigo-500 text-white',
  'bg-orange-500 text-white',
  'bg-cyan-600 text-white',
  'bg-fuchsia-500 text-white',
];

function hashString(value) {
  let hash = 0;
  const s = String(value ?? '');
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * @param {string|undefined|null} chave — preferir telefone normalizado (somente dígitos).
 * @returns {string} classes Tailwind (fundo + texto).
 */
export function corAvatarPorChave(chave) {
  const normalized = String(chave ?? '').replace(/\D/g, '') || String(chave ?? '').trim() || '?';
  const index = hashString(normalized) % PALETA_AVATAR.length;
  return PALETA_AVATAR[index];
}
