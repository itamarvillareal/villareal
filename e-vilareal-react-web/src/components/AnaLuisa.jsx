import { User } from 'lucide-react';

/**
 * Área dedicada ao atalho do menu lateral «ANA LUISA».
 */
export function AnaLuisa() {
  return (
    <div className="flex flex-1 min-h-0 flex-col min-h-full bg-gradient-to-br from-slate-100 via-indigo-50/35 to-emerald-50/45 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] p-4 md:p-6 overflow-auto">
      <div className="rounded-2xl border border-slate-200/90 dark:border-white/[0.08] bg-white/95 backdrop-blur-sm shadow-xl ring-1 ring-indigo-500/10 dark:ring-white/[0.06] p-5 max-w-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/25 ring-1 ring-white/20">
            <User className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-rose-700 to-pink-700 dark:from-rose-200 dark:to-pink-200 bg-clip-text text-transparent">
              ANA LUISA
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">Página acessível pelo menu à esquerda.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
