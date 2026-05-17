import { X } from 'lucide-react';

export function FilterTag({ label, onRemove, contaCodigo, style: styleProp, title }) {
  const letra = contaCodigo ? String(contaCodigo).trim().toLowerCase() : null;
  const style =
    styleProp ??
    (letra
      ? {
          background: `var(--fin-conta-${letra}-bg)`,
          borderColor: `var(--fin-conta-${letra}-border)`,
          color: `var(--fin-conta-${letra})`,
        }
      : undefined);

  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border-[0.5px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
      style={style}
      title={title}
    >
      {label}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="p-0.5 opacity-70 hover:opacity-100"
          aria-label={`Remover filtro ${label}`}
        >
          <X className="w-2.5 h-2.5" />
        </button>
      ) : null}
    </span>
  );
}
