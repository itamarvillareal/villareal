import { LayoutDashboard } from 'lucide-react';
import { TopicosSubmenu } from './topicos/TopicosSubmenu.jsx';
import { TopicosHierarchyPicker } from './topicos/TopicosHierarchyPicker.jsx';
import { useTopicosRaiz } from '../hooks/useTopicosRaiz.js';

/**
 * Gerente de Tópicos — mesma árvore da tela Tópicos (edição administrativa pode evoluir depois).
 */
export function GerenteTopicos() {
  const { raiz, carregando, erro, usandoApi } = useTopicosRaiz();

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
            Visualização da hierarquia compartilhada; com <code className="text-xs">VITE_USE_API_TOPICOS</code> os dados
            vêm do backend; caso contrário use <code className="text-xs">topicosHierarchy.js</code>.
          </p>
        </div>
      </header>
      {usandoApi && carregando ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Carregando tópicos…</p>
      ) : raiz ? (
        <>
          <TopicosHierarchyPicker raiz={raiz} />
          {usandoApi && erro ? (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-3 max-w-3xl">
              Não foi possível carregar do servidor; exibindo hierarquia local.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
