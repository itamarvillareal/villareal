import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { ContaBadge } from '../shared/ContaBadge.jsx';
import { EtapaDot } from '../shared/EtapaDot.jsx';
import { ValorText } from '../shared/ValorText.jsx';
import { ETAPA_LABELS } from '../constants/financeiroConstants.js';
import {
  extratoRowToUi,
  formatDataExtratoColuna,
  mergeExtratoRowComRespostaApi,
} from './extratoMappers.js';
import {
  buildContaToLetraMerge,
  loadPersistedContasContabeisExtrasFinanceiro,
} from '../../../data/financeiroData.js';
import {
  listarContasFinanceiro,
  salvarOuAtualizarLancamentoFinanceiroApi,
} from '../../../repositories/financeiroRepository.js';
import { useFinanceiroToast } from '../shared/Toast.jsx';

function Field({ label, children }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      {children}
    </div>
  );
}

export function ExtratoDetailPanel({ item, onClose, onSaved }) {
  const toast = useFinanceiroToast();
  const [draft, setDraft] = useState(item);
  const [contas, setContas] = useState([]);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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
      const ui = extratoRowToUi(draft);
      const saved = await salvarOuAtualizarLancamentoFinanceiroApi(ui);
      if (!saved?.id) {
        toast.error('Falha ao salvar lançamento.');
        return;
      }
      const contaToLetra = buildContaToLetraMerge(loadPersistedContasContabeisExtrasFinanceiro());
      const merged = mergeExtratoRowComRespostaApi(draft, saved, contaToLetra);
      onSaved(merged);
      setDraft(merged);
      toast.success('Lançamento atualizado.');
    } catch (e) {
      toast.error(e?.message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const dataCompleta = formatDataExtratoColuna(draft.dataLancamento);
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
          <p className="text-xs font-medium text-slate-500">Classificação</p>
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

      <footer className="shrink-0 flex gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-800">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="flex-1 px-3 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Cancelar
        </button>
      </footer>

      <style>{`
        @keyframes extratoPanelIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </aside>
  );
}
