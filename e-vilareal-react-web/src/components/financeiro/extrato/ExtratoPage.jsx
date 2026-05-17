import { useEffect, useMemo, useRef, useState } from 'react';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  buildContaToLetraMerge,
  loadPersistedContasContabeisExtrasFinanceiro,
} from '../../../data/financeiroData.js';
import {
  listarContasFinanceiro,
  listarLancamentosFinanceiroPaginados,
  obterSaldoBancoFinanceiro,
} from '../../../repositories/financeiroRepository.js';
import { useFinanceiro } from '../FinanceiroContext.jsx';
import { FINANCEIRO_REFRESH_PENDENTES } from '../hooks/useKeyboardShortcuts.js';
import { Pagination } from '../shared/Pagination.jsx';
import { ExtratoFilters } from './ExtratoFilters.jsx';
import { ExtratoTable } from './ExtratoTable.jsx';
import { ExtratoDetailPanel } from './ExtratoDetailPanel.jsx';
import { mapApiLancamentoToExtratoRow } from './extratoMappers.js';

export function ExtratoPage() {
  const { apiQuery, filters, setPage, setSize, bancoAtivo } = useFinanceiro();
  const scrollRef = useRef(null);
  const fetchKeyRef = useRef('');
  const [rows, setRows] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [detailItem, setDetailItem] = useState(null);
  const [contasApi, setContasApi] = useState([]);
  const [saldoBanco, setSaldoBanco] = useState(null);
  const [saldoBancoLoading, setSaldoBancoLoading] = useState(false);
  const [extratoRefreshKey, setExtratoRefreshKey] = useState(0);

  const contaToLetra = useMemo(
    () => buildContaToLetraMerge(loadPersistedContasContabeisExtrasFinanceiro()),
    [],
  );

  const contaContabilIdFiltro = useMemo(() => {
    if (!filters.contaCodigo) return undefined;
    const cod = String(filters.contaCodigo).toUpperCase();
    const hit = contasApi.find((c) => String(c.codigo ?? '').toUpperCase() === cod);
    return hit?.id ?? undefined;
  }, [filters.contaCodigo, contasApi]);

  const fetchParams = useMemo(
    () => ({
      ...apiQuery,
      contaContabilId: contaContabilIdFiltro,
    }),
    [apiQuery, contaContabilIdFiltro],
  );

  const fetchKey = useMemo(() => JSON.stringify(fetchParams), [fetchParams]);

  useEffect(() => {
    const ac = new AbortController();
    listarContasFinanceiro({ signal: ac.signal })
      .then((c) => setContasApi(Array.isArray(c) ? c : []))
      .catch(() => setContasApi([]));
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro) {
      setRows([]);
      setLoading(false);
      return undefined;
    }
    const myKey = fetchKey;
    fetchKeyRef.current = myKey;
    const ac = new AbortController();
    let cancelled = false;
    setRows([]);
    setSelectedIds(new Set());
    setDetailItem(null);
    setLoading(true);
    setErro('');
    (async () => {
      try {
        const res = await listarLancamentosFinanceiroPaginados(fetchParams, { signal: ac.signal });
        if (cancelled || fetchKeyRef.current !== myKey) return;
        const content = (res?.content ?? []).map((l) => mapApiLancamentoToExtratoRow(l, contaToLetra));
        setRows(content);
        setTotalElements(Number(res?.totalElements) || 0);
        setTotalPages(Number(res?.totalPages) || 0);
      } catch (e) {
        if (cancelled || e?.name === 'AbortError' || fetchKeyRef.current !== myKey) return;
        setErro(e?.message || 'Erro ao carregar extrato.');
        setRows([]);
      } finally {
        if (!cancelled && fetchKeyRef.current === myKey) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [fetchKey, fetchParams, contaToLetra, extratoRefreshKey]);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro || bancoAtivo == null) {
      setSaldoBanco(null);
      setSaldoBancoLoading(false);
      return undefined;
    }
    const ac = new AbortController();
    let cancelled = false;
    setSaldoBancoLoading(true);
    obterSaldoBancoFinanceiro(bancoAtivo, { signal: ac.signal })
      .then((res) => {
        if (!cancelled) setSaldoBanco(res);
      })
      .catch((e) => {
        if (!cancelled && e?.name !== 'AbortError') setSaldoBanco(null);
      })
      .finally(() => {
        if (!cancelled) setSaldoBancoLoading(false);
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [bancoAtivo, extratoRefreshKey]);

  useEffect(() => {
    const onRefresh = () => setExtratoRefreshKey((n) => n + 1);
    window.addEventListener(FINANCEIRO_REFRESH_PENDENTES, onRefresh);
    return () => window.removeEventListener(FINANCEIRO_REFRESH_PENDENTES, onRefresh);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [filters.page, filters.size, filters.banco, filters.mes, filters.etapa, filters.contaCodigo]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setDetailItem(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
    if (all) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(ids));
    }
  };

  const handleRowSaved = (updated) => {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setDetailItem(updated);
    setExtratoRefreshKey((n) => n + 1);
  };

  if (!featureFlags.useApiFinanceiro) {
    return (
      <div className="p-6 text-sm text-slate-600 dark:text-slate-400">
        {erro || 'API financeiro desativada.'}{' '}
        <a href="/financeiro/legado" className="text-blue-600 hover:underline dark:text-blue-400">
          Abrir extrato legado
        </a>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col min-h-0 h-full">
      <ExtratoFilters
        totalNaPagina={rows.length}
        totalGeral={totalElements}
        saldoBanco={saldoBanco}
        saldoBancoLoading={saldoBancoLoading}
      />

      {erro ? (
        <p className="px-3 py-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40">{erro}</p>
      ) : null}

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto bg-white dark:bg-slate-900">
        <ExtratoTable
          data={rows}
          selectedIds={selectedIds}
          onSelect={toggleSelect}
          onSelectAll={toggleSelectAll}
          onRowClick={setDetailItem}
          isLoading={loading}
        />
      </div>

      <Pagination
        page={filters.page}
        totalPages={totalPages}
        totalItems={totalElements}
        pageSize={filters.size}
        onPageChange={setPage}
        onPageSizeChange={setSize}
      />

      {detailItem ? (
        <>
          <button
            type="button"
            className="absolute inset-0 z-10 bg-black/20"
            aria-label="Fechar painel"
            data-financeiro-fechar-detalhe
            onClick={() => setDetailItem(null)}
          />
          <ExtratoDetailPanel
            item={detailItem}
            onClose={() => setDetailItem(null)}
            onSaved={handleRowSaved}
          />
        </>
      ) : null}
    </div>
  );
}
