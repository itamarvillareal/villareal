import { Suspense } from 'react';
import { useCloseOnEscape } from '../hooks/useCloseOnEscape.js';
import { X } from 'lucide-react';
import { LazyCadastroPessoas } from '../app/lazyScreens.jsx';

/**
 * Janela suspensa com o formulário de Cadastro de Pessoas (embed), sem mudar de rota.
 * @param {{ embed: { revision: number, pessoaId: number } | null, onFechar: () => void, titulo?: string }} props
 */
export function PessoaEmbedModal({ embed, onFechar, titulo }) {
  useCloseOnEscape(!!embed, onFechar);
  if (!embed) return null;

  const tituloExibicao =
    titulo ??
    (Number.isFinite(Number(embed.pessoaId)) && Number(embed.pessoaId) >= 1
      ? `Pessoa (cadastro) — nº ${embed.pessoaId}`
      : 'Pessoa (cadastro)');

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4 bg-black/55"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pessoa-embed-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        className="flex flex-col w-[min(100vw-0.5rem,1100px)] h-[min(100dvh-0.5rem,900px)] max-h-[min(100dvh-0.5rem,900px)] min-h-0 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f141c] shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#141c2c] shrink-0">
          <h2 id="pessoa-embed-modal-title" className="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {tituloExibicao}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10 shrink-0"
            aria-label="Fechar cadastro de pessoa"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]">
          <Suspense
            fallback={
              <div className="flex min-h-[12rem] items-center justify-center p-8 text-sm text-slate-600 dark:text-slate-400">
                Carregando cadastro de pessoas…
              </div>
            }
          >
            <LazyCadastroPessoas
              key={embed.revision}
              embedIntent={{ pessoaId: embed.pessoaId }}
              embedIntentRevision={embed.revision}
              onFecharEmbed={onFechar}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
