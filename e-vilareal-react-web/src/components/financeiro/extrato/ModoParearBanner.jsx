import { Link2, Loader2 } from 'lucide-react';

export function ModoParearBanner({ pareando = false }) {
  return (
    <p className="mx-3 mb-2 flex items-center gap-2 text-xs text-emerald-900 dark:text-emerald-100 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2">
      {pareando ? (
        <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" aria-hidden />
      ) : (
        <Link2 className="w-3.5 h-3.5 shrink-0" aria-hidden />
      )}
      <span>
        {pareando
          ? 'Pareando lançamentos…'
          : 'Clique em outro lançamento na tabela para formar o par de compensação.'}
      </span>
    </p>
  );
}
