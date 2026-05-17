import { NavLink, Outlet } from 'react-router-dom';
import { Wallet, FileBarChart } from 'lucide-react';

const linkClass = ({ isActive }) =>
  `inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
    isActive
      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md ring-1 ring-emerald-400/40'
      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-emerald-200'
  }`;

export function FinanceiroLayout() {
  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-indigo-50/35 to-emerald-50/45 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] flex flex-col">
      <div className="max-w-[2000px] mx-auto w-full flex flex-col flex-1 min-h-0 min-w-0">
        <header className="px-4 py-3 shrink-0 rounded-b-xl border border-slate-200/80 border-t-0 bg-white/90 shadow-sm backdrop-blur-sm mx-2 mt-2 mb-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 text-white shadow-md ring-1 ring-emerald-400/40">
                <Wallet className="w-5 h-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-emerald-900 to-indigo-900 dark:from-slate-100 dark:via-emerald-200 dark:to-indigo-200 bg-clip-text text-transparent">
                  Financeiro
                </h1>
                <p className="text-xs text-slate-500">Extratos, consolidado e relatórios</p>
              </div>
            </div>
            <nav className="flex flex-wrap gap-2" aria-label="Submenu Financeiro">
              <NavLink to="/financeiro" end className={linkClass}>
                <Wallet className="w-4 h-4 shrink-0" aria-hidden />
                Extratos
              </NavLink>
              <NavLink to="/financeiro/relatorios" className={linkClass}>
                <FileBarChart className="w-4 h-4 shrink-0" aria-hidden />
                Relatórios
              </NavLink>
            </nav>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
