export function BancoItem({ nome, count, ativo, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left text-xs py-1.5 px-3 flex items-center justify-between gap-1 transition-colors ${
        ativo
          ? 'font-medium bg-white dark:bg-slate-800 border-l-2 border-amber-500 text-slate-900 dark:text-slate-100'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
    >
      <span className="truncate">{nome}</span>
      {count != null ? (
        <span className="shrink-0 text-slate-400 tabular-nums">
          {Number(count).toLocaleString('pt-BR')}
        </span>
      ) : null}
    </button>
  );
}
