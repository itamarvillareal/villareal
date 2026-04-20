import { useState, useEffect } from 'react';
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
  /** Caixa para digitar o nº da página (1…N); Enter ou sair do campo aplica. */
  showPageJumpInput = true,
}) {
  const lastIndex = Math.max(0, totalPages - 1);
  const safePage = Math.min(Math.max(0, page), lastIndex);
  const displayPageOneBased = totalPages < 1 ? 0 : safePage + 1;
  const from = totalElements === 0 ? 0 : safePage * pageSize + 1;
  const to = totalElements === 0 ? 0 : Math.min(totalElements, (safePage + 1) * pageSize);

  const [pageInput, setPageInput] = useState(() => String(displayPageOneBased));

  useEffect(() => {
    setPageInput(String(displayPageOneBased));
  }, [displayPageOneBased, totalPages]);

  const commitPageJump = () => {
    if (totalPages < 1) {
      setPageInput('0');
      return;
    }
    const raw = String(pageInput).trim();
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) {
      setPageInput(String(displayPageOneBased));
      return;
    }
    const clamped = Math.min(Math.max(1, n), totalPages);
    onPageChange(clamped - 1);
    setPageInput(String(clamped));
  };

  const navDisabled = disabled || loading;
  const sizeId = `${idPrefix}-page-size`;
  const jumpId = `${idPrefix}-page-jump`;

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
        {showPageJumpInput && totalPages >= 1 ? (
          <div className="flex items-center gap-1 px-1">
            <label htmlFor={jumpId} className="sr-only">
              Ir para página (de 1 a {totalPages})
            </label>
            <input
              id={jumpId}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              disabled={navDisabled}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={commitPageJump}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitPageJump();
                }
              }}
              className="w-11 sm:w-12 text-center text-xs border border-slate-300 rounded-lg px-1.5 py-1.5 bg-white text-slate-800 tabular-nums focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              aria-label={`Página atual (digite 1 a ${totalPages})`}
            />
            <span className="text-xs text-slate-600 tabular-nums whitespace-nowrap">/ {totalPages}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-600 px-2 min-w-[7rem] text-center tabular-nums">
            {totalPages < 1 ? '0 / 0' : `${safePage + 1} / ${totalPages}`}
          </span>
        )}
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
