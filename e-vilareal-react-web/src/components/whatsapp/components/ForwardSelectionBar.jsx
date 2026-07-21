import { Forward, X } from 'lucide-react';
import { processosBtnPrimary } from '../../processos/ProcessosAdminLayout.jsx';

export function ForwardSelectionBar({ count, onCancel, onForward, disabled = false }) {
  const n = Number(count) || 0;
  if (n <= 0) return null;

  const rotulo = n === 1 ? '1 mensagem selecionada' : `${n} mensagens selecionadas`;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900 dark:bg-emerald-950/40 shrink-0">
      <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">{rotulo}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Cancelar
        </button>
        <button
          type="button"
          onClick={onForward}
          disabled={disabled}
          className={`${processosBtnPrimary} inline-flex items-center gap-1 text-xs py-1.5 px-2.5`}
        >
          <Forward className="h-3.5 w-3.5" aria-hidden />
          Encaminhar
        </button>
      </div>
    </div>
  );
}
