import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2, X } from 'lucide-react';
import {
  corpoClausulaHtml,
  excluirClausulaHtml,
  incluirClausulaHtml,
  moverClausulaHtml,
  renumerarClausulasHtml,
  rotuloClausula,
} from './contratoLocacaoClausulasPreview.js';
import { imoveisBtnPrimary, imoveisBtnSecondary } from './ImoveisAdminLayout.jsx';

const editableHtmlClass =
  'prose prose-sm max-w-none min-h-[72px] rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25 dark:prose-invert dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-200';

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

const iconBtnClass =
  'rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800';

function HtmlEditable({ html, onChange, ariaLabel }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== (html || '')) {
      el.innerHTML = html || '';
    }
  }, [html]);

  return (
    <div
      ref={ref}
      role="textbox"
      aria-multiline="true"
      aria-label={ariaLabel}
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => onChange(e.currentTarget.innerHTML)}
      className={editableHtmlClass}
    />
  );
}

/**
 * Modal de revisão final das cláusulas antes de gerar o PDF do contrato de locação.
 */
export function PreviewContratoLocacao({
  open,
  conteudo,
  loading,
  gerandoFinal,
  onConteudoChange,
  onVoltar,
  onGerarFinal,
  onClose,
}) {
  if (!open) return null;

  const ocupado = loading || gerandoFinal;
  const clausulas = conteudo?.clausulas || [];

  const patch = (campo, valor) => {
    if (!conteudo) return;
    onConteudoChange?.({ ...conteudo, [campo]: valor });
  };

  const setClausulas = (next) => {
    patch('clausulas', next);
  };

  const patchClausula = (index, valor) => {
    if (!conteudo) return;
    const next = clausulas.map((c, i) => (i === index ? valor : c));
    setClausulas(next);
  };

  const handleRenumerar = () => {
    if (!conteudo) return;
    setClausulas(renumerarClausulasHtml(clausulas));
  };

  return (
    <div
      className="fixed inset-0 z-[230] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Revisão das cláusulas do contrato de locação"
    >
      <div className="flex max-h-[min(92vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-600">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Revisão final das cláusulas
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Edite ou exclua cláusulas antes de gerar o PDF.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {!conteudo ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 px-4 py-12 text-sm text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" aria-hidden />
            Montando cláusulas do contrato…
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={labelClass}>Cláusulas ({clausulas.length})</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`${imoveisBtnSecondary} !px-2.5 !py-1 text-xs`}
                    disabled={ocupado}
                    onClick={handleRenumerar}
                  >
                    Renumerar
                  </button>
                  <button
                    type="button"
                    className={`${imoveisBtnSecondary} !px-2.5 !py-1 text-xs`}
                    disabled={ocupado}
                    onClick={() => setClausulas(incluirClausulaHtml(clausulas))}
                  >
                    <Plus className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                    Incluir cláusula
                  </button>
                </div>
              </div>

              {clausulas.map((clausula, index) => (
                <div
                  key={`clausula-loc-${index}-${corpoClausulaHtml(clausula).slice(0, 20)}`}
                  className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                      {rotuloClausula(index + 1)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className={iconBtnClass}
                        disabled={ocupado || index === 0}
                        aria-label={`Mover ${rotuloClausula(index + 1)} para cima`}
                        onClick={() => setClausulas(moverClausulaHtml(clausulas, index, -1))}
                      >
                        <ChevronUp className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={iconBtnClass}
                        disabled={ocupado || index === clausulas.length - 1}
                        aria-label={`Mover ${rotuloClausula(index + 1)} para baixo`}
                        onClick={() => setClausulas(moverClausulaHtml(clausulas, index, 1))}
                      >
                        <ChevronDown className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={iconBtnClass}
                        disabled={ocupado || clausulas.length <= 1}
                        aria-label={`Excluir ${rotuloClausula(index + 1)}`}
                        onClick={() => setClausulas(excluirClausulaHtml(clausulas, index))}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={`${iconBtnClass} !border-teal-300 !text-teal-700 dark:!border-teal-700 dark:!text-teal-300`}
                        disabled={ocupado}
                        aria-label={`Incluir cláusula após ${rotuloClausula(index + 1)}`}
                        onClick={() => setClausulas(incluirClausulaHtml(clausulas, index))}
                      >
                        <Plus className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                  <HtmlEditable
                    html={clausula}
                    onChange={(html) => patchClausula(index, html)}
                    ariaLabel={`Conteúdo da ${rotuloClausula(index + 1)}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-600">
          <button type="button" className={imoveisBtnSecondary} disabled={ocupado} onClick={onVoltar}>
            Voltar
          </button>
          <button
            type="button"
            className={imoveisBtnPrimary}
            disabled={ocupado || !conteudo || clausulas.length === 0}
            onClick={onGerarFinal}
          >
            {gerandoFinal ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                Gerando PDF…
              </>
            ) : (
              'Gerar PDF final'
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
