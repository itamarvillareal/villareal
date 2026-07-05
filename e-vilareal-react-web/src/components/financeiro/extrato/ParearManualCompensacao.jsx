import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search } from 'lucide-react';
import { featureFlags } from '../../../config/featureFlags.js';
import { pesquisarLancamentosValorDataApi } from '../../../repositories/financeiroRepository.js';
import { executarPareamentoCompensacao } from './executarPareamentoCompensacao.js';
import { useFinanceiroToast } from '../shared/Toast.jsx';
import { dispatchRefreshPendentes } from '../hooks/useKeyboardShortcuts.js';
import { ContaBadge } from '../shared/ContaBadge.jsx';
import { ValorText } from '../shared/ValorText.jsx';
import { normalizarValorPesquisaInput } from '../pesquisa/pesquisaValorLancamentoUtils.js';
import { mapApiLancamentoToExtratoRow } from './extratoMappers.js';
import {
  dataLancamentoParaIso,
  filtrarCandidatosPareamento,
  valorAbsolutoParaPesquisaApi,
} from './parearManualCompensacao.js';

export function ParearManualCompensacao({ lancamento, contaToLetra, onPareado, disabled = false }) {
  const toast = useFinanceiroToast();
  const [dataIso, setDataIso] = useState('');
  const [valorLocal, setValorLocal] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [pareandoId, setPareandoId] = useState(null);
  const [erro, setErro] = useState('');
  const [candidatos, setCandidatos] = useState([]);

  const buscarCom = useCallback(
    async (data, valorTexto) => {
      if (!featureFlags.useApiFinanceiro) {
        setErro('API financeiro desativada.');
        return;
      }
      const dataNorm = String(data ?? '').trim();
      const valorNorm = normalizarValorPesquisaInput(valorTexto);
      if (!dataNorm || !valorNorm) {
        setErro('Informe data e valor para buscar a contrapartida.');
        setCandidatos([]);
        return;
      }
      setBuscando(true);
      setErro('');
      try {
        const lista = await pesquisarLancamentosValorDataApi({ data: dataNorm, valor: valorNorm });
        const rows = (Array.isArray(lista) ? lista : []).map(({ lancamento: l }) =>
          mapApiLancamentoToExtratoRow(l, contaToLetra),
        );
        const filtrados = filtrarCandidatosPareamento(rows, lancamento);
        setCandidatos(filtrados);
        if (!filtrados.length) {
          setErro('Nenhuma contrapartida encontrada para esta data e valor.');
        }
      } catch (e) {
        setCandidatos([]);
        setErro(e?.message || 'Falha na busca.');
      } finally {
        setBuscando(false);
      }
    },
    [contaToLetra, lancamento],
  );

  useEffect(() => {
    const iso = dataLancamentoParaIso(lancamento?.dataLancamento);
    const valor = valorAbsolutoParaPesquisaApi(lancamento?.valor);
    setDataIso(iso);
    setValorLocal(valor);
    setCandidatos([]);
    setErro('');
    if (!iso || !valor || !lancamento?.id) return;
    void buscarCom(iso, valor);
  }, [lancamento?.id, lancamento?.dataLancamento, lancamento?.valor, buscarCom]);

  const handleBuscar = useCallback(
    (e) => {
      e?.preventDefault?.();
      void buscarCom(dataIso, valorLocal);
    },
    [buscarCom, dataIso, valorLocal],
  );

  const handleParear = useCallback(
    async (candidato) => {
      const idA = Number(lancamento?.id);
      const idB = Number(candidato?.id);
      if (!idA || !idB || idA === idB) return;
      setPareandoId(idB);
      try {
        const { origemMerged } = await executarPareamentoCompensacao({
          origem: lancamento,
          contrapartidaRow: candidato,
          contaToLetra,
        });
        toast.success('Lançamentos pareados com sucesso.');
        dispatchRefreshPendentes();
        onPareado?.(origemMerged);
      } catch (e) {
        toast.error(e?.message || 'Falha ao parear lançamentos.');
      } finally {
        setPareandoId(null);
      }
    },
    [contaToLetra, lancamento, onPareado, toast],
  );

  const ocupado = disabled || buscando || pareandoId != null;
  const titulo = useMemo(
    () =>
      candidatos.length
        ? `${candidatos.length} candidato${candidatos.length !== 1 ? 's' : ''}`
        : 'Buscar contrapartida',
    [candidatos.length],
  );

  if (!featureFlags.useApiFinanceiro) return null;

  return (
    <div className="mt-2 space-y-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 p-2.5">
      <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{titulo}</p>
      <p className="text-[11px] font-medium text-emerald-800 dark:text-emerald-200">
        Clique em uma linha na tabela para parear.
      </p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Ou busque abaixo por data e valor exato (sinal ignorado).
      </p>
      <form className="flex flex-wrap items-end gap-2" onSubmit={handleBuscar}>
        <label className="flex flex-col gap-0.5 text-[11px] text-slate-600 dark:text-slate-400">
          Data
          <input
            type="date"
            value={dataIso}
            onChange={(e) => setDataIso(e.target.value)}
            disabled={ocupado}
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-[11px] text-slate-600 dark:text-slate-400 min-w-[120px]">
          Valor
          <input
            type="text"
            inputMode="decimal"
            value={valorLocal}
            onChange={(e) => setValorLocal(e.target.value)}
            disabled={ocupado}
            placeholder="Ex.: 1500,00"
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={ocupado}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-xs font-medium hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50"
        >
          {buscando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          Buscar
        </button>
      </form>
      {erro ? <p className="text-[11px] text-amber-800 dark:text-amber-200">{erro}</p> : null}
      {candidatos.length > 0 ? (
        <ul className="space-y-2 max-h-48 overflow-y-auto">
          {candidatos.map((c) => (
            <li
              key={c.id}
              className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <ContaBadge codigo={c.contaCodigo} size="sm" />
                  <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                    {c.dataExibicao}
                  </span>
                  <ValorText valor={c.valor} natureza={c.natureza} />
                </div>
              </div>
              <p className="text-xs text-slate-800 dark:text-slate-100 line-clamp-2 mb-2">
                {c.descricao || '—'}
              </p>
              {c.bancoNome ? (
                <p className="text-[10px] text-slate-400 mb-2 truncate">{c.bancoNome}</p>
              ) : null}
              <button
                type="button"
                disabled={ocupado}
                onClick={() => void handleParear(c)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {pareandoId === c.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Parear com este lançamento
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
