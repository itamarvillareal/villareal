import { ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from 'lucide-react';

const DEFAULT_SIZES = [10, 20, 25, 50, 100];

export function TablePaginationBar({
  page,
  totalPages,
  totalElements = 0,
  pageSize,
  pageSizeOptions = DEFAULT_SIZES,
  onPageChange,
  onPageSizeChange,
  loading = false,
  disabled = false,
  className = '',
  idPrefix = 'table-pag',
}) {
  const lastIndex = Math.max(0, totalPages - 1);
  const safePage = Math.min(Math.max(0, page), lastIndex);
  const from = totalElements === 0 ? 0 : safePage * pageSize + 1;
  const to = totalElements === 0 ? 0 : Math.min(totalElements, (safePage + 1) * pageSize);

  const navDisabled = disabled || loading;
  const sizeId = `${idPrefix}-page-size`;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-3 py-2 border-t border-slate-200 bg-slate-50 ${className}`}
      role="navigation"
      aria-label="Paginação da tabela"
    >
      <p className="text-xs text-slate-600 order-2 sm:order-1">
        {totalElements > 0 ? (
          <>
            <span className="font-medium text-slate-800">{from}</span>
            {' — '}
            <span className="font-medium text-slate-800">{to}</span>
            {' de '}
            <span className="font-semibold text-slate-800">{totalElements}</span>
          </>
        ) : (
          <span>Nenhum registro</span>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-2 order-1 sm:order-2">
        <label htmlFor={sizeId} className="text-xs text-slate-600 whitespace-nowrap">
          Por página
        </label>
        <select
          id={sizeId}
          value={pageSize}
          disabled={navDisabled}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1 order-3 w-full sm:w-auto justify-center sm:justify-end">
        <button
          type="button"
          disabled={navDisabled || safePage <= 0}
          onClick={() => onPageChange(0)}
          className="p-2 rounded border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-50"
          aria-label="Primeira página"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={navDisabled || safePage <= 0}
          onClick={() => onPageChange(safePage - 1)}
          className="p-2 rounded border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-50"
          aria-label="Página anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-slate-600 px-2 min-w-[7rem] text-center tabular-nums">
          {totalPages < 1 ? '0 / 0' : `${safePage + 1} / ${totalPages}`}
        </span>
        <button
          type="button"
          disabled={navDisabled || safePage >= lastIndex}
          onClick={() => onPageChange(safePage + 1)}
          className="p-2 rounded border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-50"
          aria-label="Próxima página"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={navDisabled || safePage >= lastIndex}
          onClick={() => onPageChange(lastIndex)}
          className="p-2 rounded border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-50"
          aria-label="Última página"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
