import { memo } from 'react';
import { NavLink } from 'react-router-dom';
import { INBOX_TIPOS } from '../constants/financeiroConstants.js';

const TABS = [
  { tipo: INBOX_TIPOS.classificar, label: 'Classificar' },
  { tipo: INBOX_TIPOS.semelhantes, label: 'Escritório' },
  { tipo: INBOX_TIPOS.compensar, label: 'Compensar' },
  { tipo: INBOX_TIPOS.fatura, label: 'Fatura' },
  { tipo: INBOX_TIPOS.inconsistentes, label: 'Inconsistentes' },
  { tipo: INBOX_TIPOS.total, label: 'Total' },
];

export const InboxTabs = memo(function InboxTabs({ counts = {} }) {
  return (
    <nav className="flex flex-wrap gap-1 p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
      {TABS.map(({ tipo, label }) => {
        const n = counts[tipo];
        return (
          <NavLink
            key={tipo}
            to={`/financeiro/inbox/${tipo}`}
            className={({ isActive }) =>
              `px-3.5 py-1.5 text-[13px] rounded-lg border transition-colors ${
                isActive
                  ? 'font-medium bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800'
                  : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
              }`
            }
          >
            {label}
            {n != null ? ` (${Number(n).toLocaleString('pt-BR')})` : ''}
          </NavLink>
        );
      })}
    </nav>
  );
});
