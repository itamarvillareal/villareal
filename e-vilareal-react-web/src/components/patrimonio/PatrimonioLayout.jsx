import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Scale,
  Landmark,
  GitCompareArrows,
  Wallet,
  Archive,
} from 'lucide-react';

const navClass = ({ isActive }) =>
  `flex items-center gap-2 px-3 py-1.5 text-[13px] rounded-md transition-colors ${
    isActive
      ? 'font-medium bg-white dark:bg-slate-800 border-l-2 border-teal-600 text-slate-900 dark:text-slate-100 -ml-px pl-[11px]'
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
  }`;

const LINKS = [
  { to: '/patrimonio', end: true, label: 'Consolidação', Icon: LayoutDashboard },
  { to: '/patrimonio/passivos', label: 'Passivos', Icon: Landmark },
  { to: '/patrimonio/amortizacao', label: 'Amortizar vs investir', Icon: Scale },
  { to: '/patrimonio/comparador', label: 'Comparador universal', Icon: GitCompareArrows },
  { to: '/patrimonio/ativos', label: 'Ativos (cadastro)', Icon: Wallet },
  { to: '/patrimonio/legado', label: 'Cadastro local (legado)', Icon: Archive },
];

export function PatrimonioLayout() {
  return (
    <div className="flex h-full min-h-0 gap-0">
      <aside className="w-56 shrink-0 border-r border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 py-3 overflow-y-auto">
        <p className="px-3 pt-1 pb-1 text-[11px] uppercase tracking-wider text-slate-400 font-medium">
          Gestão patrimonial
        </p>
        <nav className="px-1 space-y-0.5" aria-label="Navegação patrimônio">
          {LINKS.map(({ to, end, label, Icon }) => (
            <NavLink key={to} to={to} end={end} className={navClass}>
              <Icon className="w-[15px] h-[15px] shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1 min-w-0 overflow-y-auto p-4 md:p-6">
        <Outlet />
      </div>
    </div>
  );
}
