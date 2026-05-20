import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Link2, Trash2, X } from 'lucide-react';
import { ModalVinculoClienteProcFinanceiro } from '../../ModalVinculoClienteProcFinanceiro.jsx';
import { normalizarCodigoClienteFinanceiro, normalizarProcFinanceiro } from '../../../data/financeiroData.js';
import { buscarClientePorCodigo, buscarProcessoPorChaveNatural } from '../../../repositories/processosRepository.js';
import { featureFlags } from '../../../config/featureFlags.js';
import { ContaBadge } from '../shared/ContaBadge.jsx';
import { EtapaDot } from '../shared/EtapaDot.jsx';
import { ValorText } from '../shared/ValorText.jsx';
import { ETAPA_LABELS } from '../constants/financeiroConstants.js';
import {
  extratoRowToUi,
  formatDataExtratoColuna,
  mergeExtratoRowComRespostaApi,
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

  useEffect(() => {
    setDraft(item);
    setExtrasOpen(false);
  }, [item]);

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
      const draftSalvar = promoverContaEscritorioSeVinculado(draft, contas);
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
    let processoId = draft.processoId ?? null;

    if (featureFlags.useApiFinanceiro && featureFlags.useApiProcessos) {
      try {
        const cliente = await buscarClientePorCodigo(cod);
        const processo = procNorm ? await buscarProcessoPorChaveNatural(cod, procNorm) : null;
        clienteId =
          cliente?.id != null && Number.isFinite(Number(cliente.id)) ? Number(cliente.id) : null;
        processoId =
          processo?.id != null && Number.isFinite(Number(processo.id)) ? Number(processo.id) : null;
      } catch (e) {
        toast.error(e?.message || 'Falha ao resolver cliente/processo na API.');
        setSaving(false);
        return;
      }
    }

    const nextDraft = promoverContaEscritorioSeVinculado(
      {
        ...draft,
        codCliente: cod,
        proc: procNorm || '',
        clienteId,
        processoId,
      },
      contas,
    );

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
      toast.success(`Vinculado: cliente ${cod}, proc. ${procNorm || '—'} — conta A (Escritório).`);
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

  return (
    <aside
      className="absolute right-0 top-0 bottom-0 z-20 w-[360px] flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-[-4px_0_12px_rgba(0,0,0,0.05)] animate-in"
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
        </section>

        <section className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">Classificação</p>
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
                <span className="text-slate-400">Obs: </span>
                {draft.observacao || '—'}
              </p>
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

      <style>{`
        @keyframes extratoPanelIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </aside>
  );
}
