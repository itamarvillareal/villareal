import { NavLink } from 'react-router-dom';
import {
  Users,
  UserCircle,
  Folder,
  Calculator,
  Building2,
  Calendar,
  CircleDollarSign,
  FileSpreadsheet,
  AlertTriangle,
  Briefcase,
  Scale,
  Activity,
  UserCog,
} from 'lucide-react';
import { navItems } from '../data/mockData';

const iconMap = {
  Users,
  UserCircle,
  Folder,
  Calculator,
  Building2,
  Calendar,
  CircleDollarSign,
  FileSpreadsheet,
  AlertTriangle,
  Briefcase,
  Scale,
  Activity,
  UserCog,
};

export function Sidebar() {
  return (
    <aside className="w-48 min-h-screen bg-gray-200 border-r border-gray-300 flex flex-col shrink-0 shadow-sm">
      <div className="p-4 border-b border-gray-300 bg-gray-100">
        <h2 className="font-semibold text-gray-800 text-sm">villa real advocacia</h2>
        <p className="text-xs text-gray-500">Projeto Jurídico</p>
      </div>
      <nav className="flex-1 p-2">
        {navItems.map((item) => {
          const Icon = iconMap[item.icon];
          return (
            <NavLink
              key={item.id}
              to={`/${item.id}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-gray-700 text-sm font-medium transition-colors mb-0.5 ${
                  isActive
                    ? 'bg-blue-100 text-blue-800 border-l-2 border-blue-500'
                    : 'hover:bg-gray-100'
                }`
              }
            >
              {Icon && <Icon className="w-5 h-5 shrink-0" />}
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
