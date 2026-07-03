/** Normaliza texto de valor para envio à API (sinal ignorado no backend). */
export function normalizarValorPesquisaInput(raw) {
  return String(raw ?? '').trim();
}

/** Converte YYYY-MM-DD do input date para exibição DD/MM/AAAA. */
export function formatDataIsoParaBr(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? '').trim());
  if (!m) return iso ?? '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}
