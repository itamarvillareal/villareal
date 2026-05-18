import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Campo numérico com setas +/- (mesmo padrão visual de Diagnósticos → Prazo Fatal).
 */
export function CampoNumeroComContador({
  value,
  onChange,
  ariaLabel,
  placeholder = '',
  hint = '',
  min = 1,
  onBlur,
  className = '',
}) {
  const n = Number(value);
  const atual = Number.isFinite(n) ? Math.floor(n) : min;

  const shift = (delta) => {
    onChange(Math.max(min, atual + delta));
  };

  const handleInputChange = (e) => {
    const digits = String(e.target.value ?? '').replace(/\D/g, '');
    if (!digits) {
      onChange(min);
      return;
    }
    onChange(Math.max(min, Number.parseInt(digits, 10) || min));
  };

  return (
    <div className={className}>
      <div className="rounded border border-slate-200/90 dark:border-white/[0.1] bg-white dark:bg-[#141c2c] p-3 shadow-sm">
        <div className="flex h-10 min-h-[2.5rem] overflow-hidden rounded border border-slate-300/90 dark:border-white/[0.12] bg-white dark:bg-[#141c2c] shadow-sm focus-within:ring-2 focus-within:ring-cyan-500/25 dark:focus-within:ring-cyan-400/20 focus-within:border-cyan-500/55">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder={placeholder}
            value={Number.isFinite(atual) ? String(atual) : ''}
            onChange={handleInputChange}
            onBlur={onBlur}
            className="min-w-0 flex-1 border-0 bg-transparent px-3 text-sm tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-0"
            aria-label={ariaLabel}
          />
          <div className="flex w-9 shrink-0 flex-col divide-y divide-slate-300/90 dark:divide-white/[0.1] border-l border-slate-300/90 dark:border-white/[0.1] bg-slate-50 dark:bg-white/[0.04]">
            <button
              type="button"
              className="flex flex-1 items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] active:bg-slate-200 dark:active:bg-white/[0.12]"
              aria-label="Aumentar"
              onClick={() => shift(1)}
            >
              <ChevronUp className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            </button>
            <button
              type="button"
              className="flex flex-1 items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] active:bg-slate-200 dark:active:bg-white/[0.12]"
              aria-label="Diminuir"
              onClick={() => shift(-1)}
            >
              <ChevronDown className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs leading-snug text-slate-600 dark:text-slate-400 min-h-[1.1rem]">{hint || ' '}</p>
      </div>
    </div>
  );
}
