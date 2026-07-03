import { Building2, X } from 'lucide-react';

export function ConsolidadoImoveisBatchBar({
  count,
  onVincularImovel,
  onLimparSelecao,
  busy,
}) {
  if (!count || count <= 0) return null;

  return (
    <div
      className="sticky top-0 z-10 flex flex-wrap items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900 shrink-0"
      role="toolbar"
      aria-label="Ações em lote — Conta Imóveis"
    >
      <span className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
        {count.toLocaleString('pt-BR')} selecionado{count !== 1 ? 's' : ''}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={onVincularImovel}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        <Building2 className="w-3.5 h-3.5" aria-hidden />
        {busy ? 'Vinculando…' : 'Vincular imóvel'}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onLimparSelecao}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
      >
        <X className="w-3.5 h-3.5" aria-hidden />
        Limpar seleção
      </button>
    </div>
  );
}
