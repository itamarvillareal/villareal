import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { featureFlags } from '../config/featureFlags.js';
import {
  buildLetraToContaMerge,
  buildNumeroBancoMap,
  buildOrdemLetrasContabeisCompleta,
  getContasContabeisDerivadasExtratos,
  getExtratosIniciais,
  getSaldosPorInstituicaoFinanceiro,
  loadPersistedContasContabeisExtrasFinanceiro,
  loadPersistedContasContabeisInativasFinanceiro,
  loadPersistedContasExtrasFinanceiro,
  loadPersistedExtratosFinanceiro,
  loadPersistedExtratosInativosFinanceiro,
  somarValoresLancamentosFinanceiro,
} from '../data/financeiroData.js';
import { carregarExtratosFinanceiroApiFirst } from '../repositories/financeiroRepository.js';
import { EVENT_FINANCEIRO_PERSISTENCIA_EXTERNA } from '../services/crossTabLocalStorageSync.js';

function fmtReais(v) {
  const n = Number(v) || 0;
  const s = Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-${s}` : s;
}

function classeValor(v) {
  const n = Number(v) || 0;
  if (n > 0) return 'text-emerald-700 dark:text-emerald-300';
  if (n < 0) return 'text-red-700 dark:text-red-300';
  return 'text-slate-600';
}

function TabelaSaldos({ titulo, subtitulo, linhas, colConta, onRowClick }) {
  const totalSaldo = linhas.reduce((s, r) => s + (Number(r.saldo) || 0), 0);
  const totalCount = linhas.reduce((s, r) => s + (Number(r.count) || 0), 0);

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white/95 shadow-md overflow-hidden ring-1 ring-slate-200/60">
      <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-4 py-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-white">{titulo}</h2>
        {subtitulo ? <p className="text-xs text-white/90 mt-0.5 font-medium">{subtitulo}</p> : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
              <th className="py-2.5 px-3">{colConta}</th>
              <th className="py-2.5 px-3 w-16 text-center">Nº</th>
              <th className="py-2.5 px-3 w-24 text-right">Lanç.</th>
              <th className="py-2.5 px-3 w-36 text-right">Saldo atual</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 px-3 text-center text-slate-500">
                  Nenhuma conta com movimento carregado.
                </td>
              </tr>
            ) : (
              linhas.map((row) => {
                const key = row.nome || row.letra;
                const clickable = Boolean(onRowClick);
                return (
                  <tr
                    key={key}
                    className={`border-b border-slate-100 last:border-0 ${
                      row.inativo ? 'bg-slate-50/80 opacity-75' : 'hover:bg-indigo-50/40'
                    } ${clickable ? 'cursor-pointer' : ''}`}
                    onClick={clickable ? () => onRowClick(row) : undefined}
                    title={clickable ? 'Abrir extrato desta instituição' : undefined}
                  >
                    <td className="py-2 px-3 font-medium text-slate-800">
                      {row.nome}
                      {row.inativo ? (
                        <span className="ml-2 text-[10px] font-semibold uppercase text-slate-500">inativa</span>
                      ) : null}
                    </td>
                    <td className="py-2 px-3 text-center tabular-nums text-slate-600">
                      {row.numeroBanco ?? row.letra ?? '—'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-600">{row.count ?? 0}</td>
                    <td className={`py-2 px-3 text-right tabular-nums font-semibold ${classeValor(row.saldo)}`}>
                      {fmtReais(row.saldo)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {linhas.length > 0 ? (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-100/90 font-semibold">
                <td className="py-2.5 px-3 text-slate-800">Total (soma das linhas)</td>
                <td className="py-2.5 px-3" />
                <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">{totalCount}</td>
                <td className={`py-2.5 px-3 text-right tabular-nums ${classeValor(totalSaldo)}`}>
                  {fmtReais(totalSaldo)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
}

export function FinanceiroRelatorios() {
  const navigate = useNavigate();
  const [extratosPorBanco, setExtratosPorBanco] = useState(() => {
    const base = getExtratosIniciais();
    const persisted = loadPersistedExtratosFinanceiro();
    return persisted ? { ...base, ...persisted } : base;
  });
  const [extratosInativos, setExtratosInativos] = useState(() => loadPersistedExtratosInativosFinanceiro());
  const [contasContabeisInativas, setContasContabeisInativas] = useState(() =>
    loadPersistedContasContabeisInativasFinanceiro(),
  );
  const [contasExtras] = useState(() => loadPersistedContasExtrasFinanceiro());
  const [contasContabeisExtras] = useState(() => loadPersistedContasContabeisExtrasFinanceiro());
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const recarregar = useCallback(async () => {
    if (!featureFlags.useApiFinanceiro) {
      const persisted = loadPersistedExtratosFinanceiro();
      setExtratosPorBanco(persisted ? { ...getExtratosIniciais(), ...persisted } : getExtratosIniciais());
      return;
    }
    setLoading(true);
    setErro('');
    try {
      const dados = await carregarExtratosFinanceiroApiFirst();
      const base = getExtratosIniciais();
      const apiBancos = dados?.extratosPorBanco ?? dados;
      setExtratosPorBanco({ ...base, ...(apiBancos && typeof apiBancos === 'object' ? apiBancos : {}) });
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar extratos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  useEffect(() => {
    const onStorage = () => {
      setExtratosInativos(loadPersistedExtratosInativosFinanceiro());
      setContasContabeisInativas(loadPersistedContasContabeisInativasFinanceiro());
      if (!featureFlags.useApiFinanceiro) {
        const persisted = loadPersistedExtratosFinanceiro();
        setExtratosPorBanco(persisted ? { ...getExtratosIniciais(), ...persisted } : getExtratosIniciais());
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(EVENT_FINANCEIRO_PERSISTENCIA_EXTERNA, onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(EVENT_FINANCEIRO_PERSISTENCIA_EXTERNA, onStorage);
    };
  }, []);

  const numeroBancoMap = useMemo(() => buildNumeroBancoMap(contasExtras), [contasExtras]);
  const ordemBancos = useMemo(
    () => [...Object.keys(numeroBancoMap).sort((a, b) => (numeroBancoMap[a] ?? 999) - (numeroBancoMap[b] ?? 999))],
    [numeroBancoMap],
  );

  const letraToConta = useMemo(() => buildLetraToContaMerge(contasContabeisExtras), [contasContabeisExtras]);
  const ordemLetras = useMemo(
    () => buildOrdemLetrasContabeisCompleta(contasContabeisExtras),
    [contasContabeisExtras],
  );
  const inativasContabeisSet = useMemo(() => new Set(contasContabeisInativas), [contasContabeisInativas]);

  const saldosBancos = useMemo(
    () =>
      getSaldosPorInstituicaoFinanceiro(extratosPorBanco, {
        ordemNomes: ordemBancos,
        inativos: extratosInativos,
        numeroPorBanco: numeroBancoMap,
        incluirSemMovimento: true,
      }),
    [extratosPorBanco, ordemBancos, extratosInativos, numeroBancoMap],
  );

  const saldosContabeis = useMemo(() => {
    const derivadas = getContasContabeisDerivadasExtratos(extratosPorBanco, letraToConta, ordemLetras);
    return derivadas.map((c) => ({
      ...c,
      inativo: inativasContabeisSet.has(c.nome),
    }));
  }, [extratosPorBanco, letraToConta, ordemLetras, inativasContabeisSet]);

  const saldoGeralExtratos = useMemo(
    () => somarValoresLancamentosFinanceiro(Object.values(extratosPorBanco || {}).flat()),
    [extratosPorBanco],
  );

  const abrirExtratoBanco = (row) => {
    if (!row?.nome) return;
    navigate('/financeiro', { state: { instituicaoSelecionada: row.nome } });
  };

  return (
    <div className="flex-1 px-3 py-4 md:px-5 md:py-5 space-y-5 overflow-auto min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mx-1">
        <p className="text-sm text-slate-600 max-w-3xl">
          Saldos calculados pela <strong>soma de todos os lançamentos</strong> carregados em cada extrato ou conta
          contábil. Reflete o histórico importado — não substitui o saldo oficial do banco na data de hoje.
        </p>
        <button
          type="button"
          onClick={() => void recarregar()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          Atualizar
        </button>
      </div>

      {erro ? (
        <p className="mx-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{erro}</p>
      ) : null}
      {loading ? <p className="mx-1 text-sm text-indigo-700">Carregando lançamentos…</p> : null}

      <div className="mx-1 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-emerald-950">Saldo líquido (todos os extratos bancários)</span>
        <span className={`text-lg font-bold tabular-nums ${classeValor(saldoGeralExtratos)}`}>
          {fmtReais(saldoGeralExtratos)}
        </span>
      </div>

      <TabelaSaldos
        titulo="Contas bancárias (extratos)"
        subtitulo="Clique na linha para abrir o extrato da instituição"
        colConta="Instituição"
        linhas={saldosBancos}
        onRowClick={abrirExtratoBanco}
      />

      <TabelaSaldos
        titulo="Contas contábeis (consolidado)"
        subtitulo="Soma dos lançamentos classificados com cada letra em todos os bancos"
        colConta="Conta contábil"
        linhas={saldosContabeis.map((c) => ({
          nome: c.nome,
          letra: c.letra,
          numeroBanco: c.letra,
          count: c.count,
          saldo: c.saldo,
          inativo: c.inativo,
        }))}
      />
    </div>
  );
}
