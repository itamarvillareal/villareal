export function StatsCard({ icon: Icon, label, value, variant = 'default' }) {
  const valueClass =
    variant === 'danger'
      ? 'text-red-600 dark:text-red-400'
      : 'text-slate-900 dark:text-slate-100';

  const iconWrapClass =
    variant === 'danger'
      ? 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400'
      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400';

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${valueClass}`}>{value ?? 0}</p>
        </div>
        {Icon ? (
          <div className={`rounded-lg p-2 ${iconWrapClass}`}>
            <Icon className="w-5 h-5" aria-hidden />
          </div>
        ) : null}
      </div>
    </div>
  );
}
