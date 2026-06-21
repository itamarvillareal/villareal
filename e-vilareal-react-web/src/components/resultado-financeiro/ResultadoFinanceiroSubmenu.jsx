import { NavLink, useLocation } from 'react-router-dom';

function subNavClass(isActive) {
  const base =
    'inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors border';
  if (isActive) {
    return (
      base +
      ' border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-800 dark:text-indigo-100 shadow-sm'
    );
  }
  return (
    base +
    ' border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
  );
}

export function ResultadoFinanceiroSubmenu() {
  const location = useLocation();
  const tipoRecebiveis = new URLSearchParams(location.search).get('tipo')?.toUpperCase();
  const detalheRecebiveis = new URLSearchParams(location.search).get('detalhe');
  const cobrancaAtiva =
    location.pathname.replace(/\/+$/, '') === '/recebiveis' &&
    tipoRecebiveis === 'HONORARIOS' &&
    detalheRecebiveis === 'cobranca';

  return (
    <nav aria-label="Submenu Resultado financeiro" className="mb-4 flex flex-wrap gap-2">
      <NavLink
        to="/resultado-financeiro/autos"
        className={({ isActive }) => subNavClass(isActive)}
      >
        Resultado nos autos
      </NavLink>
      <NavLink
        to="/recebiveis?tipo=HONORARIOS&detalhe=cobranca"
        className={() => subNavClass(cobrancaAtiva)}
      >
        Cobrança de honorários
      </NavLink>
    </nav>
  );
}
