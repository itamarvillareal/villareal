import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  atualizarRegraClassificacaoApi,
  criarRegraClassificacaoApi,
  listarContasFinanceiro,
  listarRegrasClassificacaoApi,
  obterSaudeFinanceiroApi,
  removerRegraClassificacaoApi,
} from '../../../repositories/financeiroRepository.js';
import { ContaBadge } from '../shared/ContaBadge.jsx';
import { ExtratoSkeleton } from '../shared/LoadingSkeleton.jsx';
import { useFinanceiroToast } from '../shared/Toast.jsx';

const EMPTY_REGRA = {
  padraoDescricao: '',
  tipoMatch: 'CONTAINS',
  contaContabilId: '',
  numeroBanco: '',
  prioridade: 100,
  ativo: true,
};

function RegraModal({ open, initial, contas, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_REGRA);

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              padraoDescricao: initial.padraoDescricao ?? '',
              tipoMatch: initial.tipoMatch ?? 'CONTAINS',
              contaContabilId: String(initial.contaContabilId ?? ''),
              numeroBanco: initial.numeroBanco != null ? String(initial.numeroBanco) : '',
              prioridade: initial.prioridade ?? 100,
              ativo: initial.ativo !== false,
            }
          : {
              ...EMPTY_REGRA,
              contaContabilId: contas[0]?.id ? String(contas[0].id) : '',
            },
      );
    }
  }, [open, initial, contas]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    onSave({
      padraoDescricao: form.padraoDescricao.trim(),
      tipoMatch: form.tipoMatch,
      contaContabilId: Number(form.contaContabilId),
      numeroBanco: form.numeroBanco === '' ? null : Number(form.numeroBanco),
      prioridade: Number(form.prioridade),
      ativo: Boolean(form.ativo),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-4 space-y-3"
      >
        <h3 className="text-sm font-medium">{initial ? 'Editar regra' : 'Nova regra de classificação'}</h3>
        <label className="block text-xs text-slate-500">
          Padrão
          <input
            required
            value={form.padraoDescricao}
            onChange={(e) => setForm((f) => ({ ...f, padraoDescricao: e.target.value }))}
            className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-slate-500">
            Tipo match
            <select
              value={form.tipoMatch}
              onChange={(e) => setForm((f) => ({ ...f, tipoMatch: e.target.value }))}
              className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
            >
              <option value="CONTAINS">CONTAINS</option>
              <option value="REGEX">REGEX</option>
              <option value="EXACT">EXACT</option>
            </select>
          </label>
          <label className="block text-xs text-slate-500">
            Prioridade
            <input
              type="number"
              value={form.prioridade}
              onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))}
              className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        <label className="block text-xs text-slate-500">
          Conta contábil
          <select
            required
            value={form.contaContabilId}
            onChange={(e) => setForm((f) => ({ ...f, contaContabilId: e.target.value }))}
            className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
          >
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} — {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-500">
          Banco (opcional)
          <input
            type="number"
            value={form.numeroBanco}
            onChange={(e) => setForm((f) => ({ ...f, numeroBanco: e.target.value }))}
            className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.ativo}
            onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
          />
          Ativo
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded border">
            Cancelar
          </button>
          <button type="submit" className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white">
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}

export function ConfigPage() {
  const toast = useFinanceiroToast();
  const [regras, setRegras] = useState([]);
  const [contas, setContas] = useState([]);
  const [saude, setSaude] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, item: null });

  const load = useCallback(async (signal) => {
    const [r, c, s] = await Promise.all([
      listarRegrasClassificacaoApi({ signal }),
      listarContasFinanceiro({ signal }),
      obterSaudeFinanceiroApi({ signal }),
    ]);
    setRegras(Array.isArray(r) ? r : []);
    setContas(Array.isArray(c) ? c : []);
    setSaude(s);
  }, []);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro) {
      setLoading(false);
      return undefined;
    }
    const ac = new AbortController();
    load(ac.signal)
      .catch((e) => {
        if (e?.name !== 'AbortError') toast.error(e?.message || 'Erro ao carregar.');
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [load, toast]);

  const handleSave = async (body) => {
    try {
      if (modal.item?.id) {
        await atualizarRegraClassificacaoApi(modal.item.id, body);
        toast.success('Regra atualizada.');
      } else {
        await criarRegraClassificacaoApi(body);
        toast.success('Regra criada.');
      }
      setModal({ open: false, item: null });
      await load();
    } catch (e) {
      toast.error(e?.message || 'Erro ao salvar.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir regra?')) return;
    try {
      await removerRegraClassificacaoApi(id);
      toast.success('Regra excluída.');
      await load();
    } catch (e) {
      toast.error(e?.message || 'Erro ao excluir.');
    }
  };

  if (!featureFlags.useApiFinanceiro) {
    return <p className="p-4 text-sm text-slate-600">API financeiro desativada.</p>;
  }

  return (
    <div className="p-4 space-y-8 max-w-5xl">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Regras de classificação
          </h2>
          <button
            type="button"
            onClick={() => setModal({ open: true, item: null })}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-blue-600 text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova regra
          </button>
        </div>
        {loading ? (
          <ExtratoSkeleton />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/80">
                  <th className="px-2 py-2 text-left">Padrão</th>
                  <th className="px-2 py-2 text-left">Match</th>
                  <th className="px-2 py-2 text-left">Conta</th>
                  <th className="px-2 py-2 text-left">Banco</th>
                  <th className="px-2 py-2 text-right">Prio</th>
                  <th className="px-2 py-2 text-center">Ativo</th>
                  <th className="px-2 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {regras.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-2 py-1.5">{r.padraoDescricao}</td>
                    <td className="px-2 py-1.5 text-xs">{r.tipoMatch}</td>
                    <td className="px-2 py-1.5">
                      <ContaBadge codigo={r.contaContabilCodigo} title={r.contaContabilNome} />
                    </td>
                    <td className="px-2 py-1.5">{r.numeroBanco ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right">{r.prioridade}</td>
                    <td className="px-2 py-1.5 text-center">{r.ativo ? 'Sim' : 'Não'}</td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        className="p-1 text-slate-500 hover:text-blue-600"
                        onClick={() => setModal({ open: true, item: r })}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-1 text-slate-500 hover:text-red-600"
                        onClick={() => handleDelete(r.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
          Mapeamento fatura
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <Link
            to="/financeiro/fatura?tab=regras"
            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
          >
            Abrir Faturas — aba Regras de mapeamento
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Sobre</h2>
        {saude ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-700 dark:text-slate-300">
            <div>
              <dt className="text-xs text-slate-500">Total lançamentos (banco)</dt>
              <dd className="font-medium tabular-nums">
                {Number(saude.totalLancamentos).toLocaleString('pt-BR')}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Total lançamentos (cartão)</dt>
              <dd className="font-medium tabular-nums">
                {Number(saude.totalCartao).toLocaleString('pt-BR')}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Não identificados</dt>
              <dd>
                {saude.naoIdentificados?.total?.toLocaleString('pt-BR')} (
                {saude.naoIdentificados?.percentual}%)
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Grupos inconsistentes</dt>
              <dd>{saude.gruposInconsistentes?.toLocaleString('pt-BR')}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">Atualizado em</dt>
              <dd>{saude.atualizadoEm ? new Date(saude.atualizadoEm).toLocaleString('pt-BR') : '—'}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-slate-500">Carregando…</p>
        )}
      </section>

      <RegraModal
        open={modal.open}
        initial={modal.item}
        contas={contas}
        onClose={() => setModal({ open: false, item: null })}
        onSave={handleSave}
      />
    </div>
  );
}
