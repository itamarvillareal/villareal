import { Link } from 'react-router-dom';

export function EmptyState({ icon: Icon, title, subtitle, actionTo, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon ? <Icon className="w-12 h-12 text-emerald-500 mb-3" aria-hidden /> : null}
      <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-slate-500 max-w-md">{subtitle}</p> : null}
      {actionTo && actionLabel ? (
        <Link to={actionTo} className="mt-4 text-sm text-blue-600 hover:underline dark:text-blue-400">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
