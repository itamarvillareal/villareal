export function StatusBadge({ icon: Icon, children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    success: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    warning: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    danger: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${tones[tone] ?? tones.neutral}`}
    >
      {Icon ? <Icon className="w-3 h-3 shrink-0" aria-hidden /> : null}
      {children}
    </span>
  );
}
