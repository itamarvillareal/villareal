import { useEffect, useRef } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { btnGhost, btnPrimary, btnSecondary, inputClass, textareaClass } from '../documentosStyles.js';
import { useCloseOnEscape } from '../../../hooks/useCloseOnEscape.js';

const editableHtmlClass =
  'prose prose-sm max-w-none min-h-[88px] rounded-lg border border-slate-300/90 bg-white px-3 py-2 text-slate-800 shadow-sm transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 dark:prose-invert dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-200';

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';

function HtmlEditable({ html, onChange, className, ariaLabel }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el === document.activeElement || el.contains(document.activeElement)) return;
    const next = html || '';
    if (el.innerHTML !== next) {
      el.innerHTML = next;
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
      onBlur={(e) => onChange(e.currentTarget.innerHTML)}
      className={className}
    />
  );
}

export function PreviewPeticao({ open, preview, loading, erro, gerando, onClose, onGerarPdf, onPreviewChange }) {
  useCloseOnEscape(open, onClose, { enabled: !gerando });

  if (!open) return null;

  const patch = (campo, valor) => {
    if (!onPreviewChange) return;
    onPreviewChange({ ...preview, [campo]: valor });
  };

  const patchSecao = (index, campo, valor) => {
    const secoes = (preview.secoes || []).map((s, i) => (i === index ? { ...s, [campo]: valor } : s));
    patch('secoes', secoes);
  };

  const adicionarSecao = () => {
    patch('secoes', [...(preview.secoes || []), { titulo: 'NOVA SEÇÃO', conteudo: '' }]);
  };

  const removerSecao = (index) => {
    patch('secoes', (preview.secoes || []).filter((_, i) => i !== index));
  };

  const patchPedido = (index, valor) => {
    const pedidos = (preview.pedidos || []).map((p, i) => (i === index ? valor : p));
    patch('pedidos', pedidos);
  };

  const adicionarPedido = () => {
    patch('pedidos', [...(preview.pedidos || []), '']);
  };

  const removerPedido = (index) => {
    patch('pedidos', (preview.pedidos || []).filter((_, i) => i !== index));
  };

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
          <div>
            <h2 id="preview-peticao-titulo" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Preview da petição
            </h2>
            {!loading && preview && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Edite o conteúdo abaixo antes de gerar o PDF.
              </p>
            )}
          </div>
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
              <div>
                <label className={labelClass} htmlFor="preview-numero-processo">
                  Processo
                </label>
                <input
                  id="preview-numero-processo"
                  type="text"
                  className={inputClass}
                  value={preview.numeroProcesso || ''}
                  placeholder="Número do processo (opcional)"
                  onChange={(e) => patch('numeroProcesso', e.target.value)}
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="preview-enderecamento">
                  Endereçamento
                </label>
                <textarea
                  id="preview-enderecamento"
                  className={textareaClass}
                  value={preview.enderecamento || ''}
                  onChange={(e) => patch('enderecamento', e.target.value)}
                />
              </div>

              <div>
                <span className={labelClass}>Preâmbulo</span>
                <HtmlEditable
                  ariaLabel="Preâmbulo"
                  html={preview.preambulo}
                  onChange={(v) => patch('preambulo', v)}
                  className={editableHtmlClass}
                />
              </div>

              {(preview.secoes || []).map((secao, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      type="text"
                      aria-label={`Título da seção ${i + 1}`}
                      className={`${inputClass} font-semibold`}
                      value={secao.titulo || ''}
                      onChange={(e) => patchSecao(i, 'titulo', e.target.value)}
                    />
                    <button
                      type="button"
                      className={`${btnGhost} shrink-0 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40`}
                      onClick={() => removerSecao(i)}
                      aria-label={`Remover seção ${i + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <HtmlEditable
                    ariaLabel={`Conteúdo da seção ${i + 1}`}
                    html={secao.conteudo}
                    onChange={(v) => patchSecao(i, 'conteudo', v)}
                    className={editableHtmlClass}
                  />
                </div>
              ))}

              <button
                type="button"
                className={`${btnGhost} text-cyan-700 dark:text-cyan-300`}
                onClick={adicionarSecao}
              >
                <Plus className="h-4 w-4" /> Adicionar seção
              </button>

              <div>
                <span className={labelClass}>Pedidos</span>
                <ol className="space-y-2">
                  {(preview.pedidos || []).map((p, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-2 text-xs font-medium text-slate-400">{i + 1}.</span>
                      <textarea
                        aria-label={`Pedido ${i + 1}`}
                        className={`${textareaClass} min-h-[44px]`}
                        value={p}
                        onChange={(e) => patchPedido(i, e.target.value)}
                      />
                      <button
                        type="button"
                        className={`${btnGhost} mt-1 shrink-0 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40`}
                        onClick={() => removerPedido(i)}
                        aria-label={`Remover pedido ${i + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ol>
                <button
                  type="button"
                  className={`${btnGhost} mt-2 text-cyan-700 dark:text-cyan-300`}
                  onClick={adicionarPedido}
                >
                  <Plus className="h-4 w-4" /> Adicionar pedido
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="border-t border-slate-200 p-4 dark:border-slate-700">
          {erro && (
            <div
              className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
              role="alert"
            >
              {erro}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className={btnPrimary}
              disabled={!preview || loading || gerando}
              onClick={onGerarPdf}
            >
              {gerando ? 'Gerando PDF…' : 'Gerar PDF'}
            </button>
            <button type="button" className={btnSecondary} onClick={onClose}>
              Fechar
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}
