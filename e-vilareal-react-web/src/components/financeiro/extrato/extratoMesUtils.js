/** Converte data ISO (YYYY-MM-DD) em chave de período YYYY-MM para filtros do extrato. */
export function mesAnoFromDataLancamento(dataIso) {
  const s = String(dataIso ?? '').trim();
  const m = /^(\d{4})-(\d{2})/.exec(s);
  return m ? `${m[1]}-${m[2]}` : null;
}
