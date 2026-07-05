/** Preserva query string (ex.: mes=2026) ao alternar Extrato ↔ Inbox. */
export function pathInboxFinanceiro(search = '', tipo = 'classificar') {
  const raw = String(search ?? '').replace(/^\?/, '');
  const params = new URLSearchParams(raw);
  params.delete('tipo');
  const qs = params.toString();
  return `/financeiro/inbox/${tipo}${qs ? `?${qs}` : ''}`;
}

export function pathExtratoFinanceiro(search = '') {
  const raw = String(search ?? '').replace(/^\?/, '');
  const qs = raw ? `?${raw}` : '';
  return `/financeiro/extrato${qs}`;
}
