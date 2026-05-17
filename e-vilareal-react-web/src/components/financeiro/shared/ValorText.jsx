const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ValorText({ valor, natureza }) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n === 0) {
    return <span className="font-medium text-slate-500">{fmt.format(0)}</span>;
  }

  const isCredito = natureza === 'CREDITO' || (natureza == null && n > 0);
  const isDebito = natureza === 'DEBITO' || (natureza == null && n < 0);
  const color = isCredito ? 'var(--fin-credito)' : isDebito ? 'var(--fin-debito)' : 'var(--fin-credito)';
  const exib = isDebito && n > 0 ? -n : n;

  return (
    <span className="font-medium tabular-nums" style={{ color }}>
      {fmt.format(exib)}
    </span>
  );
}
