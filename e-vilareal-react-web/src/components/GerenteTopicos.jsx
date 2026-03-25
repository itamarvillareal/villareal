import { LayoutDashboard } from 'lucide-react';
import { TopicosSubmenu } from './topicos/TopicosSubmenu.jsx';
import { TopicosHierarchyPicker } from './topicos/TopicosHierarchyPicker.jsx';

/**
 * Gerente de Tópicos — mesma árvore da tela Tópicos (edição administrativa pode evoluir depois).
 */
export function GerenteTopicos() {
  return (
    <div className="flex-1 flex flex-col min-h-0 p-4 md:p-6 bg-gray-100 dark:bg-slate-900/40">
      <TopicosSubmenu />
      <header className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-sm">
          <LayoutDashboard className="w-7 h-7 text-slate-700 dark:text-slate-200" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Gerente de Tópicos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Visualização da hierarquia compartilhada; ajustes de estrutura em <code className="text-xs">topicosHierarchy.js</code>.
          </p>
        </div>
      </header>
      <TopicosHierarchyPicker />
    </div>
  );
}
