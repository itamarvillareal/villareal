import { useCallback, useMemo, useState } from 'react';

export function usePagination(initial = {}) {
  const [page, setPage] = useState(initial.page ?? 0);
  const [size, setSize] = useState(initial.size ?? 100);
  const [sort, setSort] = useState(initial.sort ?? 'dataLancamento,desc');
  const [meta, setMeta] = useState({ totalPages: 0, totalElements: 0 });

  const applyPageResponse = useCallback((res) => {
    if (!res) return;
    setMeta({
      totalPages: Number(res.totalPages) || 0,
      totalElements: Number(res.totalElements) || 0,
    });
    if (res.number != null) setPage(Number(res.number) || 0);
    if (res.size != null) setSize(Number(res.size) || size);
  }, [size]);

  const goToPage = useCallback((n) => {
    setPage(Math.max(0, Number(n) || 0));
  }, []);

  const nextPage = useCallback(() => {
    setPage((p) => p + 1);
  }, []);

  const prevPage = useCallback(() => {
    setPage((p) => Math.max(0, p - 1));
  }, []);

  const setPageSize = useCallback((n) => {
    setSize(Number(n) || 100);
    setPage(0);
  }, []);

  const setSortField = useCallback((field, direction = 'desc') => {
    setSort(`${field},${direction}`);
    setPage(0);
  }, []);

  const query = useMemo(
    () => ({ page, size, sort }),
    [page, size, sort],
  );

  return {
    page,
    size,
    sort,
    totalPages: meta.totalPages,
    totalElements: meta.totalElements,
    query,
    goToPage,
    nextPage,
    prevPage,
    setPageSize,
    setSortField,
    applyPageResponse,
    setPage,
  };
}
