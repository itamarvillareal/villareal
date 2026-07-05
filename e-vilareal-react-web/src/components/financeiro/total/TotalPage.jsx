import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { featureFlags } from '../../../config/featureFlags.js';
import { Pagination } from '../shared/Pagination.jsx';
import { PeriodoSelector } from '../shared/PeriodoSelector.jsx';
import { isPeriodoTotal, mesAtualIso } from '../shared/periodoFinanceiro.js';
import { EtapaFiltroSelect } from '../shared/EtapaFiltroSelect.jsx';
import { ExtratoTable } from '../extrato/ExtratoTable.jsx';
import { ExtratoDetailPanel } from '../extrato/ExtratoDetailPanel.jsx';
import { LetrasFiltroExtrato } from '../extrato/LetrasFiltroExtrato.jsx';
import {
  LETRAS_MODO_INCLUIR,
  letrasFiltroAtivo,
} from '../extrato/extratoLetrasFiltro.js';
import { extratoRowKey } from './totalFinanceiroMerge.js';
import { carregarTotalFinanceiroPaginado } from './totalFinanceiroLoader.js';
import { somarLancamentosExtratoRows } from '../consolidado/consolidadoUtils.js';
import { filtroCompensacaoSemParAtivo } from '../extrato/compensacaoSemPar.js';
import { useExtratoParearPorClique } from '../extrato/useExtratoParearPorClique.js';
import { ModoParearBanner } from '../extrato/ModoParearBanner.jsx';

const fmtBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const BUSCA_DEBOUNCE_MS = 300;

/**
 * @param {{ embedded?: boolean, mes?: string, onMesChange?: (v: string) => void }} [props]
 */
export function TotalPage({ embedded = false, mes: mesProp, onMesChange } = {}) {
  const [mesLocal, setMesLocal] = useState(mesAtualIso);
  const mes = mesProp ?? mesLocal;
  const setMes = onMesChange ?? setMesLocal;
  const [filtroEtapa, setFiltroEtapa] = useState('');
  const [filtroLetras, setFiltroLetras] = useState([]);
  const [filtroLetrasModo, setFiltroLetrasModo] = useState(LETRAS_MODO_INCLUIR);
  const [buscaLocal, setBuscaLocal] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [sortAsc, setSortAsc] = useState(false);
  const [rows, setRows] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [truncado, setTruncado] = useState(false);
  const [stats, setStats] = useState({ totalBanco: 0, totalCartao: 0 });
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [detailItem, setDetailItem] = useState(null);

  const atualizarLinhasAposParear = useCallback((origemMerged, contrapartidaMerged) => {
    setRows((prev) =>
      prev.map((r) => {
        const key = r._rowKey ?? extratoRowKey(r);
        const oKey = origemMerged._rowKey ?? extratoRowKey(origemMerged);
        const cKey = contrapartidaMerged._rowKey ?? extratoRowKey(contrapartidaMerged);
        if (key === oKey) return { ...origemMerged, _rowKey: key };
        if (key === cKey) return { ...contrapartidaMerged, _rowKey: key };
        return r;
      }),
    );
  }, []);

  const {
    modoParearAtivo,
    modoParearOrigemKey,
    pareando,
    handleModoParearChange,
    handleRowClick: handleRowClickParear,
  } = useExtratoParearPorClique({
    detailItem,
    setDetailItem,
    onPareadoRows: atualizarLinhasAposParear,
  });

  const handleRowClick = useCallback(
    (item) => {
      void handleRowClickParear(item, setDetailItem);
    },
    [handleRowClickParear],
  );

  useEffect(() => {
    const t = window.setTimeout(() => setBuscaDebounced(buscaLocal.trim()), BUSCA_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [buscaLocal]);

  useEffect(() => {
    setPage(0);
    setSelectedKeys(new Set());
  }, [mes, filtroEtapa, filtroLetras, filtroLetrasModo, buscaDebounced, sortAsc]);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro) {
      setRows([]);
      return undefined;
    }
    const ac = new AbortController();
    setLoading(true);
    setErro('');
    carregarTotalFinanceiroPaginado(
      {
        mes,
        busca: buscaDebounced || undefined,
        etapa: filtroEtapa || undefined,
        letras: filtroLetras,
        letrasModo: filtroLetrasModo,
        page,
        size: pageSize,
        sortAsc,
      },
      { signal: ac.signal },
    )
      .then((res) => {
        if (ac.signal.aborted) return;
        setRows(res.content ?? []);
        setTotalElements(Number(res.totalElements) || 0);
        setTotalPages(Math.max(1, Number(res.totalPages) || 1));
        setTruncado(Boolean(res.truncado));
        setStats({
          totalBanco: Number(res.totalBanco) || 0,
          totalCartao: Number(res.totalCartao) || 0,
        });
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        setErro(e?.message || 'Erro ao carregar lançamentos.');
        setRows([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [mes, filtroEtapa, filtroLetras, filtroLetrasModo, buscaDebounced, page, pageSize, sortAsc]);

  const resumoPagina = useMemo(() => somarLancamentosExtratoRows(rows), [rows]);

  const toggleSelect = useCallback((rowKey) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const keys = rows.map((r) => r._rowKey ?? extratoRowKey(r));
    setSelectedKeys((prev) => {
      const all = keys.length > 0 && keys.every((k) => prev.has(k));
      if (all) return new Set();
      return new Set(keys);
    });
  }, [rows]);

  const limparFiltros = useCallback(() => {
    setBuscaLocal('');
    setBuscaDebounced('');
    setFiltroEtapa('');
    setFiltroLetras([]);
    setFiltroLetrasModo(LETRAS_MODO_INCLUIR);
  }, []);

  const filtroAtivo = Boolean(
    buscaDebounced || filtroEtapa || letrasFiltroAtivo({ letras: filtroLetras }),
  );
  const semParCompensacaoAtivo = filtroCompensacaoSemParAtivo({
    letras: filtroLetras,
    letrasModo: filtroLetrasModo,
    etapa: filtroEtapa,
  });

  return (
    <div className="relative flex flex-col flex-1 min-h-0 overflow-hidden">
      <div
        className={`flex-1 min-h-0 overflow-auto space-y-4 max-w-6xl w-full mx-auto ${
          embedded ? 'p-3' : 'p-4'
        }`}
      >
        {embedded ? null : (
          <header>
            <h1 className="text-lg font-medium text-slate-900 dark:text-slate-100">Total</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Todos os lançamentos de extratos bancários e cartões de crédito.
            </p>
          </header>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ResumoCard label="Créditos (página)" value={resumoPagina.creditos} tone="credit" />
          <ResumoCard label="Débitos (página)" value={resumoPagina.debitos} tone="debit" />
          <ResumoCard
            label="Saldo (página)"
            value={resumoPagina.saldo}
            sub={`${totalElements.toLocaleString('pt-BR')} lançamentos${isPeriodoTotal(mes) ? ' (total)' : ' no período'}`}
          />
        </div>

        {truncado ? (
          <p className="text-xs text-amber-700 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2">
            Exibindo até {40 * 500} lançamentos bancários neste período. Refine o filtro de período para ver tudo.
          </p>
        ) : null}

        {semParCompensacaoAtivo ? (
          <p className="text-xs text-slate-600 dark:text-slate-400 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
            Filtro <strong>Somente E</strong> + <strong>Pendente</strong>: lançamentos na conta compensação (E) que
            ainda não formaram par — inclui pendentes e classificados, exclui compensados.
          </p>
        ) : null}

        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800">
            <PeriodoSelector value={mes} onChange={setMes} incluirTotal />
            <EtapaFiltroSelect value={filtroEtapa} onChange={setFiltroEtapa} />
            <LetrasFiltroExtrato
              letras={filtroLetras}
              letrasModo={filtroLetrasModo}
              onChange={(letras, letrasModo) => {
                setFiltroLetras(letras);
                setFiltroLetrasModo(letrasModo);
              }}
            />
            <label className="flex flex-1 min-w-[140px] items-center gap-1.5 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden />
              <input
                type="search"
                value={buscaLocal}
                onChange={(e) => setBuscaLocal(e.target.value)}
                placeholder="Buscar descrição, banco ou cartão…"
                className="w-full min-w-0 bg-transparent border-0 text-slate-900 dark:text-slate-100 focus:outline-none"
              />
              {buscaLocal ? (
                <button
                  type="button"
                  onClick={() => setBuscaLocal('')}
                  className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-700"
                  aria-label="Limpar busca"
                >
                  <X className="w-3 h-3" />
                </button>
              ) : null}
            </label>
            {filtroAtivo ? (
              <button
                type="button"
                onClick={limparFiltros}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs text-slate-600 dark:text-slate-300"
              >
                <X className="w-3 h-3" />
                Limpar filtros
              </button>
            ) : null}
            <span className="text-xs text-slate-500 ml-auto shrink-0">
              {stats.totalBanco.toLocaleString('pt-BR')} banco · {stats.totalCartao.toLocaleString('pt-BR')} cartão
            </span>
          </div>

          {erro ? <p className="px-3 py-2 text-sm text-red-600">{erro}</p> : null}

          {modoParearAtivo ? <ModoParearBanner pareando={pareando} /> : null}

          <ExtratoTable
            data={rows}
            selectedIds={selectedKeys}
            rowKeyField="_rowKey"
            onSelect={toggleSelect}
            onSelectAll={toggleSelectAll}
            onRowClick={handleRowClick}
            isLoading={loading}
            sortDataAsc={sortAsc}
            onSortDataDoubleClick={() => setSortAsc((v) => !v)}
            modoTotal
            modoParearAtivo={modoParearAtivo}
            modoParearOrigemKey={modoParearOrigemKey}
          />

          <Pagination
            page={page}
            totalPages={totalPages}
            totalElements={totalElements}
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
          {modoParearAtivo ? (
            <div className="absolute inset-0 z-10 pointer-events-none" aria-hidden />
          ) : (
            <button
              type="button"
              className="absolute inset-0 z-10 bg-black/20"
              aria-label="Fechar painel"
              onClick={() => setDetailItem(null)}
            />
          )}
          <ExtratoDetailPanel
            item={detailItem}
            onClose={() => setDetailItem(null)}
            onModoParearChange={handleModoParearChange}
            onSaved={(updated) => {
              setRows((prev) =>
                prev.map((r) => {
                  const key = r._rowKey ?? extratoRowKey(r);
                  const uKey = updated._rowKey ?? extratoRowKey(updated);
                  return key === uKey ? { ...updated, _rowKey: key } : r;
                }),
              );
              setDetailItem(updated);
            }}
            onDeleted={(apiId) => {
              setRows((prev) => prev.filter((r) => Number(r.id) !== Number(apiId)));
              setTotalElements((n) => Math.max(0, Number(n) - 1));
              setSelectedKeys((prev) => {
                const next = new Set(prev);
                for (const r of rows) {
                  if (Number(r.id) === Number(apiId)) next.delete(r._rowKey ?? extratoRowKey(r));
                }
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
