import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const DEBOUNCE_MS = 300;

function mesAtualIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function parseBancoParam(params) {
  const raw = params.get('banco');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function readFilters(params) {
  return {
    banco: parseBancoParam(params),
    mes: params.get('mes') || mesAtualIso(),
    etapa: params.get('etapa') || null,
    contaCodigo: params.get('conta') || null,
    busca: params.get('busca') || '',
    semClienteId: params.get('semCliente') === '1',
    semGrupoCompensacao: params.get('semGrupo') === '1',
    page: params.get('page') ? Math.max(0, Number(params.get('page')) || 0) : 0,
    size: params.get('size') ? Number(params.get('size')) || 100 : 100,
    sort: params.get('sort') || 'dataLancamento,desc',
  };
}

function writeFilters(params, f) {
  const next = new URLSearchParams(params);
  const setOrDel = (key, val) => {
    if (val == null || val === '' || val === false) next.delete(key);
    else next.set(key, String(val));
  };
  setOrDel('banco', Number.isFinite(f.banco) ? f.banco : null);
  setOrDel('mes', f.mes);
  setOrDel('etapa', f.etapa);
  setOrDel('conta', f.contaCodigo);
  setOrDel('busca', f.busca);
  setOrDel('semCliente', f.semClienteId ? '1' : null);
  setOrDel('semGrupo', f.semGrupoCompensacao ? '1' : null);
  setOrDel('page', f.page > 0 ? f.page : null);
  setOrDel('size', f.size !== 100 ? f.size : null);
  setOrDel('sort', f.sort !== 'dataLancamento,desc' ? f.sort : null);
  return next;
}

/**
 * URL é a única fonte de verdade dos filtros (evita loop setState ↔ setSearchParams).
 */
export function useExtratoFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchKey = searchParams.toString();
  const filters = useMemo(() => readFilters(searchParams), [searchKey]);

  const [buscaDraft, setBuscaDraft] = useState(filters.busca);

  useEffect(() => {
    setBuscaDraft(filters.busca);
  }, [filters.busca]);

  const pushParams = useCallback(
    (buildNext) => {
      setSearchParams((params) => {
        const prev = readFilters(params);
        const next = buildNext(prev);
        const written = writeFilters(params, next);
        return written.toString() === params.toString() ? params : written;
      }, { replace: true });
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (buscaDraft === filters.busca) return undefined;
    const t = window.setTimeout(() => {
      pushParams((prev) => {
        const next = { ...prev, busca: buscaDraft, page: 0 };
        return next;
      });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [buscaDraft, filters.busca, pushParams]);

  const syncUrl = useCallback(
    (patch) => {
      pushParams((prev) => {
        const next = { ...prev, ...patch };
        if (patch.resetPage) next.page = 0;
        else if (patch.page != null) next.page = patch.page;
        return next;
      });
    },
    [pushParams],
  );

  const apiQuery = useMemo(
    () => ({
      numeroBanco: Number.isFinite(filters.banco) ? filters.banco : undefined,
      mes: filters.mes?.split('-')[1] ?? undefined,
      ano: filters.mes?.split('-')[0] ?? undefined,
      etapa: filters.etapa ?? undefined,
      busca: filters.busca || undefined,
      semClienteId: filters.semClienteId || undefined,
      semGrupoCompensacao: filters.semGrupoCompensacao || undefined,
      page: filters.page,
      size: filters.size,
      sort: filters.sort,
    }),
    [
      filters.banco,
      filters.mes,
      filters.etapa,
      filters.busca,
      filters.semClienteId,
      filters.semGrupoCompensacao,
      filters.page,
      filters.size,
      filters.sort,
    ],
  );

  const setBanco = useCallback((banco) => syncUrl({ banco, resetPage: true }), [syncUrl]);
  const setMes = useCallback((mes) => syncUrl({ mes, resetPage: true }), [syncUrl]);
  const setEtapa = useCallback((etapa) => syncUrl({ etapa, resetPage: true }), [syncUrl]);
  const setContaCodigo = useCallback((contaCodigo) => syncUrl({ contaCodigo, resetPage: true }), [syncUrl]);
  const setBusca = useCallback((busca) => setBuscaDraft(busca ?? ''), []);
  const setSemClienteId = useCallback(
    (semClienteId) => syncUrl({ semClienteId, resetPage: true }),
    [syncUrl],
  );
  const setSemGrupoCompensacao = useCallback(
    (semGrupoCompensacao) => syncUrl({ semGrupoCompensacao, resetPage: true }),
    [syncUrl],
  );
  const setPage = useCallback((page) => syncUrl({ page }), [syncUrl]);
  const setSize = useCallback((size) => syncUrl({ size, resetPage: true }), [syncUrl]);
  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  return {
    filters,
    apiQuery,
    setBanco,
    setMes,
    setEtapa,
    setContaCodigo,
    setBusca,
    setSemClienteId,
    setSemGrupoCompensacao,
    setPage,
    setSize,
    clearFilters,
  };
}
