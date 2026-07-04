/**
 * Barra de ações em massa para seleção múltipla na lista de conversas.
 * `actions`: [{ id, label, onClick, primary?, disabled?, title? }]
 */
export function WhatsAppConversationSelectionBar({ selectedCount, actions = [], onCancel, busy = false }) {
  if (selectedCount <= 0) return null;

  return (
    <div className="sticky bottom-0 z-10 shrink-0 border-t border-slate-200 bg-white/95 p-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 tabular-nums">
          {selectedCount} selecionada{selectedCount === 1 ? '' : 's'}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              disabled={busy || action.disabled}
              title={action.title ?? action.label}
              className={
                action.primary
                  ? 'inline-flex items-center rounded-md bg-emerald-700 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-600 disabled:opacity-50'
                  : 'inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }
            >
              {action.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
