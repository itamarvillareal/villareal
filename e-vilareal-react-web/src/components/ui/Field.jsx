export function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 tracking-tight">{label}</label>
      {children}
    </div>
  );
}
