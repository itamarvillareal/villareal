import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { featureFlags } from '../config/featureFlags.js';
import { ImoveisSugestoesVinculoPanel } from './imoveis/ImoveisSugestoesVinculoPanel.jsx';

/**
 * Central de sugestões: todos os imóveis e vários vínculos candidatos por lançamento.
 */
export function ImoveisSugestoesVinculoGeral() {
  const navigate = useNavigate();

  if (!featureFlags.useApiFinanceiro || !featureFlags.useApiImoveis) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-sm text-slate-600">
        Ative <code className="mx-1">VITE_USE_API_FINANCEIRO</code> e{' '}
        <code className="mx-1">VITE_USE_API_IMOVEIS</code> para usar a central de sugestões.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-violet-50/40 to-indigo-50/50 text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/imoveis')}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-violet-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Imóveis
          </button>
          <div className="h-6 w-px bg-slate-200 hidden sm:block" aria-hidden />
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-500/25">
              <Sparkles className="w-5 h-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-900 truncate">Sugestões de vínculo — visão geral</h1>
              <p className="text-xs text-slate-500 max-w-2xl">
                Aprove ou descarte cada combinação lançamento × imóvel (Cod.+Proc.). No financeiro de um imóvel só
                aparece a melhor sugestão por lançamento; aqui você trata todos os casos de uma vez.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        <ImoveisSugestoesVinculoPanel
          variante="page"
          estrategia="todosParesQualificados"
          limite={300}
          maxParesPorLancamento={8}
          mostrarLinkCentral={false}
        />
      </main>
    </div>
  );
}
