import { ChevronDown, ChevronUp } from 'lucide-react';
import { normalizarCliente, padCliente } from '../../data/processosDadosRelatorio.js';

/**
 * Campo numérico com setas empilhadas à direita (padrão Diagnósticos → data / Prazo Fatal).
 * @param {'card' | 'embedded'} [variant] — `embedded` só a caixa input+setas (ex.: Processos).
 * @param {'number' | 'paddedCliente'} [formato] — código cliente com 8 dígitos.
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
  variant = 'card',
  formato = 'number',
  inputClassName = '',
}) {
  const isCliente = formato === 'paddedCliente';

  const numeroAtual = isCliente
    ? Number(normalizarCliente(value))
    : (() => {
        const n = Number(value);
        return Number.isFinite(n) ? Math.floor(n) : min;
      })();

  const shift = (delta) => {
    if (isCliente) {
      onChange(padCliente(Math.max(1, numeroAtual + delta)));
      return;
    }
    onChange(Math.max(min, numeroAtual + delta));
  };

  const handleInputChange = (e) => {
    const raw = String(e.target.value ?? '');
    if (isCliente) {
      const digits = raw.replace(/\D/g, '');
      onChange(digits);
      return;
    }
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      onChange(min);
      return;
    }
    onChange(Math.max(min, Number.parseInt(digits, 10) || min));
  };

  const handleBlur = (e) => {
    if (isCliente) {
      const digits = String(e.target.value ?? '').replace(/\D/g, '');
      onChange(padCliente(digits || '1'));
    }
    onBlur?.(e);
  };

  const valorInput = isCliente
    ? String(value ?? '')
    : Number.isFinite(numeroAtual)
      ? String(numeroAtual)
      : '';

  const spinbox = (
    <div className="flex h-10 min-h-[2.5rem] overflow-hidden rounded border border-slate-300/90 dark:border-white/[0.12] bg-white dark:bg-[#141c2c] shadow-sm focus-within:ring-2 focus-within:ring-cyan-500/25 dark:focus-within:ring-cyan-400/20 focus-within:border-cyan-500/55">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder={placeholder}
        value={valorInput}
        onChange={handleInputChange}
        onBlur={handleBlur}
        className={`min-w-0 flex-1 border-0 bg-transparent px-3 text-sm tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-0 ${isCliente ? 'text-center font-mono' : ''} ${inputClassName}`}
        aria-label={ariaLabel}
      />
      <div className="flex w-9 shrink-0 flex-col divide-y divide-slate-300/90 dark:divide-white/[0.1] border-l border-slate-300/90 dark:border-white/[0.1] bg-slate-50 dark:bg-white/[0.04]">
        <button
          type="button"
          tabIndex={-1}
          className="flex flex-1 items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] active:bg-slate-200 dark:active:bg-white/[0.12]"
          aria-label="Aumentar"
          onClick={() => shift(1)}
        >
          <ChevronUp className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        </button>
        <button
          type="button"
          tabIndex={-1}
          className="flex flex-1 items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] active:bg-slate-200 dark:active:bg-white/[0.12]"
          aria-label="Diminuir"
          onClick={() => shift(-1)}
        >
          <ChevronDown className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        </button>
      </div>
    </div>
  );

  if (variant === 'embedded') {
    return <div className={className}>{spinbox}</div>;
  }

  return (
    <div className={className}>
      <div className="rounded border border-slate-200/90 dark:border-white/[0.1] bg-white dark:bg-[#141c2c] p-3 shadow-sm">
        {spinbox}
        <p className="mt-2 text-xs leading-snug text-slate-600 dark:text-slate-400 min-h-[1.1rem]">{hint || ' '}</p>
      </div>
    </div>
  );
}
