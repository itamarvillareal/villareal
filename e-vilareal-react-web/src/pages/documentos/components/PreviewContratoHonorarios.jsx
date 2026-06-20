import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from 'lucide-react';
import { btnPrimary, btnSecondary } from '../documentosStyles.js';
import {
  corpoClausula,
  excluirClausula,
  incluirClausula,
  moverClausula,
  renumerarClausulas,
  rotuloClausula,
} from '../contratoHonorariosClausulasPreview.js';

const editableHtmlClass =
  'prose prose-sm max-w-none min-h-[88px] rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-slate-800 shadow-sm transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 dark:prose-invert dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-200';

const textareaClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900';

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

export function PreviewContratoHonorarios({
  conteudo,
  pdfUrl,
  loading,
  gerandoFinal,
  onConteudoChange,
  onAtualizar,
  onGerarFinal,
  onVoltar,
}) {
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
    setClausulas(renumerarClausulas(clausulas));
  };

  return (
    <section
      className="mb-24 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
      aria-label="Prévia editável do contrato de honorários"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Prévia do contrato de honorários
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Inclua, exclua ou reordene cláusulas — a numeração é ajustada em sequência.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSecondary} disabled={ocupado && !conteudo} onClick={onVoltar}>
            Voltar ao formulário
          </button>
          {conteudo ? (
            <>
              <button type="button" className={btnSecondary} disabled={ocupado} onClick={handleRenumerar}>
                Renumerar cláusulas
              </button>
              <button type="button" className={btnSecondary} disabled={ocupado} onClick={onAtualizar}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Atualizando…
                  </>
                ) : (
                  'Atualizar prévia'
                )}
              </button>
              <button type="button" className={btnPrimary} disabled={ocupado} onClick={onGerarFinal}>
                {gerandoFinal ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Gerando PDF…
                  </>
                ) : (
                  'Gerar PDF final'
                )}
              </button>
            </>
          ) : null}
        </div>
      </header>

      {!conteudo ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 px-4 py-12 text-sm text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" aria-hidden />
          Montando prévia do contrato…
        </div>
      ) : (
      <div className="grid lg:grid-cols-2">
        <div className="max-h-[min(85vh,960px)] space-y-4 overflow-y-auto border-b border-slate-200 px-4 py-4 dark:border-slate-700 lg:border-b-0 lg:border-r">
          <label className="block text-sm">
            <span className={labelClass}>Preâmbulo</span>
            <HtmlEditable
              html={conteudo.preambuloHtml}
              onChange={(html) => patch('preambuloHtml', html)}
              ariaLabel="Preâmbulo do contrato"
            />
          </label>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={labelClass}>Cláusulas</span>
              <button
                type="button"
                className={`${btnSecondary} !px-2.5 !py-1 text-xs`}
                disabled={ocupado}
                onClick={() => setClausulas(incluirClausula(clausulas))}
              >
                <Plus className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                Incluir cláusula
              </button>
            </div>

            {clausulas.map((clausula, index) => (
              <div
                key={`clausula-${index}-${corpoClausula(clausula).slice(0, 24)}`}
                className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                    {rotuloClausula(index + 1)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className={iconBtnClass}
                      disabled={ocupado || index === 0}
                      aria-label={`Mover ${rotuloClausula(index + 1)} para cima`}
                      onClick={() => setClausulas(moverClausula(clausulas, index, -1))}
                    >
                      <ChevronUp className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={iconBtnClass}
                      disabled={ocupado || index === clausulas.length - 1}
                      aria-label={`Mover ${rotuloClausula(index + 1)} para baixo`}
                      onClick={() => setClausulas(moverClausula(clausulas, index, 1))}
                    >
                      <ChevronDown className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={iconBtnClass}
                      disabled={ocupado || clausulas.length <= 1}
                      aria-label={`Excluir ${rotuloClausula(index + 1)}`}
                      onClick={() => setClausulas(excluirClausula(clausulas, index))}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={`${iconBtnClass} !border-indigo-300 !text-indigo-700 dark:!border-indigo-700 dark:!text-indigo-300`}
                      disabled={ocupado}
                      aria-label={`Incluir cláusula após ${rotuloClausula(index + 1)}`}
                      onClick={() => setClausulas(incluirClausula(clausulas, index))}
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
                <textarea
                  rows={index === 2 ? 5 : 3}
                  className={textareaClass}
                  value={clausula || ''}
                  onChange={(e) => patchClausula(index, e.target.value)}
                />
              </div>
            ))}
          </div>

          <label className="block text-sm">
            <span className={labelClass}>Fecho</span>
            <textarea
              rows={3}
              className={textareaClass}
              value={conteudo.fechoHtml || ''}
              onChange={(e) => patch('fechoHtml', e.target.value)}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className={labelClass}>Local e data</span>
              <input
                type="text"
                className={textareaClass}
                value={conteudo.localData || ''}
                onChange={(e) => patch('localData', e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className={labelClass}>Nome contratante (assinatura)</span>
              <input
                type="text"
                className={textareaClass}
                value={conteudo.nomeContratante || ''}
                onChange={(e) => patch('nomeContratante', e.target.value)}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className={labelClass}>Nome contratado (assinatura)</span>
              <input
                type="text"
                className={textareaClass}
                value={conteudo.nomeContratado || ''}
                onChange={(e) => patch('nomeContratado', e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="relative min-h-[480px] bg-slate-100 dark:bg-slate-950">
          {loading && !pdfUrl ? (
            <div className="flex min-h-[480px] flex-col items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" aria-hidden />
              Gerando prévia do PDF…
            </div>
          ) : pdfUrl ? (
            <iframe
              title="Prévia do PDF do contrato"
              src={pdfUrl}
              className="h-[min(85vh,960px)] w-full border-0"
            />
          ) : (
            <div className="flex min-h-[480px] items-center justify-center px-4 text-center text-sm text-slate-500">
              Clique em &quot;Atualizar prévia&quot; para visualizar o PDF.
            </div>
          )}
        </div>
      </div>
      )}
    </section>
  );
}
