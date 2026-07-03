import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  buildContaToLetraMerge,
  loadPersistedContasContabeisExtrasFinanceiro,
} from '../../../data/financeiroData.js';
import { pesquisarLancamentosValorDataApi } from '../../../repositories/financeiroRepository.js';
import { useCloseOnEscape } from '../../../hooks/useCloseOnEscape.js';
import { ContaBadge } from '../shared/ContaBadge.jsx';
import { ValorText } from '../shared/ValorText.jsx';
import { ExtratoDetailPanel } from '../extrato/ExtratoDetailPanel.jsx';
import { mapApiLancamentoToExtratoRow } from '../extrato/extratoMappers.js';
import { formatDataIsoParaBr, normalizarValorPesquisaInput } from './pesquisaValorLancamentoUtils.js';

export function ModalPesquisaValorLancamento({ open, onClose }) {
  const [dataIso, setDataIso] = useState('');
  const [valorLocal, setValorLocal] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultados, setResultados] = useState([]);
  const [detailItem, setDetailItem] = useState(null);

  const contaToLetra = useMemo(
    () => buildContaToLetraMerge(loadPersistedContasContabeisExtrasFinanceiro()),
    [],
  );

  const linhas = useMemo(
    () =>
      (resultados ?? []).map(({ lancamento, extratoBloqueado }) => ({
        ...mapApiLancamentoToExtratoRow(lancamento, contaToLetra),
        extratoBloqueado: Boolean(extratoBloqueado),
        origemExtrato: 'banco',
      })),
    [resultados, contaToLetra],
  );

  const reset = useCallback(() => {
    setDataIso('');
    setValorLocal('');
    setErro('');
    setResultados([]);
    setDetailItem(null);
    setBuscando(false);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useCloseOnEscape(open, onClose);

  const buscar = useCallback(async () => {
    if (!featureFlags.useApiFinanceiro) {
      setErro('API financeiro desativada.');
      return;
    }
    const data = String(dataIso ?? '').trim();
    const valor = normalizarValorPesquisaInput(valorLocal);
    if (!data) {
      setErro('Informe a data do lançamento.');
      return;
    }
    if (!valor) {
      setErro('Informe o valor exato.');
      return;
    }
    setBuscando(true);
    setErro('');
    setDetailItem(null);
    try {
      const lista = await pesquisarLancamentosValorDataApi({ data, valor });
      setResultados(Array.isArray(lista) ? lista : []);
      if (!lista?.length) {
        setErro('Nenhum lançamento encontrado para esta data e valor.');
      }
    } catch (e) {
      setResultados([]);
      setErro(e?.message || 'Falha na pesquisa.');
    } finally {
      setBuscando(false);
    }
  }, [dataIso, valorLocal]);

  const handleSaved = useCallback(
    (updated) => {
      setDetailItem(updated);
      void buscar();
    },
    [buscar],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pesquisa-valor-title"
        className="relative flex flex-col w-full max-w-5xl max-h-[100dvh] sm:max-h-[92dvh] mx-auto bg-white dark:bg-slate-900 shadow-xl sm:rounded-xl overflow-hidden"
      >
        <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div>
            <h2 id="pesquisa-valor-title" className="text-base font-medium text-slate-900 dark:text-slate-100">
              Pesquisar lançamento por valor
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
              Busca exata por data e valor (positivo ou negativo). Inclui extratos bloqueados — vincule à
              Conta Escritório para acessar depois pelo consolidado.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex flex-1 min-h-0">
          <div className="flex flex-col flex-1 min-w-0 min-h-0">
            <form
              className="flex flex-wrap items-end gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0"
              onSubmit={(e) => {
                e.preventDefault();
                void buscar();
              }}
            >
              <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
                Data
                <input
                  type="date"
                  value={dataIso}
                  onChange={(e) => setDataIso(e.target.value)}
                  className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400 min-w-[140px]">
                Valor exato
                <input
                  type="text"
                  inputMode="decimal"
                  value={valorLocal}
                  onChange={(e) => setValorLocal(e.target.value)}
                  placeholder="Ex.: 1500,00"
                  className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={buscando}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Buscar
              </button>
            </form>

            {erro ? (
              <p className="px-4 py-2 text-sm text-red-600 dark:text-red-400 shrink-0">{erro}</p>
            ) : null}

            <div className="flex-1 min-h-0 overflow-auto px-4 py-3">
              {linhas.length === 0 && !buscando && !erro ? (
                <p className="text-sm text-slate-500 py-8 text-center">
                  Informe data e valor e clique em Buscar.
                </p>
              ) : null}
              {linhas.length > 0 ? (
                <ul className="space-y-2">
                  {linhas.map((row) => {
                    const ativo = detailItem?.id === row.id;
                    return (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() => setDetailItem(row)}
                          className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                            ativo
                              ? 'border-blue-400 bg-blue-50/80 dark:bg-blue-950/30'
                              : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <ContaBadge codigo={row.contaCodigo} size="sm" />
                            <span className="text-xs text-slate-500 tabular-nums">
                              {row.dataExibicao || formatDataIsoParaBr(row.dataLancamento)}
                            </span>
                            <ValorText valor={row.valor} natureza={row.natureza} />
                            {row.extratoBloqueado ? (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                Extrato bloqueado
                              </span>
                            ) : null}
                          </div>
                          <p className="text-sm text-slate-900 dark:text-slate-100 line-clamp-2">
                            {row.descricao}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {row.bancoNome || '—'}
                            {row.codCliente ? ` · Cliente ${row.codCliente}` : ''}
                            {row.proc ? ` · Proc. ${row.proc}` : ''}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          </div>

          {detailItem ? (
            <div className="hidden lg:flex w-[min(420px,42%)] shrink-0 border-l border-slate-200 dark:border-slate-800 min-h-0 relative">
              {detailItem.extratoBloqueado ? (
                <p className="absolute top-2 left-2 right-2 z-10 text-[11px] rounded-md border border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100 px-2 py-1">
                  Extrato do banco indisponível para você. Vincule à Conta Escritório (A) e use o consolidado.
                </p>
              ) : null}
              <ExtratoDetailPanel
                item={detailItem}
                onClose={() => setDetailItem(null)}
                onSaved={handleSaved}
                onDeleted={() => {
                  setResultados((prev) =>
                    prev.filter((r) => Number(r?.lancamento?.id) !== Number(detailItem.id)),
                  );
                  setDetailItem(null);
                }}
              />
            </div>
          ) : null}
        </div>

        {detailItem ? (
          <div className="lg:hidden fixed inset-0 z-[90] flex flex-col bg-white dark:bg-slate-900">
            {detailItem.extratoBloqueado ? (
              <p className="shrink-0 text-[11px] border-b border-amber-200 bg-amber-50 text-amber-950 px-3 py-2">
                Extrato bloqueado — vincule à Conta Escritório para acessar pelo consolidado.
              </p>
            ) : null}
            <ExtratoDetailPanel
              item={detailItem}
              onClose={() => setDetailItem(null)}
              onSaved={handleSaved}
              onDeleted={() => {
                setResultados((prev) =>
                  prev.filter((r) => Number(r?.lancamento?.id) !== Number(detailItem.id)),
                );
                setDetailItem(null);
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
