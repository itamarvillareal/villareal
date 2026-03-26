import { Layers } from 'lucide-react';
import { TopicosSubmenu } from './topicos/TopicosSubmenu.jsx';
import { TopicosHierarchyPicker } from './topicos/TopicosHierarchyPicker.jsx';
import { useTopicosRaiz } from '../hooks/useTopicosRaiz.js';

/**
 * Tela de tópicos — navegação em camadas e seleção na folha (checkboxes + rolagem).
 * Dados: mock em `src/data/topicosHierarchy.js` ou API com `VITE_USE_API_TOPICOS=true`.
 */
export function Topicos() {
  const { raiz, carregando, erro, usandoApi } = useTopicosRaiz();

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4 md:p-6 bg-gray-100 dark:bg-slate-900/40">
      <TopicosSubmenu />
      <header className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-sm">
          <Layers className="w-7 h-7 text-slate-700 dark:text-slate-200" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Tópicos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Navegue pelas categorias; na última camada, marque os tópicos e clique em Carregar.
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
