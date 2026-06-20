import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { btnPrimary, btnSecondary } from '../documentosStyles.js';

const editableHtmlClass =
  'prose prose-sm max-w-none min-h-[88px] rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-slate-800 shadow-sm transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 dark:prose-invert dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-200';

const textareaClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900';

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

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

  const patch = (campo, valor) => {
    if (!conteudo) return;
    onConteudoChange?.({ ...conteudo, [campo]: valor });
  };

  const patchClausula = (index, valor) => {
    if (!conteudo) return;
    const clausulas = (conteudo.clausulas || []).map((c, i) => (i === index ? valor : c));
    patch('clausulas', clausulas);
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
            Revise e ajuste o texto antes de gerar o PDF final.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSecondary} disabled={ocupado && !conteudo} onClick={onVoltar}>
            Voltar ao formulário
          </button>
          {conteudo ? (
            <>
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

          {(conteudo.clausulas || []).map((clausula, index) => (
            <label key={index} className="block text-sm">
              <span className={labelClass}>
                {clausula?.slice(0, 12)?.includes('Cláusula') ? clausula.slice(0, 20) : `Cláusula ${index + 1}`}
              </span>
              <textarea
                rows={index === 2 ? 5 : 3}
                className={textareaClass}
                value={clausula || ''}
                onChange={(e) => patchClausula(index, e.target.value)}
              />
            </label>
          ))}

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
