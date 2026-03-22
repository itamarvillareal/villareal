/**
 * Alias "hj" (hoje) em campos de data — preenche com a data atual no formato esperado.
 */

export function hojeDdMmYyyy() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

/** yyyy-mm-dd no fuso local (para inputs que gravam ISO). */
export function hojeIsoLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Se o texto for exatamente "hj" (trim, ignora maiúsculas), retorna a data de hoje no formato;
 * caso contrário null.
 * @param {'br' | 'iso'} formato - 'br' = dd/mm/aaaa, 'iso' = yyyy-mm-dd
 */
export function resolverAliasHojeEmTexto(valor, formato) {
  const t = String(valor ?? '').trim();
  if (!/^hj$/i.test(t)) return null;
  return formato === 'iso' ? hojeIsoLocal() : hojeDdMmYyyy();
}
