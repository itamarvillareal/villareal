import { Check, Trash2, X } from 'lucide-react';

export function AnalisesBatchBar({
  count,
  onAprovar,
  onDescartar,
  onLimpar,
  busy,
  progress,
  onCancelar,
  modoConfirmar = false,
}) {
  if (!count || count <= 0) return null;

  const labelAcao = modoConfirmar ? 'Confirmar selecionados' : 'Aprovar selecionados';

  if (progress) {
    const pct = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
    return (
      <div
        className={`sticky top-0 z-10 px-3 py-2 border-b space-y-2 ${
          modoConfirmar
            ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900'
            : 'bg-blue-50 dark:bg-blue-950/50 border-blue-100 dark:border-blue-900'
        }`}
        role="status"
        aria-live="polite"
      >
        <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
          <span>{progress.label ?? `Processando ${progress.current} de ${progress.total}…`}</span>
          {progress.detail ? <span className="tabular-nums">{progress.detail}</span> : null}
        </div>
        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full transition-all ${modoConfirmar ? 'bg-orange-500' : 'bg-blue-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {onCancelar ? (
          <button
            type="button"
            className="text-xs text-red-600 dark:text-red-400 hover:underline"
            onClick={onCancelar}
          >
            Cancelar após o item atual
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`sticky top-0 z-10 flex flex-wrap items-center gap-2 px-3 py-2 border-b ${
        modoConfirmar
          ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900'
          : 'bg-blue-50 dark:bg-blue-950/50 border-blue-100 dark:border-blue-900'
      }`}
      role="toolbar"
      aria-label="Ações em lote nas recorrências"
    >
      <span
        className={`text-sm font-medium ${
          modoConfirmar ? 'text-orange-900 dark:text-orange-200' : 'text-blue-800 dark:text-blue-200'
        }`}
      >
        {count} selecionado{count !== 1 ? 's' : ''}
        {modoConfirmar ? (
          <span className="ml-1.5 font-normal text-orange-700/90 dark:text-orange-300/90">
            · valor divergente
          </span>
        ) : null}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={onAprovar}
        title={
          modoConfirmar
            ? 'Confirma classificação ignorando diferença de valor nos selecionados'
            : undefined
        }
        className={
          modoConfirmar
            ? 'inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-orange-400 bg-orange-100 text-orange-950 hover:bg-orange-200 dark:bg-orange-950/50 dark:border-orange-600 dark:text-orange-100 disabled:opacity-50'
            : 'inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'
        }
      >
        <Check className="w-3.5 h-3.5" />
        {labelAcao}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onDescartar}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Descartar selecionados
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onLimpar}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 ml-auto"
      >
        <X className="w-3.5 h-3.5" />
        Limpar seleção
      </button>
    </div>
  );
}
