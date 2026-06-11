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
 * Converte texto de data (ISO, dd/mm/aaaa, dd-mm-aaaa) para yyyy-mm-dd da API.
 * @param {string|Date|null|undefined} val
 * @returns {string|null}
 */
export function dataNascimentoTextoParaIso(val) {
  if (val == null || val === '') return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  let s = String(val).trim();
  if (!s) return null;
  if (s.includes('T')) s = s.split('T')[0];

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (br) {
    const dd = Number(br[1]);
    const mm = Number(br[2]);
    const yyyy = Number(br[3]);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }

  return null;
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
