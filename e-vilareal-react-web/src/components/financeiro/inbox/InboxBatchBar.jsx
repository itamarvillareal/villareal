import { Check, X } from 'lucide-react';

export function InboxBatchBar({ count, onAprovarTodos, onPular, aprovarLabel = 'Aprovar todos', busy }) {
  if (!count || count <= 0) return null;

  return (
    <div
      className="sticky top-0 z-10 flex flex-wrap items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/50 border-b border-blue-100 dark:border-blue-900 shrink-0"
      role="toolbar"
      aria-label="Ações em lote"
    >
      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
        ☑ {count} selecionado{count !== 1 ? 's' : ''}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={onAprovarTodos}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
      >
        <Check className="w-3.5 h-3.5" />
        {aprovarLabel}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onPular}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
      >
        <X className="w-3.5 h-3.5" />
        Pular
      </button>
    </div>
  );
}
