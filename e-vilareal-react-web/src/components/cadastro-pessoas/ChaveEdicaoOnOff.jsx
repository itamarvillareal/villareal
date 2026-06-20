/**
 * Chave ON/OFF para habilitar edição do formulário.
 * ON = edição habilitada · OFF = somente leitura.
 */
export function ChaveEdicaoOnOff({ edicaoHabilitada, onChange, disabled = false, className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={edicaoHabilitada}
      aria-label={edicaoHabilitada ? 'Edição habilitada' : 'Edição desabilitada'}
      disabled={disabled}
      onClick={() => onChange(!edicaoHabilitada)}
      className={`group relative inline-flex h-10 w-[5.75rem] shrink-0 items-center rounded-full border-2 p-0.5 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
        edicaoHabilitada
          ? 'border-emerald-300/90 bg-gradient-to-r from-emerald-700 via-emerald-500 to-lime-400 shadow-[0_0_14px_rgba(34,197,94,0.45),inset_0_1px_0_rgba(255,255,255,0.25)] focus-visible:ring-emerald-500'
          : 'border-red-300/90 bg-gradient-to-r from-red-700 via-red-500 to-rose-400 shadow-[0_0_14px_rgba(239,68,68,0.45),inset_0_1px_0_rgba(255,255,255,0.2)] focus-visible:ring-red-500'
      } ${className}`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc(100%-0.25rem)] rounded-full transition-opacity duration-300 ${
          edicaoHabilitada
            ? 'bg-[radial-gradient(circle_at_20%_50%,rgba(134,239,172,0.55),transparent_55%)] opacity-100'
            : 'bg-[radial-gradient(circle_at_80%_50%,rgba(252,165,165,0.45),transparent_55%)] opacity-100'
        }`}
      />
      <span
        aria-hidden
        className={`absolute left-2.5 text-[11px] font-extrabold tracking-[0.12em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] transition-opacity duration-200 ${
          edicaoHabilitada ? 'opacity-100' : 'opacity-35'
        }`}
      >
        ON
      </span>
      <span
        aria-hidden
        className={`absolute right-2 text-[11px] font-extrabold tracking-[0.08em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] transition-opacity duration-200 ${
          edicaoHabilitada ? 'opacity-35' : 'opacity-100'
        }`}
      >
        OFF
      </span>
      <span
        aria-hidden
        className={`relative z-[1] h-8 w-8 rounded-full border border-slate-200/90 bg-gradient-to-b from-white to-slate-100 shadow-[0_2px_6px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.9)] transition-transform duration-300 ease-out ${
          edicaoHabilitada ? 'translate-x-[2.35rem]' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
