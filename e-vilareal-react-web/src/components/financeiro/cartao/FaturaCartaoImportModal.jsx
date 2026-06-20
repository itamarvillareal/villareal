import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Upload, X } from 'lucide-react';
import { useCloseOnEscape } from '../../../hooks/useCloseOnEscape.js';
import { persistirImportacaoFaturaCartaoApi } from '../../../repositories/financeiroRepository.js';
import { parseArquivoFaturaCartao, mensagemResultadoConferenciaFatura } from '../../../utils/faturaCartaoItauImport.js';
import { useFinanceiroToast } from '../shared/Toast.jsx';
import { ConfirmDialog } from '../shared/ConfirmDialog.jsx';
import { formatMoeda } from '../shared/financeiroFormat.js';

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   cartao: { id: number, nome: string, numeroCartao?: number },
 *   onSuccess?: () => void,
 * }} props
 */
export function FaturaCartaoImportModal({ open, onClose, cartao, onSuccess }) {
  const toast = useFinanceiroToast();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [modo, setModo] = useState('mesclar');
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('form');
  const [importResult, setImportResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const [confirmSubstituir, setConfirmSubstituir] = useState(false);
  const [confirmDivergencia, setConfirmDivergencia] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setPreview(null);
    setStep('form');
    setImportResult(null);
    setModo('mesclar');
    setConfirmSubstituir(false);
    setConfirmDivergencia(false);
  }, [open]);

  const processarArquivo = useCallback(
    async (f) => {
      if (!f) return;
      setFile(f);
      setPreview(null);
      const parsed = await parseArquivoFaturaCartao(f);
      if (!parsed.ok) {
        toast.error(parsed.message);
        return;
      }
      setPreview(parsed);
      if (parsed.origem === 'PDF') {
        toast.info('PDF importado. Quando disponível, prefira o Excel exportado pelo banco.');
      }
    },
    [toast],
  );

  const executarImportacao = useCallback(async () => {
    if (!preview?.rows?.length || !cartao?.id) return;
    setBusy(true);
    const conferencia = preview.meta?.conferenciaTotal ?? null;
    try {
      const res = await persistirImportacaoFaturaCartaoApi({
        cartaoId: cartao.id,
        cartaoNome: cartao.nome,
        numeroCartao: cartao.numeroCartao,
        rows: preview.rows,
        modo,
        origem: preview.origem === 'XLSX' ? 'FATURA_XLSX' : 'FATURA_PDF',
        dataVencimento: preview.meta?.dataVencimento ?? null,
      });
      setImportResult({ res, conferencia });
      setStep('result');
      if (res.erros?.length) {
        toast.warn(`${res.erros.length} erro(s) durante a importação.`);
      }
    } catch (e) {
      toast.error(e?.message || 'Falha ao importar fatura.');
    } finally {
      setBusy(false);
      setConfirmSubstituir(false);
      setConfirmDivergencia(false);
    }
  }, [preview, cartao, modo, toast]);

  const fecharComSucesso = useCallback(() => {
    if (importResult) {
      onSuccess?.();
    }
    onClose();
  }, [importResult, onSuccess, onClose]);

  useCloseOnEscape(open, step === 'result' ? fecharComSucesso : onClose, { enabled: !busy });

  const conferencia = preview?.meta?.conferenciaTotal;
  const totalDiverge = conferencia?.ok === false;

  const onImportar = useCallback(() => {
    if (!preview?.rows?.length) return;
    if (totalDiverge) {
      setConfirmDivergencia(true);
      return;
    }
    if (modo === 'substituir') {
      setConfirmSubstituir(true);
      return;
    }
    void executarImportacao();
  }, [preview, modo, totalDiverge, executarImportacao]);

  const onConfirmarComDivergencia = useCallback(() => {
    setConfirmDivergencia(false);
    if (modo === 'substituir') {
      setConfirmSubstituir(true);
      return;
    }
    void executarImportacao();
  }, [modo, executarImportacao]);

  if (!open) return null;

  if (!cartao?.id) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
      >
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            {cartao?.nome
              ? `Carregando dados de «${cartao.nome}»…`
              : 'Cartão não encontrado. Verifique o cadastro em Configuração.'}
          </p>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fatura-cartao-import-titulo"
        onClick={(e) => {
          if (e.target === e.currentTarget && !busy) {
            if (step === 'result') fecharComSucesso();
            else onClose();
          }
        }}
      >
        <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <h2 id="fatura-cartao-import-titulo" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Importar fatura — {cartao?.nome}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 p-4">
            {step === 'result' && importResult ? (
              <div className="space-y-3 text-sm">
                <p className="text-slate-800 dark:text-slate-100">
                  <strong>{Number(importResult.res.criados).toLocaleString('pt-BR')}</strong> lançamento(s)
                  importado(s).
                  {importResult.res.atualizados > 0 ? (
                    <>
                      {' '}
                      <strong>{Number(importResult.res.atualizados).toLocaleString('pt-BR')}</strong> vinculado(s) ao
                      vencimento.
                    </>
                  ) : null}
                  {importResult.res.ignorados > 0 ? (
                    <>
                      {' '}
                      <strong>{Number(importResult.res.ignorados).toLocaleString('pt-BR')}</strong> ignorado(s) (já
                      existiam).
                    </>
                  ) : null}
                  {importResult.res.erros?.length ? (
                    <span className="text-amber-600 dark:text-amber-400">
                      {' '}
                      ({importResult.res.erros.length} aviso(s))
                    </span>
                  ) : null}
                </p>
                <div
                  className={`rounded-md px-3 py-2.5 text-sm leading-snug ${
                    importResult.conferencia?.ok === true
                      ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
                      : importResult.conferencia?.ok === false
                        ? 'bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'
                        : 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <p className="font-medium mb-1">Conferência de total</p>
                  <p>{mensagemResultadoConferenciaFatura(importResult.conferencia)}</p>
                </div>
              </div>
            ) : (
              <>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Exporte a <strong>fatura paga</strong> no internet banking Itaú. Prefira{' '}
              <strong>Excel (.xlsx)</strong> — mais confiável. PDF é aceito como alternativa.
              Linhas «Pagamento Efetuado» são ignoradas (já constam no extrato bancário).
            </p>

            <div
              className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                dragOver
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/50'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void processarArquivo(f);
              }}
            >
              <Upload className="mx-auto mb-2 h-8 w-8 text-amber-600" aria-hidden />
              <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                Arraste o arquivo ou{' '}
                <button
                  type="button"
                  className="text-amber-700 font-medium hover:underline"
                  onClick={() => inputRef.current?.click()}
                  disabled={busy}
                >
                  selecione
                </button>
              </p>
              <p className="text-[11px] text-slate-500">
                .xlsx recomendado · .pdf alternativo
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void processarArquivo(f);
                  e.target.value = '';
                }}
              />
              {file ? (
                <p className="mt-2 text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                  {file.name}
                  {preview?.origem ? (
                    <span className="ml-1 text-slate-500">({preview.origem})</span>
                  ) : null}
                </p>
              ) : null}
            </div>

            {preview?.rows?.length ? (
              <div className="space-y-2">
                <p className="text-sm text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 rounded-md px-3 py-2">
                  {preview.rows.length} lançamento(s) prontos
                  {preview.meta?.ignoradosPagamento
                    ? ` · ${preview.meta.ignoradosPagamento} pagamento(s) de fatura ignorado(s)`
                    : ''}
                  {preview.meta?.dataVencimento
                    ? ` · Venc. ${String(preview.meta.dataVencimento).split('-').reverse().join('/')}`
                    : ''}
                </p>

                {conferencia?.valorTotalBanco != null ? (
                  <div
                    className={`rounded-md px-3 py-2 text-sm ${
                      conferencia.ok
                        ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
                        : conferencia.ok === false
                          ? 'bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'
                          : 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <p className="font-medium">Conferência de total</p>
                    <p className="text-xs mt-1 tabular-nums">
                      Soma dos lançamentos: {formatMoeda(conferencia.somaCalculada)}
                      {' · '}
                      Banco: {formatMoeda(conferencia.valorTotalBanco)}
                      {conferencia.diferenca != null && conferencia.ok === false ? (
                        <>
                          {' · '}
                          Diferença: {formatMoeda(conferencia.diferenca)}
                        </>
                      ) : null}
                    </p>
                    {conferencia.ok === false ? (
                      <p className="text-xs mt-1 flex items-start gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
                        O total não confere. Revise o arquivo ou confirme para importar mesmo assim.
                      </p>
                    ) : null}
                  </div>
                ) : conferencia?.mensagem ? (
                  <p className="text-xs text-slate-500 px-1">{conferencia.mensagem}</p>
                ) : null}
              </div>
            ) : null}

            <fieldset className="text-sm">
              <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Modo
              </legend>
              <label className="flex items-center gap-2 mb-1 cursor-pointer">
                <input
                  type="radio"
                  name="modo-fatura-cartao"
                  checked={modo === 'mesclar'}
                  onChange={() => setModo('mesclar')}
                  disabled={busy}
                />
                Mesclar (só lançamentos novos)
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="modo-fatura-cartao"
                  checked={modo === 'substituir'}
                  onChange={() => setModo('substituir')}
                  disabled={busy}
                />
                Substituir (apaga extrato deste cartão e importa)
              </label>
            </fieldset>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
            <button
              type="button"
              onClick={step === 'result' ? fecharComSucesso : onClose}
              disabled={busy}
              className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {step === 'result' ? 'Fechar' : 'Cancelar'}
            </button>
            {step !== 'result' ? (
            <button
              type="button"
              onClick={onImportar}
              disabled={busy || !preview?.rows?.length}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Importar
            </button>
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDivergencia}
        title="Total não confere com o banco"
        message={`Soma ${formatMoeda(conferencia?.somaCalculada)} · Banco ${formatMoeda(conferencia?.valorTotalBanco)} (dif. ${formatMoeda(conferencia?.diferenca)}). Importar mesmo assim?`}
        confirmLabel="Importar mesmo assim"
        danger
        onCancel={() => setConfirmDivergencia(false)}
        onConfirm={onConfirmarComDivergencia}
      />

      <ConfirmDialog
        open={confirmSubstituir}
        title="Substituir extrato do cartão?"
        message={`Todos os lançamentos de «${cartao?.nome}» serão removidos antes de importar ${preview?.rows?.length ?? 0} linha(s).`}
        confirmLabel="Substituir e importar"
        danger
        onCancel={() => setConfirmSubstituir(false)}
        onConfirm={() => void executarImportacao()}
      />
    </>
  );
}
