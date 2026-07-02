import { Plus, Trash2, Loader2 } from 'lucide-react';
import { HtmlEditor } from './HtmlEditor.jsx';
import { btnGhost, btnPrimary, btnSecondary, inputClass, textareaClass } from '../documentosStyles.js';

const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';

export function PreviewManualPeticao({
  payload,
  pdfUrl,
  loading,
  gerandoFinal,
  onPayloadChange,
  onAtualizar,
  onGerarFinal,
  onVoltar,
}) {
  if (!payload) return null;

  const ocupado = loading || gerandoFinal;

  const patch = (campo, valor) => {
    onPayloadChange?.({ ...payload, [campo]: valor });
  };

  const patchSecao = (index, campo, valor) => {
    const secoes = (payload.secoes || []).map((s, i) => (i === index ? { ...s, [campo]: valor } : s));
    patch('secoes', secoes);
  };

  const adicionarSecao = () => {
    patch('secoes', [...(payload.secoes || []), { titulo: 'NOVA SEÇÃO', conteudo: '' }]);
  };

  const removerSecao = (index) => {
    patch('secoes', (payload.secoes || []).filter((_, i) => i !== index));
  };

  const patchPedido = (index, valor) => {
    const pedidos = (payload.pedidos || []).map((p, i) => (i === index ? valor : p));
    patch('pedidos', pedidos);
  };

  const adicionarPedido = () => {
    patch('pedidos', [...(payload.pedidos || []), '']);
  };

  const removerPedido = (index) => {
    patch('pedidos', (payload.pedidos || []).filter((_, i) => i !== index));
  };

  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
      aria-label="Prévia editável da petição manual"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Prévia editável
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Revise o texto e atualize a prévia do PDF antes de gerar o arquivo final.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onVoltar ? (
            <button type="button" className={btnSecondary} disabled={ocupado} onClick={onVoltar}>
              Voltar ao formulário
            </button>
          ) : null}
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
                Gerando PDF final…
              </>
            ) : (
              'Gerar PDF final'
            )}
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-2" data-documento-editores>
        <div className="max-h-[min(85vh,960px)] space-y-5 overflow-y-auto border-b border-slate-200 px-4 py-4 dark:border-slate-700 lg:border-b-0 lg:border-r">
          <div>
            <label className={labelClass} htmlFor="manual-preview-enderecamento">
              Endereçamento
            </label>
            <textarea
              id="manual-preview-enderecamento"
              className={textareaClass}
              value={payload.enderecamento || ''}
              onChange={(e) => patch('enderecamento', e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="manual-preview-numero">
              Número do processo
            </label>
            <input
              id="manual-preview-numero"
              type="text"
              className={inputClass}
              value={payload.numeroProcesso || ''}
              placeholder="Opcional"
              onChange={(e) => patch('numeroProcesso', e.target.value)}
            />
          </div>

          <div>
            <span className={labelClass}>Preâmbulo</span>
            <HtmlEditor
              ariaLabel="Preâmbulo"
              editorKey="preambulo"
              value={payload.preambulo || ''}
              onChange={(preambulo) => patch('preambulo', preambulo)}
              minHeight="140px"
            />
          </div>

          {(payload.secoes || []).map((secao, i) => (
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
              <HtmlEditor
                ariaLabel={`Conteúdo da seção ${i + 1}`}
                editorKey={`secao-${i}-conteudo`}
                value={secao.conteudo || ''}
                onChange={(conteudo) => patchSecao(i, 'conteudo', conteudo)}
                minHeight="120px"
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
              {(payload.pedidos || []).map((p, i) => (
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

        <div className="relative min-h-[480px] bg-slate-100 dark:bg-slate-950">
          {loading && !pdfUrl ? (
            <div className="flex min-h-[480px] flex-col items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-600" aria-hidden />
              Gerando prévia do PDF…
            </div>
          ) : pdfUrl ? (
            <iframe
              title="Prévia do PDF da petição"
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
    </section>
  );
}
