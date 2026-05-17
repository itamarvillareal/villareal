import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_SIZE_OPTIONS } from '../constants/financeiroConstants.js';

function buildPageWindow(page, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }
  if (page <= 3) return [0, 1, 2, 3, 'ellipsis', totalPages - 1];
  if (page >= totalPages - 4) {
    return [0, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1];
  }
  return [0, 'ellipsis', page - 1, page, page + 1, 'ellipsis', totalPages - 1];
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  totalItems,
}) {
  const safeTotal = Math.max(0, Number(totalItems) || 0);
  const safePages = Math.max(1, Number(totalPages) || 1);
  const current = Math.min(Math.max(0, Number(page) || 0), safePages - 1);
  const size = Number(pageSize) || 100;
  const from = safeTotal === 0 ? 0 : current * size + 1;
  const to = Math.min((current + 1) * size, safeTotal);
  const pageWindow = buildPageWindow(current, safePages);

  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-slate-500 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80">
      <span>
        Mostrando {from}-{to} de {safeTotal.toLocaleString('pt-BR')}
      </span>
      <div className="flex items-center gap-1" role="group" aria-label="Paginação">
        <button
          type="button"
          disabled={current <= 0}
          onClick={() => onPageChange(current - 1)}
          className="p-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Página anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pageWindow.map((p, idx) =>
          p === 'ellipsis' ? (
            <span key={`e-${idx}`} className="px-1">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`min-w-[28px] h-7 px-1 rounded border text-xs font-medium ${
                p === current
                  ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-700'
                  : 'bg-white text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'
              }`}
            >
              {p + 1}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={current >= safePages - 1}
          onClick={() => onPageChange(current + 1)}
          className="p-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Próxima página"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <label className="flex items-center gap-1.5">
        Por pág:
        <select
          value={size}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-1.5 py-0.5 text-xs"
        >
          {PAGE_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
    </footer>
  );
}
