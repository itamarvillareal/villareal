import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, FolderOpen, Link2, Trash2, X } from 'lucide-react';
import { ModalVinculoClienteProcFinanceiro } from '../../ModalVinculoClienteProcFinanceiro.jsx';
import {
  normalizarCodigoClienteFinanceiro,
  normalizarProcFinanceiro,
  registrarCodigoClienteFinanceiroPorPessoaId,
} from '../../../data/financeiroData.js';
import { buildRouterStateChaveClienteProcesso } from '../../../domain/camposProcessoCliente.js';
import { buscarClientePorCodigo, buscarProcessoPorChaveNatural } from '../../../repositories/processosRepository.js';
import { featureFlags } from '../../../config/featureFlags.js';
import { ContaBadge } from '../shared/ContaBadge.jsx';
import { EtapaDot } from '../shared/EtapaDot.jsx';
import { ValorText } from '../shared/ValorText.jsx';
import { ETAPA_LABELS } from '../constants/financeiroConstants.js';
import { resolverTextosPartesCabecalhoCalculo } from '../../../data/processosDadosRelatorio.js';
import {
  extratoRowToUi,
  formatDataExtratoColuna,
  mergeExtratoRowComRespostaApi,
  montarObservacaoExtratoVinculo,
  promoverContaEscritorioSeVinculado,
} from './extratoMappers.js';
import {
  buildContaToLetraMerge,
  loadPersistedContasContabeisExtrasFinanceiro,
} from '../../../data/financeiroData.js';
import {
  listarContasFinanceiro,
  removerLancamentoFinanceiroApi,
  salvarOuAtualizarLancamentoFinanceiroApi,
} from '../../../repositories/financeiroRepository.js';
import { ConfirmDialog } from '../shared/ConfirmDialog.jsx';
import { useFinanceiroToast } from '../shared/Toast.jsx';
import { dispatchRefreshPendentes } from '../hooks/useKeyboardShortcuts.js';

const ProcessosLazy = lazy(() =>
  import('../../Processos.jsx').then((module) => ({ default: module.Processos })),
);

function lancamentoPodeAbrirProcesso(draft) {
  if (String(draft?.contaCodigo ?? '').trim().toUpperCase() !== 'A') return false;
  const cod = normalizarCodigoClienteFinanceiro(draft?.codCliente);
  const proc = normalizarProcFinanceiro(draft?.proc);
  return Boolean(cod && proc !== '');
}

function Field({ label, children }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      {children}
    </div>
  );
}

export function ExtratoDetailPanel({ item, onClose, onSaved, onDeleted }) {
  const toast = useFinanceiroToast();
  const [draft, setDraft] = useState(item);
  const [contas, setContas] = useState([]);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState(false);
  const [modalVinculoAberto, setModalVinculoAberto] = useState(false);
  const [processoEmbed, setProcessoEmbed] = useState(null);
  const [partesLegenda, setPartesLegenda] = useState(null);
  const [partesLegendaLoading, setPartesLegendaLoading] = useState(false);

  useEffect(() => {
    setDraft(item);
    setExtrasOpen(false);
  }, [item]);

  const codLegenda = normalizarCodigoClienteFinanceiro(draft.codCliente);
  const procLegenda = normalizarProcFinanceiro(draft.proc);

  useEffect(() => {
    if (!codLegenda || procLegenda === '') {
      setPartesLegenda(null);
      setPartesLegendaLoading(false);
      return undefined;
    }
    let cancelled = false;
    setPartesLegendaLoading(true);
    resolverTextosPartesCabecalhoCalculo(codLegenda, procLegenda)
      .then((partes) => {
        if (!cancelled) setPartesLegenda(partes);
      })
      .catch(() => {
        if (!cancelled) setPartesLegenda({ parteCliente: '', parteOposta: '' });
      })
      .finally(() => {
        if (!cancelled) setPartesLegendaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [codLegenda, procLegenda]);

  useEffect(() => {
    const ac = new AbortController();
    listarContasFinanceiro({ signal: ac.signal })
      .then((rows) => setContas(Array.isArray(rows) ? rows : []))
      .catch(() => setContas([]));
    return () => ac.abort();
  }, []);

  const patch = useCallback((p) => setDraft((d) => ({ ...d, ...p })), []);

  const handleSave = async () => {
    setSaving(true);
    try {
      let draftSalvar = promoverContaEscritorioSeVinculado(draft, contas);
      const codDigitado = normalizarCodigoClienteFinanceiro(draftSalvar.codCliente);
      if (
        codDigitado &&
        !(Number(draftSalvar.clienteId) > 0) &&
        featureFlags.useApiFinanceiro &&
        featureFlags.useApiProcessos
      ) {
        try {
          const cliente = await buscarClientePorCodigo(codDigitado);
          const clientePk =
            cliente?.clienteId != null
              ? Number(cliente.clienteId)
              : cliente?.id != null
                ? Number(cliente.id)
                : null;
          const pessoaRefId =
            cliente?.pessoaId != null && Number.isFinite(Number(cliente.pessoaId))
              ? Number(cliente.pessoaId)
              : null;
          if (clientePk) {
            const codResolucao = normalizarCodigoClienteFinanceiro(cliente?.codigoCliente);
            const codGravado = codResolucao || codDigitado;
            draftSalvar = {
              ...draftSalvar,
              clienteId: clientePk,
              pessoaRefId,
              codCliente: codGravado,
            };
            if (pessoaRefId) registrarCodigoClienteFinanceiroPorPessoaId(pessoaRefId, codGravado);
          }
        } catch {
          /* mantém save sem clienteId se API de resolução falhar */
        }
      }
      if (draftSalvar.contaCodigo !== draft.contaCodigo) {
        setDraft(draftSalvar);
      }
      const ui = extratoRowToUi(draftSalvar);
      const saved = await salvarOuAtualizarLancamentoFinanceiroApi(ui);
      if (!saved?.id) {
        toast.error('Falha ao salvar lançamento.');
        return;
      }
      const contaToLetra = buildContaToLetraMerge(loadPersistedContasContabeisExtrasFinanceiro());
      const merged = mergeExtratoRowComRespostaApi(draftSalvar, saved, contaToLetra);
      if (merged.pessoaRefId && merged.codCliente) {
        registrarCodigoClienteFinanceiroPorPessoaId(merged.pessoaRefId, merged.codCliente);
      }
      onSaved(merged);
      setDraft(merged);
      toast.success('Lançamento atualizado.');
    } catch (e) {
      toast.error(e?.message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleAplicarVinculoProcesso = async ({ codCliente, proc }) => {
    const cod = normalizarCodigoClienteFinanceiro(codCliente);
    const procNorm = normalizarProcFinanceiro(proc);
    if (!cod) {
      toast.warn('Selecione um cliente com código válido.');
      return;
    }

    setModalVinculoAberto(false);
    setSaving(true);

    let clienteId = draft.clienteId ?? null;
    let pessoaRefId = draft.pessoaRefId ?? null;
    let processoId = draft.processoId ?? null;

    let codGravado = cod;
    let clienteResolvido = null;
    let processoResolvido = null;

    if (featureFlags.useApiFinanceiro && featureFlags.useApiProcessos) {
      try {
        clienteResolvido = await buscarClientePorCodigo(cod);
        processoResolvido = procNorm ? await buscarProcessoPorChaveNatural(cod, procNorm) : null;
        const clientePk =
          clienteResolvido?.clienteId != null
            ? Number(clienteResolvido.clienteId)
            : clienteResolvido?.id != null
              ? Number(clienteResolvido.id)
              : null;
        pessoaRefId =
          clienteResolvido?.pessoaId != null && Number.isFinite(Number(clienteResolvido.pessoaId))
            ? Number(clienteResolvido.pessoaId)
            : null;
        const codResolucao = normalizarCodigoClienteFinanceiro(clienteResolvido?.codigoCliente);
        if (codResolucao) codGravado = codResolucao;
        clienteId = clientePk;
        processoId =
          processoResolvido?.id != null && Number.isFinite(Number(processoResolvido.id))
            ? Number(processoResolvido.id)
            : null;
      } catch (e) {
        toast.error(e?.message || 'Falha ao resolver cliente/processo na API.');
        setSaving(false);
        return;
      }
    }

    let obsVinculo = '';
    if (procNorm) {
      try {
        const partes = await resolverTextosPartesCabecalhoCalculo(codGravado, procNorm);
        obsVinculo = montarObservacaoExtratoVinculo(partes.parteCliente, partes.parteOposta);
      } catch {
        /* fallback abaixo */
      }
      if (!obsVinculo) {
        const pc = String(
          clienteResolvido?.nomeReferencia ?? clienteResolvido?.nomeRazao ?? clienteResolvido?.nome ?? '',
        ).trim();
        const po = String(processoResolvido?.parteOposta ?? processoResolvido?.parte_oposta ?? '').trim();
        obsVinculo = montarObservacaoExtratoVinculo(pc, po);
      }
    }

    const nextDraft = promoverContaEscritorioSeVinculado(
      {
        ...draft,
        codCliente: codGravado,
        proc: procNorm || '',
        clienteId,
        pessoaRefId,
        processoId,
        ...(obsVinculo ? { observacao: obsVinculo, descricaoDetalhada: obsVinculo } : {}),
      },
      contas,
    );

    if (pessoaRefId) registrarCodigoClienteFinanceiroPorPessoaId(pessoaRefId, codGravado);

    try {
      if (!featureFlags.useApiFinanceiro) {
        setDraft(nextDraft);
        onSaved?.(nextDraft);
        toast.success(`Vínculo: cliente ${cod}, proc. ${procNorm || '—'} (conta A).`);
        return;
      }

      const ui = extratoRowToUi(nextDraft);
      const saved = await salvarOuAtualizarLancamentoFinanceiroApi(ui);
      if (!saved?.id) {
        toast.error('Falha ao gravar vínculo no lançamento.');
        return;
      }
      const contaToLetra = buildContaToLetraMerge(loadPersistedContasContabeisExtrasFinanceiro());
      const merged = mergeExtratoRowComRespostaApi(nextDraft, saved, contaToLetra);
      setDraft(merged);
      onSaved?.(merged);
      dispatchRefreshPendentes();
      toast.success(`Vinculado: cliente ${codGravado}, proc. ${procNorm || '—'} — conta A (Escritório).`);
    } catch (e) {
      toast.error(e?.message || 'Falha ao gravar vínculo.');
    } finally {
      setSaving(false);
    }
  };

  const handleExcluir = async () => {
    const apiId = Number(draft.id);
    if (!featureFlags.useApiFinanceiro) {
      toast.error('API financeiro desativada — exclusão indisponível.');
      return;
    }
    if (!apiId) {
      toast.error('Lançamento sem id na API.');
      return;
    }
    setDeleting(true);
    try {
      await removerLancamentoFinanceiroApi(apiId);
      toast.success('Lançamento excluído do extrato.');
      dispatchRefreshPendentes();
      onDeleted?.(apiId);
      onClose?.();
    } catch (e) {
      toast.error(e?.message || 'Falha ao excluir lançamento.');
    } finally {
      setDeleting(false);
      setConfirmExcluir(false);
    }
  };

  const dataCompleta = formatDataExtratoColuna(draft.dataLancamento);
  const resumoVinculo = `${draft.descricao} · ${dataCompleta} · ${draft.bancoNome ?? ''}`;
  const podeExcluir = featureFlags.useApiFinanceiro && Number(draft.id) > 0;
  const etapaLabel = ETAPA_LABELS[draft.etapa] ?? draft.etapa;
  const podeAbrirProcesso = useMemo(() => lancamentoPodeAbrirProcesso(draft), [draft]);

  const abrirProcessoFlutuante = useCallback(() => {
    const cod = normalizarCodigoClienteFinanceiro(draft.codCliente);
    const proc = normalizarProcFinanceiro(draft.proc);
    if (!cod || proc === '') return;
    setProcessoEmbed({
      revision: Date.now(),
      routerState: buildRouterStateChaveClienteProcesso(cod, proc),
    });
  }, [draft.codCliente, draft.proc]);

  return (
    <aside
      className="absolute right-0 top-0 bottom-0 z-30 w-[360px] flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.05)] animate-in pointer-events-auto"
      style={{ animation: 'extratoPanelIn 200ms ease' }}
      role="dialog"
      aria-label="Detalhes do lançamento"
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">Detalhes do lançamento</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Fechar"
          data-financeiro-fechar-detalhe
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-sm">
        <section className="space-y-2">
          <p className="text-xs font-medium text-slate-500">Informações</p>
          <p className="font-medium text-slate-900 dark:text-slate-100">{draft.descricao}</p>
          {draft.descricaoDetalhada ? (
            <p className="text-slate-600 dark:text-slate-400">{draft.descricaoDetalhada}</p>
          ) : null}
          <p className="text-slate-500 text-xs">
            {draft.bancoNome}
            {draft.numeroBanco != null ? ` (${draft.numeroBanco})` : ''}
          </p>
          <p className="font-mono text-xs text-slate-400 break-all">{draft.numeroLancamento}</p>
          <p className="text-slate-600 dark:text-slate-400">{dataCompleta}</p>
          <ValorText valor={draft.valor} natureza={draft.natureza} />
          {draft.saldo != null ? (
            <p className="text-xs text-slate-500">Saldo: {Number(draft.saldo).toLocaleString('pt-BR')}</p>
          ) : null}
          <Field label="Observação">
            <textarea
              value={draft.observacao ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                patch({ observacao: v, descricaoDetalhada: v });
              }}
              rows={2}
              className="w-full text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 resize-y"
              placeholder="Observação do lançamento"
            />
          </Field>
        </section>

        <section className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">Classificação</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {podeAbrirProcesso ? (
                <button
                  type="button"
                  disabled={saving || deleting}
                  onClick={abrirProcessoFlutuante}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border border-slate-300 text-slate-800 bg-white hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50"
                  title={`Abrir processo (cliente ${normalizarCodigoClienteFinanceiro(draft.codCliente)}, proc. ${normalizarProcFinanceiro(draft.proc)})`}
                >
                  <FolderOpen className="w-3.5 h-3.5" aria-hidden />
                  Abrir processo
                </button>
              ) : null}
              <button
                type="button"
                disabled={saving || deleting}
                onClick={() => setModalVinculoAberto(true)}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:border-indigo-800 dark:text-indigo-300 dark:bg-indigo-950/50 dark:hover:bg-indigo-950 disabled:opacity-50"
              >
                <Link2 className="w-3.5 h-3.5" aria-hidden />
                Vincular a Processo
              </button>
            </div>
          </div>
          <Field label="Conta">
            <select
              value={draft.contaCodigo}
              onChange={(e) => {
                const cod = e.target.value;
                const c = contas.find((x) => String(x.codigo).toUpperCase() === cod);
                patch({
                  contaCodigo: cod,
                  contaContabilId: c?.id ?? draft.contaContabilId,
                  contaContabilNome: c?.nome ?? draft.contaContabilNome,
                });
              }}
              className="w-full text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
            >
              {!contas.some((c) => String(c.codigo).toUpperCase() === draft.contaCodigo) ? (
                <option value={draft.contaCodigo}>
                  {draft.contaCodigo} — {draft.contaContabilNome}
                </option>
              ) : null}
              {contas.map((c) => (
                <option key={c.id} value={String(c.codigo ?? '').toUpperCase()}>
                  {String(c.codigo ?? '').toUpperCase()} — {c.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cliente (código)">
            <input
              type="text"
              value={draft.codCliente}
              onChange={(e) => patch({ codCliente: e.target.value })}
              className="w-full text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
              placeholder="Cód. cliente"
            />
          </Field>
          <Field label="Processo">
            <input
              type="text"
              value={draft.proc}
              onChange={(e) => patch({ proc: e.target.value })}
              className="w-full text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5"
              placeholder="Nº processo"
            />
          </Field>
          {codLegenda && procLegenda !== '' ? (
            <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-2 space-y-1 text-xs">
              {partesLegendaLoading ? (
                <p className="text-slate-500 dark:text-slate-400">Carregando partes do processo…</p>
              ) : (
                <>
                  <p className="text-slate-700 dark:text-slate-200">
                    <span className="font-medium text-slate-500 dark:text-slate-400">Parte autora: </span>
                    {partesLegenda?.parteCliente?.trim() ? partesLegenda.parteCliente : '—'}
                  </p>
                  <p className="text-slate-700 dark:text-slate-200">
                    <span className="font-medium text-slate-500 dark:text-slate-400">Parte oposta: </span>
                    {partesLegenda?.parteOposta?.trim() ? partesLegenda.parteOposta : '—'}
                  </p>
                </>
              )}
            </div>
          ) : null}
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <EtapaDot etapa={draft.etapa} />
            <span>{etapaLabel}</span>
            <ContaBadge codigo={draft.contaCodigo} size="sm" />
          </div>
          {String(draft.contaCodigo ?? '').toUpperCase() === 'N' &&
          (String(draft.codCliente ?? '').trim() || draft.clienteId) ? (
            <p className="text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">
              Cliente/processo preenchidos, mas a conta contábil ainda é <strong>N</strong> (não
              identificada). Use <strong>Vincular a Processo</strong> ou <strong>Salvar</strong> para
              classificar como <strong>A</strong> (Escritório).
            </p>
          ) : null}
        </section>

        <section className="space-y-1 border-t border-slate-100 dark:border-slate-800 pt-3">
          <p className="text-xs font-medium text-slate-500">Compensação</p>
          {draft.grupoCompensacao ? (
            <p className="text-sm">
              Grupo:{' '}
              <Link
                to={`/financeiro/compensacao?grupo=${encodeURIComponent(draft.grupoCompensacao)}`}
                className="text-blue-600 hover:underline dark:text-blue-400 font-mono text-xs"
              >
                {draft.grupoCompensacao}
              </Link>
            </p>
          ) : (
            <p className="text-sm text-slate-500">(nenhum)</p>
          )}
        </section>

        <section className="border-t border-slate-100 dark:border-slate-800 pt-2">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 w-full"
            onClick={() => setExtrasOpen((v) => !v)}
          >
            {extrasOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            Campos extras
          </button>
          {extrasOpen ? (
            <div className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <p>
                <span className="text-slate-400">Dimensão: </span>
                {draft.dimensao || '—'}
              </p>
              <p>
                <span className="text-slate-400">Parcela: </span>
                {draft.parcela || '—'}
              </p>
              <p>
                <span className="text-slate-400">Eq.: </span>
                {draft.eq || '—'}
              </p>
              <p>
                <span className="text-slate-400">Ref: </span>
                {draft.ref || '—'}
              </p>
            </div>
          ) : null}
        </section>
      </div>

      <footer className="shrink-0 px-4 py-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
        {podeExcluir ? (
          <button
            type="button"
            disabled={saving || deleting}
            onClick={() => setConfirmExcluir(true)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 dark:border-red-900 dark:text-red-300 dark:bg-red-950/40 dark:hover:bg-red-950/70 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" aria-hidden />
            {deleting ? 'Excluindo…' : 'Excluir lançamento do extrato'}
          </button>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving || deleting}
            onClick={() => void handleSave()}
            className="flex-1 px-3 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onClose}
            className="px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </footer>

      <ModalVinculoClienteProcFinanceiro
        aberto={modalVinculoAberto}
        onFechar={() => setModalVinculoAberto(false)}
        resumoLancamento={resumoVinculo}
        onAplicar={handleAplicarVinculoProcesso}
        modoContaEscritorio
        titulo="Vincular a Processo"
      />

      <ConfirmDialog
        open={confirmExcluir}
        title="Excluir lançamento?"
        message={`Remover permanentemente «${draft.descricao}» (${dataCompleta}) deste extrato? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        danger
        onCancel={() => setConfirmExcluir(false)}
        onConfirm={() => void handleExcluir()}
      />

      {processoEmbed ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-black/55"
          role="dialog"
          aria-modal="true"
          aria-labelledby="extrato-processo-embed-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setProcessoEmbed(null);
          }}
        >
          <div
            className="flex flex-col w-[min(100vw-0.5rem,1280px)] h-[min(100dvh-0.5rem,920px)] max-h-[min(100dvh-0.5rem,920px)] min-h-0 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0f141c] shadow-2xl overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#141c2c] shrink-0">
              <h2 id="extrato-processo-embed-title" className="text-sm font-semibold text-slate-900 dark:text-white">
                Processo (cadastro)
              </h2>
              <button
                type="button"
                onClick={() => setProcessoEmbed(null)}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10"
                aria-label="Fechar formulário de processo"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]">
              <Suspense
                fallback={
                  <div className="flex min-h-[12rem] items-center justify-center p-8 text-sm text-slate-600 dark:text-slate-400">
                    Carregando formulário de processos…
                  </div>
                }
              >
                <ProcessosLazy
                  key={processoEmbed.revision}
                  embedIntent={processoEmbed.routerState}
                  embedIntentRevision={processoEmbed.revision}
                  onFecharEmbed={() => setProcessoEmbed(null)}
                />
              </Suspense>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        @keyframes extratoPanelIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </aside>
  );
}
