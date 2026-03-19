/**
 * Parse e validação de datas brasileiras (dd/mm/aaaa) → ISO yyyy-mm-dd.
 */

export function parseBrazilianDate(dia, mes, ano) {
  const d = String(dia).padStart(2, '0');
  const m = String(mes).padStart(2, '0');
  let a = String(ano).replace(/\D/g, '');
  if (a.length === 2) {
    a = Number(a) >= 30 ? `19${a}` : `20${a}`;
  }
  if (a.length !== 4) return null;
  const yyyy = Number(a);
  const mm = Number(m);
  const dd = Number(d);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1900 || yyyy > 2100) return null;
  const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getUTCFullYear() !== yyyy || dt.getUTCMonth() + 1 !== mm || dt.getUTCDate() !== dd) {
    return null;
  }
  const hoje = new Date();
  const hojeUtc = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  if (dt.getTime() > hojeUtc) return null;
  return `${a}-${m}-${d}`;
}

export function validateParsedDate(iso) {
  if (!iso) return { valido: false };
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return { valido: false };
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) return { valido: false };
  const hoje = new Date();
  if (dt > new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()))) {
    return { valido: false };
  }
  return { valido: true };
}
