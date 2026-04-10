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
    <div className="flex-1 flex flex-col min-h-0 p-4 md:p-6 min-h-full bg-gradient-to-br from-slate-100 via-indigo-50/35 to-emerald-50/45 dark:bg-slate-900/40">
      <TopicosSubmenu />
      <header className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/20 dark:ring-white/10">
          <LayoutDashboard className="w-7 h-7" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-800 to-violet-800 dark:from-indigo-200 dark:to-violet-200 bg-clip-text text-transparent">
            Gerente de Tópicos
          </h1>
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
