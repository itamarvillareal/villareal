export function ExtratoSkeleton() {
  return (
    <div className="animate-pulse p-3 space-y-2" aria-busy="true" aria-label="Carregando extrato">
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-md" />
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className={`h-10 rounded ${i % 2 === 0 ? 'bg-slate-100 dark:bg-slate-800' : 'bg-slate-200/70 dark:bg-slate-700/70'}`}
        />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="animate-pulse p-4 space-y-4" aria-busy="true" aria-label="Carregando painel">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        ))}
      </div>
      <div className="h-40 bg-slate-200 dark:bg-slate-700 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-lg" />
      </div>
    </div>
  );
}
