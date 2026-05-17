/** Texto «Parte Cliente × Parte Réu» para coluna Vínculo (campos `cliente` e `reu` da linha). */
export function formatarRotuloVinculoPartes(row) {
  const pc = String(row?.cliente ?? '').trim();
  const pr = String(row?.reu ?? '').trim();
  if (pc && pr) return `${pc} × ${pr}`;
  if (pc) return pc;
  if (pr) return pr;
  return '—';
}
