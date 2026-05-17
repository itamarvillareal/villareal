/** Valor assinado: crédito +, débito −. */
export function signedValorFromApi(l) {
  const v = Math.abs(Number(l?.valor) || 0);
  const n = String(l?.natureza ?? '').toUpperCase();
  return n === 'DEBITO' ? -v : v;
}

export function somaAssinadaLancamentos(lancamentos) {
  return (lancamentos ?? []).reduce((s, l) => s + signedValorFromApi(l), 0);
}

export function formatMoeda(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

export function formatDataCurta(isoOrBr) {
  const s = String(isoOrBr ?? '').trim();
  let y;
  let mo;
  let d;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    y = Number(iso[1]);
    mo = iso[2];
    d = iso[3];
  } else {
    const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (!br) return s;
    d = br[1];
    mo = br[2];
    y = Number(br[3]);
  }
  const anoAtual = new Date().getFullYear();
  if (y === anoAtual) return `${d}/${mo}`;
  return `${d}/${mo}/${y}`;
}

export function grupoFechado(soma, tolerancia = 0.01) {
  return Math.abs(Number(soma) || 0) <= tolerancia;
}
