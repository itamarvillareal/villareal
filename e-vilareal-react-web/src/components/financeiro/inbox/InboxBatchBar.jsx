import { Check, Tag, X } from 'lucide-react';

export function InboxBatchBar({
  count,
  onAprovarTodos,
  onPular,
  aprovarLabel = 'Aprovar todos',
  busy,
  contas = [],
  contaLoteId = '',
  onContaLoteChange,
  onClassificarComConta,
}) {
  if (!count || count <= 0) return null;

  const modoClassificar = contas.length > 0 && onClassificarComConta;
  const contaEscolhida = modoClassificar
    ? contas.find((c) => String(c.id) === String(contaLoteId))
    : null;
  const codigoEscolhido = contaEscolhida?.codigo ?? '';

  return (
    <div
      className="sticky top-0 z-10 flex flex-wrap items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/50 border-b border-blue-100 dark:border-blue-900 shrink-0"
      role="toolbar"
      aria-label="Ações em lote"
    >
      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
        ☑ {count} selecionado{count !== 1 ? 's' : ''}
      </span>

      {modoClassificar ? (
        <>
          <select
            value={contaLoteId}
            onChange={(e) => onContaLoteChange?.(e.target.value)}
            disabled={busy}
            className="text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 min-w-[10rem]"
            aria-label="Conta para classificar seleção"
          >
            <option value="">Classificar como…</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} — {c.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !contaLoteId}
            onClick={onClassificarComConta}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Tag className="w-3.5 h-3.5" />
            {codigoEscolhido ? `Classificar como ${codigoEscolhido}` : 'Classificar'}
          </button>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-600" aria-hidden>
            |
          </span>
        </>
      ) : null}

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
