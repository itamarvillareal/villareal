import { nomeContaPorLetra } from '../constants/financeiroConstants.js';

export function ContaBadge({ codigo, size = 'sm', title }) {
  const letra = String(codigo ?? 'N').trim().toUpperCase() || 'N';
  const varBase = `--fin-conta-${letra.toLowerCase()}`;
  const isMd = size === 'md';
  const nome = title ?? nomeContaPorLetra(letra);

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border-[0.5px] ${
        isMd ? 'h-6 text-xs px-2.5' : 'h-5 text-[11px] px-2'
      }`}
      style={{
        background: `var(${varBase}-bg, var(--fin-conta-n-bg))`,
        color: `var(${varBase}, var(--fin-conta-n))`,
        borderColor: `var(${varBase}-border, var(--fin-conta-n-border))`,
      }}
      title={nome ?? undefined}
    >
      {letra}
    </span>
  );
}
