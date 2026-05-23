import { X } from 'lucide-react';
import { btnGhost, btnPrimary } from '../documentosStyles.js';

export function PreviewPeticao({ open, preview, loading, onClose, onGerarPdf }) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px]"
        aria-label="Fechar preview"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-peticao-titulo"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 id="preview-peticao-titulo" className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Preview da petição
          </h2>
          <button type="button" className={btnGhost} onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 text-sm">
          {loading && (
            <p className="text-slate-500 dark:text-slate-400">Gerando conteúdo com IA…</p>
          )}
          {!loading && preview && (
            <div className="space-y-6">
              {preview.numeroProcesso && (
                <p className="text-xs text-slate-500">
                  Processo: <span className="font-medium text-slate-700 dark:text-slate-300">{preview.numeroProcesso}</span>
                </p>
              )}
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Endereçamento</h3>
                <p className="text-slate-800 dark:text-slate-200">{preview.enderecamento}</p>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Preâmbulo</h3>
                <div
                  className="prose prose-sm max-w-none text-slate-800 dark:prose-invert dark:text-slate-200"
                  dangerouslySetInnerHTML={{ __html: preview.preambulo }}
                />
              </div>
              {(preview.secoes || []).map((secao, i) => (
                <div key={i}>
                  <h3 className="mb-2 font-semibold text-slate-900 dark:text-slate-100">{secao.titulo}</h3>
                  <div
                    className="prose prose-sm max-w-none text-slate-800 dark:prose-invert dark:text-slate-200"
                    dangerouslySetInnerHTML={{ __html: secao.conteudo }}
                  />
                </div>
              ))}
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Pedidos</h3>
                <ol className="list-decimal space-y-2 pl-5 text-slate-800 dark:text-slate-200">
                  {(preview.pedidos || []).map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>

        <footer className="flex gap-2 border-t border-slate-200 p-4 dark:border-slate-700">
          <button type="button" className={btnPrimary} disabled={!preview || loading} onClick={onGerarPdf}>
            Gerar PDF
          </button>
          <button type="button" className={btnGhost} onClick={onClose}>
            Fechar
          </button>
        </footer>
      </aside>
    </>
  );
}
