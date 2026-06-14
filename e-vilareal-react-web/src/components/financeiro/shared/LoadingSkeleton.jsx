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

export function AnalisesStatusCarregando({ mensagem = 'Carregando análises contábeis…' }) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-sm text-blue-800 dark:text-blue-200"
      role="status"
      aria-live="polite"
    >
      <span
        className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 dark:border-blue-800 dark:border-t-blue-400"
        aria-hidden="true"
      />
      <span>{mensagem}</span>
      <span className="text-xs text-blue-600/80 dark:text-blue-300/80">Pode levar alguns segundos.</span>
    </div>
  );
}

export function AnalisesRecorrenciasSkeleton() {
  return (
    <div className="p-3 space-y-2 animate-pulse" aria-busy="true" aria-label="Carregando recorrências">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
      ))}
    </div>
  );
}

export function AnalisesPageSkeleton() {
  return (
    <div className="min-h-0 h-full overflow-auto p-4 space-y-4 max-w-5xl">
      <header className="space-y-1">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="h-4 w-36 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
      </header>
      <AnalisesStatusCarregando mensagem="Preparando análises contábeis…" />
      <DashboardSkeleton />
    </div>
  );
}
