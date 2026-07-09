import { Hash, MoreHorizontal, SlidersHorizontal, X } from 'lucide-react';

/** Rótulos curtos para abas no celular. */
export const CALCULOS_TAB_SHORT = {
  Títulos: 'Títulos',
  'Custas Judiciais': 'Custas',
  Parcelamento: 'Parc.',
  Pagamento: 'Pagto.',
  Honorários: 'Hon.',
  'Descrição dos Valores': 'Valores',
};

export function CalculosMobileTabBar({ tabs, tabAtiva, onTabChange }) {
  return (
    <div
      className="shrink-0 border-b border-slate-200 bg-white lg:hidden"
      role="tablist"
      aria-label="Abas do cálculo"
    >
      <div className="flex gap-1 overflow-x-auto px-2 py-1.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const ativo = tabAtiva === tab;
          const rotulo = CALCULOS_TAB_SHORT[tab] ?? tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={ativo}
              onClick={() => onTabChange(tab)}
              className={`shrink-0 min-h-10 rounded-full px-3.5 text-sm font-medium transition-colors ${
                ativo
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {rotulo}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CalculosMobileResumoParametros({ dataCalculo, juros, multa, indice, onAbrirParametros, visivel }) {
  if (!visivel) return null;
  return (
    <div className="shrink-0 flex gap-1.5 overflow-x-auto border-b border-slate-200 bg-slate-50 px-2 py-1.5 lg:hidden [-webkit-overflow-scrolling:touch]">
      <button
        type="button"
        onClick={onAbrirParametros}
        className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700"
      >
        Data {dataCalculo || '—'}
      </button>
      <button
        type="button"
        onClick={onAbrirParametros}
        className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700"
      >
        Juros {juros || '0'}%
      </button>
      <button
        type="button"
        onClick={onAbrirParametros}
        className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700"
      >
        Multa {multa || '0'}%
      </button>
      <button
        type="button"
        onClick={onAbrirParametros}
        className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700"
      >
        {indice || 'Índice'}
      </button>
    </div>
  );
}

export function CalculosMobileStatusBar({
  aceitarPagamento,
  modoAlteracao,
  onToggleAceitar,
  onToggleModoAlteracao,
}) {
  return (
    <div className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-200 bg-white px-3 py-2 text-xs lg:hidden">
      <label className="flex min-h-9 items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={aceitarPagamento}
          onChange={(e) => onToggleAceitar(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        <span className="font-medium text-slate-800">Aceitar pagamento</span>
      </label>
      <label className="flex min-h-9 items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={modoAlteracao}
          onChange={(e) => onToggleModoAlteracao(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        <span className="text-slate-700">Modo alteração</span>
      </label>
    </div>
  );
}

export function CalculosMobileBottomSheet({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[55] lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Fechar painel"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[min(90dvh,720px)] flex-col rounded-t-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">
          {children}
        </div>
      </div>
    </div>
  );
}

export function CalculosMobileToolbar({ painelAberto, onRodada, onParametros, onAcoes, parametrosDisponivel }) {
  const btnBase =
    'flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-1.5 text-[11px] font-semibold transition-colors';
  const btnAtivo = 'border-blue-600 bg-blue-50 text-blue-900';
  const btnIdle = 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50';

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white px-2 pt-2 pb-[max(0.35rem,env(safe-area-inset-bottom))] lg:hidden">
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onRodada}
          className={`${btnBase} ${painelAberto === 'rodada' ? btnAtivo : btnIdle}`}
        >
          <Hash className="h-4 w-4 shrink-0" aria-hidden />
          Rodada
        </button>
        <button
          type="button"
          onClick={onParametros}
          disabled={!parametrosDisponivel}
          className={`${btnBase} ${painelAberto === 'parametros' ? btnAtivo : btnIdle} disabled:opacity-40`}
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
          Parâmetros
        </button>
        <button
          type="button"
          onClick={onAcoes}
          className={`${btnBase} ${painelAberto === 'acoes' ? btnAtivo : btnIdle}`}
        >
          <MoreHorizontal className="h-4 w-4 shrink-0" aria-hidden />
          Ações
        </button>
      </div>
    </div>
  );
}
