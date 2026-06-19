import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Mail, Upload, X } from 'lucide-react';
import { processarExtratoCoraEmail } from '../../../api/extratoCoraEmailApi.js';
import { featureFlags } from '../../../config/featureFlags.js';
import { useFinanceiro } from '../FinanceiroContext.jsx';
import { useFinanceiroToast } from '../shared/Toast.jsx';
import { ConfirmDialog } from '../shared/ConfirmDialog.jsx';
import { NovoBancoModal } from './NovoBancoModal.jsx';
import {
  executarImportacaoExtrato,
  parseArquivoExtrato,
  resumirNovosImportacaoMesclar,
} from './importUtils.js';
import { useCloseOnEscape } from '../../../hooks/useCloseOnEscape.js';

export function ExtratoImportModal({ open, onClose, bancoInicial = null, onSuccess }) {
  const { bancos, refreshBancos } = useFinanceiro();
  const toast = useFinanceiroToast();
  const inputRef = useRef(null);

  const [bancoNome, setBancoNome] = useState('');
  const [modo, setModo] = useState('mesclar');
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [novoBancoOpen, setNovoBancoOpen] = useState(false);
  const [step, setStep] = useState('form');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmSubstituir, setConfirmSubstituir] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailResult, setEmailResult] = useState(null);

  const isCora = useMemo(() => String(bancoNome ?? '').trim().toUpperCase() === 'CORA', [bancoNome]);

  const numeroBanco = useMemo(() => {
    const hit = bancos.find((b) => b.nome === bancoNome);
    return hit?.numero ?? null;
  }, [bancos, bancoNome]);

  const wasOpenRef = useRef(false);

  useCloseOnEscape(open, onClose, { enabled: !busy });

  const resolverBancoInicial = useCallback(() => {
    if (bancoInicial != null) {
      const hit = bancos.find((b) => b.numero === bancoInicial);
      if (hit?.nome) return hit.nome;
    }
    return bancos[0]?.nome ?? '';
  }, [bancoInicial, bancos]);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;
    setStep('form');
    setPreview(null);
    setResult(null);
    setFile(null);
    setModo('mesclar');
    setBancoNome(resolverBancoInicial());
    setEmailResult(null);
    setEmailBusy(false);
  }, [open, resolverBancoInicial]);

  /** Lista de bancos pode carregar após abrir o modal — preenche banco se ainda vazio. */
  useEffect(() => {
    if (!open || bancoNome) return;
    const nome = resolverBancoInicial();
    if (nome) setBancoNome(nome);
  }, [open, bancoNome, resolverBancoInicial]);

  const resetAndClose = useCallback(() => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setStep('form');
    onClose?.();
  }, [onClose]);

  const handleFile = (f) => {
    if (f) setFile(f);
  };

  const runPreview = async () => {
    if (!file || !bancoNome) return;
    setBusy(true);
    const parsed = await parseArquivoExtrato(file, bancoNome);
    if (!parsed.ok) {
      setBusy(false);
      toast.error(parsed.message);
      return;
    }
    let resumoMesclar = null;
    if (modo === 'mesclar' && featureFlags.useApiFinanceiro && numeroBanco != null) {
      try {
        resumoMesclar = await resumirNovosImportacaoMesclar(parsed.rows, numeroBanco, undefined, parsed.origem);
      } catch {
        resumoMesclar = null;
      }
    }
    setBusy(false);
    setPreview({ ...parsed, resumoMesclar });
    setStep('preview');
  };

  const runImport = async () => {
    if (!preview?.rows?.length) return;
    setBusy(true);
    try {
      const res = await executarImportacaoExtrato({
        nomeBanco: bancoNome,
        numeroBanco,
        modo,
        rows: preview.rows,
        origem: preview.origem,
      });
      if (res.erros?.length) {
        toast.warn(
          `${res.importados} importados com ${res.erros.length} erro(s). ${res.erros.slice(0, 2).join(' · ')}`,
        );
      } else if (res.ignorados > 0) {
        toast.success(
          `${res.importados} lançamento(s) importados. ${res.ignorados} ignorado(s) (já constavam no banco, comparados por data/valor/descrição).`,
        );
      } else {
        toast.success(`${res.importados} lançamento(s) importados.`);
      }
      setResult(res);
      setStep('result');
      refreshBancos?.();
      onSuccess?.({ bancoNome, numeroBanco, importados: res.importados });
    } catch (e) {
      toast.error(e?.message || 'Falha ao importar extrato.');
    } finally {
      setBusy(false);
      setConfirmSubstituir(false);
    }
  };

  const onClickImportar = () => {
    if (step === 'form') {
      runPreview();
      return;
    }
    if (step === 'preview') {
      if (modo === 'substituir') {
        setConfirmSubstituir(true);
        return;
      }
      runImport();
    }
  };

  const onConfirmSubstituir = () => {
    runImport();
  };

  const runImportarEmailCora = async (reprocessar = false) => {
    if (!featureFlags.useApiFinanceiro) return;
    setEmailBusy(true);
    setEmailResult(null);
    try {
      const res = await processarExtratoCoraEmail({ reprocessar });
      setEmailResult(res);
      const criados = Number(res?.lancamentosCriados ?? 0);
      const erros = res?.erros?.length ?? 0;
      if (criados > 0) {
        toast.success(
          `${criados} lançamento(s) importados via e-mail Cora.` +
            (res?.lancamentosJaExistiam ? ` ${res.lancamentosJaExistiam} já existiam.` : ''),
        );
        refreshBancos?.();
        onSuccess?.({ bancoNome: 'CORA', numeroBanco, importados: criados });
      } else if (erros > 0) {
        toast.warn(
          `Nenhum lançamento novo. ${res.emailsEncontrados ?? 0} e-mail(s) encontrado(s). ` +
            `${erros} aviso(s): ${res.erros.slice(0, 2).join(' · ')}`,
        );
      } else {
        toast.info(
          res?.emailsEncontrados
            ? `${res.emailsEncontrados} e-mail(s) encontrado(s), ${res.emailsIgnorados ?? 0} já importado(s), sem lançamentos novos.`
            : 'Nenhum e-mail Cora com anexo OFX encontrado.',
        );
      }
    } catch (e) {
      toast.error(e?.message || 'Falha ao importar extrato Cora via e-mail.');
    } finally {
      setEmailBusy(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
        <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Importar extrato</h2>
            <button type="button" onClick={resetAndClose} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar">
              <X className="w-4 h-4" />
            </button>
            </div>

          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {step === 'result' && result ? (
              <div className="space-y-3 text-sm">
                <p className="text-slate-800 dark:text-slate-100">
                  <strong>{Number(result.importados).toLocaleString('pt-BR')}</strong> importados.
                  {result.ignorados > 0 ? (
                    <span className="text-slate-600 dark:text-slate-400">
                      {' '}
                      <strong>{Number(result.ignorados).toLocaleString('pt-BR')}</strong> ignorados (já no banco).
                    </span>
                  ) : null}
                  {result.erros?.length ? (
                    <span className="text-amber-600 dark:text-amber-400">
                      {' '}
                      ({result.erros.length} avisos)
                    </span>
                  ) : null}
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Os lançamentos novos ficam na etapa <strong>IMPORTADO</strong> (pendentes de classificação).
                </p>
                <Link
                  to="/financeiro/inbox/classificar"
                  className="inline-block text-blue-600 hover:underline dark:text-blue-400 font-medium"
                  onClick={resetAndClose}
                >
                  Ir para Inbox →
                </Link>
              </div>
            ) : step === 'preview' && preview ? (
              <div className="text-sm text-slate-700 dark:text-slate-200 space-y-2">
                <p>
                  <strong>{preview.total.toLocaleString('pt-BR')}</strong> lançamentos no arquivo ({preview.origem}
                  ).
                </p>
                {preview.resumoMesclar ? (
                  <p>
                    No banco: <strong>{preview.resumoMesclar.noBanco.toLocaleString('pt-BR')}</strong> · a importar:{' '}
                    <strong>{preview.resumoMesclar.novos.toLocaleString('pt-BR')}</strong> · ignorados (duplicados):{' '}
                    <strong>{preview.resumoMesclar.ignorados.toLocaleString('pt-BR')}</strong>
                  </p>
                ) : null}
                {modo === 'substituir' ? (
                  <p className="text-amber-700 dark:text-amber-300">
                    O extrato atual deste banco será substituído na API.
                  </p>
                ) : null}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex-1 min-w-[160px] text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Banco</span>
                    <select
                      value={bancoNome}
                      onChange={(e) => setBancoNome(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
                      required
                    >
                      <option value="" disabled>
                        Selecione o banco
                      </option>
                      {bancos.map((b) => (
                        <option key={b.nome} value={b.nome}>
                          {b.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => setNovoBancoOpen(true)}
                    className="text-xs px-2 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    + Novo banco
                  </button>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    handleFile(e.dataTransfer.files?.[0]);
                  }}
                  onClick={() => inputRef.current?.click()}
                  onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
                  className={`rounded-lg border-2 border-dashed px-4 py-10 text-center cursor-pointer transition-colors ${
                    dragOver
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/40'
                      : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
                  }`}
                >
                  <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" aria-hidden />
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    Arraste um arquivo OFX ou PDF aqui
                  </p>
                  <p className="text-xs text-slate-500 mt-1">ou clique para selecionar</p>
                  <p className="text-[11px] text-slate-400 mt-3">
                    Formatos: .ofx (bancos em geral, Sicoob VRV) · .pdf (BTG, Bradesco, Sicoob, 99 Pay)
                  </p>
                  {file ? (
                    <p className="mt-2 text-xs font-medium text-blue-700 dark:text-blue-300">{file.name}</p>
                  ) : null}
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".ofx,.qfx,.pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />
                </div>

                {isCora && featureFlags.useApiFinanceiro ? (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-3 space-y-2">
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Importação automática via Gmail (remetente Cora, anexo OFX). E-mails já importados são
                      ignorados com base no histórico do sistema.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={emailBusy || busy}
                        onClick={() => void runImportarEmailCora(false)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {emailBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Mail className="w-3.5 h-3.5" aria-hidden />
                        )}
                        Buscar e-mail Cora
                      </button>
                      <button
                        type="button"
                        disabled={emailBusy || busy}
                        title="Reprocessa e-mails já registrados como importados (útil para teste)"
                        onClick={() => void runImportarEmailCora(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-950 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-950/50 disabled:opacity-50"
                      >
                        Reprocessar e-mails
                      </button>
                    </div>
                    {emailResult ? (
                      <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5">
                        <li>E-mails encontrados: {emailResult.emailsEncontrados ?? 0}</li>
                        <li>Processados: {emailResult.emailsProcessados ?? 0}</li>
                        <li>Já importados (ignorados): {emailResult.emailsIgnorados ?? 0}</li>
                        <li>Lançamentos criados: {emailResult.lancamentosCriados ?? 0}</li>
                        <li>Já existiam: {emailResult.lancamentosJaExistiam ?? 0}</li>
                        {(emailResult.erros?.length ?? 0) > 0 ? (
                          <li className="text-amber-700 dark:text-amber-300">
                            Avisos: {emailResult.erros.slice(0, 3).join(' · ')}
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                  </div>
                ) : null}

                <fieldset className="text-sm text-slate-800 dark:text-slate-200">
                  <legend className="text-slate-600 dark:text-slate-400 mb-1">Modo</legend>
                  <label className="inline-flex items-center gap-1.5 mr-4">
                    <input
                      type="radio"
                      checked={modo === 'mesclar'}
                      onChange={() => setModo('mesclar')}
                    />
                    Mesclar com existente
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      checked={modo === 'substituir'}
                      onChange={() => setModo('substituir')}
                    />
                    Substituir extrato
                  </label>
                </fieldset>

                {!featureFlags.useApiFinanceiro ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    API financeiro desativada — importação só funciona com a flag ativa.
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-700 shrink-0">
            <button
              type="button"
              onClick={resetAndClose}
              className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {step === 'result' ? 'Fechar' : 'Cancelar'}
            </button>
            {step !== 'result' ? (
              <button
                type="button"
                disabled={busy || !file || !bancoNome || !featureFlags.useApiFinanceiro}
                onClick={onClickImportar}
                className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy
                  ? 'Processando…'
                  : step === 'preview'
                    ? 'Confirmar importação'
                    : 'Importar'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <NovoBancoModal
        open={novoBancoOpen}
        onClose={() => setNovoBancoOpen(false)}
        onCreated={(novo) => {
          refreshBancos?.();
          setBancoNome(novo.nome);
        }}
      />

      <ConfirmDialog
        open={confirmSubstituir}
        title="Substituir extrato?"
        message={`Todos os lançamentos atuais de «${bancoNome}» serão removidos antes de importar o arquivo. Esta ação não pode ser desfeita automaticamente.`}
        confirmLabel="Substituir e importar"
        danger
        onCancel={() => setConfirmSubstituir(false)}
        onConfirm={onConfirmSubstituir}
      />
    </>
  );
}

