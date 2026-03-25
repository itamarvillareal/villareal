import { User } from 'lucide-react';

/**
 * Área dedicada ao atalho do menu lateral «ANA LUISA».
 */
export function AnaLuisa() {
  return (
    <div className="flex flex-1 min-h-0 flex-col p-4 overflow-auto">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200">
          <User className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-slate-100">ANA LUISA</h1>
          <p className="text-sm text-gray-600 dark:text-slate-400">Página acessível pelo menu à esquerda.</p>
        </div>
      </div>
    </div>
  );
}
