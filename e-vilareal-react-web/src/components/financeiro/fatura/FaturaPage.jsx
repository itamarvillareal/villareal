import { useCallback, useEffect, useState } from 'react';
import { useCloseOnEscape } from '../../../hooks/useCloseOnEscape.js';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  atualizarCartaoBancoMapeamentoApi,
  criarCartaoBancoMapeamentoApi,
  listarCartaoBancoMapeamentoApi,
  listarCartoesFinanceiro,
  listarVinculosPagamentoFaturaApi,
  removerCartaoBancoMapeamentoApi,
} from '../../../repositories/financeiroRepository.js';
import { ExtratoSkeleton } from '../shared/LoadingSkeleton.jsx';
import { useFinanceiroToast } from '../shared/Toast.jsx';
import { formatDataCurta, formatMoeda } from '../shared/financeiroFormat.js';

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-blue-500 text-blue-700 dark:text-blue-300'
          : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
      }`}
    >
      {children}
    </button>
  );
}

const EMPTY_MAPEAMENTO = {
  padraoDescricao: '',
  tipoMatch: 'CONTAINS',
  numeroBanco: 1,
  cartaoId: '',
  toleranciaValor: 0.05,
  toleranciaDias: 31,
  ativo: true,
};

function MapeamentoModal({ open, initial, cartoes, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_MAPEAMENTO);

  useCloseOnEscape(open, onClose);

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              padraoDescricao: initial.padraoDescricao ?? '',
              tipoMatch: initial.tipoMatch ?? 'CONTAINS',
              numeroBanco: initial.numeroBanco ?? 1,
              cartaoId: String(initial.cartaoId ?? ''),
              toleranciaValor: Number(initial.toleranciaValor) || 0.05,
              toleranciaDias: Number(initial.toleranciaDias) || 31,
              ativo: initial.ativo !== false,
            }
          : { ...EMPTY_MAPEAMENTO, cartaoId: cartoes[0]?.id ? String(cartoes[0].id) : '' },
      );
    }
  }, [open, initial, cartoes]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    onSave({
      padraoDescricao: form.padraoDescricao.trim(),
      tipoMatch: form.tipoMatch,
      numeroBanco: Number(form.numeroBanco),
      cartaoId: Number(form.cartaoId),
      toleranciaValor: Number(form.toleranciaValor),
      toleranciaDias: Number(form.toleranciaDias),
      ativo: Boolean(form.ativo),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-4 space-y-3"
      >
        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {initial ? 'Editar regra' : 'Nova regra de mapeamento'}
        </h3>
        <label className="block text-xs text-slate-500">
          Padrão descrição
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
            </select>
          </label>
          <label className="block text-xs text-slate-500">
            Banco (nº)
            <input
              type="number"
              required
              value={form.numeroBanco}
              onChange={(e) => setForm((f) => ({ ...f, numeroBanco: e.target.value }))}
              className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        <label className="block text-xs text-slate-500">
          Cartão
          <select
            required
            value={form.cartaoId}
            onChange={(e) => setForm((f) => ({ ...f, cartaoId: e.target.value }))}
            className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
          >
            {cartoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-slate-500">
            Tolerância valor
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={form.toleranciaValor}
              onChange={(e) => setForm((f) => ({ ...f, toleranciaValor: e.target.value }))}
              className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs text-slate-500">
            Tolerância dias
            <input
              type="number"
              min="0"
              value={form.toleranciaDias}
              onChange={(e) => setForm((f) => ({ ...f, toleranciaDias: e.target.value }))}
              className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.ativo}
            onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
          />
          Ativo
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}

export function FaturaPage() {
  const toast = useFinanceiroToast();
  const [searchParams] = useSearchParams();
  const tabInicial = searchParams.get('tab') === 'regras' ? 'regras' : 'vinculos';
  const [tab, setTab] = useState(tabInicial);
  const [vinculos, setVinculos] = useState([]);
  const [mapeamentos, setMapeamentos] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ open: false, item: null });

  const loadVinculos = useCallback(async () => {
    const data = await listarVinculosPagamentoFaturaApi();
    setVinculos(Array.isArray(data) ? data : []);
  }, []);

  const loadMapeamentos = useCallback(async (signal) => {
    const [map, cart] = await Promise.all([
      listarCartaoBancoMapeamentoApi({ signal }),
      listarCartoesFinanceiro({ signal }),
    ]);
    setMapeamentos(Array.isArray(map) ? map : []);
    setCartoes(Array.isArray(cart) ? cart : []);
  }, []);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro) return undefined;
    const ac = new AbortController();
    setLoading(true);
    (tab === 'vinculos' ? loadVinculos() : loadMapeamentos(ac.signal))
      .catch((e) => {
        if (e?.name !== 'AbortError') toast.error(e?.message || 'Erro ao carregar.');
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [tab, loadVinculos, loadMapeamentos, toast]);

  const handleSaveMapeamento = async (body) => {
    try {
      if (modal.item?.id) {
        await atualizarCartaoBancoMapeamentoApi(modal.item.id, body);
        toast.success('Regra atualizada.');
      } else {
        await criarCartaoBancoMapeamentoApi(body);
        toast.success('Regra criada.');
      }
      setModal({ open: false, item: null });
      await loadMapeamentos();
    } catch (e) {
      toast.error(e?.message || 'Erro ao salvar.');
    }
  };

  const handleDeleteMapeamento = async (id) => {
    if (!window.confirm('Excluir esta regra?')) return;
    try {
      await removerCartaoBancoMapeamentoApi(id);
      toast.success('Regra excluída.');
      await loadMapeamentos();
    } catch (e) {
      toast.error(e?.message || 'Erro ao excluir.');
    }
  };

  if (!featureFlags.useApiFinanceiro) {
    return <p className="p-4 text-sm text-slate-600">API financeiro desativada.</p>;
  }

  return (
    <div className="flex flex-col min-h-0 h-full bg-white dark:bg-slate-900">
      <div className="flex border-b border-slate-200 dark:border-slate-700 px-2 items-center justify-between">
        <div className="flex">
          <TabButton active={tab === 'vinculos'} onClick={() => setTab('vinculos')}>
            Vínculos existentes
          </TabButton>
          <TabButton active={tab === 'regras'} onClick={() => setTab('regras')}>
            Regras de mapeamento
          </TabButton>
        </div>
        {tab === 'regras' ? (
          <button
            type="button"
            onClick={() => setModal({ open: true, item: null })}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 mb-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova regra
          </button>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <ExtratoSkeleton />
        ) : tab === 'vinculos' ? (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr
                className="text-xs font-medium text-slate-500"
                style={{ background: 'var(--fin-header-bg)' }}
              >
                <th className="px-2 py-2 text-left">Data banco</th>
                <th className="px-2 py-2 text-left">Banco</th>
                <th className="px-2 py-2 text-left">Descrição banco</th>
                <th className="px-2 py-2 text-right">Valor banco</th>
                <th className="px-2 py-2 text-left">Cartão</th>
                <th className="px-2 py-2 text-right">Valor fatura</th>
                <th className="px-2 py-2 text-right">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {vinculos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    Nenhum vínculo cadastrado.
                  </td>
                </tr>
              ) : (
                vinculos.map((v, i) => {
                  const vb = Math.abs(Number(v.valorBanco) || 0);
                  const vc = Math.abs(Number(v.valorCartao) || 0);
                  const diff = vb - vc;
                  return (
                    <tr
                      key={v.id}
                      className="border-b border-slate-100 dark:border-slate-800"
                      style={{ background: i % 2 ? 'var(--fin-row-alt)' : 'transparent' }}
                    >
                      <td className="px-2 py-1.5 whitespace-nowrap text-slate-500">
                        {formatDataCurta(v.dataBanco)}
                      </td>
                      <td className="px-2 py-1.5">{v.bancoNome}</td>
                      <td className="px-2 py-1.5 truncate max-w-xs">{v.descricaoBanco}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatMoeda(vb)}</td>
                      <td className="px-2 py-1.5">{v.cartaoNome}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatMoeda(vc)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                        {formatMoeda(diff)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr
                className="text-xs font-medium text-slate-500"
                style={{ background: 'var(--fin-header-bg)' }}
              >
                <th className="px-2 py-2 text-left">Padrão</th>
                <th className="px-2 py-2 text-left">Tipo</th>
                <th className="px-2 py-2 text-left">Banco</th>
                <th className="px-2 py-2 text-left">Cartão</th>
                <th className="px-2 py-2 text-right">Tol. valor</th>
                <th className="px-2 py-2 text-right">Tol. dias</th>
                <th className="px-2 py-2 text-center">Ativo</th>
                <th className="px-2 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {mapeamentos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    Nenhuma regra.{' '}
                    <Link to="/financeiro/configuracao" className="text-blue-600 hover:underline">
                      Configuração
                    </Link>
                  </td>
                </tr>
              ) : (
                mapeamentos.map((m, i) => (
                  <tr
                    key={m.id}
                    className="border-b border-slate-100 dark:border-slate-800"
                    style={{ background: i % 2 ? 'var(--fin-row-alt)' : 'transparent' }}
                  >
                    <td className="px-2 py-1.5 font-medium">{m.padraoDescricao}</td>
                    <td className="px-2 py-1.5 text-xs">{m.tipoMatch}</td>
                    <td className="px-2 py-1.5">{m.numeroBanco}</td>
                    <td className="px-2 py-1.5">{m.cartaoNome}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{m.toleranciaValor}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{m.toleranciaDias}</td>
                    <td className="px-2 py-1.5 text-center">{m.ativo ? 'Sim' : 'Não'}</td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        className="p-1 text-slate-500 hover:text-blue-600"
                        aria-label="Editar"
                        onClick={() => setModal({ open: true, item: m })}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className="p-1 text-slate-500 hover:text-red-600"
                        aria-label="Excluir"
                        onClick={() => handleDeleteMapeamento(m.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <MapeamentoModal
        open={modal.open}
        initial={modal.item}
        cartoes={cartoes}
        onClose={() => setModal({ open: false, item: null })}
        onSave={handleSaveMapeamento}
      />
    </div>
  );
}
