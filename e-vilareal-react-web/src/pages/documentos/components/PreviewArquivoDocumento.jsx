import { Loader2 } from 'lucide-react';
import { HtmlEditor } from './HtmlEditor.jsx';
import { btnPrimary, btnSecondary } from '../documentosStyles.js';

const corpoUnicoClass =
  'doc-edicao-preview prose prose-sm max-w-none min-h-[520px] rounded-b-lg border border-t-0 border-slate-300/90 bg-white px-4 py-5 text-slate-900 shadow-sm transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 dark:prose-invert dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100 [&_mark]:bg-yellow-200';

export function PreviewArquivoDocumento({
  conteudo,
  pdfUrl,
  loading,
  gerandoFinal,
  inserindoPastaAssinar,
  podeInserirPastaAssinar,
  onConteudoChange,
  onAtualizar,
  onGerarFinal,
  onInserirPastaAssinar,
}) {
  if (!conteudo) return null;

  const ocupado = loading || gerandoFinal || inserindoPastaAssinar;

  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
      aria-label="Prévia editável do documento"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Prévia editável
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Selecione o trecho e use a barra de formatação — alinhamento, fonte, negrito, itálico,
            sublinhado e cor de fundo — como aparecerá no PDF.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btnSecondary}
            disabled={ocupado}
            onClick={onAtualizar}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Atualizando…
              </>
            ) : (
              'Atualizar prévia'
            )}
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={ocupado || !podeInserirPastaAssinar}
            onClick={onInserirPastaAssinar}
            title={
              podeInserirPastaAssinar
                ? 'Envia o PDF para a subpasta Assinar no Drive (arquivo a assinar agora) e altera a fase para Protocolo / Movimentação'
                : 'Abra esta tela a partir de Processos (Gerar documento) para vincular o PDF ao processo no Drive'
            }
          >
            {inserindoPastaAssinar ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Inserindo…
              </>
            ) : (
              'Inserir na Pasta Assinar'
            )}
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={ocupado}
            onClick={onGerarFinal}
          >
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

      <div className="grid lg:grid-cols-2">
        <div className="max-h-[min(85vh,960px)] overflow-y-auto border-b border-slate-200 px-4 py-4 dark:border-slate-700 lg:border-b-0 lg:border-r">
          <HtmlEditor
            ariaLabel="Documento completo"
            value={conteudo.corpoUnico}
            onChange={(corpoUnico) => onConteudoChange?.({ ...conteudo, corpoUnico })}
            minHeight="520px"
            surfaceClassName={corpoUnicoClass}
            toolbar="completo"
          />
        </div>

        <div className="relative min-h-[480px] bg-slate-100 dark:bg-slate-950">
          {loading && !pdfUrl ? (
            <div className="flex min-h-[480px] flex-col items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-600" aria-hidden />
              Gerando prévia do PDF…
            </div>
          ) : pdfUrl ? (
            <iframe
              title="Prévia do PDF formatado"
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
