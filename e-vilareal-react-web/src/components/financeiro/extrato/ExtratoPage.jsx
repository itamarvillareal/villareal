import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  buildContaToLetraMerge,
  loadPersistedContasContabeisExtrasFinanceiro,
} from '../../../data/financeiroData.js';
import {
  buscarLancamentoFinanceiroApi,
  listarContasFinanceiro,
  listarLancamentosExtratoPaginados,
  obterSaldoBancoFinanceiro,
  removerLancamentosFinanceiroApiEmLote,
} from '../../../repositories/financeiroRepository.js';
import { useFinanceiro } from '../FinanceiroContext.jsx';
import { isSortDataAsc } from '../hooks/useExtratoFilters.js';
import { useExtratoMesAoSelecionarBanco } from '../hooks/useExtratoMesAoSelecionarBanco.js';
import { FINANCEIRO_REFRESH_PENDENTES, dispatchRefreshPendentes } from '../hooks/useKeyboardShortcuts.js';
import { Pagination } from '../shared/Pagination.jsx';
import { ConfirmDialog } from '../shared/ConfirmDialog.jsx';
import { useFinanceiroToast } from '../shared/Toast.jsx';
import { ExtratoFilters } from './ExtratoFilters.jsx';
import { ExtratoTable } from './ExtratoTable.jsx';
import { ExtratoDetailPanel } from './ExtratoDetailPanel.jsx';
import { ExtratoBatchBar } from './ExtratoBatchBar.jsx';
import { mesAnoFromDataLancamento } from './extratoMesUtils.js';
import { scrollExtratoParaLancamento } from './extratoDeepLink.js';
import { mapApiLancamentoToExtratoRow } from './extratoMappers.js';

export function ExtratoPage() {
  const { apiQuery, filters, setPage, setSize, setMes, setBanco, bancoAtivo, toggleSortData } = useFinanceiro();
  const toast = useFinanceiroToast();

  useExtratoMesAoSelecionarBanco(bancoAtivo, filters.mes, setMes);
  const scrollRef = useRef(null);
  const fetchKeyRef = useRef('');
  const paginasCacheRef = useRef(new Map());
  const lancamentoFocusRef = useRef(null);
  const vinculoOverlayRef = useRef(new Map());

  const limparCachePaginas = useCallback(() => {
    paginasCacheRef.current.clear();
  }, []);
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
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

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
    const cached = paginasCacheRef.current.get(myKey);
    if (cached) {
      setRows(cached.rows);
      setTotalElements(cached.totalElements);
      setTotalPages(cached.totalPages);
      setLoading(false);
      setErro('');
      return undefined;
    }

    const ac = new AbortController();
    let cancelled = false;
    setRows([]);
    setSelectedIds(new Set());
    if (!filters.lancamento) setDetailItem(null);
    setLoading(true);
    setErro('');
    (async () => {
      try {
        const res = await listarLancamentosExtratoPaginados(fetchParams, { signal: ac.signal });
        if (cancelled || fetchKeyRef.current !== myKey) return;
        const content = (res?.content ?? []).map((l) => mapApiLancamentoToExtratoRow(l, contaToLetra));
        const mesclarVinculo = (m, anterior) => {
          const o = vinculoOverlayRef.current.get(Number(m.id));
          const cod = m.codCliente || anterior?.codCliente || o?.codCliente || '';
          const proc = m.proc || anterior?.proc || o?.proc || '';
          const clienteId = m.clienteId ?? anterior?.clienteId ?? o?.clienteId ?? null;
          const processoId = m.processoId ?? anterior?.processoId ?? o?.processoId ?? null;
          if (!cod && !proc && !clienteId && !processoId) return m;
          return { ...m, codCliente: cod, proc, clienteId, processoId };
        };
        const totalEl = Number(res?.totalElements) || 0;
        const totalPg = Number(res?.totalPages) || 0;
        let mergedRows = content;
        setRows((prev) => {
          const byId = new Map((prev || []).map((r) => [Number(r.id), r]));
          mergedRows = content.map((m) => mesclarVinculo(m, byId.get(Number(m.id))));
          return mergedRows;
        });
        setTotalElements(totalEl);
        setTotalPages(totalPg);
        if (paginasCacheRef.current.size > 20) {
          const firstKey = paginasCacheRef.current.keys().next().value;
          paginasCacheRef.current.delete(firstKey);
        }
        paginasCacheRef.current.set(myKey, {
          rows: mergedRows,
          totalElements: totalEl,
          totalPages: totalPg,
        });
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
  }, [fetchKey, fetchParams, contaToLetra, extratoRefreshKey, filters.lancamento]);

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
    const onRefresh = () => {
      limparCachePaginas();
      setExtratoRefreshKey((n) => n + 1);
    };
    window.addEventListener(FINANCEIRO_REFRESH_PENDENTES, onRefresh);
    return () => window.removeEventListener(FINANCEIRO_REFRESH_PENDENTES, onRefresh);
  }, [limparCachePaginas]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [filters.page, filters.size, filters.banco, filters.mes, filters.etapa, filters.contaCodigo, filters.busca, filters.sort]);

  useEffect(() => {
    limparCachePaginas();
  }, [filters.busca, limparCachePaginas]);

  useEffect(() => {
    const id = filters.lancamento;
    if (!id || !featureFlags.useApiFinanceiro) return undefined;
    if (lancamentoFocusRef.current === id) return undefined;

    const naPagina = rows.find((r) => Number(r.id) === Number(id));
    if (naPagina) {
      setDetailItem(naPagina);
      lancamentoFocusRef.current = id;
      requestAnimationFrame(() => scrollExtratoParaLancamento(id));
      return undefined;
    }

    const ac = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const api = await buscarLancamentoFinanceiroApi(id, { signal: ac.signal });
        if (cancelled || !api) return;
        const nb = Number(api.numeroBanco);
        if (Number.isFinite(nb) && nb !== filters.banco) setBanco(nb);
        const mes = mesAnoFromDataLancamento(api.dataLancamento);
        if (mes && mes !== filters.mes) setMes(mes);
        const mapped = mapApiLancamentoToExtratoRow(api, contaToLetra);
        if (!cancelled) {
          setDetailItem(mapped);
          lancamentoFocusRef.current = id;
        }
      } catch (e) {
        if (!cancelled && e?.name !== 'AbortError') {
          setErro(e?.message || 'Não foi possível abrir o lançamento solicitado.');
        }
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [filters.lancamento, filters.banco, filters.mes, rows, contaToLetra, setBanco, setMes]);

  useEffect(() => {
    if (!filters.lancamento) lancamentoFocusRef.current = null;
  }, [filters.lancamento]);

  useEffect(() => {
    const id = filters.lancamento;
    if (!id || loading) return undefined;
    const naPagina = rows.find((r) => Number(r.id) === Number(id));
    if (!naPagina) return undefined;
    requestAnimationFrame(() => scrollExtratoParaLancamento(id));
    return undefined;
  }, [filters.lancamento, rows, loading]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setDetailItem(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const ids = rows.map((r) => r.id);
      const all = ids.length > 0 && ids.every((id) => prev.has(id));
      return all ? new Set() : new Set(ids);
    });
  }, [rows]);

  const handleRowClick = useCallback((item) => {
    setDetailItem(item);
  }, []);

  const handleRowSaved = (updated) => {
    vinculoOverlayRef.current.set(Number(updated.id), {
      codCliente: updated.codCliente,
      proc: updated.proc,
      clienteId: updated.clienteId,
      processoId: updated.processoId,
    });
    limparCachePaginas();
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setDetailItem(updated);
    setExtratoRefreshKey((n) => n + 1);
  };

  const handleRowDeleted = (apiId) => {
    limparCachePaginas();
    setRows((prev) => prev.filter((r) => Number(r.id) !== Number(apiId)));
    setTotalElements((n) => Math.max(0, Number(n) - 1));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(apiId);
      return next;
    });
    setDetailItem(null);
    setExtratoRefreshKey((n) => n + 1);
  };

  const aplicarExclusoesLocais = useCallback(
    (removidos) => {
      if (!removidos?.length) return;
      const removedSet = new Set(removidos.map((id) => Number(id)));
      limparCachePaginas();
      setRows((prev) => prev.filter((r) => !removedSet.has(Number(r.id))));
      setTotalElements((n) => Math.max(0, Number(n) - removidos.length));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of removidos) next.delete(id);
        return next;
      });
      setDetailItem((prev) => (prev && removedSet.has(Number(prev.id)) ? null : prev));
      setExtratoRefreshKey((k) => k + 1);
      dispatchRefreshPendentes();
    },
    [limparCachePaginas],
  );

  const handleConfirmBulkDelete = async () => {
    const ids = [...selectedIds];
    if (!ids.length) {
      setConfirmBulkDelete(false);
      return;
    }
    setBulkDeleting(true);
    try {
      const { removidos, erros } = await removerLancamentosFinanceiroApiEmLote(ids);
      if (removidos.length) {
        aplicarExclusoesLocais(removidos);
        toast.success(
          removidos.length === 1
            ? '1 lançamento excluído do extrato.'
            : `${removidos.length.toLocaleString('pt-BR')} lançamentos excluídos do extrato.`,
        );
      }
      if (erros.length) {
        toast.warn(
          `${erros.length.toLocaleString('pt-BR')} falha(s) ao excluir. ${erros
            .slice(0, 2)
            .map((e) => e.message)
            .join(' · ')}`,
        );
      }
    } catch (e) {
      toast.error(e?.message || 'Falha ao excluir lançamentos.');
    } finally {
      setBulkDeleting(false);
      setConfirmBulkDelete(false);
    }
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

      <ExtratoBatchBar
        count={selectedIds.size}
        busy={bulkDeleting}
        onExcluir={() => setConfirmBulkDelete(true)}
        onLimparSelecao={() => setSelectedIds(new Set())}
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
          onRowClick={handleRowClick}
          isLoading={loading}
          sortDataAsc={isSortDataAsc(filters.sort)}
          onSortDataDoubleClick={toggleSortData}
          highlightLancamentoId={filters.lancamento}
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
            onDeleted={handleRowDeleted}
          />
        </>
      ) : null}

      <ConfirmDialog
        open={confirmBulkDelete}
        title="Excluir lançamentos selecionados?"
        message={`${selectedIds.size.toLocaleString('pt-BR')} lançamento(s) será(ão) removido(s) do extrato. Esta ação não pode ser desfeita.`}
        confirmLabel={bulkDeleting ? 'Excluindo…' : 'Excluir'}
        danger
        onCancel={() => {
          if (!bulkDeleting) setConfirmBulkDelete(false);
        }}
        onConfirm={() => {
          if (!bulkDeleting) void handleConfirmBulkDelete();
        }}
      />
    </div>
  );
}
