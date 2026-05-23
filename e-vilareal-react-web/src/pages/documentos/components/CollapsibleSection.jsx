import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export function CollapsibleSection({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-800 dark:text-slate-100"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        )}
        {title}
      </button>
      {open && <div className="space-y-4 border-t border-slate-100 px-4 py-4 dark:border-slate-800">{children}</div>}
    </section>
  );
}
