import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  buildContaToLetraMerge,
  loadPersistedContasContabeisExtrasFinanceiro,
} from '../../../data/financeiroData.js';
import {
  listarContasFinanceiro,
  listarLancamentosFinanceiroPaginados,
  obterResumoConsolidadoContasApi,
} from '../../../repositories/financeiroRepository.js';
import { ContaBadge } from '../shared/ContaBadge.jsx';
import { Pagination } from '../shared/Pagination.jsx';
import { PeriodoSelector } from '../shared/PeriodoSelector.jsx';
import { EtapaFiltroSelect } from '../shared/EtapaFiltroSelect.jsx';
import { ExtratoTable } from '../extrato/ExtratoTable.jsx';
import { ExtratoDetailPanel } from '../extrato/ExtratoDetailPanel.jsx';
import { mapApiLancamentoToExtratoRow } from '../extrato/extratoMappers.js';
import { ConsolidadoEvolucaoChart } from './ConsolidadoEvolucaoChart.jsx';
import {
  CONTAS_LETRAS,
  labelContaTab,
  mesAtualIso,
} from './consolidadoUtils.js';
import {
  CADASTRO_PARCIAL,
  CADASTRO_PLENO,
  CADASTRO_TODOS,
  cadastroParaQueryApi,
} from '../extrato/extratoCadastroFiltro.js';

const fmtBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const BUSCA_DEBOUNCE_MS = 300;

export function ConsolidadoPage() {
  const { conta: contaParam } = useParams();
  const navigate = useNavigate();
  const codigoAtivo = useMemo(() => {
    const c = String(contaParam ?? 'A').trim().toUpperCase();
    return CONTAS_LETRAS.includes(c) ? c : 'A';
  }, [contaParam]);

  const [mes, setMes] = useState(mesAtualIso);
  /** Conta A: cadastro pleno/parcial (bolinha azul/vermelha). Demais contas: etapa do workflow. */
  const [filtroEtapa, setFiltroEtapa] = useState('');
  const [buscaLocal, setBuscaLocal] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [contasApi, setContasApi] = useState([]);
  const [tabCounts, setTabCounts] = useState({});
  const [rows, setRows] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingTable, setLoadingTable] = useState(false);
  const [erro, setErro] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [detailItem, setDetailItem] = useState(null);

  const [chartMeses, setChartMeses] = useState(12);
  const [resumoConsolidado, setResumoConsolidado] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);

  const contaToLetra = useMemo(
    () => buildContaToLetraMerge(loadPersistedContasContabeisExtrasFinanceiro()),
    [],
  );

  const contaAtiva = useMemo(
    () => contasApi.find((c) => String(c.codigo ?? '').toUpperCase() === codigoAtivo),
    [contasApi, codigoAtivo],
  );

  const contaContabilId = contaAtiva?.id;

  useEffect(() => {
    if (contaParam && String(contaParam).toUpperCase() !== codigoAtivo) {
      navigate(`/financeiro/consolidado/${codigoAtivo}`, { replace: true });
    }
  }, [contaParam, codigoAtivo, navigate]);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro) return undefined;
    const ac = new AbortController();
    listarContasFinanceiro({ signal: ac.signal })
      .then((c) => setContasApi(Array.isArray(c) ? c : []))
      .catch(() => setContasApi([]));
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro) return undefined;
    const ac = new AbortController();
    setChartLoading(true);
    obterResumoConsolidadoContasApi({ signal: ac.signal, meses: chartMeses })
      .then((res) => {
        if (ac.signal.aborted) return;
        setResumoConsolidado(res);
        const totais = res?.totaisPorConta ?? {};
        const counts = {};
        for (const cod of CONTAS_LETRAS) {
          counts[cod] = Number(totais[cod] ?? 0);
        }
        setTabCounts(counts);
      })
      .catch(() => {
        if (!ac.signal.aborted) setTabCounts({});
      })
      .finally(() => {
        if (!ac.signal.aborted) setChartLoading(false);
      });
    return () => ac.abort();
  }, [chartMeses]);

  useEffect(() => {
    setPage(0);
    setSelectedIds(new Set());
  }, [codigoAtivo, mes]);

  useEffect(() => {
    setFiltroEtapa('');
  }, [codigoAtivo]);

  useEffect(() => {
    setPage(0);
    setSelectedIds(new Set());
  }, [filtroEtapa, buscaDebounced]);

  useEffect(() => {
    const t = window.setTimeout(() => setBuscaDebounced(buscaLocal.trim()), BUSCA_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [buscaLocal]);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro || !contaContabilId) {
      setRows([]);
      return undefined;
    }
    const ac = new AbortController();
    const [ano, mesNum] = mes.split('-').map(Number);
    setLoadingTable(true);
    setErro('');
    const filtroApi =
      codigoAtivo === 'A'
        ? cadastroParaQueryApi(
            filtroEtapa === CADASTRO_PLENO || filtroEtapa === CADASTRO_PARCIAL
              ? filtroEtapa
              : CADASTRO_TODOS,
          )
        : { etapa: filtroEtapa || undefined };

    listarLancamentosFinanceiroPaginados(
      {
        contaContabilId,
        ano,
        mes: mesNum,
        page,
        size: pageSize,
        sort: 'dataLancamento,desc',
        busca: buscaDebounced || undefined,
        ...filtroApi,
      },
      { signal: ac.signal },
    )
      .then((res) => {
        const content = (res?.content ?? []).map((l) => mapApiLancamentoToExtratoRow(l, contaToLetra));
        setRows(content);
        setTotalElements(Number(res?.totalElements) || 0);
        setTotalPages(Math.max(1, Number(res?.totalPages) || 1));
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        setErro(e?.message || 'Erro ao carregar lançamentos.');
        setRows([]);
      })
      .finally(() => setLoadingTable(false));
    return () => ac.abort();
  }, [contaContabilId, codigoAtivo, mes, page, pageSize, contaToLetra, filtroEtapa, buscaDebounced]);

  const resumoPagina = useMemo(() => {
    let creditos = 0;
    let debitos = 0;
    for (const r of rows) {
      const v = Number(r.valor ?? 0);
      if (r.natureza === 'DEBITO') debitos += v;
      else creditos += v;
    }
    return { creditos, debitos, saldo: creditos - debitos };
  }, [rows]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const ids = rows.map((r) => r.id);
    const all = ids.length > 0 && ids.every((id) => selectedIds.has(id));
    setSelectedIds(all ? new Set() : new Set(ids));
  };

  if (!featureFlags.useApiFinanceiro) {
    return (
      <div className="p-6 text-sm text-slate-600 dark:text-slate-400">
        API financeiro desativada.{' '}
        <a href="/financeiro/legado" className="text-blue-600 hover:underline dark:text-blue-400">
          Abrir consolidado legado
        </a>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col min-h-0 h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      <nav
        className="flex gap-0 overflow-x-auto border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0"
        aria-label="Contas contábeis"
      >
        {CONTAS_LETRAS.map((cod) => {
          const n = tabCounts[cod];
          return (
            <NavLink
              key={cod}
              to={`/financeiro/consolidado/${cod}`}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'font-medium border-blue-600 text-blue-700 dark:text-blue-300 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`
              }
            >
              <ContaBadge codigo={cod} size="sm" />
              <span className="hidden sm:inline max-w-[120px] truncate">{labelContaTab(cod)}</span>
              {n != null ? (
                <span className="text-xs text-slate-400 tabular-nums">
                  ({Number(n).toLocaleString('pt-BR')})
                </span>
              ) : null}
            </NavLink>
          );
        })}
      </nav>

      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4 max-w-6xl w-full mx-auto">
        <header>
          <h1 className="text-lg font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ContaBadge codigo={codigoAtivo} size="md" />
            {labelContaTab(codigoAtivo)}
          </h1>
          {contaAtiva ? null : (
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
              Conta «{codigoAtivo}» não encontrada na API.
            </p>
          )}
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ResumoCard label="Total créditos" value={resumoPagina.creditos} tone="credit" />
          <ResumoCard label="Total débitos" value={resumoPagina.debitos} tone="debit" />
          <ResumoCard
            label="Saldo (página)"
            value={resumoPagina.saldo}
            sub={`${totalElements.toLocaleString('pt-BR')} lançamentos no período`}
          />
        </div>

        <ConsolidadoEvolucaoChart
          resumo={resumoConsolidado}
          codigoAtivo={codigoAtivo}
          loading={chartLoading}
          meses={chartMeses}
          onMesesChange={setChartMeses}
        />

        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800">
            <PeriodoSelector value={mes} onChange={setMes} />
            <EtapaFiltroSelect
              value={filtroEtapa}
              onChange={setFiltroEtapa}
              modoEscritorio={codigoAtivo === 'A'}
            />
            <label
              className={`flex min-w-[160px] flex-1 max-w-md items-center gap-1.5 px-2 py-0.5 rounded-md border ${
                buscaDebounced
                  ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 dark:border-indigo-700'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden />
              <input
                type="search"
                value={buscaLocal}
                onChange={(e) => setBuscaLocal(e.target.value)}
                placeholder="Buscar descrição ou valor…"
                className="flex-1 min-w-0 bg-transparent border-0 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                aria-label="Buscar na descrição ou valor"
              />
            </label>
            <span className="text-xs text-slate-500 ml-auto shrink-0">
              {buscaDebounced ? (
                <>
                  {totalElements.toLocaleString('pt-BR')} encontrado{totalElements === 1 ? '' : 's'}
                  {rows.length > 0 ? (
                    <span className="block text-[10px]">
                      exibindo {rows.length.toLocaleString('pt-BR')} nesta página
                    </span>
                  ) : null}
                </>
              ) : (
                <>
                  {rows.length} na página · {totalElements.toLocaleString('pt-BR')} no mês
                </>
              )}
            </span>
          </div>
          {erro ? (
            <p className="px-3 py-2 text-sm text-red-600 dark:text-red-400">{erro}</p>
          ) : null}
          <ExtratoTable
            data={rows}
            selectedIds={selectedIds}
            onSelect={toggleSelect}
            onSelectAll={toggleSelectAll}
            onRowClick={setDetailItem}
            isLoading={loadingTable}
            etapaModoEscritorio={codigoAtivo === 'A'}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalElements}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(0);
            }}
          />
        </section>
      </div>

      {detailItem ? (
        <>
          <button
            type="button"
            className="absolute inset-0 z-10 bg-black/20"
            aria-label="Fechar painel"
            onClick={() => setDetailItem(null)}
          />
          <ExtratoDetailPanel
            item={detailItem}
            onClose={() => setDetailItem(null)}
            onSaved={(updated) => {
              setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
              setDetailItem(updated);
            }}
            onDeleted={(apiId) => {
              setRows((prev) => prev.filter((r) => Number(r.id) !== Number(apiId)));
              setTotalElements((n) => Math.max(0, Number(n) - 1));
              setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(apiId);
                return next;
              });
              setDetailItem(null);
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function ResumoCard({ label, value, sub, tone }) {
  const color =
    tone === 'credit'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'debit'
        ? 'text-red-600 dark:text-red-400'
        : 'text-slate-900 dark:text-slate-100';
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
      <p className={`text-xl font-medium tabular-nums ${color}`}>{fmtBrl.format(Number(value) || 0)}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      {sub ? <p className="text-xs text-slate-400 mt-0.5">{sub}</p> : null}
    </div>
  );
}
