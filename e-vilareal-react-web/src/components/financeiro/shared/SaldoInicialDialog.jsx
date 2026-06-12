import { useEffect, useState } from 'react';
import { useCloseOnEscape } from '../../../hooks/useCloseOnEscape.js';
import {
  obterSaldoInicialBanco,
  removerSaldoInicialBanco,
  salvarSaldoInicialBanco,
} from '../../../repositories/financeiroRepository.js';
import { useFinanceiroToast } from './Toast.jsx';

/**
 * Editor do saldo de abertura (saldo inicial) de uma conta bancária.
 *
 * O importador traz só movimentos; o saldo de abertura (anterior ao 1º lançamento) é informado
 * aqui e passa a ser somado ao saldo do banco. `valor` é o saldo assinado (negativo = devedor).
 *
 * @param {{
 *   open: boolean,
 *   numeroBanco: number,
 *   bancoNome: string,
 *   onClose: () => void,
 *   onSaved?: () => void,
 * }} props
 */
export function SaldoInicialDialog({ open, numeroBanco, bancoNome, onClose, onSaved }) {
  const toast = useFinanceiroToast();
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [existente, setExistente] = useState(false);
  const [data, setData] = useState('');
  const [valor, setValor] = useState('');

  useCloseOnEscape(open, onClose);

  useEffect(() => {
    if (!open || numeroBanco == null) return undefined;
    const ac = new AbortController();
    let cancelled = false;
    setLoading(true);
    setExistente(false);
    setData('');
    setValor('');
    obterSaldoInicialBanco(numeroBanco, { signal: ac.signal })
      .then((res) => {
        if (cancelled || !res) return;
        setExistente(true);
        setData(String(res.dataReferencia || '').slice(0, 10));
        setValor(res.valor != null ? String(res.valor) : '');
      })
      .catch((e) => {
        if (!cancelled && e?.name !== 'AbortError') toast.error(e?.message || 'Falha ao carregar saldo inicial.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [open, numeroBanco, toast]);

  if (!open) return null;

  const valorNum = Number(String(valor).replace(',', '.'));
  const valido = /^\d{4}-\d{2}-\d{2}$/.test(data) && Number.isFinite(valorNum);

  const handleSalvar = async () => {
    if (busy || !valido) return;
    setBusy(true);
    try {
      await salvarSaldoInicialBanco({
        numeroBanco,
        bancoNome,
        dataReferencia: data,
        valor: valorNum,
      });
      toast.success('Saldo inicial salvo. O saldo da conta já considera o valor de abertura.');
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(e?.message || 'Falha ao salvar o saldo inicial.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemover = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await removerSaldoInicialBanco(numeroBanco);
      toast.success('Saldo inicial removido.');
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(e?.message || 'Falha ao remover o saldo inicial.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-5">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Saldo inicial — {bancoNome}
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Saldo de abertura da conta (anterior ao 1º lançamento importado). É somado ao saldo do
          banco para bater com o extrato. Use valor negativo para saldo devedor.
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-slate-400">Carregando…</p>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="text-slate-600 dark:text-slate-400">Data de referência</span>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
              />
              <span className="mt-1 block text-[11px] text-slate-400">
                Saldo ao final desta data (a véspera do extrato).
              </span>
            </label>
            <label className="block text-sm">
              <span className="text-slate-600 dark:text-slate-400">Saldo de abertura (R$)</span>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm tabular-nums"
              />
            </label>
          </div>
        )}

        <div className="mt-5 flex justify-between gap-2">
          <div>
            {existente ? (
              <button
                type="button"
                onClick={handleRemover}
                disabled={busy}
                className="px-3 py-1.5 text-sm rounded-md border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40 disabled:opacity-50"
              >
                Remover
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvar}
              disabled={busy || !valido}
              className="px-3 py-1.5 text-sm rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
