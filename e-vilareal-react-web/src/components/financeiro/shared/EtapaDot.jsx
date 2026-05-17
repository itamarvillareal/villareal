import { ETAPA_LABELS } from '../constants/financeiroConstants.js';

export function EtapaDot({ etapa }) {
  const key = String(etapa ?? 'IMPORTADO').trim().toUpperCase();
  const label = ETAPA_LABELS[key] ?? key;
  const varName = `--fin-etapa-${key.toLowerCase()}`;

  return (
    <span
      className="inline-block w-[7px] h-[7px] rounded-full shrink-0"
      style={{ background: `var(${varName}, var(--fin-etapa-importado))` }}
      title={label}
      aria-label={label}
    />
  );
}
