import { NavLink } from 'react-router-dom';

/** Classes para pills do submenu (ativo: borda + fundo; inativo: neutro + hover). */
export function subNavClass(isActive) {
  const base =
    'inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors border';
  if (isActive) {
    return (
      base +
      ' border-blue-500 dark:border-cyan-400 bg-blue-50 dark:bg-cyan-500/15 text-blue-800 dark:text-cyan-100 shadow-sm'
    );
  }
  return (
    base +
    ' border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
  );
}

export function TopicosSubmenu() {
  return (
    <nav aria-label="Submenu Tópicos" className="flex flex-wrap gap-2 mb-4">
      <NavLink to="/topicos" end className={({ isActive }) => subNavClass(isActive)}>
        Tópicos
      </NavLink>
      <NavLink to="/topicos/gerente" className={({ isActive }) => subNavClass(isActive)}>
        Gerente de Tópicos
      </NavLink>
    </nav>
  );
}
