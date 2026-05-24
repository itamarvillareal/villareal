import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, MessageCircle, Send, CalendarClock } from 'lucide-react';
import { WhatsAppToastProvider } from './WhatsAppToast.jsx';

const TABS = [
  { to: '/whatsapp/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/whatsapp/conversas', label: 'Conversas', icon: MessageCircle },
  { to: '/whatsapp/enviar', label: 'Enviar mensagem', icon: Send },
  { to: '/whatsapp/agendamentos', label: 'Agendamentos', icon: CalendarClock },
];

export function WhatsAppLayout() {
  return (
    <WhatsAppToastProvider>
      <div className="flex flex-col h-full min-h-0">
        <header className="shrink-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <MessageCircle className="w-6 h-6 text-emerald-600" aria-hidden />
            WhatsApp
          </h1>
          <nav className="flex flex-wrap gap-1" aria-label="Seções WhatsApp">
            {TABS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </WhatsAppToastProvider>
  );
}
