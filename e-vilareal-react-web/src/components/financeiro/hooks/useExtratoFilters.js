import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mesAtualIso, periodoParaQueryApi } from '../shared/periodoFinanceiro.js';

const DEBOUNCE_MS = 300;

const SORT_DATA_ASC = 'dataLancamento,asc';
const SORT_DATA_DESC = 'dataLancamento,desc';

export function isSortDataAsc(sort) {
  return String(sort ?? '').toLowerCase() === SORT_DATA_ASC.toLowerCase();
}

export function toggleSortDataLancamento(sort) {
  return isSortDataAsc(sort) ? SORT_DATA_DESC : SORT_DATA_ASC;
}

function parseBancoParam(params) {
  const raw = params.get('banco');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseLancamentoParam(params) {
  const n = Number(params.get('lancamento'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const TIPO_PAR_COMPENSAR_TODOS = 'TODOS';
const TIPO_DIA_COMPENSAR_TODOS = 'TODOS';
const LETRA_SUGESTAO_TODAS = 'TODAS';

function readLetraSugestaoParam(params) {
  const raw = String(params.get('letraSugestao') ?? '').trim().toUpperCase();
  if (!raw || raw === LETRA_SUGESTAO_TODAS) return LETRA_SUGESTAO_TODAS;
  if (raw === 'SEM') return 'SEM';
  if (/^[A-Z]$/.test(raw)) return raw;
  return LETRA_SUGESTAO_TODAS;
}

function readTipoParParam(params) {
  const raw = params.get('tipoPar');
  if (raw === 'MESMO_BANCO' || raw === 'INTERBANCARIO') return raw;
  return TIPO_PAR_COMPENSAR_TODOS;
}

function readTipoDiaParam(params) {
  const raw = params.get('tipoDia');
  if (raw === 'MESMO_DIA' || raw === 'DIVERGENTE') return raw;
  return TIPO_DIA_COMPENSAR_TODOS;
}

function readFilters(params) {
  return {
    banco: parseBancoParam(params),
    lancamento: parseLancamentoParam(params),
    mes: params.get('mes') || mesAtualIso(),
    tipoPar: readTipoParParam(params),
    tipoDia: readTipoDiaParam(params),
    letraSugestao: readLetraSugestaoParam(params),
    etapa: params.get('etapa') || null,
    contaCodigo: params.get('conta') || null,
    busca: params.get('busca') || '',
    semClienteId: params.get('semCliente') === '1',
    semGrupoCompensacao: params.get('semGrupo') === '1',
    page: params.get('page') ? Math.max(0, Number(params.get('page')) || 0) : 0,
    size: params.get('size') ? Number(params.get('size')) || 100 : 100,
    sort: params.get('sort') || SORT_DATA_DESC,
  };
}

function writeFilters(params, f) {
  const next = new URLSearchParams(params);
  const setOrDel = (key, val) => {
    if (val == null || val === '' || val === false) next.delete(key);
    else next.set(key, String(val));
  };
  setOrDel('banco', Number.isFinite(f.banco) ? f.banco : null);
  setOrDel('lancamento', Number.isFinite(f.lancamento) ? f.lancamento : null);
  setOrDel('mes', f.mes);
  setOrDel(
    'tipoPar',
    f.tipoPar && f.tipoPar !== TIPO_PAR_COMPENSAR_TODOS ? f.tipoPar : null,
  );
  setOrDel(
    'tipoDia',
    f.tipoDia && f.tipoDia !== TIPO_DIA_COMPENSAR_TODOS ? f.tipoDia : null,
  );
  setOrDel(
    'letraSugestao',
    f.letraSugestao && f.letraSugestao !== LETRA_SUGESTAO_TODAS ? f.letraSugestao : null,
  );
  setOrDel('etapa', f.etapa);
  setOrDel('conta', f.contaCodigo);
  setOrDel('busca', f.busca);
  setOrDel('semCliente', f.semClienteId ? '1' : null);
  setOrDel('semGrupo', f.semGrupoCompensacao ? '1' : null);
  setOrDel('page', f.page > 0 ? f.page : null);
  setOrDel('size', f.size !== 100 ? f.size : null);
  setOrDel('sort', f.sort !== SORT_DATA_DESC ? f.sort : null);
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
  const [debouncedBusca, setDebouncedBusca] = useState(filters.busca);

  useEffect(() => {
    setBuscaDraft(filters.busca);
    setDebouncedBusca(filters.busca);
  }, [filters.busca]);

  useEffect(() => {
    if (buscaDraft === debouncedBusca) return undefined;
    const t = window.setTimeout(() => setDebouncedBusca(buscaDraft), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [buscaDraft, debouncedBusca]);

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

  /** Ao digitar busca, volta para página 0 antes do debounce (evita buscar só na página atual). */
  useEffect(() => {
    if (buscaDraft === filters.busca) return undefined;
    if (filters.page > 0) {
      pushParams((prev) => ({ ...prev, page: 0 }));
    }
    return undefined;
  }, [buscaDraft, filters.busca, filters.page, pushParams]);

  useEffect(() => {
    if (debouncedBusca === filters.busca) return undefined;
    pushParams((prev) => ({ ...prev, busca: debouncedBusca, page: 0 }));
    return undefined;
  }, [debouncedBusca, filters.busca, pushParams]);

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

  const apiQuery = useMemo(() => {
    const periodo = periodoParaQueryApi(filters.mes);
    const busca = String(debouncedBusca ?? '').trim();
    const buscaPendente = busca !== String(filters.busca ?? '').trim();
    return {
      numeroBanco: Number.isFinite(filters.banco) ? filters.banco : undefined,
      ...periodo,
      etapa: filters.etapa ?? undefined,
      busca: busca || undefined,
      semClienteId: filters.semClienteId || undefined,
      semGrupoCompensacao: filters.semGrupoCompensacao || undefined,
      page: buscaPendente ? 0 : filters.page,
      size: filters.size,
      sort: filters.sort,
    };
  }, [
    filters.banco,
    filters.mes,
    filters.etapa,
    filters.busca,
    debouncedBusca,
    filters.semClienteId,
    filters.semGrupoCompensacao,
    filters.page,
    filters.size,
    filters.sort,
  ]);

  const setBanco = useCallback((banco) => syncUrl({ banco, resetPage: true }), [syncUrl]);
  const setMes = useCallback((mes) => syncUrl({ mes, resetPage: true }), [syncUrl]);
  const setTipoPar = useCallback(
    (tipoPar) => syncUrl({ tipoPar: tipoPar || TIPO_PAR_COMPENSAR_TODOS, resetPage: true }),
    [syncUrl],
  );
  const setTipoDia = useCallback(
    (tipoDia) => syncUrl({ tipoDia: tipoDia || TIPO_DIA_COMPENSAR_TODOS, resetPage: true }),
    [syncUrl],
  );
  const setLetraSugestao = useCallback(
    (letraSugestao) =>
      syncUrl({ letraSugestao: letraSugestao || LETRA_SUGESTAO_TODAS, resetPage: true }),
    [syncUrl],
  );
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
  const setSort = useCallback((sort) => syncUrl({ sort, resetPage: true }), [syncUrl]);
  const toggleSortData = useCallback(() => {
    syncUrl({ sort: toggleSortDataLancamento(filters.sort), resetPage: true });
  }, [syncUrl, filters.sort]);
  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  return {
    filters,
    apiQuery,
    setBanco,
    setMes,
    setTipoPar,
    setTipoDia,
    setLetraSugestao,
    setEtapa,
    setContaCodigo,
    setBusca,
    setSemClienteId,
    setSemGrupoCompensacao,
    setPage,
    setSize,
    setSort,
    toggleSortData,
    clearFilters,
  };
}
