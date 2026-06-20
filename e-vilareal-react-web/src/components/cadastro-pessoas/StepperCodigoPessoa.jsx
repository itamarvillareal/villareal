import { ChevronDown, ChevronUp } from 'lucide-react';

const btnStepClass =
  'group relative flex h-[1.35rem] w-10 items-center justify-center overflow-hidden rounded-md border border-slate-400/50 bg-gradient-to-b from-slate-600 via-slate-800 to-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_6px_rgba(0,0,0,0.35),0_0_10px_rgba(34,211,238,0.12)] transition-all duration-150 hover:border-cyan-400/70 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_14px_rgba(34,211,238,0.35)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-slate-400/50 disabled:hover:shadow-none';

const iconStepClass =
  'h-3.5 w-3.5 text-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,0.85)] transition group-hover:text-cyan-200 group-disabled:text-slate-500';

/**
 * Stepper vertical (+1 / −1) para navegar entre códigos de pessoa.
 */
export function StepperCodigoPessoa({ onIncrement, onDecrement, disabled = false, className = '' }) {
  return (
    <div
      className={`flex shrink-0 flex-col gap-1 ${className}`}
      role="group"
      aria-label="Navegar código da pessoa"
    >
      <button
        type="button"
        title="Próximo código (+1)"
        disabled={disabled}
        onClick={onIncrement}
        className={btnStepClass}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.14)_0%,transparent_42%)]"
        />
        <ChevronUp className={iconStepClass} strokeWidth={2.75} aria-hidden />
      </button>
      <button
        type="button"
        title="Código anterior (−1)"
        disabled={disabled}
        onClick={onDecrement}
        className={btnStepClass}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.14)_0%,transparent_42%)]"
        />
        <ChevronDown className={iconStepClass} strokeWidth={2.75} aria-hidden />
      </button>
    </div>
  );
}
