import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { buscarSugestoesConciliacao, conferirPagamento } from '../../repositories/pagamentosRepository.js';
import { formatBRL } from '../../data/relatorioCalculosData.js';
import { isoAddDays } from './pagamentosUiUtils.js';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape.js';

function fmtData(iso) {
  if (iso == null || iso === '') return '—';
  const s = String(iso).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function ModalConferirPagamento({ pagamento, onClose, onSuccess }) {
  const [valorPago, setValorPago] = useState(
    pagamento?.valor != null ? String(pagamento.valor) : '',
  );
  const [lancamentoId, setLancamentoId] = useState('');
  const [observacao, setObservacao] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [carregandoSug, setCarregandoSug] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState('');

  const valorOriginal = Number(pagamento?.valor ?? 0);
  const valorDigitado = Number(String(valorPago).replace(',', '.'));
  const diferenca = Number.isFinite(valorDigitado) ? valorDigitado - valorOriginal : null;

  useCloseOnEscape(!!pagamento, onClose, { enabled: !salvando });

  useEffect(() => {
    if (!pagamento?.dataVencimento) return;
    let cancel = false;
    setCarregandoSug(true);
    setErroModal('');
    const inicio = isoAddDays(pagamento.dataVencimento, -30);
    const fim = isoAddDays(pagamento.dataVencimento, 30);
    buscarSugestoesConciliacao({ periodoInicio: inicio, periodoFim: fim })
      .then((lista) => {
        if (cancel) return;
        const bloco = Array.isArray(lista)
          ? lista.find((x) => Number(x?.pagamento?.id) === Number(pagamento.id))
          : null;
        setSugestoes(bloco?.sugestoes ?? []);
      })
      .catch(() => {
        if (!cancel) setSugestoes([]);
      })
      .finally(() => {
        if (!cancel) setCarregandoSug(false);
      });
    return () => {
      cancel = true;
    };
  }, [pagamento?.id, pagamento?.dataVencimento]);

  const opcoesSelect = useMemo(() => {
    return sugestoes.map((s) => {
      const l = s.lancamento || {};
      const label = `${fmtData(l.dataLancamento)} - ${l.bancoNome || 'Banco'} - ${(l.descricao || '').slice(0, 40)} - ${formatBRL(Number(l.valor ?? 0))} (${s.score} pts)`;
      return { id: String(l.id), label, score: s.score };
    });
  }, [sugestoes]);

  async function confirmar() {
    const vp = Number(String(valorPago).replace(',', '.'));
    if (!Number.isFinite(vp)) {
      setErroModal('Informe o valor pago pelo banco.');
      return;
    }
    setSalvando(true);
    setErroModal('');
    try {
      await conferirPagamento(pagamento.id, {
        financeiroLancamentoId: lancamentoId ? Number(lancamentoId) : null,
        valorPagoBanco: vp,
        observacao: observacao.trim() || null,
      });
      onSuccess?.();
      onClose();
    } catch (e) {
      const msg = e?.message || 'Não foi possível conferir o pagamento.';
      setErroModal(msg);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="mt-8 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">Conferir pagamento com extrato</h2>
          <button type="button" className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-xs">
          <div className="rounded-lg bg-slate-50 dark:bg-slate-950/50 p-2 space-y-1">
            <div>
              <span className="text-slate-500">Descrição:</span> {pagamento.descricao}
            </div>
            {pagamento.imovelId != null ? (
              <div>
                <span className="text-slate-500">Imóvel id:</span> {pagamento.imovelId}
              </div>
            ) : null}
            <div>
              <span className="text-slate-500">Vencimento:</span> {fmtData(pagamento.dataVencimento)} — Valor boleto:{' '}
              {formatBRL(valorOriginal)}
            </div>
          </div>

          <label className="flex flex-col gap-0.5">
            <span className="font-medium">Valor pago pelo banco *</span>
            <input
              type="number"
              step="0.01"
              className="rounded border border-slate-300 px-2 py-1.5 dark:bg-slate-950 dark:border-slate-600"
              value={valorPago}
              onChange={(e) => setValorPago(e.target.value)}
            />
            {diferenca != null && Number.isFinite(diferenca) && Math.abs(diferenca) > 0.001 ? (
              <span
                className={
                  Math.abs(diferenca) >= 10
                    ? 'text-red-700 dark:text-red-300 font-medium'
                    : 'text-amber-700 dark:text-amber-200 font-medium'
                }
              >
                Diferença: {formatBRL(diferenca)}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-0.5">
            <span className="font-medium">Vincular à transação bancária (opcional)</span>
            {carregandoSug ? (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Buscando transações…
              </span>
            ) : null}
            <select
              className="rounded border border-slate-300 px-2 py-1.5 dark:bg-slate-950 dark:border-slate-600"
              value={lancamentoId}
              onChange={(e) => setLancamentoId(e.target.value)}
            >
              <option value="">— Sem vínculo —</option>
              {opcoesSelect.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            {!carregandoSug && opcoesSelect.length === 0 ? (
              <span className="text-slate-500">Nenhuma transação compatível encontrada no período.</span>
            ) : null}
          </label>

          <label className="flex flex-col gap-0.5">
            <span className="font-medium">Observação</span>
            <textarea
              rows={2}
              maxLength={500}
              className="rounded border border-slate-300 px-2 py-1.5 dark:bg-slate-950"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </label>

          {erroModal ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {erroModal}
            </div>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando}
            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-1"
            onClick={() => void confirmar()}
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Conferir
          </button>
        </div>
      </div>
    </div>
  );
}
