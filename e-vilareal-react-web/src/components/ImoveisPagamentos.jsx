import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet } from 'lucide-react';
import { Pagamentos } from './Pagamentos.jsx';

export function ImoveisPagamentos() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-100 via-violet-50/40 to-indigo-50/50 text-slate-900 dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] dark:text-slate-100">
      <header className="border-b border-slate-200/80 dark:border-white/[0.08] bg-white/95 dark:bg-[#141c2c]/95 backdrop-blur-sm sticky top-0 z-10 shadow-sm shrink-0">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/imoveis')}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-violet-800 dark:hover:text-violet-300"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden />
            Imóveis
          </button>
          <div className="h-6 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" aria-hidden />
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-500/25">
              <Wallet className="w-5 h-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate">Pagamentos</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
                Contas a pagar ligadas a imóveis: condomínio, aluguel, tributos, utilidades e repasses. Vincule imóvel,
                cliente e processo em cada lançamento.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6">
        <Pagamentos ocultarCabecalho />
      </main>
    </div>
  );
}
